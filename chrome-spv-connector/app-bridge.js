(() => {
  const EXTENSION_VERSION = "1.4.0";
  const APP_SOURCE = "smart-invoice-app";
  const EXT_SOURCE = "smart-invoice-extension";

  if (typeof window.__spvConnectorCleanup === "function") {
    try {
      window.__spvConnectorCleanup();
    } catch {
      /* ignore cleanup error */
    }
  }

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

  const onRuntimeMessage = (message, _sender, sendResponse) => {
    if (!chrome?.runtime?.id) return false;
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
        window.location.origin
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
        window.location.origin
      );
      return true;
    }

    return false;
  };

  const onWindowMessage = async (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    if (!chrome?.runtime?.id) {
      try {
        window.__spvConnectorCleanup?.();
      } catch {
        /* ignore */
      }
      return;
    }

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
        window.location.origin
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
          window.location.origin
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
          window.location.origin
        );
      }
    }
  };

  chrome.runtime.onMessage.addListener(onRuntimeMessage);
  window.addEventListener("message", onWindowMessage);

  window.__spvConnectorCleanup = () => {
    window.removeEventListener("message", onWindowMessage);
    try {
      chrome.runtime.onMessage.removeListener(onRuntimeMessage);
    } catch {
      /* extension context already gone */
    }
  };
})();
