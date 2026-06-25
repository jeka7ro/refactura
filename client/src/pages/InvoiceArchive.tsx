import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Upload, Search, FileText, Eye, Trash2, RefreshCw,
  Download, Archive, CheckCircle, Clock,
  ChevronLeft, ChevronRight, X, Loader2,
  FileUp, FolderOpen, Tag
} from "lucide-react";
import { useLocation } from "wouter";

const SOURCE_LABELS: Record<string, string> = {
  smartbill: "SmartBill",
  oblio: "Oblio",
  fgo: "FGO",
  spv_anaf: "SPV ANAF",
  efactura: "e-Factura",
  pdf_manual: "PDF Manual",
  xml_manual: "XML Manual",
  other: "Altă sursă",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "În așteptare", color: "bg-amber-100 text-amber-700 border-amber-200" },
  processed: { label: "Procesată", color: "bg-blue-100 text-blue-700 border-blue-200" },
  refactured: { label: "Re-facturată", color: "bg-green-100 text-green-700 border-green-200" },
  archived: { label: "Arhivată", color: "bg-slate-100 text-slate-600 border-slate-200" },
};

function formatBytes(bytes: number) {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(str: string | null | undefined) {
  if (!str) return "—";
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  return d.toLocaleDateString("ro-RO");
}

function formatAmount(val: string | null | undefined, currency = "RON") {
  if (!val) return "-";
  const n = parseFloat(val);
  if (isNaN(n)) return "-";
  return n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + currency;
}

export default function InvoiceArchive() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [metaForm, setMetaForm] = useState<any>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const LIMIT = 20;

  const { data, isLoading, refetch } = trpc.invoiceArchive.list.useQuery({
    source: filterSource !== "all" ? filterSource : undefined,
    status: filterStatus !== "all" ? filterStatus : undefined,
    search: search || undefined,
    limit: LIMIT,
    offset: page * LIMIT,
  });

  const { data: stats } = trpc.invoiceArchive.stats.useQuery();

  const deleteMutation = trpc.invoiceArchive.delete.useMutation({
    onSuccess: () => { toast.success("Factură ștearsă"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.invoiceArchive.update.useMutation({
    onSuccess: () => { toast.success("Factură actualizată"); refetch(); setShowMetaModal(false); },
    onError: (e) => toast.error(e.message),
  });

  const createMutation = trpc.invoiceArchive.create.useMutation({
    onSuccess: () => { toast.success("Factură adăugată în arhivă"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (!fileArray.length) return;
    setUploading(true);
    try {
      for (const file of fileArray) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload-invoice", { method: "POST", body: formData, credentials: "include" });
        if (!res.ok) {
          const err = await res.text();
          throw new Error(err || "Upload eșuat");
        }
        const { fileKey, fileUrl } = await res.json();
        const ext = file.name.split(".").pop()?.toLowerCase();
        const fileType = ext === "pdf" ? "pdf" : ext === "xml" ? "xml" : "other";
        await createMutation.mutateAsync({
          fileKey,
          fileUrl,
          fileName: file.name,
          fileType: fileType as any,
          fileSize: file.size,
          source: "pdf_manual",
        });
      }
      toast.success(`${fileArray.length} fișier(e) încărcat(e)`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  }, [createMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const openMetaModal = (entry: any) => {
    setSelectedEntry(entry);
    setMetaForm({
      invoiceNumber: entry.invoiceNumber || "",
      supplierName: entry.supplierName || "",
      supplierCUI: entry.supplierCUI || "",
      issueDate: entry.issueDate || "",
      dueDate: entry.dueDate || "",
      total: entry.total || "",
      totalVAT: entry.totalVAT || "",
      currency: entry.currency || "RON",
      status: entry.status || "pending",
      notes: entry.notes || "",
    });
    setShowMetaModal(true);
  };

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Arhivă Facturi</h1>
          <p className="text-sm text-slate-500 mt-0.5">Evidență și păstrare facturi din orice sursă</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Reîncarcă
          </Button>
          <Button size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
            <Upload className="w-3.5 h-3.5" /> Încarcă Facturi
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.xml"
            className="hidden"
            onChange={e => e.target.files && handleFiles(e.target.files)}
          />
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total", value: stats?.total ?? 0, icon: Archive, color: "text-slate-600 bg-slate-50 border-slate-200" },
          { label: "În așteptare", value: stats?.pending ?? 0, icon: Clock, color: "text-amber-600 bg-amber-50 border-amber-200" },
          { label: "Procesate", value: stats?.processed ?? 0, icon: CheckCircle, color: "text-blue-600 bg-blue-50 border-blue-200" },
          { label: "Re-facturate", value: stats?.refactured ?? 0, icon: RefreshCw, color: "text-green-600 bg-green-50 border-green-200" },
        ].map(s => (
          <div key={s.label} className={`flex items-center gap-3 p-3 rounded-lg border ${s.color}`}>
            <s.icon className="w-4 h-4 flex-shrink-0" />
            <div>
              <div className="text-lg leading-none">{s.value}</div>
              <div className="text-xs mt-0.5 opacity-70">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Upload drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-lg p-6 mb-6 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? "border-blue-400 bg-blue-50"
            : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
        }`}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-blue-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Se încarcă fișierele...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <FileUp className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">Trage fișierele aici sau apasă pentru a selecta</p>
              <p className="text-xs text-slate-400 mt-0.5">PDF, XML — SmartBill, Oblio, FGO, SPV ANAF, e-Factura, manual</p>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            placeholder="Caută furnizor, număr factură..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Select value={filterSource} onValueChange={v => { setFilterSource(v); setPage(0); }}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="Sursă" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toate sursele</SelectItem>
            {Object.entries(SOURCE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(0); }}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toate statusurile</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search || filterSource !== "all" || filterStatus !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSearch(""); setFilterSource("all"); setFilterStatus("all"); setPage(0); }}
            className="h-9 gap-1.5 text-slate-500"
          >
            <X className="w-3.5 h-3.5" /> Resetează
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Se încarcă...
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FolderOpen className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">Nicio factură în arhivă</p>
            <p className="text-xs mt-1">Încarcă primul fișier PDF sau XML</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Fișier</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Furnizor</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Nr. Factură</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Dată</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Total</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Sursă</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((item: any) => {
                const st = STATUS_LABELS[item.status] ?? STATUS_LABELS.pending;
                return (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${item.fileType === "pdf" ? "bg-red-50" : "bg-blue-50"}`}>
                          <FileText className={`w-3.5 h-3.5 ${item.fileType === "pdf" ? "text-red-500" : "text-blue-500"}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-slate-800 truncate max-w-[140px]">{item.fileName}</p>
                          <p className="text-slate-400 text-xs">{formatBytes(item.fileSize)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.supplierName || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 text-slate-700">{item.invoiceNumber || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(item.issueDate)}</td>
                    <td className="px-4 py-3 text-right text-slate-800">{formatAmount(item.total, item.currency)}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {SOURCE_LABELS[item.source] ?? item.source}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border ${st.color}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.fileUrl && (
                          <a
                            href={item.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-7 h-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors"
                            title="Descarcă"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          onClick={() => openMetaModal(item)}
                          className="w-7 h-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center hover:bg-amber-50 hover:border-amber-200 hover:text-amber-600 transition-colors"
                          title="Editează metadate"
                        >
                          <Tag className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm("Sigur ștergi această înregistrare?")) {
                              deleteMutation.mutate({ id: item.id });
                            }
                          }}
                          className="w-7 h-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
                          title="Șterge"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-slate-500">
            {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} din {total} înregistrări
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-slate-600 px-2">
              Pagina {page + 1} din {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Meta Edit Modal */}
      {showMetaModal && selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Editează Metadate</h2>
              <button
                onClick={() => setShowMetaModal(false)}
                className="w-7 h-7 rounded-full border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs text-slate-600 mb-1 block">Furnizor</label>
                <Input
                  value={metaForm.supplierName}
                  onChange={e => setMetaForm({ ...metaForm, supplierName: e.target.value })}
                  placeholder="Denumire furnizor"
                  className="h-9 text-sm"
                  autoComplete="organization"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 mb-1 block">CUI Furnizor</label>
                <Input
                  value={metaForm.supplierCUI}
                  onChange={e => setMetaForm({ ...metaForm, supplierCUI: e.target.value })}
                  placeholder="RO12345678"
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 mb-1 block">Nr. Factură</label>
                <Input
                  value={metaForm.invoiceNumber}
                  onChange={e => setMetaForm({ ...metaForm, invoiceNumber: e.target.value })}
                  placeholder="FAC-2024-001"
                  className="h-9 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">Dată emitere</label>
                  <Input
                    type="date"
                    value={metaForm.issueDate}
                    onChange={e => setMetaForm({ ...metaForm, issueDate: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">Dată scadență</label>
                  <Input
                    type="date"
                    value={metaForm.dueDate}
                    onChange={e => setMetaForm({ ...metaForm, dueDate: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">Total (fără TVA)</label>
                  <Input
                    value={metaForm.total}
                    onChange={e => setMetaForm({ ...metaForm, total: e.target.value })}
                    placeholder="1250.00"
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">TVA</label>
                  <Input
                    value={metaForm.totalVAT}
                    onChange={e => setMetaForm({ ...metaForm, totalVAT: e.target.value })}
                    placeholder="237.50"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">Valută</label>
                  <Select value={metaForm.currency} onValueChange={v => setMetaForm({ ...metaForm, currency: v })}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RON">RON</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">Status</label>
                  <Select value={metaForm.status} onValueChange={v => setMetaForm({ ...metaForm, status: v })}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-600 mb-1 block">Note</label>
                <textarea
                  value={metaForm.notes}
                  onChange={e => setMetaForm({ ...metaForm, notes: e.target.value })}
                  placeholder="Note interne..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <Button variant="outline" onClick={() => setShowMetaModal(false)} className="flex-1">
                Anulează
              </Button>
              <Button
                onClick={() => updateMutation.mutate({ id: selectedEntry.id, ...metaForm })}
                disabled={updateMutation.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvează"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
