// HorecaDelivery — UI rules stricte
// search + counter, Nr.Crt. paginat, footer paginare complet, rounded-lg, tabel mereu vizibil

import { useState, useMemo } from "react";
import { usePersistentRowsPerPage } from "@/hooks/usePersistentRowsPerPage";
import {
  Truck,
  Plus,
  ChevronDown,
  Loader2,
  Check,
  X,
  AlertCircle,
  PackageCheck,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/store";

const PLATFORMS = [
  { value: "glovo", label: "Glovo", color: "bg-[#FFC244]" },
  { value: "wolt", label: "Wolt", color: "bg-[#009DE0]" },
  { value: "bolt_food", label: "Bolt Food", color: "bg-[#34D186]" },
  { value: "tazz", label: "Tazz", color: "bg-[#FF3333]" },
  { value: "manual", label: "Manual", color: "bg-purple-500" },
];

const STATUS_FLOW = [
  { value: "new", label: "Nouă", cls: "bg-[#0071e3]/10 text-[#0071e3] dark:bg-[#0a84ff]/18 dark:text-[#64d2ff] border-[#0071e3]/20" },
  {
    value: "accepted",
    label: "Acceptată",
    cls: "bg-amber-500/12 text-amber-700 dark:bg-amber-500/18 dark:text-amber-300 border-amber-500/20",
  },
  {
    value: "preparing",
    label: "Preparare",
    cls: "bg-orange-500/12 text-orange-700 dark:bg-orange-500/18 dark:text-orange-300 border-orange-500/20",
  },
  { value: "ready", label: "Gata", cls: "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300 border-emerald-500/20" },
  {
    value: "picked_up",
    label: "Ridicată",
    cls: "bg-teal-500/10 text-teal-700 dark:bg-teal-500/18 dark:text-teal-300 border-teal-500/20",
  },
  {
    value: "delivered",
    label: "Livrată",
    cls: "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300 border-emerald-500/20",
  },
  { value: "cancelled", label: "Anulată", cls: "bg-[#ff3b30]/10 text-[#d70015] dark:bg-[#ff453a]/18 dark:text-[#ff6961] border-[#ff3b30]/20" },
  { value: "rejected", label: "Respinsă", cls: "bg-[#ff3b30]/10 text-[#d70015] dark:bg-[#ff453a]/18 dark:text-[#ff6961] border-[#ff3b30]/20" },
];

export default function HorecaDelivery() {
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
    null
  );
  const [platformFilter, setPlatformFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [sortCol, setSortCol] = useState<
    "platform" | "total" | "status" | "createdAt"
  >("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = usePersistentRowsPerPage("horeca_delivery", 15);

  const [form, setForm] = useState({
    platform: "manual" as "glovo" | "wolt" | "bolt_food" | "tazz" | "manual",
    externalId: "",
    customerName: "",
    customerPhone: "",
    deliveryAddress: "",
    subtotal: "",
    commission: "0",
    commissionPct: "0",
    deliveryFee: "0",
    total: "",
    notes: "",
  });

  const { data: localLocations = [] } = trpc.horeca.locations.list.useQuery();
  const { data: bridgeLocations = [] } =
    trpc.horeca.kioskBridge.listLocations.useQuery(undefined, {
      refetchOnWindowFocus: false,
    });

  const mappedBridgeLocations = bridgeLocations.map((bl: any) => ({
    id: `bridge-${bl.id}`,
    name: bl.name,
    iiko_id: bl.id,
  }));

  const locations = [...localLocations, ...mappedBridgeLocations];
  const usesBridge = mappedBridgeLocations.length > 0;

  const locationId = selectedLocationId ?? locations[0]?.id ?? 0;
  const activeLocation = locations.find((l: any) => l.id === locationId);

  const utils = trpc.useUtils();
  const { data: localOrders = [], isLoading: localLoading } =
    trpc.horeca.delivery.list.useQuery(
      { locationId, status: statusFilter || undefined },
      { enabled: locationId > 0 && !usesBridge }
    );

  const { data: bridgeOrdersData, isLoading: bridgeLoading } =
    trpc.horeca.kioskBridge.listOrders.useQuery(
      { limit: 200 },
      { enabled: usesBridge }
    );

  const bridgeOrders = (bridgeOrdersData?.orders || []).filter(
    (o: any) =>
      o.orderType === "delivery" ||
      o.platform === "glovo" ||
      o.platform === "tazz" ||
      o.platform === "wolt" ||
      o.platform === "bolt_food"
  );

  const deliveryOrders = usesBridge
    ? bridgeOrders.map((o: any) => {
        const rawPlat = (o.platform || "manual").toLowerCase();
        let plat = rawPlat;
        if (rawPlat.includes("bolt")) plat = "bolt_food";
        return {
          id: o.id,
          platform: plat,
          externalId: o.orderNumber,
          customerName: o.customerName || o.brand || "Client (Aggregator)",
          customerPhone: o.customerPhone || "",
          deliveryAddress: o.deliveryAddress || "Adresă client",
          subtotal: o.totalAmount,
          commission: 0,
          commissionPct: 0,
          deliveryFee: 0,
          total: o.totalAmount,
          notes: o.notes || "",
          status: o.status === "pending" ? "new" : o.status,
          createdAt: o.createdAt,
          updatedAt: o.createdAt,
        };
      })
    : localOrders;

  const isLoading = usesBridge ? bridgeLoading : localLoading;

  const createMut = trpc.horeca.delivery.create.useMutation({
    onSuccess: () => {
      toast.success("Comandă delivery înregistrată");
      utils.horeca.delivery.list.invalidate();
      setShowAddForm(false);
      setForm({
        platform: "manual",
        externalId: "",
        customerName: "",
        customerPhone: "",
        deliveryAddress: "",
        subtotal: "",
        commission: "0",
        commissionPct: "0",
        deliveryFee: "0",
        total: "",
        notes: "",
      });
    },
    onError: e => toast.error(e.message),
  });

  const updateMut = trpc.horeca.delivery.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status actualizat");
      utils.horeca.delivery.list.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    return [...deliveryOrders]
      .filter(o => !platformFilter || o.platform === platformFilter)
      .sort((a, b) => {
        let av: any = "",
          bv: any = "";
        if (sortCol === "platform") {
          av = a.platform;
          bv = b.platform;
        }
        if (sortCol === "total") {
          av = Number(a.total);
          bv = Number(b.total);
        }
        if (sortCol === "status") {
          av = a.status;
          bv = b.status;
        }
        if (sortCol === "createdAt") {
          av = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          bv = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        }
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
  }, [deliveryOrders, platformFilter, sortCol, sortDir]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted;
    const q = search
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return sorted.filter(o => {
      const searchIn = [
        o.platform,
        o.customerName,
        o.customerPhone,
        o.externalId,
        o.status,
        o.deliveryAddress,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return searchIn.includes(q);
    });
  }, [sorted, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const paginated =
    rowsPerPage === 9999
      ? filtered
      : filtered.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  // KPI
  const totalDelivered = deliveryOrders
    .filter((o: any) => o.status === "delivered")
    .reduce((s: number, o: any) => s + Number(o.total || 0), 0);
  const totalCommission = deliveryOrders
    .filter((o: any) => o.status === "delivered")
    .reduce((s: number, o: any) => s + Number(o.commission || 0), 0);
  const netRevenue = totalDelivered - totalCommission;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.subtotal || !form.total) {
      toast.error("Completează subtotalul și totalul");
      return;
    }
    createMut.mutate({ locationId, ...form });
  }

  return (
    <div className="space-y-4 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-0.5">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
            Delivery
          </h1>
          <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
            Comenzi agregate din toate platformele
            {usesBridge && (
              <span className="text-primary font-semibold ml-1.5">
                (Aggregator Monitor API)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {locations.length > 1 && (
            <div className="relative">
              <select
                value={locationId || ""}
                onChange={e => {
                  const val = e.target.value;
                  setSelectedLocationId(val.startsWith("bridge-") ? (val as any) : Number(val));
                }}
                className="apple-pill-control appearance-none pl-3.5 pr-8 h-[34px] text-[12.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] min-w-[180px] focus:outline-none cursor-pointer"
              >
                {locations.map((l: any) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
          {/* Butonul dispare când form-ul e deschis sau pe bridge */}
          {!showAddForm && !usesBridge && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="apple-btn-prominent inline-flex items-center gap-1.5 text-white px-4 h-[34px] text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Înregistrează comandă
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards — dispar când form e deschis */}
      {!showAddForm && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
            <p className="text-[#6e6e73] dark:text-[#98989d] text-[12.5px] font-medium">
              Vânzări brute delivery
            </p>
            <p className="text-[#1d1d1f] dark:text-[#f5f5f7] text-[22px] sm:text-[25px] font-bold tracking-[-0.026em] leading-none tabular-nums">
              {formatCurrency(totalDelivered, "RON")}
            </p>
          </div>
          <div className="apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
            <p className="text-[#6e6e73] dark:text-[#98989d] text-[12.5px] font-medium">
              Comisioane platforme
            </p>
            <p className="text-[#ff3b30] dark:text-[#ff453a] text-[22px] sm:text-[25px] font-bold tracking-[-0.026em] leading-none tabular-nums">
              -{formatCurrency(totalCommission, "RON")}
            </p>
          </div>
          <div className="apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
            <p className="text-[#6e6e73] dark:text-[#98989d] text-[12.5px] font-medium">
              Net după comisioane
            </p>
            <p className="text-[#1d1d1f] dark:text-[#f5f5f7] text-[22px] sm:text-[25px] font-bold tracking-[-0.026em] leading-none tabular-nums">
              {formatCurrency(netRevenue, "RON")}
            </p>
          </div>
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="apple-surface p-5 sm:p-6">
          <h2 className="text-[#1d1d1f] dark:text-[#f5f5f7] font-bold text-[16px] mb-4">
            Comandă delivery nouă
          </h2>
          <div className="mb-4 flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs bg-amber-500/12 border border-amber-500/20 rounded-xl px-3.5 py-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Integrarea API cu platformele urmează. Deocamdată înregistrați
            manual.
          </div>
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
          >
            <div>
              <label className="block text-[#6e6e73] dark:text-[#98989d] text-[12.5px] font-medium mb-1">
                Platformă *
              </label>
              <select
                value={form.platform}
                onChange={e =>
                  setForm(f => ({ ...f, platform: e.target.value as any }))
                }
                className="apple-input w-full h-10 px-3.5 text-sm cursor-pointer"
              >
                {PLATFORMS.map(p => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[#6e6e73] dark:text-[#98989d] text-[12.5px] font-medium mb-1">
                ID extern
              </label>
              <input
                value={form.externalId}
                onChange={e =>
                  setForm(f => ({ ...f, externalId: e.target.value }))
                }
                placeholder="ID din platformă"
                className="apple-input w-full h-10 px-3.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-[#6e6e73] dark:text-[#98989d] text-[12.5px] font-medium mb-1">
                Client
              </label>
              <input
                value={form.customerName}
                onChange={e =>
                  setForm(f => ({ ...f, customerName: e.target.value }))
                }
                placeholder="Numele clientului"
                className="apple-input w-full h-10 px-3.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-[#6e6e73] dark:text-[#98989d] text-[12.5px] font-medium mb-1">
                Subtotal (RON) *
              </label>
              <input
                type="number"
                step="0.01"
                value={form.subtotal}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    subtotal: e.target.value,
                    total: e.target.value,
                  }))
                }
                className="apple-input w-full h-10 px-3.5 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[#6e6e73] dark:text-[#98989d] text-[12.5px] font-medium mb-1">
                Comision (RON)
              </label>
              <input
                type="number"
                step="0.01"
                value={form.commission}
                onChange={e =>
                  setForm(f => ({ ...f, commission: e.target.value }))
                }
                className="apple-input w-full h-10 px-3.5 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[#6e6e73] dark:text-[#98989d] text-[12.5px] font-medium mb-1">
                Total (RON) *
              </label>
              <input
                type="number"
                step="0.01"
                value={form.total}
                onChange={e => setForm(f => ({ ...f, total: e.target.value }))}
                className="apple-input w-full h-10 px-3.5 text-sm tabular-nums"
              />
            </div>
            <div className="sm:col-span-2 md:col-span-3 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="apple-btn-glass inline-flex items-center gap-1.5 text-[#1d1d1f] dark:text-[#f5f5f7] px-4 h-9 text-xs font-semibold cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Anulează
              </button>
              <button
                type="submit"
                disabled={createMut.isPending}
                className="apple-btn-prominent inline-flex items-center gap-1.5 disabled:opacity-50 text-white px-5 h-9 text-xs font-semibold cursor-pointer"
              >
                {createMut.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                Înregistrează
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Unified Filter & Search Bar inside apple-surface */}
      <div className="apple-surface px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2 w-full min-w-0">
          <div className="apple-segmented flex-wrap sm:flex-nowrap !rounded-2xl sm:!rounded-full max-w-full">
            <button
              type="button"
              data-active={!platformFilter}
              onClick={() => {
                setPlatformFilter("");
                setPage(1);
              }}
              className="apple-segmented-item px-3 text-xs"
            >
              Toate
            </button>
            {PLATFORMS.map(p => (
              <button
                key={p.value}
                type="button"
                data-active={platformFilter === p.value}
                onClick={() => {
                  setPlatformFilter(p.value);
                  setPage(1);
                }}
                className="apple-segmented-item px-3 text-xs"
              >
                <span className={`w-2 h-2 rounded-full ${p.color}`} /> {p.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="apple-pill-control appearance-none pl-3.5 pr-8 h-[34px] text-xs font-medium text-[#1d1d1f] dark:text-[#f5f5f7] focus:outline-none cursor-pointer"
            >
              <option value="">Toate statusurile</option>
              {STATUS_FLOW.map(s => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              style={{
                paddingLeft: 34,
                paddingRight: search ? 84 : 16,
              }}
              className="apple-pill-control rounded-full w-full h-[34px] text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none focus:bg-white dark:focus:bg-[#2c2c2e]"
              placeholder="Caută după platformă, client, adresă, ID..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            {search && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-black/[0.07] dark:bg-white/[0.14] text-[#1d1d1f] dark:text-white rounded-full px-2 py-0.5 text-[10.5px] font-semibold tabular-nums whitespace-nowrap">
                {filtered.length} / {deliveryOrders.length}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
        </div>
      ) : (
        <div className="apple-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
                <tr className="text-[#6e6e73] dark:text-[#98989d] text-left text-[12px] font-medium">
                  <th className="w-12 text-center px-3 py-3 font-medium">
                    Nr.
                  </th>
                  <th
                    className="px-4 py-3 font-medium cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white select-none"
                    onClick={() => toggleSort("platform")}
                  >
                    Platformă{" "}
                    {sortCol === "platform" && (
                      <ChevronDown
                        className={`inline w-3 h-3 ${sortDir === "desc" ? "rotate-180" : ""}`}
                      />
                    )}
                  </th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th
                    className="px-4 py-3 font-medium cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white select-none"
                    onClick={() => toggleSort("status")}
                  >
                    Status{" "}
                    {sortCol === "status" && (
                      <ChevronDown
                        className={`inline w-3 h-3 ${sortDir === "desc" ? "rotate-180" : ""}`}
                      />
                    )}
                  </th>
                  <th
                    className="px-4 py-3 font-medium cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white select-none"
                    onClick={() => toggleSort("total")}
                  >
                    Total{" "}
                    {sortCol === "total" && (
                      <ChevronDown
                        className={`inline w-3 h-3 ${sortDir === "desc" ? "rotate-180" : ""}`}
                      />
                    )}
                  </th>
                  <th className="px-4 py-3 font-medium">Comision</th>
                  <th
                    className="px-4 py-3 font-medium cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white select-none"
                    onClick={() => toggleSort("createdAt")}
                  >
                    Ora{" "}
                    {sortCol === "createdAt" && (
                      <ChevronDown
                        className={`inline w-3 h-3 ${sortDir === "desc" ? "rotate-180" : ""}`}
                      />
                    )}
                  </th>
                  <th className="px-4 py-3 font-medium text-right">Acțiuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06] tabular-nums">
                {paginated.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-[#6e6e73] dark:text-[#98989d] text-[13px]"
                    >
                      Nicio comandă delivery înregistrată
                    </td>
                  </tr>
                )}
                {paginated.map((o: any, i) => {
                  const plat = PLATFORMS.find(p => p.value === o.platform);
                  const isDelivered = o.status === "delivered";
                  const stat = STATUS_FLOW.find(s => s.value === o.status);
                  return (
                    <tr
                      key={o.id || o.externalId}
                      className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors"
                    >
                      <td className="text-center px-3 py-3 text-[#8e8e93] text-xs font-medium">
                        {(safePage - 1) * rowsPerPage + i + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${plat?.color || "bg-[#8e8e93]"}`}
                          />
                          <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-[13.5px]">
                            {plat?.label || o.platform}
                          </span>
                        </div>
                        {o.externalId && (
                          <div className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
                            #{o.externalId}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7] text-[13.5px]">
                          {o.customerName || "-"}
                        </div>
                        {o.deliveryAddress && (
                          <div
                            className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 truncate max-w-[200px]"
                            title={o.deliveryAddress}
                          >
                            {o.deliveryAddress}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border leading-none ${stat?.cls || "bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#98989d] border-black/[0.06]"}`}
                        >
                          {stat?.label || o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-[13.5px]">
                        {formatCurrency(o.total, "RON")}
                      </td>
                      <td className="px-4 py-3 text-[#ff3b30] dark:text-[#ff453a] font-medium text-[13px]">
                        {o.commission > 0
                          ? `-${formatCurrency(o.commission, "RON")}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-[#6e6e73] dark:text-[#98989d] text-[13px]">
                        {o.createdAt
                          ? new Date(o.createdAt).toLocaleTimeString("ro-RO", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!isDelivered && (
                          <button
                            type="button"
                            onClick={() =>
                              updateMut.mutate({
                                id: o.id,
                                status: "delivered",
                              })
                            }
                            disabled={updateMut.isPending}
                            title="Marchează ca livrată"
                            className="apple-btn-glass w-8 h-8 inline-flex items-center justify-center text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                          >
                            <PackageCheck className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Footer paginare */}
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
        </div>
      )}
    </div>
  );
}
