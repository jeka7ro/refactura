// EmittedInvoices.tsx — Lista Facturilor Emise Direct din Platformă
import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus,
  Eye,
  Download,
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
  paid: "Achitată",
  overdue: "Restanță",
  cancelled: "Anulată",
};
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  overdue: "bg-rose-50 text-rose-700 border-rose-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
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
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(15);

  const { data = [], isLoading, refetch } = trpc.emittedInvoice.list.useQuery();
  const { data: archiveRaw = [], refetch: refetchArchive } = trpc.invoiceArchive.list.useQuery({});

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

  const totalValue = useMemo(
    () => filtered.reduce((s, r) => s + parseFloat(String(r.total || 0)), 0),
    [filtered]
  );

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
    <div className="p-4 md:p-6 space-y-6">
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
        <Link href="/facturi-emise-nou/new">
          <button className="flex items-center justify-center sm:gap-1.5 w-10 h-10 sm:w-auto sm:h-9 sm:px-4 rounded-full sm:rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors shadow-sm flex-shrink-0">
            <Plus className="w-5 h-5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Emite Factură Nouă</span>
          </button>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-4 pb-2">
        {[
          {
            label: "Total Facturi",
            value: data.length,
            cls: "text-slate-900 dark:text-white",
          },
          { label: "Achitate", value: counts.paid, cls: "text-emerald-600" },
          { label: "Restanțe", value: counts.overdue, cls: "text-rose-600" },
          {
            label: "Valoare Totală",
            value: formatCurrency(totalValue, "RON"),
            cls: "text-blue-600",
          },
        ].map(k => (
          <div
            key={k.label}
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2 sm:p-4 flex flex-col justify-center h-14 sm:h-20 shadow-sm transition-all hover:shadow-md cursor-pointer"
          >
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5 sm:mb-1 truncate">
              {k.label}
            </p>
            <p className={`text-base sm:text-2xl font-black leading-none truncate ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Reminder Termen Legal SPV (5 zile lucrătoare) */}
      <SpvDeadlineBanner invoices={data} />

      {/* Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        {/* Search & Filtre — cu iconițe și dimensiuni ca în AllInvoices */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 flex-wrap bg-white dark:bg-slate-900">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              style={{ paddingLeft: 34, paddingRight: search ? 68 : 14 }}
              className="rounded-full w-full h-8 border border-slate-200 dark:border-slate-700 outline-none text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all shadow-none"
              placeholder="Caută factură, client, CUI..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            {search && (
              <>
                <div className="absolute right-7 top-1/2 -translate-y-1/2 bg-blue-600 text-white rounded-full px-1.5 py-0.5 text-[9px] font-bold">
                  {filtered.length}/{allData.length}
                </div>
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2"
                >
                  <X className="w-3 h-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" />
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
                <SelectItem value="paid">Achitate ({counts.paid})</SelectItem>
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
              className="h-7 px-2 text-xs bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-slate-500 font-medium">Până la:</span>
            <input
              type="date"
              value={customTo}
              onChange={e => {
                setCustomTo(e.target.value);
                setPage(1);
              }}
              className="h-7 px-2 text-xs bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <th className="text-center w-12 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                  Nr.
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                  Număr Factură
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Client
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 hidden md:table-cell whitespace-nowrap">
                  Dată / Scadență
                </th>
                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                  Total
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 hidden lg:table-cell whitespace-nowrap">
                  Data Transmisă / Index
                </th>
                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                  Acțiuni
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
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
                    <td className="text-center px-4 py-2.5 text-slate-400 text-xs whitespace-nowrap">
                      <div className="h-10 flex items-center justify-center font-medium">
                        {(page - 1) * rowsPerPage + idx + 1}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div className="h-10 flex flex-col justify-center">
                        <div className="h-5 flex items-center gap-1.5">
                          <span className="text-xs font-bold text-blue-600 hover:underline text-left">
                            {row.number}
                          </span>
                          {row._source === "archive" && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-200 leading-none">SPV</span>
                          )}
                        </div>
                        <div className="h-5 flex items-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-normal border leading-none ${STATUS_COLORS[row.status || "draft"]}`}
                          >
                            {STATUS_LABELS[row.status || "draft"]}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="h-10 flex flex-col justify-center">
                        <div className="h-5 flex items-center">
                          <div
                            className="text-xs font-bold text-slate-900 dark:text-white max-w-[200px] truncate"
                            title={row.clientName}
                          >
                            {row.clientName}
                          </div>
                        </div>
                        <div className="h-5 flex items-center text-[11px] text-slate-400 font-normal">
                          {row.clientCUI ? `CUI: ${row.clientCUI}` : "—"}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell whitespace-nowrap">
                      <div className="h-10 flex flex-col justify-center">
                        <div className="h-5 flex items-center">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {formatDate(row.issueDate)}
                          </span>
                        </div>
                        <div className="h-5 flex items-center text-[11px] text-slate-400 font-normal">
                          {row.dueDate ? `Scad: ${formatDate(row.dueDate)}` : "—"}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <div className="h-10 flex flex-col justify-center items-end">
                        <div className="h-5 flex items-center justify-end">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {formatCurrency(
                              parseFloat(String(row.total)),
                              (row.currency || "RON") as any
                            )}
                          </span>
                        </div>
                        <div className="h-5 flex items-center justify-end">
                          {row._source === "archive" ? (
                            <span className="text-[11px] font-normal text-violet-600 leading-none">
                              Din SPV
                            </span>
                          ) : isExternalInvoice(row) ? (
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-normal bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 leading-none"
                              title="Factură externă (UE/Non-UE). Nu se transmite în RO e-Factura, se declară prin D390/D300."
                            >
                              Extern (D390)
                            </span>
                          ) : (
                            <div className="flex items-center gap-1 leading-none">
                              <span
                                className={`text-[11px] font-normal ${SPV_COLORS[row.spvStatus || "nesincronizat"]}`}
                              >
                                {SPV_LABELS[row.spvStatus || "nesincronizat"]}
                              </span>
                              <SpvDeadlineBadge
                                issueDate={row.issueDate}
                                spvStatus={row.spvStatus}
                                clientCountry={row.clientCountry}
                                clientCUI={row.clientCUI}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-left hidden lg:table-cell whitespace-nowrap">
                      <div className="h-10 flex flex-col justify-center">
                        {row.spvSentAt || (row.spvIndex && (row.updatedAt || row.createdAt)) ? (
                          (() => {
                            const sentDate = row.spvSentAt || row.updatedAt || row.createdAt;
                            const inTermen = isTransmittedInDeadline(row.issueDate, sentDate);
                            return (
                              <>
                                <div className={`h-5 flex items-center text-xs font-bold whitespace-nowrap ${inTermen ? "text-emerald-600 dark:text-emerald-500" : "text-slate-900 dark:text-white"}`}>
                                  <span>{formatDate(sentDate)}</span>
                                  <span className="ml-1.5 font-bold">
                                    {new Date(sentDate).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </div>
                                <div className="h-5 flex items-center text-[11px] font-normal">
                                  {row.spvIndex ? (
                                    <span
                                      className={
                                        row.spvStatus === "validat"
                                          ? "text-emerald-500"
                                          : row.spvStatus === "in_procesare"
                                          ? "text-blue-500"
                                          : "text-slate-400"
                                      }
                                      title={`Index încărcare SPV: ${row.spvIndex}`}
                                    >
                                      Index: {row.spvIndex}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
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
                            <div className="h-5 flex items-center text-[11px] text-slate-400 font-normal">
                              —
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="h-5 flex items-center text-xs text-slate-400 whitespace-nowrap">
                              —
                            </div>
                            <div className="h-5 flex items-center text-[11px] text-slate-400 font-normal">
                              —
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div
                        className="h-10 flex items-center justify-end gap-1"
                        onClick={e => e.stopPropagation()}
                      >
                        {row._source !== "archive" && (
                          <button
                            onClick={() =>
                              setStornoTarget({
                                id: row.id,
                                number:
                                  `${row.series || ""} ${row.number}`.trim(),
                              })
                            }
                            className="w-7 h-7 rounded-lg border border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100 flex items-center justify-center transition-colors"
                            title="Storno Factură"
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
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
                          className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"
                          title="Descarcă PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {row._source !== "archive" && !isExternalInvoice(row) && (!row.spvStatus ||
                          row.spvStatus === "nesincronizat" ||
                          row.spvStatus === "eroare") && (
                          <button
                            onClick={() => sendToSpv.mutate({ id: row.id })}
                            disabled={sendToSpv.isPending}
                            className="w-7 h-7 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition-colors"
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
                            onClick={() => setDeleteId(row.id)}
                            className="w-7 h-7 rounded-lg border border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center transition-colors"
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
          </table>
        </div>

        {/* Footer — Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
          <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-1 whitespace-nowrap">
              Afișează
              <Select
                value={rowsPerPage.toString()}
                onValueChange={val => {
                  setRowsPerPage(Number(val));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-6 px-2 text-xs border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 w-[60px] rounded-lg focus:ring-1 focus:ring-blue-500 mx-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="9999">Toți</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <span>
              Total înregistrări: <strong>{filtered.length}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span>
              Pagina {page} din {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Șterge Factura?</AlertDialogTitle>
            <AlertDialogDescription>
              Acțiunea este ireversibilă. Factura și toate liniile sale vor fi
              șterse definitiv.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white"
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Emite factură de Storno?</AlertDialogTitle>
            <AlertDialogDescription>
              Vei emite o factură de storno (cu valori negative) pentru factura{" "}
              <strong>{stornoTarget?.number}</strong>. Factura originală nu va
              fi modificată. Ești sigur că vrei să continui?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-600 hover:bg-orange-700 text-white"
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
    </div>
  );
}
