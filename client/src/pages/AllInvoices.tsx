// AllInvoices — pagina unificată (import XML e-Factura mutat în pagina Integrări)
// UI Rules: Nr. Crt., search+counter, footer paginare, rounded-lg butoane

import { useState, useMemo, useEffect } from "react";
import { usePersistentRowsPerPage } from "@/hooks/usePersistentRowsPerPage";
import JSZip from "jszip";
import { Link, useLocation } from "wouter";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Loader2,
  Send,
  FileDown,
  X,
  Eye,
  Pencil,
  Trash2,
  Calendar,
  Download,
  CheckCircle,
  ClipboardList,
  ClipboardCheck,
  MoreVertical,
  Coins,
  Globe,
  Clock,
  Mail,
  MailOpen,
} from "lucide-react";
import { formatCurrency, formatDate, type Currency } from "@/lib/store";
import { trpc } from "@/lib/trpc";
import { normalizeText, cleanErrorMessage } from "@/lib/utils";
import { useTableSort } from "@/hooks/useTableSort";
import { toast } from "sonner";
import SpvDeadlineBadge from "@/components/SpvDeadlineBadge";
import { LiveAutoSyncControl } from "@/components/LiveAutoSyncControl";
import ExternalInvoiceImportModal from "@/components/ExternalInvoiceImportModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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

type InvoiceType = "primit" | "emis";
type InvoiceTypeFilter = "all" | "primit" | "emis";
type NirFilterType = "all" | "cu_nir" | "fara_nir";
type ReadFilterType = "all" | "unread" | "read";

interface UnifiedRow {
  id: number;
  type: InvoiceType;
  number: string;
  partnerName: string;
  partnerCui?: string;
  clientCountry?: string;
  date: string;
  dueDate: string;
  total: number;
  currency: string;
  status: string;
  fileUrl?: string | null;
  source: string;
  itemsText?: string;
  spvStatus?: string | null;
  spvIndex?: string | null;
  spvSentAt?: string | Date | null;
  nirId?: number | null;
  nirNumber?: string | null;
  nirStatus?: string | null;
  isRead?: boolean;
}

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  spv_anaf: { label: "SPV", cls: "text-blue-900 dark:text-blue-400" },
  oblio: { label: "Oblio", cls: "text-orange-600 dark:text-orange-400" },
  smartbill: { label: "SmartBill", cls: "text-cyan-600 dark:text-cyan-400" },
  manual: { label: "Manual", cls: "text-slate-500 dark:text-slate-400" },
  refactura: { label: "Re-fact", cls: "text-blue-600 dark:text-blue-400" },
  pdf_manual: { label: "Extern", cls: "text-violet-600 dark:text-violet-400" },
  xml_manual: { label: "Extern XML", cls: "text-violet-600 dark:text-violet-400" },
  efactura: { label: "Extern", cls: "text-violet-600 dark:text-violet-400" },
  other: { label: "Extern", cls: "text-violet-600 dark:text-violet-400" },
};

const TYPE_BADGE: Record<InvoiceType, { label: string; cls: string }> = {
  primit: { label: "Primit", cls: "text-amber-600 dark:text-amber-400" },
  emis: { label: "Emis", cls: "text-emerald-600 dark:text-emerald-400" },
};
const STATUS_CLS: Record<string, string> = {
  pending: "text-amber-600 dark:text-amber-500",
  processed: "text-emerald-600 dark:text-emerald-400",
  paid: "text-emerald-600 dark:text-emerald-400",
  draft: "text-slate-500 dark:text-slate-400",
  sent: "text-amber-600 dark:text-amber-500",
  archived: "text-slate-400 dark:text-slate-500",
  overdue: "text-rose-600 dark:text-rose-500",
  storno: "text-rose-600 dark:text-rose-500",
};
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  sent: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
  processed: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
  pending: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
  overdue: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800",
  storno: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800",
  archived: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
};
const STATUS_LBL: Record<string, string> = {
  pending: "Neîncasat",
  processed: "Încasat",
  paid: "Încasat",
  draft: "Ciornă",
  sent: "Neîncasat",
  archived: "Arhivat",
  overdue: "Restanță",
  storno: "Storno",
};
// Pentru facturi PRIMITE: pending = Neachitat (tu trebuie să plătești)
const STATUS_LBL_PRIMIT: Record<string, string> = {
  pending: "Neachitat",
  processed: "Achitat",
  paid: "Achitat",
  draft: "Ciornă",
  sent: "Neachitat",
  archived: "Arhivat",
  overdue: "Restanță",
  storno: "Storno",
};
const getStatusLabel = (status: string, type: string) =>
  type === "primit"
    ? STATUS_LBL_PRIMIT[status] || status
    : STATUS_LBL[status] || status;

export default function AllInvoices() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState(() => sessionStorage.getItem("allInvoices_search") || "");

  // Helper: forțează download în loc de preview în browser
  const downloadFile = async (url: string, filename: string) => {
    const safeFilename = filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`;
    try {
      toast.loading("Descărcare în curs...", { id: "download" });
      const token = localStorage.getItem("authToken");
      const response = await fetch(url, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      if (!response.ok) throw new Error("Network response was not ok");
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = safeFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      toast.success("Descărcat cu succes!", { id: "download" });
    } catch (error) {
      console.error("Eroare la descarcare:", error);
      // Fallback
      const a = document.createElement("a");
      a.href = url;
      a.download = safeFilename;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.dismiss("download");
    }
  };
  const [page, setPage] = useState(() => parseInt(sessionStorage.getItem("allInvoices_page") || "1", 10));
  const [rowsPerPage, setRowsPerPage] = usePersistentRowsPerPage("all_invoices", 15);
  const [typeFilter, setTypeFilter] = useState<InvoiceTypeFilter>(() => (sessionStorage.getItem("allInvoices_type") as any) || "all");
  const [nirFilter, setNirFilter] = useState<NirFilterType>(() => (sessionStorage.getItem("allInvoices_nir") as any) || "all");
  const [readFilter, setReadFilter] = useState<ReadFilterType>(() => (sessionStorage.getItem("allInvoices_read") as any) || "all");
  const [filterStatus, setFilterStatus] = useState<string>(() => sessionStorage.getItem("allInvoices_status") || "all");
  const [sourceFilter, setSourceFilter] = useState<string>(() => sessionStorage.getItem("allInvoices_source") || "all");

  useEffect(() => {
    sessionStorage.setItem("allInvoices_search", search);
    sessionStorage.setItem("allInvoices_page", page.toString());
    sessionStorage.setItem("allInvoices_type", typeFilter);
    sessionStorage.setItem("allInvoices_nir", nirFilter);
    sessionStorage.setItem("allInvoices_read", readFilter);
    sessionStorage.setItem("allInvoices_status", filterStatus);
    sessionStorage.setItem("allInvoices_source", sourceFilter);
  }, [search, page, typeFilter, nirFilter, readFilter, filterStatus, sourceFilter]);

  // Șterge memoria filtrelor la refresh-ul complet al paginii (F5)
  useEffect(() => {
    const clearOnRefresh = () => {
      sessionStorage.removeItem("allInvoices_search");
      sessionStorage.removeItem("allInvoices_page");
      sessionStorage.removeItem("allInvoices_type");
      sessionStorage.removeItem("allInvoices_nir");
      sessionStorage.removeItem("allInvoices_read");
      sessionStorage.removeItem("allInvoices_status");
      sessionStorage.removeItem("allInvoices_source");
    };
    window.addEventListener("beforeunload", clearOnRefresh);
    return () => window.removeEventListener("beforeunload", clearOnRefresh);
  }, []);
  const [deleteTarget, setDeleteTarget] = useState<UnifiedRow | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showExternalImportModal, setShowExternalImportModal] = useState(false);
  const { data: bnrRatesData } = trpc.system.getBnrRates.useQuery(undefined, {
    staleTime: 10 * 60 * 1000,
  });

  const handleCardFilterClick = (type: InvoiceType, status: string) => {
    if (typeFilter === type && filterStatus === status) {
      setTypeFilter("all");
      setFilterStatus("all");
    } else {
      setTypeFilter(type);
      setFilterStatus(status);
      setPage(1);
    }
  };

  const handleDownloadSelectedZip = async () => {
    const selectedRows = allRows.filter((r) =>
      selectedIds.has(`${r.source}-${r.id}`)
    );
    if (selectedRows.length === 0) {
      toast.error("Nu ai selectat nicio factură!");
      return;
    }

    toast.loading("Pregătesc arhiva ZIP...", { id: "zip" });
    try {
      const zip = new JSZip();
      let added = 0;

      for (const row of selectedRows) {
        if (row.fileUrl) {
          try {
            const token = localStorage.getItem("authToken");
            const response = await fetch(row.fileUrl, {
              headers: {
                Authorization: token ? `Bearer ${token}` : "",
              },
            });
            
            const contentType = response.headers.get("content-type");
            if (!response.ok || (contentType && contentType.includes("text/html"))) {
              console.error("Eroare la fetch sau PDF lipsă (fallback HTML) pentru", row.fileUrl, response.statusText);
              continue;
            }
            
            const blob = await response.blob();
            const safeNumber = row.number.replace(/[^a-z0-9]/gi, "_");
            const filename = `Factura_${row.type.toUpperCase()}_${safeNumber}.pdf`;
            zip.file(filename, blob);
            added++;
          } catch (e) {
            console.error("Eroare de rețea la fetch pentru", row.fileUrl, e);
          }
        }
      }

      if (added === 0) {
        toast.error("Nicio factură selectată nu are PDF disponibil pe server.", {
          id: "zip",
        });
        return;
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Facturi_Selectate_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Arhiva conține ${added} facturi descărcate.`, {
        id: "zip",
      });
      setSelectedIds(new Set());
    } catch (e: any) {
      toast.error("Eroare la crearea arhivei.", { id: "zip" });
    }
  };
  const [period, setPeriod] = useState<string>("all");
  const [customFrom, setCustomFrom] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [customTo, setCustomTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });

  // Period date range helper
  const getDateRange = (p: string): [string, string] | null => {
    const now = new Date();
    const fmt = (d: Date) => {
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      const da = String(d.getDate()).padStart(2, "0");
      return `${yr}-${mo}-${da}`;
    };
    const startOfDay = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate());
    switch (p) {
      case "today": {
        const t = fmt(now);
        return [t, t];
      }
      case "yesterday": {
        const y = startOfDay(now);
        y.setDate(y.getDate() - 1);
        const ys = fmt(y);
        return [ys, ys];
      }
      case "week": {
        const d = startOfDay(now);
        const day = d.getDay() || 7;
        d.setDate(d.getDate() - day + 1);
        const end = new Date(d);
        end.setDate(end.getDate() + 6);
        return [fmt(d), fmt(end)];
      }
      case "lastWeek": {
        const d = startOfDay(now);
        const day = d.getDay() || 7;
        d.setDate(d.getDate() - day - 6);
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

  const toggleSelect = (row: UnifiedRow) => {
    const rowKey = `${row.source}-${row.id}`;
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(rowKey) ? next.delete(rowKey) : next.add(rowKey);
      return next;
    });
  };

  const toggleSelectAll = (pageRows: UnifiedRow[]) => {
    const pageKeys = pageRows.map(r => `${r.source}-${r.id}`);
    const allSelected = pageKeys.every(k => selectedIds.has(k));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        pageKeys.forEach(k => next.delete(k));
      } else {
        pageKeys.forEach(k => next.add(k));
      }
      return next;
    });
  };

  const getSelectedPrimitRows = () =>
    allRows.filter(
      r => r.type === "primit" && selectedIds.has(`${r.source}-${r.id}`)
    );

  const {
    data: archiveData,
    isLoading: l1,
    refetch: r1,
  } = trpc.invoiceArchive.list.useQuery({ limit: 5000 });
  const {
    data: reInvoices = [],
    isLoading: l2,
    refetch: r2,
  } = trpc.reinvoice.list.useQuery();
  const {
    data: emittedInvoices = [],
    isLoading: l3,
    refetch: r3,
  } = trpc.emittedInvoice.list.useQuery();
  const { data: nirList = [], refetch: rNir } = trpc.nir.list.useQuery();
  const { data: clientsList = [] } = trpc.clients.list.useQuery();

  const getClientId = (r: any) => {
    if (r.clientId) return r.clientId;
    if (!clientsList || !Array.isArray(clientsList)) return null;
    const clean = (s?: string) => (s || "").replace(/^[A-Z]{2}/i, "").trim().toLowerCase();
    const cCui = clean(r.partnerCui);
    const cName = (r.partnerName || "").trim().toLowerCase();
    if (cCui) {
      const match = (clientsList as any[]).find((c: any) => clean(c.cui) === cCui);
      if (match) return match.id;
    }
    if (cName && cName !== "—") {
      const match = (clientsList as any[]).find((c: any) => (c.name || "").trim().toLowerCase() === cName);
      if (match) return match.id;
    }
    return null;
  };

  const { data: currentTenantObj } = trpc.tenants.current.useQuery();
  const { data: tenantsData = [] } = trpc.tenants.list.useQuery();
  const tenant = currentTenantObj || (tenantsData as any[])[0]?.tenants || (tenantsData as any[])[0];
  const tenantSettings = useMemo(() => {
    try {
      return JSON.parse(tenant?.settings || "{}");
    } catch {
      return {};
    }
  }, [tenant]);

  const syncOblio = trpc.integrations.syncOblio.useMutation({
    onSuccess: () => {
      r1();
      r2();
      r3();
    },
  });
  const syncSpvManual = trpc.integrations.syncSpvManual.useMutation({
    onSuccess: () => {
      r1();
      r2();
      r3();
    },
  });
  const { data: dbIntegrations = [] } = trpc.integrations.list.useQuery();

  const deleteArchive = trpc.invoiceArchive.delete.useMutation({
    onSuccess: () => r1(),
  });
  const deleteReinvoice = trpc.reinvoice.delete.useMutation({
    onSuccess: () => r2(),
  });
  const deleteEmitted = trpc.emittedInvoice.delete.useMutation({
    onSuccess: () => r3(),
  });

  const markEmittedPaid = trpc.emittedInvoice.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Factură marcată ca Încasată!");
      r3();
    },
    onError: e => toast.error("Eroare: " + e.message),
  });
  const markArchivePaid = trpc.invoiceArchive.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Factură marcată ca Achitată!");
      r1();
    },
    onError: e => toast.error("Eroare: " + e.message),
  });
  const markAsRead = trpc.invoiceArchive.markAsRead.useMutation({
    onSuccess: () => r1(),
  });
  const markAsUnread = trpc.invoiceArchive.markAsUnread.useMutation({
    onSuccess: () => r1(),
  });

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    toast.loading("Ștergere în curs...", { id: "delete" });
    try {
      if (deleteTarget.source === "refactura") {
        await deleteReinvoice.mutateAsync({ id: deleteTarget.id });
      } else if (
        deleteTarget.type === "emis" &&
        deleteTarget.source === "manual"
      ) {
        await deleteEmitted.mutateAsync({ id: deleteTarget.id });
      } else {
        await deleteArchive.mutateAsync({ id: deleteTarget.id });
      }
      toast.success("Factură ștearsă cu succes!", { id: "delete" });
    } catch (e: any) {
      toast.error("Eroare la ștergere", {
        id: "delete",
        description: e?.message,
      });
    }
    setDeleteTarget(null);
  };

  const isLoading = l1 || l2 || l3;

  const archiveItems = useMemo(() => {
    const raw = archiveData as unknown as { items: any[]; metadata: any };
    if (raw?.items) return raw.items;
    return [];
  }, [archiveData]);

  const allRows: UnifiedRow[] = useMemo(() => {
    const normDateStr = (v: unknown): string =>
      v instanceof Date ? v.toISOString() : v ? String(v) : "";
    const normInvNum = (s?: string | null) =>
      String(s || "")
        .replace(/[^A-Za-z0-9]/g, "")
        .toUpperCase()
        .replace(/^0+/, "");
    const normPartnerKey = (cui?: string | null, name?: string | null) => {
      const c = String(cui || "")
        .replace(/^RO/i, "")
        .replace(/[^A-Za-z0-9]/g, "")
        .toUpperCase();
      if (c && c !== "0000000000000") return `CUI:${c}`;
      const n = String(name || "")
        .replace(/[^A-Za-z0-9]/g, "")
        .toUpperCase();
      return n ? `NAME:${n}` : "";
    };

    const rows: UnifiedRow[] = [];
    const emittedIndexByNumber = new Map<string, string>();
    const platformOutSpvIndexes = new Set<string>();
    const platformOutDocPartnerKeys = new Set<string>();

    (Array.isArray(emittedInvoices) ? emittedInvoices : []).forEach((i: any) => {
      if (i.number && i.spvIndex) {
        emittedIndexByNumber.set(String(i.number).trim().toLowerCase(), String(i.spvIndex));
      }
      if (i.spvIndex) platformOutSpvIndexes.add(String(i.spvIndex).trim());
      const dk = `${normInvNum(i.number)}|${normPartnerKey(i.clientCUI || i.clientCui, i.clientName)}`;
      if (dk !== "|") platformOutDocPartnerKeys.add(dk);
    });
    (Array.isArray(reInvoices) ? reInvoices : []).forEach((i: any) => {
      if (i.spvIndex) platformOutSpvIndexes.add(String(i.spvIndex).trim());
      const dk = `${normInvNum(i.number)}|${normPartnerKey(i.clientCUI || i.clientCui, i.clientName)}`;
      if (dk !== "|") platformOutDocPartnerKeys.add(dk);
    });

    const nirByArchiveId = new Map<number, any>();
    const nirByInvoiceNumber = new Map<string, any>();
    (Array.isArray(nirList) ? nirList : []).forEach((n: any) => {
      if (n.invoiceArchiveId) {
        nirByArchiveId.set(Number(n.invoiceArchiveId), n);
      }
      if (n.invoiceNumber) {
        const clean = String(n.invoiceNumber).trim().toLowerCase();
        if (clean && !nirByInvoiceNumber.has(clean)) {
          nirByInvoiceNumber.set(clean, n);
        }
      }
    });

    archiveItems.forEach((i: any) => {
      const t = parseFloat(i.total || "0");
      const isPrimit = i.direction === "in";
      const spvIdx =
        i.spvIndex ||
        (i.fileName ? i.fileName.match(/SPV_(\d+)/i)?.[1] : null) ||
        (i.notes ? i.notes.match(/index\s*(?:incarcare|spv)?[:\s]+(\d+)/i)?.[1] : null) ||
        (i.invoiceNumber ? emittedIndexByNumber.get(String(i.invoiceNumber).trim().toLowerCase()) : null) ||
        null;

      if (!isPrimit) {
        const outPartnerName = i.customerName || i.supplierName || "";
        const outPartnerCui = i.customerCUI || i.customerCui || i.supplierCUI || i.supplierCui || "";
        const dk = `${normInvNum(i.invoiceNumber)}|${normPartnerKey(outPartnerCui, outPartnerName)}`;
        const isDuplicateOfPlatformOut =
          (spvIdx && platformOutSpvIndexes.has(String(spvIdx).trim())) ||
          (dk !== "|" && platformOutDocPartnerKeys.has(dk));
        if (isDuplicateOfPlatformOut) {
          return;
        }
      }

      const cleanInvNum = String(i.invoiceNumber || "").trim().toLowerCase();
      const matchedNir =
        nirByArchiveId.get(Number(i.id)) ||
        (cleanInvNum ? nirByInvoiceNumber.get(cleanInvNum) : null);
      const nirId = matchedNir?.id || i.nirId || null;
      const nirNumber = matchedNir?.nirNumber || i.nirNumber || null;
      const nirStatus = matchedNir ? "full" : (i.nirStatus || "none");

      rows.push({
        id: i.id,
        type: isPrimit ? "primit" : "emis",
        number: i.invoiceNumber || `#${i.id}`,
        partnerName: isPrimit ? (i.supplierName || "—") : (i.customerName || i.supplierName || "—"),
        date: normDateStr(i.issueDate || i.createdAt),
        dueDate: normDateStr(i.dueDate),
        total: t,
        currency: i.currency || "RON",
        status: t < 0 ? "storno" : i.status || "pending",
        fileUrl: `/api/pdf/archive/${i.id}`,
        source: i.source || "spv_anaf",
        itemsText: i.itemsText || "",
        partnerCui: isPrimit
          ? (i.supplierCUI || i.supplierCui || "")
          : (i.customerCUI || i.customerCui || i.supplierCUI || i.supplierCui || ""),
        spvStatus: i.spvStatus,
        spvIndex: spvIdx,
        spvSentAt: i.spvSentAt || null,
        nirId,
        nirNumber,
        nirStatus,
        isRead: Boolean(i.isRead),
      });
    });
    (Array.isArray(reInvoices) ? reInvoices : []).forEach((i: any) => {
      const t = parseFloat(i.total || "0");
      rows.push({
        id: i.id,
        type: "emis",
        number: i.number || `RF-${i.id}`,
        partnerName: i.clientName || "—",
        date: normDateStr(i.issueDate || i.createdAt),
        dueDate: normDateStr(i.dueDate),
        total: t,
        currency: i.currency || "RON",
        status: t < 0 ? "storno" : i.status || "draft",
        fileUrl: i.pdfUrl && i.pdfUrl !== "spv_import" ? i.pdfUrl : `/api/pdf/reinvoice/${i.id}`,
        source: "refactura",
        itemsText: i.itemsText || "",
        partnerCui: i.clientCUI || i.clientCui || "",
        spvStatus: i.spvStatus,
        spvIndex: i.spvIndex || null,
        spvSentAt: i.spvSentAt || null,
        isRead: true,
      });
    });
    (Array.isArray(emittedInvoices) ? emittedInvoices : []).forEach(
      (i: any) => {
        const t = parseFloat(i.total || "0");
        rows.push({
          id: i.id,
          type: "emis",
          number: i.number || `FACT-${i.id}`,
          partnerName: i.clientName || "—",
          date: normDateStr(i.issueDate || i.createdAt),
          dueDate: normDateStr(i.dueDate),
          total: t,
          currency: i.currency || "RON",
          status:
            t < 0
              ? "storno"
              : i.status === "sent"
                ? "sent"
                : i.status || "draft",
          fileUrl: i.pdfUrl && i.pdfUrl !== "spv_import" ? i.pdfUrl : `/api/pdf/emitted/${i.id}`,
          source: "manual",
          itemsText: i.itemsText || "",
          spvStatus: i.spvStatus,
          spvIndex: i.spvIndex || null,
          spvSentAt: i.spvSentAt || null,
          partnerCui: i.clientCUI || i.clientCui || "",
          clientCountry: i.clientCountry || "",
          isRead: true,
        });
      }
    );
    return rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [archiveItems, reInvoices, emittedInvoices, nirList]);

  const nirCounts = useMemo(() => {
    let cuNir = 0;
    let faraNir = 0;
    allRows.forEach(r => {
      if (r.nirNumber || r.nirId) {
        cuNir++;
      } else if (r.type === "primit") {
        faraNir++;
      }
    });
    return { cuNir, faraNir };
  }, [allRows]);

  const readCounts = useMemo(() => {
    let unread = 0;
    let read = 0;
    allRows.forEach(r => {
      if (r.type === "primit") {
        if (!r.isRead) unread++;
        else read++;
      } else {
        read++;
      }
    });
    return { unread, read };
  }, [allRows]);

  const filtered = useMemo(() => {
    let rows =
      typeFilter === "all"
        ? allRows
        : allRows.filter(r => r.type === typeFilter);

    // Filtru NIR dedicat (Toate / Cu NIR / Fără NIR)
    if (nirFilter === "cu_nir") {
      rows = rows.filter(r => !!r.nirNumber || !!r.nirId);
    } else if (nirFilter === "fara_nir") {
      rows = rows.filter(
        r => (typeFilter === "emis" ? true : r.type === "primit") && !r.nirNumber && !r.nirId
      );
    }

    // Filtru Citite / Necitite
    if (readFilter === "unread") {
      rows = rows.filter(r => r.type === "primit" && !r.isRead);
    } else if (readFilter === "read") {
      rows = rows.filter(r => r.type !== "primit" || !!r.isRead);
    }

    if (filterStatus !== "all") {
      if (filterStatus === "paid" || filterStatus === "processed") {
        rows = rows.filter(
          r => r.status === "paid" || r.status === "processed"
        );
      } else if (filterStatus === "pending") {
        rows = rows.filter(
          r => r.status !== "paid" && r.status !== "processed"
        );
      }
    }
    // Period filter
    const range = getDateRange(period);
    if (range) {
      const [from, to] = range;
      rows = rows.filter(r => {
        const d = (r.date || "").slice(0, 10);
        return d >= from && d <= to;
      });
    }
    if (sourceFilter !== "all") {
      if (sourceFilter === "external") {
        rows = rows.filter(r =>
          ["pdf_manual", "xml_manual", "efactura", "other"].includes(r.source)
        );
      } else {
        rows = rows.filter(r => r.source === sourceFilter);
      }
    }
    if (search.trim()) {
      const q = normalizeText(search.trim());
      rows = rows.filter(
        r =>
          normalizeText(r.number).includes(q) ||
          normalizeText(r.partnerName).includes(q) ||
          (r.nirNumber && normalizeText(r.nirNumber).includes(q)) ||
          (r.partnerCui && normalizeText(r.partnerCui).includes(q)) ||
          normalizeText(STATUS_LBL[r.status] || r.status).includes(q) ||
          r.total.toString().includes(q) ||
          normalizeText(SOURCE_BADGE[r.source]?.label || r.source).includes(
            q
          ) ||
          normalizeText(r.source).includes(q) ||
          (r.itemsText && normalizeText(r.itemsText).includes(q)) ||
          (r.spvIndex && r.spvIndex.includes(q))
      );
    }
    return rows;
  }, [
    allRows,
    search,
    typeFilter,
    nirFilter,
    readFilter,
    filterStatus,
    sourceFilter,
    period,
    customFrom,
    customTo,
  ]);

  const { sortedData, handleSort, getSortIcon } = useTableSort(
    filtered,
    "all_invoices"
  );

  const totalPages = Math.max(1, Math.ceil(sortedData.length / rowsPerPage));
  const paginated = sortedData.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );
  const counts = {
    all: allRows.length,
    primit: allRows.filter(r => r.type === "primit").length,
    emis: allRows.filter(r => r.type === "emis").length,
  };

  const quickCounts = useMemo(() => {
    let spv = 0;
    let manual = 0;
    let external = 0;
    let other = 0;
    let unpaid = 0;
    for (const r of allRows) {
      if (r.source === "spv_anaf") spv++;
      else if (r.source === "manual") manual++;
      else if (["pdf_manual", "xml_manual", "efactura", "other"].includes(r.source)) external++;
      else other++;
      if (r.status !== "paid" && r.status !== "processed" && r.status !== "storno") {
        unpaid++;
      }
    }
    return { spv, manual, external, other, unpaid };
  }, [allRows]);

  const filteredTotals = useMemo(() => {
    const sums: Record<string, number> = {};
    let totalRonEquivalent = 0;
    const fxMap: Record<string, number> = {
      RON: 1,
      LEI: 1,
      EUR: bnrRatesData?.rates?.EUR || 4.977,
      USD: bnrRatesData?.rates?.USD || 4.58,
      GBP: bnrRatesData?.rates?.GBP || 5.85,
      CHF: bnrRatesData?.rates?.CHF || 5.32,
    };
    for (const r of filtered) {
      const c = (r.currency || "RON").toUpperCase();
      const val = Number(r.total) || 0;
      sums[c] = (sums[c] || 0) + val;
      totalRonEquivalent += val * (fxMap[c] || 1);
    }
    const entries = Object.entries(sums).sort((a, b) => {
      if (a[0] === "RON") return -1;
      if (b[0] === "RON") return 1;
      return b[1] - a[1];
    });
    const hasForeignCurrency = entries.some(([curr]) => curr !== "RON" && curr !== "LEI");
    return {
      sums,
      entries,
      totalRonEquivalent,
      hasForeignCurrency,
      isFiltered: filtered.length !== allRows.length,
    };
  }, [filtered, allRows.length, bnrRatesData]);

  const handleDownloadReInvoicePDF = async (row: UnifiedRow) => {
    await downloadFile(`/api/pdf/reinvoice/${row.id}?download=1`, `${row.number}.pdf`);
  };

  const confirmBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    toast.loading(`Se șterg ${selectedIds.size} facturi selectate...`, { id: "bulk-del" });
    let ok = 0;
    let failed = 0;
    let lastReason = "";
    const remaining = new Set<string>();

    for (const key of Array.from(selectedIds)) {
      const [source, idStr] = key.split("-");
      const id = Number(idStr);
      try {
        if (source === "refactura") await deleteReinvoice.mutateAsync({ id });
        else if (source === "manual") await deleteEmitted.mutateAsync({ id });
        else await deleteArchive.mutateAsync({ id });
        ok++;
      } catch (err) {
        failed++;
        remaining.add(key);
        lastReason = cleanErrorMessage(err, "Eroare la ștergere.");
      }
    }

    setSelectedIds(remaining);
    setBulkDeleteOpen(false);
    setIsBulkDeleting(false);
    r1();
    r2();
    r3();

    if (failed === 0) {
      toast.success(`${ok} facturi șterse cu succes.`, { id: "bulk-del" });
    } else if (ok > 0) {
      toast.warning(`${ok} facturi șterse, ${failed} nu au putut fi șterse.`, {
        id: "bulk-del",
        description: lastReason,
      });
    } else {
      toast.error(`Ștergerea a eșuat pentru ${failed} facturi.`, {
        id: "bulk-del",
        description: lastReason,
      });
    }
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    typeFilter !== "all" ||
    nirFilter !== "all" ||
    readFilter !== "all" ||
    filterStatus !== "all" ||
    sourceFilter !== "all" ||
    period !== "all";

  const resetAllFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setNirFilter("all");
    setReadFilter("all");
    setFilterStatus("all");
    setSourceFilter("all");
    setPeriod("all");
    setPage(1);
  };

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-4">
      {/* Header — Apple macOS Window Title & Live Telemetry */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-0.5">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-[22px] sm:text-[26px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-tight">
                Facturi
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live</span>
              </span>
            </div>
            <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums">
              Evidență unificată ·{" "}
              <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
                {allRows.length}
              </strong>{" "}
              documente
              {filtered.length !== allRows.length && (
                <span className="ml-1.5 text-[#1d1d1f] dark:text-white font-medium">
                  ({filtered.length} afișate)
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowExternalImportModal(true)}
            className="apple-btn-prominent flex items-center justify-center gap-1.5 h-9 px-4 rounded-full text-white text-[12.5px] font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Factură externă</span>
          </button>
          <LiveAutoSyncControl
            onRefresh={async () => {
              await Promise.all([r1(), r2(), r3()]);
            }}
            isRefreshing={isLoading || syncOblio.isPending || syncSpvManual.isPending}
            storageKey="invoices_auto_sync"
          />
        </div>
      </div>

      {/* KPI Cards — Clean Rectangular 16px Apple Cards (Click Filters Type: Toate / Emise / Primite) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Toate Facturile */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setTypeFilter("all");
            setPage(1);
          }}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setTypeFilter("all");
              setPage(1);
            }
          }}
          className="apple-surface outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5 transition-all hover:shadow-[0_6px_20px_-6px_rgba(15,23,42,0.08)] cursor-pointer select-none"
        >
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              Toate facturile
            </span>
            <span className="w-7 h-7 rounded-[8px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
              <ClipboardList className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />
            </span>
          </div>
          <div className="flex items-baseline gap-2 tabular-nums">
            <span className="text-[24px] sm:text-[26px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.028em] leading-none">
              {allRows.length}
            </span>
            {readCounts.unread > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#0071e3]/10 text-[#0071e3] dark:bg-[#0a84ff]/18 dark:text-[#64d2ff]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0071e3] dark:bg-[#64d2ff]" />
                {readCounts.unread} noi
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Facturi Emise */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setTypeFilter(typeFilter === "emis" ? "all" : "emis");
            setPage(1);
          }}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setTypeFilter(typeFilter === "emis" ? "all" : "emis");
              setPage(1);
            }
          }}
          className="apple-surface outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5 transition-all hover:shadow-[0_6px_20px_-6px_rgba(15,23,42,0.08)] cursor-pointer select-none"
        >
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              Facturi emise
            </span>
            <span className="w-7 h-7 rounded-[8px] bg-[#eefbf3] dark:bg-emerald-500/18 flex items-center justify-center shrink-0">
              <Send className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </span>
          </div>
          <div className="flex items-baseline gap-2 tabular-nums">
            <span className="text-[24px] sm:text-[26px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.028em] leading-none">
              {counts.emis}
            </span>
            {filtered.length !== allRows.length && (
              <span className="text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                ({filtered.filter(r => r.type === "emis").length} filtrate)
              </span>
            )}
          </div>
        </div>

        {/* Card 3: Facturi Primite */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setTypeFilter(typeFilter === "primit" ? "all" : "primit");
            setPage(1);
          }}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setTypeFilter(typeFilter === "primit" ? "all" : "primit");
              setPage(1);
            }
          }}
          className="apple-surface outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5 transition-all hover:shadow-[0_6px_20px_-6px_rgba(15,23,42,0.08)] cursor-pointer select-none"
        >
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              Facturi primite
            </span>
            <span className="w-7 h-7 rounded-[8px] bg-[#fff6eb] dark:bg-amber-500/18 flex items-center justify-center shrink-0">
              <Download className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </span>
          </div>
          <div className="flex items-baseline gap-2 tabular-nums">
            <span className="text-[24px] sm:text-[26px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.028em] leading-none">
              {counts.primit}
            </span>
            {nirCounts.faraNir > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:bg-amber-500/18 dark:text-amber-300">
                {nirCounts.faraNir} fără NIR
              </span>
            )}
          </div>
        </div>

        {/* Card 4: Valoare Afișată */}
        <div className="apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
                Valoare totală
              </span>
              {filteredTotals.isFiltered && (
                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#3a3a3c] dark:text-[#ebebf5] leading-none">
                  Filtrate
                </span>
              )}
            </div>
            <span className="w-7 h-7 rounded-[8px] bg-[#eefbf3] dark:bg-emerald-500/18 flex items-center justify-center shrink-0">
              <Coins className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </span>
          </div>
          <div className="tabular-nums min-w-0">
            {filteredTotals.entries.length === 0 ? (
              <span className="text-[22px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.028em] leading-none">
                0,00 RON
              </span>
            ) : (
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-[20px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none truncate">
                  {formatCurrency(
                    filteredTotals.entries[0][1],
                    (filteredTotals.entries[0][0] as Currency) || "RON"
                  )}
                </span>
                {filteredTotals.entries.slice(1).map(([curr, val]) => (
                  <span
                    key={curr}
                    className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] leading-none"
                  >
                    + {formatCurrency(val, (curr as Currency) || "EUR")}
                  </span>
                ))}
                {filteredTotals.hasForeignCurrency && (
                  <span className="w-full text-[11px] font-medium text-emerald-700 dark:text-emerald-400 mt-0.5">
                    ≈ {formatCurrency(filteredTotals.totalRonEquivalent, "RON")} echiv. BNR
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Single-Row Unified Toolbar (Zero Overflow, Zero Duplicate Filters, Tenant Active Tab Color) */}
      <div className="apple-surface px-3 py-2.5">
        <div className="flex flex-wrap xl:flex-nowrap items-center gap-1.5 2xl:gap-2 w-full min-w-0">
          {/* 1. Period Segmented Track */}
          <div
            className="apple-segmented flex-wrap sm:flex-nowrap !rounded-2xl sm:!rounded-full max-w-full shrink-0"
            role="tablist"
            aria-label="Perioadă"
          >
            {[
              { id: "all", label: "Toate" },
              { id: "today", label: "Azi" },
              { id: "month", label: "Lună" },
              { id: "lastMonth", label: "Luna trec." },
              { id: "year", label: "An" },
              { id: "custom", label: "Interval" },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={period === item.id}
                data-active={period === item.id}
                onClick={() => {
                  setPeriod(item.id);
                  const range = getDateRange(item.id);
                  if (range && item.id !== "custom") {
                    setCustomFrom(range[0]);
                    setCustomTo(range[1]);
                  }
                  setPage(1);
                }}
                className="apple-segmented-item px-2 2xl:px-2.5 shrink-0"
              >
                {item.label}
              </button>
            ))}
          </div>

          {period === "custom" && (
            <div className="inline-flex items-center gap-1 px-2.5 h-[34px] rounded-full bg-[#f2f2f7] dark:bg-[#2c2c2e] text-xs tabular-nums shrink-0 max-w-full overflow-x-auto no-scrollbar">
              <Calendar className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d] shrink-0" />
              <input
                type="date"
                value={customFrom}
                onChange={e => {
                  setCustomFrom(e.target.value);
                  setPage(1);
                }}
                className="h-6 px-1 text-xs tabular-nums bg-transparent text-[#1d1d1f] dark:text-[#f5f5f7] outline-none w-[104px]"
              />
              <span className="text-[#8e8e93]">–</span>
              <input
                type="date"
                value={customTo}
                onChange={e => {
                  setCustomTo(e.target.value);
                  setPage(1);
                }}
                className="h-6 px-1 text-xs tabular-nums bg-transparent text-[#1d1d1f] dark:text-[#f5f5f7] outline-none w-[104px]"
              />
            </div>
          )}

          {/* 2. Workflow Filter Chips (Necitite / Fără NIR / Cu NIR) */}
          <div className="apple-segmented max-w-full overflow-x-auto no-scrollbar shrink-0">
            <button
              type="button"
              data-active={readFilter === "unread"}
              onClick={() => {
                setReadFilter(readFilter === "unread" ? "all" : "unread");
                setPage(1);
              }}
              className="apple-segmented-item px-2 2xl:px-2.5 tabular-nums shrink-0"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  readFilter === "unread"
                    ? "bg-white"
                    : "bg-[#0071e3] dark:bg-[#0a84ff]"
                }`}
              />
              <span>Necitite</span>
              <span className="opacity-75">{readCounts.unread}</span>
            </button>

            <button
              type="button"
              data-active={nirFilter === "fara_nir"}
              onClick={() => {
                setNirFilter(nirFilter === "fara_nir" ? "all" : "fara_nir");
                setPage(1);
              }}
              className="apple-segmented-item px-2 2xl:px-2.5 tabular-nums shrink-0"
            >
              <span>Fără NIR</span>
              <span className="opacity-75">{nirCounts.faraNir}</span>
            </button>

            <button
              type="button"
              data-active={nirFilter === "cu_nir"}
              onClick={() => {
                setNirFilter(nirFilter === "cu_nir" ? "all" : "cu_nir");
                setPage(1);
              }}
              className="apple-segmented-item px-2 2xl:px-2.5 tabular-nums shrink-0"
            >
              <span>Cu NIR</span>
              <span className="opacity-75">{nirCounts.cuNir}</span>
            </button>
          </div>

          {/* 3. Right Side Controls: Auto-Width Source Filter + Fluid Search + Reset + Sync */}
          <div className="xl:ml-auto flex flex-wrap sm:flex-nowrap items-center gap-1.5 2xl:gap-2 w-full xl:w-auto xl:flex-1 justify-end min-w-0">
            <Select
              value={sourceFilter}
              onValueChange={val => {
                setSourceFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger
                data-filtered={sourceFilter !== "all"}
                className="apple-pill-control h-[34px] w-auto shrink-0 whitespace-nowrap flex items-center gap-1.5 px-2.5 2xl:px-3"
              >
                <Globe className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d] shrink-0" />
                <SelectValue placeholder="Toate sursele" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate sursele</SelectItem>
                <SelectItem value="spv_anaf">SPV ANAF ({quickCounts.spv})</SelectItem>
                <SelectItem value="external">Externe / Non-SPV ({quickCounts.external})</SelectItem>
                <SelectItem value="manual">Emise intern ({quickCounts.manual})</SelectItem>
                <SelectItem value="oblio">Oblio</SelectItem>
                <SelectItem value="smartbill">SmartBill</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative flex-1 min-w-[115px] max-w-full sm:max-w-[230px]">
              <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                style={{ paddingLeft: 34, paddingRight: search ? 70 : 14 }}
                className="apple-pill-control rounded-full w-full h-[34px] outline-none text-[13px] text-[#1d1d1f] dark:text-white placeholder:text-[#8e8e93] focus:bg-white dark:focus:bg-[#2c2c2e] focus:border-black/15 dark:focus:border-white/20"
                placeholder="Caută factură, partener..."
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              {search && (
                <>
                  <span className="absolute right-7 top-1/2 -translate-y-1/2 bg-black/[0.07] dark:bg-white/[0.14] text-[#1d1d1f] dark:text-white rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                    {filtered.length}/{allRows.length}
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
                onClick={resetAllFilters}
                title="Elimină toate filtrele"
                aria-label="Elimină toate filtrele"
                className="apple-pill-control w-[34px] h-[34px] shrink-0 flex items-center justify-center text-[#6e6e73] hover:text-[#1d1d1f] dark:text-[#98989d] dark:hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={async () => {
                const hasOblio = (dbIntegrations as any[]).some(
                  i => i.provider === "oblio" && i.status === "active"
                );
                const hasSpv = (dbIntegrations as any[]).some(
                  i => i.provider === "spv" && i.status === "active"
                );
                let syncedAny = false;

                if (hasOblio || hasSpv) {
                  toast.loading("Sincronizare date în curs...", { id: "sync" });
                  let spvResult: any = null;
                  let oblioErr: string | null = null;
                  let spvErr: string | null = null;
                  const tasks: Promise<unknown>[] = [];
                  if (hasOblio) {
                    tasks.push(
                      syncOblio.mutateAsync().catch((err: unknown) => {
                        oblioErr = cleanErrorMessage(
                          err,
                          "Eroare la sincronizarea Oblio."
                        );
                      })
                    );
                  }
                  if (hasSpv) {
                    tasks.push(
                      syncSpvManual
                        .mutateAsync()
                        .then(r => {
                          spvResult = r;
                        })
                        .catch((err: unknown) => {
                          spvErr = cleanErrorMessage(
                            err,
                            "Eroare la sincronizarea SPV."
                          );
                        })
                    );
                  }
                  await Promise.all(tasks);
                  syncedAny = true;

                  r1();
                  r2();
                  r3();

                  if (oblioErr && spvErr) {
                    toast.error(
                      `Sincronizarea a eșuat: ${spvErr} · ${oblioErr}`,
                      { id: "sync" }
                    );
                  } else if (spvErr) {
                    toast.error(`Eroare sincronizare SPV: ${spvErr}`, {
                      id: "sync",
                    });
                  } else if (oblioErr) {
                    toast.warning(
                      `SPV sincronizat, dar Oblio a raportat o eroare: ${oblioErr}`,
                      { id: "sync" }
                    );
                  } else if (spvResult?.limitHit > 0) {
                    const facturiNoi =
                      spvResult.imported === 1
                        ? "1 factură nouă importată"
                        : `${spvResult.imported} facturi noi importate`;
                    const facturiLimita =
                      spvResult.limitHit === 1
                        ? "1 factură"
                        : `${spvResult.limitHit} facturi`;
                    toast.warning(
                      `Sync complet: ${facturiNoi}.\n${facturiLimita} nu ${
                        spvResult.limitHit === 1 ? "a putut" : "au putut"
                      } fi descărcată azi — ANAF permite maxim 10 descărcări/zi per fișier. Va fi importată automat mâine.`,
                      { id: "sync", duration: 8000 }
                    );
                  } else if (spvResult?.imported > 0) {
                    const facturiNoi =
                      spvResult.imported === 1
                        ? "1 factură nouă importată"
                        : `${spvResult.imported} facturi noi importate`;
                    toast.success(`Sync complet: ${facturiNoi} din SPV!`, {
                      id: "sync",
                    });
                  } else {
                    toast.success(
                      "Sincronizare completă! Nicio factură nouă de importat.",
                      { id: "sync" }
                    );
                  }
                }

                if (!syncedAny) {
                  toast.error("Nicio integrare activă de sincronizat.", {
                    action: {
                      label: "Configurează Integrări",
                      onClick: () => navigate("/integrari"),
                    },
                  });
                }
              }}
              disabled={syncOblio.isPending || syncSpvManual.isPending}
              className="apple-btn-prominent flex items-center justify-center gap-1.5 px-4 h-[34px] rounded-full text-white text-[12.5px] font-semibold transition-all disabled:opacity-60 shrink-0 cursor-pointer"
              title="Sincronizează din sursele configurate (Oblio / SPV)"
            >
              {syncOblio.isPending || syncSpvManual.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>Sync</span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Apple Frosted Glass Multi-Selection Bar */}
      {selectedIds.size > 0 && (
        <div className="apple-glass rounded-full px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 text-[13px] font-semibold text-[#1d1d1f] dark:text-white tabular-nums">
            <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] text-[12px] font-bold">
              {selectedIds.size}
            </span>
            <span>
              {selectedIds.size === 1
                ? "factură selectată"
                : "facturi selectate"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="apple-pill-control px-3.5 h-8 text-[12px] font-semibold cursor-pointer"
            >
              Anulează
            </button>
            <button
              type="button"
              onClick={handleDownloadSelectedZip}
              className="apple-btn-prominent px-4 h-8 rounded-full text-white text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descarcă PDF / ZIP</span>
            </button>
            <button
              type="button"
              onClick={() => setBulkDeleteOpen(true)}
              className="apple-btn-destructive-soft px-3.5 h-8 text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Șterge</span>
            </button>
          </div>
        </div>
      )}

      {/* Table Surface — Clean Apple macOS Finder / Mail Table */}
      <div className="apple-surface overflow-hidden">
        {/* DESKTOP TABLE */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
              <tr>
                <th className="px-4 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-primary cursor-pointer"
                    checked={
                      paginated.length > 0 &&
                      paginated.every(r => selectedIds.has(`${r.source}-${r.id}`))
                    }
                    onChange={() => toggleSelectAll(paginated)}
                    title="Selectează/Deselectează toate de pe această pagină"
                  />
                </th>
                <th className="px-3 py-3 w-12 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Nr.
                </th>
                <th
                  className="px-4 py-3 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white whitespace-nowrap select-none transition-colors"
                  onClick={() => handleSort("number")}
                >
                  <div className="flex items-center gap-1">
                    <span>Factură & Stare</span>
                    <span className="text-[#1d1d1f] dark:text-white opacity-60">
                      {getSortIcon("number")}
                    </span>
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white whitespace-nowrap select-none transition-colors"
                  onClick={() => handleSort("partnerName")}
                >
                  <div className="flex items-center gap-1">
                    <span>Partener</span>
                    <span className="text-[#1d1d1f] dark:text-white opacity-60">
                      {getSortIcon("partnerName")}
                    </span>
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white whitespace-nowrap select-none transition-colors"
                  onClick={() => handleSort("date")}
                >
                  <div className="flex items-center gap-1">
                    <span>Emitere & Scadență</span>
                    <span className="text-[#1d1d1f] dark:text-white opacity-60">
                      {getSortIcon("date")}
                    </span>
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white whitespace-nowrap select-none transition-colors"
                  onClick={() => handleSort("total")}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Valoare</span>
                    <span className="text-[#1d1d1f] dark:text-white opacity-60">
                      {getSortIcon("total")}
                    </span>
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Acțiuni
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-[#6e6e73] mx-auto" />
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-[#6e6e73] dark:text-[#98989d] text-[13px]"
                  >
                    <div className="flex flex-col items-center gap-2.5">
                      <span>
                        {hasActiveFilters
                          ? "Nicio factură nu corespunde filtrelor selectate."
                          : "Nu există facturi înregistrate. Apasă pe Sync pentru import automat din SPV."}
                      </span>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={resetAllFilters}
                          className="apple-btn-glass px-4 h-8 text-[12px] font-semibold text-[#1d1d1f] dark:text-white cursor-pointer"
                        >
                          Resetează filtrele
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((row, i) => {
                  const tb = TYPE_BADGE[row.type];
                  const isUnread = row.type === "primit" && !row.isRead;
                  const openDetail = () => {
                    if (isUnread) markAsRead.mutate({ id: row.id });
                    if (row.source === "refactura") navigate(`/re-facturi/${row.id}`);
                    else if (row.type === "emis" && row.source === "manual")
                      navigate(`/facturi-emise-nou/view/${row.id}`);
                    else navigate(`/facturi-primite/${row.id}`);
                  };
                  return (
                    <tr
                      key={`${row.source}-${row.type}-${row.id}`}
                      className={`group transition-colors hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] ${
                        selectedIds.has(`${row.source}-${row.id}`)
                          ? "bg-[#0071e3]/[0.05] dark:bg-[#0a84ff]/[0.12]"
                          : isUnread
                            ? "bg-[#0071e3]/[0.025] dark:bg-[#0a84ff]/[0.06]"
                            : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-primary cursor-pointer"
                          checked={selectedIds.has(`${row.source}-${row.id}`)}
                          onChange={() => toggleSelect(row)}
                        />
                      </td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span className="text-[12px] font-medium text-[#8e8e93] tabular-nums">
                          {(page - 1) * rowsPerPage + i + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            {isUnread && (
                              <span
                                className="w-2 h-2 rounded-full bg-[#0071e3] dark:bg-[#0a84ff] shrink-0"
                                title="Factură nouă (necitită)"
                              />
                            )}
                            <button
                              type="button"
                              onClick={openDetail}
                              className={`text-[13.5px] text-left truncate hover:underline tabular-nums cursor-pointer ${
                                isUnread
                                  ? "font-bold text-[#1d1d1f] dark:text-white"
                                  : "font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
                              }`}
                            >
                              {row.number}
                            </button>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-medium leading-none ${
                                row.type === "emis"
                                  ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300"
                                  : "bg-amber-500/12 text-amber-700 dark:bg-amber-500/18 dark:text-amber-300"
                              }`}
                            >
                              {tb.label}
                            </span>
                            {row.nirNumber && (
                              <Link href={`/nir/edit/${row.nirId}`}>
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium leading-none bg-teal-500/10 text-teal-700 hover:bg-teal-500/18 dark:bg-teal-500/18 dark:text-teal-300 transition-colors cursor-pointer tabular-nums"
                                  title={`NIR asociat: ${row.nirNumber}`}
                                >
                                  <ClipboardCheck className="w-3 h-3 shrink-0" />
                                  <span>{row.nirNumber}</span>
                                </span>
                              </Link>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-medium border leading-none ${
                                STATUS_COLORS[row.status] || STATUS_COLORS.pending
                              }`}
                            >
                              {getStatusLabel(row.status, row.type)}
                            </span>
                            {row.spvIndex && (
                              <span
                                className="text-[11px] tabular-nums text-[#8e8e93] leading-none"
                                title={`Index încărcare SPV: ${row.spvIndex}`}
                              >
                                SPV #{row.spvIndex}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          {(() => {
                            const cId = getClientId(row);
                            return (
                              <Link
                                href={
                                  cId
                                    ? `/client/${cId}`
                                    : `/clienti?search=${encodeURIComponent(row.partnerName)}`
                                }
                                className={`text-[13.5px] max-w-[240px] truncate hover:underline transition-colors cursor-pointer block ${
                                  isUnread
                                    ? "font-bold text-[#1d1d1f] dark:text-white"
                                    : "font-medium text-[#1d1d1f] dark:text-[#f5f5f7]"
                                }`}
                                title={row.partnerName}
                              >
                                {row.partnerName}
                              </Link>
                            );
                          })()}
                          <div className="flex items-center text-[11.5px] text-[#6e6e73] dark:text-[#98989d] gap-1.5 whitespace-nowrap tabular-nums">
                            {row.partnerCui ? (
                              <>
                                <span>CUI {row.partnerCui}</span>
                                <span>·</span>
                              </>
                            ) : null}
                            <span className="font-medium">
                              {SOURCE_BADGE[row.source]?.label || row.source}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                        <div className="flex flex-col gap-0.5">
                          <span
                            className={`text-[13px] ${
                              isUnread
                                ? "font-semibold text-[#1d1d1f] dark:text-white"
                                : "font-medium text-[#1d1d1f] dark:text-[#ebebf5]"
                            }`}
                          >
                            {formatDate(row.date)}
                          </span>
                          <span className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d]">
                            {row.dueDate ? `Scad. ${formatDate(row.dueDate)}` : "Fără scadență"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`text-[13.5px] tracking-[-0.01em] ${
                              row.total < 0
                                ? "font-bold text-[#ff3b30] dark:text-[#ff453a]"
                                : isUnread
                                  ? "font-bold text-[#1d1d1f] dark:text-white"
                                  : "font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
                            }`}
                          >
                            {formatCurrency(row.total, row.currency as Currency)}
                          </span>
                          <div className="flex items-center justify-end leading-none text-[11px]">
                            {row.spvStatus &&
                            (row.spvStatus.toLowerCase() === "validat" ||
                              row.spvStatus.toLowerCase() === "trimisa") ? (
                              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 dark:bg-emerald-500/18 px-2 py-0.5 rounded-full leading-none">
                                {row.spvStatus.toLowerCase() === "validat"
                                  ? "Validată SPV"
                                  : "Trimisă SPV"}
                              </span>
                            ) : (row.spvStatus && row.spvStatus.toLowerCase() === "extern") ||
                              (row.type === "emis" &&
                                ((row.clientCountry &&
                                  row.clientCountry.toUpperCase() !== "RO") ||
                                  (row.partnerCui &&
                                    !row.partnerCui.toUpperCase().startsWith("RO") &&
                                    /^[A-Z]{2}/.test(row.partnerCui)))) ? (
                              <span
                                className="text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 dark:bg-amber-500/18 px-2 py-0.5 rounded-full leading-none"
                                title="Factură externă (UE/Non-UE) - declarată prin D390/D300"
                              >
                                Extern (D390)
                              </span>
                            ) : row.type === "emis" ? (
                              <SpvDeadlineBadge
                                issueDate={row.date}
                                spvStatus={row.spvStatus}
                                clientCountry={row.clientCountry}
                                clientCUI={row.partnerCui}
                                spvIndex={row.spvIndex}
                                spvSentAt={row.spvSentAt}
                              />
                            ) : (
                              <span className="text-[#8e8e93]">SPV recepționat</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={openDetail}
                            aria-label={`Deschide factura ${row.number}`}
                            className="apple-btn-glass flex items-center justify-center w-8 h-8 rounded-full text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white transition-all cursor-pointer"
                            title="Vizualizează detalii"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (row.source === "refactura") {
                                handleDownloadReInvoicePDF(row);
                              } else if (
                                row.type === "emis" &&
                                row.source === "manual"
                              ) {
                                downloadFile(
                                  `/api/pdf/emitted/${row.id}?download=1`,
                                  `${row.number}.pdf`
                                );
                              } else if (
                                row.fileUrl &&
                                row.fileUrl !== "spv_import"
                              ) {
                                downloadFile(row.fileUrl, `${row.number}.pdf`);
                              } else if (
                                row.type === "primit" ||
                                (row.type === "emis" && row.source === "spv_anaf")
                              ) {
                                downloadFile(
                                  `/api/pdf/archive/${row.id}?download=1`,
                                  `${row.number}.pdf`
                                );
                              } else {
                                toast.error("PDF-ul nu este disponibil.");
                              }
                            }}
                            aria-label={`Descarcă PDF ${row.number}`}
                            className="apple-btn-glass flex items-center justify-center w-8 h-8 rounded-full text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white transition-all cursor-pointer"
                            title="Descarcă PDF"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                          </button>
                          {row.nirId && (
                            <Link href={`/nir/edit/${row.nirId}`}>
                              <button
                                type="button"
                                aria-label={`Vezi NIR ${row.nirNumber || ""}`}
                                className="apple-btn-glass flex items-center justify-center w-8 h-8 rounded-full text-teal-700 dark:text-teal-300 transition-all cursor-pointer"
                                title={`Vezi NIR: ${row.nirNumber || ""}`}
                              >
                                <ClipboardCheck className="w-3.5 h-3.5" />
                              </button>
                            </Link>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                aria-label="Mai multe acțiuni"
                                className="apple-btn-glass flex items-center justify-center w-8 h-8 rounded-full text-[#3a3a3c] dark:text-[#ebebf5] transition-all cursor-pointer"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52 rounded-2xl">
                              {row.status !== "paid" &&
                                row.status !== "processed" &&
                                row.status !== "storno" &&
                                row.source !== "refactura" && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      if (row.source === "manual") {
                                        markEmittedPaid.mutate({
                                          id: row.id,
                                          status: "paid",
                                        });
                                      } else if (
                                        row.source === "spv_anaf" ||
                                        row.source === "spv_import"
                                      ) {
                                        markArchivePaid.mutate({
                                          id: row.id,
                                          status: "processed",
                                        });
                                      }
                                    }}
                                    className="cursor-pointer text-emerald-600 focus:text-emerald-700"
                                  >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    <span>
                                      {row.type === "primit"
                                        ? "Marchează Achitat"
                                        : "Marchează Încasat"}
                                    </span>
                                  </DropdownMenuItem>
                                )}

                              {row.type === "primit" &&
                                (isUnread ? (
                                  <DropdownMenuItem
                                    onClick={() => markAsRead.mutate({ id: row.id })}
                                    className="cursor-pointer"
                                  >
                                    <MailOpen className="w-4 h-4 mr-2 text-[#0071e3]" />
                                    <span>Marchează ca citită</span>
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => markAsUnread.mutate({ id: row.id })}
                                    className="cursor-pointer"
                                  >
                                    <Mail className="w-4 h-4 mr-2 text-[#6e6e73]" />
                                    <span>Marchează ca necitită</span>
                                  </DropdownMenuItem>
                                ))}

                              {(row.type === "primit" ||
                                (row.type === "emis" && row.source === "spv_anaf")) && (
                                <Link href={`/re-facturare/${row.id}`}>
                                  <DropdownMenuItem className="cursor-pointer">
                                    <Send className="w-4 h-4 mr-2" />
                                    <span>Re-facturează</span>
                                  </DropdownMenuItem>
                                </Link>
                              )}

                              {row.nirId ? (
                                <Link href={`/nir/edit/${row.nirId}`}>
                                  <DropdownMenuItem className="cursor-pointer font-medium">
                                    <ClipboardCheck className="w-4 h-4 mr-2 text-teal-600" />
                                    <span>
                                      Vezi NIR {row.nirNumber ? `(${row.nirNumber})` : ""}
                                    </span>
                                  </DropdownMenuItem>
                                </Link>
                              ) : row.type === "primit" ? (
                                <Link href={`/nir/nou/${row.id}`}>
                                  <DropdownMenuItem className="cursor-pointer">
                                    <ClipboardList className="w-4 h-4 mr-2 text-teal-600" />
                                    <span>
                                      {(row as any).nirStatus === "partial"
                                        ? "Creează NIR (Parțial)"
                                        : "Creează NIR"}
                                    </span>
                                  </DropdownMenuItem>
                                </Link>
                              ) : null}

                              <DropdownMenuSeparator />

                              {row.source === "refactura" ? (
                                <DropdownMenuItem
                                  onClick={() => handleDownloadReInvoicePDF(row)}
                                  className="cursor-pointer"
                                >
                                  <FileDown className="w-4 h-4 mr-2" />
                                  <span>Descarcă PDF</span>
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => {
                                    if (row.type === "emis" && row.source === "manual") {
                                      downloadFile(
                                        `/api/pdf/emitted/${row.id}?download=1`,
                                        `${row.number}.pdf`
                                      );
                                    } else if (
                                      row.fileUrl &&
                                      row.fileUrl !== "spv_import"
                                    ) {
                                      downloadFile(row.fileUrl, `${row.number}.pdf`);
                                    } else if (
                                      row.type === "primit" ||
                                      (row.type === "emis" && row.source === "spv_anaf")
                                    ) {
                                      downloadFile(
                                        `/api/pdf/archive/${row.id}?download=1`,
                                        `${row.number}.pdf`
                                      );
                                    } else {
                                      toast.error("PDF-ul nu este disponibil.");
                                    }
                                  }}
                                  className="cursor-pointer"
                                >
                                  <FileDown className="w-4 h-4 mr-2" />
                                  <span>Descarcă PDF</span>
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuSeparator />

                              <DropdownMenuItem
                                onClick={() => setDeleteTarget(row)}
                                className="cursor-pointer text-[#ff3b30] focus:text-[#ff3b30] focus:bg-red-50 dark:focus:bg-red-950/30"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                <span>Șterge</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE LIST — Apple iOS Mail Inset Grouped Craft (>=11px typography, >=36px hit targets) */}
        <div className="sm:hidden divide-y divide-black/[0.06] dark:divide-white/[0.08]">
          {isLoading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#6e6e73] mx-auto" />
            </div>
          ) : paginated.length === 0 ? (
            <div className="py-12 px-4 text-center text-[13px] text-[#6e6e73] dark:text-[#98989d] space-y-2.5">
              <p>Nicio factură nu corespunde filtrelor.</p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="apple-btn-glass px-4 h-8 text-[12px] font-semibold text-[#1d1d1f] dark:text-white"
                >
                  Resetează filtrele
                </button>
              )}
            </div>
          ) : (
            paginated.map((row) => {
              const tb = TYPE_BADGE[row.type];
              const isUnread = row.type === "primit" && !row.isRead;
              const openDetail = () => {
                if (isUnread) markAsRead.mutate({ id: row.id });
                if (row.source === "refactura") navigate(`/re-facturi/${row.id}`);
                else if (row.type === "emis" && row.source === "manual")
                  navigate(`/facturi-emise-nou/view/${row.id}`);
                else navigate(`/facturi-primite/${row.id}`);
              };
              return (
                <div
                  key={`${row.source}-${row.type}-${row.id}`}
                  className={`px-4 py-3.5 transition-colors ${
                    isUnread ? "bg-[#0071e3]/[0.03] dark:bg-[#0a84ff]/[0.07]" : ""
                  }`}
                >
                  {/* Line 1: Partner + Amount + Accessible Menu Hit Target */}
                  <div className="flex items-start justify-between gap-2.5">
                    <button
                      type="button"
                      onClick={openDetail}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left"
                    >
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-[#0071e3] dark:bg-[#0a84ff] shrink-0" />
                      )}
                      <span
                        className={`text-[14px] truncate ${
                          isUnread
                            ? "font-bold text-[#1d1d1f] dark:text-white"
                            : "font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
                        }`}
                      >
                        {row.partnerName}
                      </span>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[14px] font-bold text-[#1d1d1f] dark:text-white tabular-nums">
                        {formatCurrency(row.total, row.currency as Currency)}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Acțiuni factură ${row.number}`}
                            className="apple-btn-glass flex items-center justify-center w-9 h-9 rounded-full text-[#3a3a3c] dark:text-[#ebebf5]"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52 rounded-2xl">
                          {row.status !== "paid" &&
                            row.status !== "processed" &&
                            row.status !== "storno" &&
                            row.source !== "refactura" && (
                              <DropdownMenuItem
                                onClick={() => {
                                  if (row.source === "manual") {
                                    markEmittedPaid.mutate({
                                      id: row.id,
                                      status: "paid",
                                    });
                                  } else if (
                                    row.source === "spv_anaf" ||
                                    row.source === "spv_import"
                                  ) {
                                    markArchivePaid.mutate({
                                      id: row.id,
                                      status: "processed",
                                    });
                                  }
                                }}
                                className="cursor-pointer text-emerald-600 focus:text-emerald-700"
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                <span>
                                  {row.type === "primit"
                                    ? "Marchează Achitat"
                                    : "Marchează Încasat"}
                                </span>
                              </DropdownMenuItem>
                            )}

                          {(row.type === "primit" ||
                            (row.type === "emis" && row.source === "spv_anaf")) && (
                            <Link href={`/re-facturare/${row.id}`}>
                              <DropdownMenuItem className="cursor-pointer">
                                <Send className="w-4 h-4 mr-2" />
                                <span>Re-facturează</span>
                              </DropdownMenuItem>
                            </Link>
                          )}

                          {row.nirId ? (
                            <Link href={`/nir/edit/${row.nirId}`}>
                              <DropdownMenuItem className="cursor-pointer font-medium">
                                <ClipboardCheck className="w-4 h-4 mr-2 text-teal-600" />
                                <span>
                                  Vezi NIR {row.nirNumber ? `(${row.nirNumber})` : ""}
                                </span>
                              </DropdownMenuItem>
                            </Link>
                          ) : row.type === "primit" ? (
                            <Link href={`/nir/nou/${row.id}`}>
                              <DropdownMenuItem className="cursor-pointer">
                                <ClipboardList className="w-4 h-4 mr-2 text-teal-600" />
                                <span>
                                  {(row as any).nirStatus === "partial"
                                    ? "Creează NIR (Parțial)"
                                    : "Creează NIR"}
                                </span>
                              </DropdownMenuItem>
                            </Link>
                          ) : null}

                          <DropdownMenuSeparator />

                          {row.source === "refactura" ? (
                            <DropdownMenuItem
                              onClick={() => handleDownloadReInvoicePDF(row)}
                              className="cursor-pointer"
                            >
                              <FileDown className="w-4 h-4 mr-2" />
                              <span>Descarcă PDF</span>
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => {
                                if (row.type === "emis" && row.source === "manual") {
                                  downloadFile(
                                    `/api/pdf/emitted/${row.id}?download=1`,
                                    `${row.number}.pdf`
                                  );
                                } else if (
                                  row.fileUrl &&
                                  row.fileUrl !== "spv_import"
                                ) {
                                  downloadFile(row.fileUrl, `${row.number}.pdf`);
                                } else if (
                                  row.type === "primit" ||
                                  (row.type === "emis" && row.source === "spv_anaf")
                                ) {
                                  downloadFile(
                                    `/api/pdf/archive/${row.id}?download=1`,
                                    `${row.number}.pdf`
                                  );
                                } else {
                                  toast.error("PDF-ul nu este disponibil.");
                                }
                              }}
                              className="cursor-pointer"
                            >
                              <FileDown className="w-4 h-4 mr-2" />
                              <span>Descarcă PDF</span>
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuSeparator />

                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(row)}
                            className="cursor-pointer text-[#ff3b30] focus:text-[#ff3b30]"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            <span>Șterge</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Line 2: Number + Date + Semantic Pills */}
                  <div className="flex items-center justify-between gap-2 mt-1.5 tabular-nums">
                    <div className="flex items-center gap-1.5 text-[12px] text-[#6e6e73] dark:text-[#98989d] flex-wrap">
                      <button
                        type="button"
                        onClick={openDetail}
                        className="font-semibold text-[#1d1d1f] dark:text-[#ebebf5] hover:underline"
                      >
                        {row.number}
                      </button>
                      <span>·</span>
                      <span>{formatDate(row.date)}</span>
                      {row.nirNumber && (
                        <Link href={`/nir/edit/${row.nirId}`}>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-teal-500/10 text-teal-700 dark:bg-teal-500/18 dark:text-teal-300">
                            <ClipboardCheck className="w-3 h-3 shrink-0" />
                            <span>{row.nirNumber}</span>
                          </span>
                        </Link>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          row.type === "emis"
                            ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300"
                            : "bg-amber-500/12 text-amber-700 dark:bg-amber-500/18 dark:text-amber-300"
                        }`}
                      >
                        {tb.label}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                          STATUS_COLORS[row.status] || STATUS_COLORS.pending
                        }`}
                      >
                        {getStatusLabel(row.status, row.type)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer paginare — Apple HIG Capsule Controls */}
        <div className="px-4 py-3 border-t border-black/[0.05] dark:border-white/[0.07] flex items-center justify-between bg-[#fafafa]/85 dark:bg-white/[0.02] flex-wrap gap-2">
          <div className="flex items-center gap-2 text-[12px] text-[#6e6e73] dark:text-[#98989d] tabular-nums">
            <span className="flex items-center whitespace-nowrap">
              Afișează
              <Select
                value={rowsPerPage.toString()}
                onValueChange={val => {
                  setRowsPerPage(Number(val));
                  setPage(1);
                }}
              >
                <SelectTrigger className="apple-pill-control h-7 px-2.5 text-[12px] w-[66px] mx-1.5">
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
            </span>
            <span className="whitespace-nowrap ml-1">
              din <strong className="text-[#1d1d1f] dark:text-white font-semibold">{filtered.length}</strong> documente
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-[#6e6e73] dark:text-[#98989d] tabular-nums">
            <span className="whitespace-nowrap mr-1.5">
              Pagina <strong className="text-[#1d1d1f] dark:text-white font-semibold">{page}</strong> din{" "}
              <strong className="text-[#1d1d1f] dark:text-white font-semibold">{totalPages}</strong>
            </span>
            <button
              type="button"
              onClick={() => setPage(p => p - 1)}
              disabled={page === 1}
              aria-label="Pagina anterioară"
              className="apple-btn-glass w-8 h-8 rounded-full flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] disabled:opacity-35 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages}
              aria-label="Pagina următoare"
              className="apple-btn-glass w-8 h-8 rounded-full flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] disabled:opacity-35 transition-all cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={open => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="rounded-[22px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmă ștergerea</AlertDialogTitle>
            <AlertDialogDescription>
              Ești sigur că vrei să ștergi factura{" "}
              <strong>{deleteTarget?.number}</strong>? Această acțiune este
              definitivă.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Anulează</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white rounded-full"
            >
              Șterge definitiv
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirmation dialog */}
      <AlertDialog
        open={bulkDeleteOpen}
        onOpenChange={open => {
          if (!isBulkDeleting) setBulkDeleteOpen(open);
        }}
      >
        <AlertDialogContent className="rounded-[22px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmă ștergerea multiplă</AlertDialogTitle>
            <AlertDialogDescription>
              Ești sigur că vrei să ștergi definitiv cele{" "}
              <strong className="tabular-nums">{selectedIds.size}</strong> facturi selectate?
              Această acțiune nu poate fi anulată.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting} className="rounded-full">
              Anulează
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isBulkDeleting}
              onClick={e => {
                e.preventDefault();
                confirmBulkDelete();
              }}
              className="bg-red-600 hover:bg-red-700 text-white rounded-full"
            >
              {isBulkDeleting ? "Se șterg..." : `Șterge ${selectedIds.size} facturi`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExternalInvoiceImportModal
        open={showExternalImportModal}
        onClose={() => setShowExternalImportModal(false)}
        onSuccess={() => {
          r1();
          r2();
          r3();
        }}
      />
    </div>
  );
}
