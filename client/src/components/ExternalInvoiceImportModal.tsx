import { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload,
  X,
  FileText,
  Trash2,
  Loader2,
  CheckCircle2,
  Sparkles,
  Plus,
  Globe,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DraftExternalInvoice {
  uid: string;
  fileKey: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileType: "pdf" | "xml" | "other";
  direction: "in" | "out";
  supplierName: string;
  supplierCUI: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  total: string;
  totalVAT: string;
  notes: string;
  rawXml?: string | null;
}

interface ExternalInvoiceImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialFiles?: File[];
}

const VENDOR_PRESETS = [
  { label: "Google Ireland", name: "Google Ireland Limited", cui: "IE6388047V", currency: "EUR" },
  { label: "Meta / Facebook", name: "Meta Platforms Ireland Limited", cui: "IE9692928F", currency: "EUR" },
  { label: "OpenAI", name: "OpenAI Ireland Ltd", cui: "IE4193588BH", currency: "EUR" },
  { label: "Hetzner", name: "Hetzner Online GmbH", cui: "DE812871812", currency: "EUR" },
  { label: "AWS EMEA", name: "Amazon Web Services EMEA SARL", cui: "LU26888617", currency: "EUR" },
  { label: "Anthropic", name: "Anthropic Ireland, Ltd.", cui: "", currency: "EUR" },
];

export default function ExternalInvoiceImportModal({
  open,
  onClose,
  onSuccess,
  initialFiles,
}: ExternalInvoiceImportModalProps) {
  const [drafts, setDrafts] = useState<DraftExternalInvoice[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processedInitialRef = useRef(false);

  const utils = trpc.useUtils();
  const createMutation = trpc.invoiceArchive.create.useMutation();
  const { data: bnrData } = trpc.system.getBnrRates.useQuery(undefined, {
    enabled: open,
    staleTime: 10 * 60 * 1000,
  });

  const getRateToRon = useCallback(
    (currency: string): number => {
      const cur = (currency || "RON").toUpperCase();
      if (cur === "RON" || cur === "LEI") return 1;
      const r = bnrData?.rates?.[cur];
      if (r && r > 0) return r;
      if (cur === "EUR") return 4.977;
      if (cur === "USD") return 4.58;
      if (cur === "GBP") return 5.85;
      if (cur === "CHF") return 5.32;
      return 1;
    },
    [bnrData]
  );

  const todayIso = new Date().toISOString().slice(0, 10);

  const uploadFiles = useCallback(
    async (filesList: FileList | File[]) => {
      const arr = Array.from(filesList);
      if (arr.length === 0) return;

      setIsUploading(true);
      try {
        const formData = new FormData();
        for (const f of arr) {
          formData.append("file", f);
        }
        const authToken = localStorage.getItem("authToken");
        const res = await fetch("/api/upload-invoice?batch=1", {
          method: "POST",
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
          body: formData,
          credentials: "include",
        });

        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(payload?.error || "Eroare la încărcarea fișierelor");
        }

        const uploadedItems: any[] = Array.isArray(payload) ? payload : [payload];
        const newDrafts: DraftExternalInvoice[] = uploadedItems.map((item) => {
          const ext = item.extracted || {};
          return {
            uid: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            fileKey: item.fileKey,
            fileUrl: item.fileUrl,
            fileName: item.fileName,
            fileSize: item.fileSize || 0,
            fileType: item.fileType || "pdf",
            direction: ext.direction === "out" ? "out" : "in",
            supplierName: ext.supplierName || "",
            supplierCUI: ext.supplierCUI || "",
            invoiceNumber: ext.invoiceNumber || "",
            issueDate: ext.issueDate || todayIso,
            dueDate: ext.dueDate || ext.issueDate || todayIso,
            currency: ext.currency || "EUR",
            total: ext.total ?? "",
            totalVAT: ext.totalVAT ?? "0.00",
            notes: "",
            rawXml: ext.rawXml || null,
          };
        });

        setDrafts((prev) => [...prev, ...newDrafts]);
        toast.success(
          `${newDrafts.length} ${newDrafts.length === 1 ? "fișier analizat" : "fișiere analizate"} — verifică sumele și salvează`
        );
      } catch (err: any) {
        toast.error(err?.message || "Nu s-au putut încărca fișierele");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [todayIso]
  );

  useEffect(() => {
    if (!open) {
      processedInitialRef.current = false;
      setDrafts([]);
      return;
    }
    if (open && initialFiles && initialFiles.length > 0 && !processedInitialRef.current) {
      processedInitialRef.current = true;
      uploadFiles(initialFiles);
    }
  }, [open, initialFiles, uploadFiles]);

  if (!open) return null;

  const updateDraft = (uid: string, patch: Partial<DraftExternalInvoice>) => {
    setDrafts((prev) => prev.map((d) => (d.uid === uid ? { ...d, ...patch } : d)));
  };

  const removeDraft = (uid: string) => {
    setDrafts((prev) => prev.filter((d) => d.uid !== uid));
  };

  const applyVatPreset = (d: DraftExternalInvoice, vatPct: number) => {
    const gross = parseFloat(String(d.total).replace(",", "."));
    if (isNaN(gross) || gross === 0) {
      updateDraft(d.uid, { totalVAT: "0.00" });
      return;
    }
    if (vatPct === 0) {
      updateDraft(d.uid, { totalVAT: "0.00" });
      return;
    }
    const vat = gross - gross / (1 + vatPct / 100);
    updateDraft(d.uid, { totalVAT: (Math.round(vat * 100) / 100).toFixed(2) });
  };

  const handleSaveAll = async () => {
    if (drafts.length === 0) {
      toast.error("Încarcă cel puțin o factură externă (PDF, XML sau imagine).");
      return;
    }

    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i];
      if (!d.supplierName.trim()) {
        toast.error(`Completează furnizorul/partenerul la factura #${i + 1} (${d.fileName}).`);
        return;
      }
      const parsedTotal = parseFloat(String(d.total).replace(",", "."));
      if (isNaN(parsedTotal)) {
        toast.error(`Completează valoarea totală la factura #${i + 1} (${d.fileName}).`);
        return;
      }
      if (!d.issueDate) {
        toast.error(`Completează data emiterii la factura #${i + 1} (${d.fileName}).`);
        return;
      }
    }

    setIsSaving(true);
    try {
      for (const d of drafts) {
        const cleanTotal = parseFloat(String(d.total).replace(",", ".")).toFixed(2);
        const parsedVat = parseFloat(String(d.totalVAT || "0").replace(",", "."));
        const cleanVat = (isNaN(parsedVat) ? 0 : parsedVat).toFixed(2);
        const source = d.fileType === "xml" ? "xml_manual" : "pdf_manual";

        await createMutation.mutateAsync({
          fileKey: d.fileKey,
          fileUrl: d.fileUrl,
          fileName: d.fileName,
          fileType: d.fileType,
          fileSize: d.fileSize,
          direction: d.direction,
          invoiceNumber: d.invoiceNumber.trim() || `EXT-${Date.now().toString().slice(-6)}`,
          supplierName: d.supplierName.trim(),
          supplierCUI: d.supplierCUI.trim() || undefined,
          issueDate: d.issueDate,
          dueDate: d.dueDate || d.issueDate,
          total: cleanTotal,
          totalVAT: cleanVat,
          currency: d.currency.toUpperCase(),
          source,
          notes: d.notes.trim() || undefined,
          rawXml: d.rawXml || undefined,
        });
      }

      await Promise.all([
        utils.invoiceArchive.list.invalidate(),
        utils.invoiceArchive.stats.invalidate(),
        utils.accountantPortal.getData.invalidate(),
      ]);

      toast.success(
        drafts.length === 1
          ? "Factura externă a fost importată în calculul lunar și în Portalul Contabil!"
          : `${drafts.length} facturi externe au fost importate în calculul lunar și în Portalul Contabil!`
      );
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Eroare la salvarea facturilor externe");
    } finally {
      setIsSaving(false);
    }
  };

  const totalRonPreview = drafts.reduce((sum, d) => {
    const val = parseFloat(String(d.total).replace(",", "."));
    if (isNaN(val)) return sum;
    return sum + val * getRateToRon(d.currency);
  }, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-3 sm:p-5 overscroll-contain"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving && !isUploading) onClose();
      }}
    >
      <div className="bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] rounded-[22px] shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden overscroll-contain">
        {/* Header */}
        <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-[12px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4 text-[#0071e3] dark:text-[#0a84ff]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[16px] sm:text-[17px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.02em] truncate">
                Import facturi externe / non-SPV
              </h2>
              <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d] truncate">
                Google, Meta, OpenAI, AWS, furnizori UE/non-UE sau bonuri/facturi externe — intră automat în calculul lunar și în Portalul Contabil
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Închide fereastra"
            className="apple-btn-glass w-8 h-8 rounded-full flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 overscroll-contain">
          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
            }}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={`rounded-[16px] border border-dashed p-5 text-center transition-all cursor-pointer select-none ${
              isDragging
                ? "border-[#0071e3] bg-[#0071e3]/[0.06] dark:border-[#0a84ff] dark:bg-[#0a84ff]/[0.12]"
                : "border-black/[0.14] dark:border-white/[0.16] bg-[#fafafa] dark:bg-[#2c2c2e]/45 hover:bg-[#f2f2f7] dark:hover:bg-[#2c2c2e]/80"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.xml,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => e.target.files && uploadFiles(e.target.files)}
            />
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.10] flex items-center justify-center shrink-0">
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#0071e3] dark:text-[#0a84ff]" />
                ) : (
                  <Upload className="w-4 h-4 text-[#0071e3] dark:text-[#0a84ff]" />
                )}
              </div>
              <div className="text-center sm:text-left">
                <div className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  {isUploading
                    ? "Se încarcă și se extrag datele din document..."
                    : "Trage facturile aici sau apasă pentru a alege fișierele originale"}
                </div>
                <div className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
                  Formate acceptate: PDF original, XML UBL sau imagine scanată (PNG, JPG, WEBP) · max. 25 MB/fișier
                </div>
              </div>
            </div>
          </div>

          {/* Draft Invoices List */}
          {drafts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap px-0.5">
                <span className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />
                  {drafts.length} {drafts.length === 1 ? "document pregătit" : "documente pregătite"} pentru import
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="apple-btn-glass h-7 px-3 rounded-full text-[11.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Mai adaugă fișiere</span>
                </button>
              </div>

              {drafts.map((d, idx) => {
                const parsedTot = parseFloat(String(d.total).replace(",", "."));
                const fx = getRateToRon(d.currency);
                const ronEq = !isNaN(parsedTot) ? parsedTot * fx : 0;

                return (
                  <div
                    key={d.uid}
                    className="rounded-[16px] border border-black/[0.08] dark:border-white/[0.10] bg-[#fafafa]/80 dark:bg-[#242426] p-3.5 sm:p-4 space-y-3"
                  >
                    {/* Card Top Row: Filename + Direction Toggle + Remove */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-[#0071e3]/12 dark:bg-[#0a84ff]/20 text-[#0071e3] dark:text-[#64d2ff] text-[11px] font-bold flex items-center justify-center shrink-0 tabular-nums">
                          {idx + 1}
                        </span>
                        <FileText className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d] shrink-0" />
                        <span
                          className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] truncate max-w-[240px] sm:max-w-[360px]"
                          title={d.fileName}
                        >
                          {d.fileName}
                        </span>
                        <span className="text-[11px] text-[#8e8e93] uppercase shrink-0">
                          {d.fileType}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="apple-segmented">
                          <button
                            type="button"
                            data-active={d.direction === "in"}
                            onClick={() => updateDraft(d.uid, { direction: "in" })}
                            className="apple-segmented-item px-2.5 text-[11.5px] inline-flex items-center gap-1"
                          >
                            <ArrowDownLeft className="w-3 h-3" />
                            <span>Primită (Cheltuială)</span>
                          </button>
                          <button
                            type="button"
                            data-active={d.direction === "out"}
                            onClick={() => updateDraft(d.uid, { direction: "out" })}
                            className="apple-segmented-item px-2.5 text-[11.5px] inline-flex items-center gap-1"
                          >
                            <ArrowUpRight className="w-3 h-3" />
                            <span>Emisă extern</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeDraft(d.uid)}
                          title="Elimină fișierul"
                          aria-label="Elimină fișierul"
                          className="w-7 h-7 rounded-full apple-btn-glass flex items-center justify-center text-[#6e6e73] hover:text-[#ff3b30] dark:text-[#98989d] dark:hover:text-[#ff453a] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Quick Vendor Presets when supplier is empty */}
                    {d.direction === "in" && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] text-[#8e8e93] mr-0.5">Furnizor rapid:</span>
                        {VENDOR_PRESETS.map((vp) => (
                          <button
                            key={vp.label}
                            type="button"
                            onClick={() =>
                              updateDraft(d.uid, {
                                supplierName: vp.name,
                                supplierCUI: vp.cui || d.supplierCUI,
                                currency: vp.currency,
                                totalVAT: "0.00",
                              })
                            }
                            className={`px-2.5 h-6 rounded-full text-[11px] font-medium transition-colors cursor-pointer border ${
                              d.supplierName === vp.name
                                ? "bg-[#0071e3] text-white border-[#0071e3] dark:bg-[#0a84ff] dark:border-[#0a84ff]"
                                : "bg-white dark:bg-[#2c2c2e] text-[#3a3a3c] dark:text-[#ebebf5] border-black/[0.08] dark:border-white/[0.10] hover:bg-black/[0.04] dark:hover:bg-white/[0.08]"
                            }`}
                          >
                            {vp.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Fields Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                      <div className="sm:col-span-5 min-w-0">
                        <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                          {d.direction === "in" ? "Furnizor extern / emitent *" : "Client extern *"}
                        </label>
                        <input
                          value={d.supplierName}
                          onChange={(e) => updateDraft(d.uid, { supplierName: e.target.value })}
                          placeholder="ex: Google Ireland Limited"
                          className="apple-input w-full h-9 px-3 text-[16px] sm:text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                        />
                      </div>

                      <div className="sm:col-span-3 min-w-0">
                        <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                          CUI / Cod TVA (VAT ID)
                        </label>
                        <input
                          value={d.supplierCUI}
                          onChange={(e) => updateDraft(d.uid, { supplierCUI: e.target.value })}
                          placeholder="ex: IE6388047V"
                          className="apple-input w-full h-9 px-3 text-[16px] sm:text-[13px] tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                        />
                      </div>

                      <div className="sm:col-span-4 min-w-0">
                        <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                          Număr factură
                        </label>
                        <input
                          value={d.invoiceNumber}
                          onChange={(e) => updateDraft(d.uid, { invoiceNumber: e.target.value })}
                          placeholder="ex: INV-2026-001"
                          className="apple-input w-full h-9 px-3 text-[16px] sm:text-[13px] tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                        />
                      </div>

                      <div className="sm:col-span-3 min-w-0">
                        <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                          Data emiterii *
                        </label>
                        <input
                          type="date"
                          value={d.issueDate}
                          onChange={(e) => updateDraft(d.uid, { issueDate: e.target.value })}
                          className="apple-input w-full h-9 px-2.5 text-[16px] sm:text-[13px] tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                        />
                      </div>

                      <div className="sm:col-span-3 min-w-0">
                        <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                          Data scadenței
                        </label>
                        <input
                          type="date"
                          value={d.dueDate}
                          onChange={(e) => updateDraft(d.uid, { dueDate: e.target.value })}
                          className="apple-input w-full h-9 px-2.5 text-[16px] sm:text-[13px] tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                        />
                      </div>

                      <div className="sm:col-span-2 min-w-0">
                        <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                          Monedă
                        </label>
                        <Select
                          value={d.currency}
                          onValueChange={(val) => updateDraft(d.uid, { currency: val })}
                        >
                          <SelectTrigger className="apple-input h-9 w-full px-2.5 text-[13px] tabular-nums">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="EUR">EUR (€)</SelectItem>
                            <SelectItem value="USD">USD ($)</SelectItem>
                            <SelectItem value="RON">RON (lei)</SelectItem>
                            <SelectItem value="GBP">GBP (£)</SelectItem>
                            <SelectItem value="CHF">CHF</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="sm:col-span-2 min-w-0">
                        <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                          Total (cu TVA) *
                        </label>
                        <input
                          inputMode="decimal"
                          value={d.total}
                          onChange={(e) => updateDraft(d.uid, { total: e.target.value })}
                          placeholder="0.00"
                          className="apple-input w-full h-9 px-3 text-[16px] sm:text-[13px] font-semibold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                        />
                      </div>

                      <div className="sm:col-span-2 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                            TVA inclus
                          </label>
                          <div className="flex items-center gap-1">
                            {[0, 19, 21].map((pct) => (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => applyVatPreset(d, pct)}
                                className="text-[10px] px-1 rounded bg-black/[0.05] dark:bg-white/[0.08] text-[#6e6e73] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white cursor-pointer tabular-nums"
                                title={`Calculează TVA ${pct}% din Total`}
                              >
                                {pct}%
                              </button>
                            ))}
                          </div>
                        </div>
                        <input
                          inputMode="decimal"
                          value={d.totalVAT}
                          onChange={(e) => updateDraft(d.uid, { totalVAT: e.target.value })}
                          placeholder="0.00"
                          className="apple-input w-full h-9 px-3 text-[16px] sm:text-[13px] tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                        />
                      </div>

                      <div className="sm:col-span-12 flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-0.5">
                        <input
                          value={d.notes}
                          onChange={(e) => updateDraft(d.uid, { notes: e.target.value })}
                          placeholder="Descriere / notă contabilă opțională (ex: Abonament software, Ads, Hosting cloud...)"
                          className="apple-input flex-1 h-8 px-3 text-[16px] sm:text-[12.5px] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                        />
                        {d.currency !== "RON" && !isNaN(parsedTot) && parsedTot !== 0 && (
                          <span className="text-[11.5px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/16 px-2.5 py-1 rounded-full tabular-nums shrink-0">
                            Calcul lunar: ≈{" "}
                            {ronEq.toLocaleString("ro-RO", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            RON (curs BNR {fx.toFixed(4)})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-black/[0.06] dark:border-white/[0.08] bg-[#fafafa]/90 dark:bg-[#18181a] flex items-center justify-between gap-3 flex-wrap shrink-0">
          <div className="text-[12px] text-[#6e6e73] dark:text-[#98989d] tabular-nums">
            {drafts.length > 0 ? (
              <>
                Total echivalent calcul lunar:{" "}
                <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
                  {totalRonPreview.toLocaleString("ro-RO", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  RON
                </strong>
              </>
            ) : (
              <span>Fișierele originale vor fi disponibile direct și pentru contabil în Portal.</span>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="apple-btn-glass h-9 px-4 rounded-full text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
            >
              Anulează
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving || isUploading || drafts.length === 0}
              className="apple-btn-prominent h-9 px-5 rounded-full text-white text-[12.5px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Se salvează...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    Importă {drafts.length > 0 ? `${drafts.length} ` : ""}în evidență & Portal
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
