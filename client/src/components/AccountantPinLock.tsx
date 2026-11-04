import { useState, useRef, useEffect } from "react";
import {
  Lock,
  Loader2,
  AlertCircle,
  MapPin,
  Timer,
  Building2,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

interface AccountantPinLockProps {
  token: string;
  companyName: string;
  cui?: string;
  companyLogo?: string;
  logoBgColor?: string;
  logoHasBackground?: boolean;
  themeColor?: string;
  onUnlocked: (sessionToken: string) => void;
}

interface DayForecast {
  date: string;
  dayName: string;
  shortDate: string;
  weatherCode: number;
  condition: string;
  tempMax: number;
  tempMin: number;
}

interface WeatherData {
  temp: number;
  city: string;
  condition: string;
  weatherCode: number;
  humidity?: number;
  forecast: DayForecast[];
}

const CHROMECAST_WALLPAPERS = [
  {
    url: "/images/lockscreen_relax_bg.jpg",
    title: "Lacul Moraine, Munții Stâncoși",
    country: "Banff, Canada",
  },
  {
    url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1920&q=80",
    title: "Valea Yosemite la asfințit",
    country: "California, SUA",
  },
  {
    url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1920&q=80",
    title: "Vârfurile maiestuoase ale Alpilor",
    country: "Elveția",
  },
  {
    url: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1920&q=80",
    title: "Apele de smarald ale Lacului Braies",
    country: "Munții Dolomiți, Italia",
  },
  {
    url: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=1920&q=80",
    title: "Aurora Boreală peste fiorduri",
    country: "Insulele Lofoten, Norvegia",
  },
  {
    url: "https://images.unsplash.com/photo-1543783207-ec64e4d95325?auto=format&fit=crop&w=1920&q=80",
    title: "Dealurile domoale și chiparoșii din Val d'Orcia",
    country: "Toscana, Italia",
  },
  {
    url: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1920&q=80",
    title: "Vilele istorice de pe malul Lacului Como",
    country: "Lombardia, Italia",
  },
];

function formatAppleDate(d: Date): string {
  const days = ["Duminică", "Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă"];
  const months = [
    "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
    "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
  ];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function formatAppleTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export default function AccountantPinLock({
  token,
  companyName,
  cui,
  companyLogo,
  logoBgColor,
  logoHasBackground,
  themeColor = "#16a34a",
  onUnlocked,
}: AccountantPinLockProps) {
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());
  const [bgIndex, setBgIndex] = useState(0);
  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isShaking, setIsShaking] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const lockoutStorageKey = `smart_invoice_accountant_lockout_${token}`;
  const attemptsStorageKey = `smart_invoice_accountant_attempts_${token}`;

  const [lockoutRemaining, setLockoutRemaining] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(lockoutStorageKey);
      if (stored) {
        const remaining = Math.ceil((parseInt(stored, 10) - Date.now()) / 1000);
        return remaining > 0 ? remaining : 0;
      }
    } catch {}
    return 0;
  });

  // Ceas live
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Schimbare imagini de fundal la fiecare 20 secunde
  useEffect(() => {
    const bgTimer = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % CHROMECAST_WALLPAPERS.length);
    }, 20000);
    return () => clearInterval(bgTimer);
  }, []);

  // Timer blocare la incercari gresite
  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const timer = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          try {
            localStorage.removeItem(lockoutStorageKey);
            localStorage.removeItem(attemptsStorageKey);
          } catch {}
          setErrorMsg("");
          setTimeout(() => inputRef.current?.focus(), 100);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemaining, lockoutStorageKey, attemptsStorageKey]);

  useEffect(() => {
    if (lockoutRemaining <= 0) {
      inputRef.current?.focus();
    }
  }, [lockoutRemaining]);

  const verifyPinMutation = trpc.accountantPortal.verifyPin.useMutation();

  const submitPin = async (candidatePin: string) => {
    if (lockoutRemaining > 0) {
      setErrorMsg(`Accesul este blocat temporar. Reîncercați în ${lockoutRemaining} secunde.`);
      return;
    }
    if (candidatePin.length !== 4) return;
    if (verifyPinMutation.isPending) return;

    setErrorMsg("");

    try {
      const res = await verifyPinMutation.mutateAsync({
        token,
        pin: candidatePin,
      });

      if (res?.sessionToken) {
        try {
          localStorage.removeItem(lockoutStorageKey);
          localStorage.removeItem(attemptsStorageKey);
        } catch {}
        onUnlocked(res.sessionToken);
      }
    } catch (err: any) {
      let currentAttempts = 1;
      try {
        const stored = parseInt(localStorage.getItem(attemptsStorageKey) || "0", 10);
        currentAttempts = isNaN(stored) ? 1 : stored + 1;
        localStorage.setItem(attemptsStorageKey, String(currentAttempts));
      } catch {}

      setPin("");
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 550);

      if (currentAttempts >= 3) {
        const lockoutUntil = Date.now() + 60 * 1000;
        try {
          localStorage.setItem(lockoutStorageKey, String(lockoutUntil));
        } catch {}
        setLockoutRemaining(60);
        setErrorMsg("Cod PIN greșit de 3 ori. Introducerea este blocată pentru 1 minut.");
      } else {
        const remainingAttempts = 3 - currentAttempts;
        setErrorMsg(
          `Cod PIN incorect. Mai aveți ${remainingAttempts} ${
            remainingAttempts === 1 ? "încercare" : "încercări"
          } înainte de blocare.`
        );
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length === 4) {
      submitPin(pin);
    } else {
      setErrorMsg("Codul PIN trebuie să conțină exact 4 cifre.");
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 550);
    }
  };

  const currentWallpaper = CHROMECAST_WALLPAPERS[bgIndex] || CHROMECAST_WALLPAPERS[0];
  const effectiveThemeColor = themeColor || "#16a34a";
  const hasCustomLogoBg = Boolean(
    (logoHasBackground && logoBgColor) ||
      (logoBgColor &&
        logoBgColor.toLowerCase() !== "#ffffff" &&
        logoBgColor.toLowerCase() !== "#fff" &&
        logoBgColor.trim() !== "") ||
      logoHasBackground
  );
  const effectiveLogoBg = hasCustomLogoBg ? logoBgColor || "#0f172a" : undefined;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 transition-all duration-300 overflow-y-auto font-sans select-none">
      {/* Imagini de fundal stil Google Chromecast cu crossfade lin */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        {CHROMECAST_WALLPAPERS.map((wp, idx) => {
          const isActive = idx === bgIndex;
          return (
            <div
              key={wp.url}
              className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-[2500ms] ease-in-out filter brightness-95 ${
                isActive ? "opacity-100 scale-100" : "opacity-0 scale-105 pointer-events-none"
              }`}
              style={{
                backgroundImage: `url('${wp.url}')`,
              }}
            />
          );
        })}
      </div>

      {/* Overlay radial cinematic */}
      <div
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 30%, ${effectiveThemeColor}30 0%, rgba(15, 23, 42, 0.6) 45%, rgba(15, 23, 42, 0.88) 100%)`,
        }}
      />

      {/* Etichetă fundal în colțul stânga-jos */}
      <div className="fixed bottom-4 left-4 z-20 pointer-events-none hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white/85 text-xs shadow-lg">
        <MapPin className="w-3.5 h-3.5 text-white/60 shrink-0" />
        <span className="font-medium">
          {currentWallpaper.title}
          <span className="text-white/40 mx-1.5">•</span>
          <span className="text-white/70">{currentWallpaper.country}</span>
        </span>
      </div>

      {/* Stil pentru tremur la PIN greșit */}
      <style>{`
        @keyframes appleShake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-16px); }
          30% { transform: translateX(14px); }
          45% { transform: translateX(-10px); }
          60% { transform: translateX(7px); }
          75% { transform: translateX(-4px); }
          90% { transform: translateX(2px); }
        }
        .animate-apple-shake {
          animation: appleShake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }
      `}</style>

      {/* Fereastră Apple Glassmorphic */}
      <div
        className={`w-full max-w-md z-10 my-auto py-7 bg-black/45 backdrop-blur-3xl rounded-[36px] shadow-[0_30px_70px_rgba(0,0,0,0.65)] p-6 sm:p-8 space-y-6 text-white border border-white/10 ${
          isShaking ? "animate-apple-shake ring-2 ring-rose-500/50" : "animate-in fade-in zoom-in-95 duration-300"
        }`}
      >
        {/* Header Ceas */}
        <div className="flex flex-col items-center justify-center text-center pb-5 border-b border-white/[0.08] select-none">
          <div className="text-white/90 text-sm sm:text-base font-medium tracking-wide mb-1.5">
            {formatAppleDate(currentTime)}
          </div>
          <div className="text-6xl sm:text-7xl font-bold tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)] leading-none my-1">
            {formatAppleTime(currentTime)}
          </div>
        </div>

        {/* View Securitate Portal Contabil */}
        <div className="flex flex-col items-center text-center space-y-3 pt-1">
          {companyLogo && !logoFailed ? (
            <div className="relative">
              <div
                className={`w-24 h-24 sm:w-28 sm:h-28 rounded-3xl shadow-2xl p-3 flex items-center justify-center overflow-hidden transition-all ${
                  effectiveLogoBg ? "border border-white/20" : "bg-white border border-white/40"
                }`}
                style={effectiveLogoBg ? { backgroundColor: effectiveLogoBg } : undefined}
              >
                <img
                  src={companyLogo}
                  alt={companyName}
                  className="w-full h-full object-contain"
                  onError={() => setLogoFailed(true)}
                />
              </div>
              <div
                className="absolute -bottom-1.5 -right-1.5 w-7 h-7 sm:w-8 sm:h-8 rounded-full text-white flex items-center justify-center shadow-md border-2 border-white"
                style={{ backgroundColor: effectiveThemeColor }}
              >
                <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
          ) : (
            <div
              className="w-16 h-16 rounded-2xl border flex items-center justify-center shadow-md"
              style={{
                backgroundColor: `${effectiveThemeColor}25`,
                borderColor: `${effectiveThemeColor}50`,
                color: effectiveThemeColor,
              }}
            >
              <Building2 className="w-8 h-8" />
            </div>
          )}

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide bg-white/10 text-white/90 border border-white/15 mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Portal Contabilitate</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">{companyName}</h2>
            {cui && <p className="text-xs text-white/70 font-mono mt-0.5">CUI: {cui}</p>}
            <p className="text-xs text-slate-300 mt-2 max-w-xs mx-auto">
              Introduceți codul PIN de 4 cifre pentru a accesa facturile și fișele NIR.
            </p>
          </div>
        </div>

        {/* Mesaje eroare / blocare */}
        {lockoutRemaining > 0 ? (
          <div className="p-3 rounded-xl bg-amber-950/70 border border-amber-500/40 flex items-center justify-between gap-3 text-amber-200 text-xs font-semibold animate-pulse">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 shrink-0 text-amber-400" />
              <span>Blocat temporar (3 încercări greșite)</span>
            </div>
            <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
              {lockoutRemaining}s
            </span>
          </div>
        ) : errorMsg ? (
          <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 flex items-center gap-2 text-rose-200 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        ) : null}

        {/* Formular PIN */}
        <form onSubmit={handleUnlock} className="space-y-4" autoComplete="off">
          {/* Câmp ascuns pentru tastatură */}
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pin}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "").slice(0, 4);
              setPin(val);
              setErrorMsg("");
              if (val.length === 4) {
                submitPin(val);
              }
            }}
            disabled={lockoutRemaining > 0 || verifyPinMutation.isPending}
            className="sr-only"
            autoFocus
          />

          {/* Indicator vizual 4 buline/cercuri PIN */}
          <div
            onClick={() => inputRef.current?.focus()}
            className="flex items-center justify-center gap-4 py-2 cursor-pointer"
          >
            {[0, 1, 2, 3].map((idx) => {
              const isFilled = pin.length > idx;
              return (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full transition-all duration-200 ${
                    isFilled
                      ? "bg-white scale-125 shadow-[0_0_12px_rgba(255,255,255,0.8)]"
                      : "bg-white/20 border border-white/30"
                  }`}
                />
              );
            })}
          </div>

          {/* Tastatură numerică tactilă (1-9, C, 0, Backspace) */}
          <div className="grid grid-cols-3 gap-2.5 pt-2 max-w-xs mx-auto">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => {
                  if (lockoutRemaining > 0 || verifyPinMutation.isPending) return;
                  if (pin.length < 4) {
                    const next = pin + digit;
                    setPin(next);
                    setErrorMsg("");
                    if (next.length === 4) submitPin(next);
                  }
                }}
                disabled={lockoutRemaining > 0 || verifyPinMutation.isPending}
                className="h-12 rounded-2xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-semibold text-lg transition border border-white/10 flex items-center justify-center disabled:opacity-40"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setPin("");
                setErrorMsg("");
                inputRef.current?.focus();
              }}
              disabled={lockoutRemaining > 0 || verifyPinMutation.isPending || !pin}
              className="h-12 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/20 text-white/70 font-medium text-sm transition border border-white/10 flex items-center justify-center disabled:opacity-40"
            >
              Șterge
            </button>
            <button
              type="button"
              onClick={() => {
                if (lockoutRemaining > 0 || verifyPinMutation.isPending) return;
                if (pin.length < 4) {
                  const next = pin + "0";
                  setPin(next);
                  setErrorMsg("");
                  if (next.length === 4) submitPin(next);
                }
              }}
              disabled={lockoutRemaining > 0 || verifyPinMutation.isPending}
              className="h-12 rounded-2xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-semibold text-lg transition border border-white/10 flex items-center justify-center disabled:opacity-40"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => {
                if (pin.length > 0) {
                  setPin(pin.slice(0, -1));
                  setErrorMsg("");
                  inputRef.current?.focus();
                }
              }}
              disabled={lockoutRemaining > 0 || verifyPinMutation.isPending || !pin}
              className="h-12 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/20 text-white/70 font-medium text-sm transition border border-white/10 flex items-center justify-center disabled:opacity-40"
            >
              ←
            </button>
          </div>

          {verifyPinMutation.isPending && (
            <div className="flex items-center justify-center gap-2 pt-2 text-xs text-white/80">
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Se verifică codul PIN...</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

