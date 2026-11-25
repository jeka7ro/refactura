const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const E_FACTURA_TIPS = new Set([
  "FACTURA PRIMITA",
  "FACTURA TRIMISA",
  "ERORI FACTURA",
]);

const APP_TAB_PATTERNS = [
  "http://localhost:3000/*",
  "http://127.0.0.1:3000/*",
  "https://refactura.up.railway.app/*",
];

const ALLOWED_APP_ORIGINS = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://refactura.up.railway.app",
]);

function isTrustedAppSender(sender) {
  if (!sender || sender.id !== chrome.runtime.id) return false;
  const tabUrl = String(sender?.tab?.url || "");
  if (!tabUrl) return false;
  try {
    const parsed = new URL(tabUrl);
    return ALLOWED_APP_ORIGINS.has(parsed.origin);
  } catch {
    return false;
  }
}

let lastAuthenticatedCifs = [];

async function getStoredLastCifs() {
  try {
    if (chrome.storage?.session) {
      const res = await chrome.storage.session.get("lastAuthenticatedCifs");
      if (Array.isArray(res?.lastAuthenticatedCifs)) {
        lastAuthenticatedCifs = res.lastAuthenticatedCifs;
        return lastAuthenticatedCifs;
      }
    }
  } catch {
    /* fallback to in-memory */
  }
  return lastAuthenticatedCifs;
}

async function setStoredLastCifs(cifs) {
  const clean = Array.isArray(cifs) ? cifs : [];
  lastAuthenticatedCifs = clean;
  try {
    if (chrome.storage?.session) {
      await chrome.storage.session.set({ lastAuthenticatedCifs: clean });
    }
  } catch {
    /* ignore */
  }
}

function escapeRegExp(str) {
  return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeCif(value) {
  return String(value || "")
    .replace(/^RO/i, "")
    .trim();
}

async function reinjectAppBridgeTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: APP_TAB_PATTERNS });
    for (const tab of tabs) {
      if (!tab?.id) continue;
      await chrome.scripting
        .executeScript({
          target: { tabId: tab.id },
          files: ["app-bridge.js"],
        })
        .catch(() => { });
    }
  } catch {
    /* ignore */
  }
}

chrome.runtime.onInstalled.addListener(() => {
  reinjectAppBridgeTabs();
});

async function clearAnafWebserviceCookies(targetStoreId = null) {
  try {
    const seen = new Set();
    const storeOpt = targetStoreId ? { storeId: targetStoreId } : {};
    const lists = await Promise.all([
      chrome.cookies
        .getAll({ url: "https://webserviced.anaf.ro/", ...storeOpt })
        .catch(() => []),
      chrome.cookies
        .getAll({ domain: "webserviced.anaf.ro", ...storeOpt })
        .catch(() => []),
      chrome.cookies.getAll({ domain: "anaf.ro", ...storeOpt }).catch(() => []),
    ]);
    for (const group of lists) {
      for (const c of group) {
        const host = String(c.domain || "webserviced.anaf.ro").replace(/^\./, "");
        const cookieUrl = `https://${host}${c.path || "/"}`;
        const isF5Cookie =
          host.includes("webserviced.anaf.ro") ||
          /^(MRHSession|LastMRH_Session|F5_ST|TIN|Session_)/i.test(
            String(c.name || "")
          );
        if (!isF5Cookie) continue;
        const effectiveStoreId = c.storeId || targetStoreId || "";
        const key = `${cookieUrl}|${c.name}|${effectiveStoreId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const removeDetails = { url: cookieUrl, name: c.name };
        if (effectiveStoreId) removeDetails.storeId = effectiveStoreId;
        await chrome.cookies.remove(removeDetails).catch(() => { });
      }
    }
  } catch {
    /* ignore */
  }
}

async function purgeNormalAnafBrowsingData() {
  try {
    await chrome.browsingData.remove(
      {
        origins: [
          "https://webserviced.anaf.ro",
          "https://www.anaf.ro",
          "https://anaf.ro",
          "https://logincert.anaf.ro",
        ],
      },
      {
        cookies: true,
        cache: true,
        cacheStorage: true,
      }
    );
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
      const bodyText = Array.from(document.body?.children || [])
        .filter((el) => el.id !== "spv-connector-overlay")
        .map((el) => el.innerText || el.textContent || "")
        .join("\n");

      const lowerBody = bodyText.toLowerCase();
      if (
        lowerBody.includes("session could not be established") ||
        lowerBody.includes("access was denied by the access policy") ||
        lowerBody.includes("certificatul nu a fost prezentat")
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

async function waitForListJson(tabId, anafListUrl, popupStoreId = null) {
  const deadline = Date.now() + 90000;
  let hangupRetries = 0;
  let nonJsonAttemptsAtListUrl = 0;

  while (Date.now() < deadline) {
    let tab;
    try {
      tab = await chrome.tabs.get(tabId);
    } catch {
      return {
        ok: false,
        popupClosedByUser: true,
        error:
          "Fereastra de autentificare ANAF a fost inchisa inainte de finalizarea citirii stick-ului USB.",
      };
    }

    const url = String(tab.url || "");
    if (url.includes("/vdesk/hangup") || url.includes("/my.logout")) {
      if (hangupRetries < 2) {
        hangupRetries += 1;
        await clearAnafWebserviceCookies(tab.cookieStoreId || popupStoreId);
        await chrome.tabs.update(tabId, { url: anafListUrl }).catch(() => { });
        await sleep(750);
        continue;
      }
      return {
        ok: false,
        needsIncognitoHint: true,
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
            await clearAnafWebserviceCookies(tab.cookieStoreId || popupStoreId);
            await chrome.tabs.update(tabId, { url: anafListUrl }).catch(() => { });
            await sleep(750);
            continue;
          }
          return {
            ok: false,
            needsIncognitoHint: true,
            error:
              "ANAF a respins sesiunea F5 APM. Verifica stick-ul USB si PIN-ul si reincerca.",
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
          await clearAnafWebserviceCookies(tab.cookieStoreId || popupStoreId);
          await chrome.tabs.update(tabId, { url: anafListUrl }).catch(() => { });
          await sleep(750);
          continue;
        }
        return {
          ok: false,
          needsIncognitoHint: true,
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

  return {
    ok: false,
    error:
      "Timpul de asteptare (90s) pentru selectarea certificatului USB si introducerea PIN-ului a expirat.",
  };
}

async function handleSpvSync(msg, appTabId, appWindowId) {
  const incognitoAllowed = await chrome.extension
    .isAllowedIncognitoAccess()
    .catch(() => false);
  let usedIncognito = false;

  const finalizeResult = (res) => {
    const out = {
      ...(res || { ok: false }),
      diagnostics: {
        ...(res?.diagnostics || {}),
        incognitoPopup: usedIncognito,
        incognitoAllowed,
      },
    };
    delete out.needsIncognitoHint;
    delete out.popupClosedByUser;
    return out;
  };

  const targetCif = normalizeCif(msg.cif);
  if (!targetCif) {
    return finalizeResult({
      ok: false,
      error: "Profilul activ nu are CUI / CNP configurat in Setari.",
    });
  }

  let zileUsed = Math.min(60, Math.max(1, Number(msg.zile) || 60));
  const initialUrl = `https://webserviced.anaf.ro/SPVWS2/rest/listaMesaje?zile=${zileUsed}`;
  const existingSet = new Set((msg.existingIds || []).map(String));

  const prevCifs = await getStoredLastCifs();
  if (!incognitoAllowed) {
    await purgeNormalAnafBrowsingData();
    await clearAnafWebserviceCookies();
  } else if (
    prevCifs.length > 0 &&
    !prevCifs.includes(targetCif)
  ) {
    await clearAnafWebserviceCookies();
  }

  const popupWidth = 380;
  const popupHeight = 276;
  let left = 300;
  let top = 140;

  if (appWindowId) {
    try {
      const parentWin = await chrome.windows.get(appWindowId);
      if (
        typeof parentWin.left === "number" &&
        typeof parentWin.top === "number" &&
        typeof parentWin.width === "number" &&
        typeof parentWin.height === "number"
      ) {
        left = Math.max(40, Math.round(parentWin.left + (parentWin.width - popupWidth) / 2));
        top = Math.max(40, Math.round(parentWin.top + (parentWin.height - popupHeight) / 2));
      }
    } catch {
      /* keep safe fallback coordinates */
    }
  }

  let popupWindowId = null;
  let workerTabId = null;
  let popupStoreId = null;

  const ensurePopupWorker = async (urlToLoad) => {
    if (popupWindowId && workerTabId) {
      await chrome.tabs.update(workerTabId, { url: urlToLoad }).catch(() => { });
      await chrome.windows.update(popupWindowId, { focused: true }).catch(() => { });
      return workerTabId;
    }

    let popupWin = null;
    if (incognitoAllowed) {
      try {
        popupWin = await chrome.windows.create({
          url: "about:blank",
          type: "popup",
          incognito: true,
          width: popupWidth,
          height: popupHeight,
          left,
          top,
          focused: true,
        });
        usedIncognito = true;
      } catch {
        popupWin = null;
        usedIncognito = false;
      }
    }

    if (!popupWin) {
      popupWin = await chrome.windows.create({
        url: chrome.runtime.getURL("auth.html"),
        type: "popup",
        width: popupWidth,
        height: popupHeight,
        left,
        top,
        focused: true,
      });
      usedIncognito = false;
    }

    popupWindowId = popupWin?.id || null;
    let workerTab = popupWin?.tabs?.[0] || null;
    workerTabId = workerTab?.id || null;
    if (!workerTabId && popupWindowId) {
      const qTabs = await chrome.tabs
        .query({ windowId: popupWindowId })
        .catch(() => []);
      workerTab = qTabs?.[0] || null;
      workerTabId = workerTab?.id || null;
    }

    if (!popupWindowId || !workerTabId) {
      return null;
    }

    popupStoreId = workerTab?.cookieStoreId || null;
    if (popupStoreId) {
      await clearAnafWebserviceCookies(popupStoreId);
    }

    await sleep(220);
    await chrome.tabs.update(workerTabId, { url: urlToLoad || initialUrl });
    return workerTabId;
  };

  try {
    const tabId = await ensurePopupWorker(initialUrl);
    if (!tabId) {
      return finalizeResult({
        ok: false,
        error: "Nu s-a putut deschide fereastra popup pentru webserviced.anaf.ro.",
      });
    }

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
          await ensurePopupWorker(retryUrl);
          const nextOutcome = await waitForListJson(
            workerTabId,
            retryUrl,
            popupStoreId
          );
          if (!nextOutcome.ok) {
            return { ok: false, outcome: nextOutcome };
          }
          currentData = nextOutcome.data;
        }
      }
      return { ok: true, data: currentData };
    };

    let listOutcome = await waitForListJson(tabId, initialUrl, popupStoreId);
    if (!listOutcome.ok) {
      return finalizeResult(listOutcome);
    }

    const resolvedInitial = await resolveFallbackDays(listOutcome.data);
    if (!resolvedInitial.ok) {
      return finalizeResult(resolvedInitial.outcome);
    }

    let listData = resolvedInitial.data;
    let allowedCifs = getAllowedCifs(listData);

    // Daca sesiunea F5 anterioara apartine altui stick USB, fortam logout F5 + cookie clear in popup si reincercam
    if (allowedCifs.length > 0 && !allowedCifs.includes(targetCif)) {
      await clearAnafWebserviceCookies(popupStoreId);
      await ensurePopupWorker("https://webserviced.anaf.ro/vdesk/hangup.php3");
      await sleep(900);
      await clearAnafWebserviceCookies(popupStoreId);

      const freshUrl = `https://webserviced.anaf.ro/SPVWS2/rest/listaMesaje?zile=${zileUsed}`;
      await ensurePopupWorker(freshUrl);
      const freshOutcome = await waitForListJson(
        workerTabId,
        freshUrl,
        popupStoreId
      );
      if (!freshOutcome.ok) {
        return finalizeResult(freshOutcome);
      }
      const resolvedFresh = await resolveFallbackDays(freshOutcome.data);
      if (!resolvedFresh.ok) {
        return finalizeResult(resolvedFresh.outcome);
      }
      listData = resolvedFresh.data;
      allowedCifs = getAllowedCifs(listData);
    }

    if (listData.eroare) {
      const errText = String(listData.eroare);
      if (allowedCifs.includes(targetCif)) {
        await setStoredLastCifs(allowedCifs);
      }
      if (errText.toLowerCase().includes("nu exista mesaje")) {
        return finalizeResult({
          ok: true,
          emptyNotice: errText,
          matchedTotal: 0,
          downloaded: 0,
          alreadySaved: 0,
          failed: 0,
          certCui: allowedCifs.includes(targetCif) ? targetCif : null,
          certSerial: listData.serial ? String(listData.serial) : null,
          diagnostics: {
            rawTotal: 0,
            matchedTotal: 0,
            zileUsed,
          },
        });
      }
      return finalizeResult({
        ok: false,
        error: errText,
        diagnostics: {
          rawTotal: 0,
          matchedTotal: 0,
          zileUsed,
        },
      });
    }

    const allMessages = Array.isArray(listData.mesaje) ? listData.mesaje : [];
    const targetCifBoundaryRe = new RegExp(
      `(?:^|\\D)(?:RO)?${escapeRegExp(targetCif)}(?:$|\\D)`,
      "i"
    );
    const matched = allMessages.filter((m) => {
      const msgCif = normalizeCif(m?.cif || m?.cnp || m?.cui);
      const detaliiText = String(m?.detalii || "");
      const tipUpper = String(m?.tip || "")
        .toUpperCase()
        .trim();
      const matchesTarget =
        msgCif === targetCif || (!msgCif && targetCifBoundaryRe.test(detaliiText));
      return matchesTarget && !E_FACTURA_TIPS.has(tipUpper);
    });

    if (
      matched.length === 0 &&
      allowedCifs.length > 0 &&
      !allowedCifs.includes(targetCif)
    ) {
      return finalizeResult({
        ok: false,
        wrongCertificate: true,
        certSerial: listData.serial ? String(listData.serial) : null,
        error: `Certificatul USB selectat în Chrome nu este înrolat în SPV pentru CUI/CNP ${targetCif}. Deschide o filă nouă și scrie chrome://restart pentru a selecta stick-ul USB corespunzător firmei curente (${targetCif}).`,
        diagnostics: {
          rawTotal: allMessages.length,
          matchedTotal: 0,
          zileUsed,
        },
      });
    }

    if (allowedCifs.includes(targetCif) || matched.length > 0) {
      await setStoredLastCifs(allowedCifs);
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
      const progressText = `Se descarcă documentul ${i + 1} din ${toDownload.length}...`;

      if (workerTabId) {
        await chrome.tabs
          .sendMessage(workerTabId, {
            type: "SPV_POPUP_PROGRESS",
            text: progressText,
            current: i + 1,
            total: toDownload.length,
          })
          .catch(() => { });
      }

      if (appTabId) {
        await chrome.tabs
          .sendMessage(appTabId, {
            type: "SPV_CONNECTOR_PROGRESS",
            requestId: msg.requestId,
            current: i + 1,
            total: toDownload.length,
            tip: String(m.tip || "DOCUMENT"),
          })
          .catch(() => { });
      }

      const dl = await downloadDocumentInTab(workerTabId, m.id);
      if (!dl?.ok || !dl?.base64) {
        failed += 1;
        lastError = dl?.error || `Eroare la descarcarea mesajului ${m.id}.`;
        continue;
      }

      if (appTabId) {
        const actualMsgCif = normalizeCif(m?.cif || m?.cnp || m?.cui) || targetCif;
        const ack = await chrome.tabs
          .sendMessage(appTabId, {
            type: "SPV_CONNECTOR_DOCUMENT",
            requestId: msg.requestId,
            item: {
              anafId: String(m.id),
              cif: actualMsgCif,
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

    return finalizeResult({
      ok: true,
      matchedTotal: matched.length,
      downloaded,
      alreadySaved,
      failed,
      lastError,
      certCui: allowedCifs.includes(targetCif) ? targetCif : null,
      certSerial: listData.serial ? String(listData.serial) : null,
      diagnostics: {
        rawTotal: allMessages.length,
        matchedTotal: matched.length,
        zileUsed,
      },
    });
  } finally {
    if (popupWindowId) {
      await chrome.windows.remove(popupWindowId).catch(() => { });
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isTrustedAppSender(sender)) return false;
  if (message && message.action === "RELOAD_EXTENSION") {
    sendResponse({ ok: true });
    setTimeout(() => chrome.runtime.reload(), 80);
    return false;
  }
  if (!message || message.action !== "SYNC_SPVWS2") return false;

  (async () => {
    try {
      const result = await handleSpvSync(
        message,
        sender?.tab?.id || null,
        sender?.tab?.windowId || null
      );
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
