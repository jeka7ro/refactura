// HorecaDelivery — Centralizare comenzi delivery (Glovo, Wolt, Bolt, Tazz, Manual)

import { useState } from "react";
import {
  Truck, Plus, ChevronDown, Loader2, Check, X, AlertCircle,
  Clock, PackageCheck, PackageX, RefreshCw,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/store";

const PLATFORMS = [
  { value: "glovo", label: "Glovo", color: "#FF6B00", emoji: "🟠" },
  { value: "wolt", label: "Wolt", color: "#00C2E0", emoji: "🔵" },
  { value: "bolt_food", label: "Bolt Food", color: "#34D399", emoji: "🟢" },
  { value: "tazz", label: "Tazz", color: "#F59E0B", emoji: "🟡" },
  { value: "manual", label: "Manual", color: "#8B5CF6", emoji: "🟣" },
];

const STATUS_FLOW = [
  { value: "new", label: "Nouă", cls: "bg-blue-500/20 text-blue-300" },
  { value: "accepted", label: "Acceptată", cls: "bg-yellow-500/20 text-yellow-300" },
  { value: "preparing", label: "Preparare", cls: "bg-orange-500/20 text-orange-300" },
  { value: "ready", label: "Gata", cls: "bg-green-500/20 text-green-300" },
  { value: "picked_up", label: "Ridicată", cls: "bg-teal-500/20 text-teal-300" },
  { value: "delivered", label: "Livrată ✓", cls: "bg-emerald-500/20 text-emerald-300" },
  { value: "cancelled", label: "Anulată", cls: "bg-red-500/20 text-red-300" },
  { value: "rejected", label: "Respinsă", cls: "bg-red-700/20 text-red-400" },
];

export default function HorecaDelivery() {
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [platformFilter, setPlatformFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [sortCol, setSortCol] = useState<"platform" | "total" | "status" | "createdAt">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [form, setForm] = useState({
    platform: "manual" as any,
    externalId: "", customerName: "", customerPhone: "",
    deliveryAddress: "", subtotal: "", commission: "0",
    commissionPct: "0", deliveryFee: "0", total: "", notes: "",
  });

  const { data: locations = [] } = trpc.horeca.locations.list.useQuery();
  const locationId = selectedLocationId ?? locations[0]?.id ?? 0;

  const utils = trpc.useUtils();
  const { data: deliveryOrders = [], isLoading } = trpc.horeca.delivery.list.useQuery(
    { locationId, status: statusFilter || undefined },
    { enabled: locationId > 0 }
  );

  const createMut = trpc.horeca.delivery.create.useMutation({
    onSuccess: () => {
      toast.success("Comandă delivery înregistrată");
      utils.horeca.delivery.list.invalidate();
      setShowAddForm(false);
      setForm({ platform: "manual", externalId: "", customerName: "", customerPhone: "", deliveryAddress: "", subtotal: "", commission: "0", commissionPct: "0", deliveryFee: "0", total: "", notes: "" });
    },
    onError: e => toast.error(e.message),
  });

  const updateMut = trpc.horeca.delivery.updateStatus.useMutation({
    onSuccess: () => { toast.success("Status actualizat"); utils.horeca.delivery.list.invalidate(); },
    onError: e => toast.error(e.message),
  });

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  const filtered = deliveryOrders.filter(o => !platformFilter || o.platform === platformFilter);
  const sorted = [...filtered].sort((a, b) => {
    let av: any = "";
    let bv: any = "";
    if (sortCol === "platform") { av = a.platform; bv = b.platform; }
    if (sortCol === "total") { av = Number(a.total); bv = Number(b.total); }
    if (sortCol === "status") { av = a.status; bv = b.status; }
    if (sortCol === "createdAt") { av = a.createdAt ? new Date(a.createdAt).getTime() : 0; bv = b.createdAt ? new Date(b.createdAt).getTime() : 0; }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  // Summary stats
  const totalDelivered = deliveryOrders.filter(o => o.status === "delivered").reduce((s, o) => s + Number(o.total || 0), 0);
  const totalCommission = deliveryOrders.filter(o => o.status === "delivered").reduce((s, o) => s + Number(o.commission || 0), 0);
  const netRevenue = totalDelivered - totalCommission;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.subtotal || !form.total) { toast.error("Completează subtotalul și totalul"); return; }
    createMut.mutate({ locationId, ...form });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Truck className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Delivery</h1>
            <p className="text-slate-400 text-sm">Comenzi agregate din toate platformele</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {locations.length > 1 && (
            <select value={locationId} onChange={e => setSelectedLocationId(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-orange-500">
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
          <button onClick={() => setShowAddForm(s => !s)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Înregistrează comandă
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800/60 border border-green-500/30 rounded-xl p-4">
          <p className="text-slate-400 text-xs mb-1">Vânzări brute delivery</p>
          <p className="text-white text-xl font-bold">{formatCurrency(totalDelivered, "RON")}</p>
        </div>
        <div className="bg-slate-800/60 border border-red-500/30 rounded-xl p-4">
          <p className="text-slate-400 text-xs mb-1">Comisioane platforme</p>
          <p className="text-red-400 text-xl font-bold">-{formatCurrency(totalCommission, "RON")}</p>
        </div>
        <div className="bg-slate-800/60 border border-emerald-500/30 rounded-xl p-4">
          <p className="text-slate-400 text-xs mb-1">Net după comisioane</p>
          <p className="text-emerald-400 text-xl font-bold">{formatCurrency(netRevenue, "RON")}</p>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4">Comandă delivery nouă</h2>
          <div className="mb-3 flex items-center gap-2 text-amber-300 text-sm bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Integrarea API cu platformele de delivery urmează în versiunea viitoare. Deocamdată înregistrați manual.
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-400 text-xs mb-1">Platformă *</label>
              <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value as any }))}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500">
                {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.emoji} {p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">ID extern (opțional)</label>
              <input value={form.externalId} onChange={e => setForm(f => ({ ...f, externalId: e.target.value }))}
                placeholder="ID din platformă"
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">Client</label>
              <input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                placeholder="Numele clientului"
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">Subtotal (RON) *</label>
              <input type="number" step="0.01" value={form.subtotal} onChange={e => setForm(f => ({ ...f, subtotal: e.target.value, total: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">Comision platformă (RON)</label>
              <input type="number" step="0.01" value={form.commission} onChange={e => setForm(f => ({ ...f, commission: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">Comision (%)</label>
              <input type="number" step="0.01" value={form.commissionPct} onChange={e => setForm(f => ({ ...f, commissionPct: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">Total (RON) *</label>
              <input type="number" step="0.01" value={form.total} onChange={e => setForm(f => ({ ...f, total: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-slate-400 text-xs mb-1">Adresă livrare</label>
              <input value={form.deliveryAddress} onChange={e => setForm(f => ({ ...f, deliveryAddress: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div className="md:col-span-3 flex justify-end gap-3">
              <button type="button" onClick={() => setShowAddForm(false)} className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-sm transition-colors">
                <X className="w-3 h-3" /> Anulează
              </button>
              <button type="submit" disabled={createMut.isPending} className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm transition-colors">
                {createMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Înregistrează
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Platform filter pills */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setPlatformFilter("")}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${!platformFilter ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}>
          Toate platformele
        </button>
        {PLATFORMS.map(p => (
          <button key={p.value} onClick={() => setPlatformFilter(p.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${platformFilter === p.value ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}>
            {p.emoji} {p.label}
          </button>
        ))}
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="ml-auto bg-slate-800 border border-slate-700 text-white px-3 py-1 rounded-lg text-xs focus:outline-none focus:border-blue-500">
          <option value="">Toate statusurile</option>
          {STATUS_FLOW.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-blue-400 animate-spin" /></div>
      ) : (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-700/50">
                <tr className="text-slate-400 text-left">
                  <th className="px-4 py-3 font-medium">Nr. Crt.</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => toggleSort("platform")}>
                    Platformă {sortCol === "platform" && <ChevronDown className={`inline w-3 h-3 ${sortDir === "desc" ? "rotate-180" : ""}`} />}
                  </th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => toggleSort("status")}>
                    Status {sortCol === "status" && <ChevronDown className={`inline w-3 h-3 ${sortDir === "desc" ? "rotate-180" : ""}`} />}
                  </th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white text-right" onClick={() => toggleSort("total")}>
                    Total {sortCol === "total" && <ChevronDown className={`inline w-3 h-3 ${sortDir === "desc" ? "rotate-180" : ""}`} />}
                  </th>
                  <th className="px-4 py-3 font-medium text-right">Comision</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => toggleSort("createdAt")}>
                    Ora {sortCol === "createdAt" && <ChevronDown className={`inline w-3 h-3 ${sortDir === "desc" ? "rotate-180" : ""}`} />}
                  </th>
                  <th className="px-4 py-3 font-medium text-right">Acțiuni</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr><td colSpan={8} className="text-center text-slate-500 py-12">Nicio comandă delivery înregistrată</td></tr>
                ) : sorted.map((order, idx) => {
                  const platform = PLATFORMS.find(p => p.value === order.platform);
                  const statusObj = STATUS_FLOW.find(s => s.value === order.status) || { label: order.status || "", cls: "bg-slate-700 text-slate-300" };
                  const isDone = ["delivered", "cancelled", "rejected"].includes(order.status || "");
                  return (
                    <tr key={order.id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                      <td className="px-4 py-3 text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{platform?.emoji}</span>
                          <span className="text-white font-medium">{platform?.label}</span>
                          {order.externalId && <span className="text-slate-500 text-xs">#{order.externalId}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{order.customerName || "—"}</td>
                      <td className="px-4 py-3">
                        {!isDone ? (
                          <select value={order.status || "new"}
                            onChange={e => updateMut.mutate({ id: order.id, status: e.target.value as any })}
                            className="bg-slate-700 border border-slate-600 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500">
                            {STATUS_FLOW.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusObj.cls}`}>{statusObj.label}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white font-medium text-right">{formatCurrency(Number(order.total || 0), "RON")}</td>
                      <td className="px-4 py-3 text-right">
                        {Number(order.commission || 0) > 0 ? (
                          <span className="text-red-400">-{formatCurrency(Number(order.commission), "RON")}</span>
                        ) : <span className="text-slate-500">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {order.createdAt ? new Date(order.createdAt).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!isDone && (
                          <button onClick={() => { if (confirm("Marchezi ca livrată?")) updateMut.mutate({ id: order.id, status: "delivered" }); }}
                            title="Marchează livrată"
                            className="p-1.5 text-slate-400 hover:text-green-400 hover:bg-green-500/10 rounded transition-colors">
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
          <div className="px-4 py-3 border-t border-slate-700/50 flex items-center justify-between text-xs text-slate-500">
            <span>{sorted.length} comenzi afișate</span>
            <span>Sortare: {sortCol} {sortDir === "desc" ? "↓" : "↑"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
