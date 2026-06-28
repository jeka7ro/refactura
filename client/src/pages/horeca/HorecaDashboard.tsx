// HorecaDashboard — Tablou de bord pentru modulul HORECA
// Afișează KPI-uri zilnice, comenzi active, top produse

import { useState } from "react";
import { Link } from "wouter";
import {
  UtensilsCrossed, ShoppingBag, Truck, MapPin,
  TrendingUp, Clock, CheckCircle2, ChefHat, Plus,
  BarChart2, AlertCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/store";

export default function HorecaDashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);

  const { data: locations = [], isLoading: loadingLoc } = trpc.horeca.locations.list.useQuery();
  const locationId = selectedLocationId ?? locations[0]?.id ?? 0;

  const { data: summary } = trpc.horeca.reports.dailySummary.useQuery(
    { locationId, date: today },
    { enabled: locationId > 0 }
  );
  const { data: activeOrders = [] } = trpc.horeca.orders.list.useQuery(
    { locationId },
    { enabled: locationId > 0 }
  );
  const { data: deliveryReport } = trpc.horeca.reports.deliveryChannelReport.useQuery(
    { locationId, month: thisMonth },
    { enabled: locationId > 0 }
  );

  const openOrders = activeOrders.filter(o => !["paid", "cancelled"].includes(o.status || ""));

  const PLATFORM_COLORS: Record<string, string> = {
    glovo: "#FF6B00",
    wolt: "#00C2E0",
    bolt_food: "#34D399",
    tazz: "#F59E0B",
    manual: "#8B5CF6",
  };

  if (loadingLoc) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <UtensilsCrossed className="w-16 h-16 text-slate-400" />
        <p className="text-slate-400 text-lg">Nicio locație HORECA configurată</p>
        <Link href="/horeca/locatii">
          <button className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
            Adaugă prima locație
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <UtensilsCrossed className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Smart HORECA</h1>
            <p className="text-slate-400 text-sm">Tablou de bord · {today}</p>
          </div>
        </div>
        {/* Location selector */}
        {locations.length > 1 && (
          <select
            value={locationId}
            onChange={e => setSelectedLocationId(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-orange-500"
          >
            {locations.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<TrendingUp className="w-5 h-5 text-green-400" />}
          label="Vânzări azi"
          value={formatCurrency(Number(summary?.totalRevenue || 0), "RON")}
          sub={`${summary?.ordersCount || 0} comenzi plătite`}
          color="green"
        />
        <KpiCard
          icon={<Clock className="w-5 h-5 text-orange-400" />}
          label="Comenzi active"
          value={String(openOrders.length)}
          sub="în curs de procesare"
          color="orange"
        />
        <KpiCard
          icon={<Truck className="w-5 h-5 text-blue-400" />}
          label="Delivery azi"
          value={formatCurrency(Number(summary?.byType?.delivery || 0), "RON")}
          sub="Glovo + Wolt + Bolt + Tazz"
          color="blue"
        />
        <KpiCard
          icon={<UtensilsCrossed className="w-5 h-5 text-purple-400" />}
          label="TVA colectat"
          value={formatCurrency(Number(summary?.totalVat || 0), "RON")}
          sub="total azi"
          color="purple"
        />
      </div>

      {/* Vânzări pe canal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-orange-400" />
            <h2 className="text-white font-semibold">Vânzări pe canal — azi</h2>
          </div>
          <div className="space-y-3">
            {[
              { label: "La masă (Dine-in)", value: summary?.byType?.dine_in || 0, color: "bg-orange-500" },
              { label: "Ridicare (Takeaway)", value: summary?.byType?.takeaway || 0, color: "bg-amber-500" },
              { label: "Livrare (Delivery)", value: summary?.byType?.delivery || 0, color: "bg-blue-500" },
            ].map(item => {
              const total = Number(summary?.totalRevenue || 1);
              const pct = total > 0 ? (Number(item.value) / total * 100) : 0;
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">{item.label}</span>
                    <span className="text-white font-medium">{formatCurrency(Number(item.value), "RON")}</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Delivery platforms */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Truck className="w-4 h-4 text-blue-400" />
            <h2 className="text-white font-semibold">Platforme Delivery — {thisMonth}</h2>
          </div>
          {deliveryReport && Object.keys(deliveryReport.byPlatform).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(deliveryReport.byPlatform).map(([platform, data]) => (
                <div key={platform} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: PLATFORM_COLORS[platform] || "#6B7280" }}
                    />
                    <span className="text-slate-300 text-sm capitalize">{platform.replace("_", " ")}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-sm font-medium">{formatCurrency(data.revenue, "RON")}</p>
                    <p className="text-red-400 text-xs">-{formatCurrency(data.commission, "RON")} comision</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm text-center py-4">Nicio comandă delivery înregistrată luna aceasta</p>
          )}
        </div>
      </div>

      {/* Comenzi active */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ChefHat className="w-4 h-4 text-orange-400" />
            <h2 className="text-white font-semibold">Comenzi Active ({openOrders.length})</h2>
          </div>
          <Link href="/horeca/comenzi">
            <button className="text-sm text-orange-400 hover:text-orange-300 transition-colors">
              Vezi toate →
            </button>
          </Link>
        </div>
        {openOrders.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">Nicio comandă activă momentan</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="text-left py-2 font-medium">Nr. Crt.</th>
                  <th className="text-left py-2 font-medium">Comandă</th>
                  <th className="text-left py-2 font-medium">Tip</th>
                  <th className="text-left py-2 font-medium">Status</th>
                  <th className="text-right py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {openOrders.slice(0, 10).map((order, idx) => (
                  <tr key={order.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-2 text-slate-500">{idx + 1}</td>
                    <td className="py-2 text-white font-medium">{order.orderNumber}</td>
                    <td className="py-2">
                      <TypeBadge type={order.type || "dine_in"} />
                    </td>
                    <td className="py-2">
                      <StatusBadge status={order.status || "draft"} />
                    </td>
                    <td className="py-2 text-right text-white">{formatCurrency(Number(order.total), "RON")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Comandă nouă", href: "/horeca/comenzi/nou", icon: <Plus className="w-4 h-4" />, color: "bg-orange-600 hover:bg-orange-700" },
          { label: "Meniu", href: "/horeca/meniu", icon: <UtensilsCrossed className="w-4 h-4" />, color: "bg-slate-700 hover:bg-slate-600" },
          { label: "Mese", href: "/horeca/mese", icon: <MapPin className="w-4 h-4" />, color: "bg-slate-700 hover:bg-slate-600" },
          { label: "Delivery", href: "/horeca/delivery", icon: <Truck className="w-4 h-4" />, color: "bg-slate-700 hover:bg-slate-600" },
        ].map(a => (
          <Link key={a.href} href={a.href}>
            <button className={`w-full flex items-center justify-center gap-2 ${a.color} text-white px-4 py-3 rounded-lg text-sm font-medium transition-colors`}>
              {a.icon}
              {a.label}
            </button>
          </Link>
        ))}
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string; color: string;
}) {
  const borderMap: Record<string, string> = {
    green: "border-green-500/30", orange: "border-orange-500/30",
    blue: "border-blue-500/30", purple: "border-purple-500/30",
  };
  return (
    <div className={`bg-slate-800/60 border ${borderMap[color] || "border-slate-700/50"} rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-slate-400 text-xs">{label}</span></div>
      <p className="text-white text-xl font-bold">{value}</p>
      <p className="text-slate-500 text-xs mt-1">{sub}</p>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    dine_in: { label: "La masă", cls: "bg-orange-500/20 text-orange-300" },
    takeaway: { label: "Ridicare", cls: "bg-amber-500/20 text-amber-300" },
    delivery: { label: "Livrare", cls: "bg-blue-500/20 text-blue-300" },
  };
  const { label, cls } = map[type] || { label: type, cls: "bg-slate-700 text-slate-300" };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: "Draft", cls: "bg-slate-600 text-slate-300" },
    sent: { label: "Trimis", cls: "bg-yellow-500/20 text-yellow-300" },
    preparing: { label: "Preparare", cls: "bg-orange-500/20 text-orange-300" },
    ready: { label: "Gata", cls: "bg-green-500/20 text-green-300" },
    served: { label: "Servit", cls: "bg-teal-500/20 text-teal-300" },
    paid: { label: "Plătit", cls: "bg-emerald-500/20 text-emerald-300" },
    cancelled: { label: "Anulat", cls: "bg-red-500/20 text-red-300" },
  };
  const { label, cls } = map[status] || { label: status, cls: "bg-slate-700 text-slate-300" };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>;
}
