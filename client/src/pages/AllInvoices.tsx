// AllInvoices — pagina unificată (import XML e-Factura mutat în pagina Integrări)
// UI Rules: Nr. Crt., search+counter, footer paginare, rounded-lg butoane

import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Search, ChevronLeft, ChevronRight, Plus, RefreshCw, Loader2, Send, FileDown, X, Eye, Pencil, Trash2, Calendar, Download, CheckCircle, ClipboardList } from "lucide-react";
import { formatCurrency, formatDate, type Currency } from "@/lib/store";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type InvoiceType = "primit" | "emis" | "refacturat";

interface UnifiedRow {
  id: number;
  type: InvoiceType;
  number: string;
  partnerName: string;
  partnerCui?: string;
  date: string;
  dueDate: string;
  total: number;
  currency: string;
  status: string;
  fileUrl?: string | null;
  source: string;
}

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  spv_anaf:  { label: "SPV",     cls: "bg-purple-50 text-purple-700 border-purple-200" },
  oblio:     { label: "Oblio",   cls: "bg-orange-50 text-orange-700 border-orange-200" },
  smartbill: { label: "SmartBill", cls: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  manual:    { label: "Manual",  cls: "bg-slate-50 text-slate-500 border-slate-200" },
  refactura: { label: "Re-fact", cls: "bg-blue-50 text-blue-700 border-blue-200" },
};

const TYPE_BADGE: Record<InvoiceType, { label: string; cls: string }> = {
  primit:     { label: "Primit",      cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800" },
  emis:       { label: "Emis",        cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800" },
  refacturat: { label: "Re-facturat", cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800" },
};
const STATUS_CLS: Record<string, string> = {
  pending:   "bg-amber-50 text-amber-700 border-amber-200",
  processed: "bg-blue-50 text-blue-700 border-blue-200",
  paid:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  draft:     "bg-slate-100 text-slate-500 border-slate-200",
  sent:      "bg-indigo-50 text-indigo-700 border-indigo-200",
  archived:  "bg-slate-50 text-slate-400 border-slate-200",
  overdue:   "bg-rose-50 text-rose-700 border-rose-200",
  storno:    "bg-rose-100 text-rose-700 border-rose-300",
};
const STATUS_LBL: Record<string, string> = {
  pending: "Neîncasat", processed: "Procesat", paid: "Achitat",
  draft: "Ciornă", sent: "Emis", archived: "Arhivat", overdue: "Restanță",
  storno: "Storno",
};
// Pentru facturi PRIMITE: pending = Neachitat (tu trebuie să plătești)
const STATUS_LBL_PRIMIT: Record<string, string> = {
  pending: "Neachitat", processed: "Achitat", paid: "Achitat",
  draft: "Ciornă", sent: "Procesat", archived: "Arhivat", overdue: "Restanță",
  storno: "Storno",
};
const getStatusLabel = (status: string, type: string) =>
  type === "primit" ? (STATUS_LBL_PRIMIT[status] || status) : (STATUS_LBL[status] || status);

export default function AllInvoices() {
  const [, navigate] = useLocation();
  const [search, setSearch]           = useState("");

  // Helper: forțează download în loc de preview în browser
  const downloadFile = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  const [page, setPage]               = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [typeFilter, setTypeFilter]   = useState<InvoiceType | "all">("all");
  const [deleteTarget, setDeleteTarget] = useState<UnifiedRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [period, setPeriod] = useState<string>("all");
  const [customFrom, setCustomFrom] = useState(() => new Date().toISOString().split("T")[0]);
  const [customTo, setCustomTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });

  // Period date range helper
  const getDateRange = (p: string): [string, string] | null => {
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    switch (p) {
      case "today": { const t = fmt(now); return [t, t]; }
      case "week": {
        const d = startOfDay(now);
        const day = d.getDay() || 7;
        d.setDate(d.getDate() - day + 1);
        const end = new Date(d); end.setDate(end.getDate() + 6);
        return [fmt(d), fmt(end)];
      }
      case "month": {
        const s = new Date(now.getFullYear(), now.getMonth(), 1);
        const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return [fmt(s), fmt(e)];
      }
      case "lastMonth": {
        const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const e = new Date(now.getFullYear(), now.getMonth(), 0);
        return [fmt(s), fmt(e)];
      }
      case "year": return [`${now.getFullYear()}-01-01`, `${now.getFullYear()}-12-31`];
      case "lastYear": return [`${now.getFullYear() - 1}-01-01`, `${now.getFullYear() - 1}-12-31`];
      case "custom": return customFrom && customTo ? [customFrom, customTo] : null;
      default: return null;
    }
  };

  const toggleSelect = (rowKey: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(rowKey) ? next.delete(rowKey) : next.add(rowKey);
      return next;
    });
  };

  const toggleSelectAll = (pageRows: UnifiedRow[]) => {
    const pageKeys = pageRows.map(r => `${r.type}-${r.id}`);
    const allSelected = pageKeys.every(k => selectedIds.has(k));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) { pageKeys.forEach(k => next.delete(k)); }
      else { pageKeys.forEach(k => next.add(k)); }
      return next;
    });
  };

  const getSelectedPrimitRows = () =>
    allRows.filter(r => r.type === "primit" && selectedIds.has(`primit-${r.id}`));

  const { data: archiveData, isLoading: l1, refetch: r1 } = trpc.invoiceArchive.list.useQuery({});
  const { data: reInvoices = [], isLoading: l2, refetch: r2 } = trpc.reinvoice.list.useQuery();
  const { data: emittedInvoices = [], isLoading: l3, refetch: r3 } = trpc.emittedInvoice.list.useQuery();
  
  const { data: tenantsData = [] } = trpc.tenants.list.useQuery();
  const tenant         = (tenantsData as any[])[0];
  const tenantSettings = useMemo(() => { try { return JSON.parse(tenant?.settings || "{}"); } catch { return {}; } }, [tenant]);

  const downloadPDF = trpc.reinvoice.downloadPDF.useMutation();
  const syncOblio = trpc.integrations.syncOblio.useMutation({
    onSuccess: () => { r1(); r2(); r3(); },
  });
  const syncSpvManual = trpc.integrations.syncSpvManual.useMutation({
    onSuccess: () => { r1(); r2(); r3(); },
  });
  const { data: dbIntegrations = [] } = trpc.integrations.list.useQuery();

  const deleteArchive = trpc.invoiceArchive.delete.useMutation({ onSuccess: () => r1() });
  const deleteReinvoice = trpc.reinvoice.delete.useMutation({ onSuccess: () => r2() });
  const deleteEmitted = trpc.emittedInvoice.delete.useMutation({ onSuccess: () => r3() });

  const markEmittedPaid = trpc.emittedInvoice.updateStatus.useMutation({
    onSuccess: () => { toast.success("Factură marcată ca Încasată!"); r3(); },
    onError: (e) => toast.error("Eroare: " + e.message),
  });
  const markArchivePaid = trpc.invoiceArchive.updateStatus.useMutation({
    onSuccess: () => { toast.success("Factură marcată ca Achitată!"); r1(); },
    onError: (e) => toast.error("Eroare: " + e.message),
  });

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    toast.loading("Ștergere în curs...", { id: "delete" });
    try {
      if (deleteTarget.type === "refacturat") {
        await deleteReinvoice.mutateAsync({ id: deleteTarget.id });
      } else if (deleteTarget.type === "emis" && deleteTarget.source === "manual") {
        await deleteEmitted.mutateAsync({ id: deleteTarget.id });
      } else {
        await deleteArchive.mutateAsync({ id: deleteTarget.id });
      }
      toast.success("Factură ștearsă cu succes!", { id: "delete" });
    } catch (e: any) {
      toast.error("Eroare la ștergere", { id: "delete", description: e?.message });
    }
    setDeleteTarget(null);
  };

  const isLoading = l1 || l2 || l3;

  const archiveItems = useMemo(() => {
    const raw = archiveData as unknown as { items: any[], metadata: any };
    if (raw?.items) return raw.items;
    return [];
  }, [archiveData]);

  const allRows: UnifiedRow[] = useMemo(() => {
    const rows: UnifiedRow[] = [];
    archiveItems.forEach((i: any) => {
      const t = parseFloat(i.total || "0");
      rows.push({
        id: i.id, type: i.direction === "in" ? "primit" : "emis",
        number: i.invoiceNumber || `#${i.id}`, partnerName: i.supplierName || "—",
        date: i.issueDate || i.createdAt || "", dueDate: i.dueDate || "",
        total: t, currency: i.currency || "RON",
        status: t < 0 ? "storno" : (i.status || "pending"), fileUrl: i.fileUrl,
        source: i.source || "spv_anaf",
      });
    });
    (Array.isArray(reInvoices) ? reInvoices : []).forEach((i: any) => {
      const t = parseFloat(i.total || "0");
      rows.push({
        id: i.id, type: "refacturat",
        number: i.number || `RF-${i.id}`, partnerName: i.clientName || "—",
        date: i.issueDate || i.createdAt || "", dueDate: i.dueDate || "",
        total: t, currency: i.currency || "RON",
        status: t < 0 ? "storno" : (i.status || "draft"), fileUrl: null,
        source: "refactura",
      });
    });
    (Array.isArray(emittedInvoices) ? emittedInvoices : []).forEach((i: any) => {
      const t = parseFloat(i.total || "0");
      rows.push({
        id: i.id, type: "emis",
        number: i.number || `FACT-${i.id}`, partnerName: i.clientName || "—",
        date: i.issueDate || i.createdAt || "", dueDate: i.dueDate || "",
        total: t, currency: i.currency || "RON",
        status: t < 0 ? "storno" : (i.status === "sent" ? "sent" : (i.status || "draft")), fileUrl: null,
        source: "manual",
      });
    });
    return rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [archiveItems, reInvoices, emittedInvoices]);

  const filtered = useMemo(() => {
    let rows = typeFilter === "all" ? allRows : allRows.filter(r => r.type === typeFilter);
    // Period filter
    const range = getDateRange(period);
    if (range) {
      const [from, to] = range;
      rows = rows.filter(r => {
        const d = (r.date || "").slice(0, 10);
        return d >= from && d <= to;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.number.toLowerCase().includes(q) ||
        r.partnerName.toLowerCase().includes(q) ||
        (STATUS_LBL[r.status] || r.status).toLowerCase().includes(q)
      );
    }
    return rows;
  }, [allRows, search, typeFilter, period, customFrom, customTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const paginated  = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const counts = {
    all: allRows.length, primit: allRows.filter(r => r.type === "primit").length,
    emis: allRows.filter(r => r.type === "emis").length, refacturat: allRows.filter(r => r.type === "refacturat").length,
  };

  // Import XML e-Factura: mutat în pagina Integrări → cardul „SPV ANAF".

  // ── Export Excel (CSV) ──
  const exportToExcel = () => {
    const header = ["Tip", "Număr", "Dată", "Scadență", "Partener", "CUI", "Total", "Monedă", "Status"];
    const rows = filtered.map(r => [
      r.type.toUpperCase(),
      `"${r.number}"`,
      r.date.slice(0, 10),
      r.dueDate ? r.dueDate.slice(0, 10) : "",
      `"${(r.partnerName || "").replace(/"/g, '""')}"`,
      r.partnerCui || "",
      r.total,
      r.currency,
      STATUS_LBL[r.status] || r.status
    ]);
    const csvContent = [header, ...rows].map(e => e.join(";")).join("\n");
    // BOM for Excel compatibility with UTF-8
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Facturi_Export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Export Excel generat cu succes!");
  };  // ── Download PDF re-factură ──
  const handleDownloadReInvoicePDF = async (row: UnifiedRow) => {
    const ri = (reInvoices as any[]).find(r => r.id === row.id);
    if (!ri) { toast.error("Re-factura nu a fost găsită"); return; }
    toast.loading("Generez PDF...", { id: "pdf" });
    try {
      await downloadPDF.mutateAsync({
        number: ri.number, date: ri.issueDate || new Date().toISOString().split("T")[0],
        dueDate: ri.dueDate || "", clientName: ri.clientName || "",
        clientCUI: ri.clientCUI || "", clientAddress: ri.clientAddress || "",
        clientCity: ri.clientCity || "", clientCounty: "", clientEmail: ri.clientEmail || "",
        clientPhone: ri.clientPhone || "", companyName: tenant?.name || "",
        companyCUI: tenant?.cui || "", companyAddress: tenant?.address || "",
        companyCity: tenantSettings.city || "", companyCounty: tenantSettings.county || "",
        companyEmail: tenant?.email || "", companyPhone: tenant?.phone || "",
        companyIBAN: tenantSettings.iban || "", companyBank: tenantSettings.bank || "",
        logoBase64: tenantSettings.logoBase64 || undefined,
        template: (localStorage.getItem("invoice-template") as any) || "classic",
        lines: (ri.lines || []).map((l: any) => ({
          description: l.description, quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice), unit: l.unit || "buc",
          vatRate: Number(l.vatRate) || 21,
          total: Number(l.quantity) * Number(l.unitPrice) * (1 + (Number(l.vatRate) || 21) / 100),
        })),
        subtotal: parseFloat(ri.subtotal || "0"), totalVAT: parseFloat(ri.totalVAT || "0"),
        total: parseFloat(ri.total || "0"), currency: ri.currency || "RON", notes: ri.notes || undefined,
      });
      toast.success("PDF generat!", { id: "pdf" });
    } catch (e: any) {
      toast.error("Eroare PDF", { id: "pdf", description: e?.message });
    }
  };

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-3">

      {/* Header cu Titlu + Export/Sync (Top Row) si Filtre Perioada (Bottom Row) */}
      <div className="flex flex-col gap-3 mb-4">
        
        {/* Top Row: Title & Action Buttons */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">Facturi</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total: <strong>{allRows.length}</strong> înregistrări</p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={exportToExcel}
              className="flex items-center gap-1 px-3 h-8 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-all"
              title="Exportă tabelul curent în format Excel (CSV)"
            >
              <Download className="w-3 h-3" />
              <span className="hidden sm:inline">Export Excel</span>
            </button>
            <button
              onClick={async () => {
                const hasOblio = (dbIntegrations as any[]).some(i => i.provider === "oblio");
                const hasSpv = (dbIntegrations as any[]).some(i => i.provider === "spv_oauth");
                let syncedAny = false;
                
                if (hasOblio) {
                  toast.loading("Sincronizare Oblio...", { id: "sync" });
                  await syncOblio.mutateAsync().catch(() => {});
                  syncedAny = true;
                }
                
                if (hasSpv && !hasOblio) {
                  toast.loading("Sincronizare SPV ANAF...", { id: "sync" });
                  await syncSpvManual.mutateAsync().catch(() => {});
                  syncedAny = true;
                }
                
                if (!syncedAny) {
                  toast.error("Nicio integrare activă de sincronizat. Mergi la Integrări.");
                } else {
                  toast.success("Sincronizare completă", { id: "sync" });
                }
              }}
              disabled={syncOblio.isPending || syncSpvManual.isPending}
              className="flex items-center gap-1 px-3 h-8 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-all disabled:opacity-60"
              title="Sincronizează din sursele configurate (Oblio / SPV)"
            >
              {syncOblio.isPending || syncSpvManual.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              <span>Sync</span>
            </button>
          </div>
        </div>

        {/* Bottom Row: Period Filters */}
        <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-slate-100 dark:border-slate-800 pt-2">
          <Calendar className="w-4 h-4 text-slate-400 hidden sm:block" />
            {([
              { id: "all",       label: "Toate" },
              { id: "today",     label: "Azi" },
              { id: "week",      label: "Săpt. curentă" },
              { id: "month",     label: "Luna curentă" },
              { id: "lastMonth", label: "Luna trecută" },
              { id: "year",      label: "Anul curent" },
              { id: "lastYear",  label: "Anul trecut" },
            ] as const).map(f => (
              <button
                key={f.id}
                onClick={() => { setPeriod(f.id); setPage(1); }}
                className={`px-2.5 sm:px-3 h-8 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center ${
                  period === f.id
                    ? "bg-blue-50 text-blue-700 border-blue-200 ring-1 ring-offset-1 ring-blue-400"
                    : "bg-white border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300"
                }`}
              >
                {f.label}
              </button>
            ))}
            
            {/* Custom Date Inputs (Always Visible) */}
            <div className="flex items-center gap-1 ml-1">
              <input type="date" value={customFrom} onChange={e => { setPeriod("custom"); setCustomFrom(e.target.value); setPage(1); }}
                className="h-8 px-1.5 rounded-lg border border-slate-200 text-[10px] bg-white dark:bg-slate-800" />
              <span className="text-[10px] text-slate-400">→</span>
              <input type="date" value={customTo} onChange={e => { setPeriod("custom"); setCustomTo(e.target.value); setPage(1); }}
                className="h-8 px-1.5 rounded-lg border border-slate-200 text-[10px] bg-white dark:bg-slate-800" />
            </div>
          </div>
        </div>

      {/* Banner selectie multipla */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-blue-600 text-white rounded-lg shadow-md">
          <span className="text-sm font-semibold">{selectedIds.size} factură/facturi selectate pentru Re-Facturare</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 h-7 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors"
            >
              Anulează
            </button>
            <button
              onClick={async () => {
                if (!window.confirm(`Ștergi ${selectedIds.size} facturi selectate?`)) return;
                toast.loading("Ștergere în curs...", { id: "bulk-del" });
                let ok = 0;
                for (const key of Array.from(selectedIds)) {
                  const [type, idStr] = key.split("-");
                  const id = Number(idStr);
                  try {
                    if (type === "refacturat") await deleteReinvoice.mutateAsync({ id });
                    else await deleteArchive.mutateAsync({ id });
                    ok++;
                  } catch {}
                }
                setSelectedIds(new Set());
                toast.success(`${ok} facturi șterse`, { id: "bulk-del" });
              }}
              className="px-3 h-7 rounded-lg bg-red-600 text-white hover:bg-red-700 text-xs font-bold transition-colors shadow-sm"
            >
              Șterge selectate
            </button>
            <button
              onClick={() => {
                const ids = getSelectedPrimitRows().map(r => r.id).join(",");
                navigate(`/re-facturare/multiplu?ids=${ids}`);
              }}
              className="px-3 h-7 rounded-lg bg-white text-blue-700 hover:bg-blue-50 text-xs font-bold transition-colors shadow-sm"
            >
              Re-Facturare Multiplă →
            </button>
          </div>
        </div>
      )}

      {/* Card tabel */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">

        {/* Search & Filtre tip */}
        <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3 justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
          <div style={{ position: "relative", width: "100%", maxWidth: 340 }}>
            <Search className="w-3.5 h-3.5 text-slate-400" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
            <input
              style={{ paddingLeft: 30, paddingRight: search ? 72 : 12, borderRadius: 9999, width: "100%", height: 32, border: "1px solid #e2e8f0", outline: "none", fontSize: 13 }}
              className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white dark:border-slate-700"
              placeholder="Caută număr, partener..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
            {search && (
              <>
                <div style={{ position: "absolute", right: 28, top: "50%", transform: "translateY(-50%)", background: "#2563eb", color: "white", borderRadius: 9999, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>
                  {filtered.length}/{allRows.length}
                </div>
                <button onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)" }}>
                  <X className="w-3 h-3 text-slate-400 hover:text-slate-700" />
                </button>
              </>
            )}
          </div>
          
          <div className="flex flex-wrap gap-1.5 justify-end">
            {([
              { id: "all",        label: "Toate",        cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300" },
              { id: "primit",     label: "Primite",      cls: "bg-red-50 text-red-700 border-red-200" },
              { id: "emis",       label: "Emise",        cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
              { id: "refacturat", label: "Re-facturate", cls: "bg-blue-50 text-blue-700 border-blue-200" },
            ] as const).map(f => (
              <button
                key={f.id}
                onClick={() => { setTypeFilter(f.id as any); setPage(1); }}
                className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold border transition-all ${
                  typeFilter === f.id ? f.cls + " ring-1 ring-offset-1 ring-current" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                {f.label} <span className="font-bold">{counts[f.id]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* DESKTOP TABLE */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th style={{ width: 36 }} className="px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    checked={paginated.length > 0 && paginated.every(r => selectedIds.has(`${r.type}-${r.id}`))}
                    onChange={() => toggleSelectAll(paginated)}
                    title="Selectează/Deselectează toate de pe această pagină"
                  />
                </th>
                <th style={{ width: 42, textAlign: "center" }} className="px-2 py-2 text-[10px] font-bold text-slate-400 uppercase">Nr.</th>
                <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">Număr</th>
                <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">Tip</th>
                <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">Partener</th>
                <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">Dată</th>
                <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">Scadență</th>
                <th className="px-3 py-2 text-right text-[10px] font-bold text-slate-400 uppercase">Total</th>
                <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-400 uppercase">Sursă</th>
                <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-400 uppercase">Status</th>
                <th className="px-2 py-2 text-right text-[10px] font-bold text-slate-400 uppercase">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr><td colSpan={10} className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" /></td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={10} className="py-4 text-center text-slate-400 text-[11px] bg-slate-50/50 dark:bg-slate-800/20 border-b border-dashed border-slate-200 dark:border-slate-800">
                  {search || typeFilter !== "all" ? "Nicio factură pentru filtrele aplicate." : "Nu există facturi. Apasă Sync sau importă XML din pagina Integrări."}
                </td></tr>
              ) : paginated.map((row, i) => {
                const tb = TYPE_BADGE[row.type];
                return (
                  <tr key={`${row.source}-${row.type}-${row.id}`} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${selectedIds.has(`${row.type}-${row.id}`) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        checked={selectedIds.has(`${row.type}-${row.id}`)}
                        onChange={() => toggleSelect(`${row.type}-${row.id}`)}
                      />
                    </td>
                    <td className="px-2 py-2 text-center text-[11px] text-slate-400">{(page - 1) * rowsPerPage + i + 1}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => {
                          if (row.type === 'refacturat') navigate(`/re-facturi/${row.id}`);
                          else if (row.type === 'emis' && row.source === 'manual') navigate(`/facturi-emise-nou/view/${row.id}`);
                          else navigate(`/facturi-primite/${row.id}`);
                        }}
                        className="text-xs font-bold text-blue-600 hover:underline">
                        {row.number}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${tb.cls}`}>{tb.label}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300 max-w-[150px] truncate">{row.partnerName}</td>
                    <td className="px-3 py-2 text-[11px] text-slate-400 whitespace-nowrap">{formatDate(row.date)}</td>
                    <td className="px-3 py-2 text-[11px] text-slate-400 whitespace-nowrap">{formatDate(row.dueDate)}</td>
                    <td className="px-3 py-2 text-xs text-right font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      {formatCurrency(row.total, row.currency as Currency)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {(() => { const sb = SOURCE_BADGE[row.source] || SOURCE_BADGE.manual; return (
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${sb.cls}`}>{sb.label}</span>
                      ); })()}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${STATUS_CLS[row.status] || STATUS_CLS.pending}`}>
                        {getStatusLabel(row.status, row.type)}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1 justify-end">
                        {/* Buton Marchează Achitat/Încasat — doar dacă nu e deja plătit */}
                        {row.status !== 'paid' && row.status !== 'processed' && row.status !== 'storno' && row.type !== 'refacturat' && (
                          <button
                            onClick={() => {
                              if (row.type === 'emis' && row.source === 'manual') {
                                markEmittedPaid.mutate({ id: row.id, status: 'paid' });
                              } else if (row.type === 'primit') {
                                markArchivePaid.mutate({ id: row.id, status: 'processed' });
                              }
                            }}
                            title={row.type === 'primit' ? "Marchează Achitat" : "Marchează Încasat"}
                            className="flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors"
                          >
                            <CheckCircle className="w-3 h-3" />
                          </button>
                        )}

                        {(row.type === 'primit' || (row.type === 'emis' && row.source === 'spv_anaf')) && (
                          <Link href={`/re-facturare/${row.id}`}>
                            <button title="Re-facturează" className="flex items-center justify-center w-6 h-6 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors">
                              <Send className="w-3 h-3" />
                            </button>
                          </Link>
                        )}
                        {/* Buton NIR — doar facturi primite */}
                        {row.type === 'primit' && (
                          <Link href={`/nir/nou/${row.id}`}>
                            <button title="Creează NIR" className="flex items-center justify-center w-6 h-6 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 transition-colors">
                              <ClipboardList className="w-3 h-3" />
                            </button>
                          </Link>
                        )}
                        {row.type === "refacturat" ? (
                          <button onClick={() => handleDownloadReInvoicePDF(row)}
                            title="Descarcă PDF"
                            disabled={downloadPDF.isPending}
                            className="flex items-center justify-center w-6 h-6 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition-colors disabled:opacity-50">
                            {downloadPDF.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />}
                          </button>
                        ) : (
                          <button onClick={() => {
                              if (row.type === 'emis' && row.source === 'manual') {
                                downloadFile(`/api/pdf/emitted/${row.id}?download=1`, `${row.number}.pdf`);
                              } else if (row.fileUrl && row.fileUrl !== "spv_import") {
                                downloadFile(row.fileUrl, `${row.number}.pdf`);
                              } else if (row.type === 'primit' || (row.type === 'emis' && row.source === 'spv_anaf')) {
                                downloadFile(`/api/pdf/archive/${row.id}?download=1`, `${row.number}.pdf`);
                              } else {
                                toast.error("PDF-ul nu este disponibil.");
                              }
                            }}
                            title="Descarcă PDF"
                            className="flex items-center justify-center w-6 h-6 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition-colors">
                            <FileDown className="w-3 h-3" />
                          </button>
                        )}
                        <button onClick={() => setDeleteTarget(row)}
                          title="Șterge factura"
                          className="flex items-center justify-center w-6 h-6 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARDS */}
        <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {isLoading ? (
            <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" /></div>
          ) : paginated.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">Nicio factură.</div>
          ) : paginated.map((row, i) => {
            const tb = TYPE_BADGE[row.type];
            return (
              <div key={`${row.type}-${row.id}`} className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{(page - 1) * rowsPerPage + i + 1}.</span>
                    <button onClick={() => navigate(row.type === 'refacturat' ? `/re-facturare/${row.id}` : `/facturi-primite/${row.id}`)}
                      className="text-xs font-bold text-blue-600 hover:underline truncate">{row.number}</button>
                    <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold border ${tb.cls}`}>{tb.label}</span>
                  </div>
                  <span className="flex-shrink-0 text-xs font-bold text-slate-900 dark:text-white">
                    {formatCurrency(row.total, row.currency as Currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 truncate max-w-[180px]">{row.partnerName}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${STATUS_CLS[row.status] || STATUS_CLS.pending}`}>
                      {STATUS_LBL[row.status] || row.status}
                    </span>

                    <Link href={`/re-facturare/${row.id}`}>
                      <button title="Re-facturează" className="flex items-center justify-center w-5 h-5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        <Send className="w-2.5 h-2.5" />
                      </button>
                    </Link>
                    {row.type === "refacturat" ? (
                      <button onClick={() => handleDownloadReInvoicePDF(row)}
                        title="Descarcă PDF"
                        className="flex items-center justify-center w-5 h-5 rounded bg-slate-50 text-slate-600 border border-slate-200">
                        <FileDown className="w-2.5 h-2.5" />
                      </button>
                    ) : (
                      <button onClick={() => {
                          if (row.fileUrl && row.fileUrl !== "spv_import") window.open(row.fileUrl, '_blank');
                          else toast.error("PDF indisp. (SPV XML)");
                        }}
                        title="Descarcă PDF"
                        className="flex items-center justify-center w-5 h-5 rounded bg-slate-50 text-slate-600 border border-slate-200">
                        <FileDown className="w-2.5 h-2.5" />
                      </button>
                    )}
                    <button onClick={() => setDeleteTarget(row)}
                      className="flex items-center justify-center w-5 h-5 rounded bg-red-50 text-red-600 border border-red-200">
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{formatDate(row.date)}{row.dueDate ? ` · Scad. ${formatDate(row.dueDate)}` : ""}</div>
              </div>
            );
          })}
        </div>

        {/* Footer paginare — obligatoriu */}
        <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-b-lg flex-wrap gap-2">
          <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
            <span className="whitespace-nowrap">
              Afișează&nbsp;
              <select
                value={rowsPerPage}
                onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
                style={{ border: "1px solid #e2e8f0", borderRadius: 9999, padding: "1px 6px", fontSize: 12 }}
                className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 dark:border-slate-700"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={9999}>Toți</option>
              </select>
            </span>
            <span className="whitespace-nowrap">Total înregistrări: <strong>{filtered.length}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <span className="whitespace-nowrap">Pg. {page}/{totalPages}</span>
            <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
              className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}
              className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 transition-colors">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmă ștergerea</AlertDialogTitle>
            <AlertDialogDescription>
              Ești sigur că vrei să ștergi factura <strong>{deleteTarget?.number}</strong>? Această acțiune este definitivă.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Șterge definitiv
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
