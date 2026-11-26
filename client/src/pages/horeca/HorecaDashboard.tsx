// HorecaDashboard — Tablou de bord pentru modulul HORECA
// Afișează KPI-uri zilnice, comenzi active, top produse

import { useState } from "react";
import { Link } from "wouter";
import {
  UtensilsCrossed,
  Truck,
  MapPin,
  TrendingUp,
  Clock,
  ChefHat,
  Plus,
  BarChart2,
  CheckCircle2,
  History,
  CreditCard,
  Banknote,
  MonitorSmartphone,
  ChevronDown,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/store";

export default function HorecaDashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
    null
  );

  const { data: localLocations = [], isLoading: loadingLoc } =
    trpc.horeca.locations.list.useQuery();

  const { data: bridgeLocations = [], isLoading: bridgeLoading } =
    trpc.horeca.kioskBridge.listLocations.useQuery(undefined, {
      refetchOnWindowFocus: false,
    });

  const mappedBridgeLocations = bridgeLocations.map((bl: any) => ({
    id: `bridge-${bl.id}`,
    name: bl.name,
  }));

  const locations = [...localLocations, ...mappedBridgeLocations];
  const usesBridge = mappedBridgeLocations.length > 0;

  const locationId = selectedLocationId ?? locations[0]?.id ?? 0;

  const { data: summary } = trpc.horeca.reports.dailySummary.useQuery(
    { locationId, date: today },
    { enabled: locationId > 0 && !usesBridge }
  );
  const { data: localOrders = [] } = trpc.horeca.orders.list.useQuery(
    { locationId },
    { enabled: locationId > 0 && !usesBridge }
  );

  const { data: bridgeOrdersData } =
    trpc.horeca.kioskBridge.listOrders.useQuery(
      { limit: 50 },
      { enabled: usesBridge }
    );
  const activeOrders = usesBridge
    ? (bridgeOrdersData?.orders || []).map((o: any) => ({
        ...o,
        status: o.status === "pending" ? "sent" : o.status || "sent",
      }))
    : localOrders;

  const { data: deliveryReport } =
    trpc.horeca.reports.deliveryChannelReport.useQuery(
      { locationId, month: thisMonth },
      { enabled: locationId > 0 && !usesBridge }
    );

  const openOrders = activeOrders.filter(
    (o: any) => !["paid", "cancelled", "completed"].includes(o.status || "")
  );

  const PLATFORM_COLORS: Record<string, string> = {
    glovo: "#2563EB", // changed to standard blues/slates per user request
    wolt: "#3B82F6",
    bolt_food: "#60A5FA",
    tazz: "#93C5FD",
    manual: "#475569",
  };

  const computedSummary = usesBridge
    ? {
        totalRevenue: activeOrders.reduce(
          (acc: number, o: any) => acc + (Number(o.totalAmount) || 0),
          0
        ),
        ordersCount: activeOrders.length,
        totalVat: activeOrders.reduce(
          (acc: number, o: any) => acc + (Number(o.totalAmount) || 0) * 0.09,
          0
        ),
        byType: {
          dine_in: activeOrders
            .filter((o: any) => o.type === "dine_in")
            .reduce(
              (acc: number, o: any) => acc + (Number(o.totalAmount) || 0),
              0
            ),
          takeaway: activeOrders
            .filter((o: any) => o.type === "takeaway")
            .reduce(
              (acc: number, o: any) => acc + (Number(o.totalAmount) || 0),
              0
            ),
          delivery: activeOrders
            .filter((o: any) => o.type === "delivery")
            .reduce(
              (acc: number, o: any) => acc + (Number(o.totalAmount) || 0),
              0
            ),
        },
      }
    : summary;

  if (loadingLoc || bridgeLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary" />
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="apple-surface flex flex-col items-center justify-center h-64 gap-4 text-center p-6">
        <UtensilsCrossed className="w-12 h-12 text-[#8e8e93]" />
        <p className="text-[#6e6e73] dark:text-[#98989d] font-medium text-base">
          Nicio locație HORECA configurată
        </p>
        <Link href="/horeca/locatii">
          <button
            type="button"
            className="apple-btn-prominent inline-flex items-center gap-2 text-white font-semibold px-4 h-9 text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Adaugă prima locație
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-0.5">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
            Smart HORECA
          </h1>
          <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums">
            Tablou de bord · {today}
            {usesBridge && (
              <span className="text-primary font-semibold ml-1.5">
                (Smart Kiosk API)
              </span>
            )}
          </p>
        </div>
        {locations.length > 1 && (
          <div className="relative">
            <select
              value={locationId || ""}
              onChange={e => {
                const val = e.target.value;
                setSelectedLocationId(val.startsWith("bridge-") ? (val as any) : Number(val));
              }}
              className="apple-pill-control appearance-none pl-3.5 pr-8 h-[34px] text-[12.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] focus:outline-none cursor-pointer"
            >
              {locations.map(l => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5">
        {[
          {
            label: "Comandă nouă",
            href: "/horeca/comenzi/nou",
            icon: <Plus className="w-4 h-4 shrink-0" />,
            primary: true,
          },
          {
            label: "Kiosk Monitor",
            href: "/horeca/test",
            icon: <MonitorSmartphone className="w-4 h-4 shrink-0" />,
          },
          {
            label: "Management ture",
            href: "/horeca/tura",
            icon: <History className="w-4 h-4 shrink-0" />,
          },
          {
            label: "Meniu / Rețetar",
            href: "/horeca/meniu",
            icon: <UtensilsCrossed className="w-4 h-4 shrink-0" />,
          },
          {
            label: "Mese & Sală",
            href: "/horeca/mese",
            icon: <MapPin className="w-4 h-4 shrink-0" />,
          },
          {
            label: "Delivery",
            href: "/horeca/delivery",
            icon: <Truck className="w-4 h-4 shrink-0" />,
          },
        ].map(a => (
          <Link key={a.href} href={a.href}>
            <button
              type="button"
              className={`w-full flex items-center justify-center gap-2 h-10 px-3 text-[13px] font-semibold transition-all cursor-pointer truncate ${
                a.primary
                  ? "apple-btn-prominent text-white"
                  : "apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7]"
              }`}
            >
              {a.icon}
              <span className="truncate">{a.label}</span>
            </button>
          </Link>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
          iconBg="bg-[#eefbf3] dark:bg-emerald-500/18"
          label="Vânzări azi"
          value={formatCurrency(
            Number(computedSummary?.totalRevenue || 0),
            "RON"
          )}
          sub={`${computedSummary?.ordersCount || 0} comenzi înregistrate`}
        />
        <KpiCard
          icon={<Clock className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />}
          iconBg="bg-[#f2f4f7] dark:bg-[#2c2c2e]"
          label="Comenzi active"
          value={String(openOrders.length)}
          sub="în curs de procesare"
        />
        <KpiCard
          icon={<Truck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
          iconBg="bg-[#fff6eb] dark:bg-amber-500/18"
          label="Delivery azi"
          value={formatCurrency(
            Number(computedSummary?.byType?.delivery || 0),
            "RON"
          )}
          sub="Platforme + Telefon"
        />
        <KpiCard
          icon={<Banknote className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />}
          iconBg="bg-[#f2f4f7] dark:bg-[#2c2c2e]"
          label="TVA colectat"
          value={formatCurrency(Number(computedSummary?.totalVat || 0), "RON")}
          sub="total azi estimat"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Vânzări pe canal */}
        <div className="apple-surface p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-[#6e6e73] dark:text-[#98989d]" />
            <h2 className="text-[#1d1d1f] dark:text-[#f5f5f7] font-bold text-[15px]">
              Vânzări pe canal — azi
            </h2>
          </div>
          <div className="space-y-4">
            {[
              {
                label: "La masă (Dine-in)",
                value: computedSummary?.byType?.dine_in || 0,
                color: "bg-primary",
              },
              {
                label: "Ridicare (Takeaway)",
                value: computedSummary?.byType?.takeaway || 0,
                color: "bg-[#0071e3] dark:bg-[#0a84ff]",
              },
              {
                label: "Livrare (Delivery)",
                value: computedSummary?.byType?.delivery || 0,
                color: "bg-[#8e8e93]",
              },
            ].map(item => {
              const total = Number(computedSummary?.totalRevenue || 1);
              const pct = total > 0 ? (Number(item.value) / total) * 100 : 0;
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-[13px] mb-1.5 font-medium tabular-nums">
                    <span className="text-[#6e6e73] dark:text-[#98989d]">
                      {item.label}
                    </span>
                    <span className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
                      {formatCurrency(Number(item.value), "RON")}
                    </span>
                  </div>
                  <div className="h-2 bg-[#f2f2f7] dark:bg-[#2c2c2e] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Delivery platforms */}
        <div className="apple-surface p-5">
          <div className="flex items-center gap-2 mb-4">
            <Truck className="w-4 h-4 text-[#6e6e73] dark:text-[#98989d]" />
            <h2 className="text-[#1d1d1f] dark:text-[#f5f5f7] font-bold text-[15px] tabular-nums">
              Platforme delivery — {thisMonth}
            </h2>
          </div>
          {deliveryReport &&
          Object.keys(deliveryReport.byPlatform).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(deliveryReport.byPlatform).map(
                ([platform, data]) => (
                  <div
                    key={platform}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.04] transition-colors tabular-nums"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{
                          backgroundColor:
                            PLATFORM_COLORS[platform] || "#8e8e93",
                        }}
                      />
                      <span className="text-[#1d1d1f] dark:text-[#ebebf5] font-semibold text-[13.5px] capitalize">
                        {platform.replace("_", " ")}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-[#1d1d1f] dark:text-[#f5f5f7] text-[13.5px] font-semibold">
                        {formatCurrency(data.revenue, "RON")}
                      </p>
                      <p className="text-[#6e6e73] dark:text-[#98989d] text-[11.5px]">
                        -{formatCurrency(data.commission, "RON")} comision
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-[#8e8e93]">
              <Truck className="w-8 h-8 mb-2 opacity-25" />
              <p className="text-[13px] text-[#6e6e73] dark:text-[#98989d]">
                Nicio comandă delivery înregistrată luna aceasta
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Comenzi active */}
      <div className="apple-surface overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-black/[0.05] dark:border-white/[0.07] bg-[#fafafa] dark:bg-white/[0.025] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ChefHat className="w-4 h-4 text-[#6e6e73] dark:text-[#98989d]" />
            <h2 className="text-[#1d1d1f] dark:text-[#f5f5f7] font-bold text-[15px] tabular-nums">
              Comenzi active ({openOrders.length})
            </h2>
          </div>
          <Link href="/horeca/comenzi">
            <button
              type="button"
              className="apple-btn-glass text-xs font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] px-3.5 h-8 cursor-pointer"
            >
              Vezi toate comenzile
            </button>
          </Link>
        </div>
        {openOrders.length === 0 ? (
          <div className="p-8 text-center text-[#6e6e73] dark:text-[#98989d]">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-25" />
            <p className="text-[13px]">Nicio comandă activă momentan.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
                <tr className="text-[#6e6e73] dark:text-[#98989d] text-left">
                  <th className="px-4 py-3 text-center w-12 text-[12px] font-medium">
                    Nr.
                  </th>
                  <th className="px-4 py-3 text-[12px] font-medium">
                    Comandă
                  </th>
                  <th className="px-4 py-3 text-[12px] font-medium">
                    Tip
                  </th>
                  <th className="px-4 py-3 text-[12px] font-medium">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-[12px] font-medium">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06] tabular-nums">
                {openOrders.slice(0, 10).map((order: any, idx: number) => (
                  <tr
                    key={order.id}
                    className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors"
                  >
                    <td className="px-4 py-3 text-center text-[#8e8e93] text-[12px] font-medium">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3 text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold text-[13.5px]">
                      {order.orderNumber}
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge type={order.type || "dine_in"} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status || "draft"} />
                    </td>
                    <td className="px-4 py-3 text-right text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold text-[13.5px]">
                      {formatCurrency(
                        Number(order.totalAmount || order.total || 0),
                        "RON"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  iconBg,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
      <div className="flex items-center justify-between gap-2 w-full">
        <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
          {label}
        </span>
        <span className={`w-7 h-7 rounded-[8px] ${iconBg} flex items-center justify-center shrink-0`}>
          {icon}
        </span>
      </div>
      <div className="tabular-nums min-w-0">
        <p className="text-[#1d1d1f] dark:text-[#f5f5f7] text-[22px] sm:text-[25px] font-bold tracking-[-0.026em] leading-none truncate">
          {value}
        </p>
        <p className="text-[#6e6e73] dark:text-[#98989d] text-[11.5px] mt-1 truncate">{sub}</p>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    dine_in: {
      label: "La masă",
      cls: "bg-[#0071e3]/10 text-[#0071e3] dark:bg-[#0a84ff]/18 dark:text-[#64d2ff] border-[#0071e3]/20",
    },
    takeaway: {
      label: "Ridicare",
      cls: "bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#3a3a3c] dark:text-[#ebebf5] border-black/[0.06] dark:border-white/[0.08]",
    },
    delivery: {
      label: "Livrare",
      cls: "bg-indigo-500/10 text-indigo-700 dark:bg-indigo-500/18 dark:text-indigo-300 border-indigo-500/20",
    },
  };
  const { label, cls } = map[type] || {
    label: type,
    cls: "bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#3a3a3c] dark:text-[#ebebf5] border-black/[0.06]",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border leading-none inline-flex items-center ${cls}`}>
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: {
      label: "Draft",
      cls: "bg-[#f2f2f7] text-[#6e6e73] border-black/[0.06] dark:bg-[#2c2c2e] dark:text-[#98989d] dark:border-white/[0.08]",
    },
    sent: {
      label: "Trimis",
      cls: "bg-[#0071e3]/10 text-[#0071e3] border-[#0071e3]/20 dark:bg-[#0a84ff]/18 dark:text-[#64d2ff]",
    },
    preparing: {
      label: "Preparare",
      cls: "bg-amber-500/12 text-amber-700 border-amber-500/20 dark:bg-amber-500/18 dark:text-amber-300",
    },
    ready: {
      label: "Gata",
      cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:bg-emerald-500/18 dark:text-emerald-300",
    },
    served: {
      label: "Servit",
      cls: "bg-teal-500/10 text-teal-700 border-teal-500/20 dark:bg-teal-500/18 dark:text-teal-300",
    },
    paid: {
      label: "Plătit",
      cls: "bg-[#f2f2f7] text-[#6e6e73] border-black/[0.06] dark:bg-[#2c2c2e] dark:text-[#98989d] dark:border-white/[0.08]",
    },
    cancelled: {
      label: "Anulat",
      cls: "bg-[#ff3b30]/10 text-[#d70015] border-[#ff3b30]/20 dark:bg-[#ff453a]/18 dark:text-[#ff6961]",
    },
  };
  const { label, cls } = map[status] || {
    label: status,
    cls: "bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#98989d] border-black/[0.06]",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border leading-none inline-flex items-center ${cls}`}>
      {label}
    </span>
  );
}
