// HorecaOrders — Comenzi HORECA cu UI rules stricte
// search + counter, Nr.Crt. paginat, footer paginare, rounded-lg, tabel mereu vizibil
// Proper Light/Dark mode styling (Premium UI)

import { useState, useMemo } from "react";
import { usePersistentRowsPerPage } from "@/hooks/usePersistentRowsPerPage";
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
    bg: "bg-[#f2f2f7] dark:bg-[#2c2c2e]",
    text: "text-[#6e6e73] dark:text-[#98989d]",
  },
  sent: {
    label: "La bucătărie",
    bg: "bg-[#0071e3]/10 dark:bg-[#0a84ff]/18",
    text: "text-[#0071e3] dark:text-[#64d2ff]",
  },
  preparing: {
    label: "Se prepară",
    bg: "bg-amber-500/12 dark:bg-amber-500/18",
    text: "text-amber-700 dark:text-amber-300",
  },
  ready: {
    label: "Gata (Ready)",
    bg: "bg-emerald-500/10 dark:bg-emerald-500/18",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  paid: {
    label: "Plătită",
    bg: "bg-[#f2f2f7] dark:bg-[#2c2c2e]",
    text: "text-[#1d1d1f] dark:text-[#ebebf5]",
  },
  cancelled: {
    label: "Anulată",
    bg: "bg-[#ff3b30]/10 dark:bg-[#ff453a]/18",
    text: "text-[#d70015] dark:text-[#ff6961]",
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
  const [rowsPerPage, setRowsPerPage] = usePersistentRowsPerPage("horeca_orders", 25);

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
    <div className="space-y-4 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-0.5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
              Comenzi HORECA
            </h1>
            {isFetching && (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#8e8e93]" />
            )}
          </div>
          <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums">
            <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
              {orders.length}
            </strong>{" "}
            comenzi · Total{" "}
            <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
              {formatCurrency(totalAmount, "RON")}
            </strong>
            {usesBridge && (
              <span className="text-primary font-semibold ml-1.5">
                (Smart Kiosk API — Read-only)
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="apple-pill-control px-3 h-[34px] text-[12.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums focus:outline-none cursor-pointer"
          />

          <Link
            href="/horeca/comenzi/nou"
            className="apple-btn-prominent inline-flex items-center gap-1.5 text-white px-4 h-[34px] text-[12.5px] font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Comandă nouă
          </Link>
        </div>
      </div>

      {/* Filters & Search inside apple-surface */}
      <div className="apple-surface px-3 py-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Status filters */}
          <div className="apple-segmented overflow-x-auto no-scrollbar max-w-full shrink-0">
            <button
              type="button"
              data-active={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
              className="apple-segmented-item px-3 text-xs tabular-nums shrink-0"
            >
              Toate ({orders.length})
            </button>
            {Object.entries(STATUS_OPTS).map(([k, v]) => {
              const count = orders.filter((o: any) => o.status === k).length;
              if (count === 0 && statusFilter !== k) return null;
              return (
                <button
                  key={k}
                  type="button"
                  data-active={statusFilter === k}
                  onClick={() => setStatusFilter(k)}
                  className="apple-segmented-item px-3 text-xs tabular-nums shrink-0"
                >
                  {v.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              style={{
                paddingLeft: 34,
                paddingRight: search ? 90 : 16,
              }}
              className="apple-pill-control rounded-full w-full h-[34px] text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none focus:bg-white dark:focus:bg-[#2c2c2e]"
              placeholder="Caută comandă, masă, ospătar..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            {search && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-black/[0.07] dark:bg-white/[0.14] text-[#1d1d1f] dark:text-white rounded-full px-2 py-0.5 text-[10.5px] font-semibold tabular-nums">
                {filtered.length} rezultate
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabel */}
      <div className="apple-surface overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="w-7 h-7 text-primary animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
                <tr className="text-[#6e6e73] dark:text-[#98989d] text-left text-[12px] font-medium">
                  <th className="w-12 text-center px-3 py-3 font-medium">
                    Nr.
                  </th>
                  <th className="px-4 py-3 font-medium">
                    Comandă
                  </th>
                  <th className="px-4 py-3 font-medium">
                    Tip
                  </th>
                  <th className="px-4 py-3 font-medium">
                    Timp
                  </th>
                  <th className="px-4 py-3 font-medium">
                    Total
                  </th>
                  <th className="px-4 py-3 font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06] tabular-nums">
                {paginated.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center text-[#6e6e73] dark:text-[#98989d] text-[13px] py-12"
                    >
                      {search ? "Nicio comandă găsită" : "Nicio comandă azi"}
                    </td>
                  </tr>
                ) : (
                  paginated.map((order: any, idx: number) => {
                    const typeOpt = TYPE_OPTS[
                      order.type as keyof typeof TYPE_OPTS
                    ] || { label: order.type, icon: "" };
                    const stOpt = STATUS_OPTS[
                      order.status as keyof typeof STATUS_OPTS
                    ] || {
                      label: order.status,
                      bg: "bg-[#f2f2f7] dark:bg-[#2c2c2e]",
                      text: "text-[#1d1d1f] dark:text-[#f5f5f7]",
                    };

                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors"
                      >
                        <td className="text-center px-3 py-3 text-[#8e8e93] text-xs font-medium">
                          {(safePage - 1) * rowsPerPage + idx + 1}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold text-[13.5px]">
                              #{order.orderNumber}
                            </span>
                            {order.staffName && (
                              <span className="text-[#6e6e73] dark:text-[#98989d] text-xs font-medium flex items-center gap-1.5 bg-[#f2f2f7] dark:bg-[#2c2c2e] w-fit px-2 py-0.5 rounded-full border border-black/[0.06] dark:border-white/[0.08]">
                                {order._brand ? (
                                  <img src={`/brands/${order._brand}-logo.png`} onError={e => { e.currentTarget.src = "/logo.png"; }} alt="Brand Logo" className="w-4 h-4 object-contain rounded-full bg-white p-[1px]" />
                                ) : (
                                  <div className="w-4 h-4 rounded-full bg-[#0071e3]/12 dark:bg-[#0a84ff]/20 flex items-center justify-center text-[8px] font-bold text-[#0071e3] dark:text-[#64d2ff]">
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
                            <span className="text-[#1d1d1f] dark:text-[#ebebf5] font-medium text-[13px] flex items-center gap-1.5">
                              {typeOpt.icon} {typeOpt.label}
                            </span>
                            {order.type === "dine_in" && (
                              <span className="text-[#6e6e73] dark:text-[#98989d] text-xs">
                                Masă: {order.tableNumber || "?"}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#6e6e73] dark:text-[#98989d] font-medium text-[13px] whitespace-nowrap">
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleTimeString(
                                "ro-RO",
                                { hour: "2-digit", minute: "2-digit" }
                              )
                            : "—"}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-[13.5px]">
                          {formatCurrency(Number(order.totalAmount), "RON")}
                        </td>
                        <td className="px-4 py-3">
                          <div className="relative inline-block w-full min-w-[125px] max-w-[160px]">
                            <select
                              value={order.status || "draft"}
                              onChange={e =>
                                updateStatusMut.mutate({
                                  id: order.id,
                                  status: e.target.value as any,
                                })
                              }
                              className={`appearance-none border-none !rounded-full pl-3 pr-7 py-1 w-full text-[11.5px] font-semibold focus:ring-2 focus:ring-primary/30 cursor-pointer ${stOpt.bg} ${stOpt.text}`}
                            >
                              {Object.entries(STATUS_OPTS).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v.label}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className={`w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${stOpt.text} opacity-70`} />
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
          <div className="px-4 sm:px-5 py-3 border-t border-black/[0.05] dark:border-white/[0.07] flex items-center justify-between flex-wrap gap-2 bg-[#fafafa] dark:bg-white/[0.02] text-xs text-[#6e6e73] dark:text-[#98989d] tabular-nums">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                Afișează
                <div className="relative inline-block">
                  <select
                    value={rowsPerPage}
                    onChange={e => {
                      setRowsPerPage(Number(e.target.value));
                      setPage(1);
                    }}
                    className="apple-pill-control appearance-none pl-3 pr-7 h-7 text-xs text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={9999}>Toți</option>
                  </select>
                  <ChevronDown className="w-3 h-3 text-[#6e6e73] dark:text-[#98989d] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </span>
              <span className="hidden sm:inline-block whitespace-nowrap">
                Total înregistrări:{" "}
                <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                  {filtered.length}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap">
                Pagina {safePage} din {totalPages}
              </span>
              <button
                type="button"
                className="apple-btn-glass w-7 h-7 flex items-center justify-center text-[#1d1d1f] dark:text-[#f5f5f7] disabled:opacity-40 cursor-pointer"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="apple-btn-glass w-7 h-7 flex items-center justify-center text-[#1d1d1f] dark:text-[#f5f5f7] disabled:opacity-40 cursor-pointer"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages || totalPages === 0}
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
