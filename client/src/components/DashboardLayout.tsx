// DashboardLayout — Slate Command Center + Auth Integration
// Fixed sidebar (240px) + main content area
// Design: slate-900 sidebar, white content, blue-600 accents

import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { FacturaSpvLogo } from "@/components/FacturaSpvLogo";
import {
  LayoutDashboard,
  FileText,
  FileOutput,
  Users,
  Settings,
  LogOut,
  ChevronRight,
  ArrowLeft,
  Menu,
  MapPin,
  Search,
  Plus,
  Archive,
  ShieldCheck,
  Inbox,
  FileSignature,
  Globe2,
  Bell,
  AlertCircle,
  RefreshCcw,
  Plug,
  TrendingUp,
  ClipboardCheck,
  PackageOpen,
  Package,
  Globe,
  Building2,
  Moon,
  Sun,
  X,
  Mail,
  UtensilsCrossed,
  Truck,
  BookOpen,
  ShoppingBag,
  Grid3X3,
  ChefHat,
  Settings2,
  Box,
  MonitorSmartphone,
  Key,
  Database,
  Coins,
  Lock,
  User,
  Check,
  Maximize2,
  Minimize2,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { BnrExchangeRateHeader } from "./BnrExchangeRateHeader";
import { CompanyPinLockModal } from "./CompanyPinLockModal";

function getTenantDisplayMeta(t: any, fallbackEmail?: string) {
  let s: any = {};
  try {
    if (t?.settings) {
      s = typeof t.settings === "string" ? JSON.parse(t.settings) : t.settings;
    }
  } catch {}
  const cleanCode = String(t?.cui || "").replace(/^RO/i, "").trim();
  const isPf = s?.entityType === "pf" || /^\d{13}$/.test(cleanCode);
  const subtitle = cleanCode
    ? isPf
      ? `CNP ${cleanCode}`
      : `RO${cleanCode}`
    : isPf
      ? "Persoană Fizică"
      : t?.email || fallbackEmail || "";
  return { isPf, cleanCode, subtitle };
}


const LOGO_URL = "/gettsapp_logo_ver2.png";
const APP_NAME = "Smart Invoice";
const APP_SUBTITLE = "Refactura.ro";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  badge?: number;
  section?: string;
  subItems?: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  }[];
}

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    section: "principal",
  },
  {
    href: "/facturi",
    label: "Facturi",
    icon: FileText,
    section: "facturare",
    subItems: [
      { href: "/facturi", label: "Evidență Facturi", icon: FileText },
      { href: "/facturi-emise-nou", label: "Facturi Emise", icon: FileOutput },
      { href: "/devize", label: "Devize de Lucrări", icon: FileText },
      { href: "/re-facturi", label: "Re-Facturi", icon: FileOutput },
      { href: "/arhiva-facturi", label: "Arhivă Facturi", icon: Archive },
      { href: "/jurnal-spv", label: "Jurnal SPV", icon: ShieldCheck },
      { href: "/evidenta-emailuri", label: "Evidență Emailuri", icon: Mail },
    ],
  },
  {
    href: "/spv",
    label: "SPV ANAF",
    icon: Inbox,
    section: "facturare",
  },
  {
    href: "/contracte",
    label: "Contracte & Documente",
    icon: FileSignature,
    section: "documente",
    subItems: [
      { href: "/contracte", label: "Bibliotecă Contracte", icon: FileSignature },
      { href: "/contracte/new", label: "Adaugă / Încarcă Document", icon: Plus },
    ],
  },
  {
    href: "/nir",
    label: "Gestiune",
    icon: PackageOpen,
    section: "gestiune",
    subItems: [
      { href: "/inventory", label: "Inventar (Stoc)", icon: Package },
      { href: "/nir", label: "NIR", icon: ClipboardCheck },
      { href: "/bonuri-consum", label: "Bonuri Consum", icon: PackageOpen },
      { href: "/devize", label: "Devize", icon: FileText },
      {
        href: "/devize/catalog",
        label: "Catalog Nomenclator",
        icon: PackageOpen,
      },
    ],
  },
  {
    href: "/rapoarte",
    label: "Rapoarte",
    icon: TrendingUp,
    section: "analize",
  },
  {
    href: "/curs-valutar",
    label: "Curs Valutar",
    icon: Coins,
    section: "analize",
  },
  { href: "/clienti", label: "Clienți", icon: Users, section: "gestiune" },
  { href: "/integrari", label: "Integrări", icon: Plug, section: "gestiune" },
  { href: "/saga", label: "SAGA", icon: Database, section: "gestiune" },
  { href: "/saga-sync", label: "Sincronizare SAGA", icon: RefreshCcw, section: "gestiune" },
  { href: "/setari?tab=accountant", label: "Portal Contabil", icon: ShieldCheck, section: "gestiune" },
  { href: "/api-keys", label: "API Keys", icon: Key, section: "gestiune" },
  {
    href: "/centre-cost",
    label: "Centre de Cost",
    icon: MapPin,
    section: "gestiune",
  },

  { href: "/setari", label: "Setări", icon: Settings, section: "cont" },
];

const adminNavItems: NavItem[] = [
  {
    href: "/super-admin",
    label: "Super Admin",
    icon: ShieldCheck,
    section: "admin",
  },
  { href: "/landing", label: "Landing Page", icon: Globe2, section: "admin" },
];

const mobileNavItems = [
  { href: "/dashboard", label: "Acasă", icon: LayoutDashboard },
  { href: "/facturi", label: "Facturi", icon: FileText },
  { href: "/contracte", label: "Contracte", icon: FileSignature },
  { href: "/nir", label: "Gestiune", icon: PackageOpen },

  { href: "/setari", label: "Setări", icon: Settings },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };
  const [forceMainMenu, setForceMainMenu] = useState(false);
  const [location, setLocation] = useLocation();
  const searchString = useSearch();
  const { theme, toggleTheme } = useTheme();
  const { user, loading, logout } = useAuth();

  const { data: currentTenant } = trpc.tenants.current.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: entityPair } = trpc.tenants.getEntityPair.useQuery(undefined, {
    enabled: !!user,
  });

  const targetSwitchTypeRef = useRef<"pj" | "pf" | null>(null);

  const applyTenantSessionAndReload = (
    token?: string,
    successMsg?: string,
    targetTenantId?: number,
    targetType?: "pj" | "pf" | null
  ) => {
    if (token) {
      localStorage.setItem("authToken", token);
    }
    try {
      localStorage.removeItem("tenant-theme-color");
      const savedPinEntries: [string, string][] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith("smart_invoice_unlocked_pin_")) {
          const v = sessionStorage.getItem(k);
          if (v) savedPinEntries.push([k, v]);
        }
      }
      sessionStorage.clear();
      for (const [k, v] of savedPinEntries) {
        sessionStorage.setItem(k, v);
      }
      if (
        targetTenantId &&
        sessionStorage.getItem(`smart_invoice_unlocked_pin_${targetTenantId}`) === "true"
      ) {
        sessionStorage.setItem("smart_invoice_pin_session_unlocked", String(targetTenantId));
      }
    } catch {}
    if (successMsg) {
      toast.success(successMsg);
    }
    if (window.location.pathname === "/setari" && targetType) {
      window.location.href = targetType === "pf" ? "/setari?tab=pf" : "/setari?tab=company";
      return;
    }
    window.location.reload();
  };

  const switchTenantMutation = trpc.tenants.switchTenant.useMutation({
    onSuccess: (data) => {
      const targetType = targetSwitchTypeRef.current;
      targetSwitchTypeRef.current = null;
      applyTenantSessionAndReload(
        data?.token,
        "Profilul activ a fost schimbat.",
        data?.tenantId,
        targetType
      );
    },
    onError: (err: any) => {
      targetSwitchTypeRef.current = null;
      toast.error(err?.message || "Eroare la schimbarea profilului.");
    },
  });

  const {
    data: pinStatus,
    isLoading: isPinStatusLoading,
    isFetched: isPinStatusFetched,
  } = trpc.tenants.getPinStatus.useQuery(undefined, {
    enabled: !!user,
  });

  const effectiveTenantId =
    pinStatus?.tenantId || (user as any)?.tenantId || currentTenant?.id || 1;

  const checkIsUnlocked = (tId: string | number) => {
    try {
      return (
        sessionStorage.getItem("smart_invoice_pin_session_unlocked") === String(tId) ||
        sessionStorage.getItem(`smart_invoice_unlocked_pin_${tId}`) === "true"
      );
    } catch {
      return false;
    }
  };

  const [isPinUnlocked, setIsPinUnlocked] = useState<boolean>(() => {
    const tid = (user as any)?.tenantId || 1;
    return checkIsUnlocked(tid);
  });

  useEffect(() => {
    if (effectiveTenantId) {
      setIsPinUnlocked(checkIsUnlocked(effectiveTenantId));
    }
  }, [effectiveTenantId]);

  const handleLockScreen = (customToastMsg?: string) => {
    try {
      sessionStorage.removeItem("smart_invoice_pin_session_unlocked");
      if (effectiveTenantId) {
        sessionStorage.removeItem(`smart_invoice_unlocked_pin_${effectiveTenantId}`);
      }
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (
          k &&
          (k.startsWith("smart_invoice_unlocked_pin") ||
            k === "smart_invoice_pin_session_unlocked")
        ) {
          sessionStorage.removeItem(k);
        }
      }
    } catch {}
    setIsPinUnlocked(false);
    if (customToastMsg) {
      toast.info(customToastMsg);
    } else {
      toast.info("Ecranul a fost blocat cu PIN.");
    }
  };

  // Scurtătură tastatură pentru blocare ecran (Ctrl+L sau Cmd+Alt+L / Cmd+Shift+L)
  useEffect(() => {
    if (!pinStatus?.pinEnabled || !isPinUnlocked) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isLockCombo =
        (e.ctrlKey && e.key.toLowerCase() === "l") ||
        (e.metaKey && (e.altKey || e.shiftKey) && e.key.toLowerCase() === "l") ||
        (e.ctrlKey && e.altKey && e.key.toLowerCase() === "l");

      if (isLockCombo) {
        e.preventDefault();
        e.stopPropagation();
        handleLockScreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pinStatus?.pinEnabled, isPinUnlocked, effectiveTenantId]);

  // Auto-blocare automată după 10 minute de inactivitate (600.000 ms)
  useEffect(() => {
    if (!pinStatus?.pinEnabled || !isPinUnlocked) return;

    const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minute
    const activityKey = `smart_invoice_last_act_${effectiveTenantId}`;

    const recordActivity = () => {
      try {
        localStorage.setItem(activityKey, String(Date.now()));
      } catch {}
    };

    // Marcăm activitatea inițială la intrare
    recordActivity();

    // Throttling la 3 secunde pentru înregistrarea mișcărilor/tastării
    let throttleTimer: NodeJS.Timeout | null = null;
    const onUserActivity = () => {
      if (!throttleTimer) {
        throttleTimer = setTimeout(() => {
          throttleTimer = null;
          recordActivity();
        }, 3000);
      }
    };

    const activityEvents = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    activityEvents.forEach(evt => {
      window.addEventListener(evt, onUserActivity, { passive: true });
    });

    const checkInactivity = () => {
      try {
        const lastActStr = localStorage.getItem(activityKey);
        const lastAct = lastActStr ? parseInt(lastActStr, 10) : Date.now();
        if (Date.now() - lastAct >= INACTIVITY_TIMEOUT_MS) {
          handleLockScreen("Ecranul a fost blocat automat după 10 minute de inactivitate.");
        }
      } catch {}
    };

    // Verificare periodică la fiecare 10 secunde
    const intervalId = setInterval(checkInactivity, 10000);

    // Verificare imediată la revenire în tab sau trezire din sleep
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        checkInactivity();
      }
    };

    // Sincronizare între tab-uri dacă ecranul a fost blocat în alt tab
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "smart_invoice_pin_session_unlocked" && !e.newValue) {
        setIsPinUnlocked(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      if (throttleTimer) clearTimeout(throttleTimer);
      clearInterval(intervalId);
      activityEvents.forEach(evt => {
        window.removeEventListener(evt, onUserActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [pinStatus?.pinEnabled, isPinUnlocked, effectiveTenantId]);

  const parsedTenantSettings = useMemo(() => {
    if (!currentTenant?.settings) return null;
    try {
      return typeof currentTenant.settings === "string"
        ? JSON.parse(currentTenant.settings)
        : currentTenant.settings;
    } catch {
      return null;
    }
  }, [currentTenant?.settings]);

  const themeColor =
    parsedTenantSettings?.themeColor ||
    localStorage.getItem("tenant-theme-color") ||
    "#16a34a";

  useEffect(() => {
    if (themeColor) {
      document.documentElement.style.setProperty("--primary", themeColor);
      document.documentElement.style.setProperty("--sidebar-primary", themeColor);
      document.documentElement.style.setProperty("--color-primary", themeColor);
      document.documentElement.style.setProperty("--tenant-theme-color", themeColor);
      localStorage.setItem("tenant-theme-color", themeColor);
    }
  }, [themeColor]);

  const companyLogo = parsedTenantSettings?.logoBase64 || (user as any)?.tenantLogo || "";
  const companyName = (user as any)?.tenantName || currentTenant?.name || user?.name || "Companie";
  const activeProfileMeta = useMemo(() => {
    const meta = getTenantDisplayMeta(
      currentTenant || {
        cui: (user as any)?.tenantCUI,
        settings: (user as any)?.tenantEntityType
          ? { entityType: (user as any).tenantEntityType }
          : null,
        email: user?.email,
      },
      user?.email || ""
    );
    const isPf =
      meta.isPf || (user as any)?.tenantEntityType === "pf";
    const subtitle = meta.cleanCode
      ? isPf
        ? `CNP ${meta.cleanCode}`
        : `RO${meta.cleanCode}`
      : isPf
        ? "Persoană Fizică"
        : user?.email || "";
    return { ...meta, isPf, subtitle };
  }, [currentTenant, user]);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setLogoError(false);
  }, [companyLogo]);

  // Count-uri reale din DB (zero hardcodat)
  const { data: receivedInvoices = [] } = trpc.invoices.list.useQuery(undefined, {
    enabled: !!user,
  });
  const pendingCount = (receivedInvoices as any[]).filter(
    (i: any) => i.status === "pending"
  ).length;

  // Redirect direct la login dacă nu e autentificat
  useEffect(() => {
    if (!loading && !user) {
      localStorage.removeItem("authToken");
      setLocation("/login");
    }
  }, [loading, user, setLocation]);

  // Loading auth state SAU așteptăm răspunsul getPinStatus de la server
  // Până când getPinStatus este complet încărcat, blocăm randarea oricăror date (FAIL-CLOSED)
  if (loading || (!!user && !isPinStatusFetched)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin w-8 h-8 border-4 border-slate-200 dark:border-slate-700 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isUnlockedCurrent = checkIsUnlocked(effectiveTenantId);

  // Superadmin nu este blocat de PIN-ul unui client dacă vizitează o altă firmă
  const shouldBlockWithPin =
    pinStatus?.pinEnabled &&
    (!isPinUnlocked || !isUnlockedCurrent) &&
    !(user?.role === "superadmin" && effectiveTenantId !== 1);

  if (shouldBlockWithPin) {
    return (
      <CompanyPinLockModal
        companyName={pinStatus.companyName || companyName}
        companyLogo={pinStatus.logoUrl || companyLogo}
        logoBgColor={
          pinStatus?.logoBgColor ||
          parsedTenantSettings?.logoBgColor ||
          (pinStatus?.logoHasBackground || parsedTenantSettings?.logoHasBackground ? "#0f172a" : undefined)
        }
        logoHasBackground={Boolean(pinStatus?.logoHasBackground ?? parsedTenantSettings?.logoHasBackground)}
        themeColor={pinStatus?.themeColor || themeColor}
        userFullName={pinStatus?.userFullName || user?.name || ""}
        userPhone={pinStatus?.userPhone || user?.phone || parsedTenantSettings?.phone || ""}
        userRole={pinStatus?.userRole || (user?.role === "admin" ? "Administrator" : "Manager / Utilizator")}
        defaultExplanation={pinStatus?.defaultExplanation}
        tenantId={effectiveTenantId}
        isSuperadmin={user?.role === "superadmin"}
        onUnlocked={() => {
          try {
            sessionStorage.setItem("smart_invoice_pin_session_unlocked", String(effectiveTenantId));
            sessionStorage.setItem(`smart_invoice_unlocked_pin_${effectiveTenantId}`, "true");
            localStorage.setItem(`smart_invoice_last_act_${effectiveTenantId}`, String(Date.now()));
          } catch {}
          setIsPinUnlocked(true);
        }}
      />
    );
  }

  const cleanSearch = searchString.replace(/^\?/, "");
  const activeTabParam = new URLSearchParams(cleanSearch).get("tab");

  const isSubItemActive = (subHref: string) => {
    if (subHref === "/facturi") {
      return (
        location === "/facturi" ||
        location === "/facturi-primite" ||
        location.startsWith("/facturi/") ||
        location.startsWith("/factura/") ||
        location.startsWith("/facturi-primite/")
      );
    }
    if (subHref === "/facturi-emise-nou") {
      return (
        location === "/facturi-emise-nou" ||
        location.startsWith("/facturi-emise-nou/") ||
        location.startsWith("/facturi-emise/")
      );
    }
    if (subHref === "/re-facturi") {
      return (
        location === "/re-facturi" ||
        location.startsWith("/re-facturi/") ||
        location.startsWith("/re-facturare/") ||
        location === "/re-factura"
      );
    }
    if (subHref === "/bonuri-consum") {
      return location === "/bonuri-consum" || location.startsWith("/bonuri-consum/");
    }
    if (subHref === "/devize") {
      return (
        location === "/devize" ||
        (location.startsWith("/devize/") && location !== "/devize/catalog")
      );
    }
    if (subHref === "/devize/catalog") {
      return location === "/devize/catalog" || location.startsWith("/devize/catalog/");
    }
    if (subHref === "/contracte") {
      return (
        location === "/contracte" ||
        (location.startsWith("/contracte/") && location !== "/contracte/new")
      );
    }
    if (subHref === "/nir") {
      return location === "/nir" || location.startsWith("/nir/");
    }
    return location === subHref || location.startsWith(subHref + "/");
  };

  const isActive = (href: string) => {
    if (href.includes("?")) {
      const [basePath, qs] = href.split("?");
      if (location !== basePath) return false;
      const targetParams = new URLSearchParams(qs);
      const currentParams = new URLSearchParams(cleanSearch);
      return Array.from(targetParams.entries()).every(
        ([k, v]) => currentParams.get(k) === v
      );
    }
    if (href === "/setari") {
      return location === "/setari" && activeTabParam !== "accountant";
    }
    if (href === "/dashboard") return location === "/dashboard";
    if (href === "/devize") {
      return (
        location === "/devize" ||
        (location.startsWith("/devize/") && location !== "/devize/catalog")
      );
    }
    return location === href || location.startsWith(href + "/");
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Nav */}
      <nav className="flex-1 py-3.5 px-2.5 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const hasExpandedSubs =
            !collapsed &&
            item.subItems &&
            item.subItems.some(s => isSubItemActive(s.href));
          return (
            <div key={item.href}>
              <Link href={item.href} onClick={() => setMobileOpen(false)}>
                <div
                  style={
                    active && !item.subItems
                      ? { backgroundColor: themeColor }
                      : undefined
                  }
                  className={cn(
                    "flex items-center gap-2.5 px-3.5 py-2 rounded-full text-[13.5px] leading-snug transition-all duration-150 cursor-pointer group",
                    active && !item.subItems
                      ? "apple-sidebar-active text-white font-semibold"
                      : (active || hasExpandedSubs) && item.subItems
                        ? "apple-sidebar-group-open text-[#1d1d1f] dark:text-white font-semibold"
                        : "text-[#3a3a3c] font-medium hover:text-[#1d1d1f] hover:bg-white/65 dark:text-[#ebebf5]/80 dark:hover:text-white dark:hover:bg-white/[0.06]",
                    collapsed && "justify-center px-2"
                  )}
                >
                  <Icon
                    style={active && !item.subItems ? undefined : (active || hasExpandedSubs) && item.subItems ? { color: themeColor } : undefined}
                    className={cn(
                      "w-4 h-4 flex-shrink-0 transition-colors",
                      active && !item.subItems
                        ? "text-white"
                        : (active || hasExpandedSubs) && item.subItems
                          ? ""
                          : "text-[#636366] dark:text-[#98989d] group-hover:text-[#1d1d1f] dark:group-hover:text-white"
                    )}
                  />
                  {!collapsed && (
                    <span className="flex-1 truncate">{item.label}</span>
                  )}
                  {/* Badge eliminat pentru a evita confuzia cu numarul total de facturi */}
                </div>
              </Link>
              {/* Sub-items indentat */}
              {!collapsed && item.subItems && (active || hasExpandedSubs) && (
                <div className="ml-4 mt-1 pl-3 border-l border-black/[0.08] dark:border-white/[0.08] space-y-0.5 py-0.5">
                  {item.subItems.map(sub => {
                    const SubIcon = sub.icon;
                    const subActive = isSubItemActive(sub.href);
                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        onClick={() => setMobileOpen(false)}
                      >
                        <div
                          style={
                            subActive
                              ? { backgroundColor: themeColor }
                              : undefined
                          }
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-full text-[12.5px] transition-all duration-150 cursor-pointer group",
                            subActive
                              ? "apple-sidebar-active text-white font-semibold"
                              : "text-[#636366] font-medium hover:text-[#1d1d1f] hover:bg-white/65 dark:text-[#98989d] dark:hover:text-white dark:hover:bg-white/[0.06]"
                          )}
                        >
                          <SubIcon
                            className={cn(
                              "w-3.5 h-3.5 flex-shrink-0",
                              subActive ? "text-white" : "text-[#636366] dark:text-[#98989d]"
                            )}
                          />
                          <span className="truncate">{sub.label}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {/* Admin-only nav items */}
        {(user?.role === "superadmin" || user?.role === "admin") && (
          <>
            {!collapsed && (
              <div className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#636366] dark:text-[#98989d]">
                Admin
              </div>
            )}
            {adminNavItems.map(item => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                >
                  <div
                    className={cn(
                      "flex items-center gap-2.5 px-3.5 py-2 rounded-full text-[13.5px] transition-all duration-150 cursor-pointer group",
                      active
                        ? "bg-purple-600 text-white shadow-sm font-semibold"
                        : "text-[#3a3a3c] font-medium hover:text-[#1d1d1f] hover:bg-black/[0.045] dark:text-[#ebebf5]/80 dark:hover:text-white dark:hover:bg-white/[0.06]",
                      collapsed && "justify-center px-2"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-4 h-4 flex-shrink-0",
                        active
                          ? "text-white"
                          : "text-[#636366] dark:text-[#98989d] group-hover:text-purple-600 dark:group-hover:text-white"
                      )}
                    />
                    {!collapsed && <span className="flex-1">{item.label}</span>}
                  </div>
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Company info */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg bg-black/[0.04] dark:bg-white/[0.08] flex items-center justify-center flex-shrink-0 overflow-hidden border border-black/[0.06] dark:border-white/[0.08]"
              style={
                companyLogo &&
                !logoError &&
                parsedTenantSettings?.logoHasBackground &&
                parsedTenantSettings?.logoBgColor
                  ? { backgroundColor: parsedTenantSettings.logoBgColor }
                  : undefined
              }
            >
              {companyLogo && !logoError ? (
                <img
                  src={companyLogo}
                  alt={companyName}
                  className="w-full h-full object-contain p-0.5"
                />
              ) : activeProfileMeta.isPf ? (
                <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              ) : (
                <Building2 className="w-4 h-4 text-[#636366] dark:text-[#98989d]" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[#1d1d1f] dark:text-white text-[13px] font-semibold leading-tight break-words">
                {companyName}
              </div>
              <div className="text-[#636366] dark:text-[#98989d] font-medium text-[11.5px] truncate mt-0.5 tabular-nums">
                {activeProfileMeta.subtitle}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Număr și dată build */}
      {!collapsed && (
        <div
          className="px-3 py-2.5 border-t border-black/[0.06] dark:border-white/[0.08] text-center text-[10.5px] leading-tight text-[#636366] dark:text-[#98989d] select-text tabular-nums"
          title={`Build ${__BUILD_NUMBER__} · ${__BUILD_DATE__}`}
        >
          <div className="font-semibold">Build #{__BUILD_NUMBER__}</div>
          <div>{__BUILD_DATE__}</div>
        </div>
      )}
    </div>
  );

  return (
    <div className="relative flex h-screen apple-canvas overflow-hidden">
      {/* Top Header — Floating Apple Liquid Glass Functional Bar (content scrolls underneath) */}
      <header className="fixed top-2.5 sm:top-3.5 left-2.5 sm:left-3.5 right-2.5 sm:right-3.5 h-15 apple-glass rounded-[22px] flex items-center px-4 sm:px-5 gap-3 sm:gap-3.5 z-30">
        {/* Logo — Apple Liquid Glass Squircle + SF Pro Lockup */}
        <Link href="/">
          <div className="flex items-center flex-shrink-0 mr-1.5 cursor-pointer hover:opacity-90 transition-opacity">
            <FacturaSpvLogo iconOnly={collapsed} size="md" />
          </div>
        </Link>

        {/* Mobile menu toggle */}
        <button
          aria-label="Deschide meniul"
          className="md:hidden w-9 h-9 rounded-full apple-btn-glass flex items-center justify-center transition-all"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="w-4 h-4 text-[#3a3a3c] dark:text-[#ebebf5]" />
        </button>

        {/* Desktop Sidebar collapse toggle */}
        <button
          aria-label={collapsed ? "Extinde bara laterală" : "Restrânge bara laterală"}
          className="hidden md:flex w-9 h-9 rounded-full apple-btn-glass items-center justify-center transition-all"
          onClick={() => setCollapsed(!collapsed)}
        >
          <Menu className="w-4 h-4 text-[#3a3a3c] dark:text-[#ebebf5]" />
        </button>

        <div className="flex-1" />

        {/* Live BNR Exchange Rate with date & live indicator */}
        <BnrExchangeRateHeader />

        {/* Multi-currency / country indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full apple-btn-glass">
          <Globe className="w-3.5 h-3.5 text-[#636366] dark:text-[#98989d]" />
          <span className="text-xs font-semibold text-[#3a3a3c] dark:text-[#ebebf5]">
            RON
          </span>
        </div>

        {/* Notifications — fără count hardcodat */}
        <Popover open={notifOpen} onOpenChange={setNotifOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Notificări"
              title="Notificări"
              className="relative w-9 h-9 rounded-full apple-btn-glass flex items-center justify-center transition-all cursor-pointer"
            >
              <Bell className="w-4 h-4 text-[#3a3a3c] dark:text-[#ebebf5]" />
              {pendingCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white dark:ring-[#1c1c1e]" />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="w-80 p-3.5 apple-glass rounded-[22px] border border-black/[0.08] dark:border-white/[0.12] shadow-xl z-50"
          >
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-black/[0.06] dark:border-white/[0.08]">
              <span className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white">
                Notificări & Alerte
              </span>
              {pendingCount > 0 && (
                <Badge className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800 tabular-nums">
                  {pendingCount} în așteptare
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <div className="px-3 py-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.07]">
                {pendingCount > 0 ? (
                  <p className="text-xs text-[#3a3a3c] dark:text-[#ebebf5] leading-relaxed tabular-nums">
                    Aveți <strong className="font-semibold text-[#1d1d1f] dark:text-white">{pendingCount}</strong>{" "}
                    {pendingCount === 1 ? "factură primită" : "facturi primite"} în așteptare de procesare.
                  </p>
                ) : (
                  <p className="text-xs text-[#636366] dark:text-[#98989d] leading-relaxed">
                    Nu există alerte noi. Toate documentele sunt la zi.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5 pt-1">
                <Link href="/spv" onClick={() => setNotifOpen(false)}>
                  <div className="w-full flex items-center justify-between px-3 py-2 rounded-full apple-btn-glass text-xs font-semibold text-[#1d1d1f] dark:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer">
                    <span className="flex items-center gap-2">
                      <Inbox className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      Mesaje & Recipise SPV ANAF
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#636366] dark:text-[#98989d]" />
                  </div>
                </Link>
                <Link href="/setari?tab=notifications" onClick={() => setNotifOpen(false)}>
                  <div className="w-full flex items-center justify-between px-3 py-2 rounded-full apple-btn-glass text-xs font-medium text-[#3a3a3c] dark:text-[#ebebf5] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer">
                    <span className="flex items-center gap-2">
                      <Settings className="w-3.5 h-3.5 text-[#636366] dark:text-[#98989d]" />
                      Setări notificări
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#636366] dark:text-[#98989d]" />
                  </div>
                </Link>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Fullscreen toggle */}
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Ieși din ecran complet" : "Ecran complet"}
          title={isFullscreen ? "Ieși din ecran complet" : "Ecran complet"}
          className="hidden sm:flex w-9 h-9 rounded-full apple-btn-glass items-center justify-center transition-all cursor-pointer"
        >
          {isFullscreen ? (
            <Minimize2 className="w-3.5 h-3.5 text-[#3a3a3c] dark:text-[#ebebf5]" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5 text-[#3a3a3c] dark:text-[#ebebf5]" />
          )}
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Comută la modul luminos" : "Comută la modul întunecat"}
          title={theme === "dark" ? "Mod luminos" : "Mod întunecat"}
          className="w-9 h-9 rounded-full apple-btn-glass flex items-center justify-center transition-all cursor-pointer"
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 text-[#ebebf5]" />
          ) : (
            <Moon className="w-4 h-4 text-[#3a3a3c]" />
          )}
        </button>

        {/* User / Active Company Executive Capsule */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="h-9 pl-1 pr-1 sm:pr-2.5 rounded-full apple-btn-glass flex items-center gap-2 cursor-pointer transition-all shrink-0 max-w-[230px]"
              title={companyName}
            >
              <div
                className={cn(
                  "relative w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-2xs",
                  companyLogo && !logoError
                    ? "bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.12] overflow-hidden p-0.5"
                    : activeProfileMeta.isPf
                      ? "bg-gradient-to-br from-indigo-500 to-indigo-700 text-white text-[11px] font-bold"
                      : "bg-gradient-to-br from-emerald-600 to-teal-700 text-white text-[11px] font-bold"
                )}
                style={
                  companyLogo &&
                  !logoError &&
                  parsedTenantSettings?.logoHasBackground &&
                  parsedTenantSettings?.logoBgColor
                    ? { backgroundColor: parsedTenantSettings.logoBgColor }
                    : undefined
                }
              >
                {companyLogo && !logoError ? (
                  <img
                    src={companyLogo}
                    alt={companyName}
                    onError={() => setLogoError(true)}
                    className="w-full h-full object-contain rounded-full"
                  />
                ) : activeProfileMeta.isPf ? (
                  <User className="w-3.5 h-3.5 text-white" />
                ) : (
                  (companyName || user?.name || "U")
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w: string) => w[0]?.toUpperCase())
                    .join("") || "U"
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#1c1c1e]" />
              </div>

              <div className="hidden sm:flex flex-col items-start min-w-0 leading-tight text-left">
                <span className="text-[11.5px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] truncate max-w-[140px]">
                  {companyName}
                </span>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 truncate max-w-[140px] tabular-nums">
                  {activeProfileMeta.subtitle ||
                    ((user as any)?.role === "superadmin" ? "Super Admin" : "Activ")}
                </span>
              </div>

              <ChevronDown className="hidden sm:block w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d] shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <div className="px-3 py-2 text-xs text-slate-500">
              <div className="flex items-center gap-2.5 mb-1">
                {companyLogo && !logoError ? (
                  <div
                    className="w-7 h-7 rounded border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0 bg-white dark:bg-slate-800 p-0.5"
                    style={
                      parsedTenantSettings?.logoHasBackground && parsedTenantSettings?.logoBgColor
                        ? { backgroundColor: parsedTenantSettings.logoBgColor }
                        : undefined
                    }
                  >
                    <img
                      src={companyLogo}
                      alt={companyName}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : activeProfileMeta.isPf ? (
                  <div className="w-7 h-7 rounded border border-indigo-200 dark:border-indigo-800 flex items-center justify-center flex-shrink-0 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                    <User className="w-3.5 h-3.5" />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900 dark:text-white truncate">
                    {companyName}
                  </div>
                  <div className="text-[11px] truncate text-slate-500 tabular-nums">
                    {activeProfileMeta.isPf && activeProfileMeta.cleanCode
                      ? `CNP ${activeProfileMeta.cleanCode}`
                      : user?.email || ""}
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
            <div className="px-2 py-1.5 space-y-1">
              <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Comută Profilul
              </div>
              <button
                type="button"
                disabled={switchTenantMutation.isPending}
                onClick={() => {
                  if (entityPair?.activeType === "pf" && entityPair?.pj?.id) {
                    targetSwitchTypeRef.current = "pj";
                    switchTenantMutation.mutate({ tenantId: Number(entityPair.pj.id) });
                  }
                }}
                className={cn(
                  "w-full rounded-lg px-2.5 py-2 text-left flex items-center gap-2.5 transition-colors cursor-pointer border",
                  entityPair?.activeType !== "pf"
                    ? "bg-blue-50/70 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800"
                    : "bg-transparent border-transparent hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                <div className="w-7 h-7 rounded-md bg-blue-100/80 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {entityPair?.pj?.name || companyName}
                  </div>
                  <div className="text-[10.5px] text-slate-500 truncate tabular-nums">
                    {entityPair?.pj?.cui
                      ? `Persoană Juridică · ${
                          String(entityPair.pj.cui).toUpperCase().startsWith("RO")
                            ? entityPair.pj.cui
                            : `RO${entityPair.pj.cui}`
                        }`
                      : "Persoană Juridică"}
                  </div>
                </div>
                {entityPair?.activeType !== "pf" && (
                  <Check className="w-4 h-4 text-blue-600 shrink-0" />
                )}
              </button>

              {entityPair?.pf ? (
                <button
                  type="button"
                  disabled={switchTenantMutation.isPending}
                  onClick={() => {
                    if (entityPair.activeType !== "pf") {
                      targetSwitchTypeRef.current = "pf";
                      switchTenantMutation.mutate({ tenantId: Number(entityPair.pf!.id) });
                    }
                  }}
                  className={cn(
                    "w-full rounded-lg px-2.5 py-2 text-left flex items-center gap-2.5 transition-colors cursor-pointer border",
                    entityPair.activeType === "pf"
                      ? "bg-indigo-50/80 border-indigo-200 dark:bg-indigo-950/50 dark:border-indigo-800"
                      : "bg-transparent border-transparent hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  <div className="w-7 h-7 rounded-md bg-indigo-100/80 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {entityPair.pf.name}
                    </div>
                    <div className="text-[10.5px] text-slate-500 truncate tabular-nums">
                      {entityPair.pf.cui
                        ? `Persoană Fizică · CNP ${entityPair.pf.cui}`
                        : "Persoană Fizică"}
                    </div>
                  </div>
                  {entityPair.activeType === "pf" && (
                    <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setLocation("/setari?tab=pf")}
                  className="w-full rounded-lg px-2.5 py-2 text-left flex items-center gap-2.5 transition-colors cursor-pointer border border-dashed border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <div className="w-7 h-7 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 truncate">
                      + Adaugă Persoană Fizică (CNP)
                    </div>
                    <div className="text-[10.5px] text-slate-500 truncate">
                      Configurează profilul separat în Setări
                    </div>
                  </div>
                </button>
              )}
            </div>
            <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
            {pinStatus?.pinEnabled && (
              <DropdownMenuItem
                onClick={() => handleLockScreen()}
                className="cursor-pointer text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center"
              >
                <Lock className="w-4 h-4 mr-2" />
                <span>Blochează ecranul</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={logout}
              className="cursor-pointer text-slate-600 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Deconectare
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Bottom Area (Sidebar + Main Content scrolling smoothly beneath Floating Liquid Glass Header) */}
      <div className="flex-1 flex min-w-0 h-full">
        {/* Desktop Sidebar — Apple Liquid Glass Functional Layer */}
        <aside
          className={cn(
            "hidden md:flex flex-col apple-glass rounded-[22px] transition-all duration-300 flex-shrink-0 mt-[74px] sm:mt-[80px] mb-2.5 sm:mb-3.5 ml-2.5 sm:ml-3.5 z-20",
            collapsed ? "w-20" : "w-64"
          )}
        >
          <SidebarContent />
        </aside>

        {/* Mobile Sidebar Overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/45 dark:bg-black/65 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="absolute left-0 top-0 bottom-0 w-68 apple-glass rounded-r-[24px] flex flex-col shadow-2xl">
              <SidebarContent />
            </aside>
          </div>
        )}

        {/* Page Content — Full-height scroll container so content refracts behind floating Liquid Glass Header */}
        <main className="flex-1 h-full overflow-y-auto overflow-x-hidden pt-[74px] sm:pt-[80px] px-2.5 sm:px-3.5 pb-[calc(85px+env(safe-area-inset-bottom))] md:pb-12">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation — iOS Liquid Glass Tab Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/84 dark:bg-[#1c1c1e]/86 backdrop-blur-xl backdrop-saturate-150 border-t border-black/[0.08] dark:border-white/[0.10] px-1 pb-[env(safe-area-inset-bottom)] pt-1.5 h-[calc(60px+env(safe-area-inset-bottom))] shadow-[0_-4px_20px_-6px_rgba(0,0,0,0.08)] z-40">
        {(() => {
          const activeParent = navItems.find(
            item =>
              isActive(item.href) ||
              (item.subItems && item.subItems.some(sub => isSubItemActive(sub.href)))
          );
          const showSubNav =
            activeParent &&
            activeParent.subItems &&
            activeParent.subItems.length > 0 &&
            !forceMainMenu;

          if (showSubNav) {
            return (
              <div className="flex items-center w-full h-full overflow-x-auto scrollbar-hide gap-1 px-1">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setForceMainMenu(true)}
                  className="flex-shrink-0 flex flex-col items-center justify-center w-16 h-12 gap-1 cursor-pointer transition-colors rounded-xl text-[#636366] hover:text-[#1d1d1f] dark:text-[#98989d] dark:hover:text-white"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span className="text-[10.5px] font-medium leading-none text-center">Înapoi</span>
                </div>
                
                {activeParent.subItems!.map(sub => {
                  const SubIcon = sub.icon;
                  const subActive = isSubItemActive(sub.href);
                  return (
                    <Link key={sub.href} href={sub.href} onClick={() => setForceMainMenu(false)}>
                      <div
                        style={subActive ? { color: themeColor } : undefined}
                        className={cn(
                          "flex-shrink-0 flex flex-col items-center justify-center w-[4.5rem] h-12 gap-1 cursor-pointer transition-colors rounded-xl px-1",
                          subActive
                            ? "bg-black/[0.04] dark:bg-white/[0.08]"
                            : "text-[#636366] hover:text-[#1d1d1f] dark:text-[#98989d] dark:hover:text-white active:bg-black/[0.05] dark:active:bg-white/[0.08]"
                        )}
                      >
                        <SubIcon className={cn("w-5 h-5", subActive && "stroke-[2.25px]")} />
                        <span className={cn("text-[10.5px] font-medium leading-none text-center truncate w-full", subActive && "font-semibold")}>{sub.label}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            );
          }

          return (
            <div className="flex justify-around items-center w-full h-full">
              {mobileNavItems.map(item => {
                const Icon = item.icon;
                const active = isActive(item.href);
                const parentNavItem = navItems.find(n => n.href === item.href);
                const hasSubItems = parentNavItem && parentNavItem.subItems && parentNavItem.subItems.length > 0;

                return (
                  <Link key={item.href} href={item.href} onClick={() => {
                    if (hasSubItems) {
                      setForceMainMenu(false);
                    }
                  }}>
                    <div
                      style={active ? { color: themeColor } : undefined}
                      className={cn(
                        "flex flex-col items-center justify-center w-[4.5rem] h-12 gap-1 cursor-pointer transition-colors rounded-xl",
                        active
                          ? "bg-black/[0.04] dark:bg-white/[0.08]"
                          : "text-[#636366] hover:text-[#1d1d1f] dark:text-[#98989d] dark:hover:text-white active:bg-black/[0.05] dark:active:bg-white/[0.08]"
                      )}
                    >
                      <Icon className={cn("w-5 h-5", active && "stroke-[2.25px]")} />
                      <span className={cn("text-[10.5px] font-medium leading-none", active && "font-semibold")}>{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          );
        })()}
      </div>

    </div>
  );
}
