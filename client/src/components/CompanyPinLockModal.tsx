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
  Sun,
  CloudSun,
  CloudRain,
  Cloud,
  Snowflake,
  CloudLightning,
  MapPin,
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

interface WeatherData {
  temp: number;
  city: string;
  condition: string;
  weatherCode: number;
}

const CHROMECAST_WALLPAPERS = [
  // 1. Natura & Peisaje spectaculoase
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
    url: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1920&q=80",
    title: "Cascada Seljalandsfoss la apus",
    country: "Islanda",
  },
  {
    url: "https://images.unsplash.com/photo-1527004013197-933c4bb611b3?auto=format&fit=crop&w=1920&q=80",
    title: "Parcul Național Torres del Paine",
    country: "Patagonia, Chile",
  },
  {
    url: "https://images.unsplash.com/photo-1518457607834-6e8d80c183c5?auto=format&fit=crop&w=1920&q=80",
    title: "Raze de soare în Canionul Antelope",
    country: "Arizona, SUA",
  },

  // 2. Calatorii & Locuri iconice
  {
    url: "https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=1920&q=80",
    title: "Baloane cu aer cald peste văile de tuf",
    country: "Cappadocia, Turcia",
  },
  {
    url: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1920&q=80",
    title: "Grădinile Zen și templele tradiționale",
    country: "Kyoto, Japonia",
  },
  {
    url: "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1920&q=80",
    title: "Arhitectură albă pe stâncile din Oia",
    country: "Santorini, Grecia",
  },
  {
    url: "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=1920&q=80",
    title: "Satul pitoresc Positano și Coasta Amalfi",
    country: "Italia",
  },
  {
    url: "https://images.unsplash.com/photo-1543783207-ec64e4d95325?auto=format&fit=crop&w=1920&q=80",
    title: "Dealurile domoale și chiparoșii din Val d'Orcia",
    country: "Toscana, Italia",
  },
  {
    url: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1920&q=80",
    title: "Cheiurile Senei și Turnul Eiffel",
    country: "Paris, Franța",
  },
  {
    url: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1920&q=80",
    title: "Vilele istorice de pe malul Lacului Como",
    country: "Lombardia, Italia",
  },
  {
    url: "https://images.unsplash.com/photo-1477959858617-67f30bc75b82?auto=format&fit=crop&w=1920&q=80",
    title: "Orizont urban modern la apus",
    country: "Chicago, SUA",
  },

  // 3. Relaxare & Destinatii de vis
  {
    url: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=1920&q=80",
    title: "Bungalouri pe apă deasupra lagunei turcoaz",
    country: "Maldive",
  },
  {
    url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=80",
    title: "Apus auriu pe o plajă tropicală liniștită",
    country: "Bora Bora, Polinezia Franceză",
  },
  {
    url: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1920&q=80",
    title: "Câmpurile nesfârșite de lavandă înflorită",
    country: "Provence, Franța",
  },
  {
    url: "https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?auto=format&fit=crop&w=1920&q=80",
    title: "Terasele de orez în roua dimineții",
    country: "Ubud, Bali",
  },
  {
    url: "https://images.unsplash.com/photo-1490806843957-31f4c9a91c65?auto=format&fit=crop&w=1920&q=80",
    title: "Muntele Fuji învăluit în nori la răsărit",
    country: "Japonia",
  },
  {
    url: "https://images.unsplash.com/photo-1515238152791-8216bfdf89a7?auto=format&fit=crop&w=1920&q=80",
    title: "Stâncile aurii și apele cristaline din Algarve",
    country: "Portugalia",
  },
  {
    url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=80",
    title: "Pajiștile alpine și culmile masivului Geisler",
    country: "Val di Funes, Italia",
  },
  {
    url: "https://images.unsplash.com/photo-1513584684374-8bab748fbf90?auto=format&fit=crop&w=1920&q=80",
    title: "Pădure de conifere sub zăpada iernii",
    country: "Norvegia",
  },
];

function formatAppleTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function formatAppleDate(d: Date): string {
  const days = [
    "Duminică",
    "Luni",
    "Marți",
    "Miercuri",
    "Joi",
    "Vineri",
    "Sâmbătă",
  ];
  const months = [
    "ianuarie",
    "februarie",
    "martie",
    "aprilie",
    "mai",
    "iunie",
    "iulie",
    "august",
    "septembrie",
    "octombrie",
    "noiembrie",
    "decembrie",
  ];
  const dayName = days[d.getDay()];
  const dayNum = d.getDate();
  const monthName = months[d.getMonth()];
  return `${dayName}, ${dayNum} ${monthName}`;
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

function getWeatherLabel(code: number): string {
  if (code === 0) return "Senin";
  if (code === 1) return "Predominant senin";
  if (code === 2) return "Parțial noros";
  if (code === 3) return "Înnorat";
  if (code === 45 || code === 48) return "Ceață";
  if (code >= 51 && code <= 55) return "Burniță";
  if (code >= 61 && code <= 65) return "Ploaie";
  if (code >= 71 && code <= 77) return "Ninsoare";
  if (code >= 80 && code <= 82) return "Averse de ploaie";
  if (code >= 95) return "Furtună";
  return "Senin";
}

function getWeatherIcon(code: number) {
  if (code === 0 || code === 1) return Sun;
  if (code === 2 || code === 3) return CloudSun;
  if (code === 45 || code === 48) return Cloud;
  if ((code >= 51 && code <= 65) || (code >= 80 && code <= 82)) return CloudRain;
  if (code >= 71 && code <= 77) return Snowflake;
  if (code >= 95) return CloudLightning;
  return Sun;
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
  const [bgIndex, setBgIndex] = useState(0);
  const [weather, setWeather] = useState<WeatherData | null>(null);

  // Ceas live la fiecare secundă
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Schimbare imagini stil Google Chromecast la fiecare 20 secunde
  useEffect(() => {
    const bgTimer = setInterval(() => {
      setBgIndex(prev => (prev + 1) % CHROMECAST_WALLPAPERS.length);
    }, 20000);
    return () => clearInterval(bgTimer);
  }, []);

  // Preluare vreme live din locație
  useEffect(() => {
    let isMounted = true;

    async function fetchWeather(lat: number, lon: number, cityName?: string) {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`
        );
        const data = await res.json();
        if (isMounted && data.current) {
          setWeather({
            temp: Math.round(data.current.temperature_2m),
            city: cityName || "București",
            condition: getWeatherLabel(data.current.weather_code),
            weatherCode: data.current.weather_code,
          });
        }
      } catch {}
    }

    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&localityLanguage=ro`
          )
            .then(r => r.json())
            .then(geo => {
              const city = geo?.city || geo?.locality || geo?.principalSubdivision || "Locație curentă";
              fetchWeather(pos.coords.latitude, pos.coords.longitude, city);
            })
            .catch(() => {
              fetchWeather(pos.coords.latitude, pos.coords.longitude, "Locație curentă");
            });
        },
        () => {
          fetch("https://ipapi.co/json/")
            .then(r => r.json())
            .then(ipData => {
              if (ipData?.latitude && ipData?.longitude) {
                fetchWeather(ipData.latitude, ipData.longitude, ipData.city || "București");
              } else {
                fetchWeather(44.4323, 26.1063, "București");
              }
            })
            .catch(() => {
              fetchWeather(44.4323, 26.1063, "București");
            });
        },
        { timeout: 6000 }
      );
    } else {
      fetchWeather(44.4323, 26.1063, "București");
    }

    return () => {
      isMounted = false;
    };
  }, []);

  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [logoFailed, setLogoFailed] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(true);
  const [isShaking, setIsShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Stare formular reset / contact administrator - campuri curate, completat doar la explicatii
  const [showResetForm, setShowResetForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [explanation, setExplanation] = useState(
    `Solicit resetarea codului PIN de acces pentru firma ${companyName}.`
  );
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);

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
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 550);
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
      setIsShaking(true);
      setTimeout(() => {
        setIsShaking(false);
      }, 550);
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
  const currentWallpaper = CHROMECAST_WALLPAPERS[bgIndex] || CHROMECAST_WALLPAPERS[0];

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4 transition-all duration-300 overflow-y-auto">
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

      {/* Overlay cinematic cu tenta eleganta si accente subtile din culoarea tenant-ului */}
      <div
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 30%, ${effectiveThemeColor}30 0%, rgba(15, 23, 42, 0.55) 45%, rgba(15, 23, 42, 0.85) 100%)`,
        }}
      />

      {/* Eticheta foto stil Google Chromecast in coltul stanga-jos */}
      <div className="fixed bottom-4 left-4 z-20 pointer-events-none hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white/85 text-xs shadow-lg animate-in fade-in duration-500">
        <MapPin className="w-3.5 h-3.5 text-white/60 shrink-0" />
        <span className="font-medium">
          {currentWallpaper.title}
          <span className="text-white/40 mx-1.5">•</span>
          <span className="text-white/70">{currentWallpaper.country}</span>
        </span>
      </div>

      {/* Stiluri pentru animația de tremurare Apple la PIN greșit */}
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

      {/* Fereastră Unică stil Apple (Ceas + Securitate Firmă) */}
      <div
        className={`w-full max-w-md bg-black/30 dark:bg-black/45 backdrop-blur-3xl border border-white/[0.08] rounded-[36px] shadow-[0_25px_60px_rgba(0,0,0,0.4)] p-6 sm:p-8 space-y-6 text-white transition-all ${
          isShaking ? "animate-apple-shake ring-2 ring-rose-500/50" : "animate-in fade-in zoom-in-95 duration-300"
        }`}
      >
        {/* Header Ceas & Vreme */}
        <div className="flex flex-col items-center justify-center text-center pb-5 border-b border-white/[0.08] select-none">
          {/* Rândul Apple: Data & Vremea */}
          <div className="flex items-center justify-center flex-wrap gap-2 text-white/90 text-sm sm:text-base font-medium tracking-wide mb-1.5">
            <span>{formatAppleDate(currentTime)}</span>
            {weather && (
              <>
                <span className="text-white/40">•</span>
                <div className="inline-flex items-center gap-2 text-white font-semibold">
                  {(() => {
                    const IconComp = getWeatherIcon(weather.weatherCode);
                    return <IconComp className="w-5 h-5 sm:w-6 sm:h-6 text-amber-300 shrink-0 drop-shadow-sm" />;
                  })()}
                  <span className="text-base sm:text-lg">{weather.temp > 0 ? `+${weather.temp}` : weather.temp}°C</span>
                  <span className="text-white/75 text-xs sm:text-sm font-normal hidden sm:inline">({weather.condition})</span>
                </div>
              </>
            )}
          </div>

          {/* Ora mare BOLD stil Apple */}
          <div className="text-6xl sm:text-7xl font-bold tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)] leading-none my-1 select-none font-sans">
            {formatAppleTime(currentTime)}
          </div>
        </div>

        {!showResetForm ? (
          <>
            {/* View PIN Lock */}
            <div className="flex flex-col items-center text-center space-y-3 pt-1">
              {companyLogo && !logoFailed ? (
                <div className="relative">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-white shadow-2xl border border-white/40 p-3 flex items-center justify-center overflow-hidden">
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
                  className="w-14 h-14 rounded-2xl border flex items-center justify-center shadow-xs"
                  style={{
                    backgroundColor: `${effectiveThemeColor}20`,
                    borderColor: `${effectiveThemeColor}40`,
                    color: effectiveThemeColor,
                  }}
                >
                  <Lock className="w-7 h-7" />
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold text-white">
                  Securitate Firmă
                </h2>
                <p className="text-xs text-slate-300 mt-1 max-w-xs mx-auto">
                  Pentru a accesa datele firmei{" "}
                  <span className="font-semibold text-white">
                    {companyName}
                  </span>
                  , introduceți codul PIN de securitate.
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 flex items-center gap-2 text-rose-200 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleUnlock} className="space-y-4" autoComplete="off">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5 text-center">
                  Cod PIN de acces
                </label>
                <div
                  onClick={() => inputRef.current?.focus()}
                  className={`relative w-full h-12 flex items-center justify-center bg-white/10 dark:bg-black/40 border rounded-2xl cursor-text transition-all ${
                    isInputFocused
                      ? "border-white/40 ring-2 ring-white/20"
                      : "border-white/[0.08]"
                  }`}
                >
                  <input
                    ref={inputRef}
                    type="text"
                    name="pin_access_token"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-form-type="other"
                    maxLength={10}
                    value={pin}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => setIsInputFocused(false)}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9]/g, "");
                      setPin(val);
                      if (errorMsg) setErrorMsg("");
                    }}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-text"
                    autoFocus
                  />
                  {/* Steluțe ASCII perfect centrate și aliniate (fără linie verticală) */}
                  <div className="flex items-center justify-center gap-3.5 select-none pointer-events-none">
                    {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => {
                      const isFilled = i < pin.length;
                      return (
                        <span
                          key={i}
                          className={`inline-flex items-center justify-center w-6 h-6 text-2xl font-mono font-bold leading-none select-none transition-all duration-150 ${
                            isFilled ? "text-white scale-110" : "text-white/30"
                          }`}
                        >
                          *
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={verifyPinMutation.isPending || !pin.trim()}
                style={{ backgroundColor: effectiveThemeColor }}
                className="w-full h-11 rounded-2xl hover:opacity-90 disabled:opacity-50 text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2"
              >
                {verifyPinMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                Deblochează accesul
              </button>
            </form>

            <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  setShowResetForm(true);
                  setResetError("");
                  setResetSuccess(false);
                }}
                className="inline-flex items-center gap-1.5 font-semibold text-slate-300 hover:text-white transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Contactează administratorul
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 text-slate-400 hover:text-rose-400 transition-colors"
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
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <button
                  type="button"
                  onClick={() => setShowResetForm(false)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Înapoi la PIN
                </button>
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Asistență PIN
                </span>
              </div>

              <div className="text-center space-y-1.5">
                <div
                  className="w-12 h-12 mx-auto rounded-2xl border flex items-center justify-center shadow-xs"
                  style={{
                    backgroundColor: `${effectiveThemeColor}20`,
                    borderColor: `${effectiveThemeColor}40`,
                    color: effectiveThemeColor,
                  }}
                >
                  <Mail className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-white">
                  Contactează Administratorul
                </h2>
                <p className="text-xs text-slate-200 max-w-xs mx-auto">
                  Trimiteți o solicitare de resetare a codului PIN pentru firma{" "}
                  <span className="font-semibold text-white">
                    {companyName}
                  </span>
                  . Mesajul va ajunge direct la{" "}
                  <span className="font-semibold text-blue-400">
                    contact@getapp.ro
                  </span>
                  .
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
                <form onSubmit={handleSendResetRequest} className="space-y-3" autoComplete="off">
                  {resetError && (
                    <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{resetError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1 flex items-center gap-1.5">
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
                      className="w-full h-9 px-3 text-xs bg-white/10 border border-white/[0.08] rounded-xl text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-white/40"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1 flex items-center gap-1.5">
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
                      className="w-full h-9 px-3 text-xs bg-white/10 border border-white/[0.08] rounded-xl text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-white/40"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1 flex items-center gap-1.5">
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
                      className="w-full h-9 px-3 text-xs bg-white/10 border border-white/[0.08] rounded-xl text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-white/40"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1 flex items-center gap-1.5">
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
                      className="w-full p-2.5 text-xs bg-white/10 border border-white/[0.08] rounded-xl text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-white/40 resize-none"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowResetForm(false)}
                      className="flex-1 h-10 rounded-xl border border-white/15 text-xs font-bold text-slate-200 hover:bg-white/10 hover:text-white transition-colors"
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

      {/* Branding GetApp jos de tot pe mijloc, la nivelul locatiei pozei */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 select-none animate-in fade-in duration-300">
        <a
          href="https://www.getapp.ro"
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => {
            e.stopPropagation();
            window.open("https://www.getapp.ro", "_blank", "noopener,noreferrer");
          }}
          className="cursor-pointer inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-black/50 hover:bg-black/75 backdrop-blur-2xl border border-white/20 hover:border-white/40 text-white shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 group pointer-events-auto"
        >
          <img
            src="/images/logo_getapp_original.png"
            alt="GetApp"
            className="h-5 sm:h-5.5 w-auto object-contain"
            onError={e => {
              (e.target as HTMLImageElement).src = "https://getapp.ro/logo_getapp_original.png";
            }}
          />
          <div className="flex items-center border-l border-white/25 pl-2.5 text-xs font-semibold tracking-wide text-white/90 group-hover:text-white">
            <span>www.getapp.ro</span>
          </div>
        </a>
      </div>
    </div>
  );
}
