// HorecaDelivery — UI rules stricte
// search + counter, Nr.Crt. paginat, footer paginare complet, rounded-lg, tabel mereu vizibil

import { useState, useMemo } from "react";
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
  { value: "new", label: "Nouă", cls: "bg-blue-500/20 text-blue-300" },
  {
    value: "accepted",
    label: "Acceptată",
    cls: "bg-yellow-500/20 text-yellow-300",
  },
  {
    value: "preparing",
    label: "Preparare",
    cls: "bg-orange-500/20 text-orange-300",
  },
  { value: "ready", label: "Gata", cls: "bg-green-500/20 text-green-300" },
  {
    value: "picked_up",
    label: "Ridicată",
    cls: "bg-teal-500/20 text-teal-300",
  },
  {
    value: "delivered",
    label: "Livrată ✓",
    cls: "bg-emerald-500/20 text-emerald-300",
  },
  { value: "cancelled", label: "Anulată", cls: "bg-red-500/20 text-red-300" },
  { value: "rejected", label: "Respinsă", cls: "bg-red-700/20 text-red-400" },
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
  const [rowsPerPage, setRowsPerPage] = useState(15);

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
    .filter(o => o.status === "delivered")
    .reduce((s, o) => s + Number(o.total || 0), 0);
  const totalCommission = deliveryOrders
    .filter(o => o.status === "delivered")
    .reduce((s, o) => s + Number(o.commission || 0), 0);
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-lg">
            <Truck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Delivery</h1>
            <p className="text-muted-foreground text-sm">
              Comenzi agregate din toate platformele
              {usesBridge && (
                <span className="text-primary font-bold ml-2">
                  (Aggregator Monitor API)
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {locations.length > 1 && (
            <div className="relative">
              <select
                value={locationId || ""}
                onChange={e => {
                  const val = e.target.value;
                  setSelectedLocationId(val.startsWith('bridge-') ? val as any : Number(val));
                }}
                className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2 font-semibold shadow-sm min-w-[200px] rounded-lg focus:outline-none focus:border-blue-500 pr-10"
              >
                {locations.map((l: any) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
          {/* Butonul dispare când form-ul e deschis sau pe bridge */}
          {!showAddForm && !usesBridge && (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Înregistrează comandă
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards — dispar când form e deschis */}
      {!showAddForm && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border border-chart-1/30 rounded-2xl p-4 shadow-sm">
            <p className="text-muted-foreground text-xs mb-1">
              Vânzări brute delivery
            </p>
            <p className="text-foreground text-xl font-bold">
              {formatCurrency(totalDelivered, "RON")}
            </p>
          </div>
          <div className="bg-card border border-destructive/30 rounded-2xl p-4 shadow-sm">
            <p className="text-muted-foreground text-xs mb-1">
              Comisioane platforme
            </p>
            <p className="text-destructive text-xl font-bold">
              -{formatCurrency(totalCommission, "RON")}
            </p>
          </div>
          <div className="bg-card border border-chart-1/30 rounded-2xl p-4 shadow-sm">
            <p className="text-muted-foreground text-xs mb-1">
              Net după comisioane
            </p>
            <p className="text-chart-1 text-xl font-bold">
              {formatCurrency(netRevenue, "RON")}
            </p>
          </div>
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-foreground font-semibold mb-4">
            Comandă delivery nouă
          </h2>
          <div className="mb-3 flex items-center gap-2 text-chart-3 text-sm bg-chart-3/10 border border-chart-3/30 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Integrarea API cu platformele urmează. Deocamdată înregistrați
            manual.
          </div>
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-2 md:grid-cols-3 gap-4"
          >
            <div>
              <label className="block text-muted-foreground text-xs mb-1">
                Platformă *
              </label>
              <select
                value={form.platform}
                onChange={e =>
                  setForm(f => ({ ...f, platform: e.target.value as any }))
                }
                className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              >
                {PLATFORMS.map(p => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-muted-foreground text-xs mb-1">
                ID extern
              </label>
              <input
                value={form.externalId}
                onChange={e =>
                  setForm(f => ({ ...f, externalId: e.target.value }))
                }
                placeholder="ID din platformă"
                className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-muted-foreground text-xs mb-1">
                Client
              </label>
              <input
                value={form.customerName}
                onChange={e =>
                  setForm(f => ({ ...f, customerName: e.target.value }))
                }
                placeholder="Numele clientului"
                className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-muted-foreground text-xs mb-1">
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
                className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-muted-foreground text-xs mb-1">
                Comision (RON)
              </label>
              <input
                type="number"
                step="0.01"
                value={form.commission}
                onChange={e =>
                  setForm(f => ({ ...f, commission: e.target.value }))
                }
                className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-muted-foreground text-xs mb-1">
                Total (RON) *
              </label>
              <input
                type="number"
                step="0.01"
                value={form.total}
                onChange={e => setForm(f => ({ ...f, total: e.target.value }))}
                className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div className="md:col-span-3 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="flex items-center gap-1 bg-secondary text-secondary-foreground hover:bg-secondary/80 px-3 py-2 rounded-full text-sm transition-colors"
              >
                <X className="w-3 h-3" /> Anulează
              </button>
              <button
                type="submit"
                disabled={createMut.isPending}
                className="flex items-center gap-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground px-3 py-2 rounded-full text-sm transition-colors"
              >
                {createMut.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
                Înregistrează
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Platform filter pills + status filter */}
      <div className="flex gap-2 flex-wrap items-center">
        <button
          onClick={() => {
            setPlatformFilter("");
            setPage(1);
          }}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${!platformFilter ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
        >
          Toate
        </button>
        {PLATFORMS.map(p => (
          <button
            key={p.value}
            onClick={() => {
              setPlatformFilter(p.value);
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${platformFilter === p.value ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
          >
            <div className={`w-2 h-2 rounded-full ${p.color}`} /> {p.label}
          </button>
        ))}
        <div className="relative ml-auto">
          <select
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="appearance-none bg-background border border-border text-foreground pl-3 pr-8 py-1 !rounded-full text-xs focus:outline-none focus:border-primary shadow-sm"
          >
            <option value="">Toate statusurile</option>
            {STATUS_FLOW.map(s => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Search bar — regula 1 */}
      <div style={{ position: "relative" }}>
        <Search
          className="w-4 h-4 text-muted-foreground"
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 1,
          }}
        />
        <input
          className="w-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 shadow-sm transition-colors rounded-full"
          style={{
            paddingLeft: 36,
            paddingRight: search ? 80 : 16,
            paddingTop: 10,
            paddingBottom: 10,
            fontSize: 14,
          }}
          placeholder="Caută după platformă, client, adresă, ID extern..."
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        {search && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 bg-accent text-accent-foreground rounded-md px-3 py-1 text-[11px] font-bold whitespace-nowrap">
            {filtered.length} / {deliveryOrders.length}
          </div>
        )}
      </div>

      {/* Table — mereu vizibil */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <span className="text-muted-foreground text-sm">
              Total:{" "}
              <strong className="text-foreground">{filtered.length}</strong>{" "}
              înregistrări
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50">
                <tr className="text-muted-foreground text-left">
                  <th
                    style={{ width: 50, textAlign: "center" }}
                    className="px-3 py-3 font-medium"
                  >
                    Nr.
                  </th>
                  <th
                    className="px-4 py-3 font-medium cursor-pointer hover:text-foreground"
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
                    className="px-4 py-3 font-medium cursor-pointer hover:text-foreground"
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
                    className="px-4 py-3 font-medium cursor-pointer hover:text-foreground"
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
                    className="px-4 py-3 font-medium cursor-pointer hover:text-foreground"
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
              <tbody className="divide-y divide-border">
                {paginated.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-muted-foreground"
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
                      className="hover:bg-secondary/30 transition-colors"
                    >
                      <td
                        style={{
                          textAlign: "center",
                          color: "var(--muted-foreground)",
                          fontSize: 13,
                        }}
                        className="px-3 py-3"
                      >
                        {(safePage - 1) * rowsPerPage + i + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${plat?.color || "bg-slate-300"}`}
                          />
                          <span className="font-medium text-foreground">
                            {plat?.label || o.platform}
                          </span>
                        </div>
                        {o.externalId && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            #{o.externalId}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">
                          {o.customerName || "-"}
                        </div>
                        {o.deliveryAddress && (
                          <div
                            className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]"
                            title={o.deliveryAddress}
                          >
                            {o.deliveryAddress}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${stat?.cls || "bg-muted text-muted-foreground border-border"}`}
                        >
                          {stat?.label || o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {formatCurrency(o.total, "RON")}
                      </td>
                      <td className="px-4 py-3 text-destructive font-medium">
                        {o.commission > 0
                          ? `-${formatCurrency(o.commission, "RON")}`
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-sm">
                        {o.createdAt
                          ? new Date(o.createdAt).toLocaleTimeString("ro-RO", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!isDelivered && (
                          <button
                            onClick={() =>
                              updateMut.mutate({
                                id: o.id,
                                status: "delivered",
                              })
                            }
                            disabled={updateMut.isPending}
                            title="Marchează ca Livrată"
                            className="p-1.5 text-muted-foreground hover:text-chart-1 hover:bg-chart-1/10 rounded-lg transition-colors"
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
                    className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 !rounded-full pl-3 pr-8 py-1 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:border-blue-500 shadow-sm"
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
        </div>
      )}
    </div>
  );
}
