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
  Tag,
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
    const rows: UnifiedRow[] = [];
    const emittedIndexByNumber = new Map<string, string>();
    (Array.isArray(emittedInvoices) ? emittedInvoices : []).forEach((i: any) => {
      if (i.number && i.spvIndex) {
        emittedIndexByNumber.set(String(i.number).trim().toLowerCase(), String(i.spvIndex));
      }
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
        fileUrl: i.source === "spv_anaf" || i.fileUrl === "spv_import" ? `/api/pdf/archive/${i.id}` : i.fileUrl,
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
      rows = rows.filter(r => r.source === sourceFilter);
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

  const filteredTotals = useMemo(() => {
    const sums: Record<string, number> = {};
    for (const r of filtered) {
      const c = (r.currency || "RON").toUpperCase();
      sums[c] = (sums[c] || 0) + (Number(r.total) || 0);
    }
    const entries = Object.entries(sums).sort((a, b) => {
      if (a[0] === "RON") return -1;
      if (b[0] === "RON") return 1;
      return b[1] - a[1];
    });
    return {
      sums,
      entries,
      isFiltered: filtered.length !== allRows.length,
    };
  }, [filtered, allRows.length]);

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

  return (
    <div className="p-2.5 sm:p-4 max-w-full space-y-4">
      {/* Header cu Titlu + Export/Sync (Top Row) si Filtre Perioada (Bottom Row) */}
      <div className="flex flex-col gap-3.5">
        {/* Top Row: Title & Action Buttons */}
        <div className="flex items-center justify-between px-1">
          <div>
            <h1 className="text-xl sm:text-[22px] font-bold text-[#1d1d1f] dark:text-white tracking-[-0.022em] leading-tight">
              Facturi
            </h1>
            <p className="text-xs text-[#636366] dark:text-[#98989d] mt-0.5 tabular-nums">
              Total: <strong className="text-[#1d1d1f] dark:text-white font-semibold">{allRows.length}</strong> înregistrări
            </p>
          </div>
        </div>

        {/* KPI Cards — Compact Apple macOS Tahoe Interactive Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* TOTAL */}
          <div
            className={`rounded-2xl border px-3.5 py-2.5 flex items-center justify-between transition-all duration-200 cursor-pointer ${
              typeFilter === "all"
                ? "bg-gradient-to-br from-white via-white to-primary/[0.06] dark:from-[#1c1c1e] dark:via-[#1c1c1e] dark:to-primary/[0.14] border-primary/45 ring-1 ring-primary/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_4px_14px_-4px_rgba(15,23,42,0.07)]"
                : "bg-white/95 dark:bg-[#1c1c1e] border-black/[0.06] dark:border-white/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_1px_4px_rgba(15,23,42,0.04)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,1),0_6px_16px_-4px_rgba(15,23,42,0.07)]"
            }`}
            onClick={() => { setTypeFilter("all"); setPage(1); }}
          >
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[#636366] dark:text-[#98989d] mb-0.5 truncate">
                Total
              </p>
              <div className="flex items-baseline gap-1.5 tabular-nums">
                <p className="text-lg sm:text-[20px] font-bold text-[#1d1d1f] dark:text-white tracking-[-0.022em] leading-none">
                  {allRows.length}
                </p>
                {filtered.length !== allRows.length && (
                  <span className="text-[11px] font-semibold text-primary">
                    ({filtered.length})
                  </span>
                )}
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0 ml-2">
              <ClipboardList className="w-4 h-4 text-primary" />
            </div>
          </div>

          {/* EMISE */}
          <div
            className={`rounded-2xl border px-3.5 py-2.5 flex items-center justify-between transition-all duration-200 cursor-pointer ${
              typeFilter === "emis"
                ? "bg-gradient-to-br from-white via-white to-emerald-500/[0.07] dark:from-[#1c1c1e] dark:via-[#1c1c1e] dark:to-emerald-500/[0.15] border-emerald-500/45 ring-1 ring-emerald-500/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_4px_14px_-4px_rgba(15,23,42,0.07)]"
                : "bg-white/95 dark:bg-[#1c1c1e] border-black/[0.06] dark:border-white/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_1px_4px_rgba(15,23,42,0.04)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,1),0_6px_16px_-4px_rgba(15,23,42,0.07)]"
            }`}
            onClick={() => { setTypeFilter("emis"); setPage(1); }}
          >
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[#636366] dark:text-[#98989d] mb-0.5 truncate">
                Emise
              </p>
              <div className="flex items-baseline gap-1.5 tabular-nums">
                <p className="text-lg sm:text-[20px] font-bold text-[#1d1d1f] dark:text-white tracking-[-0.022em] leading-none">
                  {allRows.filter(r => r.type === "emis").length}
                </p>
                {filtered.length !== allRows.length && (
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    ({filtered.filter(r => r.type === "emis").length})
                  </span>
                )}
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/12 dark:bg-emerald-500/20 flex items-center justify-center flex-shrink-0 ml-2">
              <Send className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>

          {/* PRIMITE */}
          <div
            className={`rounded-2xl border px-3.5 py-2.5 flex items-center justify-between transition-all duration-200 cursor-pointer ${
              typeFilter === "primit"
                ? "bg-gradient-to-br from-white via-white to-amber-500/[0.07] dark:from-[#1c1c1e] dark:via-[#1c1c1e] dark:to-amber-500/[0.15] border-amber-500/45 ring-1 ring-amber-500/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_4px_14px_-4px_rgba(15,23,42,0.07)]"
                : "bg-white/95 dark:bg-[#1c1c1e] border-black/[0.06] dark:border-white/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_1px_4px_rgba(15,23,42,0.04)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,1),0_6px_16px_-4px_rgba(15,23,42,0.07)]"
            }`}
            onClick={() => { setTypeFilter("primit"); setPage(1); }}
          >
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[#636366] dark:text-[#98989d] mb-0.5 truncate">
                Primite
              </p>
              <div className="flex items-baseline gap-1.5 tabular-nums">
                <p className="text-lg sm:text-[20px] font-bold text-[#1d1d1f] dark:text-white tracking-[-0.022em] leading-none">
                  {allRows.filter(r => r.type === "primit").length}
                </p>
                {filtered.length !== allRows.length && (
                  <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    ({filtered.filter(r => r.type === "primit").length})
                  </span>
                )}
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-amber-500/12 dark:bg-amber-500/20 flex items-center justify-center flex-shrink-0 ml-2">
              <Download className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </div>
          </div>

          {/* TOTAL SUMĂ (PENTRU CELE AFIȘATE / FILTRATE) */}
          <div
            className={`rounded-2xl border px-3.5 py-2.5 flex items-center justify-between transition-all duration-200 ${
              filteredTotals.isFiltered
                ? "bg-gradient-to-br from-white via-white to-primary/[0.06] dark:from-[#1c1c1e] dark:to-primary/[0.14] border-primary/45 ring-1 ring-primary/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_4px_14px_-4px_rgba(15,23,42,0.07)]"
                : "bg-white/95 dark:bg-[#1c1c1e] border-black/[0.06] dark:border-white/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_1px_4px_rgba(15,23,42,0.04)]"
            }`}
          >
            <div className="min-w-0 flex-1 tabular-nums">
              <div className="flex items-center gap-1.5 mb-0.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[#636366] dark:text-[#98989d] truncate">
                  Total Sumă
                </p>
                {filteredTotals.isFiltered ? (
                  <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/12 text-primary leading-none">
                    Filtrate
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-[#636366] dark:text-[#98989d] leading-none">
                    (Toate)
                  </span>
                )}
              </div>
              {filteredTotals.entries.length === 0 ? (
                <p className="text-base sm:text-[18px] font-bold text-[#1d1d1f] dark:text-white tracking-[-0.022em] leading-none">
                  0,00 RON
                </p>
              ) : (
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <p className="text-sm sm:text-base lg:text-[17px] font-bold text-[#1d1d1f] dark:text-white tracking-[-0.022em] leading-none truncate">
                    {formatCurrency(filteredTotals.entries[0][1], (filteredTotals.entries[0][0] as Currency) || "RON")}
                  </p>
                  {filteredTotals.entries.slice(1).map(([curr, val]) => (
                    <span key={curr} className="text-[10.5px] font-semibold text-[#636366] dark:text-[#98989d] leading-none">
                      + {formatCurrency(val, (curr as Currency) || "EUR")}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="w-8 h-8 rounded-xl bg-amber-500/12 dark:bg-amber-500/20 flex items-center justify-center flex-shrink-0 ml-2">
              <Coins className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Banner selectie multipla */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 apple-btn-prominent rounded-full shadow-lg">
          <span className="text-sm font-semibold tabular-nums">
            {selectedIds.size} factură/facturi selectate
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3.5 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors"
            >
              Anulează
            </button>
            <button
              onClick={handleDownloadSelectedZip}
              className="px-3.5 h-8 rounded-full bg-white text-[#1d1d1f] hover:bg-white/90 text-xs font-semibold transition-colors shadow-sm"
            >
              Descarcă selectate
            </button>
            <button
              type="button"
              onClick={() => setBulkDeleteOpen(true)}
              className="px-3.5 h-8 rounded-full bg-[#ff3b30] text-white hover:bg-[#e0352b] text-xs font-semibold transition-colors shadow-sm cursor-pointer"
            >
              Șterge selectate
            </button>
          </div>
        </div>
      )}

      {/* Card tabel — Apple Tahoe Concentric Container */}
      <div className="bg-white/96 dark:bg-[#1c1c1e] rounded-[22px] border border-black/[0.06] dark:border-white/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_2px_10px_-3px_rgba(15,23,42,0.04),0_12px_32px_-10px_rgba(15,23,42,0.06)] overflow-hidden">
        {/* Search & Filtre — Apple Frosted Toolbar Strip */}
        <div className="px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.08] flex flex-col gap-2 bg-[#f5f7fb]/85 dark:bg-white/[0.025] backdrop-blur-md">
          <div className="flex items-center gap-2 w-full flex-wrap">
            {/* Cautare */}
            <div className="relative flex-1 min-w-[160px]">
              <Search
                className="w-3.5 h-3.5 text-[#636366] dark:text-[#98989d] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              />
              <input
                style={{ paddingLeft: 36, paddingRight: search ? 80 : 14 }}
                className="rounded-full w-full h-9 border border-black/[0.08] dark:border-white/[0.12] outline-none text-[13px] bg-white/90 dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-white placeholder:text-[#636366] dark:placeholder:text-[#98989d] shadow-[inset_0_1px_2px_rgba(15,23,42,0.04),0_1px_0_rgba(255,255,255,0.9)] focus:bg-white dark:focus:bg-[#3a3a3c] transition-all"
                placeholder="Caută factură..."
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              {search && (
                <>
                  <div className="absolute right-9 top-1/2 -translate-y-1/2 bg-primary text-white rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums">
                    {filtered.length}/{allRows.length}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Șterge căutarea"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/[0.06] dark:hover:bg-white/[0.10] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5 text-[#636366] hover:text-[#1d1d1f] dark:text-[#98989d] dark:hover:text-white" />
                  </button>
                </>
              )}
            </div>

            {/* Perioadă Filter */}
            <div className="w-[138px] flex-shrink-0">
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
                <SelectTrigger className="h-9 w-full rounded-full text-xs font-semibold apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-1.5 px-3">
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

            {/* Type Filter */}
            <div className="w-[124px] flex-shrink-0">
              <Select
                value={typeFilter}
                onValueChange={val => {
                  setTypeFilter(val as any);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-full rounded-full text-xs font-semibold apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-1.5 px-3">
                  <Tag className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                  <SelectValue placeholder="Tip" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tip: Toate</SelectItem>
                  <SelectItem value="primit">Primite</SelectItem>
                  <SelectItem value="emis">Emise</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Read / Unread Filter */}
            <div className="w-[128px] flex-shrink-0">
              <Select
                value={readFilter}
                onValueChange={val => {
                  setReadFilter(val as any);
                  setPage(1);
                }}
              >
                <SelectTrigger
                  className={`h-9 w-full rounded-full text-xs font-semibold ${
                    readFilter !== "all"
                      ? "border-blue-500/60 bg-blue-50/90 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-700"
                      : "apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7]"
                  } flex items-center gap-1.5 px-3 tabular-nums`}
                >
                  {readFilter === "unread" ? (
                    <Mail className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  ) : readFilter === "read" ? (
                    <MailOpen className="w-3.5 h-3.5 text-[#636366] dark:text-[#98989d] flex-shrink-0" />
                  ) : (
                    <Mail className="w-3.5 h-3.5 text-[#636366] dark:text-[#98989d] flex-shrink-0" />
                  )}
                  <SelectValue placeholder="Citire" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toate ({allRows.length})</SelectItem>
                  <SelectItem value="unread">
                    ● Necitite ({readCounts.unread})
                  </SelectItem>
                  <SelectItem value="read">
                    ○ Citite ({readCounts.read})
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtru NIR dedicat (Cu / Fara NIR) */}
            <div className="w-[126px] flex-shrink-0">
              <Select
                value={nirFilter}
                onValueChange={val => {
                  setNirFilter(val as any);
                  setPage(1);
                }}
              >
                <SelectTrigger
                  className={`h-9 w-full rounded-full text-xs font-semibold ${
                    nirFilter !== "all"
                      ? "border-teal-500/60 bg-teal-50/90 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-700"
                      : "apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7]"
                  } flex items-center gap-1.5 px-3 tabular-nums`}
                >
                  <ClipboardCheck
                    className={`w-3.5 h-3.5 ${
                      nirFilter !== "all"
                        ? "text-teal-600 dark:text-teal-400"
                        : "text-teal-600"
                    } flex-shrink-0`}
                  />
                  <SelectValue placeholder="NIR" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">NIR: Toate</SelectItem>
                  <SelectItem value="cu_nir">Cu NIR ({nirCounts.cuNir})</SelectItem>
                  <SelectItem value="fara_nir">○ Fără NIR ({nirCounts.faraNir})</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Source Filter */}
            <div className="w-[138px] flex-shrink-0">
              <Select
                value={sourceFilter}
                onValueChange={val => {
                  setSourceFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-full rounded-full text-xs font-semibold apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-1.5 px-3">
                  <Globe className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <SelectValue placeholder="Sursă" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toate sursele</SelectItem>
                  <SelectItem value="spv_anaf">SPV ANAF</SelectItem>
                  <SelectItem value="oblio">Oblio</SelectItem>
                  <SelectItem value="smartbill">SmartBill</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Buton Sync — Apple Liquid Glass Prominent Capsule */}
            <button
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
                        oblioErr = cleanErrorMessage(err, "Eroare la sincronizarea Oblio.");
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
                          spvErr = cleanErrorMessage(err, "Eroare la sincronizarea SPV.");
                        })
                    );
                  }
                  await Promise.all(tasks);
                  syncedAny = true;

                  r1();
                  r2();
                  r3();

                  if (oblioErr && spvErr) {
                    toast.error(`Sincronizarea a eșuat: ${spvErr} · ${oblioErr}`, { id: "sync" });
                  } else if (spvErr) {
                    toast.error(`Eroare sincronizare SPV: ${spvErr}`, { id: "sync" });
                  } else if (oblioErr) {
                    toast.warning(`SPV sincronizat, dar Oblio a raportat o eroare: ${oblioErr}`, { id: "sync" });
                  } else if (spvResult?.limitHit > 0) {
                    const facturiNoi = spvResult.imported === 1 ? "1 factură nouă importată" : `${spvResult.imported} facturi noi importate`;
                    const facturiLimita = spvResult.limitHit === 1 ? "1 factură" : `${spvResult.limitHit} facturi`;
                    toast.warning(
                      `Sync complet: ${facturiNoi}.\n${facturiLimita} nu ${spvResult.limitHit === 1 ? "a putut" : "au putut"} fi descărcată azi — ANAF permite maxim 10 descărcări/zi per fișier. Va fi importată automat mâine.`,
                      { id: "sync", duration: 8000 }
                    );
                  } else if (spvResult?.imported > 0) {
                    const facturiNoi = spvResult.imported === 1 ? "1 factură nouă importată" : `${spvResult.imported} facturi noi importate`;
                    toast.success(`Sync complet: ${facturiNoi} din SPV!`, { id: "sync" });
                  } else {
                    toast.success("Sincronizare completă! Nicio factură nouă de importat.", { id: "sync" });
                  }
                }

                if (!syncedAny) {
                  toast.error(
                    "Nicio integrare activă de sincronizat.",
                    {
                      action: {
                        label: "Configurează Integrări",
                        onClick: () => navigate("/integrari"),
                      },
                    }
                  );
                }
              }}
              disabled={syncOblio.isPending || syncSpvManual.isPending}
              className="apple-btn-prominent flex items-center justify-center gap-1.5 px-3.5 h-9 rounded-full text-white text-xs font-semibold transition-all disabled:opacity-60 flex-shrink-0 cursor-pointer"
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

          {/* Arată input-urile doar dacă este pe "custom" */}
          {period === "custom" && (
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700 w-fit mt-0.5">
              <input
                type="date"
                value={customFrom}
                onChange={e => {
                  setCustomFrom(e.target.value);
                  setPage(1);
                }}
                className="h-7 px-1.5 text-xs tabular-nums bg-transparent text-slate-600 dark:text-slate-300 outline-none w-[112px]"
              />
              <span className="text-[10px] text-slate-400 font-bold">-</span>
              <input
                type="date"
                value={customTo}
                onChange={e => {
                  setCustomTo(e.target.value);
                  setPage(1);
                }}
                className="h-7 px-1.5 text-xs tabular-nums bg-transparent text-slate-600 dark:text-slate-300 outline-none w-[112px]"
              />
            </div>
          )}
        </div>

        {/* DESKTOP TABLE */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#f8f9fc]/90 dark:bg-white/[0.02] border-b border-black/[0.06] dark:border-white/[0.08]">
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
                <th className="px-4 py-3 w-12 text-center text-[10.5px] font-semibold text-[#636366] dark:text-[#98989d] uppercase tracking-wider whitespace-nowrap">
                  Nr. Crt.
                </th>
                <th
                  className="px-4 py-3 text-left text-[11px] font-semibold text-[#636366] dark:text-[#98989d] uppercase tracking-wider cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white whitespace-nowrap select-none transition-colors"
                  onClick={() => handleSort("number")}
                >
                  <div className="flex items-center gap-1">
                    Număr Factură{" "}
                    <span className="text-primary">
                      {getSortIcon("number")}
                    </span>
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-[11px] font-semibold text-[#636366] dark:text-[#98989d] uppercase tracking-wider cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white whitespace-nowrap select-none transition-colors"
                  onClick={() => handleSort("partnerName")}
                >
                  <div className="flex items-center gap-1">
                    Partener{" "}
                    <span className="text-primary">
                      {getSortIcon("partnerName")}
                    </span>
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-[11px] font-semibold text-[#636366] dark:text-[#98989d] uppercase tracking-wider cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white whitespace-nowrap select-none transition-colors"
                  onClick={() => handleSort("date")}
                >
                  <div className="flex items-center gap-1">
                    Dată / Scadență{" "}
                    <span className="text-primary">{getSortIcon("date")}</span>
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right text-[11px] font-semibold text-[#636366] dark:text-[#98989d] uppercase tracking-wider cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white whitespace-nowrap select-none transition-colors"
                  onClick={() => handleSort("total")}
                >
                  <div className="flex items-center justify-end gap-1">
                    Total{" "}
                    <span className="text-primary">
                      {getSortIcon("total")}
                    </span>
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold text-[#636366] dark:text-[#98989d] uppercase tracking-wider whitespace-nowrap">
                  Acțiuni
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-6 text-center text-[#636366] dark:text-[#98989d] text-xs bg-black/[0.015] dark:bg-white/[0.02]"
                  >
                    {search || typeFilter !== "all" || nirFilter !== "all"
                      ? "Nicio factură pentru filtrele aplicate."
                      : "Nu există facturi. Apasă Sync sau importă XML din pagina Integrări."}
                  </td>
                </tr>
              ) : (
                paginated.map((row, i) => {
                  const tb = TYPE_BADGE[row.type];
                  const isUnread = row.type === "primit" && !row.isRead;
                  return (
                    <tr
                      key={`${row.source}-${row.type}-${row.id}`}
                      className={`hover:bg-black/[0.02] dark:hover:bg-white/[0.035] transition-colors ${selectedIds.has(`${row.source}-${row.id}`) ? "bg-primary/[0.06] dark:bg-primary/[0.12]" : isUnread ? "bg-blue-500/[0.035] dark:bg-blue-500/[0.08]" : ""}`}
                    >
                      <td className="px-4 py-2.5 text-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-primary cursor-pointer"
                          checked={selectedIds.has(`${row.source}-${row.id}`)}
                          onChange={() => toggleSelect(row)}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-center whitespace-nowrap">
                        <div className="h-10 flex items-center justify-center font-semibold text-xs text-[#636366] dark:text-[#98989d] tabular-nums">
                          {(page - 1) * rowsPerPage + i + 1}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="h-10 flex flex-col justify-center gap-0.5">
                          <div className="h-5 flex items-center gap-1.5">
                            {isUnread && (
                              <span
                                className="w-2 h-2 rounded-full bg-primary shrink-0 inline-block shadow-sm"
                                title="Factură nouă (necitită)"
                              />
                            )}
                            <button
                              onClick={() => {
                                if (isUnread) markAsRead.mutate({ id: row.id });
                                if (row.source === "refactura")
                                  navigate(`/re-facturi/${row.id}`);
                                else if (
                                  row.type === "emis" &&
                                  row.source === "manual"
                                )
                                  navigate(`/facturi-emise-nou/view/${row.id}`);
                                else navigate(`/facturi-primite/${row.id}`);
                              }}
                              className={`text-[12.5px] text-left truncate hover:underline tabular-nums ${
                                isUnread
                                  ? "font-bold text-primary"
                                  : "font-semibold text-primary"
                              }`}
                            >
                              {row.number}
                            </button>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border leading-none ${
                                row.type === "emis"
                                  ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30"
                                  : "bg-amber-500/12 text-amber-700 border-amber-500/20 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30"
                              }`}
                            >
                              {tb.label}
                            </span>
                            {row.nirNumber && (
                              <Link href={`/nir/edit/${row.nirId}`}>
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border leading-none bg-teal-500/10 text-teal-700 border-teal-500/20 hover:bg-teal-500/20 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30 transition-colors cursor-pointer tabular-nums"
                                  title={`NIR asociat: ${row.nirNumber}. Click pentru vizualizare / editare NIR.`}
                                >
                                  <ClipboardCheck className="w-3 h-3 text-teal-600 dark:text-teal-400 shrink-0" />
                                  <span>{row.nirNumber}</span>
                                </span>
                              </Link>
                            )}
                          </div>
                          <div className="h-5 flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10.5px] font-medium border leading-none ${STATUS_COLORS[row.status] || STATUS_COLORS.pending}`}
                            >
                              {getStatusLabel(row.status, row.type)}
                            </span>
                            {row.spvIndex && (
                              <span
                                className="text-[11px] tabular-nums text-[#636366] dark:text-[#98989d] font-normal leading-none"
                                title={`Index încărcare SPV: ${row.spvIndex}`}
                              >
                                Index: {row.spvIndex}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="h-10 flex flex-col justify-center gap-0.5">
                          <div className="h-5 flex items-center">
                            {(() => {
                              const cId = getClientId(row);
                              return (
                                <Link
                                  href={cId ? `/client/${cId}` : `/clienti?search=${encodeURIComponent(row.partnerName)}`}
                                  className={`text-[12.5px] max-w-[220px] truncate hover:underline hover:text-primary transition-colors cursor-pointer block ${
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
                          </div>
                          <div className="h-5 flex items-center text-[11px] text-[#636366] dark:text-[#98989d] font-normal gap-1.5 whitespace-nowrap tabular-nums">
                            {row.partnerCui ? (
                              <>
                                <span>{`CUI: ${row.partnerCui}`}</span>
                                <span>·</span>
                              </>
                            ) : null}
                            <span className={`font-medium ${SOURCE_BADGE[row.source]?.cls || "text-[#636366]"}`}>
                              {SOURCE_BADGE[row.source]?.label || row.source}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">
                        <div className="h-10 flex flex-col justify-center gap-0.5">
                          <div className="h-5 flex items-center">
                            <span className={`text-[12.5px] ${
                              isUnread
                                ? "font-bold text-[#1d1d1f] dark:text-white"
                                : "font-medium text-[#3a3a3c] dark:text-[#ebebf5]"
                            }`}>
                              {formatDate(row.date)}
                            </span>
                          </div>
                          <div className="h-5 flex items-center text-[11px] text-[#636366] dark:text-[#98989d] font-normal">
                            {row.dueDate ? `Scad: ${formatDate(row.dueDate)}` : "—"}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">
                        <div className="h-10 flex flex-col justify-center items-end gap-0.5">
                          <div className="h-5 flex items-center justify-end">
                            <span className={`text-[13px] ${
                              isUnread
                                ? "font-bold text-[#1d1d1f] dark:text-white"
                                : "font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
                            }`}>
                              {formatCurrency(row.total, row.currency as Currency)}
                            </span>
                          </div>
                          <div className="h-5 flex items-center justify-end leading-none text-[11px] font-normal">
                            {row.spvStatus &&
                            (row.spvStatus.toLowerCase() === "validat" ||
                              row.spvStatus.toLowerCase() === "trimisa") ? (
                              <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/12 dark:bg-emerald-500/18 px-2 py-0.5 rounded-full border border-emerald-500/20 leading-none">
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
                                className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/12 dark:bg-amber-500/18 px-2 py-0.5 rounded-full border border-amber-500/20 leading-none"
                                title="Factură externă (UE/Non-UE) - declarată prin D390/D300, nu se transmite în SPV"
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
                              <span className="text-[#636366] dark:text-[#98989d]">—</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="h-10 flex items-center justify-end gap-1.5">
                          <button
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
                                downloadFile(
                                  row.fileUrl,
                                  `${row.number}.pdf`
                                );
                              } else if (
                                row.type === "primit" ||
                                (row.type === "emis" &&
                                  row.source === "spv_anaf")
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
                            className="apple-btn-glass flex items-center justify-center w-8 h-8 rounded-full text-[#3a3a3c] dark:text-[#ebebf5] hover:text-primary transition-all cursor-pointer"
                            title="Descarcă PDF"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                          </button>
                          {row.nirId && (
                            <Link href={`/nir/edit/${row.nirId}`}>
                              <button
                                aria-label={`Vezi NIR ${row.nirNumber || ""}`}
                                className="flex items-center justify-center w-8 h-8 rounded-full bg-teal-500/12 dark:bg-teal-500/20 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-500/25 transition-all cursor-pointer"
                                title={`Vezi NIR: ${row.nirNumber || ""}`}
                              >
                                <ClipboardCheck className="w-3.5 h-3.5" />
                              </button>
                            </Link>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                aria-label="Mai multe acțiuni"
                                className="apple-btn-glass flex items-center justify-center w-8 h-8 rounded-full text-[#3a3a3c] dark:text-[#ebebf5] transition-all cursor-pointer"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
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

                              {row.type === "primit" && (
                                isUnread ? (
                                  <DropdownMenuItem
                                    onClick={() => markAsRead.mutate({ id: row.id })}
                                    className="cursor-pointer text-slate-700 dark:text-slate-300"
                                  >
                                    <MailOpen className="w-4 h-4 mr-2 text-blue-600" />
                                    <span>Marchează ca citită</span>
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => markAsUnread.mutate({ id: row.id })}
                                    className="cursor-pointer text-slate-700 dark:text-slate-300"
                                  >
                                    <Mail className="w-4 h-4 mr-2 text-slate-500" />
                                    <span>Marchează ca necitită</span>
                                  </DropdownMenuItem>
                                )
                              )}

                              {(row.type === "primit" ||
                                (row.type === "emis" &&
                                  row.source === "spv_anaf")) && (
                                <Link href={`/re-facturare/${row.id}`}>
                                  <DropdownMenuItem className="cursor-pointer text-blue-600 focus:text-blue-700">
                                    <Send className="w-4 h-4 mr-2" />
                                    <span>Re-facturează</span>
                                  </DropdownMenuItem>
                                </Link>
                              )}

                              {row.nirId ? (
                                <Link href={`/nir/edit/${row.nirId}`}>
                                  <DropdownMenuItem className="cursor-pointer text-teal-600 focus:text-teal-700 font-medium">
                                    <ClipboardCheck className="w-4 h-4 mr-2 text-teal-600" />
                                    <span>Vezi NIR {row.nirNumber ? `(${row.nirNumber})` : ""}</span>
                                  </DropdownMenuItem>
                                </Link>
                              ) : row.type === "primit" ? (
                                <Link href={`/nir/nou/${row.id}`}>
                                  <DropdownMenuItem className="cursor-pointer text-teal-600 focus:text-teal-700">
                                    <ClipboardList className="w-4 h-4 mr-2" />
                                    <span>
                                      {(row as any).nirStatus === "partial" ? "Creează NIR (Parțial)" : "Creează NIR"}
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
                                    if (
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
                                      downloadFile(
                                        row.fileUrl,
                                        `${row.number}.pdf`
                                      );
                                    } else if (
                                      row.type === "primit" ||
                                      (row.type === "emis" &&
                                        row.source === "spv_anaf")
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
                                className="cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50"
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

        {/* MOBILE CARDS */}
        <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {isLoading ? (
            <div className="py-10 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
            </div>
          ) : paginated.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              Nicio factură.
            </div>
          ) : (
            paginated.map((row, i) => {
              const tb = TYPE_BADGE[row.type];
              return (
                <div
                  key={`${row.source}-${row.type}-${row.id}`}
                  className="px-3 py-2.5"
                >
                  {/* LINIA 1: Numar, Nume, Total, Meniu */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="text-[10px] text-slate-400 flex-shrink-0">
                        {(page - 1) * rowsPerPage + i + 1}.
                      </span>
                      <button
                        onClick={() => {
                          if (row.source === "refactura")
                            navigate(`/re-facturi/${row.id}`);
                          else if (row.type === "emis" && row.source === "manual")
                            navigate(`/facturi-emise-nou/view/${row.id}`);
                          else navigate(`/facturi-primite/${row.id}`);
                        }}
                        className="text-[11px] font-bold text-blue-600 hover:underline flex-shrink-0"
                      >
                        {row.number}
                      </button>
                      <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate font-medium">
                        {row.partnerName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[11px] font-black text-slate-900 dark:text-white">
                        {formatCurrency(row.total, row.currency as Currency)}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors">
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
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
                            (row.type === "emis" &&
                              row.source === "spv_anaf")) && (
                            <Link href={`/re-facturare/${row.id}`}>
                              <DropdownMenuItem className="cursor-pointer text-blue-600 focus:text-blue-700">
                                <Send className="w-4 h-4 mr-2" />
                                <span>Re-facturează</span>
                              </DropdownMenuItem>
                            </Link>
                          )}

                          {row.nirId ? (
                            <Link href={`/nir/edit/${row.nirId}`}>
                              <DropdownMenuItem className="cursor-pointer text-teal-600 focus:text-teal-700 font-medium">
                                <ClipboardCheck className="w-4 h-4 mr-2 text-teal-600" />
                                <span>Vezi NIR {row.nirNumber ? `(${row.nirNumber})` : ""}</span>
                              </DropdownMenuItem>
                            </Link>
                          ) : row.type === "primit" ? (
                            <Link href={`/nir/nou/${row.id}`}>
                              <DropdownMenuItem className="cursor-pointer text-teal-600 focus:text-teal-700">
                                <ClipboardList className="w-4 h-4 mr-2" />
                                <span>
                                  {(row as any).nirStatus === "partial" ? "Creează NIR (Parțial)" : "Creează NIR"}
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
                                if (
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
                                  downloadFile(
                                    row.fileUrl,
                                    `${row.number}.pdf`
                                  );
                                } else if (
                                  row.type === "primit" ||
                                  (row.type === "emis" &&
                                    row.source === "spv_anaf")
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
                            className="cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            <span>Șterge</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* LINIA 2: Badge tip, Date, Badge status */}
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
                      <span
                        className={`px-1 py-0.5 rounded text-[8px] font-bold border ${tb.cls}`}
                      >
                        {tb.label}
                      </span>
                      {row.nirNumber && (
                        <Link href={`/nir/edit/${row.nirId}`}>
                          <span
                            className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-bold border bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800"
                            title={`NIR: ${row.nirNumber}`}
                          >
                            <ClipboardCheck className="w-2.5 h-2.5 text-teal-600 dark:text-teal-400 shrink-0" />
                            <span>{row.nirNumber}</span>
                          </span>
                        </Link>
                      )}
                      <span>{formatDate(row.date)}</span>
                      {row.dueDate && (
                        <>
                          <span>·</span>
                          <span>Scad. {formatDate(row.dueDate)}</span>
                        </>
                      )}
                      {row.spvIndex && (
                        <>
                          <span>·</span>
                          <span className="tabular-nums">Index: {row.spvIndex}</span>
                        </>
                      )}
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${STATUS_CLS[row.status] || STATUS_CLS.pending}`}
                    >
                      {STATUS_LBL[row.status] || row.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer paginare — Apple HIG Capsule Controls */}
        <div className="px-4 py-3 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between bg-[#f8f9fc]/85 dark:bg-white/[0.02] flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs text-[#636366] dark:text-[#98989d] tabular-nums">
            <span className="flex items-center whitespace-nowrap">
              Afișează
              <Select
                value={rowsPerPage.toString()}
                onValueChange={val => {
                  setRowsPerPage(Number(val));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-7 px-2.5 text-xs apple-btn-glass w-[64px] rounded-full mx-1.5">
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
            <span className="whitespace-nowrap ml-2">
              Total înregistrări: <strong className="text-[#1d1d1f] dark:text-white font-semibold">{filtered.length}</strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#636366] dark:text-[#98989d] tabular-nums">
            <span className="whitespace-nowrap mr-1">
              Pg. <strong className="text-[#1d1d1f] dark:text-white font-semibold">{page}/{totalPages}</strong>
            </span>
            <button
              onClick={() => setPage(p => p - 1)}
              disabled={page === 1}
              aria-label="Pagina anterioară"
              className="apple-btn-glass w-8 h-8 rounded-full flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] disabled:opacity-35 transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages}
              aria-label="Pagina următoare"
              className="apple-btn-glass w-8 h-8 rounded-full flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] disabled:opacity-35 transition-all"
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
    </div>
  );
}
