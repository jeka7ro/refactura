// HorecaOrders — Comenzi HORECA cu UI rules stricte
// search + counter, Nr.Crt. paginat, footer paginare, rounded-lg, tabel mereu vizibil
// Proper Light/Dark mode styling (Premium UI)

import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  Search,
  Plus,
  Receipt,
  Clock,
  MapPin,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  ChefHat,
  Truck,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatCurrency, formatDate } from "@/lib/store";
import { toast } from "sonner";

const STATUS_OPTS = {
  draft: {
    label: "Schiță",
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-600 dark:text-slate-400",
  },
  sent: {
    label: "La bucătărie",
    bg: "bg-blue-100 dark:bg-blue-500/20",
    text: "text-blue-700 dark:text-blue-400",
  },
  preparing: {
    label: "Se prepară",
    bg: "bg-amber-100 dark:bg-amber-500/20",
    text: "text-amber-700 dark:text-amber-400",
  },
  ready: {
    label: "Gata (Ready)",
    bg: "bg-emerald-100 dark:bg-emerald-500/20",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  paid: {
    label: "Plătită",
    bg: "bg-slate-200 dark:bg-slate-700",
    text: "text-slate-900 dark:text-slate-300",
  },
  cancelled: {
    label: "Anulată",
    bg: "bg-red-100 dark:bg-red-500/20",
    text: "text-red-700 dark:text-red-400",
  },
};

const TYPE_OPTS = {
  dine_in: { label: "La Masă", icon: <ChefHat className="w-4 h-4" /> },
  takeaway: { label: "Pick-up", icon: <Truck className="w-4 h-4" /> },
  delivery: { label: "Delivery", icon: <Truck className="w-4 h-4" /> },
};

export default function HorecaOrders() {
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
    null
  );
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const { data: locations = [] } = trpc.horeca.locations.list.useQuery();
  const locationId = selectedLocationId ?? locations[0]?.id ?? 0;

  const {
    data: localOrders = [],
    isLoading,
    isFetching,
  } = trpc.horeca.orders.list.useQuery(
    { locationId, date },
    { enabled: locationId > 0, refetchInterval: 15000 }
  );

  // Smart Kiosk Bridge — fetch real orders (from IIKO/POS/Smart Kiosk)
  const { data: bridgeOrdersData, isLoading: bridgeLoading } =
    trpc.horeca.kioskBridge.listOrders.useQuery(
      { limit: 100 },
      {
        refetchInterval: 10000,
        refetchOnWindowFocus: false,
      }
    );

  const usesBridge = (bridgeOrdersData?.orders || []).length > 0;
  const orders = usesBridge
    ? (bridgeOrdersData?.orders || []).map((o: any, idx: number) => ({
        id: idx + 1,
        orderNumber: String(o.orderNumber),
        tableNumber: o.tableNumber || null,
        staffName: o.brand || null,
        type: o.orderType || "takeaway",
        status:
          o.status === "pending"
            ? "sent"
            : o.status === "preparing"
              ? "preparing"
              : o.status === "ready"
                ? "ready"
                : o.status === "completed"
                  ? "paid"
                  : o.status || "draft",
        totalAmount: o.totalAmount || 0,
        guestCount: null,
        createdAt: new Date(o.createdAt),
        _bridgeId: o._id,
        _brand: o.brand,
        _channel: o.channel,
        _locationName: o.locationName,
        _items: o.items || [],
      }))
    : localOrders;

  const updateStatusMut = trpc.horeca.orders.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status actualizat");
    },
    onError: e => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    let result = orders;
    if (statusFilter !== "all") {
      result = result.filter((o: any) => o.status === statusFilter);
    }
    if (search.trim()) {
      const q = search
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      result = result.filter((o: any) =>
        [o.orderNumber, o.tableNumber, o.staffName, o._brand, o._locationName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .includes(q)
      );
    }
    return result;
  }, [orders, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const paginated =
    rowsPerPage === 9999
      ? filtered
      : filtered.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  const totalAmount = filtered.reduce(
    (sum: number, o: any) => sum + Number(o.totalAmount || 0),
    0
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
            <Receipt className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Comenzi HORECA{" "}
              {isFetching && (
                <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
              )}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
              {orders.length} comenzi · Total{" "}
              {formatCurrency(totalAmount, "RON")}
              {usesBridge && (
                <span className="text-primary font-semibold">
                  {" "}
                  (Smart Kiosk API — READ-ONLY)
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {locations.length > 1 && (
            <div className="relative">
              <select
                value={locationId || ""}
                onChange={e => {
                  const val = e.target.value;
                  setSelectedLocationId(val.startsWith('bridge-') ? val as any : Number(val));
                }}
                className="appearance-none pr-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3 py-2 !rounded-full text-sm font-medium shadow-sm focus:outline-none focus:border-blue-500"
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
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3 py-2 rounded-full text-sm font-medium shadow-sm focus:outline-none focus:border-blue-500"
          />

          <Link
            href="/horeca/pos"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full text-sm font-bold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Comandă Nouă
          </Link>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Status filters */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm w-fit">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all shadow-sm border ${statusFilter === "all" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white border-slate-200 dark:border-slate-600" : "bg-transparent text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white"}`}
          >
            Toate ({orders.length})
          </button>
          {Object.entries(STATUS_OPTS).map(([k, v]) => {
            const count = orders.filter(o => o.status === k).length;
            if (count === 0 && statusFilter !== k) return null;
            return (
              <button
                key={k}
                onClick={() => setStatusFilter(k)}
                className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all shadow-sm border ${statusFilter === k ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white border-slate-200 dark:border-slate-600" : "bg-transparent text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white"}`}
              >
                {v.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 z-10" />
          <input
            className="w-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 shadow-sm transition-colors rounded-full"
            style={{
              paddingLeft: 36,
              paddingRight: search ? 90 : 16,
              paddingTop: 10,
              paddingBottom: 10,
              fontSize: 14,
            }}
            placeholder="Caută comandă, masă, ospătar..."
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          {search && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-100 dark:bg-blue-600 text-blue-800 dark:text-white rounded-full px-2.5 py-0.5 text-xs font-bold">
              {filtered.length} rezultate
            </div>
          )}
        </div>
      </div>

      {/* Tabel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                <tr className="text-slate-600 dark:text-slate-400 text-left">
                  <th
                    style={{ width: 50, textAlign: "center" }}
                    className="px-3 py-3 font-semibold text-xs uppercase tracking-wider"
                  >
                    Nr.
                  </th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">
                    Comandă
                  </th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">
                    Tip
                  </th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">
                    Timp
                  </th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginated.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center text-slate-500 py-12"
                    >
                      {search ? "Nicio comandă găsită" : "Nicio comandă azi"}
                    </td>
                  </tr>
                ) : (
                  paginated.map((order, idx) => {
                    const typeOpt = TYPE_OPTS[
                      order.type as keyof typeof TYPE_OPTS
                    ] || { label: order.type, icon: "🏷️" };
                    const stOpt = STATUS_OPTS[
                      order.status as keyof typeof STATUS_OPTS
                    ] || {
                      label: order.status,
                      bg: "bg-slate-800",
                      text: "text-white",
                    };

                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td
                          style={{ textAlign: "center" }}
                          className="px-3 py-3 text-slate-400 dark:text-slate-500 font-medium"
                        >
                          {(safePage - 1) * rowsPerPage + idx + 1}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-900 dark:text-white font-bold text-base">
                              #{order.orderNumber}
                            </span>
                            {order.staffName && (
                              <span className="text-slate-500 text-xs font-medium flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 w-fit px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
                                {order._brand ? (
                                  <img src={`/brands/${order._brand}-logo.png`} onError={(e) => { e.currentTarget.src = "/logo.png"; }} alt="Brand Logo" className="w-4 h-4 object-contain rounded-full bg-white p-[1px] shadow-sm" />
                                ) : (
                                  <div className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-[8px] font-bold text-blue-700 dark:text-blue-300">
                                    {order.staffName.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                {order.staffName}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1.5">
                              {typeOpt.icon} {typeOpt.label}
                            </span>
                            {order.type === "dine_in" && (
                              <span className="text-slate-500 text-xs font-semibold">
                                Masă: {order.tableNumber || "?"}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap">
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleTimeString(
                                "ro-RO",
                                { hour: "2-digit", minute: "2-digit" }
                              )
                            : "—"}
                        </td>
                        <td className="px-4 py-3 font-black text-slate-900 dark:text-white text-base">
                          {formatCurrency(Number(order.totalAmount), "RON")}
                        </td>
                        <td className="px-4 py-3">
                          <div className="relative inline-block w-full min-w-[120px]">
                            <select
                              value={order.status || "draft"}
                              onChange={e =>
                                updateStatusMut.mutate({
                                  id: order.id,
                                  status: e.target.value as any,
                                })
                              }
                              className={`appearance-none border-none !rounded-full pl-3 pr-8 py-1.5 w-full text-xs font-bold focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer ${stOpt.bg} ${stOpt.text}`}
                            >
                              {Object.entries(STATUS_OPTS).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v.label}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className={`w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${stOpt.text} opacity-70`} />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer paginare */}
        {!isLoading && (
          <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80 rounded-b-xl">
            <div className="flex items-center gap-4">
              <span className="text-slate-500 dark:text-slate-400 text-sm font-medium flex items-center gap-2 whitespace-nowrap">
                Afișează
                <div className="relative inline-block">
                  <select
                    value={rowsPerPage}
                    onChange={e => {
                      setRowsPerPage(Number(e.target.value));
                      setPage(1);
                    }}
                    className="appearance-none pr-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 !rounded-full pl-3 py-1 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:border-blue-500 shadow-sm"
                  >
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={9999}>Toți</option>
                  </select>
                  <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </span>
              <span className="text-slate-500 dark:text-slate-400 text-sm font-medium hidden sm:inline-block whitespace-nowrap">
                Total înregistrări:{" "}
                <strong className="text-slate-900 dark:text-white">
                  {filtered.length}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-500 dark:text-slate-400 text-sm font-medium whitespace-nowrap">
                Pagina {safePage} din {totalPages}
              </span>
              <button
                className="flex items-center justify-center transition-all"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 9999,
                  background:
                    safePage === 1 ? "transparent" : "var(--background)",
                  color: "var(--foreground)",
                  border: safePage === 1 ? "none" : "1px solid var(--border)",
                  cursor: safePage === 1 ? "not-allowed" : "pointer",
                  opacity: safePage === 1 ? 0.4 : 1,
                }}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                className="flex items-center justify-center transition-all"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages || totalPages === 0}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 9999,
                  background:
                    safePage === totalPages || totalPages === 0
                      ? "transparent"
                      : "var(--background)",
                  color: "var(--foreground)",
                  border:
                    safePage === totalPages || totalPages === 0
                      ? "none"
                      : "1px solid var(--border)",
                  cursor:
                    safePage === totalPages || totalPages === 0
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    safePage === totalPages || totalPages === 0 ? 0.4 : 1,
                }}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
