const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const E_FACTURA_TIPS = new Set([
  "FACTURA PRIMITA",
  "FACTURA TRIMISA",
  "ERORI FACTURA",
]);

const HIDE_JSON_CSS =
  "html, body, pre { background: #f8fafc !important; color: transparent !important; opacity: 0 !important; }";

function normalizeCif(value) {
  return String(value || "")
    .replace(/^RO/i, "")
    .trim();
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  const CHUNK_SIZE = 0x6000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const sub = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode.apply(null, sub);
  }
  return btoa(binary);
}

function parseContentDispositionFilename(disp) {
  if (!disp) return "";
  const nameMatch =
    disp.match(/filename\*=UTF-8''([^;]+)/i) ||
    disp.match(/filename="?([^";]+)"?/i);
  if (!nameMatch?.[1]) return "";
  try {
    return decodeURIComponent(nameMatch[1].trim());
  } catch {
    return nameMatch[1].trim();
  }
}

async function clearAnafWebserviceCookies() {
  try {
    const seen = new Set();
    const lists = await Promise.all([
      chrome.cookies.getAll({ url: "https://webserviced.anaf.ro/" }).catch(() => []),
      chrome.cookies.getAll({ domain: "webserviced.anaf.ro" }).catch(() => []),
      chrome.cookies.getAll({ domain: "anaf.ro" }).catch(() => []),
    ]);
    for (const group of lists) {
      for (const c of group) {
        const host = String(c.domain || "webserviced.anaf.ro").replace(/^\./, "");
        const cookieUrl = `https://${host}${c.path || "/"}`;
        const isF5Cookie =
          host.includes("webserviced.anaf.ro") ||
          /^(MRHSession|LastMRH_Session|F5_ST|TIN|Session_)/i.test(String(c.name || ""));
        if (!isF5Cookie) continue;
        const key = `${cookieUrl}|${c.name}|${c.storeId || ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        await chrome.cookies.remove({ url: cookieUrl, name: c.name }).catch(() => {});
      }
    }
  } catch {
    /* ignore */
  }
}

async function resetAnafCertSession() {
  const logoutEndpoints = [
    "https://webserviced.anaf.ro/vdesk/hangup.php3",
    "https://webserviced.anaf.ro/my.logout.php3",
  ];
  await Promise.all(
    logoutEndpoints.map(async (endpoint) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      try {
        await fetch(endpoint, {
          credentials: "include",
          cache: "no-store",
          redirect: "follow",
          signal: controller.signal,
        });
      } catch {
        /* ignore logout network errors */
      } finally {
        clearTimeout(timer);
      }
    })
  );
  await clearAnafWebserviceCookies();
}

async function hideTabJsonContent(tabId) {
  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      css: HIDE_JSON_CSS,
    });
  } catch {
    /* tab might still be navigating or on policy page */
  }
}

async function tryDirectFetchListJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const resp = await fetch(url, {
      credentials: "include",
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    });
    const finalUrl = String(resp.url || "");
    if (finalUrl.includes("/vdesk/hangup") || finalUrl.includes("/my.logout")) {
      await clearAnafWebserviceCookies();
      return { ok: false, needsTab: true };
    }
    const text = await resp.text();
    const trimmed = String(text || "").trim();
    if (resp.ok && trimmed.startsWith("{")) {
      try {
        return { ok: true, data: JSON.parse(trimmed) };
      } catch {
        return { ok: false, needsTab: true };
      }
    }
    return { ok: false, needsTab: true };
  } catch {
    return { ok: false, needsTab: true };
  } finally {
    clearTimeout(timer);
  }
}

async function downloadDocumentDirect(messageId) {
  const url = `https://webserviced.anaf.ro/SPVWS2/rest/descarcare?id=${encodeURIComponent(
    String(messageId)
  )}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(url, {
      credentials: "include",
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    });
    const finalUrl = String(resp.url || "");
    if (finalUrl.includes("/vdesk/hangup") || finalUrl.includes("/my.logout")) {
      await clearAnafWebserviceCookies();
      return { ok: false, needsTab: true };
    }

    const contentType = resp.headers.get("content-type") || "";
    const disp = resp.headers.get("content-disposition") || "";
    const fileName = parseContentDispositionFilename(disp);
    const buf = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf);

    if (!resp.ok || bytes.length === 0) {
      return {
        ok: false,
        needsTab: true,
        error: `ANAF a returnat HTTP ${resp.status} pentru documentul ${messageId}.`,
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
      return { ok: false, needsTab: true };
    }

    if (contentType.toLowerCase().includes("text/html") || firstNonWs === 60) {
      return { ok: false, needsTab: true };
    }

    return {
      ok: true,
      base64: arrayBufferToBase64(buf),
      contentType,
      fileName,
    };
  } catch {
    return { ok: false, needsTab: true };
  } finally {
    clearTimeout(timer);
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

      const preEl = document.querySelector("pre");
      if (preEl) {
        preEl.style.opacity = "0";
      }
      if (document.documentElement) {
        document.documentElement.style.backgroundColor = "#f8fafc";
      }

      const preText = preEl?.textContent || "";
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

async function waitForListJson(tabId, anafListUrl, appTabId, options = {}) {
  const deadline = Date.now() + 120000;
  let hangupRetries = 0;
  let nonJsonAttemptsAtListUrl = 0;
  let waitStartAt = Date.now();
  let focusedForAuth = false;
  const focusImmediately = Boolean(options?.focusImmediately);

  const restoreFocusIfNeeded = async () => {
    if (focusedForAuth && appTabId) {
      focusedForAuth = false;
      await chrome.tabs.update(appTabId, { active: true }).catch(() => {});
    }
  };

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
        waitStartAt = Date.now();
        await clearAnafWebserviceCookies();
        await chrome.tabs.update(tabId, { url: anafListUrl });
        await sleep(750);
        continue;
      }
      await restoreFocusIfNeeded();
      return {
        ok: false,
        error:
          "ANAF a inchis sesiunea de certificat (hangup). Verifica daca stick-ul USB este introdus si PIN-ul certificatului a fost introdus corect.",
      };
    }

    const waitingThresholdMs = focusImmediately ? 0 : 2500;
    if (
      !focusedForAuth &&
      (url.includes("/my.policy") ||
        (tab.status === "loading" && !url.includes("/SPVWS2/rest/listaMesaje"))) &&
      Date.now() - waitStartAt >= waitingThresholdMs
    ) {
      focusedForAuth = true;
      await chrome.tabs.update(tabId, { active: true }).catch(() => {});
    }

    if (tab.status === "complete" && url.includes("/my.policy")) {
      try {
        const policyCheck = await readListJsonFromTab(tabId);
        if (policyCheck?.isHangupPage) {
          if (hangupRetries < 2) {
            hangupRetries += 1;
            waitStartAt = Date.now();
            await clearAnafWebserviceCookies();
            await chrome.tabs.update(tabId, { url: anafListUrl });
            await sleep(750);
            continue;
          }
          await restoreFocusIfNeeded();
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

    if (url.startsWith("https://webserviced.anaf.ro/SPVWS2/rest/listaMesaje")) {
      await hideTabJsonContent(tabId);
      await restoreFocusIfNeeded();
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
          waitStartAt = Date.now();
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

    await sleep(400);
  }

  await restoreFocusIfNeeded();
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

  let workerTabId = null;

  const onTabUpdated = (updatedTabId, _changeInfo, tab) => {
    if (updatedTabId !== workerTabId) return;
    const u = String(tab?.url || "");
    if (u.startsWith("https://webserviced.anaf.ro/SPVWS2/")) {
      hideTabJsonContent(workerTabId);
    }
  };
  chrome.tabs.onUpdated.addListener(onTabUpdated);

  const ensureWorkerTab = async (urlToLoad) => {
    if (workerTabId) {
      if (urlToLoad) {
        await chrome.tabs.update(workerTabId, { url: urlToLoad });
      }
      return workerTabId;
    }
    const created = await chrome.tabs.create({
      url: urlToLoad || initialUrl,
      active: false,
    });
    if (!created?.id) {
      return null;
    }
    workerTabId = created.id;
    return workerTabId;
  };

  const restoreAppTab = async () => {
    if (appTabId) {
      await chrome.tabs.update(appTabId, { active: true }).catch(() => {});
    }
  };

  const fetchListPayload = async (urlToLoad) => {
    const directRes = await tryDirectFetchListJson(urlToLoad);
    if (directRes?.ok && directRes.data) {
      return { ok: true, data: directRes.data };
    }
    const tabId = await ensureWorkerTab(urlToLoad);
    if (!tabId) {
      return {
        ok: false,
        error: "Nu s-a putut deschide sesiunea in fundal pentru webserviced.anaf.ro.",
      };
    }
    return waitForListJson(tabId, urlToLoad, appTabId);
  };

  try {
    let listOutcome = await fetchListPayload(initialUrl);
    if (!listOutcome.ok) {
      await restoreAppTab();
      return listOutcome;
    }

    let listData = listOutcome.data;

    const getAllowedCifs = (data) =>
      Array.from(
        new Set(
          [data?.cnp, ...String(data?.cui || "").split(",")]
            .map(normalizeCif)
            .filter(Boolean)
        )
      );

    const resolveFallbackDays = async (initialData) => {
      let currentData = initialData;
      const fallbackDays = [59, 50];
      for (const candidateDays of fallbackDays) {
        if (
          currentData?.eroare &&
          String(currentData.eroare).toLowerCase().includes("zile") &&
          zileUsed > candidateDays
        ) {
          zileUsed = candidateDays;
          const retryUrl = `https://webserviced.anaf.ro/SPVWS2/rest/listaMesaje?zile=${zileUsed}`;
          const nextOutcome = await fetchListPayload(retryUrl);
          if (!nextOutcome.ok) {
            return { ok: false, outcome: nextOutcome };
          }
          currentData = nextOutcome.data;
        }
      }
      return { ok: true, data: currentData };
    };

    const resolvedInitial = await resolveFallbackDays(listData);
    if (!resolvedInitial.ok) {
      await restoreAppTab();
      return resolvedInitial.outcome;
    }
    listData = resolvedInitial.data;

    let allowedCifs = getAllowedCifs(listData);

    // Daca sesiunea F5 anterioara apartine altui stick USB, resetam sesiunea F5 si fortam re-autentificarea
    if (allowedCifs.length > 0 && !allowedCifs.includes(targetCif)) {
      await resetAnafCertSession();
      const freshUrl = `https://webserviced.anaf.ro/SPVWS2/rest/listaMesaje?zile=${zileUsed}`;
      const tabId = await ensureWorkerTab(freshUrl);
      if (tabId) {
        const freshOutcome = await waitForListJson(tabId, freshUrl, appTabId, {
          focusImmediately: true,
        });
        if (freshOutcome?.ok && freshOutcome.data) {
          const resolvedFresh = await resolveFallbackDays(freshOutcome.data);
          if (resolvedFresh.ok) {
            listData = resolvedFresh.data;
            allowedCifs = getAllowedCifs(listData);
          }
        }
      }
    }

    if (listData.eroare) {
      const errText = String(listData.eroare);
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
      return {
        ok: false,
        wrongCertificate: true,
        allowedCifs,
        certSerial: listData.serial ? String(listData.serial) : null,
        error: `Chrome pastreaza in memorie certificatul anterior (${allowedCifs.join(", ")}). Deschide chrome://restart in bara de adrese pentru a selecta noul stick USB (${targetCif}).`,
        diagnostics: {
          rawTotal: allMessages.length,
          matchedTotal: 0,
          allowedCifs,
          zileUsed,
        },
      };
    }

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

      let dl = await downloadDocumentDirect(m.id);
      if ((!dl?.ok || !dl?.base64) && dl?.needsTab) {
        let tabId = workerTabId;
        if (!tabId) {
          tabId = await ensureWorkerTab(initialUrl);
          if (tabId) {
            await waitForListJson(tabId, initialUrl, appTabId).catch(() => {});
          }
        }
        if (tabId) {
          dl = await downloadDocumentInTab(tabId, m.id);
        }
      }

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
    chrome.tabs.onUpdated.removeListener(onTabUpdated);
    if (workerTabId) {
      await chrome.tabs.remove(workerTabId).catch(() => {});
      await restoreAppTab();
    }
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
