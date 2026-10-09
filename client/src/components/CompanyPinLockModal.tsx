import { useState, useRef, useEffect } from "react";
import {
  Lock,
  ShieldCheck,
  LogOut,
  Loader2,
  AlertCircle,
  HelpCircle,
  ArrowLeft,
  Mail,
  Phone,
  User,
  Briefcase,
  FileText,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface CompanyPinLockModalProps {
  companyName?: string;
  companyLogo?: string;
  logoBgColor?: string;
  logoHasBackground?: boolean;
  themeColor?: string;
  userFullName?: string;
  userPhone?: string;
  userRole?: string;
  defaultExplanation?: string;
  tenantId?: number;
  onUnlocked: () => void;
}

function formatRoTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function formatRoDate(d: Date): string {
  const days = [
    "DUMINICĂ",
    "LUNI",
    "MARȚI",
    "MIERCURI",
    "JOI",
    "VINERI",
    "SÂMBĂTĂ",
  ];
  const months = [
    "IANUARIE",
    "FEBRUARIE",
    "MARTIE",
    "APRILIE",
    "MAI",
    "IUNIE",
    "IULIE",
    "AUGUST",
    "SEPTEMBRIE",
    "OCTOMBRIE",
    "NOIEMBRIE",
    "DECEMBRIE",
  ];
  const dayName = days[d.getDay()];
  const dayNum = d.getDate();
  const monthName = months[d.getMonth()];
  const year = d.getFullYear();
  return `${dayName}, ${dayNum} ${monthName} ${year}`;
}

function cleanErrorMessage(err: any, fallback: string = "A apărut o eroare."): string {
  if (!err) return fallback;
  const raw = err.message || (typeof err === "string" ? err : "");
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const messages = parsed.map((p: any) => p.message).filter(Boolean);
      if (messages.length > 0) return messages.join(". ");
    }
  } catch {}
  return raw;
}

export function CompanyPinLockModal({
  companyName = "Companie",
  companyLogo,
  logoBgColor,
  logoHasBackground,
  themeColor = "#2563eb",
  userFullName = "",
  userPhone = "",
  userRole = "",
  defaultExplanation = "",
  tenantId,
  onUnlocked,
}: CompanyPinLockModalProps) {
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [logoFailed, setLogoFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Stare formular reset / contact administrator cu completare automată
  const [showResetForm, setShowResetForm] = useState(false);
  const [fullName, setFullName] = useState(userFullName);
  const [phone, setPhone] = useState(userPhone);
  const [role, setRole] = useState(userRole || "Administrator");
  const [explanation, setExplanation] = useState(
    defaultExplanation || `Solicit resetarea codului PIN de acces pentru firma ${companyName}.`
  );
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);

  // Când sosesc datele din tenant/user, completăm automat dacă formularul nu a fost modificat
  useEffect(() => {
    if (userFullName) setFullName(prev => (prev ? prev : userFullName));
    if (userPhone) setPhone(prev => (prev ? prev : userPhone));
    if (userRole) setRole(prev => (prev ? prev : userRole));
    if (defaultExplanation) setExplanation(prev => (prev ? prev : defaultExplanation));
  }, [userFullName, userPhone, userRole, defaultExplanation]);

  const verifyPinMutation = trpc.tenants.verifyPin.useMutation();
  const requestResetMutation = trpc.tenants.requestPinReset.useMutation();

  useEffect(() => {
    if (!showResetForm) {
      inputRef.current?.focus();
    }
  }, [showResetForm]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setErrorMsg("Introduceți codul PIN.");
      return;
    }
    setErrorMsg("");

    try {
      await verifyPinMutation.mutateAsync({ pin: pin.trim() });
      const storageKey = `smart_invoice_unlocked_pin_${tenantId || "default"}`;
      sessionStorage.setItem(storageKey, "true");
      toast.success("Acces deblocat cu succes.");
      onUnlocked();
    } catch (err: any) {
      setErrorMsg(cleanErrorMessage(err, "Cod PIN incorect."));
      setPin("");
      inputRef.current?.focus();
    }
  };

  const handleSendResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");

    if (!fullName.trim() || !phone.trim() || !role.trim() || !explanation.trim()) {
      setResetError("Toate câmpurile sunt obligatorii.");
      return;
    }

    try {
      await requestResetMutation.mutateAsync({
        fullName: fullName.trim(),
        phone: phone.trim(),
        role: role.trim(),
        explanation: explanation.trim(),
      });
      setResetSuccess(true);
      toast.success("Solicitarea a fost trimisă către administrator.");
    } catch (err: any) {
      setResetError(cleanErrorMessage(err, "Eroare la trimiterea solicitării."));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    sessionStorage.clear();
    window.location.href = "/login";
  };

  const effectiveThemeColor = themeColor || "#2563eb";

  return (
    <div
      className="fixed inset-0 z-[9999] backdrop-blur-md flex flex-col items-center justify-center p-4 transition-colors duration-300 overflow-y-auto"
      style={{
        backgroundColor: "rgba(15, 23, 42, 0.88)",
        backgroundImage: `radial-gradient(circle at 50% 35%, ${effectiveThemeColor}40 0%, ${effectiveThemeColor}15 50%, rgba(15, 23, 42, 0.95) 100%)`,
      }}
    >
      {/* Ceas digital live mare cu font alb */}
      <div className="mb-6 sm:mb-8 w-full max-w-md text-center select-none animate-in fade-in slide-in-from-top-4 duration-300">
        <div
          className="w-full py-6 px-4 sm:py-8 sm:px-6 rounded-3xl bg-slate-950/80 dark:bg-black/90 backdrop-blur-2xl border shadow-2xl flex flex-col items-center justify-center"
          style={{
            borderColor: `${effectiveThemeColor}50`,
            boxShadow: `0 20px 50px -10px ${effectiveThemeColor}45`,
          }}
        >
          <div className="text-6xl sm:text-7xl font-black tracking-tight font-mono leading-none text-white drop-shadow-lg">
            {formatRoTime(currentTime)}
          </div>
          <div className="text-xs sm:text-sm font-bold tracking-[0.25em] uppercase text-white/90 mt-3 drop-shadow-xs">
            {formatRoDate(currentTime)}
          </div>
        </div>
      </div>

      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200"
        style={{
          boxShadow: `0 20px 45px -15px ${effectiveThemeColor}33`,
        }}
      >
        {!showResetForm ? (
          <>
            {/* View PIN Lock */}
            <div className="flex flex-col items-center text-center space-y-3">
              {companyLogo && !logoFailed ? (
                <div className="relative">
                  <div
                    className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1.5 flex items-center justify-center shadow-md overflow-hidden"
                    style={
                      logoHasBackground && logoBgColor ? { backgroundColor: logoBgColor } : undefined
                    }
                  >
                    <img
                      src={companyLogo}
                      alt={companyName}
                      className="w-full h-full object-contain rounded-xl"
                      onError={() => setLogoFailed(true)}
                    />
                  </div>
                  <div
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full text-white flex items-center justify-center shadow-sm border-2 border-white dark:border-slate-900"
                    style={{ backgroundColor: effectiveThemeColor }}
                  >
                    <Lock className="w-3 h-3" />
                  </div>
                </div>
              ) : (
                <div
                  className="w-14 h-14 rounded-2xl border flex items-center justify-center shadow-xs"
                  style={{
                    backgroundColor: `${effectiveThemeColor}15`,
                    borderColor: `${effectiveThemeColor}30`,
                    color: effectiveThemeColor,
                  }}
                >
                  <Lock className="w-7 h-7" />
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Securitate Firmă
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                  Pentru a accesa datele firmei{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {companyName}
                  </span>
                  , introduceți codul PIN de securitate.
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleUnlock} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 text-center">
                  Cod PIN de acces
                </label>
                <input
                  ref={inputRef}
                  type="password"
                  inputMode="numeric"
                  maxLength={10}
                  value={pin}
                  onChange={e => {
                    setPin(e.target.value);
                    if (errorMsg) setErrorMsg("");
                  }}
                  placeholder="••••"
                  className="w-full h-12 text-center text-2xl tracking-[0.4em] font-mono font-bold bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={verifyPinMutation.isPending || !pin.trim()}
                style={{ backgroundColor: effectiveThemeColor }}
                className="w-full h-11 rounded-xl hover:opacity-90 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
              >
                {verifyPinMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                Deblochează accesul
              </button>
            </form>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  setShowResetForm(true);
                  setResetError("");
                  setResetSuccess(false);
                }}
                className="inline-flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Contactează administratorul
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Deconectare
              </button>
            </div>
          </>
        ) : (
          <>
            {/* View Solicitare Reset / Contact Administrator */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <button
                  type="button"
                  onClick={() => setShowResetForm(false)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Înapoi la PIN
                </button>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Asistență PIN
                </span>
              </div>

              <div className="text-center space-y-1.5">
                <div
                  className="w-12 h-12 mx-auto rounded-2xl border flex items-center justify-center shadow-xs"
                  style={{
                    backgroundColor: `${effectiveThemeColor}15`,
                    borderColor: `${effectiveThemeColor}30`,
                    color: effectiveThemeColor,
                  }}
                >
                  <Mail className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Contactează Administratorul
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                  Trimiteți o solicitare de resetare a codului PIN pentru firma{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {companyName}
                  </span>
                  . Mesajul va ajunge direct la <span className="font-semibold text-blue-600 dark:text-blue-400">contact@getapp.ro</span>.
                </p>
              </div>

              {resetSuccess ? (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-3">
                  <div className="w-10 h-10 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-emerald-900 dark:text-emerald-200">
                      Solicitare trimisă cu succes!
                    </h3>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                      Cererea a fost expediată la contact@getapp.ro. Administratorul va procesa cererea și vă va contacta.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetForm(false);
                      setResetSuccess(false);
                    }}
                    style={{ backgroundColor: effectiveThemeColor }}
                    className="w-full h-9 rounded-lg text-white font-bold text-xs shadow-sm hover:opacity-90 transition-opacity"
                  >
                    Înapoi la introducere PIN
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSendResetRequest} className="space-y-3">
                  {resetError && (
                    <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{resetError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      Nume și prenume *
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={e => {
                        setFullName(e.target.value);
                        if (resetError) setResetError("");
                      }}
                      placeholder="ex. Ion Popescu"
                      className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      Număr de telefon *
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={e => {
                        setPhone(e.target.value);
                        if (resetError) setResetError("");
                      }}
                      placeholder="ex. 0740 123 456"
                      className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                      Funcție în cadrul firmei *
                    </label>
                    <input
                      type="text"
                      required
                      value={role}
                      onChange={e => {
                        setRole(e.target.value);
                        if (resetError) setResetError("");
                      }}
                      placeholder="ex. Director, Contabil, Administrator"
                      className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      Explicație / Motiv solicitare *
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={explanation}
                      onChange={e => {
                        setExplanation(e.target.value);
                        if (resetError) setResetError("");
                      }}
                      placeholder="Descrieți pe scurt motivul pentru care solicitați resetarea PIN-ului..."
                      className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowResetForm(false)}
                      className="flex-1 h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Anulează
                    </button>
                    <button
                      type="submit"
                      disabled={requestResetMutation.isPending}
                      style={{ backgroundColor: effectiveThemeColor }}
                      className="flex-1 h-10 rounded-xl text-white font-bold text-xs shadow-md hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
                    >
                      {requestResetMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Mail className="w-4 h-4" />
                      )}
                      Trimite solicitarea
                    </button>
                  </div>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
