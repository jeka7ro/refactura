import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  Plus,
  Loader2,
  Eye,
  Download,
  Trash2,
  Mail,
  Send,
  Calendar,
  Tag,
  Search,
  X,
} from "lucide-react";
import { DataTable, DataTableColumn } from "@/components/DataTable";
import SpvDeadlineBadge from "@/components/SpvDeadlineBadge";
import SpvDeadlineBanner from "@/components/SpvDeadlineBanner";
import { isTransmittedInDeadline } from "@/lib/spvDeadline";
import {
  formatCurrency,
  formatDate,
  reInvoiceStatusLabels,
  reInvoiceStatusColors,
  type ReInvoiceStatus,
} from "@/lib/store";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ReInvoicesSent() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReInvoiceStatus | "all">(
    "all"
  );
  const [spvFilter, setSpvFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [period, setPeriod] = useState<string>("all");
  const [customFrom, setCustomFrom] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [customTo, setCustomTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });

  const { data: dbReInvoices, isLoading } = trpc.reinvoice.list.useQuery();
  const reInvoices = dbReInvoices || [];

  const deleteReInvoice = trpc.reinvoice.delete.useMutation();
  const utils = trpc.useUtils();

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await deleteReInvoice.mutateAsync({ id: deleteId });
      await utils.reinvoice.list.invalidate();
      toast.success("Re-factură ștearsă cu succes");
    } catch (error: any) {
      toast.error("Eroare la ștergere", { description: error.message });
    } finally {
      setDeleteId(null);
    }
  };

  const handleSPV = () => {
    toast.error("Funcționalitate în lucru", {
      description:
        "Trimiterea directă din aplicație în SPV necesită generarea formatului standard UBL XML. Momentan se generează doar formatul PDF.",
    });
  };

  const getDateRange = (p: string): [string, string] | null => {
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    const startOfDay = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate());
    switch (p) {
      case "today": {
        const t = fmt(now);
        return [t, t];
      }
      case "week": {
        const d = startOfDay(now);
        const day = d.getDay() || 7;
        d.setDate(d.getDate() - day + 1);
        const end = new Date(d);
        end.setDate(end.getDate() + 6);
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
      case "year":
        return [`${now.getFullYear()}-01-01`, `${now.getFullYear()}-12-31`];
      case "lastYear":
        return [
          `${now.getFullYear() - 1}-01-01`,
          `${now.getFullYear() - 1}-12-31`,
        ];
      case "custom":
        return customFrom && customTo ? [customFrom, customTo] : null;
      default:
        return null;
    }
  };

  const filtered = useMemo(() => {
    return reInvoices.filter(ri => {
      const matchStatus = statusFilter === "all" || ri.status === statusFilter;
      if (!matchStatus) return false;

      if (spvFilter !== "all") {
        const currentSpv = ri.spvStatus || "nesincronizat";
        if (currentSpv !== spvFilter) return false;
      }

      const range = getDateRange(period);
      if (range && ri.issueDate) {
        const rowDate = ri.issueDate.substring(0, 10);
        if (rowDate < range[0] || rowDate > range[1]) return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchSearch =
          (ri.number || "").toLowerCase().includes(q) ||
          (ri.clientName || "").toLowerCase().includes(q) ||
          (ri.sourceInvoiceNumber || "").toLowerCase().includes(q);
        if (!matchSearch) return false;
      }

      return true;
    });
  }, [reInvoices, statusFilter, spvFilter, period, customFrom, customTo, search]);

  const counts = useMemo(
    () => ({
      all: reInvoices.length,
      draft: reInvoices.filter(r => r.status === "draft").length,
      pending: reInvoices.filter(r => r.status === "pending").length,
      sent: reInvoices.filter(r => r.status === "sent").length,
      paid: reInvoices.filter(r => r.status === "paid").length,
      overdue: reInvoices.filter(r => r.status === "overdue").length,
      cancelled: reInvoices.filter(r => r.status === "cancelled").length,
    }),
    [reInvoices]
  );

  const spvCounts = useMemo(
    () => ({
      all: reInvoices.length,
      validat: reInvoices.filter(r => r.spvStatus === "validat").length,
      in_procesare: reInvoices.filter(r => r.spvStatus === "in_procesare").length,
      eroare: reInvoices.filter(r => r.spvStatus === "eroare").length,
      nesincronizat: reInvoices.filter(r => !r.spvStatus || r.spvStatus === "nesincronizat").length,
    }),
    [reInvoices]
  );

  const exportToExcel = () => {
    if (!filtered.length) {
      toast.error("Nu există date de exportat.");
      return;
    }
    const header = [
      "NR. RE-FACTURĂ",
      "CLIENT",
      "FACTURĂ SURSĂ",
      "DATĂ",
      "SCADENȚĂ",
      "TOTAL",
      "MONEDĂ",
      "STATUS",
    ];
    const rows = filtered.map(r => [
      r.number,
      r.clientName || "",
      r.sourceInvoiceNumber || "",
      r.issueDate ? formatDate(r.issueDate) : "",
      r.dueDate ? formatDate(r.dueDate) : "",
      r.total,
      r.currency || "RON",
      reInvoiceStatusLabels[r.status as ReInvoiceStatus] || r.status,
    ]);
    const csvContent = [header, ...rows].map(e => e.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Re-Facturi_Export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Export Excel generat cu succes!");
  };

  const totalValue = filtered.reduce((s, r) => s + Number(r.total), 0);

  const columns: DataTableColumn<any>[] = [
    {
      key: "number",
      label: "NR. RE-FACTURĂ",
      sortable: true,
      className: "whitespace-nowrap",
      render: (value: string, row: any) => (
        <div className="flex flex-col items-start gap-1">
          <span className="text-xs font-bold text-blue-600 hover:underline text-left cursor-pointer">
            {value}
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${reInvoiceStatusColors[row.status as ReInvoiceStatus]}`}
          >
            {reInvoiceStatusLabels[row.status as ReInvoiceStatus]}
          </span>
        </div>
      ),
    },
    {
      key: "clientName",
      label: "CLIENT",
      sortable: true,
      render: (value: string) => (
        <div
          className="text-xs font-bold text-slate-900 dark:text-white max-w-[200px] truncate"
          title={value}
        >
          {value}
        </div>
      ),
    },
    {
      key: "sourceInvoiceNumber",
      label: "FACTURĂ SURSĂ",
      sortable: true,
      render: (value: string) => <span className="text-xs text-slate-600 dark:text-slate-300">{value}</span>,
    },
    {
      key: "date",
      label: "DATĂ / SCADENȚĂ",
      sortable: true,
      className: "whitespace-nowrap",
      render: (_: any, row: any) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {formatDate(row.date || row.issueDate)}
          </span>
          {row.dueDate ? (
            <span className="text-[11px] text-slate-400">
              Scad: {formatDate(row.dueDate)}
            </span>
          ) : (
            <span className="text-[11px] text-slate-400">—</span>
          )}
        </div>
      ),
    },
    {
      key: "total",
      label: "TOTAL",
      sortable: true,
      className: "whitespace-nowrap",
      render: (value: number, row: any) => (
        <span className="text-xs font-bold text-slate-900 dark:text-white">{formatCurrency(value, row.currency)}</span>
      ),
    },
    {
      key: "spvStatus",
      label: "SPV",
      sortable: true,
      className: "whitespace-nowrap",
      render: (value: string, row: any) => {
        return (
          <div className="flex flex-col items-start gap-1">
            {!value || value === "nesincronizat" ? (
              <span className="text-xs font-semibold text-slate-400">
                Nesincronizat
              </span>
            ) : value === "in_procesare" ? (
              <span className="text-xs font-semibold text-blue-500">
                Trimisă
              </span>
            ) : value === "validat" ? (
              <span className="text-xs font-semibold text-emerald-500">
                Validat
              </span>
            ) : value === "eroare" ? (
              <span className="text-xs font-semibold text-rose-500">Eroare</span>
            ) : (
              <span className="text-xs">{value}</span>
            )}
            {row.spvIndex && (
              <span
                className={`font-mono text-[11px] leading-tight ${
                  value === "validat"
                    ? "text-emerald-500 font-medium"
                    : value === "in_procesare"
                    ? "text-blue-500"
                    : "text-slate-400"
                }`}
                title={`Index încărcare SPV: ${row.spvIndex}`}
              >
                {row.spvIndex}
              </span>
            )}
            <SpvDeadlineBadge
              issueDate={row.issueDate || row.date}
              spvStatus={value}
              clientCountry={row.clientCountry}
              clientCUI={row.clientCUI}
            />
          </div>
        );
      },
    },
    {
      key: "spvSentAt",
      label: "DATA TRANSMISĂ",
      sortable: true,
      className: "whitespace-nowrap",
      render: (value: any, row: any) => {
        const sentDate =
          value || (row.spvIndex && (row.updatedAt || row.createdAt));
        if (!sentDate) return <span className="text-xs text-slate-400 whitespace-nowrap">—</span>;
        const inTermen = isTransmittedInDeadline(row.issueDate || row.date, sentDate);
        return (
          <div className={`text-xs whitespace-nowrap ${inTermen ? "text-emerald-600 dark:text-emerald-500" : "text-slate-600 dark:text-slate-300"}`}>
            <span className="font-medium">{formatDate(sentDate)}</span>
            <span className={`ml-1.5 ${inTermen ? "text-emerald-600/80 dark:text-emerald-500/80" : "text-slate-400"}`}>
              {new Date(sentDate).toLocaleTimeString("ro-RO", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-3">
      {/* Header cu Titlu + Export/Sync (Top Row) si Filtre Perioada (Bottom Row) */}
      <div className="flex flex-col gap-3 mb-4">
        {/* Top Row: Title & Action Buttons */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
              Re-Facturi Emise
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Total: <strong>{reInvoices.length}</strong> înregistrări
            </p>
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
            <Link href="/facturi-primite">
              <button className="flex items-center justify-center sm:gap-1.5 w-10 h-10 sm:w-auto sm:h-8 sm:px-3 rounded-full sm:rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-sm flex-shrink-0"><Plus className="w-5 h-5 sm:w-3.5 sm:h-3.5" /><span className="hidden sm:inline">Re-Factură nouă</span></button>
            </Link>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-1.5 sm:gap-4 pb-2">
          {[
            {
              label: "Total Re-Facturi",
              value: reInvoices.length,
              cls: "text-slate-900 dark:text-white",
            },
            {
              label: "Achitate",
              value: reInvoices.filter(r => r.status === "paid").length,
              cls: "text-emerald-600",
            },
            {
              label: "Restanțe",
              value: reInvoices.filter(r => r.status === "overdue").length,
              cls: "text-rose-600",
            },
            {
              label: "Valoare Totală",
              value: `${totalValue.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON`,
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
      </div>

      {/* Reminder Termen Legal SPV (5 zile lucrătoare) */}
      <SpvDeadlineBanner invoices={reInvoices} />

      {/* Toolbar Filtre — cu iconițe și dimensiuni identice cu AllInvoices și EmittedInvoices */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-3 flex items-center gap-3 flex-wrap bg-white dark:bg-slate-900">
          {/* Căutare */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              style={{ paddingLeft: 34, paddingRight: search ? 68 : 14 }}
              className="rounded-full w-full h-8 border border-slate-200 dark:border-slate-700 outline-none text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all shadow-none"
              placeholder="Caută re-factură, client, factură sursă..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <>
                <div className="absolute right-7 top-1/2 -translate-y-1/2 bg-blue-600 text-white rounded-full px-1.5 py-0.5 text-[9px] font-bold">
                  {filtered.length}/{reInvoices.length}
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
              onValueChange={val => setStatusFilter(val as any)}
            >
              <SelectTrigger className="h-8 w-full rounded-full text-xs font-bold border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 shadow-none flex items-center gap-1.5 px-3">
                <Tag className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate statusurile</SelectItem>
                <SelectItem value="draft">Ciornă ({counts.draft})</SelectItem>
                <SelectItem value="pending">În Așteptare ({counts.pending})</SelectItem>
                <SelectItem value="sent">Trimise ({counts.sent})</SelectItem>
                <SelectItem value="paid">Achitate ({counts.paid})</SelectItem>
                <SelectItem value="overdue">Restanțe ({counts.overdue})</SelectItem>
                <SelectItem value="cancelled">Anulate ({counts.cancelled})</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* SPV Filter */}
          <div className="w-[130px] sm:w-[150px] flex-shrink-0">
            <Select
              value={spvFilter}
              onValueChange={val => setSpvFilter(val as any)}
            >
              <SelectTrigger className="h-8 w-full rounded-full text-xs font-bold border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 shadow-none flex items-center gap-1.5 px-3">
                <Send className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                <SelectValue placeholder="Stare SPV" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate SPV</SelectItem>
                <SelectItem value="validat">Validate ({spvCounts.validat})</SelectItem>
                <SelectItem value="in_procesare">În procesare ({spvCounts.in_procesare})</SelectItem>
                <SelectItem value="eroare">Erori SPV ({spvCounts.eroare})</SelectItem>
                <SelectItem value="nesincronizat">Netrimise ({spvCounts.nesincronizat})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {period === "custom" && (
          <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 flex items-center gap-2 text-xs">
            <Calendar className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-slate-500 font-medium">De la:</span>
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-md px-2 py-0.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
            />
            <span className="text-slate-500 font-medium ml-2">Până la:</span>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-md px-2 py-0.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        rowKey="id"
        searchable={false}
        onRowClick={row => {
          window.location.href = `/re-facturi/${row.id}`;
        }}
        isLoading={isLoading}
        actions={row => (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => (window.location.href = `/re-facturi/${row.id}`)}
              className="w-6 h-6 rounded-lg border border-slate-200 bg-white text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center"
              title="Vizualizare Detaliată"
            >
              <Eye className="w-3 h-3" />
            </button>
            <a
              href={`/api/pdf/reinvoice/${row.id}?download=1`}
              download
              className="w-6 h-6 rounded-lg border border-slate-200 bg-white text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center"
              title="Descarcă PDF"
            >
              <Download className="w-3 h-3" />
            </a>
            <a
              href={`mailto:${row.clientEmail || ""}?subject=Factura ${row.number}&body=Regăsiți atașată factura ${row.number}.`}
              className="w-6 h-6 rounded-lg border border-slate-200 bg-white text-emerald-600 hover:bg-emerald-50 transition-colors flex items-center justify-center"
              title="Trimite pe Email"
            >
              <Mail className="w-3 h-3" />
            </a>
            <button
              onClick={handleSPV}
              className="w-6 h-6 rounded-lg border border-slate-200 bg-white text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center justify-center"
              title="Trimite în SPV"
            >
              <Send className="w-3 h-3" />
            </button>
            <button
              onClick={() => setDeleteId(row.id)}
              disabled={deleteReInvoice.isPending && deleteId === row.id}
              className="w-6 h-6 rounded-lg border border-slate-200 bg-white text-rose-600 hover:bg-rose-50 transition-colors flex items-center justify-center disabled:opacity-50"
              title="Șterge"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      />

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={open => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ștergere Re-Factură</AlertDialogTitle>
            <AlertDialogDescription>
              Ești sigur că vrei să ștergi această re-factură? Acțiunea este
              ireversibilă și va elimina complet documentul din sistem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction
              onClick={e => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deleteReInvoice.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Șterge definitiv
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
