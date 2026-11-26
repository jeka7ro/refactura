import React, { useState, useMemo } from "react";
import { usePersistentRowsPerPage } from "@/hooks/usePersistentRowsPerPage";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  Users,
  Search,
  RefreshCw,
  Send,
  Loader2,
  FileText,
  Copy,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function EmailLogs() {
  const utils = trpc.useUtils();
  const { data: logs = [], isLoading, refetch } = trpc.emailLogs.list.useQuery();

  // Filters & Search
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "trimis" | "eroare">("all");

  // Pagination
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = usePersistentRowsPerPage("email_logs", 15);

  // Preview modal state
  const [previewLogId, setPreviewLogId] = useState<number | null>(null);
  const { data: previewData, isLoading: isPreviewLoading } = trpc.emailLogs.getPreview.useQuery(
    { logId: previewLogId || 0 },
    { enabled: Boolean(previewLogId) }
  );

  // Resend modal state
  const [resendLog, setResendLog] = useState<any | null>(null);
  const [resendEmail, setResendEmail] = useState("");
  const [resendRepName, setResendRepName] = useState("");

  const resendMutation = trpc.emailLogs.resend.useMutation({
    onSuccess: res => {
      toast.success(`Emailul a fost retrimis cu succes către ${res.recipient}!`);
      setResendLog(null);
      utils.emailLogs.list.invalidate();
    },
    onError: err => {
      toast.error(`Eroare la retrimitere: ${err.message}`);
    },
  });

  const handleOpenResend = (log: any) => {
    setResendLog(log);
    setResendEmail(log.recipientEmail);
    setResendRepName("");
  };

  const handleConfirmResend = () => {
    if (!resendLog) return;
    if (!resendEmail || !resendEmail.includes("@")) {
      toast.error("Vă rugăm să introduceți o adresă de email validă");
      return;
    }
    resendMutation.mutate({
      logId: resendLog.id,
      recipientEmail: resendEmail.trim(),
      representativeName: resendRepName.trim() || undefined,
    });
  };

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (statusFilter !== "all" && log.status !== statusFilter) return false;
      if (!search.trim()) return true;

      const q = search.trim().toLowerCase();
      const num = (log.invoiceNumber || "").toLowerCase();
      const email = (log.recipientEmail || "").toLowerCase();
      const name = (log.recipientName || "").toLowerCase();
      const subject = (log.subject || "").toLowerCase();
      const msgId = (log.messageId || "").toLowerCase();

      return (
        num.includes(q) ||
        email.includes(q) ||
        name.includes(q) ||
        subject.includes(q) ||
        msgId.includes(q)
      );
    });
  }, [logs, search, statusFilter]);

  // Pagination calculation
  const totalCount = logs.length;
  const filteredCount = filteredLogs.length;
  const totalPages =
    rowsPerPage === 9999 ? 1 : Math.max(1, Math.ceil(filteredCount / rowsPerPage));
  const safePage = Math.min(page, totalPages);

  const paginatedLogs = useMemo(() => {
    if (rowsPerPage === 9999) return filteredLogs;
    const start = (safePage - 1) * rowsPerPage;
    return filteredLogs.slice(start, start + rowsPerPage);
  }, [filteredLogs, safePage, rowsPerPage]);

  // Statistics
  const stats = useMemo(() => {
    const total = logs.length;
    const trimise = logs.filter(l => l.status === "trimis").length;
    const erori = logs.filter(l => l.status === "eroare").length;
    const uniqueRecipients = new Set(
      logs.map(l => String(l.recipientEmail || "").toLowerCase()).filter(Boolean)
    ).size;
    return { total, trimise, erori, uniqueRecipients };
  }, [logs]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Adresă copiată în clipboard!");
  };

  const hasActiveFilters = Boolean(search) || statusFilter !== "all";

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-0.5">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
            Evidență emailuri facturi
          </h1>
          <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums">
            Jurnalul complet al transmiterii facturilor către clienți ·{" "}
            <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
              {totalCount}
            </strong>{" "}
            mesaje
            {filteredCount !== totalCount && (
              <span className="ml-1.5 text-[#1d1d1f] dark:text-white font-medium">
                ({filteredCount} afișate)
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="apple-btn-glass flex items-center justify-center gap-1.5 px-3.5 h-9 rounded-full text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Actualizează</span>
        </button>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setStatusFilter("all");
            setPage(1);
          }}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setStatusFilter("all");
              setPage(1);
            }
          }}
          className="apple-surface outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5 transition-all hover:shadow-[0_6px_20px_-6px_rgba(15,23,42,0.08)] cursor-pointer select-none"
        >
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              Total emailuri
            </span>
            <span className="w-7 h-7 rounded-[8px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
              <Mail className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />
            </span>
          </div>
          <span className="text-[22px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
            {stats.total}
          </span>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setStatusFilter(statusFilter === "trimis" ? "all" : "trimis");
            setPage(1);
          }}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setStatusFilter(statusFilter === "trimis" ? "all" : "trimis");
              setPage(1);
            }
          }}
          className="apple-surface outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5 transition-all hover:shadow-[0_6px_20px_-6px_rgba(15,23,42,0.08)] cursor-pointer select-none"
        >
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              Livrate cu succes
            </span>
            <span className="w-7 h-7 rounded-[8px] bg-[#eefbf3] dark:bg-emerald-500/18 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </span>
          </div>
          <span className="text-[22px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
            {stats.trimise}
          </span>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setStatusFilter(statusFilter === "eroare" ? "all" : "eroare");
            setPage(1);
          }}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setStatusFilter(statusFilter === "eroare" ? "all" : "eroare");
              setPage(1);
            }
          }}
          className="apple-surface outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5 transition-all hover:shadow-[0_6px_20px_-6px_rgba(15,23,42,0.08)] cursor-pointer select-none"
        >
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              Erori transmitere
            </span>
            <span className="w-7 h-7 rounded-[8px] bg-[#fef2f2] dark:bg-red-500/18 flex items-center justify-center shrink-0">
              <AlertCircle className="w-3.5 h-3.5 text-[#ff3b30] dark:text-[#ff453a]" />
            </span>
          </div>
          <span
            className={`text-[22px] sm:text-[24px] font-bold tracking-[-0.026em] leading-none tabular-nums ${
              stats.erori > 0
                ? "text-[#ff3b30] dark:text-[#ff453a]"
                : "text-[#1d1d1f] dark:text-[#f5f5f7]"
            }`}
          >
            {stats.erori}
          </span>
        </div>

        <div className="apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              Destinatari unici
            </span>
            <span className="w-7 h-7 rounded-[8px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
              <Users className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d]" />
            </span>
          </div>
          <span className="text-[22px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
            {stats.uniqueRecipients}
          </span>
        </div>
      </div>

      {/* Unified Single-Row Filter & Search Toolbar */}
      <div className="apple-surface px-3 py-2.5">
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full min-w-0">
          {/* Status Tabs */}
          <div className="apple-segmented max-w-full overflow-x-auto no-scrollbar shrink-0">
            <button
              type="button"
              data-active={statusFilter === "all"}
              onClick={() => {
                setStatusFilter("all");
                setPage(1);
              }}
              className="apple-segmented-item px-2.5 tabular-nums shrink-0"
            >
              <span>Toate</span>
              <span className="opacity-75">{totalCount}</span>
            </button>
            <button
              type="button"
              data-active={statusFilter === "trimis"}
              onClick={() => {
                setStatusFilter(statusFilter === "trimis" ? "all" : "trimis");
                setPage(1);
              }}
              className="apple-segmented-item px-2.5 tabular-nums shrink-0"
            >
              <span>Trimise</span>
              <span className="opacity-75">{stats.trimise}</span>
            </button>
            <button
              type="button"
              data-active={statusFilter === "eroare"}
              onClick={() => {
                setStatusFilter(statusFilter === "eroare" ? "all" : "eroare");
                setPage(1);
              }}
              className="apple-segmented-item px-2.5 tabular-nums shrink-0"
            >
              <span>Erori</span>
              <span className="opacity-75">{stats.erori}</span>
            </button>
          </div>

          {/* Search Bar + Reset */}
          <div className="sm:ml-auto flex items-center gap-1.5 w-full sm:w-auto sm:flex-1 justify-end min-w-0">
            <div className="relative flex-1 min-w-[150px] max-w-full sm:max-w-[320px]">
              <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                style={{ paddingLeft: 34, paddingRight: search ? 74 : 14 }}
                className="apple-pill-control rounded-full w-full h-[34px] outline-none text-[13px] text-[#1d1d1f] dark:text-white placeholder:text-[#8e8e93] focus:bg-white dark:focus:bg-[#2c2c2e] focus:border-black/15 dark:focus:border-white/20"
                placeholder="Caută factură, destinatar, email..."
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              {search && (
                <>
                  <span className="absolute right-7 top-1/2 -translate-y-1/2 bg-black/[0.07] dark:bg-white/[0.14] text-[#1d1d1f] dark:text-white rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums whitespace-nowrap">
                    {filteredCount}/{totalCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Șterge căutarea"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center hover:bg-black/[0.07] dark:hover:bg-white/[0.12] cursor-pointer"
                  >
                    <X className="w-3 h-3 text-[#6e6e73] dark:text-[#98989d]" />
                  </button>
                </>
              )}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setPage(1);
                }}
                title="Elimină toate filtrele"
                aria-label="Elimină toate filtrele"
                className="apple-pill-control w-[34px] h-[34px] shrink-0 flex items-center justify-center text-[#6e6e73] hover:text-[#1d1d1f] dark:text-[#98989d] dark:hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table Surface */}
      <div className="apple-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
              <tr>
                <th className="px-2.5 py-3 w-10 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Nr.
                </th>
                <th className="px-3 py-3 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Data & ora
                </th>
                <th className="px-3 py-3 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Factură
                </th>
                <th className="px-3 py-3 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                  Destinatar
                </th>
                <th className="px-3 py-3 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                  Subiect
                </th>
                <th className="px-3 py-3 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Status
                </th>
                <th className="px-3 py-3 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  ID mesaj / Eroare
                </th>
                <th className="px-3 py-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Acțiuni
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-[#6e6e73]" />
                      <span className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d]">
                        Se încarcă evidența emailurilor...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Mail className="w-7 h-7 text-[#8e8e93] opacity-60 mb-1" />
                      <p className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                        Nu a fost găsit niciun email
                      </p>
                      <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d]">
                        {search
                          ? "Niciun rezultat pentru filtrul aplicat."
                          : "Nu a fost trimis încă niciun email din această platformă."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log, index) => {
                  const rowNumber =
                    (safePage - 1) * (rowsPerPage === 9999 ? 0 : rowsPerPage) + index + 1;
                  const dateFormatted = log.sentAt
                    ? format(new Date(log.sentAt), "dd MMM yyyy, HH:mm", { locale: ro })
                    : "—";

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors"
                    >
                      <td className="px-2.5 py-3 text-center tabular-nums text-[12px] font-medium text-[#8e8e93]">
                        {rowNumber}
                      </td>

                      <td className="px-3 py-3 whitespace-nowrap tabular-nums text-[12.5px] font-medium text-[#1d1d1f] dark:text-[#ebebf5]">
                        {dateFormatted}
                      </td>

                      <td className="px-3 py-3 whitespace-nowrap">
                        {log.invoiceId ? (
                          <Link
                            href={`/facturi-emise-nou/view/${log.invoiceId}`}
                            className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] hover:underline tabular-nums cursor-pointer"
                          >
                            {log.invoiceNumber || `FACT-${log.invoiceId}`}
                          </Link>
                        ) : (
                          <span className="tabular-nums text-[13px] font-semibold text-[#6e6e73] dark:text-[#98989d]">
                            {log.invoiceNumber || "—"}
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-0.5">
                          {log.recipientName && (
                            <span className="text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] truncate max-w-[180px]">
                              {log.recipientName}
                            </span>
                          )}
                          <div className="flex items-center gap-1 text-[11.5px] text-[#6e6e73] dark:text-[#98989d] tabular-nums">
                            <span className="truncate max-w-[175px]">{log.recipientEmail}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(log.recipientEmail)}
                              aria-label="Copiază email"
                              className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[#8e8e93] hover:text-[#1d1d1f] hover:bg-black/[0.06] dark:hover:text-white dark:hover:bg-white/[0.10] transition-colors cursor-pointer shrink-0"
                              title="Copiază email"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </td>

                      <td
                        className="px-3 py-3 text-[12.5px] text-[#6e6e73] dark:text-[#98989d] max-w-[175px] truncate"
                        title={log.subject}
                      >
                        {log.subject}
                      </td>

                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        {log.status === "trimis" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 dark:bg-emerald-500/18 dark:text-emerald-300 dark:border-emerald-500/25 leading-none">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Trimis</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#ff3b30]/10 text-[#d70015] border border-[#ff3b30]/20 dark:bg-[#ff453a]/18 dark:text-[#ff6961] dark:border-[#ff453a]/30 leading-none">
                            <AlertCircle className="w-3 h-3" />
                            <span>Eroare</span>
                          </span>
                        )}
                      </td>

                      <td
                        className="px-3 py-3 text-[11.5px] text-[#8e8e93] tabular-nums max-w-[130px] truncate"
                        title={log.error || log.messageId || ""}
                      >
                        {log.error ? (
                          <span className="text-[#ff3b30] dark:text-[#ff453a] font-medium text-[11.5px]">
                            {log.error}
                          </span>
                        ) : (
                          <span>{log.messageId || "—"}</span>
                        )}
                      </td>

                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {log.invoiceId && (
                            <button
                              type="button"
                              onClick={() => setPreviewLogId(log.id)}
                              className="apple-btn-glass inline-flex items-center gap-1 px-2.5 h-7 rounded-full text-[11.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                              title="Previzualizează conținutul exact al emailului"
                            >
                              <Eye className="w-3 h-3 text-[#6e6e73] dark:text-[#98989d]" />
                              <span>Vezi</span>
                            </button>
                          )}
                          {log.invoiceId && (
                            <button
                              type="button"
                              onClick={() => handleOpenResend(log)}
                              className="apple-btn-glass inline-flex items-center gap-1 px-2.5 h-7 rounded-full text-[11.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                            >
                              <Send className="w-3 h-3 text-[#6e6e73] dark:text-[#98989d]" />
                              <span>Retrimite</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Paginare */}
        <div className="px-4 py-3 border-t border-black/[0.05] dark:border-white/[0.07] bg-[#fafafa] dark:bg-white/[0.02] flex items-center justify-between flex-wrap gap-2 tabular-nums">
          <div className="flex items-center gap-3 text-[12px] text-[#6e6e73] dark:text-[#98989d]">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span>Afișează</span>
              <Select
                value={String(rowsPerPage)}
                onValueChange={val => {
                  setRowsPerPage(Number(val));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-7 px-2.5 text-xs border-black/[0.08] bg-white dark:bg-[#2c2c2e] dark:border-white/[0.10] w-[68px] rounded-full tabular-nums">
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
              din{" "}
              <strong className="text-[#1d1d1f] dark:text-white font-semibold">
                {filteredCount}
              </strong>{" "}
              {filteredCount === 1 ? "înregistrare" : "înregistrări"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[12px] text-[#6e6e73] dark:text-[#98989d]">
            <span className="mr-1.5">
              Pagina{" "}
              <strong className="text-[#1d1d1f] dark:text-white font-semibold">
                {safePage}
              </strong>{" "}
              din{" "}
              <strong className="text-[#1d1d1f] dark:text-white font-semibold">
                {totalPages}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              aria-label="Pagina anterioară"
              className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white disabled:opacity-35 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              aria-label="Pagina următoare"
              className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white disabled:opacity-35 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Retrimitere Email (Fără alerte native de browser) */}
      {resendLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 dark:bg-black/65 backdrop-blur-sm animate-in fade-in overscroll-contain">
          <div className="bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] rounded-[20px] shadow-2xl w-full max-w-md p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[12px] bg-[#f2f4f7] dark:bg-[#2c2c2e] text-[#0071e3] dark:text-[#0a84ff] flex items-center justify-center shrink-0">
                <Send className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-[16px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Retrimite factura pe email
                </h3>
                <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] truncate tabular-nums">
                  {resendLog.invoiceNumber} · {resendLog.recipientName || "Client"}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block">
                Adresă email destinatar
              </label>
              <input
                type="email"
                value={resendEmail}
                onChange={e => setResendEmail(e.target.value)}
                placeholder="client@exemplu.ro"
                className="apple-input w-full h-10 px-3 text-[13.5px] outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block">
                Nume reprezentant (opțional)
              </label>
              <input
                type="text"
                value={resendRepName}
                onChange={e => setResendRepName(e.target.value)}
                placeholder="ex: Ion Popescu (lăsați gol pentru 'Bună ziua,')"
                className="apple-input w-full h-10 px-3 text-[13.5px] outline-none"
              />
              <p className="text-[11.5px] text-[#8e8e93]">
                Dacă este lăsat gol, emailul va începe direct cu „Bună ziua,” fără numele firmei.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-black/[0.06] dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => setResendLog(null)}
                disabled={resendMutation.isPending}
                className="apple-btn-glass px-4 h-9 rounded-full text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
              >
                Anulează
              </button>
              <button
                type="button"
                onClick={handleConfirmResend}
                disabled={resendMutation.isPending}
                className="apple-btn-prominent flex items-center justify-center gap-1.5 px-4 h-9 rounded-full text-white text-[12.5px] font-semibold disabled:opacity-60 cursor-pointer"
              >
                {resendMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Se retrimite...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Confirmă & retrimite</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Previzualizare Email */}
      {previewLogId && (
        <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150 overscroll-contain">
          <div className="bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] rounded-[20px] shadow-2xl max-w-3xl w-full max-h-[94vh] flex flex-col overflow-hidden">
            {/* Header Modal */}
            <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between bg-[#fafafa] dark:bg-white/[0.02]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-[10px] bg-[#f2f4f7] dark:bg-[#2c2c2e] text-[#0071e3] dark:text-[#0a84ff] flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[16px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                      Previzualizare conținut email
                    </h3>
                    {previewData && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold tabular-nums bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {previewData.invoiceNumber}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d] truncate">
                    Aspectul exact recepționat de client, incluzând logo-urile, detaliile și documentul atașat
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewLogId(null)}
                aria-label="Închide"
                className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Email Meta Bar */}
            {previewData && (
              <div className="px-5 py-2.5 bg-[#f2f2f7]/65 dark:bg-[#2c2c2e]/50 border-b border-black/[0.05] dark:border-white/[0.07] text-[12px] text-[#6e6e73] dark:text-[#98989d] space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[#8e8e93] font-medium">Către:</span>{" "}
                    <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                      {previewData.recipientName || previewData.recipientEmail}
                    </strong>{" "}
                    <span className="text-[#6e6e73] dark:text-[#98989d] tabular-nums text-[11.5px]">
                      &lt;{previewData.recipientEmail}&gt;
                    </span>
                  </div>
                  {previewData.sentAt && (
                    <div className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] font-medium tabular-nums">
                      Data:{" "}
                      {format(new Date(previewData.sentAt), "dd MMMM yyyy, HH:mm", {
                        locale: ro,
                      })}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#8e8e93] font-medium">Subiect:</span>{" "}
                  <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {previewData.subject}
                  </span>
                </div>
              </div>
            )}

            {/* Content / Preview Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 apple-doc-stage flex justify-center overscroll-contain">
              {isPreviewLoading ? (
                <div className="py-24 flex flex-col items-center justify-center gap-3 text-[#6e6e73] dark:text-[#98989d]">
                  <Loader2 className="w-7 h-7 animate-spin" />
                  <span className="text-[13px] font-medium">
                    Se generează previzualizarea emailului...
                  </span>
                </div>
              ) : previewData?.html ? (
                <iframe
                  srcDoc={previewData.html}
                  title="Previzualizare Email"
                  className="w-full max-w-[620px] h-[520px] sm:h-[600px] apple-doc-paper"
                  sandbox="allow-same-origin"
                />
              ) : (
                <div className="py-20 text-center text-[13px] text-[#6e6e73] dark:text-[#98989d]">
                  Nu s-a putut genera previzualizarea emailului.
                </div>
              )}
            </div>

            {/* Footer Modal Actions */}
            <div className="px-5 py-3.5 bg-[#fafafa] dark:bg-white/[0.02] border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                {previewData?.invoiceId && (
                  <Link href={`/facturi-emise-nou/view/${previewData.invoiceId}`}>
                    <button
                      type="button"
                      className="apple-btn-glass flex items-center gap-1.5 px-3.5 h-9 rounded-full text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d]" />
                      <span>Deschide factura #{previewData.invoiceNumber}</span>
                      <ExternalLink className="w-3 h-3 opacity-60" />
                    </button>
                  </Link>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewLogId(null)}
                  className="apple-btn-glass px-4 h-9 rounded-full text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                >
                  Închide
                </button>
                {previewData && (
                  <button
                    type="button"
                    onClick={() => {
                      const currentLog = logs.find(l => l.id === previewLogId);
                      setPreviewLogId(null);
                      if (currentLog) {
                        handleOpenResend(currentLog);
                      }
                    }}
                    className="apple-btn-prominent flex items-center justify-center gap-1.5 px-4 h-9 rounded-full text-white text-[12.5px] font-semibold cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Retrimite factura</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
