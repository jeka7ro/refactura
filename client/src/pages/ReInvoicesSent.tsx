import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import * as XLSX from "xlsx";
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
  const [, navigate] = useLocation();
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
    const rows = filtered.map((r, idx) => ({
      "Nr. Crt.": idx + 1,
      "Nr. Re-Factură": r.number || "",
      "Client": r.clientName || "",
      "Factură Sursă": r.sourceInvoiceNumber || "",
      "Dată Emitere": r.issueDate ? formatDate(r.issueDate) : "",
      "Scadență": r.dueDate ? formatDate(r.dueDate) : "",
      "Total": Number(Number(r.total || 0).toFixed(2)),
      "Monedă": r.currency || "RON",
      "Status": reInvoiceStatusLabels[r.status as ReInvoiceStatus] || r.status,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 8 },  // Nr Crt
      { wch: 18 }, // Nr Re-Factura
      { wch: 28 }, // Client
      { wch: 18 }, // Factura Sursa
      { wch: 14 }, // Data Emitere
      { wch: 14 }, // Scadenta
      { wch: 14 }, // Total
      { wch: 10 }, // Moneda
      { wch: 16 }, // Status
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Re-Facturi");

    try {
      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Re-Facturi_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(link);
      toast.success(`Fișierul Excel (.xlsx) cu ${rows.length} înregistrări a fost descărcat cu succes!`);
    } catch (err: any) {
      toast.error("Eroare la generarea fișierului Excel: " + (err?.message || err));
    }
  };

  const totalValue = filtered.reduce((s, r) => s + Number(r.total), 0);

  const columns: DataTableColumn<any>[] = [
    {
      key: "number",
      label: "Re-Factură & Stare",
      sortable: true,
      className: "whitespace-nowrap",
      render: (value: string, row: any) => (
        <div className="flex flex-col gap-1 py-0.5 tabular-nums">
          <span className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-white hover:underline text-left cursor-pointer">
            {value}
          </span>
          <div>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-medium border leading-none ${reInvoiceStatusColors[row.status as ReInvoiceStatus]}`}
            >
              {reInvoiceStatusLabels[row.status as ReInvoiceStatus]}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "clientName",
      label: "Client",
      sortable: true,
      render: (value: string, row: any) => (
        <div className="flex flex-col gap-0.5 py-0.5">
          <div
            className="text-[13.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] max-w-[220px] truncate"
            title={value}
          >
            {value || "—"}
          </div>
          <div className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] tabular-nums">
            {row.clientCUI ? `CUI ${row.clientCUI}` : "—"}
          </div>
        </div>
      ),
    },
    {
      key: "sourceInvoiceNumber",
      label: "Factură Sursă",
      sortable: true,
      render: (value: string, row: any) => (
        <div className="flex flex-col gap-0.5 py-0.5 tabular-nums">
          <div className="text-[13px] font-medium text-[#1d1d1f] dark:text-[#ebebf5]">
            {value || "—"}
          </div>
          <div className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] truncate max-w-[180px]">
            {row.sourceSupplierName || "—"}
          </div>
        </div>
      ),
    },
    {
      key: "date",
      label: "Emitere & Scadență",
      sortable: true,
      className: "whitespace-nowrap",
      render: (_: any, row: any) => (
        <div className="flex flex-col gap-0.5 py-0.5 tabular-nums">
          <div className="text-[13px] font-medium text-[#1d1d1f] dark:text-[#ebebf5]">
            {formatDate(row.date || row.issueDate)}
          </div>
          <div className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d]">
            {row.dueDate ? `Scad. ${formatDate(row.dueDate)}` : "—"}
          </div>
        </div>
      ),
    },
    {
      key: "total",
      label: "Valoare",
      sortable: true,
      className: "whitespace-nowrap",
      render: (value: number, row: any) => (
        <div className="flex flex-col items-end gap-1 py-0.5 tabular-nums">
          <div className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-white">
            {formatCurrency(value, row.currency)}
          </div>
          <div className="flex items-center justify-end leading-none gap-1">
            {!row.spvStatus || row.spvStatus === "nesincronizat" ? (
              <span className="text-[11px] text-[#8e8e93]">Netrimisă</span>
            ) : row.spvStatus === "in_procesare" ? (
              <span className="text-[11px] font-medium text-[#0071e3]">Trimisă</span>
            ) : row.spvStatus === "validat" ? (
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                Validată SPV
              </span>
            ) : row.spvStatus === "eroare" ? (
              <span className="text-[11px] font-semibold text-[#ff3b30]">Eroare</span>
            ) : (
              <span className="text-[11px]">{row.spvStatus}</span>
            )}
            <SpvDeadlineBadge
              issueDate={row.issueDate || row.date}
              spvStatus={row.spvStatus}
              clientCountry={row.clientCountry}
              clientCUI={row.clientCUI}
              spvIndex={row.spvIndex}
              spvSentAt={row.spvSentAt}
            />
          </div>
        </div>
      ),
    },
    {
      key: "spvSentAt",
      label: "Transmitere SPV",
      sortable: true,
      className: "whitespace-nowrap",
      render: (value: any, row: any) => {
        const sentDate =
          value || (row.spvIndex && (row.updatedAt || row.createdAt));
        if (!sentDate) {
          return <span className="text-[12px] text-[#8e8e93]">—</span>;
        }
        const inTermen = isTransmittedInDeadline(row.issueDate || row.date, sentDate);
        return (
          <div className="flex flex-col gap-0.5 py-0.5 tabular-nums">
            <div
              className={`text-[12.5px] font-medium whitespace-nowrap ${
                inTermen
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-[#1d1d1f] dark:text-white"
              }`}
            >
              <span>{formatDate(sentDate)}</span>
              <span className="ml-1.5">
                {new Date(sentDate).toLocaleTimeString("ro-RO", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d]">
              {row.spvIndex ? `SPV #${row.spvIndex}` : "—"}
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-4">
      {/* Header — Apple macOS Window Title & Single Prominent CTA */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-0.5">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-tight">
            Re-Facturi
          </h1>
          <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums">
            Total:{" "}
            <strong className="text-[#1d1d1f] dark:text-white font-semibold">
              {reInvoices.length}
            </strong>{" "}
            documente
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportToExcel}
            className="apple-btn-glass flex items-center gap-1.5 px-3.5 h-9 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-semibold transition-all cursor-pointer"
            title="Exportă tabelul curent în format Microsoft Excel (.xlsx)"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export Excel</span>
          </button>
          <Link href="/facturi-primite">
            <button
              type="button"
              className="apple-btn-prominent flex items-center justify-center gap-1.5 h-9 px-4 rounded-full text-white text-[12.5px] font-semibold transition-all shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Re-Factură Nouă</span>
            </button>
          </Link>
        </div>
      </div>

      {/* KPI Cards — Clean Apple Surface Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 tabular-nums">
        {[
          {
            label: "Total re-facturi",
            value: reInvoices.length,
            cls: "text-[#1d1d1f] dark:text-white",
          },
          {
            label: "Încasate",
            value: reInvoices.filter(r => r.status === "paid").length,
            cls: "text-[#1d1d1f] dark:text-white",
          },
          {
            label: "Restanțe",
            value: reInvoices.filter(r => r.status === "overdue").length,
            cls:
              reInvoices.filter(r => r.status === "overdue").length > 0
                ? "text-[#ff3b30] dark:text-[#ff453a]"
                : "text-[#1d1d1f] dark:text-white",
          },
          {
            label: "Valoare totală",
            value: `${totalValue.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON`,
            cls: "text-[#1d1d1f] dark:text-white",
          },
        ].map(k => (
          <div
            key={k.label}
            className="apple-surface px-4 sm:px-5 py-3.5 sm:py-4 flex flex-col justify-between gap-2"
          >
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              {k.label}
            </span>
            <span className={`text-[22px] sm:text-[24px] font-bold tracking-[-0.026em] leading-none truncate ${k.cls}`}>
              {k.value}
            </span>
          </div>
        ))}
      </div>

      {/* Reminder Termen Legal SPV (5 zile lucrătoare) */}
      <SpvDeadlineBanner invoices={reInvoices} />

      {/* Unified Apple Control & Filter Card */}
      <div className="apple-surface p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2.5 flex-wrap">
          <div className="apple-segmented overflow-x-auto no-scrollbar max-w-full">
            {[
              { id: "all", label: "Toate" },
              { id: "today", label: "Azi" },
              { id: "week", label: "Săpt. asta" },
              { id: "month", label: "Luna asta" },
              { id: "lastMonth", label: "Luna trec." },
              { id: "year", label: "An" },
              { id: "custom", label: "Interval" },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                data-active={period === item.id}
                onClick={() => {
                  setPeriod(item.id);
                  const range = getDateRange(item.id);
                  if (range && item.id !== "custom") {
                    setCustomFrom(range[0]);
                    setCustomTo(range[1]);
                  }
                }}
                className="apple-segmented-item"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2 shrink-0">
            {/* Status Select */}
            <Select
              value={statusFilter}
              onValueChange={val => setStatusFilter(val as any)}
            >
              <SelectTrigger
                data-filtered={statusFilter !== "all"}
                className="apple-pill-control h-[34px] w-auto shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3"
              >
                <Tag className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d] shrink-0" />
                <SelectValue placeholder="Toate statusurile" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate statusurile</SelectItem>
                <SelectItem value="draft">Ciornă ({counts.draft})</SelectItem>
                <SelectItem value="pending">În Așteptare ({counts.pending})</SelectItem>
                <SelectItem value="sent">Trimise ({counts.sent})</SelectItem>
                <SelectItem value="paid">Încasate ({counts.paid})</SelectItem>
                <SelectItem value="overdue">Restanțe ({counts.overdue})</SelectItem>
                <SelectItem value="cancelled">Anulate ({counts.cancelled})</SelectItem>
              </SelectContent>
            </Select>

            {/* SPV Filter */}
            <Select
              value={spvFilter}
              onValueChange={val => setSpvFilter(val as any)}
            >
              <SelectTrigger
                data-filtered={spvFilter !== "all"}
                className="apple-pill-control h-[34px] w-auto shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3"
              >
                <Send className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d] shrink-0" />
                <SelectValue placeholder="Toate SPV" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate SPV</SelectItem>
                <SelectItem value="validat">Validate ({spvCounts.validat})</SelectItem>
                <SelectItem value="in_procesare">În procesare ({spvCounts.in_procesare})</SelectItem>
                <SelectItem value="eroare">Erori SPV ({spvCounts.eroare})</SelectItem>
                <SelectItem value="nesincronizat">Netrimise ({spvCounts.nesincronizat})</SelectItem>
              </SelectContent>
            </Select>

            {/* Căutare */}
            <div className="relative w-[210px] xl:w-[250px] shrink-0">
              <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                style={{ paddingLeft: 34, paddingRight: search ? 72 : 14 }}
                className="apple-pill-control rounded-full w-full h-[34px] outline-none text-[13px] text-[#1d1d1f] dark:text-white placeholder:text-[#8e8e93] focus:bg-white dark:focus:bg-[#2c2c2e]"
                placeholder="Caută re-factură, client..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <>
                  <span className="absolute right-7 top-1/2 -translate-y-1/2 bg-black/[0.07] dark:bg-white/[0.14] text-[#1d1d1f] dark:text-white rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                    {filtered.length}/{reInvoices.length}
                  </span>
                  <button
                    type="button"
                    aria-label="Șterge căutarea"
                    onClick={() => setSearch("")}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center hover:bg-black/[0.07] dark:hover:bg-white/[0.12] cursor-pointer"
                  >
                    <X className="w-3 h-3 text-[#6e6e73] dark:text-[#98989d]" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {period === "custom" && (
          <div className="inline-flex items-center gap-1.5 px-2.5 h-[34px] rounded-full bg-[#f2f2f7] dark:bg-[#2c2c2e] text-xs tabular-nums">
            <Calendar className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d]" />
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="h-6 px-1 text-xs bg-transparent text-[#1d1d1f] dark:text-white outline-none w-[110px]"
            />
            <span className="text-[#8e8e93]">–</span>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="h-6 px-1 text-xs bg-transparent text-[#1d1d1f] dark:text-white outline-none w-[110px]"
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
          navigate(`/re-facturi/${row.id}`);
        }}
        isLoading={isLoading}
        actions={row => (
          <div
            className="flex items-center justify-end gap-1.5"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => navigate(`/re-facturi/${row.id}`)}
              className="w-8 h-8 rounded-full apple-btn-glass text-[#3a3a3c] dark:text-[#ebebf5] flex items-center justify-center cursor-pointer"
              title="Vizualizare Detaliată"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <a
              href={`/api/pdf/reinvoice/${row.id}?download=1`}
              download
              className="w-8 h-8 rounded-full apple-btn-glass text-[#3a3a3c] dark:text-[#ebebf5] flex items-center justify-center cursor-pointer"
              title="Descarcă PDF"
            >
              <Download className="w-3.5 h-3.5" />
            </a>
            <a
              href={`mailto:${row.clientEmail || ""}?subject=Factura ${row.number}&body=Regăsiți atașată factura ${row.number}.`}
              className="w-8 h-8 rounded-full apple-btn-glass text-[#3a3a3c] dark:text-[#ebebf5] flex items-center justify-center cursor-pointer"
              title="Trimite pe Email"
            >
              <Mail className="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              onClick={handleSPV}
              className="w-8 h-8 rounded-full apple-btn-glass text-[#3a3a3c] dark:text-[#ebebf5] flex items-center justify-center cursor-pointer"
              title="Trimite în SPV"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDeleteId(row.id)}
              disabled={deleteReInvoice.isPending && deleteId === row.id}
              className="w-8 h-8 rounded-full apple-btn-glass text-[#6e6e73] hover:text-[#ff3b30] dark:text-[#98989d] dark:hover:text-[#ff453a] flex items-center justify-center disabled:opacity-50 cursor-pointer"
              title="Șterge"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      />

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={open => !open && setDeleteId(null)}
      >
        <AlertDialogContent className="rounded-[22px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Ștergere Re-Factură</AlertDialogTitle>
            <AlertDialogDescription>
              Ești sigur că vrei să ștergi această re-factură? Acțiunea este
              ireversibilă și va elimina complet documentul din sistem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Anulează</AlertDialogCancel>
            <AlertDialogAction
              onClick={e => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-full"
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
