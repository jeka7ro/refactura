// DashboardLayout — Slate Command Center + Auth Integration
// Fixed sidebar (240px) + main content area
// Design: slate-900 sidebar, white content, blue-600 accents

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  LayoutDashboard,
  FileText,
  FileOutput,
  Users,
  Plug,
  Settings,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  Bell,
  Menu,
  X,
  Building2,
  Globe,
  LogOut,
  TrendingUp,
  MapPin,
  ShieldCheck,
  Globe2,
  Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663775520028/C8wLbaeYKAg5R5gqEkUmxw/getapp-smart-invoice-logo-8jE6iFRK2679M7FEcnTBFN.webp";
const APP_NAME = "Get App";
const APP_SUBTITLE = "Smart Invoice";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  section?: string;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, section: "principal" },
  { href: "/facturi-primite", label: "Facturi Primite", icon: FileText, badge: 2, section: "facturare" },
  { href: "/re-facturi", label: "Re-Facturi", icon: FileOutput, section: "facturare" },
  { href: "/rapoarte", label: "Rapoarte", icon: TrendingUp, section: "analize" },
  { href: "/clienti", label: "Clienți", icon: Users, section: "gestiune" },
  { href: "/integrari", label: "Integrări", icon: Plug, section: "gestiune" },
  { href: "/setari", label: "Setări", icon: Settings, section: "cont" },
  { href: "/centre-cost", label: "Centre de Cost", icon: MapPin, section: "gestiune" },
  { href: "/arhiva-facturi", label: "Arhivă Facturi", icon: Archive, section: "facturare" },
];

const adminNavItems: NavItem[] = [
  { href: "/super-admin", label: "Super Admin", icon: ShieldCheck, section: "admin" },
  { href: "/landing", label: "Landing Page", icon: Globe2, section: "admin" },
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

  // Loading auth state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin w-8 h-8 border-4 border-slate-200 dark:border-slate-700 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  // Redirect direct la login dacă nu e autentificat
  if (!user) {
    setLocation("/login");
    return null;
  }

  const isActive = (href: string) => {
    if (href === "/dashboard") return location === "/dashboard";
    return location.startsWith(href);
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 px-4 py-5 border-b border-slate-700/50",
        collapsed && "justify-center px-2"
      )}>
        <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-900/30">
          <img src={LOGO_URL} alt="RefacturaRO" className="w-5 h-5 object-contain" />
        </div>
        {!collapsed && (
          <div>
            <div className="text-white font-bold text-sm leading-tight">{APP_NAME}</div>
            <div className="text-blue-400 font-bold text-xs">{APP_SUBTITLE}</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
              <div className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer group",
                active
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-900/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/50",
                collapsed && "justify-center px-2"
              )}>
                <Icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-white" : "text-slate-400 group-hover:text-white")} />
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </div>
            </Link>
          );
        })}
        {/* Admin-only nav items */}
        {(user?.role === 'superadmin' || user?.role === 'admin') && (
          <>
            {!collapsed && <div className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Admin</div>}
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
                  <div className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer group",
                    active
                      ? "bg-purple-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-white hover:bg-slate-700/50",
                    collapsed && "justify-center px-2"
                  )}>
                    <Icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-white" : "text-slate-500 group-hover:text-white")} />
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
        <div className="px-4 py-4 border-t border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-slate-400" />
            </div>
            <div className="min-w-0">
              <div className="text-white text-xs font-semibold truncate">ConstructMaster SRL</div>
              <div className="text-slate-500 text-[11px] truncate">RO12345678</div>
            </div>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <div className={cn("px-2 py-3 border-t border-slate-700/50", collapsed && "flex justify-center")}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-slate-500 hover:text-white hover:bg-slate-700/50 transition-all duration-150 text-xs font-medium"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : (
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
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden md:flex flex-col bg-slate-900 dark:bg-slate-950 border-r border-slate-700/50 transition-all duration-300 flex-shrink-0",
        collapsed ? "w-16" : "w-60"
      )}>
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-slate-900 flex flex-col">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700/50 flex items-center px-4 gap-4 flex-shrink-0 shadow-sm">
          {/* Mobile menu */}
          <button
            className="md:hidden w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>

          <div className="flex-1" />

          {/* Multi-currency / country indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">🇷🇴 RON</span>
          </div>

          {/* Notifications */}
          <button className="relative w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-600 hover:border-blue-200 dark:hover:border-blue-700 transition-colors">
            <Bell className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-600 rounded-full text-[9px] text-white font-bold flex items-center justify-center">2</span>
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-600 hover:border-blue-200 dark:hover:border-blue-700 transition-colors"
          >
            {theme === "dark" ? <Sun className="w-4 h-4 text-slate-500 dark:text-slate-400" /> : <Moon className="w-4 h-4 text-slate-500 dark:text-slate-400" />}
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
                <div className="font-semibold text-slate-900 dark:text-white">{user?.name || "User"}</div>
                <div className="text-[11px] truncate">{user?.email || ""}</div>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
              <DropdownMenuItem onClick={logout} className="cursor-pointer text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400">
                <LogOut className="w-4 h-4 mr-2" />
                Deconectare
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
