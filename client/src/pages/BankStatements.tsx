import { useState, useRef, useMemo, useCallback } from "react";
import {
  Landmark,
  Upload,
  Search,
  Eye,
  Download,
  Trash2,
  Pencil,
  RefreshCw,
  Loader2,
  FileText,
  FileSpreadsheet,
  Calendar,
  Coins,
  ShieldCheck,
  X,
  Plus,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import DocumentModalPreview from "@/components/DocumentModalPreview";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DraftStatement {
  uid: string;
  fileKey: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  bankName: string;
  iban: string;
  currency: string;
  statementNumber: string;
  statementMonth: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: string;
  closingBalance: string;
  totalDebit: string;
  totalCredit: string;
  transactionsCount: number | null;
  notes: string;
}

const COMMON_BANKS = [
  "Banca Transilvania",
  "ING Bank",
  "UniCredit Bank",
  "BCR (Banca Comercială Română)",
  "Raiffeisen Bank",
  "BRD - Groupe Société Générale",
  "CEC Bank",
  "Revolut Bank",
  "Salt Bank",
  "Libra Internet Bank",
  "Vista Bank",
  "Garanti BBVA",
  "Trezoreria Statului",
  "Wise",
  "Stripe",
];

function formatMonthRo(ym: string): string {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return ym || "—";
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("ro-RO", { month: "long", year: "numeric" });
}

function getMonthBounds(ym?: string | null): { start: string; end: string } | null {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return null;
  const [y, m] = ym.split("-").map(Number);
  if (!y || m < 1 || m > 12) return null;
  const lastDay = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, "0");
  const dd = String(lastDay).padStart(2, "0");
  return {
    start: `${y}-${mm}-01`,
    end: `${y}-${mm}-${dd}`,
  };
}

function formatDateRo(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatMoney(val: number | null | undefined, currency = "RON"): string {
  if (val === null || val === undefined || isNaN(Number(val))) return "—";
  return `${Number(val).toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function BankStatements() {
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [drafts, setDrafts] = useState<DraftStatement[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingStmt, setEditingStmt] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [copiedIban, setCopiedIban] = useState<string | null>(null);

  const [previewDoc, setPreviewDoc] = useState<{
    isOpen: boolean;
    title: string;
    pdfUrl: string | null;
    filename?: string;
  }>({
    isOpen: false,
    title: "",
    pdfUrl: null,
  });

  const utils = trpc.useUtils();
  const { data, isLoading, refetch } = trpc.bankStatements.list.useQuery();
  const createMutation = trpc.bankStatements.create.useMutation();
  const updateMutation = trpc.bankStatements.update.useMutation({
    onSuccess: () => {
      toast.success("Extrasul de cont a fost actualizat!");
      setEditingStmt(null);
      refetch();
      utils.accountantPortal.getData.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.bankStatements.delete.useMutation({
    onSuccess: () => {
      toast.success("Extrasul de cont a fost șters.");
      setDeleteTarget(null);
      refetch();
      utils.accountantPortal.getData.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const unpackZipMutation = trpc.bankStatements.unpackZip.useMutation({
    onSuccess: (res) => {
      toast.success(`${res.count} extrase PDF au fost extrase și afișate individual!`);
      refetch();
      utils.accountantPortal.getData.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const allItems = data?.items || [];
  const savedAccounts = data?.savedAccounts || [];

  const availableMonths = useMemo(() => {
    const s = new Set<string>();
    allItems.forEach((i: any) => {
      if (i.statementMonth) s.add(i.statementMonth);
    });
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [allItems]);

  const filteredItems = useMemo(() => {
    return allItems.filter((item: any) => {
      if (monthFilter !== "all" && item.statementMonth !== monthFilter) return false;
      if (
        currencyFilter !== "all" &&
        String(item.currency || "RON").toUpperCase() !== currencyFilter
      ) {
        return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${item.bankName || ""} ${item.iban || ""} ${item.statementNumber || ""} ${item.fileName || ""} ${item.notes || ""} ${item.statementMonth || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allItems, monthFilter, currencyFilter, search]);

  const uniqueBanksCount = useMemo(() => {
    const s = new Set<string>();
    allItems.forEach((i: any) => {
      if (i.iban) s.add(i.iban);
      else if (i.bankName) s.add(i.bankName);
    });
    return s.size;
  }, [allItems]);

  const currentYm = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const handleUploadFiles = useCallback(
    async (filesList: FileList | File[]) => {
      const arr = Array.from(filesList);
      if (arr.length === 0) return;

      setShowUploadModal(true);
      setIsUploading(true);
      try {
        const formData = new FormData();
        for (const f of arr) {
          formData.append("files", f);
        }
        const authToken = localStorage.getItem("authToken");
        const res = await fetch("/api/upload-bank-statement", {
          method: "POST",
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
          body: formData,
          credentials: "include",
        });

        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(payload?.error || "Eroare la încărcarea extrasului de cont");
        }

        const uploaded = payload?.files || [];
        const defaultAccount = savedAccounts[0];

        const nextDrafts: DraftStatement[] = uploaded.map((u: any) => {
          const ext = u.extracted || {};
          const matchedSaved = ext.iban
            ? savedAccounts.find(
                (a: any) =>
                  a.iban.replace(/\s+/g, "").toUpperCase() ===
                  String(ext.iban).replace(/\s+/g, "").toUpperCase()
              )
            : null;

          return {
            uid: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            fileKey: u.fileKey,
            fileUrl: u.fileUrl,
            fileName: u.fileName,
            fileSize: u.fileSize || 0,
            fileType: (u.fileType || "pdf").toLowerCase(),
            bankName:
              ext.bankName ||
              matchedSaved?.bankName ||
              defaultAccount?.bankName ||
              "",
            iban: ext.iban || matchedSaved?.iban || defaultAccount?.iban || "",
            currency:
              ext.currency ||
              matchedSaved?.currency ||
              defaultAccount?.currency ||
              "RON",
            statementNumber: ext.statementNumber || "",
            statementMonth: ext.statementMonth || currentYm,
            periodStart:
              ext.periodStart ||
              getMonthBounds(ext.statementMonth || currentYm)?.start ||
              "",
            periodEnd:
              ext.periodEnd ||
              getMonthBounds(ext.statementMonth || currentYm)?.end ||
              "",
            openingBalance: ext.openingBalance ?? "",
            closingBalance: ext.closingBalance ?? "",
            totalDebit: ext.totalDebit ?? "",
            totalCredit: ext.totalCredit ?? "",
            transactionsCount: ext.transactionsCount ?? null,
            notes: "",
          };
        });

        setDrafts((prev) => [...prev, ...nextDrafts]);
        toast.success(
          `${nextDrafts.length} ${nextDrafts.length === 1 ? "extras încărcat" : "extrase încărcate"} — verifică detaliile și salvează`
        );
      } catch (err: any) {
        toast.error(err?.message || "Eroare la încărcare");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [savedAccounts, currentYm]
  );

  const updateDraft = (uid: string, patch: Partial<DraftStatement>) => {
    setDrafts((prev) => prev.map((d) => (d.uid === uid ? { ...d, ...patch } : d)));
  };

  const handleSaveDrafts = async () => {
    if (drafts.length === 0) {
      toast.error("Încarcă cel puțin un fișier de extras de cont.");
      return;
    }
    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i];
      if (!d.bankName.trim()) {
        toast.error(`Completează numele băncii la extrasul #${i + 1} (${d.fileName}).`);
        return;
      }
      if (!/^\d{4}-\d{2}$/.test(d.statementMonth)) {
        toast.error(`Selectează luna extrasului #${i + 1} (${d.fileName}).`);
        return;
      }
    }

    setIsSaving(true);
    try {
      for (const d of drafts) {
        await createMutation.mutateAsync({
          bankName: d.bankName.trim(),
          iban: d.iban.trim() || null,
          currency: d.currency.toUpperCase(),
          statementNumber: d.statementNumber.trim() || null,
          statementMonth: d.statementMonth,
          periodStart: d.periodStart || null,
          periodEnd: d.periodEnd || null,
          openingBalance: d.openingBalance !== "" ? d.openingBalance : null,
          closingBalance: d.closingBalance !== "" ? d.closingBalance : null,
          totalDebit: d.totalDebit !== "" ? d.totalDebit : null,
          totalCredit: d.totalCredit !== "" ? d.totalCredit : null,
          transactionsCount: d.transactionsCount,
          fileKey: d.fileKey,
          fileUrl: d.fileUrl,
          fileName: d.fileName,
          fileType: d.fileType,
          fileSize: d.fileSize,
          notes: d.notes.trim() || null,
        });
      }

      await Promise.all([
        refetch(),
        utils.accountantPortal.getData.invalidate(),
      ]);

      toast.success(
        drafts.length === 1
          ? "Extrasul de cont a fost salvat și publicat în Portalul Contabil!"
          : `${drafts.length} extrase de cont au fost salvate și publicate în Portalul Contabil!`
      );
      setDrafts([]);
      setShowUploadModal(false);
    } catch (err: any) {
      toast.error(err?.message || "Eroare la salvarea extraselor de cont");
    } finally {
      setIsSaving(false);
    }
  };

  const downloadStatementFile = async (stmt: any) => {
    try {
      const token = localStorage.getItem("authToken");
      const url = `/api/pdf/bank-statement/${stmt.id}?download=1`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Fișier indisponibil");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = stmt.fileName || `Extras_${stmt.bankName}_${stmt.statementMonth}.${stmt.fileType || "pdf"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      toast.success("Extras descărcat!");
    } catch (err: any) {
      toast.error(err?.message || "Eroare la descărcarea extrasului");
    }
  };

  const copyIban = (iban: string) => {
    navigator.clipboard.writeText(iban);
    setCopiedIban(iban);
    toast.success("IBAN copiat în clipboard");
    setTimeout(() => setCopiedIban(null), 1800);
  };

  const hasActiveFilters =
    monthFilter !== "all" || currencyFilter !== "all" || search.trim() !== "";

  return (
    <div
      className="p-3 sm:p-5 max-w-full space-y-4 overflow-x-hidden"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.length) handleUploadFiles(e.dataTransfer.files);
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-0.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
              Extrase de Cont
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              <ShieldCheck className="w-3 h-3" />
              <span>Vizibile în Portal Contabil</span>
            </span>
          </div>
          <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums">
            Arhivă extrase bancare (RON, EUR, USD) sincronizată automat cu contabilul ·{" "}
            <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
              {allItems.length}
            </strong>{" "}
            extrase încărcate
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/setari?tab=accountant">
            <span className="apple-btn-glass inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-full text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer">
              <ExternalLink className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d]" />
              <span>Portal Contabil</span>
            </span>
          </Link>

          <button
            type="button"
            onClick={() => refetch()}
            className="apple-btn-glass flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-full text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Actualizează</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setDrafts([]);
              setShowUploadModal(true);
            }}
            className="apple-btn-prominent flex items-center justify-center gap-1.5 h-9 px-4 rounded-full text-white text-[12.5px] font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adaugă extras de cont</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.csv,.txt,.sta,.mt940,.940,.xml,.xlsx,.xls,.zip"
            className="hidden"
            onChange={(e) => e.target.files && handleUploadFiles(e.target.files)}
          />
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              Total extrase
            </span>
            <span className="w-7 h-7 rounded-[8px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
              <FileText className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />
            </span>
          </div>
          <span className="text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
            {allItems.length}
          </span>
        </div>

        <div className="apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              Luni acoperite
            </span>
            <span className="w-7 h-7 rounded-[8px] bg-[#eefbf3] dark:bg-emerald-500/18 flex items-center justify-center shrink-0">
              <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </span>
          </div>
          <span className="text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
            {availableMonths.length}
          </span>
        </div>

        <div className="apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              Conturi / Bănci
            </span>
            <span className="w-7 h-7 rounded-[8px] bg-[#fff6eb] dark:bg-amber-500/18 flex items-center justify-center shrink-0">
              <Landmark className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </span>
          </div>
          <span className="text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
            {uniqueBanksCount}
          </span>
        </div>

        <div className="apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              Sincronizare Contabil
            </span>
            <span className="w-7 h-7 rounded-[8px] bg-[#eefbf3] dark:bg-emerald-500/18 flex items-center justify-center shrink-0">
              <Coins className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[15px] font-bold text-emerald-600 dark:text-emerald-400 leading-none">
              Activă în timp real
            </span>
          </div>
        </div>
      </div>

      {/* Single-Row Filter Bar */}
      <div className="apple-surface px-3 py-2.5">
        <div className="flex flex-wrap xl:flex-nowrap items-center gap-2 w-full min-w-0">
          <div className="apple-segmented max-w-full overflow-x-auto no-scrollbar shrink-0">
            {[
              { id: "all", label: "Toate valutele" },
              { id: "RON", label: "RON" },
              { id: "EUR", label: "EUR" },
              { id: "USD", label: "USD" },
            ].map((c) => (
              <button
                key={c.id}
                type="button"
                data-active={currencyFilter === c.id}
                onClick={() => setCurrencyFilter(c.id)}
                className="apple-segmented-item px-3 shrink-0"
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="xl:ml-auto flex flex-wrap sm:flex-nowrap items-center gap-2 w-full xl:w-auto xl:flex-1 justify-end min-w-0">
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger
                data-filtered={monthFilter !== "all"}
                className="apple-pill-control h-[34px] w-auto min-w-[155px] px-3 shrink-0"
              >
                <Calendar className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d] shrink-0 mr-1.5" />
                <SelectValue placeholder="Toate lunile" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate lunile</SelectItem>
                {availableMonths.map((m) => (
                  <SelectItem key={m} value={m}>
                    {formatMonthRo(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative flex-1 min-w-[160px] max-w-full sm:max-w-[280px]">
              <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Caută bancă, IBAN, fișier..."
                style={{ paddingLeft: 34, paddingRight: search ? 32 : 14 }}
                className="apple-pill-control rounded-full w-full h-[34px] outline-none text-[16px] sm:text-[13px] text-[#1d1d1f] dark:text-white placeholder:text-[#8e8e93]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Șterge căutarea"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center hover:bg-black/[0.06] dark:hover:bg-white/[0.12] cursor-pointer"
                >
                  <X className="w-3 h-3 text-[#6e6e73] dark:text-[#98989d]" />
                </button>
              )}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setMonthFilter("all");
                  setCurrencyFilter("all");
                  setSearch("");
                }}
                title="Resetează filtrele"
                className="apple-pill-control w-[34px] h-[34px] shrink-0 flex items-center justify-center text-[#6e6e73] hover:text-[#1d1d1f] dark:text-[#98989d] dark:hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table / Empty Dropzone */}
      {isLoading ? (
        <div className="apple-surface py-16 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#6e6e73]" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div
          onClick={() => {
            setDrafts([]);
            setShowUploadModal(true);
          }}
          className={`apple-surface p-10 sm:p-14 text-center space-y-3 border border-dashed transition-all cursor-pointer ${
            isDragging
              ? "border-[#0071e3] bg-[#0071e3]/[0.05] dark:border-[#0a84ff]"
              : "border-black/[0.10] dark:border-white/[0.12]"
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center mx-auto">
            <Landmark className="w-6 h-6 text-[#0071e3] dark:text-[#0a84ff]" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
              {hasActiveFilters
                ? "Niciun extras de cont nu corespunde filtrelor"
                : "Niciun extras de cont încărcat încă"}
            </h3>
            <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] max-w-md mx-auto mt-1">
              Încarcă extrasele lunare PDF, CSV, MT940 sau ZIP de la orice bancă (BT, ING, UniCredit, BCR, Raiffeisen, Revolut). Contabilul le va vedea și descărca direct în Portalul Contabil.
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDrafts([]);
              setShowUploadModal(true);
            }}
            className="apple-btn-prominent inline-flex items-center gap-1.5 h-9 px-5 rounded-full text-white text-[12.5px] font-semibold cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Încarcă primul extras de cont</span>
          </button>
        </div>
      ) : (
        <div className="apple-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
                <tr>
                  <th className="px-3 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] w-10 text-center">
                    Nr.
                  </th>
                  <th className="px-3.5 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                    Lună / Perioadă
                  </th>
                  <th className="px-3.5 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                    Bancă & Cont IBAN
                  </th>
                  <th className="px-3.5 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                    Fișier original
                  </th>
                  <th className="px-3.5 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] text-right whitespace-nowrap">
                    Sold inițial
                  </th>
                  <th className="px-3.5 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] text-right whitespace-nowrap">
                    Sold final
                  </th>
                  <th className="px-3.5 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] text-right whitespace-nowrap">
                    Acțiuni
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
                {filteredItems.map((stmt: any, idx: number) => {
                  const isPdf = String(stmt.fileType || "").toLowerCase() === "pdf";
                  const isZip = String(stmt.fileType || "").toLowerCase() === "zip";
                  return (
                    <tr
                      key={stmt.id}
                      className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors"
                    >
                      <td className="px-3 py-3 text-center text-[12px] text-[#8e8e93] tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap tabular-nums">
                        <div className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] capitalize">
                          {formatMonthRo(stmt.statementMonth)}
                        </div>
                        <div className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
                          {stmt.periodStart && stmt.periodEnd
                            ? `${formatDateRo(stmt.periodStart)} – ${formatDateRo(stmt.periodEnd)}`
                            : stmt.statementNumber
                              ? `Extras #${stmt.statementNumber}`
                              : stmt.statementMonth}
                        </div>
                      </td>
                      <td className="px-3.5 py-3 max-w-[235px]">
                        <div className="flex items-center gap-2">
                          <span className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
                            {stmt.bankName}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#3a3a3c] dark:text-[#ebebf5] tabular-nums shrink-0">
                            {stmt.currency}
                          </span>
                        </div>
                        {stmt.iban && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] tabular-nums truncate">
                              {stmt.iban}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyIban(stmt.iban)}
                              title="Copiază IBAN"
                              className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[#8e8e93] hover:text-[#1d1d1f] dark:hover:text-white cursor-pointer shrink-0"
                            >
                              {copiedIban === stmt.iban ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-3 max-w-[205px]">
                        <div className="flex items-center gap-2 min-w-0">
                          {isPdf ? (
                            <FileText className="w-4 h-4 text-[#0071e3] dark:text-[#0a84ff] shrink-0" />
                          ) : (
                            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div
                              className="text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] truncate"
                              title={stmt.fileName}
                            >
                              {stmt.fileName}
                            </div>
                            <div className="text-[11px] text-[#8e8e93] tabular-nums">
                              {(stmt.fileType || "pdf").toUpperCase()}
                              {stmt.fileSize ? ` · ${formatFileSize(stmt.fileSize)}` : ""}
                              {stmt.notes ? ` · ${stmt.notes}` : ""}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3.5 py-3 text-right text-[13px] text-[#6e6e73] dark:text-[#98989d] tabular-nums whitespace-nowrap">
                        {formatMoney(stmt.openingBalance, stmt.currency)}
                      </td>
                      <td className="px-3.5 py-3 text-right text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums whitespace-nowrap">
                        {formatMoney(stmt.closingBalance, stmt.currency)}
                      </td>
                      <td className="px-3.5 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {isZip && (
                            <button
                              type="button"
                              onClick={() => unpackZipMutation.mutate({ id: stmt.id })}
                              disabled={unpackZipMutation.isPending}
                              title="Extrage și afișează individual toate PDF-urile din arhiva ZIP"
                              className="apple-btn-prominent h-8 px-3 rounded-full inline-flex items-center gap-1.5 text-white text-[11.5px] font-semibold cursor-pointer disabled:opacity-50"
                            >
                              {unpackZipMutation.isPending ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <FileText className="w-3.5 h-3.5" />
                              )}
                              <span>Dezarhivează</span>
                            </button>
                          )}
                          {isPdf && (
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewDoc({
                                  isOpen: true,
                                  title: `Extras ${stmt.bankName} — ${formatMonthRo(stmt.statementMonth)}`,
                                  pdfUrl: `/api/pdf/bank-statement/${stmt.id}`,
                                  filename: stmt.fileName,
                                })
                              }
                              title="Previzualizează PDF"
                              aria-label="Previzualizează PDF"
                              className="apple-btn-glass w-8 h-8 rounded-full inline-flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => downloadStatementFile(stmt)}
                            title="Descarcă fișierul original"
                            aria-label="Descarcă fișierul original"
                            className="apple-btn-glass w-8 h-8 rounded-full inline-flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const ym = stmt.statementMonth || currentYm;
                              const bounds = getMonthBounds(ym);
                              setEditingStmt({
                                id: stmt.id,
                                bankName: stmt.bankName || "",
                                iban: stmt.iban || "",
                                currency: stmt.currency || "RON",
                                statementNumber: stmt.statementNumber || "",
                                statementMonth: ym,
                                periodStart: stmt.periodStart || bounds?.start || "",
                                periodEnd: stmt.periodEnd || bounds?.end || "",
                                openingBalance:
                                  stmt.openingBalance !== null ? String(stmt.openingBalance) : "",
                                closingBalance:
                                  stmt.closingBalance !== null ? String(stmt.closingBalance) : "",
                                notes: stmt.notes || "",
                              });
                            }}
                            title="Editează detalii"
                            aria-label="Editează detalii"
                            className="apple-btn-glass w-8 h-8 rounded-full inline-flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(stmt)}
                            title="Șterge extrasul"
                            aria-label="Șterge extrasul"
                            className="apple-btn-glass w-8 h-8 rounded-full inline-flex items-center justify-center text-[#6e6e73] hover:text-[#ff3b30] dark:text-[#98989d] dark:hover:text-[#ff453a] cursor-pointer"
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
          </div>
        </div>
      )}

      {/* Upload & Review Modal */}
      {showUploadModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-3 sm:p-5 overscroll-contain"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSaving && !isUploading) {
              setShowUploadModal(false);
            }
          }}
        >
          <div className="bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] rounded-[22px] shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden overscroll-contain">
            <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-[12px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
                  <Landmark className="w-4 h-4 text-[#0071e3] dark:text-[#0a84ff]" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[16px] sm:text-[17px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
                    Adaugă extrase de cont bancare
                  </h2>
                  <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d] truncate">
                    Extrasele salvate apar automat în Portalul Contabil (tab-ul Extrase de cont + arhiva ZIP)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                disabled={isSaving}
                aria-label="Închide"
                className="apple-btn-glass w-8 h-8 rounded-full flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 overscroll-contain">
              <div
                onClick={() => !isUploading && fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.length) handleUploadFiles(e.dataTransfer.files);
                }}
                className="rounded-[16px] border border-dashed border-black/[0.14] dark:border-white/[0.16] bg-[#fafafa] dark:bg-[#2c2c2e]/45 hover:bg-[#f2f2f7] dark:hover:bg-[#2c2c2e]/80 p-5 text-center transition-all cursor-pointer"
              >
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
                        ? "Se analizează extrasul bancar..."
                        : "Selectează sau trage aici extrasele de cont (PDF, CSV, MT940, XML, XLSX, ZIP)"}
                    </div>
                    <div className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
                      IBAN-ul, banca, valuta și luna sunt detectate automat din fișier.
                    </div>
                  </div>
                </div>
              </div>

              {drafts.map((d, idx) => (
                <div
                  key={d.uid}
                  className="rounded-[16px] border border-black/[0.08] dark:border-white/[0.10] bg-[#fafafa]/80 dark:bg-[#242426] p-3.5 sm:p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-[#0071e3]/12 dark:bg-[#0a84ff]/20 text-[#0071e3] dark:text-[#64d2ff] text-[11px] font-bold flex items-center justify-center shrink-0 tabular-nums">
                        {idx + 1}
                      </span>
                      <FileText className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d] shrink-0" />
                      <span className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
                        {d.fileName}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDrafts((prev) => prev.filter((x) => x.uid !== d.uid))}
                      aria-label="Elimină"
                      className="w-7 h-7 rounded-full apple-btn-glass flex items-center justify-center text-[#6e6e73] hover:text-[#ff3b30] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Quick 1-click saved bank accounts from Settings */}
                  {savedAccounts.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-[#8e8e93]">Conturile firmei:</span>
                      {savedAccounts.map((acc: any) => (
                        <button
                          key={acc.iban}
                          type="button"
                          onClick={() =>
                            updateDraft(d.uid, {
                              bankName: acc.bankName,
                              iban: acc.iban,
                              currency: acc.currency,
                            })
                          }
                          className={`px-2.5 h-6 rounded-full text-[11px] font-medium border cursor-pointer tabular-nums ${
                            d.iban === acc.iban
                              ? "bg-[#0071e3] text-white border-[#0071e3] dark:bg-[#0a84ff] dark:border-[#0a84ff]"
                              : "bg-white dark:bg-[#2c2c2e] text-[#3a3a3c] dark:text-[#ebebf5] border-black/[0.08] dark:border-white/[0.10]"
                          }`}
                        >
                          {acc.bankName} · {acc.currency} ({acc.iban.slice(-6)})
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    <div className="sm:col-span-4 min-w-0">
                      <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                        Bancă *
                      </label>
                      <input
                        list={`banks-list-${d.uid}`}
                        value={d.bankName}
                        onChange={(e) => updateDraft(d.uid, { bankName: e.target.value })}
                        placeholder="ex: Banca Transilvania"
                        className="apple-input w-full h-9 px-3 text-[16px] sm:text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                      />
                      <datalist id={`banks-list-${d.uid}`}>
                        {COMMON_BANKS.map((b) => (
                          <option key={b} value={b} />
                        ))}
                      </datalist>
                    </div>

                    <div className="sm:col-span-5 min-w-0">
                      <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                        Cont IBAN
                      </label>
                      <input
                        value={d.iban}
                        onChange={(e) => updateDraft(d.uid, { iban: e.target.value })}
                        placeholder="RO00BTRL..."
                        className="apple-input w-full h-9 px-3 text-[16px] sm:text-[13px] tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                      />
                    </div>

                    <div className="sm:col-span-3 min-w-0">
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
                          <SelectItem value="RON">RON</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                          <SelectItem value="CHF">CHF</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="sm:col-span-3 min-w-0">
                      <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                        Luna contabilă *
                      </label>
                      <input
                        type="month"
                        value={d.statementMonth}
                        onChange={(e) => {
                          const nextMonth = e.target.value;
                          const bounds = getMonthBounds(nextMonth);
                          updateDraft(d.uid, {
                            statementMonth: nextMonth,
                            ...(bounds
                              ? { periodStart: bounds.start, periodEnd: bounds.end }
                              : {}),
                          });
                        }}
                        className="apple-input w-full h-9 px-2.5 text-[16px] sm:text-[13px] tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                      />
                    </div>

                    <div className="sm:col-span-3 min-w-0">
                      <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                        De la data
                      </label>
                      <input
                        type="date"
                        value={d.periodStart}
                        onChange={(e) => updateDraft(d.uid, { periodStart: e.target.value })}
                        className="apple-input w-full h-9 px-2.5 text-[16px] sm:text-[13px] tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                      />
                    </div>

                    <div className="sm:col-span-3 min-w-0">
                      <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                        Până la data
                      </label>
                      <input
                        type="date"
                        value={d.periodEnd}
                        onChange={(e) => updateDraft(d.uid, { periodEnd: e.target.value })}
                        className="apple-input w-full h-9 px-2.5 text-[16px] sm:text-[13px] tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                      />
                    </div>

                    <div className="sm:col-span-3 min-w-0">
                      <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                        Nr. extras
                      </label>
                      <input
                        value={d.statementNumber}
                        onChange={(e) => updateDraft(d.uid, { statementNumber: e.target.value })}
                        placeholder="Opțional"
                        className="apple-input w-full h-9 px-3 text-[16px] sm:text-[13px] tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                      />
                    </div>

                    <div className="sm:col-span-3 min-w-0">
                      <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                        Sold inițial
                      </label>
                      <input
                        inputMode="decimal"
                        value={d.openingBalance}
                        onChange={(e) => updateDraft(d.uid, { openingBalance: e.target.value })}
                        placeholder="Opțional"
                        className="apple-input w-full h-9 px-3 text-[16px] sm:text-[13px] tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                      />
                    </div>

                    <div className="sm:col-span-3 min-w-0">
                      <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                        Sold final
                      </label>
                      <input
                        inputMode="decimal"
                        value={d.closingBalance}
                        onChange={(e) => updateDraft(d.uid, { closingBalance: e.target.value })}
                        placeholder="Opțional"
                        className="apple-input w-full h-9 px-3 text-[16px] sm:text-[13px] tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                      />
                    </div>

                    <div className="sm:col-span-6 min-w-0">
                      <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                        Observații pentru contabil
                      </label>
                      <input
                        value={d.notes}
                        onChange={(e) => updateDraft(d.uid, { notes: e.target.value })}
                        placeholder="ex: Cont principal RON / Card corporate EUR..."
                        className="apple-input w-full h-9 px-3 text-[16px] sm:text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-3.5 border-t border-black/[0.06] dark:border-white/[0.08] bg-[#fafafa]/90 dark:bg-[#18181a] flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                disabled={isSaving}
                className="apple-btn-glass h-9 px-4 rounded-full text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
              >
                Anulează
              </button>
              <button
                type="button"
                onClick={handleSaveDrafts}
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
                    <span>Salvează și trimite în Portal</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Existing Statement Modal */}
      {editingStmt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-4 overscroll-contain">
          <div className="bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] rounded-[20px] shadow-2xl w-full max-w-md overflow-hidden overscroll-contain">
            <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
              <h2 className="text-[16px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Editează extras de cont
              </h2>
              <button
                type="button"
                onClick={() => setEditingStmt(null)}
                className="apple-btn-glass w-7 h-7 rounded-full flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                  Bancă
                </label>
                <input
                  value={editingStmt.bankName}
                  onChange={(e) => setEditingStmt({ ...editingStmt, bankName: e.target.value })}
                  className="apple-input w-full h-9 px-3 text-[16px] sm:text-[13px] outline-none"
                />
              </div>
              <div>
                <label className="text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                  Cont IBAN
                </label>
                <input
                  value={editingStmt.iban}
                  onChange={(e) => setEditingStmt({ ...editingStmt, iban: e.target.value })}
                  className="apple-input w-full h-9 px-3 text-[16px] sm:text-[13px] tabular-nums outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                    Luna (YYYY-MM)
                  </label>
                  <input
                    type="month"
                    value={editingStmt.statementMonth}
                    onChange={(e) => {
                      const nextMonth = e.target.value;
                      const bounds = getMonthBounds(nextMonth);
                      setEditingStmt({
                        ...editingStmt,
                        statementMonth: nextMonth,
                        ...(bounds
                          ? { periodStart: bounds.start, periodEnd: bounds.end }
                          : {}),
                      });
                    }}
                    className="apple-input w-full h-9 px-2.5 text-[16px] sm:text-[13px] tabular-nums outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                    Monedă
                  </label>
                  <Select
                    value={editingStmt.currency}
                    onValueChange={(val) => setEditingStmt({ ...editingStmt, currency: val })}
                  >
                    <SelectTrigger className="apple-input h-9 w-full px-2.5 text-[13px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RON">RON</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="CHF">CHF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                    De la data
                  </label>
                  <input
                    type="date"
                    value={editingStmt.periodStart || ""}
                    onChange={(e) =>
                      setEditingStmt({ ...editingStmt, periodStart: e.target.value })
                    }
                    className="apple-input w-full h-9 px-2.5 text-[16px] sm:text-[13px] tabular-nums outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                    Până la data
                  </label>
                  <input
                    type="date"
                    value={editingStmt.periodEnd || ""}
                    onChange={(e) =>
                      setEditingStmt({ ...editingStmt, periodEnd: e.target.value })
                    }
                    className="apple-input w-full h-9 px-2.5 text-[16px] sm:text-[13px] tabular-nums outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                    Sold inițial
                  </label>
                  <input
                    value={editingStmt.openingBalance}
                    onChange={(e) =>
                      setEditingStmt({ ...editingStmt, openingBalance: e.target.value })
                    }
                    className="apple-input w-full h-9 px-3 text-[16px] sm:text-[13px] tabular-nums outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                    Sold final
                  </label>
                  <input
                    value={editingStmt.closingBalance}
                    onChange={(e) =>
                      setEditingStmt({ ...editingStmt, closingBalance: e.target.value })
                    }
                    className="apple-input w-full h-9 px-3 text-[16px] sm:text-[13px] tabular-nums outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                  Observații
                </label>
                <input
                  value={editingStmt.notes}
                  onChange={(e) => setEditingStmt({ ...editingStmt, notes: e.target.value })}
                  className="apple-input w-full h-9 px-3 text-[16px] sm:text-[13px] outline-none"
                />
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button
                type="button"
                onClick={() => setEditingStmt(null)}
                className="flex-1 apple-btn-glass h-9 rounded-full text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
              >
                Anulează
              </button>
              <button
                type="button"
                disabled={updateMutation.isPending}
                onClick={() =>
                  updateMutation.mutate({
                    id: editingStmt.id,
                    bankName: editingStmt.bankName,
                    iban: editingStmt.iban || null,
                    currency: editingStmt.currency,
                    statementMonth: editingStmt.statementMonth,
                    periodStart: editingStmt.periodStart || null,
                    periodEnd: editingStmt.periodEnd || null,
                    openingBalance: editingStmt.openingBalance || null,
                    closingBalance: editingStmt.closingBalance || null,
                    notes: editingStmt.notes || null,
                  })
                }
                className="flex-1 apple-btn-prominent h-9 rounded-full text-white text-[12.5px] font-semibold flex items-center justify-center cursor-pointer"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Salvează"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="rounded-[22px] bg-white dark:bg-[#1c1c1e]">
          <AlertDialogHeader>
            <AlertDialogTitle>Ștergi extrasul de cont?</AlertDialogTitle>
            <AlertDialogDescription>
              Extrasul <strong>{deleteTarget?.fileName}</strong> ({deleteTarget?.bankName}) va fi eliminat definitiv din aplicație și din Portalul Contabil.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Anulează</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })}
              className="bg-[#ff3b30] hover:bg-[#d70015] text-white rounded-full"
            >
              Șterge definitiv
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PDF Modal Preview */}
      <DocumentModalPreview
        isOpen={previewDoc.isOpen}
        onClose={() => setPreviewDoc((p) => ({ ...p, isOpen: false, pdfUrl: null }))}
        title={previewDoc.title}
        pdfUrl={previewDoc.pdfUrl}
        filename={previewDoc.filename}
        type="invoice"
      />
    </div>
  );
}
