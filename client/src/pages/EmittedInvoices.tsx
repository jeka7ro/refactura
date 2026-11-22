// EmittedInvoices.tsx — Lista Facturilor Emise Direct din Platformă
import { useState, useMemo } from "react";
import { usePersistentRowsPerPage } from "@/hooks/usePersistentRowsPerPage";
import { Link, useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus,
  Eye,
  Download,
  Upload,
  Pencil,
  Trash2,
  Send,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  Undo2,
  Calendar,
  Tag,
  X,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/store";
import SpvDeadlineBadge from "@/components/SpvDeadlineBadge";
import SpvDeadlineBanner from "@/components/SpvDeadlineBanner";
import { isTransmittedInDeadline } from "@/lib/spvDeadline";
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

const STATUS_LABELS: Record<string, string> = {
  draft: "Ciornă",
  sent: "Emisă",
  paid: "Încasată",
  overdue: "Restanță",
  cancelled: "Anulată",
};
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  sent: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  overdue: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
};
const SPV_LABELS: Record<string, string> = {
  nesincronizat: "Netrimisă",
  in_procesare: "Trimisă",
  validat: "Validată",
  eroare: "Eroare",
  extern: "Extern (D390)",
};
const SPV_COLORS: Record<string, string> = {
  nesincronizat: "text-slate-400",
  in_procesare: "text-blue-500",
  validat: "text-emerald-500 font-bold",
  eroare: "text-rose-500",
  extern: "text-amber-600 dark:text-amber-400 font-bold",
};

function isExternalInvoice(row: any) {
  if (row?.spvStatus === "extern") return true;
  const country = (row?.clientCountry || "").trim().toUpperCase();
  if (country && country !== "RO") return true;
  const cui = (row?.clientCUI || "").trim().toUpperCase();
  if (cui && /^[A-Z]{2}/.test(cui) && !cui.startsWith("RO")) return true;
  return false;
}

export default function EmittedInvoices() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [spvFilter, setSpvFilter] = useState<string>("all");
  const [period, setPeriod] = useState<string>("all");
  const [customFrom, setCustomFrom] = useState(() => new Date().toISOString().split("T")[0]);
  const [customTo, setCustomTo] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; });

  const getDateRange = (p: string): [string, string] | null => {
    const now = new Date();
    const fmt = (d: Date) => {
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      const da = String(d.getDate()).padStart(2, "0");
      return `${yr}-${mo}-${da}`;
    };
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    switch (p) {
      case "today": { const t = fmt(now); return [t, t]; }
      case "week": { const d = startOfDay(now); const day = d.getDay() || 7; d.setDate(d.getDate() - day + 1); const end = new Date(d); end.setDate(end.getDate() + 6); return [fmt(d), fmt(end)]; }
      case "month": { const s = new Date(now.getFullYear(), now.getMonth(), 1); const e = new Date(now.getFullYear(), now.getMonth() + 1, 0); return [fmt(s), fmt(e)]; }
      case "lastMonth": { const s = new Date(now.getFullYear(), now.getMonth() - 1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 0); return [fmt(s), fmt(e)]; }
      case "year": return [`${now.getFullYear()}-01-01`, `${now.getFullYear()}-12-31`];
      case "lastYear": return [`${now.getFullYear() - 1}-01-01`, `${now.getFullYear() - 1}-12-31`];
      case "custom": return customFrom && customTo ? [customFrom, customTo] : null;
      default: return null;
    }
  };
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [stornoTarget, setStornoTarget] = useState<{
    id: number;
    number: string;
  } | null>(null);
  const [spvErrorInvoice, setSpvErrorInvoice] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = usePersistentRowsPerPage("emitted_invoices", 15);

  const { data = [], isLoading, refetch } = trpc.emittedInvoice.list.useQuery();
  const { data: archiveRaw = [], refetch: refetchArchive } = trpc.invoiceArchive.list.useQuery({ limit: 5000 });
  const { data: clientsData = [] } = trpc.clients.list.useQuery();
  const { data: bnrYearRates } = trpc.system.getBnrYearRates.useQuery({
    year: new Date().getFullYear(),
  });
  const { data: bnrData } = trpc.system.getBnrRates.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const getInvoiceRateAndRon = (
    row: {
      total: number | string;
      currency?: string | null;
      issueDate?: string | null;
      notes?: string | null;
      exchangeRate?: number | null;
      rateDate?: string | null;
      totalRon?: number | null;
    }
  ) => {
    const total = parseFloat(String(row.total || 0));
    const curr = (row.currency || "RON").toUpperCase();

    if (curr === "RON") {
      return {
        rate: 1,
        totalRon: total,
        rateDate: row.issueDate || "",
        isForeign: false,
      };
    }

    // 1. If backend already computed it and has valid exchangeRate > 0
    if (row.exchangeRate && row.exchangeRate > 0 && row.exchangeRate !== 1) {
      const totalRon =
        typeof row.totalRon === "number"
          ? row.totalRon
          : parseFloat((total * row.exchangeRate).toFixed(2));
      return {
        rate: row.exchangeRate,
        totalRon,
        rateDate: row.rateDate || row.issueDate || "",
        isForeign: true,
      };
    }

    // 2. Check if explicit curs in notes (e.g. SAGA notes: "EUR la curs 5.2429")
    if (row.notes) {
      const match = row.notes.match(/curs\s+([0-9]+[.,][0-9]+)/i);
      if (match) {
        const parsedRate = parseFloat(match[1].replace(",", "."));
        if (parsedRate > 0) {
          return {
            rate: parsedRate,
            totalRon: parseFloat((total * parsedRate).toFixed(2)),
            rateDate: row.issueDate || "",
            isForeign: true,
          };
        }
      }
    }

    // 3. Look up from bnrYearRates map (closest prior banking day)
    if (bnrYearRates && row.issueDate) {
      const cleanDate = row.issueDate.split("T")[0];
      const availableDates = Object.keys(bnrYearRates).sort((a, b) => b.localeCompare(a));
      const priorDates = availableDates.filter(d => d <= cleanDate);
      const chosenDate = priorDates[0] || availableDates[0];
      if (chosenDate && bnrYearRates[chosenDate]?.[curr]) {
        const rate = bnrYearRates[chosenDate][curr];
        return {
          rate,
          totalRon: parseFloat((total * rate).toFixed(2)),
          rateDate: chosenDate,
          isForeign: true,
        };
      }
    }

    // 4. Fallback to live BNR rate or reference default
    const liveRate = bnrData?.rates?.[curr];
    const rate = liveRate || (curr === "EUR" ? 5.3370 : curr === "USD" ? 4.7571 : 1);
    return {
      rate,
      totalRon: parseFloat((total * rate).toFixed(2)),
      rateDate: row.issueDate || "",
      isForeign: true,
    };
  };

  const getClientId = (r: any) => {
    if (r.clientId) return r.clientId;
    if (!clientsData || !Array.isArray(clientsData)) return null;
    const clean = (s?: string) => (s || "").replace(/^[A-Z]{2}/i, "").trim().toLowerCase();
    const cCui = clean(r.clientCUI);
    const cName = (r.clientName || "").trim().toLowerCase();
    if (cCui) {
      const match = (clientsData as any[]).find((c: any) => clean(c.cui) === cCui);
      if (match) return match.id;
    }
    if (cName) {
      const match = (clientsData as any[]).find((c: any) => (c.name || "").trim().toLowerCase() === cName);
      if (match) return match.id;
    }
    return null;
  };

  // Combine both sources: emitted invoices (FACT-*) + archive OUT invoices (TON-*)
  const allData = useMemo(() => {
    const emitted = data.map(r => ({ ...r, _source: "emitted" as const }));
    const archiveItems = (() => {
      const raw = archiveRaw as unknown as { items: any[] } | any[];
      return (raw as any)?.items ?? (Array.isArray(raw) ? raw : []);
    })();
    const archived = archiveItems
      .filter((r: any) => r.direction === "out" || r.direction === "emis")
      .map((r: any) => ({
        id: r.id,
        number: r.invoiceNumber || `#${r.id}`,
        clientName: r.supplierName || r.buyerName || "",
        clientCUI: r.supplierCif || r.buyerCif || "",
        issueDate: r.issueDate,
        dueDate: r.dueDate,
        total: parseFloat(r.total || "0"),
        currency: r.currency || "RON",
        status: r.status || "sent",
        spvStatus: r.spvStatus,
        spvIndex: r.spvIndex || (r.fileName ? (r.fileName.match(/SPV_(\d+)/)?.[1] ?? null) : null),
        series: "",
        _source: "archive" as const,
      }));
    return [...emitted, ...archived].sort((a, b) =>
      new Date(b.issueDate || "").getTime() - new Date(a.issueDate || "").getTime()
    );
  }, [data, archiveRaw]);

  const refetchAll = () => { refetch(); refetchArchive(); };

  // Stare pentru import facturi externe SAGA
  const [showSagaModal, setShowSagaModal] = useState(false);
  const [sagaFile, setSagaFile] = useState<File | null>(null);
  const [isImportingSaga, setIsImportingSaga] = useState(false);
  const [sagaImportResult, setSagaImportResult] = useState<any>(null);

  const handleImportSagaInvoices = async () => {
    if (!sagaFile) return;
    setIsImportingSaga(true);
    setSagaImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", sagaFile);
      const res = await fetch("/api/saga/import-invoices", {
        method: "POST",
        body: formData,
      });
      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSagaImportResult({ success: false, error: resData.error || "Eroare la import." });
        toast.error(resData.error || "Eroare la importul facturilor SAGA.");
        return;
      }
      setSagaImportResult(resData);
      toast.success(resData.message || "Facturi externe importate cu succes!");
      refetchAll();
    } catch (e: any) {
      setSagaImportResult({ success: false, error: e.message || "Eroare conexiune." });
      toast.error("Eroare de conexiune la server.");
    } finally {
      setIsImportingSaga(false);
    }
  };

  const deleteMutation = trpc.emittedInvoice.delete.useMutation({
    onSuccess: () => {
      toast.success("Factura ștearsă");
      refetch();
      setDeleteId(null);
    },
    onError: e => {
      toast.error("Eroare: " + e.message);
      setDeleteId(null);
    },
  });
  const sendToSpv = trpc.emittedInvoice.sendToSpv.useMutation({
    onSuccess: res => {
      if (res.success)
        toast.success("Trimisă în SPV! Index: " + res.index_incarcare);
      else toast.error("Eroare SPV: " + res.error);
      refetchAll();
    },
    onError: e => toast.error("Eroare SPV: " + e.message),
  });

  const filtered = useMemo(() => {
    let rows = allData;
    if (statusFilter !== "all")
      rows = rows.filter(r => r.status === statusFilter);
    if (period !== "all") {
      const range = getDateRange(period);
      if (range) {
        const [start, end] = range;
        const startDate = new Date(start).getTime();
        const endDate = new Date(end).getTime() + 86400000;
        rows = rows.filter(r => {
          if (!r.issueDate) return false;
          const d = new Date(r.issueDate).getTime();
          return d >= startDate && d < endDate;
        });
      }
    }
    if (spvFilter !== "all") {
      if (spvFilter === "extern") {
        rows = rows.filter(r => isExternalInvoice(r));
      } else {
        rows = rows.filter(r => !isExternalInvoice(r) && (r.spvStatus || "nesincronizat") === spvFilter);
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        r =>
          r.number.toLowerCase().includes(q) ||
          r.clientName.toLowerCase().includes(q) ||
          (r.clientCUI || "").includes(q)
      );
    }
    return rows;
  }, [allData, statusFilter, spvFilter, period, customFrom, customTo, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const paged = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const totals = useMemo(() => {
    let totalRonOnly = 0;
    let totalEur = 0;
    let totalEurInRon = 0;
    let totalUsd = 0;
    let totalUsdInRon = 0;
    let totalConvertedRon = 0;

    for (const r of filtered) {
      const computed = getInvoiceRateAndRon(r);
      const originalTotal = parseFloat(String(r.total || 0));
      const curr = (r.currency || "RON").toUpperCase();

      totalConvertedRon += computed.totalRon;

      if (curr === "EUR") {
        totalEur += originalTotal;
        totalEurInRon += computed.totalRon;
      } else if (curr === "USD") {
        totalUsd += originalTotal;
        totalUsdInRon += computed.totalRon;
      } else {
        totalRonOnly += originalTotal;
      }
    }

    return {
      totalRonOnly,
      totalEur,
      totalEurInRon,
      totalUsd,
      totalUsdInRon,
      totalConvertedRon,
      hasEur: totalEur > 0,
      hasForeign: totalEur > 0 || totalUsd > 0,
    };
  }, [filtered, bnrYearRates, bnrData]);

  const counts = useMemo(
    () => ({
      all: allData.length,
      draft: allData.filter(r => r.status === "draft").length,
      sent: allData.filter(r => r.status === "sent").length,
      paid: allData.filter(r => r.status === "paid").length,
      overdue: allData.filter(r => r.status === "overdue").length,
    }),
    [allData]
  );

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Facturi Emise
          </h1>
          <p className="text-[11px] sm:text-sm text-slate-500 font-medium">
            Facturi emise direct din platformă
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/facturi-emise-nou/new">
            <button className="flex items-center justify-center h-9 px-5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors shadow-sm flex-shrink-0">
              <span>Factură Nouă</span>
            </button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4 pb-2 tabular-nums">
        {/* Card 1: Total Facturi */}
        <div className="bg-white dark:bg-[#1c1c1e] rounded-[22px] border border-black/[0.06] dark:border-white/[0.09] p-3.5 sm:p-4 flex flex-col justify-between min-h-[4.5rem] sm:min-h-[5.5rem] shadow-sm transition-all hover:shadow-md">
          <div>
            <p className="text-[10px] sm:text-[10.5px] font-semibold uppercase tracking-wider text-[#636366] dark:text-[#98989d] mb-1 truncate">
              Total Facturi
            </p>
            <p className="text-base sm:text-2xl font-bold text-[#1d1d1f] dark:text-white leading-none truncate">
              {allData.length}
            </p>
          </div>
          {filtered.length !== allData.length && (
            <p className="text-[10.5px] sm:text-[11px] font-medium text-[#636366] dark:text-[#98989d] mt-1 truncate">
              {filtered.length} filtrate
            </p>
          )}
        </div>

        {/* Card 2: Încasate */}
        <div className="bg-white dark:bg-[#1c1c1e] rounded-[22px] border border-black/[0.06] dark:border-white/[0.09] p-3.5 sm:p-4 flex flex-col justify-between min-h-[4.5rem] sm:min-h-[5.5rem] shadow-sm transition-all hover:shadow-md">
          <div>
            <p className="text-[10px] sm:text-[10.5px] font-semibold uppercase tracking-wider text-[#636366] dark:text-[#98989d] mb-1 truncate">
              Încasate
            </p>
            <p className="text-base sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 leading-none truncate">
              {counts.paid}
            </p>
          </div>
          <p className="text-[10.5px] sm:text-[11px] font-medium text-emerald-600/80 dark:text-emerald-400/80 mt-1 truncate">
            {allData.length > 0 ? `${Math.round((counts.paid / allData.length) * 100)}% din total` : "0%"}
          </p>
        </div>

        {/* Card 3: Restanțe */}
        <div className="bg-white dark:bg-[#1c1c1e] rounded-[22px] border border-black/[0.06] dark:border-white/[0.09] p-3.5 sm:p-4 flex flex-col justify-between min-h-[4.5rem] sm:min-h-[5.5rem] shadow-sm transition-all hover:shadow-md">
          <div>
            <p className="text-[10px] sm:text-[10.5px] font-semibold uppercase tracking-wider text-[#636366] dark:text-[#98989d] mb-1 truncate">
              Restanțe
            </p>
            <p className="text-base sm:text-2xl font-bold text-rose-600 dark:text-rose-400 leading-none truncate">
              {counts.overdue}
            </p>
          </div>
          <p className="text-[10.5px] sm:text-[11px] font-medium text-[#636366] dark:text-[#98989d] mt-1 truncate">
            {counts.overdue === 0 ? "Fără restanțe" : "Necesită atenție"}
          </p>
        </div>

        {/* Card 4: Total EUR (cu echivalent Lei la curs BNR din ziua fiecărei facturi) */}
        <div className="bg-white dark:bg-[#1c1c1e] rounded-[22px] border border-amber-200/80 dark:border-amber-900/50 p-3.5 sm:p-4 flex flex-col justify-between min-h-[4.5rem] sm:min-h-[5.5rem] shadow-sm transition-all hover:shadow-md bg-gradient-to-br from-amber-50/40 to-transparent dark:from-amber-950/20">
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] sm:text-[10.5px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 truncate">
                Valoare EUR
              </p>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100/80 dark:bg-amber-900/50 px-1.5 py-0.5 rounded-full leading-none">
                EUR
              </span>
            </div>
            <p className="text-base sm:text-2xl font-bold text-amber-600 dark:text-amber-400 leading-none truncate">
              {formatCurrency(totals.totalEur, "EUR")}
            </p>
          </div>
          <p className="text-[10.5px] sm:text-[11px] font-semibold text-[#636366] dark:text-[#98989d] mt-1 truncate" title="Echivalent în lei la cursul oficial BNR din data fiecărei facturi">
            {totals.totalEur > 0
              ? `≈ ${formatCurrency(totals.totalEurInRon, "RON")} (curs BNR)`
              : "0,00 facturi EUR"}
          </p>
        </div>

        {/* Card 5: Valoare Totală (Echivalent RON la curs BNR) */}
        <div className="bg-white dark:bg-[#1c1c1e] rounded-[22px] border border-black/[0.06] dark:border-white/[0.09] p-3.5 sm:p-4 flex flex-col justify-between min-h-[4.5rem] sm:min-h-[5.5rem] shadow-sm transition-all hover:shadow-md col-span-2 sm:col-span-1">
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] sm:text-[10.5px] font-semibold uppercase tracking-wider text-[#636366] dark:text-[#98989d] truncate">
                Valoare Totală
              </p>
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded-full leading-none">
                RON
              </span>
            </div>
            <p className="text-base sm:text-2xl font-bold text-[#1d1d1f] dark:text-white leading-none truncate">
              {formatCurrency(totals.totalConvertedRon, "RON")}
            </p>
          </div>
          <p className="text-[10.5px] sm:text-[11px] font-medium text-[#636366] dark:text-[#98989d] mt-1 truncate" title={totals.hasEur ? `${formatCurrency(totals.totalRonOnly, "RON")} + ${formatCurrency(totals.totalEur, "EUR")} convertit la curs BNR` : "Toate facturile emise"}>
            {totals.hasEur
              ? `${formatCurrency(totals.totalRonOnly, "RON")} + ${formatCurrency(totals.totalEur, "EUR")}`
              : "Inclusiv toate emiterile"}
          </p>
        </div>
      </div>

      {/* Reminder Termen Legal SPV (5 zile lucrătoare) */}
      <SpvDeadlineBanner invoices={data} />

      {/* Table Card */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-[22px] border border-black/[0.06] dark:border-white/[0.09] overflow-hidden shadow-sm">
        {/* Search & Filtre — cu iconițe și dimensiuni ca în AllInvoices */}
        <div className="px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center gap-2.5 flex-wrap bg-[#f5f7fb]/85 dark:bg-white/[0.025]">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-[#636366] dark:text-[#98989d] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              style={{ paddingLeft: 36, paddingRight: search ? 80 : 14 }}
              className="rounded-full w-full h-9 border border-black/[0.08] dark:border-white/[0.12] outline-none text-[13px] bg-white/90 dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-white placeholder:text-[#636366] dark:placeholder:text-[#98989d] focus:bg-white dark:focus:bg-[#3a3a3c] transition-all"
              placeholder="Caută factură, client, CUI..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            {search && (
              <>
                <div className="absolute right-9 top-1/2 -translate-y-1/2 bg-blue-600 text-white rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums">
                  {filtered.length}/{allData.length}
                </div>
                <button
                  type="button"
                  aria-label="Șterge căutarea"
                  onClick={() => setSearch("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/[0.06] dark:hover:bg-white/[0.10] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5 text-[#636366] hover:text-[#1d1d1f] dark:text-[#98989d] dark:hover:text-white" />
                </button>
              </>
            )}
          </div>

          {/* Perioadă Filter */}
          <div className="w-[140px] sm:w-[155px] flex-shrink-0">
            <Select
              value={period}
              onValueChange={val => {
                setPeriod(val as any);
                const range = getDateRange(val);
                if (range && val !== "custom") {
                  setCustomFrom(range[0]);
                  setCustomTo(range[1]);
                }
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-full rounded-full text-xs font-bold border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 shadow-none flex items-center gap-1.5 px-3">
                <Calendar className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <SelectValue placeholder="Perioadă" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate dățile</SelectItem>
                <SelectItem value="today">Azi</SelectItem>
                <SelectItem value="week">Săpt. curentă</SelectItem>
                <SelectItem value="month">Luna curentă</SelectItem>
                <SelectItem value="lastMonth">Luna trecută</SelectItem>
                <SelectItem value="year">Anul curent</SelectItem>
                <SelectItem value="lastYear">Anul trecut</SelectItem>
                <SelectItem value="custom">Personalizat...</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="w-[125px] sm:w-[140px] flex-shrink-0">
            <Select
              value={statusFilter}
              onValueChange={val => {
                setStatusFilter(val as any);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-full rounded-full text-xs font-bold border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 shadow-none flex items-center gap-1.5 px-3">
                <Tag className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate statusurile</SelectItem>
                <SelectItem value="draft">Ciornă ({counts.draft})</SelectItem>
                <SelectItem value="sent">Emise ({counts.sent})</SelectItem>
                <SelectItem value="paid">Încasate ({counts.paid})</SelectItem>
                <SelectItem value="overdue">Restanțe ({counts.overdue})</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* SPV Filter */}
          <div className="w-[130px] sm:w-[150px] flex-shrink-0">
            <Select
              value={spvFilter}
              onValueChange={val => {
                setSpvFilter(val as any);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-full rounded-full text-xs font-bold border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 shadow-none flex items-center gap-1.5 px-3">
                <Send className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                <SelectValue placeholder="Stare SPV" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate SPV</SelectItem>
                <SelectItem value="validat">Validate</SelectItem>
                <SelectItem value="in_procesare">În procesare</SelectItem>
                <SelectItem value="eroare">Erori SPV</SelectItem>
                <SelectItem value="nesincronizat">Netrimise</SelectItem>
                <SelectItem value="extern">Externe (D390)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {period === "custom" && (
          <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 flex items-center gap-2 text-xs">
            <Calendar className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-slate-500 font-medium">De la:</span>
            <input
              type="date"
              value={customFrom}
              onChange={e => {
                setCustomFrom(e.target.value);
                setPage(1);
              }}
              className="h-7 px-3 text-xs bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-slate-500 font-medium">Până la:</span>
            <input
              type="date"
              value={customTo}
              onChange={e => {
                setCustomTo(e.target.value);
                setPage(1);
              }}
              className="h-7 px-3 text-xs bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f8f9fc]/90 dark:bg-white/[0.02] border-b border-black/[0.06] dark:border-white/[0.08]">
                <th className="text-center w-12 px-4 py-3 text-[10.5px] font-semibold uppercase tracking-wider text-[#636366] dark:text-[#98989d] whitespace-nowrap">
                  Nr.
                </th>
                <th className="text-left px-4 py-3 text-[10.5px] font-semibold uppercase tracking-wider text-[#636366] dark:text-[#98989d] whitespace-nowrap">
                  Număr Factură
                </th>
                <th className="text-left px-4 py-3 text-[10.5px] font-semibold uppercase tracking-wider text-[#636366] dark:text-[#98989d]">
                  Client
                </th>
                <th className="text-left px-4 py-3 text-[10.5px] font-semibold uppercase tracking-wider text-[#636366] dark:text-[#98989d] hidden md:table-cell whitespace-nowrap">
                  Dată / Scadență
                </th>
                <th className="text-right px-4 py-3 text-[10.5px] font-semibold uppercase tracking-wider text-[#636366] dark:text-[#98989d] whitespace-nowrap">
                  Total
                </th>
                <th className="text-left px-4 py-3 text-[10.5px] font-semibold uppercase tracking-wider text-[#636366] dark:text-[#98989d] hidden lg:table-cell whitespace-nowrap">
                  Data Transmisă / Index
                </th>
                <th className="text-right px-4 py-3 text-[10.5px] font-semibold uppercase tracking-wider text-[#636366] dark:text-[#98989d] whitespace-nowrap">
                  Acțiuni
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto" />
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-12 text-slate-400 text-sm"
                  >
                    {data.length === 0
                      ? "Nicio factură emisă încă. Apasă pe «Emite Factură Nouă»."
                      : "Niciun rezultat pentru filtrele selectate."}
                  </td>
                </tr>
              ) : (
                paged.map((row, idx) => (
                  <tr
                    key={`${row._source}-${row.id}`}
                    onClick={() =>
                      row._source === "archive"
                        ? navigate(`/facturi/${row.id}`)
                        : navigate(`/facturi-emise-nou/view/${row.id}`)
                    }
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <td className="text-center px-4 py-2.5 text-[#636366] dark:text-[#98989d] text-xs whitespace-nowrap tabular-nums">
                      <div className="h-10 flex items-center justify-center font-medium">
                        {(page - 1) * rowsPerPage + idx + 1}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">
                      <div className="h-10 flex flex-col justify-center">
                        <div className="h-5 flex items-center gap-1.5">
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline text-left">
                            {row.number}
                          </span>
                          {row._source === "archive" && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 leading-none">SPV</span>
                          )}
                        </div>
                        <div className="h-5 flex items-center">
                          {(() => {
                            const effectiveStatus =
                              row.status === "draft" &&
                              (Boolean(row.spvIndex) ||
                                row.spvStatus === "validat" ||
                                row.spvStatus === "in_procesare")
                                ? "sent"
                                : row.status || "draft";
                            return (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10.5px] font-medium border leading-none ${STATUS_COLORS[effectiveStatus]}`}
                              >
                                {STATUS_LABELS[effectiveStatus]}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="h-10 flex flex-col justify-center">
                        <div className="h-5 flex items-center">
                          {(() => {
                            const cId = getClientId(row);
                            return (
                              <Link
                                href={cId ? `/client/${cId}` : `/clienti?search=${encodeURIComponent(row.clientName)}`}
                                onClick={e => e.stopPropagation()}
                                className="text-xs font-bold text-[#1d1d1f] dark:text-white max-w-[200px] truncate hover:underline hover:text-primary transition-colors cursor-pointer block"
                                title={row.clientName}
                              >
                                {row.clientName}
                              </Link>
                            );
                          })()}
                        </div>
                        <div className="h-5 flex items-center text-[11px] text-[#636366] dark:text-[#98989d] font-normal tabular-nums">
                          {row.clientCUI ? `CUI: ${row.clientCUI}` : "—"}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell whitespace-nowrap tabular-nums">
                      <div className="h-10 flex flex-col justify-center">
                        <div className="h-5 flex items-center">
                          <span className="text-xs font-bold text-[#1d1d1f] dark:text-white">
                            {formatDate(row.issueDate)}
                          </span>
                        </div>
                        <div className="h-5 flex items-center text-[11px] text-[#636366] dark:text-[#98989d] font-normal">
                          {row.dueDate ? `Scad: ${formatDate(row.dueDate)}` : "—"}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">
                      <div className="h-10 flex flex-col justify-center items-end">
                        <div className="h-5 flex items-center justify-end">
                          <span className="text-xs font-bold text-[#1d1d1f] dark:text-white">
                            {formatCurrency(
                              parseFloat(String(row.total)),
                              (row.currency || "RON") as any
                            )}
                          </span>
                        </div>
                        <div className="h-5 flex items-center justify-end">
                          {(() => {
                            const computed = getInvoiceRateAndRon(row);
                            if (computed.isForeign) {
                              return (
                                <div className="flex items-center gap-1.5 leading-none">
                                  <span
                                    className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60"
                                    title={`Curs BNR din ${formatDate(computed.rateDate || row.issueDate)}: ${computed.rate.toFixed(4)} lei/${row.currency}`}
                                  >
                                    ≈ {formatCurrency(computed.totalRon, "RON")}
                                  </span>
                                  <span
                                    className="text-[10px] text-[#636366] dark:text-[#98989d] tabular-nums"
                                    title={`Curs oficial BNR: ${computed.rate.toFixed(4)}`}
                                  >
                                    ({computed.rate.toFixed(4)})
                                  </span>
                                  {isExternalInvoice(row) && (
                                    <span
                                      className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                                      title="Factură externă (UE/Non-UE). Nu se transmite în RO e-Factura, se declară prin D390/D300."
                                    >
                                      D390
                                    </span>
                                  )}
                                </div>
                              );
                            }
                            if (row._source === "archive") {
                              return (
                                <span className="text-[11px] font-normal text-violet-600 leading-none">
                                  Din SPV
                                </span>
                              );
                            }
                            if (isExternalInvoice(row)) {
                              return (
                                <span
                                  className="px-2 py-0.5 rounded-full text-[10px] font-normal bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 leading-none"
                                  title="Factură externă (UE/Non-UE). Nu se transmite în RO e-Factura, se declară prin D390/D300."
                                >
                                  Extern (D390)
                                </span>
                              );
                            }
                            return (
                              <div className="flex items-center gap-1 leading-none">
                                {row.spvStatus === "eroare" ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSpvErrorInvoice(row);
                                    }}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 underline cursor-pointer"
                                    title={row.spvError ? `Eroare ANAF: ${row.spvError} (Click pentru detalii)` : "Eroare validare ANAF (Click pentru detalii)"}
                                  >
                                    <span>Eroare</span>
                                    <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                                  </button>
                                ) : (
                                  <span
                                    className={`text-[11px] font-normal ${SPV_COLORS[row.spvStatus || "nesincronizat"]}`}
                                  >
                                    {SPV_LABELS[row.spvStatus || "nesincronizat"]}
                                  </span>
                                )}
                                <SpvDeadlineBadge
                                  issueDate={row.issueDate}
                                  spvStatus={row.spvStatus}
                                  clientCountry={row.clientCountry}
                                  clientCUI={row.clientCUI}
                                  spvIndex={row.spvIndex}
                                  spvSentAt={row.spvSentAt}
                                />
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-left hidden lg:table-cell whitespace-nowrap tabular-nums">
                      <div className="h-10 flex flex-col justify-center">
                        {row.spvSentAt || (row.spvIndex && (row.updatedAt || row.createdAt)) ? (
                          (() => {
                            const sentDate = row.spvSentAt || row.updatedAt || row.createdAt;
                            const inTermen = isTransmittedInDeadline(row.issueDate, sentDate);
                            const sentObj = sentDate instanceof Date ? sentDate : sentDate ? new Date(sentDate) : null;
                            const sentTime = sentObj && !isNaN(sentObj.getTime())
                              ? sentObj.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })
                              : "";
                            return (
                              <>
                                <div className={`h-5 flex items-center text-xs font-bold whitespace-nowrap ${inTermen ? "text-emerald-600 dark:text-emerald-400" : "text-[#1d1d1f] dark:text-white"}`}>
                                  <span>{formatDate(sentDate)}</span>
                                  {sentTime && <span className="ml-1.5 font-bold">{sentTime}</span>}
                                </div>
                                <div className="h-5 flex items-center text-[11px] font-normal">
                                  {row.spvIndex ? (
                                    <span
                                      className={
                                        row.spvStatus === "validat"
                                          ? "text-emerald-600 dark:text-emerald-400"
                                          : row.spvStatus === "in_procesare"
                                          ? "text-blue-600 dark:text-blue-400"
                                          : "text-[#636366] dark:text-[#98989d]"
                                      }
                                      title={`Index încărcare SPV: ${row.spvIndex}`}
                                    >
                                      Index: {row.spvIndex}
                                    </span>
                                  ) : (
                                    <span className="text-[#636366] dark:text-[#98989d]">—</span>
                                  )}
                                </div>
                              </>
                            );
                          })()
                        ) : isExternalInvoice(row) ? (
                          <>
                            <div className="h-5 flex items-center text-[11px] text-amber-600 dark:text-amber-400 font-normal whitespace-nowrap">
                              — (Non-SPV)
                            </div>
                            <div className="h-5 flex items-center text-[11px] text-[#636366] dark:text-[#98989d] font-normal">
                              —
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="h-5 flex items-center text-xs text-[#636366] dark:text-[#98989d] whitespace-nowrap">
                              —
                            </div>
                            <div className="h-5 flex items-center text-[11px] text-[#636366] dark:text-[#98989d] font-normal">
                              —
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div
                        className="h-10 flex items-center justify-end gap-1.5"
                        onClick={e => e.stopPropagation()}
                      >
                        {row._source !== "archive" && (
                          <button
                            type="button"
                            aria-label="Storno Factură"
                            onClick={() =>
                              setStornoTarget({
                                id: row.id,
                                number:
                                  `${row.series || ""} ${row.number}`.trim(),
                              })
                            }
                            className="w-8 h-8 rounded-full border border-orange-200 dark:border-orange-800/70 bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/60 flex items-center justify-center transition-colors cursor-pointer"
                            title="Storno Factură"
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label="Descarcă PDF"
                          onClick={() => {
                            const a = document.createElement("a");
                            if (row._source === "archive") {
                              a.href = `/api/pdf/archive/${row.id}`;
                            } else {
                              a.href = `/api/pdf/emitted/${row.id}?download=1`;
                            }
                            a.download = `${row.number}.pdf`;
                            a.target = "_blank";
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                          }}
                          className="w-8 h-8 rounded-full apple-btn-glass text-[#3a3a3c] dark:text-[#ebebf5] flex items-center justify-center transition-colors cursor-pointer"
                          title="Descarcă PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {row._source !== "archive" && !isExternalInvoice(row) && (!row.spvStatus ||
                          row.spvStatus === "nesincronizat" ||
                          row.spvStatus === "eroare") && (
                          <button
                            type="button"
                            aria-label="Trimite în SPV"
                            onClick={() => sendToSpv.mutate({ id: row.id })}
                            disabled={sendToSpv.isPending}
                            className="w-8 h-8 rounded-full border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 flex items-center justify-center transition-colors cursor-pointer"
                            title="Trimite în SPV"
                          >
                            {sendToSpv.isPending ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                        {row._source !== "archive" && (
                          <button
                            type="button"
                            aria-label="Șterge"
                            onClick={() => setDeleteId(row.id)}
                            className="w-8 h-8 rounded-full border border-rose-200 dark:border-rose-800/70 bg-rose-50 dark:bg-rose-950/40 text-rose-500 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 flex items-center justify-center transition-colors cursor-pointer"
                            title="Șterge"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-[#f8f9fc]/90 dark:bg-white/[0.025] border-t-2 border-black/[0.08] dark:border-white/[0.10] tabular-nums">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-left text-xs font-bold text-[#1d1d1f] dark:text-white">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>TOTAL ({filtered.length} facturi{filtered.length !== allData.length ? " filtrate" : ""}):</span>
                      {totals.hasEur && (
                        <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-900/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                          {formatCurrency(totals.totalEur, "EUR")} (convertit la curs BNR)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-4 py-3 text-left text-xs text-[#636366] dark:text-[#98989d]">
                    —
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-black text-[#1d1d1f] dark:text-white">
                        {formatCurrency(totals.totalConvertedRon, "RON")}
                      </span>
                      {totals.hasEur && (
                        <span className="text-[10.5px] font-semibold text-[#636366] dark:text-[#98989d]" title="Defalcat: Valoare RON + Valoare EUR">
                          {formatCurrency(totals.totalRonOnly, "RON")} + {formatCurrency(totals.totalEur, "EUR")}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="hidden lg:table-cell px-4 py-3 text-left text-xs text-[#636366] dark:text-[#98989d] font-normal">
                    {counts.paid} încasate · {counts.overdue} restanțe
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-[#636366] dark:text-[#98989d]">
                    —
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Footer — Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-black/[0.06] dark:border-white/[0.08] bg-[#f8f9fc]/85 dark:bg-white/[0.02] tabular-nums">
          <div className="flex items-center gap-4 text-xs text-[#636366] dark:text-[#98989d]">
            <div className="flex items-center gap-1 whitespace-nowrap">
              Afișează
              <Select
                value={rowsPerPage.toString()}
                onValueChange={val => {
                  setRowsPerPage(Number(val));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-7 px-2.5 text-xs apple-btn-glass w-[64px] rounded-full mx-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="9999">Toți</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <span>
              Total înregistrări: <strong className="text-[#1d1d1f] dark:text-white">{filtered.length}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#636366] dark:text-[#98989d]">
            <span>
              Pagina <strong className="text-[#1d1d1f] dark:text-white">{page}</strong> din <strong className="text-[#1d1d1f] dark:text-white">{totalPages}</strong>
            </span>
            <button
              type="button"
              aria-label="Pagina anterioară"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center disabled:opacity-35 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Pagina următoare"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center disabled:opacity-35 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirm */}
      <AlertDialog
        open={deleteId !== null}
        onOpenChange={() => setDeleteId(null)}
      >
        <AlertDialogContent className="rounded-[22px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Șterge Factura?</AlertDialogTitle>
            <AlertDialogDescription>
              Acțiunea este ireversibilă. Factura și toate liniile sale vor fi
              șterse definitiv.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Anulează</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-full"
              onClick={() =>
                deleteId && deleteMutation.mutate({ id: deleteId })
              }
            >
              Șterge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Storno confirm */}
      <AlertDialog
        open={stornoTarget !== null}
        onOpenChange={() => setStornoTarget(null)}
      >
        <AlertDialogContent className="rounded-[22px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Emite factură de Storno?</AlertDialogTitle>
            <AlertDialogDescription>
              Vei emite o factură de storno (cu valori negative) pentru factura{" "}
              <strong>{stornoTarget?.number}</strong>. Factura originală nu va
              fi modificată. Ești sigur că vrei să continui?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Anulează</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-600 hover:bg-orange-700 text-white rounded-full"
              onClick={() => {
                if (stornoTarget) {
                  navigate(`/facturi-emise-nou/storno/${stornoTarget.id}`);
                  setStornoTarget(null);
                }
              }}
            >
              Da, emite Storno
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Import Facturi Externe SAGA */}
      {showSagaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-[#1c1c1e] rounded-[22px] border border-black/[0.08] dark:border-white/[0.10] shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-600 text-white">
                  SAGA
                </span>
                <h3 className="text-base font-bold text-[#1d1d1f] dark:text-white">
                  Import Facturi Externe din SAGA
                </h3>
              </div>
              <button
                type="button"
                aria-label="Închide"
                onClick={() => setShowSagaModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-800 dark:text-amber-300">
              <p className="font-semibold mb-1">Notă importantă privind facturile din România:</p>
              <p>
                Facturile din România se preiau automat prin sincronizarea SPV e-Factura. Acest modul importă <strong>exclusiv facturile externe</strong> (în valută precum EUR, USD sau către clienți externi). Facturile de România din fișier sunt omise automat.
              </p>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Selectează fișierul exportat din SAGA (.xml sau .xlsx / .xls / .csv)
              </label>
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center hover:border-emerald-500 transition-colors">
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <input
                  type="file"
                  id="saga-file-input"
                  accept=".xml,.xlsx,.xls,.csv"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files?.[0]) {
                      setSagaFile(e.target.files[0]);
                      setSagaImportResult(null);
                    }
                  }}
                />
                <label
                  htmlFor="saga-file-input"
                  className="cursor-pointer text-xs font-bold text-emerald-600 hover:text-emerald-700 underline block"
                >
                  {sagaFile ? sagaFile.name : "Alege fișierul din calculator"}
                </label>
                <p className="text-[11px] text-slate-400 mt-1">
                  Suportă SAGA XML (&lt;Facturi&gt;) sau Excel din Operații &gt; Ieșiri valută
                </p>
              </div>

              {sagaImportResult && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold ${
                    sagaImportResult.success
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                      : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                  }`}
                >
                  {sagaImportResult.message || sagaImportResult.error}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-black/[0.06] dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => setShowSagaModal(false)}
                className="px-4 py-2 rounded-full apple-btn-glass text-xs font-semibold text-[#3a3a3c] dark:text-[#ebebf5] transition-colors cursor-pointer"
              >
                Închide
              </button>
              <button
                type="button"
                onClick={handleImportSagaInvoices}
                disabled={!sagaFile || isImportingSaga}
                className="flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {isImportingSaga ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Se importă...
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    Importă Facturile Externe
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Detalii Eroare ANAF SPV */}
      {spvErrorInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#1c1c1e] rounded-[22px] border border-black/[0.08] dark:border-white/[0.10] shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1d1d1f] dark:text-white">
                    Eroare Validare ANAF (RO e-Factura)
                  </h3>
                  <p className="text-xs text-[#636366] dark:text-[#98989d] tabular-nums">
                    Factura {spvErrorInvoice.number} · {spvErrorInvoice.clientName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Închide"
                onClick={() => setSpvErrorInvoice(null)}
                className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs tabular-nums">
              {spvErrorInvoice.spvIndex && (
                <div className="flex justify-between py-1 border-b border-black/[0.06] dark:border-white/[0.08]">
                  <span className="text-slate-500 font-medium">Index Încărcare ANAF:</span>
                  <span className="tabular-nums font-bold text-slate-700 dark:text-slate-300">
                    {spvErrorInvoice.spvIndex}
                  </span>
                </div>
              )}
              {spvErrorInvoice.spvSentAt && (
                <div className="flex justify-between py-1 border-b border-black/[0.06] dark:border-white/[0.08]">
                  <span className="text-slate-500 font-medium">Data trimiterii:</span>
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {formatDate(spvErrorInvoice.spvSentAt)}
                  </span>
                </div>
              )}
            </div>

            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs space-y-1.5">
              <span className="font-bold text-rose-900 dark:text-rose-200 block">
                Mesaj returnat de serverul ANAF:
              </span>
              <p className="tabular-nums text-[11px] text-rose-800 dark:text-rose-300 bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-xl border border-rose-200/60 dark:border-rose-900/60 break-words leading-relaxed max-h-48 overflow-y-auto">
                {spvErrorInvoice.spvError || "Eroare de validare la procesarea fișierului XML de către serverul ANAF."}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-200">
              <p className="leading-relaxed">
                Generatorul XML a fost corectat conform specificației CIUS-RO ANAF. Puteți retrimite factura direct apăsând butonul de mai jos.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => setSpvErrorInvoice(null)}
                className="px-4 py-2 rounded-full apple-btn-glass text-xs font-semibold text-[#3a3a3c] dark:text-[#ebebf5] transition cursor-pointer"
              >
                Închide
              </button>
              <button
                type="button"
                onClick={() => {
                  sendToSpv.mutate({ id: spvErrorInvoice.id });
                  setSpvErrorInvoice(null);
                }}
                disabled={sendToSpv.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Retrimite în SPV</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
