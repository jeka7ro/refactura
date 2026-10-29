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
  MapPin,
  Timer,
  Droplets,
  Wind,
  Building2,
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
  isSuperadmin?: boolean;
  onUnlocked: () => void;
}

interface DayForecast {
  date: string;
  dayName: string;
  shortDate: string;
  weatherCode: number;
  condition: string;
  tempMax: number;
  tempMin: number;
  precipProb?: number;
}

interface WeatherData {
  temp: number;
  city: string;
  condition: string;
  weatherCode: number;
  humidity?: number;
  windSpeed?: number;
  tempMax?: number;
  tempMin?: number;
  forecast: DayForecast[];
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

function Weather3DIcon({ code, className = "w-8 h-8" }: { code: number; className?: string }) {
  // 1. Soare 3D (0, 1) - Sferă 3D aurie strălucitoare cu raze volumetrice
  if (code === 0 || code === 1) {
    return (
      <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="sun3d_full" cx="32%" cy="28%" r="68%">
            <stop offset="0%" stopColor="#FFFDF0" />
            <stop offset="20%" stopColor="#FEF08A" />
            <stop offset="50%" stopColor="#FBBF24" />
            <stop offset="80%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" />
          </radialGradient>
          <linearGradient id="sun3d_ray_full" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.4" />
          </linearGradient>
          <filter id="sun3d_deep_glow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#EA580C" floodOpacity="0.45" />
          </filter>
        </defs>
        <g filter="url(#sun3d_deep_glow)">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <line
              key={angle}
              x1="32"
              y1="5"
              x2="32"
              y2="12"
              stroke="url(#sun3d_ray_full)"
              strokeWidth="4"
              strokeLinecap="round"
              transform={`rotate(${angle} 32 32)`}
            />
          ))}
          <circle cx="32" cy="32" r="16" fill="url(#sun3d_full)" />
          <ellipse cx="27" cy="24" rx="6" ry="3.2" fill="#FFFFFF" opacity="0.75" transform="rotate(-25 27 24)" />
        </g>
      </svg>
    );
  }

  // 2. Parțial noros 3D (2) - Soare 3D auriu în spate + Nor volumetric alb satinat în față
  if (code === 2) {
    return (
      <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="sun3d_part" cx="30%" cy="25%" r="70%">
            <stop offset="0%" stopColor="#FFFBEB" />
            <stop offset="25%" stopColor="#FDE047" />
            <stop offset="65%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" />
          </radialGradient>
          <radialGradient id="cloud3d_p_main" cx="35%" cy="25%" r="70%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="40%" stopColor="#F8FAFC" />
            <stop offset="75%" stopColor="#E2E8F0" />
            <stop offset="100%" stopColor="#94A3B8" />
          </radialGradient>
          <radialGradient id="cloud3d_p_side" cx="30%" cy="25%" r="70%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="50%" stopColor="#F1F5F9" />
            <stop offset="100%" stopColor="#94A3B8" />
          </radialGradient>
          <filter id="sun3d_part_glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#F59E0B" floodOpacity="0.5" />
          </filter>
          <filter id="cloud3d_p_shadow" x="-25%" y="-20%" width="150%" height="150%">
            <feDropShadow dx="0" dy="5" stdDeviation="4.5" floodColor="#0F172A" floodOpacity="0.45" />
          </filter>
        </defs>
        <g filter="url(#sun3d_part_glow)">
          <circle cx="41" cy="23" r="13" fill="url(#sun3d_part)" />
          <ellipse cx="37" cy="18" rx="4.5" ry="2.2" fill="#FFFFFF" opacity="0.75" transform="rotate(-25 37 18)" />
          {[15, 60, 105].map((angle) => (
            <line
              key={angle}
              x1="41"
              y1="6"
              x2="41"
              y2="9.5"
              stroke="#FDE047"
              strokeWidth="3"
              strokeLinecap="round"
              transform={`rotate(${angle} 41 23)`}
            />
          ))}
        </g>
        <g filter="url(#cloud3d_p_shadow)">
          <rect x="15" y="34" width="34" height="15" rx="7.5" fill="url(#cloud3d_p_main)" />
          <circle cx="22" cy="37" r="11" fill="url(#cloud3d_p_side)" />
          <circle cx="42" cy="38" r="9" fill="url(#cloud3d_p_side)" />
          <circle cx="31" cy="29" r="13.5" fill="url(#cloud3d_p_main)" />
          <path d="M25 18c3-2 8-2 11 1" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
        </g>
      </svg>
    );
  }

  // 3. Înnorat 3D (3) - Nor volumetric bogat cu lobi sferici 3D și reflexii lucioase
  if (code === 3) {
    return (
      <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="cloud3d_ov_back" cx="30%" cy="25%" r="75%">
            <stop offset="0%" stopColor="#CBD5E1" />
            <stop offset="60%" stopColor="#94A3B8" />
            <stop offset="100%" stopColor="#475569" />
          </radialGradient>
          <radialGradient id="cloud3d_ov_main" cx="35%" cy="25%" r="70%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="35%" stopColor="#F8FAFC" />
            <stop offset="70%" stopColor="#E2E8F0" />
            <stop offset="100%" stopColor="#94A3B8" />
          </radialGradient>
          <radialGradient id="cloud3d_ov_left" cx="30%" cy="25%" r="70%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="50%" stopColor="#F1F5F9" />
            <stop offset="100%" stopColor="#94A3B8" />
          </radialGradient>
          <radialGradient id="cloud3d_ov_right" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="50%" stopColor="#E2E8F0" />
            <stop offset="100%" stopColor="#64748B" />
          </radialGradient>
          <filter id="cloud3d_ov_shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#0F172A" floodOpacity="0.45" />
          </filter>
        </defs>
        <g filter="url(#cloud3d_ov_shadow)">
          <circle cx="26" cy="25" r="13" fill="url(#cloud3d_ov_back)" opacity="0.8" />
          <circle cx="42" cy="27" r="11" fill="url(#cloud3d_ov_back)" opacity="0.75" />
          <rect x="16" y="32" width="34" height="15" rx="7.5" fill="url(#cloud3d_ov_main)" />
          <circle cx="23" cy="35" r="11.5" fill="url(#cloud3d_ov_left)" />
          <circle cx="43" cy="36" r="9.5" fill="url(#cloud3d_ov_right)" />
          <circle cx="33" cy="27" r="14.5" fill="url(#cloud3d_ov_main)" />
          <path d="M26 16c4-3 10-2 13 1" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
          <path d="M17 28c2-3 5-3 7-1" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
        </g>
      </svg>
    );
  }

  // 4. Ceață 3D (45, 48)
  if (code === 45 || code === 48) {
    return (
      <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="fog3d_cloud_body" cx="35%" cy="25%" r="70%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="45%" stopColor="#F1F5F9" />
            <stop offset="80%" stopColor="#CBD5E1" />
            <stop offset="100%" stopColor="#94A3B8" />
          </radialGradient>
          <linearGradient id="fog3d_stripe" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#94A3B8" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#E2E8F0" />
            <stop offset="100%" stopColor="#94A3B8" stopOpacity="0.2" />
          </linearGradient>
          <filter id="fog3d_shadow" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0F172A" floodOpacity="0.3" />
          </filter>
        </defs>
        <g filter="url(#fog3d_shadow)">
          <rect x="15" y="20" width="34" height="15" rx="7.5" fill="url(#fog3d_cloud_body)" />
          <circle cx="22" cy="23" r="11" fill="url(#fog3d_cloud_body)" />
          <circle cx="42" cy="24" r="9" fill="url(#fog3d_cloud_body)" />
          <circle cx="31" cy="15" r="13.5" fill="url(#fog3d_cloud_body)" />
          <rect x="14" y="42" width="36" height="4" rx="2" fill="url(#fog3d_stripe)" />
          <rect x="20" y="49" width="24" height="3.5" rx="1.75" fill="url(#fog3d_stripe)" />
        </g>
      </svg>
    );
  }

  // 5. Ploaie / Burniță 3D ((51-67), (80-82))
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return (
      <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="rain3d_cloud_body" cx="35%" cy="25%" r="70%">
            <stop offset="0%" stopColor="#F1F5F9" />
            <stop offset="40%" stopColor="#CBD5E1" />
            <stop offset="75%" stopColor="#64748B" />
            <stop offset="100%" stopColor="#334155" />
          </radialGradient>
          <linearGradient id="rain3d_drop_grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#A5F3FC" />
            <stop offset="50%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
          <filter id="rain3d_shadow" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="5" stdDeviation="4.5" floodColor="#0F172A" floodOpacity="0.45" />
          </filter>
        </defs>
        <g filter="url(#rain3d_shadow)">
          <rect x="15" y="22" width="34" height="15" rx="7.5" fill="url(#rain3d_cloud_body)" />
          <circle cx="22" cy="25" r="11" fill="url(#rain3d_cloud_body)" />
          <circle cx="42" cy="26" r="9" fill="url(#rain3d_cloud_body)" />
          <circle cx="31" cy="17" r="13.5" fill="url(#rain3d_cloud_body)" />
          <path d="M25 6c3-2 8-2 11 1" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
          <g transform="translate(0, 2)">
            <path d="M19 41c0 2.2-1.8 4-4 4s-4-1.8-4-4c0-2.8 4-8 4-8s4 5.2 4 8z" fill="url(#rain3d_drop_grad)" filter="drop-shadow(0 2px 4px rgba(2,132,199,0.5))" />
            <circle cx="14" cy="40" r="1" fill="#FFFFFF" opacity="0.85" />
            <path d="M33 41c0 2.2-1.8 4-4 4s-4-1.8-4-4c0-2.8 4-8 4-8s4 5.2 4 8z" fill="url(#rain3d_drop_grad)" filter="drop-shadow(0 2px 4px rgba(2,132,199,0.5))" />
            <circle cx="28" cy="40" r="1" fill="#FFFFFF" opacity="0.85" />
            <path d="M47 41c0 2.2-1.8 4-4 4s-4-1.8-4-4c0-2.8 4-8 4-8s4 5.2 4 8z" fill="url(#rain3d_drop_grad)" filter="drop-shadow(0 2px 4px rgba(2,132,199,0.5))" />
            <circle cx="42" cy="40" r="1" fill="#FFFFFF" opacity="0.85" />
          </g>
        </g>
      </svg>
    );
  }

  // 6. Ninsoare 3D (71-77, 85-86)
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return (
      <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="snow3d_cloud_body" cx="35%" cy="25%" r="70%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="45%" stopColor="#E0F2FE" />
            <stop offset="80%" stopColor="#BAE6FD" />
            <stop offset="100%" stopColor="#7DD3FC" />
          </radialGradient>
          <radialGradient id="snow3d_ball" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="60%" stopColor="#BAE6FD" />
            <stop offset="100%" stopColor="#38BDF8" />
          </radialGradient>
          <filter id="snow3d_shadow" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="5" stdDeviation="4.5" floodColor="#0369A1" floodOpacity="0.35" />
          </filter>
        </defs>
        <g filter="url(#snow3d_shadow)">
          <rect x="15" y="22" width="34" height="15" rx="7.5" fill="url(#snow3d_cloud_body)" />
          <circle cx="22" cy="25" r="11" fill="url(#snow3d_cloud_body)" />
          <circle cx="42" cy="26" r="9" fill="url(#snow3d_cloud_body)" />
          <circle cx="31" cy="17" r="13.5" fill="url(#snow3d_cloud_body)" />
          <path d="M25 6c3-2 8-2 11 1" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
          <circle cx="18" cy="44" r="3.5" fill="url(#snow3d_ball)" />
          <circle cx="32" cy="47" r="4" fill="url(#snow3d_ball)" />
          <circle cx="46" cy="44" r="3.5" fill="url(#snow3d_ball)" />
        </g>
      </svg>
    );
  }

  // 7. Furtună / Fulgere 3D (95+)
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="storm3d_cloud_dark" cx="35%" cy="25%" r="75%">
          <stop offset="0%" stopColor="#64748B" />
          <stop offset="45%" stopColor="#334155" />
          <stop offset="85%" stopColor="#1E293B" />
          <stop offset="100%" stopColor="#0F172A" />
        </radialGradient>
        <linearGradient id="storm3d_bolt_grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="50%" stopColor="#FDE047" />
          <stop offset="100%" stopColor="#EAB308" />
        </linearGradient>
        <filter id="storm3d_shadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#000000" floodOpacity="0.55" />
        </filter>
        <filter id="storm3d_bolt_glow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#FACC15" floodOpacity="0.85" />
        </filter>
      </defs>
      <g filter="url(#storm3d_shadow)">
        <rect x="15" y="20" width="34" height="15" rx="7.5" fill="url(#storm3d_cloud_dark)" />
        <circle cx="22" cy="23" r="11" fill="url(#storm3d_cloud_dark)" />
        <circle cx="42" cy="24" r="9" fill="url(#storm3d_cloud_dark)" />
        <circle cx="31" cy="15" r="13.5" fill="url(#storm3d_cloud_dark)" />
        <path d="M25 4c3-2 8-2 11 1" stroke="#94A3B8" strokeWidth="2.2" strokeLinecap="round" opacity="0.6" />
        <polygon
          points="35,26 26,39 33,39 28,53 42,36 35,36"
          fill="url(#storm3d_bolt_grad)"
          filter="url(#storm3d_bolt_glow)"
        />
      </g>
    </svg>
  );
}

function getRomanianDayName(dateStr: string, index: number): { dayName: string; shortDate: string } {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    const days = ["Duminică", "Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă"];
    const months = [
      "ian.",
      "feb.",
      "mar.",
      "apr.",
      "mai",
      "iun.",
      "iul.",
      "aug.",
      "sep.",
      "oct.",
      "noi.",
      "dec.",
    ];
    let dayName = days[dateObj.getDay()] || "";
    if (index === 0) dayName = "Mâine";
    const shortDate = `${d} ${months[m - 1] || ""}`;
    return { dayName, shortDate };
  } catch {
    return { dayName: "Ziua " + (index + 1), shortDate: "" };
  }
}

function AsteriskIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5.94" y1="8.5" x2="18.06" y2="15.5" />
      <line x1="5.94" y1="15.5" x2="18.06" y2="8.5" />
    </svg>
  );
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
  isSuperadmin = false,
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
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=6`
        );
        const data = await res.json();
        if (isMounted && data.current) {
          const forecast: DayForecast[] = [];
          if (data.daily && Array.isArray(data.daily.time)) {
            for (let i = 1; i <= 5 && i < data.daily.time.length; i++) {
              const dateStr = data.daily.time[i];
              const { dayName, shortDate } = getRomanianDayName(dateStr, i - 1);
              const code = data.daily.weather_code?.[i] ?? 0;
              forecast.push({
                date: dateStr,
                dayName,
                shortDate,
                weatherCode: code,
                condition: getWeatherLabel(code),
                tempMax: Math.round(data.daily.temperature_2m_max?.[i] ?? data.current.temperature_2m),
                tempMin: Math.round(data.daily.temperature_2m_min?.[i] ?? data.current.temperature_2m),
                precipProb: data.daily.precipitation_probability_max?.[i] != null ? Math.round(data.daily.precipitation_probability_max[i]) : undefined,
              });
            }
          }

          setWeather({
            temp: Math.round(data.current.temperature_2m),
            city: cityName || "București",
            condition: getWeatherLabel(data.current.weather_code),
            weatherCode: data.current.weather_code,
            humidity: data.current.relative_humidity_2m != null ? Math.round(data.current.relative_humidity_2m) : undefined,
            windSpeed: data.current.wind_speed_10m != null ? Math.round(data.current.wind_speed_10m) : undefined,
            tempMax: data.daily?.temperature_2m_max?.[0] != null ? Math.round(data.daily.temperature_2m_max[0]) : undefined,
            tempMin: data.daily?.temperature_2m_min?.[0] != null ? Math.round(data.daily.temperature_2m_min[0]) : undefined,
            forecast,
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

  // Chei storage pentru blocare la 3 incercari gresite
  const lockoutStorageKey = `smart_invoice_pin_lockout_${tenantId || "default"}`;
  const attemptsStorageKey = `smart_invoice_pin_failed_attempts_${tenantId || "default"}`;

  const [lockoutRemaining, setLockoutRemaining] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(`smart_invoice_pin_lockout_${tenantId || "default"}`);
      if (stored) {
        const remaining = Math.ceil((parseInt(stored, 10) - Date.now()) / 1000);
        return remaining > 0 ? remaining : 0;
      }
    } catch {}
    return 0;
  });

  // Timer pentru expirare blocare 1 minut (Apple security timeout)
  useEffect(() => {
    if (lockoutRemaining <= 0) return;

    const timer = setInterval(() => {
      setLockoutRemaining(prev => {
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
    if (!showResetForm && lockoutRemaining <= 0) {
      inputRef.current?.focus();
    }
  }, [showResetForm, lockoutRemaining]);

  const submitPin = async (candidatePin: string) => {
    if (lockoutRemaining > 0) {
      setErrorMsg(`Accesul este blocat temporar. Reîncercați în ${lockoutRemaining} secunde.`);
      return;
    }
    if (candidatePin.length !== 4) return;
    if (verifyPinMutation.isPending) return;

    setErrorMsg("");

    try {
      await verifyPinMutation.mutateAsync({ pin: candidatePin });
      try {
        localStorage.removeItem(lockoutStorageKey);
        localStorage.removeItem(attemptsStorageKey);
      } catch {}
      try {
        sessionStorage.setItem("smart_invoice_pin_session_unlocked", String(tenantId || "default"));
        sessionStorage.setItem(`smart_invoice_unlocked_pin_${tenantId || "default"}`, "true");
      } catch {}
      toast.success("Acces deblocat cu succes.");
      onUnlocked();
    } catch (err: any) {
      const currentAttempts = (() => {
        try {
          const count = parseInt(localStorage.getItem(attemptsStorageKey) || "0", 10) + 1;
          localStorage.setItem(attemptsStorageKey, String(count));
          return count;
        } catch {
          return 1;
        }
      })();

      setPin("");
      setIsShaking(true);
      setTimeout(() => {
        setIsShaking(false);
      }, 550);

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
    } else if (!pin.trim()) {
      setErrorMsg("Introduceți codul PIN.");
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 550);
    } else {
      setErrorMsg("Codul PIN trebuie să conțină exact 4 cifre.");
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 550);
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

  const switchTenantMutation = trpc.tenants.switchTenant.useMutation();
  const [isSwitching, setIsSwitching] = useState(false);

  const handleSwitchToTrade = async () => {
    try {
      setIsSwitching(true);
      const res = await switchTenantMutation.mutateAsync({ tenantId: 1 });
      if (res?.token) {
        localStorage.setItem("authToken", res.token);
      }
      sessionStorage.clear();
      window.location.reload();
    } catch (err: any) {
      toast.error(err?.message || "Eroare la comutarea firmei.");
      setIsSwitching(false);
    }
  };

  const effectiveThemeColor = themeColor || "#2563eb";
  const currentWallpaper = CHROMECAST_WALLPAPERS[bgIndex] || CHROMECAST_WALLPAPERS[0];

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

      {/* Fereastră Unică stil Apple (Ceas + Securitate Firmă) Centrată fără contur strident */}
      <div
        className={`w-full max-w-md z-10 my-auto py-6 bg-black/40 dark:bg-black/55 backdrop-blur-3xl rounded-[36px] shadow-[0_30px_70px_rgba(0,0,0,0.6)] p-6 sm:p-8 space-y-6 text-white transition-all ${
          isShaking ? "animate-apple-shake ring-2 ring-rose-500/50" : "animate-in fade-in zoom-in-95 duration-300"
        }`}
      >
          {/* Header Ceas stil Apple */}
          <div className="flex flex-col items-center justify-center text-center pb-5 border-b border-white/[0.04] select-none">
            {/* Rândul Apple: Data */}
            <div className="flex items-center justify-center text-white/90 text-sm sm:text-base font-medium tracking-wide mb-1.5">
              <span>{formatAppleDate(currentTime)}</span>
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
                  <div
                    className={`w-24 h-24 sm:w-28 sm:h-28 rounded-3xl shadow-2xl p-3 flex items-center justify-center overflow-hidden transition-all ${
                      effectiveLogoBg
                        ? "border border-white/20"
                        : "bg-white border border-white/40"
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

            {lockoutRemaining > 0 ? (
              <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-500/40 flex items-center justify-between gap-3 text-amber-200 text-xs font-semibold animate-pulse">
                <div className="flex items-center gap-2">
                  <Timer className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>Blocat temporar (3 încercări greșite)</span>
                </div>
                <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  {lockoutRemaining}s
                </span>
              </div>
            ) : errorMsg ? (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 flex items-center gap-2 text-rose-200 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            ) : null}

            <form onSubmit={handleUnlock} className="space-y-4" autoComplete="off">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5 text-center">
                  Cod PIN de acces (4 cifre)
                </label>
                <div
                  onClick={() => {
                    if (lockoutRemaining <= 0) inputRef.current?.focus();
                  }}
                  className={`relative w-full h-12 flex items-center justify-center bg-white/[0.06] dark:bg-black/40 rounded-2xl transition-all ${
                    lockoutRemaining > 0
                      ? "opacity-50 cursor-not-allowed border border-amber-500/30"
                      : isInputFocused
                      ? "border border-white/20 bg-white/[0.1] cursor-text"
                      : "border border-white/[0.05] cursor-text"
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
                    disabled={lockoutRemaining > 0}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-form-type="other"
                    maxLength={4}
                    value={pin}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => setIsInputFocused(false)}
                    onChange={e => {
                      if (lockoutRemaining > 0 || verifyPinMutation.isPending) return;
                      const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 4);
                      setPin(val);
                      if (errorMsg) setErrorMsg("");
                      if (val.length === 4) {
                        submitPin(val);
                      }
                    }}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-text disabled:cursor-not-allowed"
                    autoFocus
                  />
                  {/* Exact 4 steluțe SVG geometrice perfect centrate pe înălțime și lățime (fără emoji) */}
                  <div className="flex items-center justify-center gap-4 select-none pointer-events-none">
                    {[0, 1, 2, 3].map(i => {
                      const isFilled = i < pin.length;
                      return (
                        <div
                          key={i}
                          className={`flex items-center justify-center w-6 h-6 transition-all duration-150 ${
                            isFilled
                              ? "text-white scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]"
                              : "text-white/30"
                          }`}
                        >
                          <AsteriskIcon className="w-4 h-4" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={verifyPinMutation.isPending || pin.length !== 4 || lockoutRemaining > 0}
                style={{ backgroundColor: lockoutRemaining > 0 ? "#475569" : effectiveThemeColor }}
                className="w-full h-11 rounded-2xl hover:opacity-90 disabled:opacity-50 text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2"
              >
                {verifyPinMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : lockoutRemaining > 0 ? (
                  <>
                    <Timer className="w-4 h-4 animate-spin" />
                    <span>Reîncercați în {lockoutRemaining}s</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Deblochează accesul</span>
                  </>
                )}
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

            {tenantId && tenantId !== 1 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSwitchToTrade}
                  disabled={isSwitching}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {isSwitching ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Building2 className="w-3.5 h-3.5" />
                  )}
                  <span>Comută la Trade Invest Network</span>
                </button>
              </div>
            )}

            {isSuperadmin && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => onUnlocked()}
                  className="w-full py-2 px-4 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Acces Administrator (Bypass PIN)</span>
                </button>
              </div>
            )}
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

      {/* Widget Vreme stil Apple Weather: fundal animat în funcție de vreme, temperatură mare subțire, listă prognoză cu bare de interval */}
      {weather && (() => {
        const c = weather.weatherCode;
        const kind: "clear" | "cloud" | "rain" | "snow" | "storm" =
          c === 0 || c === 1 ? "clear"
          : c === 2 || c === 3 || c === 45 || c === 48 ? "cloud"
          : (c >= 71 && c <= 77) || c === 85 || c === 86 ? "snow"
          : c >= 95 ? "storm"
          : "rain";
        const bg: Record<string, string> = {
          clear: "linear-gradient(180deg,#2b6fb8 0%,#5aa3dc 100%)",
          cloud: "linear-gradient(180deg,#4a5666 0%,#6f7b8b 100%)",
          rain: "linear-gradient(180deg,#2f3947 0%,#4a5666 100%)",
          storm: "linear-gradient(180deg,#232a36 0%,#3b4453 100%)",
          snow: "linear-gradient(180deg,#5b6b80 0%,#8fa0b5 100%)",
        };
        const days = weather.forecast || [];
        const allMin = Math.min(weather.tempMin ?? weather.temp, ...days.map(d => d.tempMin));
        const allMax = Math.max(weather.tempMax ?? weather.temp, ...days.map(d => d.tempMax));
        const span = Math.max(1, allMax - allMin);
        const fmt = (n: number) => `${n}°`;
        const rows = [
          ...(weather.tempMin !== undefined && weather.tempMax !== undefined
            ? [{ key: "today", name: "Azi", code: c, min: weather.tempMin, max: weather.tempMax, prob: undefined as number | undefined }]
            : []),
          ...days.map((d, i) => ({ key: d.date || String(i), name: (d.dayName || "").slice(0, 3), code: d.weatherCode, min: d.tempMin, max: d.tempMax, prob: d.precipProb })),
        ];
        return (
          <div className="fixed top-6 right-5 sm:top-7 sm:right-7 z-50 w-[232px] select-none animate-in fade-in slide-in-from-top-2 duration-300">
            <style>{`
              @keyframes wxDrift { 0% { transform: translateX(-30%); } 100% { transform: translateX(30%); } }
              @keyframes wxFall { 0% { transform: translateY(-20px); opacity: 0; } 15% { opacity: .8; } 100% { transform: translateY(300px); opacity: 0; } }
              @keyframes wxSnow { 0% { transform: translate(0,-10px); opacity: 0; } 15% { opacity: .9; } 100% { transform: translate(14px,300px); opacity: 0; } }
              @keyframes wxPulse { 0%,100% { opacity: .55; transform: scale(1); } 50% { opacity: .9; transform: scale(1.08); } }
              @keyframes wxFlash { 0%,92%,100% { opacity: 0; } 94% { opacity: .5; } 96% { opacity: 0; } 98% { opacity: .35; } }
            `}</style>

            {/* Iconița 3D iese din card (colț dreapta-sus) */}
            <div className="absolute -top-6 -right-4 z-30 pointer-events-none -rotate-3">
              <Weather3DIcon code={c} className="w-14 h-14 drop-shadow-[0_10px_14px_rgba(0,0,0,0.55)]" />
            </div>

            <div
              className="relative rounded-[28px] overflow-hidden shadow-[0_18px_44px_rgba(0,0,0,0.5)] text-white"
              style={{ background: bg[kind] }}
            >
              {/* Fundal animat */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {kind === "clear" && (
                  <div className="absolute -top-10 -left-10 w-44 h-44 rounded-full bg-yellow-200/60 blur-2xl" style={{ animation: "wxPulse 5s ease-in-out infinite" }} />
                )}
                {(kind === "cloud" || kind === "rain" || kind === "storm" || kind === "snow") && (
                  <>
                    <div className="absolute top-2 left-0 w-56 h-14 rounded-full bg-white/25 blur-xl" style={{ animation: "wxDrift 14s ease-in-out infinite alternate" }} />
                    <div className="absolute top-14 -left-6 w-48 h-12 rounded-full bg-white/15 blur-xl" style={{ animation: "wxDrift 19s ease-in-out infinite alternate-reverse" }} />
                    <div className="absolute top-24 left-4 w-52 h-12 rounded-full bg-white/10 blur-xl" style={{ animation: "wxDrift 24s ease-in-out infinite alternate" }} />
                  </>
                )}
                {(kind === "rain" || kind === "storm") &&
                  Array.from({ length: 16 }).map((_, i) => (
                    <span
                      key={i}
                      className="absolute top-0 w-px h-3 bg-sky-100/70 rounded-full"
                      style={{ left: `${(i * 37) % 100}%`, animation: `wxFall ${0.9 + (i % 5) * 0.25}s linear ${(i % 7) * 0.2}s infinite` }}
                    />
                  ))}
                {kind === "snow" &&
                  Array.from({ length: 14 }).map((_, i) => (
                    <span
                      key={i}
                      className="absolute top-0 w-1 h-1 bg-white rounded-full"
                      style={{ left: `${(i * 41) % 100}%`, animation: `wxSnow ${3 + (i % 5) * 0.7}s linear ${(i % 6) * 0.5}s infinite` }}
                    />
                  ))}
                {kind === "storm" && <div className="absolute inset-0 bg-white" style={{ animation: "wxFlash 7s linear infinite" }} />}
              </div>

              <div className="relative z-10 px-4 pt-4 pb-3">
                {/* Antet central, ca în Apple Weather */}
                <div className="text-center">
                  <p className="text-[9px] font-semibold tracking-[0.14em] uppercase text-white/70 leading-none">
                    Live
                  </p>
                  <h3 className="text-[17px] font-medium leading-tight mt-1 [text-shadow:0_1px_6px_rgba(0,0,0,0.25)] truncate">
                    {weather.city}
                  </h3>
                  <div className="text-[64px] font-extralight leading-[1] tracking-tight mt-0.5 [text-shadow:0_2px_10px_rgba(0,0,0,0.2)]">
                    {weather.temp}°
                  </div>
                  <p className="text-[13px] font-medium text-white/90 leading-tight mt-0.5">{weather.condition}</p>
                  {weather.tempMax !== undefined && weather.tempMin !== undefined && (
                    <p className="text-[12px] font-medium text-white/85 leading-tight mt-0.5">
                      H:{weather.tempMax}° &nbsp;L:{weather.tempMin}°
                    </p>
                  )}
                </div>

                {/* Umiditate & vânt */}
                {(weather.humidity !== undefined || weather.windSpeed !== undefined) && (
                  <div className="flex items-center justify-center gap-4 text-[10px] text-white/80 mt-2">
                    {weather.humidity !== undefined && (
                      <span className="flex items-center gap-1"><Droplets className="w-3 h-3 text-sky-200" />{weather.humidity}%</span>
                    )}
                    {weather.windSpeed !== undefined && (
                      <span className="flex items-center gap-1"><Wind className="w-3 h-3 text-teal-200" />{weather.windSpeed} km/h</span>
                    )}
                  </div>
                )}

                {/* Card sticlă: prognoză cu bare de interval */}
                {rows.length > 0 && (
                  <div className="mt-3 rounded-2xl bg-white/15 backdrop-blur-xl border border-white/10 px-2.5 py-1">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-white/60 py-1">Prognoză</p>
                    {rows.map((r, idx) => {
                      const left = ((r.min - allMin) / span) * 100;
                      const width = Math.max(8, ((r.max - r.min) / span) * 100);
                      return (
                        <div key={r.key} className={`flex items-center gap-1.5 py-1 ${idx > 0 ? "border-t border-white/10" : "border-t border-white/10"}`}>
                          <span className="w-8 text-[11px] font-medium text-white shrink-0">{r.name}</span>
                          <div className="w-7 flex flex-col items-center shrink-0">
                            <Weather3DIcon code={r.code} className="w-4 h-4" />
                            {r.prob !== undefined && r.prob >= 15 && (
                              <span className="text-[8px] font-semibold text-sky-300 leading-none mt-px">{r.prob}%</span>
                            )}
                          </div>
                          <span className="w-6 text-right text-[11px] text-white/55 shrink-0">{fmt(r.min)}</span>
                          <div className="relative flex-1 h-1 rounded-full bg-black/20 min-w-0">
                            <div
                              className="absolute top-0 h-1 rounded-full bg-gradient-to-r from-cyan-300 to-teal-300"
                              style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }}
                            />
                          </div>
                          <span className="w-6 text-[11px] font-medium text-white shrink-0">{fmt(r.max)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

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
