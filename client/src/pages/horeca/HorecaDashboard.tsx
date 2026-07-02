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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <UtensilsCrossed className="w-16 h-16 text-slate-400" />
        <p className="text-slate-500 font-medium text-lg">
          Nicio locație HORECA configurată
        </p>
        <Link href="/horeca/locatii">
          <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg transition-colors shadow-sm">
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
          <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
            <BarChart2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Smart HORECA
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
              Tablou de bord · {today}
              {usesBridge && (
                <span className="text-primary font-bold ml-2">
                  (Smart Kiosk API)
                </span>
              )}
            </p>
          </div>
        </div>
        {locations.length > 1 && (
          <div className="relative">
            <select
              value={locationId || ""}
              onChange={e => {
                const val = e.target.value;
                setSelectedLocationId(val.startsWith('bridge-') ? val as any : Number(val));
              }}
              className="appearance-none pr-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3 py-2 rounded-full text-sm font-medium focus:outline-none focus:border-blue-500 shadow-sm"
            >
              {locations.map(l => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          {
            label: "Comandă nouă",
            href: "/horeca/comenzi/nou",
            icon: <Plus className="w-4 h-4" />,
            primary: true,
          },
          {
            label: "Kiosk Monitor",
            href: "/horeca/test",
            icon: <MonitorSmartphone className="w-4 h-4" />,
          },
          {
            label: "Management Ture",
            href: "/horeca/tura",
            icon: <History className="w-4 h-4" />,
          },
          {
            label: "Meniu / Rețetar",
            href: "/horeca/meniu",
            icon: <UtensilsCrossed className="w-4 h-4" />,
          },
          {
            label: "Mese & Sală",
            href: "/horeca/mese",
            icon: <MapPin className="w-4 h-4" />,
          },
          {
            label: "Delivery",
            href: "/horeca/delivery",
            icon: <Truck className="w-4 h-4" />,
          },
        ].map(a => (
          <Link key={a.href} href={a.href}>
            <button
              className={`w-full flex items-center justify-center gap-2 ${a.primary ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md border-transparent" : "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-sm"} px-4 py-3 rounded-xl text-sm font-bold transition-all`}
            >
              {a.icon}
              {a.label}
            </button>
          </Link>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={
            <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          }
          label="Vânzări azi"
          value={formatCurrency(
            Number(computedSummary?.totalRevenue || 0),
            "RON"
          )}
          sub={`${computedSummary?.ordersCount || 0} comenzi înregistrate`}
        />
        <KpiCard
          icon={<Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
          label="Comenzi active"
          value={String(openOrders.length)}
          sub="în curs de procesare"
        />
        <KpiCard
          icon={<Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
          label="Delivery azi"
          value={formatCurrency(
            Number(computedSummary?.byType?.delivery || 0),
            "RON"
          )}
          sub="Platforme + Telefon"
        />
        <KpiCard
          icon={
            <Banknote className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          }
          label="TVA colectat"
          value={formatCurrency(Number(computedSummary?.totalVat || 0), "RON")}
          sub="total azi estimat"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Vânzări pe canal */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-slate-900 dark:text-white font-bold text-lg">
              Vânzări pe canal — azi
            </h2>
          </div>
          <div className="space-y-4">
            {[
              {
                label: "La masă (Dine-in)",
                value: computedSummary?.byType?.dine_in || 0,
                color: "bg-blue-600",
              },
              {
                label: "Ridicare (Takeaway)",
                value: computedSummary?.byType?.takeaway || 0,
                color: "bg-blue-400",
              },
              {
                label: "Livrare (Delivery)",
                value: computedSummary?.byType?.delivery || 0,
                color: "bg-slate-400",
              },
            ].map(item => {
              const total = Number(computedSummary?.totalRevenue || 1);
              const pct = total > 0 ? (Number(item.value) / total) * 100 : 0;
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1.5 font-medium">
                    <span className="text-slate-600 dark:text-slate-400">
                      {item.label}
                    </span>
                    <span className="text-slate-900 dark:text-white font-bold">
                      {formatCurrency(Number(item.value), "RON")}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-slate-900 dark:text-white font-bold text-lg">
              Platforme Delivery — {thisMonth}
            </h2>
          </div>
          {deliveryReport &&
          Object.keys(deliveryReport.byPlatform).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(deliveryReport.byPlatform).map(
                ([platform, data]) => (
                  <div
                    key={platform}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor:
                            PLATFORM_COLORS[platform] || "#64748b",
                        }}
                      />
                      <span className="text-slate-700 dark:text-slate-300 font-bold capitalize">
                        {platform.replace("_", " ")}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-900 dark:text-white text-sm font-bold">
                        {formatCurrency(data.revenue, "RON")}
                      </p>
                      <p className="text-slate-500 text-xs font-medium">
                        -{formatCurrency(data.commission, "RON")} comision
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-slate-400">
              <Truck className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-sm font-medium">
                Nicio comandă delivery înregistrată luna aceasta
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Comenzi active */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-slate-900 dark:text-white font-bold text-lg">
              Comenzi Active ({openOrders.length})
            </h2>
          </div>
          <Link href="/horeca/comenzi">
            <button className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 rounded-lg">
              Vezi toate comenzile
            </button>
          </Link>
        </div>
        {openOrders.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="font-medium">Nicio comandă activă momentan.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <tr className="text-slate-600 dark:text-slate-400 text-left font-semibold">
                  <th className="px-4 py-3 text-center w-12 text-xs uppercase tracking-wider">
                    Nr.
                  </th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wider">
                    Comandă
                  </th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wider">
                    Tip
                  </th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {openOrders.slice(0, 10).map((order, idx) => (
                  <tr
                    key={order.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-center text-slate-400 font-medium">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3 text-slate-900 dark:text-white font-bold">
                      {order.orderNumber}
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge type={order.type || "dine_in"} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status || "draft"} />
                    </td>
                    <td className="px-4 py-3 text-right text-blue-600 dark:text-blue-400 font-black">
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
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg">
          {icon}
        </div>
        <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="text-slate-900 dark:text-white text-2xl font-black">
        {value}
      </p>
      <p className="text-slate-500 text-xs font-medium mt-1">{sub}</p>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    dine_in: {
      label: "La masă",
      cls: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20",
    },
    takeaway: {
      label: "Ridicare",
      cls: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    },
    delivery: {
      label: "Livrare",
      cls: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20",
    },
  };
  const { label, cls } = map[type] || {
    label: type,
    cls: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return (
    <span className={`px-2 py-1 rounded-md text-xs font-bold border ${cls}`}>
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: {
      label: "Draft",
      cls: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
    },
    sent: {
      label: "Trimis",
      cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
    },
    preparing: {
      label: "Preparare",
      cls: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20",
    },
    ready: {
      label: "Gata",
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
    },
    served: {
      label: "Servit",
      cls: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20",
    },
    paid: {
      label: "Plătit",
      cls: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700",
    },
    cancelled: {
      label: "Anulat",
      cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
    },
  };
  const { label, cls } = map[status] || {
    label: status,
    cls: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span className={`px-2 py-1 rounded-md text-xs font-bold border ${cls}`}>
      {label}
    </span>
  );
}
