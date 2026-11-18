const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const E_FACTURA_TIPS = new Set([
  "FACTURA PRIMITA",
  "FACTURA TRIMISA",
  "ERORI FACTURA",
]);

function normalizeCif(value) {
  return String(value || "")
    .replace(/^RO/i, "")
    .trim();
}

async function clearAnafWebserviceCookies() {
  try {
    const cookies = await chrome.cookies.getAll({
      url: "https://webserviced.anaf.ro/",
    });
    for (const c of cookies) {
      const host = String(c.domain || "webserviced.anaf.ro").replace(/^\./, "");
      const cookieUrl = `https://${host}${c.path || "/"}`;
      await chrome.cookies.remove({ url: cookieUrl, name: c.name }).catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

async function readListJsonFromTab(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: async () => {
      const tryParse = (raw) => {
        if (!raw) return null;
        const trimmed = raw.trim();
        if (!trimmed.startsWith("{")) return null;
        try {
          return JSON.parse(trimmed);
        } catch {
          return null;
        }
      };

      const trimmedPreview = (s) => String(s || "").trim().slice(0, 220);

      const preText = document.querySelector("pre")?.textContent || "";
      const bodyText = document.body?.innerText || "";
      const lowerBody = bodyText.toLowerCase();
      if (
        lowerBody.includes("session could not be established") ||
        lowerBody.includes("access was denied by the access policy")
      ) {
        return { parsed: null, isHangupPage: true, preview: trimmedPreview(bodyText) };
      }

      const direct = tryParse(preText) || tryParse(bodyText);
      if (direct) {
        return {
          parsed: direct,
          isHangupPage: false,
          preview: trimmedPreview(preText || bodyText),
        };
      }

      try {
        const resp = await fetch(window.location.href, {
          credentials: "include",
          cache: "no-store",
        });
        const txt = await resp.text();
        return {
          parsed: tryParse(txt),
          isHangupPage: false,
          preview: trimmedPreview(txt),
        };
      } catch (err) {
        return { parsed: null, isHangupPage: false, preview: String(err?.message || err) };
      }
    },
  });

  return results?.[0]?.result || { parsed: null, isHangupPage: false, preview: "" };
}

async function downloadDocumentInTab(tabId, messageId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    args: [String(messageId)],
    func: async (id) => {
      const url = `https://webserviced.anaf.ro/SPVWS2/rest/descarcare?id=${encodeURIComponent(id)}`;
      const resp = await fetch(url, { credentials: "include", cache: "no-store" });
      const contentType = resp.headers.get("content-type") || "";
      const disp = resp.headers.get("content-disposition") || "";
      let fileName = "";
      const nameMatch =
        disp.match(/filename\*=UTF-8''([^;]+)/i) ||
        disp.match(/filename="?([^";]+)"?/i);
      if (nameMatch?.[1]) {
        try {
          fileName = decodeURIComponent(nameMatch[1].trim());
        } catch {
          fileName = nameMatch[1].trim();
        }
      }

      const buf = await resp.arrayBuffer();
      const bytes = new Uint8Array(buf);
      if (!resp.ok || bytes.length === 0) {
        return {
          ok: false,
          error: `ANAF a returnat HTTP ${resp.status} pentru documentul ${id}.`,
        };
      }

      let firstNonWs = 0;
      for (let i = 0; i < Math.min(bytes.length, 64); i++) {
        if (bytes[i] > 32) {
          firstNonWs = bytes[i];
          break;
        }
      }
      if (contentType.toLowerCase().includes("json") || firstNonWs === 123) {
        try {
          const text = new TextDecoder("utf-8").decode(bytes);
          const jsonErr = JSON.parse(text);
          if (jsonErr?.eroare) {
            return { ok: false, error: String(jsonErr.eroare) };
          }
        } catch {
          /* ignore */
        }
      }

      const CHUNK_SIZE = 0x6000;
      let binary = "";
      for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        const sub = bytes.subarray(i, i + CHUNK_SIZE);
        binary += String.fromCharCode.apply(null, sub);
      }

      return {
        ok: true,
        base64: btoa(binary),
        contentType,
        fileName,
      };
    },
  });

  return (
    results?.[0]?.result || {
      ok: false,
      error: "Nu s-a putut citi fisierul din sesiunea ANAF.",
    }
  );
}

async function waitForListJson(tabId, anafListUrl) {
  const deadline = Date.now() + 120000;
  let hangupRetries = 0;
  let nonJsonAttemptsAtListUrl = 0;

  while (Date.now() < deadline) {
    let tab;
    try {
      tab = await chrome.tabs.get(tabId);
    } catch {
      return {
        ok: false,
        error: "Tab-ul ANAF a fost inchis inainte de finalizarea autentificarii cu stick-ul USB.",
      };
    }

    const url = String(tab.url || "");
    if (url.includes("/vdesk/hangup") || url.includes("/my.logout")) {
      if (hangupRetries < 2) {
        hangupRetries += 1;
        await clearAnafWebserviceCookies();
        await chrome.tabs.update(tabId, { url: anafListUrl });
        await sleep(750);
        continue;
      }
      return {
        ok: false,
        error:
          "ANAF a inchis sesiunea de certificat (hangup). Verifica daca stick-ul USB este introdus si PIN-ul certificatului a fost introdus corect.",
      };
    }

    if (tab.status === "complete" && url.includes("/my.policy")) {
      try {
        const policyCheck = await readListJsonFromTab(tabId);
        if (policyCheck?.isHangupPage) {
          if (hangupRetries < 2) {
            hangupRetries += 1;
            await clearAnafWebserviceCookies();
            await chrome.tabs.update(tabId, { url: anafListUrl });
            await sleep(750);
            continue;
          }
          return {
            ok: false,
            error:
              "ANAF a respins sesiunea F5 APM. Inchideti tab-ul anaf.ro, verificati stick-ul USB si reincercati.",
          };
        }
      } catch {
        /* redirect in progress */
      }
    }

    if (
      tab.status === "complete" &&
      url.startsWith("https://webserviced.anaf.ro/SPVWS2/rest/listaMesaje")
    ) {
      let readRes = null;
      try {
        readRes = await readListJsonFromTab(tabId);
      } catch {
        readRes = null;
      }

      if (readRes?.isHangupPage) {
        if (hangupRetries < 2) {
          hangupRetries += 1;
          await clearAnafWebserviceCookies();
          await chrome.tabs.update(tabId, { url: anafListUrl });
          await sleep(750);
          continue;
        }
        return {
          ok: false,
          error: "ANAF a inchis sesiunea F5 inainte de returnarea listei SPV.",
        };
      }

      if (readRes?.parsed) {
        return { ok: true, data: readRes.parsed };
      }
      nonJsonAttemptsAtListUrl += 1;
      if (nonJsonAttemptsAtListUrl >= 12) {
        return {
          ok: false,
          error:
            "Raspunsul primit de la webserviced.anaf.ro nu este JSON valid. Verifica autentificarea cu certificatul digital.",
        };
      }
    }

    await sleep(450);
  }

  return {
    ok: false,
    error:
      "Timpul de asteptare (120s) pentru selectarea certificatului USB si introducerea PIN-ului a expirat.",
  };
}

async function handleSpvSync(msg, appTabId) {
  const targetCif = normalizeCif(msg.cif);
  if (!targetCif) {
    return {
      ok: false,
      error: "Profilul activ nu are CUI / CNP configurat in Setari.",
    };
  }

  let zileUsed = Math.min(60, Math.max(1, Number(msg.zile) || 60));
  const initialUrl = `https://webserviced.anaf.ro/SPVWS2/rest/listaMesaje?zile=${zileUsed}`;
  const existingSet = new Set((msg.existingIds || []).map(String));

  const workerTab = await chrome.tabs.create({
    url: initialUrl,
    active: true,
  });

  if (!workerTab?.id) {
    return {
      ok: false,
      error: "Nu s-a putut deschide tab-ul pentru webserviced.anaf.ro.",
    };
  }

  const workerTabId = workerTab.id;

  const restoreAppTab = async () => {
    if (appTabId) {
      await chrome.tabs.update(appTabId, { active: true }).catch(() => {});
    }
  };

  try {
    let listOutcome = await waitForListJson(workerTabId, initialUrl);
    if (!listOutcome.ok) {
      await restoreAppTab();
      return listOutcome;
    }

    let listData = listOutcome.data;

    // Fallback automat daca ANAF respinge zile=60 cu eroare de interval
    const fallbackDays = [59, 50];
    for (const candidateDays of fallbackDays) {
      if (
        listData?.eroare &&
        String(listData.eroare).toLowerCase().includes("zile") &&
        zileUsed > candidateDays
      ) {
        zileUsed = candidateDays;
        const retryUrl = `https://webserviced.anaf.ro/SPVWS2/rest/listaMesaje?zile=${zileUsed}`;
        await chrome.tabs.update(workerTabId, { url: retryUrl });
        listOutcome = await waitForListJson(workerTabId, retryUrl);
        if (!listOutcome.ok) {
          await restoreAppTab();
          return listOutcome;
        }
        listData = listOutcome.data;
      }
    }

    const allowedCifs = Array.from(
      new Set(
        [listData.cnp, ...String(listData.cui || "").split(",")]
          .map(normalizeCif)
          .filter(Boolean)
      )
    );

    if (listData.eroare) {
      const errText = String(listData.eroare);
      await restoreAppTab();
      if (errText.toLowerCase().includes("nu exista mesaje")) {
        return {
          ok: true,
          emptyNotice: errText,
          matchedTotal: 0,
          downloaded: 0,
          alreadySaved: 0,
          failed: 0,
          certCnp: listData.cnp ? String(listData.cnp) : null,
          certCui: listData.cui ? String(listData.cui) : null,
          certSerial: listData.serial ? String(listData.serial) : null,
          diagnostics: {
            rawTotal: 0,
            matchedTotal: 0,
            allowedCifs,
            zileUsed,
          },
        };
      }
      return {
        ok: false,
        error: errText,
        diagnostics: {
          rawTotal: 0,
          matchedTotal: 0,
          allowedCifs,
          zileUsed,
        },
      };
    }

    const allMessages = Array.isArray(listData.mesaje) ? listData.mesaje : [];
    const matched = allMessages.filter((m) => {
      const msgCif = normalizeCif(m?.cif || m?.cnp || m?.cui);
      const detaliiText = String(m?.detalii || "");
      const tipUpper = String(m?.tip || "")
        .toUpperCase()
        .trim();
      const matchesTarget =
        msgCif === targetCif || (!msgCif && detaliiText.includes(targetCif));
      return matchesTarget && !E_FACTURA_TIPS.has(tipUpper);
    });

    if (
      matched.length === 0 &&
      allowedCifs.length > 0 &&
      !allowedCifs.includes(targetCif)
    ) {
      await restoreAppTab();
      return {
        ok: false,
        wrongCertificate: true,
        allowedCifs,
        certSerial: listData.serial ? String(listData.serial) : null,
        error: `Certificatul USB selectat in Chrome are drepturi in SPV pentru ${allowedCifs.join(", ")}, nu pentru ${targetCif}.`,
        diagnostics: {
          rawTotal: allMessages.length,
          matchedTotal: 0,
          allowedCifs,
          zileUsed,
        },
      };
    }

    await restoreAppTab();

    const toDownload = matched.filter(
      (m) => m?.id && !existingSet.has(String(m.id))
    );
    const alreadySaved = matched.length - toDownload.length;
    let downloaded = 0;
    let failed = 0;
    let lastError = null;

    for (let i = 0; i < toDownload.length; i += 1) {
      const m = toDownload[i];
      if (appTabId) {
        await chrome.tabs
          .sendMessage(appTabId, {
            type: "SPV_CONNECTOR_PROGRESS",
            requestId: msg.requestId,
            current: i + 1,
            total: toDownload.length,
            tip: String(m.tip || "DOCUMENT"),
          })
          .catch(() => {});
      }

      const dl = await downloadDocumentInTab(workerTabId, m.id);
      if (!dl?.ok || !dl?.base64) {
        failed += 1;
        lastError = dl?.error || `Eroare la descarcarea mesajului ${m.id}.`;
        continue;
      }

      if (appTabId) {
        const ack = await chrome.tabs
          .sendMessage(appTabId, {
            type: "SPV_CONNECTOR_DOCUMENT",
            requestId: msg.requestId,
            item: {
              anafId: String(m.id),
              cif: targetCif,
              tip: String(m.tip || "DOCUMENT"),
              idSolicitare: m.id_solicitare ? String(m.id_solicitare) : null,
              dataCreare: String(m.data_creare || ""),
              detalii: String(m.detalii || ""),
              fileBase64: dl.base64,
              contentType: dl.contentType || "",
              originalFileName: dl.fileName || "",
            },
          })
          .catch((err) => ({ ok: false, error: err?.message }));

        if (ack?.ok) {
          if (!ack.skippedDuplicate) downloaded += 1;
        } else {
          failed += 1;
          lastError = ack?.error || `Nu s-a putut salva documentul ${m.id}.`;
        }
      }
    }

    return {
      ok: true,
      matchedTotal: matched.length,
      downloaded,
      alreadySaved,
      failed,
      lastError,
      certCnp: listData.cnp ? String(listData.cnp) : null,
      certCui: listData.cui ? String(listData.cui) : null,
      certSerial: listData.serial ? String(listData.serial) : null,
      diagnostics: {
        rawTotal: allMessages.length,
        matchedTotal: matched.length,
        allowedCifs,
        zileUsed,
      },
    };
  } finally {
    await chrome.tabs.remove(workerTabId).catch(() => {});
    await restoreAppTab();
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.action !== "SYNC_SPVWS2") return false;

  (async () => {
    try {
      const result = await handleSpvSync(message, sender?.tab?.id || null);
      sendResponse(result);
    } catch (err) {
      sendResponse({
        ok: false,
        error:
          err && err.message
            ? err.message
            : "Eroare neasteptata la conectarea cu SPV ANAF.",
      });
    }
  })();

  return true;
});
