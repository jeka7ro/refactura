/**
 * Sincronizează tokenul de sesiune (localStorage "authToken") într-un cookie,
 * astfel încât PDF-urile deschise direct din browser (href / iframe / window.open)
 * să fie autentificate de server. Se aplică automat la orice login / logout / schimbare
 * de firmă, fără a modifica locurile unde se setează tokenul.
 */
const KEY = "authToken";

function writeCookie(token: string | null) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  if (token) {
    document.cookie = `${KEY}=${encodeURIComponent(token)}; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Strict${secure}`;
  } else {
    document.cookie = `${KEY}=; Path=/; Max-Age=0; SameSite=Strict${secure}`;
  }
}

export function syncAuthCookie() {
  try {
    writeCookie(localStorage.getItem(KEY));
  } catch {
    /* localStorage indisponibil */
  }
}

let installed = false;
export function installAuthCookieSync() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const proto = Storage.prototype;
  const origSet = proto.setItem;
  const origRemove = proto.removeItem;
  const origClear = proto.clear;

  proto.setItem = function (key: string, value: string) {
    origSet.call(this, key, value);
    if (this === window.localStorage && key === KEY) writeCookie(value);
  };
  proto.removeItem = function (key: string) {
    origRemove.call(this, key);
    if (this === window.localStorage && key === KEY) writeCookie(null);
  };
  proto.clear = function () {
    origClear.call(this);
    if (this === window.localStorage) writeCookie(null);
  };

  // Alte tab-uri (login/logout/schimbare firmă) → sincronizăm cookie-ul și reîncărcăm pagina,
  // ca ecranul să afișeze mereu aceeași firmă pentru care pleacă cererile (fără amestec de date).
  window.addEventListener("storage", e => {
    if (e.key === null) {
      syncAuthCookie();
      return;
    }
    if (e.key === KEY) {
      syncAuthCookie();
      if (e.oldValue !== e.newValue) window.location.reload();
    }
  });

  syncAuthCookie();
}
