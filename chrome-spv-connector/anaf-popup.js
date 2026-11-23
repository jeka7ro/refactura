(() => {
  const isPopup =
    Boolean(window.toolbar && window.toolbar.visible === false) ||
    window.outerWidth <= 720;

  if (!isPopup) return;

  document.documentElement.setAttribute("data-spv-popup", "1");

  let latestProgressText = "";

  const getDefaultStatus = () => {
    const path = String(window.location?.pathname || "");
    if (path.includes("/SPVWS2/")) {
      return "Se citesc documentele oficiale din SPV ANAF...";
    }
    return "Selectează certificatul digital USB și confirmă codul PIN.";
  };

  const mountOverlay = () => {
    if (!document.body) return false;
    if (document.getElementById("spv-connector-overlay")) return true;

    const overlay = document.createElement("div");
    overlay.id = "spv-connector-overlay";

    const card = document.createElement("div");
    card.id = "spv-connector-card";

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

    const title = document.createElement("h1");
    title.id = "spv-connector-title";
    title.textContent = "Conectare Stick USB — ANAF SPV";

    const status = document.createElement("p");
    status.id = "spv-popup-status";
    status.textContent = latestProgressText || getDefaultStatus();

    const spinnerRow = document.createElement("div");
    spinnerRow.id = "spv-connector-spinner-row";

    const spinner = document.createElement("span");
    spinner.id = "spv-connector-spinner";

    const spinnerText = document.createElement("span");
    spinnerText.textContent = "Conexiune securizată ANAF";

    spinnerRow.appendChild(spinner);
    spinnerRow.appendChild(spinnerText);

    const note = document.createElement("p");
    note.id = "spv-connector-note";
    note.textContent = "Fereastra se va închide automat la finalizare.";

    card.appendChild(badge);
    card.appendChild(title);
    card.appendChild(status);
    card.appendChild(spinnerRow);
    card.appendChild(note);
    overlay.appendChild(card);

    document.body.appendChild(overlay);
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
      if (message?.type === "SPV_POPUP_PROGRESS" && message.text) {
        latestProgressText = String(message.text);
        const statusEl = document.getElementById("spv-popup-status");
        if (statusEl) {
          statusEl.textContent = latestProgressText;
        }
      }
      return false;
    });
  } catch {
    /* ignore */
  }
})();
