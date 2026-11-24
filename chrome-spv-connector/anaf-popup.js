(() => {
  const isPopup =
    Boolean(window.toolbar && window.toolbar.visible === false) ||
    window.outerWidth <= 720;

  if (!isPopup) return;

  document.documentElement.setAttribute("data-spv-popup", "1");

  let latestProgressText = "";
  let latestPercent = null;

  const getDefaultStatus = () => {
    const path = String(window.location?.pathname || "");
    if (path.includes("/SPVWS2/")) {
      return "Se citesc documentele oficiale din SPV ANAF...";
    }
    return "Selectează certificatul digital USB și confirmă codul PIN.";
  };

  const applyBarState = () => {
    const barEl = document.getElementById("spv-connector-bar");
    if (!barEl) return;
    if (typeof latestPercent === "number" && latestPercent >= 0) {
      barEl.removeAttribute("data-indeterminate");
      barEl.style.width = `${Math.max(8, Math.min(100, latestPercent))}%`;
    } else {
      barEl.setAttribute("data-indeterminate", "1");
      barEl.style.width = "38%";
    }
  };

  const mountOverlay = () => {
    if (!document.body) return false;
    if (document.getElementById("spv-connector-overlay")) return true;

    const overlay = document.createElement("div");
    overlay.id = "spv-connector-overlay";

    const card = document.createElement("div");
    card.id = "spv-connector-card";

    const header = document.createElement("div");
    header.id = "spv-connector-header";

    const badge = document.createElement("div");
    badge.id = "spv-connector-badge";
    const logoImg = document.createElement("img");
    logoImg.src = "https://static.anaf.ro/static/10/Anaf/primapagina/anaf_ro.png";
    logoImg.alt = "ANAF";
    logoImg.onerror = () => {
      try {
        logoImg.onerror = null;
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) {
          logoImg.src = chrome.runtime.getURL("anaf-logo.png");
        }
      } catch {
        /* ignore */
      }
    };
    badge.appendChild(logoImg);

    const spinnerRow = document.createElement("div");
    spinnerRow.id = "spv-connector-spinner-row";

    const spinner = document.createElement("span");
    spinner.id = "spv-connector-spinner";

    const spinnerText = document.createElement("span");
    spinnerText.textContent = "mTLS Securizat";

    spinnerRow.appendChild(spinner);
    spinnerRow.appendChild(spinnerText);

    header.appendChild(badge);
    header.appendChild(spinnerRow);

    const title = document.createElement("h1");
    title.id = "spv-connector-title";
    title.textContent = "Sincronizare Stick USB";

    const status = document.createElement("p");
    status.id = "spv-popup-status";
    status.textContent = latestProgressText || getDefaultStatus();

    const track = document.createElement("div");
    track.id = "spv-connector-track";
    const bar = document.createElement("div");
    bar.id = "spv-connector-bar";
    bar.setAttribute("data-indeterminate", "1");
    track.appendChild(bar);

    const note = document.createElement("p");
    note.id = "spv-connector-note";
    note.textContent = "Se închide automat la finalizare";

    card.appendChild(header);
    card.appendChild(title);
    card.appendChild(status);
    card.appendChild(track);
    card.appendChild(note);
    overlay.appendChild(card);

    document.body.appendChild(overlay);
    applyBarState();
    return true;
  };

  if (!mountOverlay()) {
    const observer = new MutationObserver(() => {
      if (mountOverlay()) {
        observer.disconnect();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener("DOMContentLoaded", () => {
      mountOverlay();
    });
  }

  try {
    chrome.runtime.onMessage.addListener((message) => {
      if (message?.type === "SPV_POPUP_PROGRESS") {
        if (message.text) {
          latestProgressText = String(message.text);
          const statusEl = document.getElementById("spv-popup-status");
          if (statusEl) {
            statusEl.textContent = latestProgressText;
          }
        }
        if (
          typeof message.current === "number" &&
          typeof message.total === "number" &&
          message.total > 0
        ) {
          latestPercent = Math.round((message.current / message.total) * 100);
          applyBarState();
        }
      }
      return false;
    });
  } catch {
    /* ignore */
  }
})();
