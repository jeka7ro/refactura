(() => {
  const EXTENSION_VERSION = "1.2.0";
  const APP_SOURCE = "smart-invoice-app";
  const EXT_SOURCE = "smart-invoice-extension";

  try {
    document.documentElement.dataset.spvConnectorInstalled = EXTENSION_VERSION;
    window.dispatchEvent(
      new CustomEvent("spv-connector-ready", {
        detail: { version: EXTENSION_VERSION },
      })
    );
  } catch {
    /* ignore */
  }

  const pendingDocAcks = new Map();

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || !message.requestId) return false;

    if (message.type === "SPV_CONNECTOR_PROGRESS") {
      window.postMessage(
        {
          source: EXT_SOURCE,
          type: "SPV_CONNECTOR_PROGRESS",
          requestId: message.requestId,
          current: message.current,
          total: message.total,
          tip: message.tip,
        },
        "*"
      );
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === "SPV_CONNECTOR_DOCUMENT") {
      const ackKey = `${message.requestId}:${message.item?.anafId || ""}`;
      const timer = setTimeout(() => {
        if (pendingDocAcks.has(ackKey)) {
          pendingDocAcks.delete(ackKey);
          sendResponse({
            ok: false,
            error: "Timeout la salvarea documentului in aplicatie.",
          });
        }
      }, 30000);

      pendingDocAcks.set(ackKey, {
        resolve: (payload) => {
          clearTimeout(timer);
          pendingDocAcks.delete(ackKey);
          sendResponse(payload || { ok: true });
        },
      });

      window.postMessage(
        {
          source: EXT_SOURCE,
          type: "SPV_CONNECTOR_DOCUMENT",
          requestId: message.requestId,
          item: message.item,
        },
        "*"
      );
      return true;
    }

    return false;
  });

  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== APP_SOURCE) return;

    if (data.type === "SPV_CONNECTOR_PING") {
      document.documentElement.dataset.spvConnectorInstalled = EXTENSION_VERSION;
      window.postMessage(
        {
          source: EXT_SOURCE,
          type: "SPV_CONNECTOR_PONG",
          version: EXTENSION_VERSION,
          requestId: data.requestId || null,
        },
        "*"
      );
      return;
    }

    if (data.type === "SPV_CONNECTOR_DOCUMENT_ACK") {
      const ackKey = `${data.requestId}:${data.anafId || ""}`;
      const waiter = pendingDocAcks.get(ackKey);
      if (waiter) {
        waiter.resolve({
          ok: Boolean(data.ok),
          skippedDuplicate: Boolean(data.skippedDuplicate),
          error: data.error || null,
        });
      }
      return;
    }

    if (data.type === "SPV_CONNECTOR_SYNC") {
      try {
        const result = await chrome.runtime.sendMessage({
          action: "SYNC_SPVWS2",
          requestId: data.requestId,
          cif: data.cif,
          zile: data.zile,
          existingIds: Array.isArray(data.existingIds) ? data.existingIds : [],
        });
        window.postMessage(
          {
            source: EXT_SOURCE,
            type: "SPV_CONNECTOR_DONE",
            requestId: data.requestId,
            ...(result || { ok: false, error: "Raspuns gol de la extensie." }),
          },
          "*"
        );
      } catch (err) {
        window.postMessage(
          {
            source: EXT_SOURCE,
            type: "SPV_CONNECTOR_DONE",
            requestId: data.requestId,
            ok: false,
            error:
              err && err.message
                ? err.message
                : "Comunicarea cu extensia SPV a esuat. Reincarcati extensia din chrome://extensions.",
          },
          "*"
        );
      }
    }
  });
})();
