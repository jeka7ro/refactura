import React, { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  RefreshCw,
  Send,
  Loader2,
  FileText,
  Copy,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ro } from "date-fns/locale";

export default function EmailLogs() {
  const utils = trpc.useUtils();
  const { data: logs = [], isLoading, refetch } = trpc.emailLogs.list.useQuery();

  // Filters & Search
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "trimis" | "eroare">("all");

  // Pagination (SmartDevize Table Rules)
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(15);

  // Resend modal state
  const [resendLog, setResendLog] = useState<any | null>(null);
  const [resendEmail, setResendEmail] = useState("");
  const [resendRepName, setResendRepName] = useState("");

  const resendMutation = trpc.emailLogs.resend.useMutation({
    onSuccess: (res) => {
      toast.success(`Emailul a fost retrimis cu succes către ${res.recipient}!`);
      setResendLog(null);
      utils.emailLogs.list.invalidate();
    },
    onError: (err) => {
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
    return logs.filter((log) => {
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
  const totalPages = Math.ceil(filteredCount / (rowsPerPage === 9999 ? 1 : rowsPerPage)) || 1;
  const safePage = Math.min(page, totalPages);

  const paginatedLogs = useMemo(() => {
    if (rowsPerPage === 9999) return filteredLogs;
    const start = (safePage - 1) * rowsPerPage;
    return filteredLogs.slice(start, start + rowsPerPage);
  }, [filteredLogs, safePage, rowsPerPage]);

  // Statistics
  const stats = useMemo(() => {
    const total = logs.length;
    const trimise = logs.filter((l) => l.status === "trimis").length;
    const erori = logs.filter((l) => l.status === "eroare").length;
    const uniqueRecipients = new Set(logs.map((l) => l.recipientEmail.toLowerCase())).size;
    return { total, trimise, erori, uniqueRecipients };
  }, [logs]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Adresă copiată în clipboard!");
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              Evidență Emailuri Facturi
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Jurnalul complet al transmiterii facturilor către clienți via Brevo. Vizualizezi strict emailurile din spațiul tău de lucru.
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3.5 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Actualizează
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total Emailuri
              </CardTitle>
              <Mail className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-black text-slate-900 dark:text-white">{stats.total}</div>
              <p className="text-[11px] text-slate-400 mt-0.5">Tranzacții expediate</p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Livrate cu Succes
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.trimise}</div>
              <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                {stats.total > 0 ? Math.round((stats.trimise / stats.total) * 100) : 100}% rată succes
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Erori Transmitere
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-rose-500" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400">{stats.erori}</div>
              <p className="text-[11px] text-slate-400 mt-0.5">Pot fi retrimise oricând</p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Destinatari Unici
              </CardTitle>
              <Clock className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-black text-slate-900 dark:text-white">{stats.uniqueRecipients}</div>
              <p className="text-[11px] text-slate-400 mt-0.5">Adrese de clienți</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search Bar (SmartDevize Rule 1) */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* SEARCH BAR */}
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search
              className="w-4 h-4 text-slate-400 pointer-events-none"
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 1,
              }}
            />
            <input
              className="w-full h-10 pl-9 pr-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm rounded-full text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
              placeholder="Caută factură, destinatar, email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            {search && (
              <div
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "#2563eb",
                  color: "white",
                  borderRadius: 9999,
                  padding: "2px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {filteredCount} / {totalCount}
              </div>
            )}
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-full border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => {
                setStatusFilter("all");
                setPage(1);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                statusFilter === "all"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Toate ({totalCount})
            </button>
            <button
              onClick={() => {
                setStatusFilter("trimis");
                setPage(1);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                statusFilter === "trimis"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Trimise ({stats.trimise})
            </button>
            <button
              onClick={() => {
                setStatusFilter("eroare");
                setPage(1);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                statusFilter === "eroare"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Erori ({stats.erori})
            </button>
          </div>
        </div>

        {/* Table Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80 dark:bg-slate-800/50">
                <TableRow className="border-b border-slate-200 dark:border-slate-800">
                  {/* SmartDevize Rule 2: Nr. Crt. */}
                  <TableHead style={{ width: 50, textAlign: "center" }} className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Nr.
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Data & Ora
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Factură
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Destinatar
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Subiect
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider text-center">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    ID Mesaj / Eroare
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider text-right pr-6">
                    Acțiuni
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-40 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                        <span className="text-xs text-slate-500">Se încarcă evidența emailurilor...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-40 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Mail className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          Nu a fost găsit niciun email
                        </p>
                        <p className="text-xs text-slate-500">
                          {search ? "Niciun rezultat pentru filtrul aplicat." : "Nu a fost trimis încă niciun email din această platformă."}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLogs.map((log, index) => {
                    const rowNumber = (safePage - 1) * (rowsPerPage === 9999 ? 1 : rowsPerPage) + index + 1;
                    const dateFormatted = log.sentAt
                      ? format(new Date(log.sentAt), "dd MMM yyyy, HH:mm", { locale: ro })
                      : "—";

                    return (
                      <TableRow
                        key={log.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 transition-colors"
                      >
                        {/* SmartDevize Rule 2: Cell Nr. */}
                        <TableCell style={{ textAlign: "center", color: "#64748b", fontSize: 13, fontWeight: 500 }}>
                          {rowNumber}
                        </TableCell>

                        <TableCell className="whitespace-nowrap text-xs font-medium text-slate-600 dark:text-slate-300">
                          {dateFormatted}
                        </TableCell>

                        <TableCell className="whitespace-nowrap">
                          {log.invoiceId ? (
                            <Link href={`/facturi-emise-nou/${log.invoiceId}`}>
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-mono font-bold text-xs hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors cursor-pointer">
                                <FileText className="w-3.5 h-3.5" />
                                {log.invoiceNumber || `FACT-${log.invoiceId}`}
                                <ExternalLink className="w-3 h-3 opacity-60" />
                              </span>
                            </Link>
                          ) : (
                            <span className="font-mono text-xs text-slate-500 font-semibold">
                              {log.invoiceNumber || "—"}
                            </span>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col">
                            {log.recipientName && (
                              <span className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">
                                {log.recipientName}
                              </span>
                            )}
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                              <span>{log.recipientEmail}</span>
                              <button
                                onClick={() => copyToClipboard(log.recipientEmail)}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                                title="Copiază email"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="text-xs text-slate-700 dark:text-slate-300 max-w-[240px] truncate" title={log.subject}>
                          {log.subject}
                        </TableCell>

                        <TableCell className="text-center whitespace-nowrap">
                          {log.status === "trimis" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              Trimis
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                              <AlertCircle className="w-3 h-3" />
                              Eroare
                            </span>
                          )}
                        </TableCell>

                        <TableCell className="text-xs text-slate-500 font-mono max-w-[180px] truncate" title={log.error || log.messageId || ""}>
                          {log.error ? (
                            <span className="text-rose-600 dark:text-rose-400 font-sans font-medium text-[11px]">
                              {log.error}
                            </span>
                          ) : (
                            <span className="opacity-75">{log.messageId || "—"}</span>
                          )}
                        </TableCell>

                        <TableCell className="text-right whitespace-nowrap pr-6">
                          {log.invoiceId && (
                            <button
                              onClick={() => handleOpenResend(log)}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
                            >
                              <Send className="w-3 h-3 text-blue-600" />
                              Retrimite
                            </button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* SmartDevize Rule 3: Footer Paginare */}
          <div
            style={{
              padding: "12px 20px",
              borderTop: "1px solid var(--border-color, #e2e8f0)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--bg-secondary, #f8fafc)",
              borderBottomLeftRadius: 12,
              borderBottomRightRadius: 12,
            }}
            className="dark:bg-slate-900/60 dark:border-slate-800 flex-wrap gap-3"
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span className="text-xs text-slate-600 dark:text-slate-400" style={{ whiteSpace: "nowrap" }}>
                Afișează&nbsp;
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-full px-2.5 py-1 text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={9999}>Toți</option>
                </select>
                &nbsp;rânduri
              </span>
              <span className="text-xs text-slate-500">
                Total: <strong>{filteredCount}</strong> {filteredCount === 1 ? "înregistrare" : "înregistrări"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 mr-2">
                Pagina {safePage} din {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:pointer-events-none hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:pointer-events-none hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Retrimitere Email (Fără alerte native de browser) */}
      {resendLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Retrimite Factura pe Email
                </h3>
                <p className="text-xs text-slate-500">
                  {resendLog.invoiceNumber} • {resendLog.recipientName || "Client"}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Adresă Email Destinatar
              </label>
              <input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="client@exemplu.ro"
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nume Reprezentant (opțional)
              </label>
              <input
                type="text"
                value={resendRepName}
                onChange={(e) => setResendRepName(e.target.value)}
                placeholder="ex: Ion Popescu (lăsați gol pentru 'Bună ziua,')"
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-500">
                Dacă este lăsat gol, emailul va începe direct cu „Bună ziua,” fără numele firmei.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setResendLog(null)}
                disabled={resendMutation.isPending}
                className="px-4 h-9 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Anulează
              </button>
              <button
                type="button"
                onClick={handleConfirmResend}
                disabled={resendMutation.isPending}
                className="flex items-center gap-1.5 px-4 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-60"
              >
                {resendMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Se retrimite...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Confirmă & Retrimite
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
