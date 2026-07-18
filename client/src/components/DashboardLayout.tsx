// DashboardLayout — Slate Command Center + Auth Integration
// Fixed sidebar (240px) + main content area
// Design: slate-900 sidebar, white content, blue-600 accents

import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  LayoutDashboard,
  FileText,
  FileOutput,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  MapPin,
  Search,
  Plus,
  Archive,
  ShieldCheck,
  Globe2,
  Bell,
  AlertCircle,
  RefreshCcw,
  Plug,
  TrendingUp,
  ClipboardCheck,
  PackageOpen,
  Globe,
  Building2,
  Moon,
  Sun,
  X,
  UtensilsCrossed,
  Truck,
  BookOpen,
  ShoppingBag,
  Grid3X3,
  ChefHat,
  Settings2,
  Box,
  MonitorSmartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LOGO_URL = "/logo.png";
const APP_NAME = "Get App";
const APP_SUBTITLE = "Smart Invoice";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  section?: string;
  subItems?: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
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
      { href: "/re-facturi", label: "Re-Facturi", icon: FileOutput },
      { href: "/arhiva-facturi", label: "Arhivă Facturi", icon: Archive },
      { href: "/jurnal-spv", label: "Jurnal SPV", icon: FileText },
    ],
  },
  {
    href: "/nir",
    label: "Gestiune",
    icon: PackageOpen,
    section: "gestiune",
    subItems: [
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
  { href: "/clienti", label: "Clienți", icon: Users, section: "gestiune" },
  { href: "/integrari", label: "Integrări", icon: Plug, section: "gestiune" },
  {
    href: "/centre-cost",
    label: "Centre de Cost",
    icon: MapPin,
    section: "gestiune",
  },
  {
    href: "/horeca",
    label: "SmartHORECA",
    icon: UtensilsCrossed,
    section: "module",
    subItems: [
      { href: "/horeca", label: "Dashboard HORECA", icon: LayoutDashboard },
      { href: "/horeca/locatii", label: "Locații", icon: MapPin },
      { href: "/horeca/mese", label: "Plan Sală", icon: Grid3X3 },
      { href: "/horeca/meniu", label: "Meniu & Rețete", icon: BookOpen },
      { href: "/horeca/gestiune", label: "Gestiune Stoc", icon: Box },
      { href: "/horeca/comenzi", label: "Comenzi POS", icon: ShoppingBag },
      { href: "/horeca/kds", label: "Bucătărie (KDS)", icon: ChefHat },
      { href: "/horeca/delivery", label: "Delivery", icon: Truck },
      { href: "/horeca/kiosk", label: "Setări Kiosk", icon: Settings2 },
      { href: "/horeca/test", label: "Kiosk Monitor", icon: MonitorSmartphone },
    ],
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
  { href: "/nir", label: "Gestiune", icon: PackageOpen },
  { href: "/horeca", label: "HORECA", icon: UtensilsCrossed },
  { href: "/setari", label: "Setări", icon: Settings },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, loading, logout } = useAuth();

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

  // Loading auth state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin w-8 h-8 border-4 border-slate-200 dark:border-slate-700 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isActive = (href: string) => {
    if (href === "/dashboard") return location === "/dashboard";
    // /devize is active ONLY if we're exactly on /devize or /devize/<numeric id>, NOT on /devize/catalog
    if (href === "/devize")
      return (
        location === "/devize" ||
        (location.startsWith("/devize/") && location !== "/devize/catalog")
      );
    // Exact match OR starts with href/ for other paths
    return location === href || location.startsWith(href + "/");
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const hasExpandedSubs =
            !collapsed &&
            item.subItems &&
            item.subItems.some(s => location === s.href);
          return (
            <div key={item.href}>
              <Link href={item.href} onClick={() => setMobileOpen(false)}>
                <div
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-150 cursor-pointer group",
                    active && !item.subItems
                      ? "bg-blue-600 text-white shadow-sm font-bold"
                      : (active || hasExpandedSubs) && item.subItems
                        ? "text-slate-900 dark:text-white font-bold"
                        : "text-slate-700 font-bold hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800",
                    collapsed && "justify-center px-2"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 flex-shrink-0",
                      active && !item.subItems
                        ? "text-white"
                        : (active || hasExpandedSubs) && item.subItems
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-slate-400 group-hover:text-blue-600 dark:group-hover:text-white"
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
                <div className="ml-3 mt-0.5 pl-3 border-l border-slate-200 dark:border-slate-700 space-y-0.5">
                  {item.subItems.map(sub => {
                    const SubIcon = sub.icon;
                    const subActive = location === sub.href;
                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        onClick={() => setMobileOpen(false)}
                      >
                        <div
                          className={cn(
                            "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer group",
                            subActive
                              ? "bg-[var(--color-primary)] text-white shadow-sm font-bold"
                              : "text-slate-500 font-medium hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800"
                          )}
                        >
                          <SubIcon
                            className={cn(
                              "w-3.5 h-3.5 flex-shrink-0",
                              subActive ? "text-white" : "text-slate-400"
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
              <div className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
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
                      "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 cursor-pointer group",
                      active
                        ? "bg-purple-600 text-white shadow-sm font-bold"
                        : "text-slate-700 font-bold hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800",
                      collapsed && "justify-center px-2"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-4 h-4 flex-shrink-0",
                        active
                          ? "text-white"
                          : "text-slate-400 group-hover:text-purple-600 dark:group-hover:text-white"
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
        <div className="px-4 py-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-slate-900 dark:text-white text-sm font-bold leading-tight break-words">
                {(user as any)?.tenantName || user?.name || "—"}
              </div>
              <div className="text-slate-500 font-medium text-xs truncate mt-0.5">
                {(user as any)?.tenantCUI
                  ? `RO${(user as any).tenantCUI}`
                  : user?.email || ""}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <div
        className={cn(
          "px-2 py-3 border-t border-slate-200/50 dark:border-slate-800/50",
          collapsed && "flex justify-center"
        )}
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-blue-600 bg-blue-50/50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 font-semibold transition-all duration-150 text-xs"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Restrânge</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-950 overflow-hidden p-3 sm:p-4 gap-3 sm:gap-4">
      {/* Top Header — Full width island */}
      <header className="h-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center px-4 sm:px-6 gap-4 flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0 mr-2">
          <div className="h-8 w-8 flex-shrink-0">
            <img
              src="/logo_icon.png"
              alt="Icon"
              className="h-full w-full object-contain"
            />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <div className="text-[19px] font-extrabold text-slate-900 dark:text-white tracking-tight leading-none pt-1">
                getts<span className="text-[#20C57A]">/</span>App
              </div>
              <div className="text-[10px] font-black text-[#ef4444] mt-0.5 w-full flex justify-between">
                <span>f</span>
                <span>a</span>
                <span>c</span>
                <span>t</span>
                <span>u</span>
                <span>r</span>
                <span>a</span>
                <span>s</span>
                <span>p</span>
                <span>v</span>
                <span>.</span>
                <span>r</span>
                <span>o</span>
              </div>
            </div>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="w-4 h-4 text-slate-600 dark:text-slate-400" />
        </button>

        {/* Desktop Sidebar collapse toggle (optional, dar vizual cum e in poza cu acel hamburger de langa logo) */}
        <button
          className="hidden md:flex w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          onClick={() => setCollapsed(!collapsed)}
        >
          <Menu className="w-4 h-4 text-slate-600 dark:text-slate-400" />
        </button>

        <div className="flex-1" />

        {/* Multi-currency / country indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <Globe className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            RON
          </span>
        </div>

        {/* Notifications — fără count hardcodat */}
        <button className="relative w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-600 hover:border-blue-200 dark:hover:border-blue-700 transition-colors">
          <Bell className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-600 hover:border-blue-200 dark:hover:border-blue-700 transition-colors"
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          )}
        </button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold shadow-sm cursor-pointer hover:shadow-md transition-shadow">
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-3 py-2 text-xs text-slate-500">
              <div className="font-semibold text-slate-900 dark:text-white">
                {user?.name || "User"}
              </div>
              <div className="text-[11px] truncate">{user?.email || ""}</div>
            </div>
            <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
            <DropdownMenuItem
              onClick={logout}
              className="cursor-pointer text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Deconectare
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Bottom Area (Sidebar + Main Content) */}
      <div className="flex-1 flex min-h-0 gap-3 sm:gap-4">
        {/* Desktop Sidebar */}
        <aside
          className={cn(
            "hidden md:flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300 flex-shrink-0",
            collapsed ? "w-20" : "w-64"
          )}
        >
          <SidebarContent />
        </aside>

        {/* Mobile Sidebar Overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-slate-900/60 dark:bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-slate-900 flex flex-col">
              <SidebarContent />
            </aside>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden px-1 pb-[calc(60px+env(safe-area-inset-bottom))] md:pb-1 scrollbar-hide">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-around items-center px-1 pb-[env(safe-area-inset-bottom)] pt-2 h-[calc(60px+env(safe-area-inset-bottom))] shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] z-40">
        {mobileNavItems.map(item => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href}>
              <div className={cn(
                "flex flex-col items-center justify-center w-[4.5rem] h-12 gap-1 cursor-pointer transition-colors rounded-xl",
                active 
                  ? "text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20" 
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 active:bg-slate-100 dark:active:bg-slate-800"
              )}>
                <Icon className={cn("w-5 h-5", active && "stroke-[2.5px] scale-110 transition-transform")} />
                <span className={cn("text-[10px] font-medium leading-none", active && "font-bold")}>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
