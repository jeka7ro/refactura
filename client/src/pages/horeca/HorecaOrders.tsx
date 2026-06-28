// HorecaOrders — Lista comenzi cu filtre și status management

import { useState } from "react";
import { Link } from "wouter";
import {
  ShoppingBag, Plus, Eye, ChevronDown, Loader2,
  UtensilsCrossed, Truck, Package, Clock, CheckCircle2, XCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/store";

const STATUS_OPTIONS = [
  { value: "", label: "Toate statusurile" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Trimis la bucătărie" },
  { value: "preparing", label: "În preparare" },
  { value: "ready", label: "Gata" },
  { value: "served", label: "Servit" },
  { value: "paid", label: "Plătit" },
  { value: "cancelled", label: "Anulat" },
];

const TYPE_OPTIONS = [
  { value: "", label: "Toate tipurile" },
  { value: "dine_in", label: "La masă" },
  { value: "takeaway", label: "Ridicare" },
  { value: "delivery", label: "Delivery" },
];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-slate-600 text-slate-300" },
  sent: { label: "Trimis", cls: "bg-yellow-500/20 text-yellow-300" },
  preparing: { label: "Preparare", cls: "bg-orange-500/20 text-orange-300" },
  ready: { label: "Gata", cls: "bg-green-500/20 text-green-300" },
  served: { label: "Servit", cls: "bg-teal-500/20 text-teal-300" },
  paid: { label: "Plătit ✓", cls: "bg-emerald-500/20 text-emerald-300" },
  cancelled: { label: "Anulat", cls: "bg-red-500/20 text-red-300" },
};

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  dine_in: { label: "🍽️ La masă", cls: "bg-orange-500/20 text-orange-300" },
  takeaway: { label: "🥡 Ridicare", cls: "bg-amber-500/20 text-amber-300" },
  delivery: { label: "🛵 Delivery", cls: "bg-blue-500/20 text-blue-300" },
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash", card: "Card", voucher: "Voucher",
  online: "Online", room_charge: "Cameră", mixed: "Mixt",
};

export default function HorecaOrders() {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFilter, setDateFilter] = useState(today);
  const [sortCol, setSortCol] = useState<"orderNumber" | "total" | "status" | "type" | "createdAt">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: locations = [] } = trpc.horeca.locations.list.useQuery();
  const locationId = selectedLocationId ?? locations[0]?.id ?? 0;

  const { data: orders = [], isLoading } = trpc.horeca.orders.list.useQuery(
    { locationId, status: statusFilter || undefined, type: typeFilter || undefined, date: dateFilter || undefined },
    { enabled: locationId > 0 }
  );

  const utils = trpc.useUtils();
  const updateStatusMut = trpc.horeca.orders.updateStatus.useMutation({
    onSuccess: () => { toast.success("Status actualizat"); utils.horeca.orders.list.invalidate(); },
    onError: e => toast.error(e.message),
  });
  const cancelMut = trpc.horeca.orders.cancel.useMutation({
    onSuccess: () => { toast.success("Comandă anulată"); utils.horeca.orders.list.invalidate(); },
  });

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  const sorted = [...orders].sort((a, b) => {
    let av: string | number = "";
    let bv: string | number = "";
    if (sortCol === "orderNumber") { av = a.orderNumber || ""; bv = b.orderNumber || ""; }
    if (sortCol === "total") { av = Number(a.total); bv = Number(b.total); }
    if (sortCol === "status") { av = a.status || ""; bv = b.status || ""; }
    if (sortCol === "type") { av = a.type || ""; bv = b.type || ""; }
    if (sortCol === "createdAt") { av = a.createdAt ? new Date(a.createdAt).getTime() : 0; bv = b.createdAt ? new Date(b.createdAt).getTime() : 0; }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const totalRevenue = orders.filter(o => o.status === "paid").reduce((s, o) => s + Number(o.total || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <ShoppingBag className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Comenzi HORECA</h1>
            <p className="text-slate-400 text-sm">{orders.length} comenzi · {formatCurrency(totalRevenue, "RON")} încasat</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {locations.length > 1 && (
            <select value={locationId} onChange={e => setSelectedLocationId(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-orange-500">
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
          <Link href="/horeca/comenzi/nou">
            <button className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" /> Comandă nouă
            </button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-orange-500" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-orange-500">
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-orange-500">
          {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {(statusFilter || typeFilter || dateFilter !== today) && (
          <button onClick={() => { setStatusFilter(""); setTypeFilter(""); setDateFilter(today); }}
            className="text-sm text-slate-400 hover:text-white underline transition-colors">
            Resetează filtrele
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-orange-400 animate-spin" /></div>
      ) : (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-700/50">
                <tr className="text-slate-400 text-left">
                  <th className="px-4 py-3 font-medium">Nr. Crt.</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => toggleSort("orderNumber")}>
                    Comandă {sortCol === "orderNumber" && <ChevronDown className={`inline w-3 h-3 ${sortDir === "desc" ? "rotate-180" : ""}`} />}
                  </th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => toggleSort("type")}>
                    Tip {sortCol === "type" && <ChevronDown className={`inline w-3 h-3 ${sortDir === "desc" ? "rotate-180" : ""}`} />}
                  </th>
                  <th className="px-4 py-3 font-medium">Masă</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => toggleSort("status")}>
                    Status {sortCol === "status" && <ChevronDown className={`inline w-3 h-3 ${sortDir === "desc" ? "rotate-180" : ""}`} />}
                  </th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => toggleSort("total")}>
                    Total {sortCol === "total" && <ChevronDown className={`inline w-3 h-3 ${sortDir === "desc" ? "rotate-180" : ""}`} />}
                  </th>
                  <th className="px-4 py-3 font-medium">Plată</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => toggleSort("createdAt")}>
                    Ora {sortCol === "createdAt" && <ChevronDown className={`inline w-3 h-3 ${sortDir === "desc" ? "rotate-180" : ""}`} />}
                  </th>
                  <th className="px-4 py-3 font-medium text-right">Acțiuni</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr><td colSpan={9} className="text-center text-slate-500 py-12">Nicio comandă pentru filtrele selectate</td></tr>
                ) : sorted.map((order, idx) => {
                  const sb = STATUS_BADGE[order.status || "draft"] || { label: order.status, cls: "bg-slate-700 text-slate-300" };
                  const tb = TYPE_BADGE[order.type || "dine_in"] || { label: order.type, cls: "bg-slate-700 text-slate-300" };
                  const isPaid = order.status === "paid";
                  const isCancelled = order.status === "cancelled";
                  return (
                    <tr key={order.id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                      <td className="px-4 py-3 text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3 text-white font-medium">{order.orderNumber}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${tb.cls}`}>{tb.label}</span></td>
                      <td className="px-4 py-3 text-slate-300">{order.tableNumber || (order.type === "dine_in" ? "—" : "N/A")}</td>
                      <td className="px-4 py-3">
                        {!isPaid && !isCancelled ? (
                          <select
                            value={order.status || "draft"}
                            onChange={e => updateStatusMut.mutate({ id: order.id, status: e.target.value as any })}
                            className="bg-slate-700 border border-slate-600 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-orange-500"
                          >
                            {STATUS_OPTIONS.filter(s => s.value).map(s => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${sb.cls}`}>{sb.label}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white font-medium">{formatCurrency(Number(order.total), "RON")}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {order.paymentMethod ? PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {order.createdAt ? new Date(order.createdAt).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {!isPaid && !isCancelled && (
                            <button
                              onClick={() => {
                                const method = prompt("Metodă plată: cash / card / voucher / mixed") as any;
                                if (method) updateStatusMut.mutate({ id: order.id, status: "paid", paymentMethod: method });
                              }}
                              title="Marchează plătit"
                              className="p-1.5 text-slate-400 hover:text-green-400 hover:bg-green-500/10 rounded transition-colors"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                          {!isPaid && !isCancelled && (
                            <button
                              onClick={() => { if (confirm("Anulezi comanda?")) cancelMut.mutate({ id: order.id }); }}
                              title="Anulează"
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-slate-700/50 flex items-center justify-between text-xs text-slate-500">
            <span>{sorted.length} comenzi afișate</span>
            <span>Sortare: {sortCol} {sortDir === "desc" ? "↓" : "↑"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
