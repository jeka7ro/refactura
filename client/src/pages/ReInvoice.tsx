// ReInvoice — RefacturaRO
// Core re-invoicing workflow: edit lines, set markup/unit price, select client, generate

import { useState, useEffect, useMemo } from "react";
import { Link, useParams, useLocation } from "wouter";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Percent,
  TrendingUp,
  Users,
  Check,
  Info,
  Download,
  Loader2,
  Search,
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cleanErrorMessage } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import NirSelectorModal from "@/components/NirSelectorModal";
import { InvoiceCurrencyCalculator } from "@/components/InvoiceCurrencyCalculator";
import { BnrInvoiceRateToggle } from "@/components/BnrInvoiceRateToggle";
import {
  formatCurrency,
  currencies,
  type Currency,
  type ReInvoiceLine,
} from "@/lib/store";

export default function ReInvoice() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const isMulti = id === "multiplu";
  const searchParams = new URLSearchParams(window.location.search);
  const idsParam = searchParams.get("ids");
  const parsedIds = idsParam
    ? idsParam
        .split(",")
        .map(Number)
        .filter(n => !isNaN(n))
    : [];

  const { data: singleData, isLoading: l1 } =
    trpc.invoiceArchive.getById.useQuery(
      { id: parseInt(id || "0") },
      { enabled: !isMulti && !!id && !isNaN(parseInt(id)) }
    );

  const { data: multiData, isLoading: l2 } =
    trpc.invoiceArchive.getByIds.useQuery(
      { ids: parsedIds },
      { enabled: isMulti && parsedIds.length > 0 }
    );

  const loadingInvoice = isMulti ? l2 : l1;

  const { data: currentTenantObj } = trpc.tenants.current.useQuery();
  const { data: tenantsData = [] } = trpc.tenants.list.useQuery();
  const tenant =
    currentTenantObj ||
    (tenantsData as any[])[0]?.tenants ||
    (tenantsData as any[])[0];
  const tenantSettings = useMemo(() => {
    try {
      return JSON.parse(tenant?.settings || "{}");
    } catch {
      return {};
    }
  }, [tenant]);

  // Adaptă invoice archive entry la structura așteptată
  const invoice = useMemo(() => {
    if (!isMulti) {
      if (!singleData) return null;
      return {
        id: String(singleData.id),
        number: singleData.invoiceNumber || `INV-${singleData.id}`,
        supplierName: singleData.supplierName || "",
        total: parseFloat(String(singleData.total || "0")),
        currency: (singleData.currency || "RON") as Currency,
        status: singleData.status,
        lines: (singleData.lines && Array.isArray(singleData.lines) && singleData.lines.length > 0)
          ? singleData.lines.map((l: any) => {
              const defaultVat = parseFloat(String(singleData.totalVAT || "0")) === 0 ? 0 : 21;
              const lineVat = (l.vatRate !== undefined && l.vatRate !== null && String(l.vatRate).trim() !== "")
                ? parseFloat(String(l.vatRate))
                : defaultVat;
              return { 
                ...l, 
                id: `${singleData.id}-${l.id}`,
                originalUnitPrice: parseFloat(String(l.unitPrice || "0")),
                unitPrice: parseFloat(String(l.unitPrice || "0")),
                markupPercent: 15,
                vatRate: lineVat,
              };
            })
          : [
              {
                id: `line-auto-${singleData.id}`,
                description: `Refacturare prestări / bunuri conf. ${singleData.invoiceNumber || `INV-${singleData.id}`} (${singleData.supplierName || "Furnizor"})`,
                quantity: 1,
                unitPrice: parseFloat(
                  String(
                    singleData.totalVAT
                      ? parseFloat(String(singleData.total)) -
                          parseFloat(String(singleData.totalVAT))
                      : singleData.total || "0"
                  )
                ),
                originalUnitPrice: parseFloat(
                  String(
                    singleData.totalVAT
                      ? parseFloat(String(singleData.total)) -
                          parseFloat(String(singleData.totalVAT))
                      : singleData.total || "0"
                  )
                ),
                vatRate: parseFloat(String(singleData.totalVAT || "0")) === 0 ? 0 : 21,
                unit: "servicii",
                markupPercent: 15,
              },
            ] as any[],
      };
    } else {
      if (!multiData || multiData.length === 0) return null;
      const allLines: any[] = [];
      const isRefactured = multiData.some(d => d.status === "refactured");
      multiData.forEach((d, i) => {
        if (d.lines && Array.isArray(d.lines) && d.lines.length > 0) {
          allLines.push(...d.lines.map(l => {
            const defaultVat = parseFloat(String(d.totalVAT || "0")) === 0 ? 0 : 21;
            const lineVat = (l.vatRate !== undefined && l.vatRate !== null && String(l.vatRate).trim() !== "")
              ? parseFloat(String(l.vatRate))
              : defaultVat;
            return { 
              ...l, 
              id: `${d.id}-${l.id}`,
              originalUnitPrice: parseFloat(String(l.unitPrice || "0")),
              unitPrice: parseFloat(String(l.unitPrice || "0")),
              markupPercent: 15,
              vatRate: lineVat,
            };
          }));
        } else {
          allLines.push({
            id: `line-auto-${d.id}`,
            description: `Refacturare prestări / bunuri conf. ${d.invoiceNumber || `INV-${d.id}`} (${d.supplierName || "Furnizor"})`,
            quantity: 1,
            unitPrice: parseFloat(
              String(
                d.totalVAT
                  ? parseFloat(String(d.total)) - parseFloat(String(d.totalVAT))
                  : d.total || "0"
              )
            ),
            originalUnitPrice: parseFloat(
              String(
                d.totalVAT
                  ? parseFloat(String(d.total)) - parseFloat(String(d.totalVAT))
                  : d.total || "0"
              )
            ),
            vatPercent: parseFloat(String(d.totalVAT || "0")) === 0 ? 0 : 21,
            vatRate: parseFloat(String(d.totalVAT || "0")) === 0 ? 0 : 21,
          });
        }
      });
      return {
        id: "multiplu",
        number: "Facturi Multiple",
        supplierName:
          multiData
            .map(d => d.supplierName)
            .filter(Boolean)
            .join(", ") || "Furnizori multipli",
        total: multiData.reduce(
          (acc, d) => acc + parseFloat(String(d.total || "0")),
          0
        ),
        currency: (multiData[0]?.currency || "RON") as Currency,
        status: isRefactured ? "refactured" : "pending",
        lines: allLines,
        sourceInvoiceIds: multiData.map(d => d.id),
      };
    }
  }, [singleData, multiData, isMulti]);

  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientCUI, setClientCUI] = useState("");
  const [clientRegCom, setClientRegCom] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientCity, setClientCity] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [cuiLoading, setCuiLoading] = useState(false);
  const [showAdvancedClientInfo, setShowAdvancedClientInfo] = useState(false);

  const [currency, setCurrency] = useState<Currency>("RON");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [notes, setNotes] = useState("");
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const bnrNoteMatch = useMemo(() => {
    const m = notes.match(
      /^(?:Curs BNR|Factură (?:emisă|calculată) la cursul BNR)[^\n]*/m
    );
    return m ? m[0] : null;
  }, [notes]);
  const [globalMarkup, setGlobalMarkup] = useState<number | string>(15);
  const [invoiceBnrRate, setInvoiceBnrRate] = useState<number | null>(null);

  // Local interface to allow empty strings while typing
  interface EditableLine extends Omit<
    ReInvoiceLine,
    "quantity" | "unitPrice" | "markupPercent" | "currency"
  > {
    quantity: number | string;
    unitPrice: number | string;
    markupPercent?: number | string;
    currency?: Currency | string;
    isCustom?: boolean;
    nirLineId?: number;
    devizCode?: string;
    devizType?: string;
  }
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [showNirModal, setShowNirModal] = useState(false);
  const [showCodes, setShowCodes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const consumeLineMutation = trpc.nir.consumeLine.useMutation();

  // Autocomplete
  const [generatedInvoiceId, setGeneratedInvoiceId] = useState<number | null>(
    null
  );

  // Query deviz linked to the generated invoice
  const { data: linkedDeviz } = trpc.devize.getByInvoiceId.useQuery(
    { invoiceId: generatedInvoiceId! },
    { enabled: !!generatedInvoiceId }
  );

  const [focusedLineId, setFocusedLineId] = useState<string | null>(null);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const [catalogQuery, setCatalogQuery] = useState("");
  const { data: catalogData, isLoading: catalogLoading } =
    trpc.edevize.search.useQuery(
      { query: catalogQuery || undefined, limit: 15 },
      { enabled: !!focusedLineId && catalogQuery.length > 0 }
    );

  // Load real clients from DB (strict clienți, fără furnizori)
  const { data: clientsData } = trpc.clients.list.useQuery();
  const realClients = useMemo(
    () => (clientsData ?? []).filter((c: any) => c.isSupplier !== 1),
    [clientsData]
  );

  // tRPC mutations
  const createReInvoice = trpc.reinvoice.create.useMutation();
  const downloadPDF = trpc.reinvoice.downloadPDF.useMutation();
  const utils = trpc.useUtils();

  const filteredClients = useMemo(() => {
    const q = (clientName || clientSearch || "").trim().toLowerCase();
    if (!q) return realClients.slice(0, 8);
    return realClients.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        (c.cui && c.cui.toLowerCase().includes(q))
    );
  }, [clientName, clientSearch, realClients]);

  const selectClient = (c: any) => {
    setSelectedClientId(String(c.id));
    setClientName(c.name);
    setClientSearch(c.name);
    setClientCUI(c.cui || "");
    setClientRegCom(c.regCom || "");
    setClientAddress(c.address || "");
    setClientCity(c.city || "");
    setClientEmail(c.email || "");
    setClientPhone(c.phone || "");
    setShowClientDropdown(false);
  };

  const lookupCui = async () => {
    const rawCui = clientCUI.trim();
    const cui = rawCui.replace(/^RO/i, "").replace(/\s/g, "");
    if (!cui || cui.length < 2) return;

    // Detect foreign / intracommunity CUI
    const prefixMatch = rawCui.match(/^([A-Za-z]{2})/);
    if (prefixMatch && prefixMatch[1].toUpperCase() !== "RO") {
      return;
    }

    if (!/^\d{2,10}$/.test(cui)) return;

    setCuiLoading(true);
    try {
      const res = await fetch(`/api/anaf/${cui}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "CUI negăsit în ANAF.");
        return;
      }
      const d = await res.json();
      setClientName(d.denumire || clientName);
      setClientSearch(d.denumire || clientName);
      setClientAddress(d.adresa || clientAddress);
      setClientCity(d.judet || clientCity);
      setClientRegCom(d.nrRegCom || clientRegCom);
      toast.success("Date extrase de la ANAF cu succes.");
    } catch {
      toast.error("Eroare conexiune la ANAF.");
    } finally {
      setCuiLoading(false);
    }
  };

  const lookupCuiFromSearch = async (searchTerm: string) => {
    const digits = searchTerm.replace(/[^0-9]/g, "");
    if (!digits || digits.length < 2) return;
    setCuiLoading(true);
    try {
      const res = await fetch(`/api/anaf/${digits}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "CUI negăsit în ANAF.");
        return;
      }
      const d = await res.json();
      setClientName(d.denumire || "");
      setClientSearch(d.denumire || "");
      setClientAddress(d.adresa || "");
      setClientCity(d.judet || "");
      setClientRegCom(d.nrRegCom || "");
      setClientCUI(d.cui ? `RO${d.cui}` : digits);
      setShowClientDropdown(false);
      toast.success("Date extrase din ANAF!");
    } catch {
      toast.error("Eroare conexiune la ANAF.");
    } finally {
      setCuiLoading(false);
    }
  };

  useEffect(() => {
    if (invoice) {
      setCurrency(invoice.currency);
      const due = new Date();
      due.setDate(due.getDate() + 7);
      setDueDate(due.toISOString().split("T")[0]);
      setLines(
        invoice.lines.map((l: any) => {
          const uPrice = parseFloat(String(l.unitPrice || 0));
          return {
            ...l,
            originalUnitPrice: uPrice,
            markupPercent: 15,
            unitPrice: +(uPrice * 1.15).toFixed(2),
          };
        })
      );
    }
  }, [invoice?.id]);

  if (loadingInvoice) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#6e6e73] dark:text-[#98989d]" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-8 text-center">
        <div className="text-[14px] text-[#6e6e73] dark:text-[#98989d]">
          Factura nu a fost găsită în arhivă.
        </div>
        <Link href="/facturi-primite">
          <button
            type="button"
            className="mt-4 px-5 h-10 rounded-full apple-btn-prominent text-[13.5px] font-semibold cursor-pointer"
          >
            ← Înapoi
          </button>
        </Link>
      </div>
    );
  }

  const applyGlobalMarkupToAll = () => {
    const markupVal = Number(globalMarkup) || 0;
    setLines(prev =>
      prev.map(l => ({
        ...l,
        markupPercent: markupVal,
        unitPrice: +(l.originalUnitPrice * (1 + markupVal / 100)).toFixed(2),
      }))
    );
    toast.success(`Adaos de ${markupVal}% aplicat pe toate liniile`);
  };

  const mergeToOneLine = () => {
    if (lines.length === 0) return;
    const markupVal = Number(globalMarkup) || 0;
    const totalOriginal = lines.reduce(
      (s, l) =>
        s + (Number(l.quantity) || 0) * (Number(l.originalUnitPrice) || 0),
      0
    );
    const description = invoice?.supplierName
      ? `Refacturare prestări servicii conf. ${invoice.number} (${invoice.supplierName})`
      : `Refacturare prestări servicii`;
    setLines([
      {
        id: `merged-${Date.now()}`,
        description,
        quantity: 1,
        originalUnitPrice: +totalOriginal.toFixed(2),
        unitPrice: +(totalOriginal * (1 + markupVal / 100)).toFixed(2),
        markupPercent: markupVal,
        unit: "servicii",
        vatRate: 21,
      },
    ]);
    toast.success("Toate liniile au fost unificate într-o singură linie!");
  };

  const updateLineMarkup = (lineId: string, markup: string | number) => {
    setLines(prev =>
      prev.map(l => {
        if (l.id === lineId) {
          const m = Number(markup) || 0;
          return {
            ...l,
            markupPercent: markup,
            unitPrice: +(l.originalUnitPrice * (1 + m / 100)).toFixed(2),
          };
        }
        return l;
      })
    );
  };

  const updateLinePrice = (lineId: string, price: string | number) => {
    setLines(prev =>
      prev.map(l => {
        if (l.id === lineId) {
          const p = Number(price) || 0;
          const orig = Number(l.originalUnitPrice) || 0;
          return {
            ...l,
            unitPrice: price,
            markupPercent:
              orig > 0 ? +(((p - orig) / orig) * 100).toFixed(1) : 0,
          };
        }
        return l;
      })
    );
  };

  const handleSelectFromCatalog = (lineId: string, item: any) => {
    setLines(prev =>
      prev.map(l => {
        if (l.id !== lineId) return l;
        const basePrice =
          Number(item.salePrice ?? item.pret ?? item.price ?? l.originalUnitPrice ?? 0) || 0;
        const m = Number(l.markupPercent) || 0;
        const computedPrice =
          basePrice > 0
            ? +(basePrice * (1 + m / 100)).toFixed(2)
            : Number(l.unitPrice) || 0;
        return {
          ...l,
          description: item.denumire || item.description || item.name || l.description,
          unit: item.um || item.unit || l.unit || "buc",
          originalUnitPrice: basePrice > 0 ? basePrice : l.originalUnitPrice,
          unitPrice: computedPrice,
          devizCode: item.cod || item.code || l.devizCode,
          devizType: item.tip || item.type || l.devizType,
        };
      })
    );
    setFocusedLineId(null);
  };

  const updateLineQty = (lineId: string, qty: string | number) => {
    setLines(prev =>
      prev.map(l => (l.id === lineId ? { ...l, quantity: qty } : l))
    );
  };

  const updateLine = (lineId: string, field: string, value: any) => {
    setLines(prev =>
      prev.map(l => (l.id === lineId ? { ...l, [field]: value } : l))
    );
  };

  const removeLine = (lineId: string) => {
    setLines(prev => prev.filter(l => l.id !== lineId));
  };

  const addLine = () => {
    setLines(prev => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        description: "",
        quantity: 1,
        unitPrice: 0,
        originalUnitPrice: 0,
        unit: "buc",
        vatRate: 21,
        markupPercent: 0,
      },
    ]);
  };

  const subtotal =
    Math.round(
      lines.reduce(
        (s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
        0
      ) * 100
    ) / 100;
  const totalVAT =
    Math.round(
      lines.reduce(
        (s, l) =>
          s +
          (Number(l.quantity) || 0) *
            (Number(l.unitPrice) || 0) *
            ((Number(l.vatRate) || 0) / 100),
        0
      ) * 100
    ) / 100;
  const total = Math.round((subtotal + totalVAT) * 100) / 100;
  const originalTotal = invoice?.total || 0;
  const margin =
    Math.round(
      (subtotal -
        (invoice?.lines.reduce(
          (s: number, l: any) => s + Number(l.quantity) * Number(l.unitPrice),
          0
        ) || 0)) *
        100
    ) / 100;

  const handleSave = async (asDraft: boolean) => {
    if (!selectedClientId && !clientName.trim()) {
      toast.error("Selectează un client", {
        description: "Este necesar un client pentru re-facturare",
      });
      return;
    }
    if (lines.length === 0) {
      toast.error("Nu există linii", {
        description: "Adaugă cel puțin o linie pentru re-factură",
      });
      return;
    }
    setSaving(true);
    try {
      const client = selectedClientId
        ? realClients.find(c => String(c.id) === selectedClientId)
        : null;
      if (selectedClientId && !client && !clientName.trim()) {
        toast.error("Clientul selectat nu a fost găsit");
        return;
      }
      const today = new Date().toISOString().split("T")[0];
      const result = await createReInvoice.mutateAsync({
        sourceInvoiceId: invoice?.id !== "multiplu" ? invoice?.id : undefined,
        sourceInvoiceIds:
          isMulti && invoice && (invoice as any).sourceInvoiceIds
            ? (invoice as any).sourceInvoiceIds
            : undefined,
        sourceInvoiceNumber: invoice?.number,
        sourceSupplierName: invoice?.supplierName,
        clientId: selectedClientId ? parseInt(selectedClientId) : undefined,
        clientName: clientName || client?.name || "",
        clientCUI: clientCUI || client?.cui || undefined,
        clientAddress: clientAddress || client?.address || undefined,
        clientCity: clientCity || client?.city || undefined,
        clientEmail: clientEmail || client?.email || undefined,
        clientPhone: clientPhone || client?.phone || undefined,
        issueDate: today,
        dueDate: dueDate || undefined,
        subtotal,
        totalVAT,
        total,
        currency,
        status: asDraft ? "draft" : "sent",
        notes: notes || undefined,
        lines: lines.map((l, idx) => ({
          description: l.description,
          quantity: Number(l.quantity) || 0,
          originalUnitPrice: Number(l.originalUnitPrice) || 0,
          unitPrice: Number(l.unitPrice) || 0,
          unit: l.unit,
          vatRate: Number(l.vatRate) || 0,
          markupPercent: Number(l.markupPercent) || 0,
          total:
            Math.round(
              (Number(l.quantity) || 0) *
                (Number(l.unitPrice) || 0) *
                (1 + (Number(l.vatRate) || 0) / 100) *
                100
            ) / 100,
          lineOrder: idx,
        })),
      });

      const stockLines = lines
        .filter(l => l.nirLineId)
        .map(l => ({ nirLineId: l.nirLineId!, qty: Number(l.quantity) || 0 }))
        .filter(l => l.qty > 0);

      let stockFailed = false;
      if (stockLines.length > 0) {
        try {
          await consumeLineMutation.mutateAsync({ lines: stockLines });
        } catch (stockErr) {
          console.error("Failed to consume stock", stockErr);
          stockFailed = true;
        }
      }

      await utils.reinvoice.list.invalidate();
      if (stockFailed) {
        toast.warning("Re-factura a fost salvată, dar scăderea din stocul NIR a întâmpinat o eroare.");
      } else {
        toast.success(asDraft ? "Ciornă salvată" : "Re-factură generată!", {
          description: asDraft
            ? `Ciornă ${result.number} salvată. Poți continua editarea mai târziu.`
            : `Re-factura ${result.number} a fost creată cu succes.`,
        });
      }
      navigate("/re-facturi");
    } catch (err: any) {
      toast.error("Eroare la salvare", {
        description: cleanErrorMessage(err, "A apărut o eroare neașteptată"),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!clientName.trim()) {
      toast.error("Numele clientului este obligatoriu!");
      return;
    }
    if (lines.length === 0) {
      toast.error("Nu există linii de facturat!");
      return;
    }

    setSaving(true);
    toast.loading("Se generează Re-Factura...", { id: "save" });

    try {
      const payload: any = {
        clientId: selectedClientId ? parseInt(selectedClientId) : undefined,
        clientName: clientName,
        clientCUI: clientCUI || undefined,
        clientAddress: clientAddress || undefined,
        clientCity: clientCity || undefined,
        clientEmail: clientEmail || undefined,
        clientPhone: clientPhone || undefined,
        currency,
        dueDate,
        notes,
        lines: lines.map(l => ({
          description: l.description,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          markupPercent: Number(l.markupPercent || 0),
          originalUnitPrice: Number(l.originalUnitPrice),
          vatRate: Number((l as any).vatRate ?? ((l as any).vatPercent ?? 21)),
          vatPercent: Number((l as any).vatRate ?? ((l as any).vatPercent ?? 21)),
          devizType: (l as any).devizType,
          devizCode: (l as any).devizCode,
        })),
      };

      if (isMulti && invoice && (invoice as any).sourceInvoiceIds) {
        payload.sourceInvoiceIds = (invoice as any).sourceInvoiceIds;
      } else if (invoice?.id !== "multiplu") {
        payload.sourceInvoiceId = parseInt(invoice?.id || "0");
      }

      const res = await createReInvoice.mutateAsync(payload);
      
      // Consume stock for items added from NIR
      const stockLines = lines
        .filter((l: any) => l.nirLineId)
        .map((l: any) => ({ nirLineId: l.nirLineId, qty: Number(l.quantity) }));
      
      if (stockLines.length > 0) {
        try {
          await consumeLineMutation.mutateAsync({ lines: stockLines });
        } catch (e) {
          console.error("Failed to consume stock", e);
          toast.warning("Re-factura a fost generată, dar scăderea din stocul NIR a întâmpinat o eroare.");
        }
      }

      toast.success("Re-Factură generată cu succes!", { id: "save" });
      navigate(`/re-facturi/${res.id}`);
    } catch (e: any) {
      toast.error("Eroare la salvare: " + cleanErrorMessage(e), { id: "save" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-5 pb-20 overflow-x-hidden">
      {invoice.status === "refactured" && (
        <div className="apple-surface border-amber-500/30 dark:border-amber-500/30 p-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-amber-500"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="text-[13px] text-amber-800 dark:text-amber-300 font-semibold">
                Atenție: Această factură a mai fost re-facturată anterior!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/facturi-primite/${invoice.id}`}>
            <button
              type="button"
              className="flex items-center justify-center w-8 h-8 rounded-full apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7] transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
              Re-Facturare
            </h1>
            <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums truncate">
              Bazat pe: <span>{invoice.number}</span> —{" "}
              {invoice.supplierName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={async () => {
              if (!selectedClientId) {
                toast.error("Selectează un client", {
                  description: "Este necesar un client pentru descărcare PDF",
                });
                return;
              }
              setDownloadingPDF(true);
              try {
                const client = realClients.find(
                  c => String(c.id) === selectedClientId
                );
                if (!client) {
                  toast.error("Clientul selectat nu a fost găsit.");
                  return;
                }

                const pdfSubtotal =
                  Math.round(
                    lines.reduce(
                      (s, l) =>
                        s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
                      0
                    ) * 100
                  ) / 100;
                const pdfTotalVAT =
                  Math.round(
                    lines.reduce(
                      (s, l) =>
                        s +
                        (Number(l.quantity) || 0) *
                          (Number(l.unitPrice) || 0) *
                          ((Number(l.vatRate) || 0) / 100),
                      0
                    ) * 100
                  ) / 100;
                const pdfTotal = Math.round((pdfSubtotal + pdfTotalVAT) * 100) / 100;

                const pdfRes: any = await downloadPDF.mutateAsync({
                  number: `RF-${new Date().getFullYear()}-0001`,
                  date: new Date().toISOString().split("T")[0],
                  dueDate,
                  clientName: client.name,
                  clientCUI: client.cui ?? "",
                  clientAddress: client.address ?? "",
                  clientCity: client.city ?? "",
                  clientCounty: "",
                  clientEmail: client.email ?? "",
                  clientPhone: client.phone ?? "",
                  companyName: tenant?.name || "",
                  companyCUI: tenant?.cui || "",
                  companyAddress: tenant?.address || "",
                  companyCity: tenantSettings.city || "",
                  companyCounty: tenantSettings.county || "",
                  companyEmail: tenant?.email || "",
                  companyPhone: tenant?.phone || "",
                  companyIBAN: tenantSettings.iban || "",
                  companyBank: tenantSettings.bank || "",
                  logoBase64: tenantSettings.logoBase64 || undefined,
                  logoHasBackground: Boolean(tenantSettings.logoHasBackground),
                  logoBgColor: tenantSettings.logoBgColor || "#0f172a",
                  themeColor:
                    tenantSettings.themeColor ||
                    (tenantSettings.theme &&
                      ({
                        blue: "#2563eb",
                        teal: "#0d9488",
                        green: "#16a34a",
                        rose: "#e11d48",
                        violet: "#7c3aed",
                        navy: "#003366",
                      } as Record<string, string>)[tenantSettings.theme]) ||
                    "#2563eb",
                  template:
                    (localStorage.getItem("invoice-template") as any) ||
                    "classic",
                  lines: lines.map(l => ({
                    description: l.description,
                    quantity: Number(l.quantity) || 0,
                    unitPrice: Number(l.unitPrice) || 0,
                    unit: l.unit || "buc",
                    vatRate: Number(l.vatRate) || 0,
                    total:
                      Math.round(
                        (Number(l.quantity) || 0) *
                          (Number(l.unitPrice) || 0) *
                          (1 + (Number(l.vatRate) || 0) / 100) *
                          100
                      ) / 100,
                  })),
                  subtotal: pdfSubtotal,
                  totalVAT: pdfTotalVAT,
                  total: pdfTotal,
                  currency,
                  notes,
                });

                if (pdfRes?.pdfBase64) {
                  const byteCharacters = atob(pdfRes.pdfBase64);
                  const byteNumbers = new Uint8Array(byteCharacters.length);
                  for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                  }
                  const blob = new Blob([byteNumbers], { type: "application/pdf" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = pdfRes.filename || `RF-${new Date().getFullYear()}-0001.pdf`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }
                toast.success("PDF descărcat cu succes!");
              } catch (error) {
                toast.error(cleanErrorMessage(error, "Eroare la descărcarea PDF"));
              } finally {
                setDownloadingPDF(false);
              }
            }}
            disabled={downloadingPDF}
            className="flex items-center gap-1.5 px-3.5 h-8.5 rounded-full apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-medium transition-colors disabled:opacity-60 cursor-pointer"
          >
            {downloadingPDF ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Descarcă PDF
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving}
            className="px-3.5 h-8.5 rounded-full apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-medium transition-colors disabled:opacity-60 cursor-pointer"
          >
            Salvează ciornă
          </button>
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 h-8.5 rounded-full apple-btn-prominent text-[12.5px] font-semibold transition-all active:scale-[0.97] disabled:opacity-60 cursor-pointer"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            Generează Re-Factură
          </button>
        </div>
      </div>

      {/* Warning banner */}
      {invoice?.status === "refactured" && (
        <div className="apple-surface border-amber-500/30 dark:border-amber-500/30 p-4 flex gap-3 items-start">
          <div className="w-8 h-8 rounded-xl bg-amber-500/12 dark:bg-amber-500/18 flex items-center justify-center shrink-0">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
              Atenție: Factură deja re-facturată
            </h3>
            <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 leading-relaxed">
              Aceste documente au mai fost re-facturate anterior. Continuarea va
              crea o nouă re-factură. Poți ignora acest mesaj dacă știi ce faci.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {/* Top: Lines editor */}
        <div className="w-full space-y-4">
          {/* Global markup */}
          <div className="apple-surface px-4 py-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-[#6e6e73] dark:text-[#98989d]" />
                <span className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Adaos global:
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={globalMarkup}
                  onChange={e => setGlobalMarkup(e.target.value)}
                  className="w-20 h-8.5 px-3 text-[16px] sm:text-[13px] tabular-nums rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none focus:border-[#0071e3] text-center transition-colors"
                  min={0}
                  max={500}
                />
                <span className="text-[13px] text-[#6e6e73] dark:text-[#98989d] font-semibold">
                  %
                </span>
              </div>
              <button
                type="button"
                onClick={applyGlobalMarkupToAll}
                className="px-4 h-8.5 rounded-full apple-btn-prominent text-[12.5px] font-semibold transition-all active:scale-[0.97] cursor-pointer"
              >
                Aplică pe toate liniile
              </button>
              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={mergeToOneLine}
                  className="px-3.5 h-8.5 rounded-full apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-medium transition-all active:scale-[0.97] flex items-center gap-1.5 cursor-pointer"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Unifică în 1 linie
                </button>
              )}
              <div className="flex items-center gap-1.5 text-[12px] text-[#6e6e73] dark:text-[#98989d] ml-auto">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span>Poți edita și individual fiecare linie</span>
              </div>
            </div>
          </div>

          {/* Lines table */}
          <div className="apple-surface !overflow-visible flex flex-col">
            <div className="p-3.5 sm:px-4 bg-[#fafafa] dark:bg-white/[0.025] rounded-t-[16px] border-b border-black/[0.05] dark:border-white/[0.07] flex justify-between items-center flex-wrap gap-2">
              <h3 className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Linii re-factură
              </h3>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowCodes(!showCodes)}
                  className="flex items-center gap-1.5 px-3.5 h-8 rounded-full apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-medium transition-colors cursor-pointer"
                >
                  <Info className="w-3.5 h-3.5" />
                  {showCodes ? "Ascunde coduri" : "Arată coduri"}
                </button>
                <button
                  type="button"
                  onClick={addLine}
                  className="flex items-center gap-1.5 px-3.5 h-8 rounded-full apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-medium transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adaugă linie
                </button>
              </div>
            </div>

            {/* Header Tabel */}
            <div className="hidden md:grid grid-cols-12 gap-0 bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07] text-[#6e6e73] dark:text-[#98989d] text-[12px] font-medium">
              {showCodes ? (
                <>
                  <div className="col-span-1 px-3 py-2.5">Cod</div>
                  <div className="col-span-3 px-3 py-2.5 border-l border-black/[0.05] dark:border-white/[0.07]">
                    Denumire serviciu
                  </div>
                </>
              ) : (
                <div className="col-span-4 px-3 py-2.5">Denumire serviciu</div>
              )}
              <div className="col-span-1 px-2 py-2.5 text-center border-l border-black/[0.05] dark:border-white/[0.07]">
                U.M.
              </div>
              <div className="col-span-1 px-2 py-2.5 text-center border-l border-black/[0.05] dark:border-white/[0.07]">
                Cant.
              </div>
              <div className="col-span-2 px-2 py-2.5 text-right border-l border-black/[0.05] dark:border-white/[0.07]">
                Preț orig.
              </div>
              <div className="col-span-1 px-2 py-2.5 text-center border-l border-black/[0.05] dark:border-white/[0.07]">
                Adaos %
              </div>
              <div className="col-span-1 px-2 py-2.5 text-right border-l border-black/[0.05] dark:border-white/[0.07]">
                Preț nou
              </div>
              <div className="col-span-1 px-2 py-2.5 text-right border-l border-black/[0.05] dark:border-white/[0.07]">
                Total
              </div>
              <div className="col-span-1"></div>
            </div>

            {/* Continut Tabel */}
            <div className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
              {lines.map(line => {
                const qty = Number(line.quantity) || 0;
                const uPrice = Number(line.unitPrice) || 0;
                const lineTotal = qty * uPrice;
                const lineClass = (line as any).isCustom
                  ? "bg-amber-500/[0.04] dark:bg-amber-500/[0.08]"
                  : "";

                return (
                  <div
                    key={line.id}
                    className={`grid grid-cols-2 sm:grid-cols-4 md:grid-cols-12 gap-3 md:gap-0 items-start md:items-center hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors p-4 md:p-0 border-b border-black/[0.045] dark:border-white/[0.06] md:border-b-0 ${lineClass}`}
                  >
                    {showCodes && (
                      <div className="col-span-2 sm:col-span-4 md:col-span-1 px-0 md:px-2 py-1 md:py-2 h-full flex flex-col md:flex-row md:items-center">
                        <label className="md:hidden text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">Cod</label>
                        <input
                          type="text"
                          placeholder="Cod..."
                          value={(line as any).devizCode || ""}
                          onChange={e =>
                            updateLine(
                              line.id,
                              "devizCode" as any,
                              e.target.value
                            )
                          }
                          className="w-full h-8 px-2 text-[16px] md:text-[12.5px] border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] rounded-xl text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] focus:outline-none focus:border-[#0071e3] tabular-nums transition-colors"
                        />
                      </div>
                    )}
                    <div
                      className={`px-0 md:px-2 py-1 md:py-2 relative h-full flex flex-col justify-center col-span-2 sm:col-span-4 ${showCodes ? "md:col-span-3 md:border-l border-black/[0.045] dark:border-white/[0.06]" : "md:col-span-4"}`}
                    >
                      <label className="md:hidden text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">Denumire serviciu</label>
                      <input
                        type="text"
                        placeholder="Descriere..."
                        value={line.description}
                        onChange={e => {
                          updateLine(line.id, "description", e.target.value);
                          setCatalogQuery(e.target.value);
                        }}
                        onFocus={e => {
                          setFocusedLineId(line.id);
                          const isDefault = line.description === "";
                          setCatalogQuery(isDefault ? "" : line.description);
                          e.target.select();
                        }}
                        onBlur={() =>
                          setTimeout(() => setFocusedLineId(null), 200)
                        }
                        className="w-full h-8 px-2.5 text-[16px] md:text-[12.5px] border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] rounded-xl text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] focus:outline-none focus:border-[#0071e3] transition-colors"
                      />
                      {focusedLineId === line.id &&
                        catalogQuery.trim().length > 0 && (
                          <div className="absolute top-11 left-2 right-2 z-50 bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] rounded-2xl shadow-xl max-h-64 overflow-y-auto">
                            {catalogLoading ? (
                              <div className="p-4 flex justify-center">
                                <Loader2 className="w-4 h-4 animate-spin text-[#6e6e73]" />
                              </div>
                            ) : catalogData?.items?.length === 0 ? (
                              <div className="p-4 text-[12.5px] text-[#6e6e73] dark:text-[#98989d] text-center">
                                Niciun rezultat în catalog.
                              </div>
                            ) : (
                              catalogData?.items?.map(
                                (item: any, i: number) => (
                                  <button
                                    key={i}
                                    type="button"
                                    onMouseDown={e => {
                                      e.preventDefault();
                                      handleSelectFromCatalog(line.id, item);
                                    }}
                                    className="apple-card-btn w-full text-left px-3.5 py-2 hover:bg-[#f2f2f7] dark:hover:bg-[#2c2c2e] border-b border-black/[0.045] dark:border-white/[0.06] last:border-0 transition-colors cursor-pointer"
                                  >
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#98989d] border border-black/[0.06] dark:border-white/[0.08]">
                                        {item.tip}
                                      </span>
                                      <span className="text-xs tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                                        {item.cod}
                                      </span>
                                    </div>
                                    <div className="text-[12.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] line-clamp-2 leading-tight">
                                      {item.denumire}
                                    </div>
                                  </button>
                                )
                              )
                            )}
                          </div>
                        )}
                    </div>
                    <div className="col-span-1 md:col-span-1 px-0 md:px-1.5 py-1 md:py-2 md:border-l border-black/[0.045] dark:border-white/[0.06] h-full flex flex-col justify-center">
                      <label className="md:hidden text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">U.M.</label>
                      <input
                        value={line.unit}
                        onChange={e =>
                          updateLine(line.id, "unit", e.target.value)
                        }
                        className="w-full text-center text-[16px] md:text-[12.5px] bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.08] rounded-xl h-8 text-[#1d1d1f] dark:text-[#f5f5f7] focus:outline-none focus:border-[#0071e3] transition-colors"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-1 px-0 md:px-1.5 py-1 md:py-2 md:border-l border-black/[0.045] dark:border-white/[0.06] h-full flex flex-col justify-center">
                      <label className="md:hidden text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">Cant.</label>
                      <input
                        type="number"
                        value={line.quantity}
                        onChange={e =>
                          updateLine(line.id, "quantity", e.target.value)
                        }
                        className="w-full text-center text-[16px] md:text-[12.5px] tabular-nums bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.08] rounded-xl h-8 text-[#1d1d1f] dark:text-[#f5f5f7] focus:outline-none focus:border-[#0071e3] transition-colors"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2 px-0 md:px-2 py-1 md:py-2 md:border-l border-black/[0.045] dark:border-white/[0.06] h-full flex flex-col justify-center md:items-end text-[12.5px] text-[#6e6e73] dark:text-[#98989d] tabular-nums">
                      <label className="md:hidden text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">Preț orig.</label>
                      <span className="mt-1 md:mt-0">{formatCurrency(line.originalUnitPrice, currency)}</span>
                    </div>
                    <div className="col-span-1 md:col-span-1 px-0 md:px-1.5 py-1 md:py-2 md:border-l border-black/[0.045] dark:border-white/[0.06] h-full flex flex-col justify-center">
                      <label className="md:hidden text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">Adaos %</label>
                      <input
                        type="number"
                        value={line.markupPercent}
                        onChange={e =>
                          updateLineMarkup(line.id, e.target.value)
                        }
                        className="w-full text-center text-[16px] md:text-[12.5px] tabular-nums bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.08] rounded-xl h-8 focus:outline-none focus:border-[#0071e3] text-amber-600 dark:text-amber-400 font-semibold transition-colors"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-1 px-0 md:px-1.5 py-1 md:py-2 md:border-l border-black/[0.045] dark:border-white/[0.06] h-full flex flex-col justify-center">
                      <label className="md:hidden text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">Preț nou</label>
                      <input
                        type="number"
                        value={line.unitPrice}
                        onChange={e =>
                          updateLinePrice(line.id, e.target.value)
                        }
                        className="w-full md:text-right text-[16px] md:text-[12.5px] tabular-nums bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.08] rounded-xl h-8 px-2 focus:outline-none focus:border-[#0071e3] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] transition-colors"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-1 px-0 md:px-2 py-1 md:py-2 md:border-l border-black/[0.045] dark:border-white/[0.06] h-full flex flex-col justify-center md:items-end tabular-nums">
                      <label className="md:hidden text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">Total</label>
                      <span className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mt-1 md:mt-0">{formatCurrency(lineTotal, currency)}</span>
                    </div>
                    <div className="col-span-2 md:col-span-1 px-0 md:px-1 py-1 md:py-2 md:border-l border-black/[0.045] dark:border-white/[0.06] flex items-end md:items-center justify-end md:justify-center">
                      <button
                        type="button"
                        onClick={() => removeLine(line.id)}
                        aria-label="Șterge linia"
                        className="w-8 h-8 md:w-7 md:h-7 flex items-center justify-center rounded-full text-[#8e8e93] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/12 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 md:w-3.5 md:h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3.5 bg-[#fafafa] dark:bg-white/[0.02] rounded-b-[16px] border-t border-black/[0.05] dark:border-white/[0.07] flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setLines([
                    ...lines,
                    {
                      id: `custom-${Date.now()}`,
                      description: "",
                      quantity: 1,
                      originalUnitPrice: 0,
                      unitPrice: 0,
                      markupPercent: 0,
                      unit: "buc",
                      vatRate: 21,
                      isCustom: true,
                    },
                  ]);
                }}
                className="flex items-center gap-1.5 px-3.5 h-8 text-[12.5px] font-medium apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7] rounded-full transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Adaugă rând
              </button>
              <button
                type="button"
                onClick={() => setShowNirModal(true)}
                className="flex items-center gap-1.5 px-3.5 h-8 text-[12.5px] font-medium apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7] rounded-full transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Adaugă din Stoc
              </button>
            </div>

            {bnrNoteMatch && (
              <div className="mx-3.5 mb-3.5 p-3 rounded-xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.05] dark:border-white/[0.07] text-xs max-w-xl">
                <p className="tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] leading-relaxed font-medium text-[12px]">
                  {bnrNoteMatch}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom: Config panels */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
          {/* Client selector */}
          <div className="md:col-span-2 apple-surface !overflow-visible p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-[#6e6e73] dark:text-[#98989d]" />
              <span className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Client final
              </span>
            </div>

            <div className="space-y-4">
              <div className="relative mb-4">
                <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1.5">
                  Nume sau cod fiscal client *
                </label>
                <input
                  type="text"
                  placeholder="Nume, CUI sau caută în ANAF..."
                  value={clientName}
                  onChange={e => {
                    setClientName(e.target.value);
                    setClientSearch(e.target.value);
                    setSelectedClientId("");
                    setShowClientDropdown(true);
                  }}
                  onFocus={() => setShowClientDropdown(true)}
                  onBlur={() =>
                    setTimeout(() => setShowClientDropdown(false), 200)
                  }
                  className="w-full h-9 px-3 text-[16px] sm:text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none focus:border-[#0071e3] transition-colors"
                />
                {showClientDropdown && (
                  <div className="absolute z-20 w-full mt-1.5 bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] rounded-2xl shadow-xl max-h-64 overflow-y-auto">
                    {filteredClients.length > 0 &&
                      filteredClients.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={() => selectClient(c)}
                          className="apple-card-btn w-full text-left px-3.5 py-2.5 hover:bg-[#f2f2f7] dark:hover:bg-[#2c2c2e] text-[13px] border-b border-black/[0.045] dark:border-white/[0.06] last:border-0 transition-colors cursor-pointer"
                        >
                          <div className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                            {c.name}
                          </div>
                          {c.cui && (
                            <div className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] tabular-nums">
                              CUI: {c.cui}
                            </div>
                          )}
                        </button>
                      ))}
                    {(clientName || clientSearch).replace(/[^0-9]/g, "").length >= 2 && (
                      <button
                        type="button"
                        onMouseDown={e => {
                          e.preventDefault();
                          lookupCuiFromSearch(clientName || clientSearch);
                        }}
                        className="apple-card-btn w-full flex items-center gap-2 px-3.5 py-2.5 bg-[#0071e3]/10 hover:bg-[#0071e3]/15 text-[#0071e3] dark:text-[#409cff] text-[13px] font-semibold transition-colors cursor-pointer"
                      >
                        <Search className="w-4 h-4" />
                        <span>
                          Caută CUI "{(clientName || clientSearch).replace(/[^0-9]/g, "")}" în
                          ANAF
                        </span>
                        {cuiLoading && (
                          <Loader2 className="w-4 h-4 animate-spin ml-auto" />
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedClientInfo(!showAdvancedClientInfo)}
                  className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#0071e3] dark:text-[#409cff] hover:opacity-80 transition-opacity cursor-pointer"
                >
                  {showAdvancedClientInfo ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {showAdvancedClientInfo ? "Ascunde informații opționale client" : "Arată informații opționale client (CUI, adresă, etc.)"}
                </button>
              </div>

              {showAdvancedClientInfo && (
                <div className="pt-4 border-t border-black/[0.05] dark:border-white/[0.07] space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1.5">
                        CUI / CIF{" "}
                        {cuiLoading && (
                          <Loader2 className="w-3 h-3 ml-1 inline animate-spin" />
                        )}
                      </label>
                      <input
                        value={clientCUI}
                        onChange={e => setClientCUI(e.target.value)}
                        onBlur={lookupCui}
                        className="w-full h-9 px-3 text-[16px] sm:text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none focus:border-[#0071e3] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1.5">
                        Reg. Com.
                      </label>
                      <input
                        value={clientRegCom}
                        onChange={e => setClientRegCom(e.target.value)}
                        className="w-full h-9 px-3 text-[16px] sm:text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none focus:border-[#0071e3] transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1.5">
                        Telefon client
                      </label>
                      <input
                        value={clientPhone}
                        onChange={e => setClientPhone(e.target.value)}
                        className="w-full h-9 px-3 text-[16px] sm:text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none focus:border-[#0071e3] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1.5">
                        Email
                      </label>
                      <input
                        value={clientEmail}
                        onChange={e => setClientEmail(e.target.value)}
                        className="w-full h-9 px-3 text-[16px] sm:text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none focus:border-[#0071e3] transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                    <div className="sm:col-span-8">
                      <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1.5">
                        Adresă
                      </label>
                      <input
                        value={clientAddress}
                        onChange={e => setClientAddress(e.target.value)}
                        className="w-full h-9 px-3 text-[16px] sm:text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none focus:border-[#0071e3] transition-colors"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1.5">
                        Localitate
                      </label>
                      <input
                        value={clientCity}
                        onChange={e => setClientCity(e.target.value)}
                        className="w-full h-9 px-3 text-[16px] sm:text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none focus:border-[#0071e3] transition-colors"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Invoice settings */}
          <div className="apple-surface p-5 space-y-4">
            <span className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] block">
              Setări re-factură
            </span>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                  Monedă
                </label>
                <InvoiceCurrencyCalculator
                  currentCurrency={currency}
                  activeExchangeRate={invoiceBnrRate || undefined}
                  issueDate={today}
                  lines={lines.map((l, idx) => ({
                    id: String(l.id),
                    description: l.description || `Linia ${idx + 1}`,
                    unitPrice: l.unitPrice,
                  }))}
                  onSelectCurrency={c => {
                    setCurrency(c as Currency);
                    toast(`Moneda facturii a fost comutată în ${c}`);
                  }}
                  onApplyPrice={(price, lineId) => {
                    setLines(prev => {
                      if (!prev || prev.length === 0) return prev;
                      if (lineId === "__ALL__") {
                        return prev.map(l => ({ ...l, unitPrice: price }));
                      }
                      const targetIdx = lineId ? prev.findIndex(l => String(l.id) === String(lineId)) : 0;
                      const finalIdx = targetIdx >= 0 ? targetIdx : 0;
                      return prev.map((l, idx) => (idx === finalIdx ? { ...l, unitPrice: price } : l));
                    });
                    toast.success(
                      lineId === "__ALL__"
                        ? `Preț ${price.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency} aplicat pe toate liniile`
                        : `Preț ${price.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency} aplicat`
                    );
                  }}
                />
              </div>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value as Currency)}
                className="w-full h-9 px-3 text-[16px] sm:text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none focus:border-[#0071e3] cursor-pointer transition-colors"
              >
                {currencies.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1.5">
                Scadență
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full h-9 px-3 text-[16px] sm:text-[13px] tabular-nums rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none focus:border-[#0071e3] transition-colors"
              />
            </div>

            {/* Opțiune Curs Valutar BNR din data emiterii */}
            <BnrInvoiceRateToggle
              currency={currency}
              issueDate={today}
              total={total}
              totalVAT={totalVAT}
              notes={notes}
              onNotesChange={setNotes}
              onRateChange={(rate) => setInvoiceBnrRate(rate)}
            />

            <div>
              <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1.5">
                Observații
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Mențiuni, condiții de plată..."
                className="w-full px-3.5 py-2.5 text-[16px] sm:text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none focus:border-[#0071e3] resize-none transition-colors"
              />
            </div>
          </div>

          {/* Summary */}
          <div className="apple-surface p-5 tabular-nums">
            <span className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] block mb-4">
              Sumar
            </span>
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between text-[#6e6e73] dark:text-[#98989d]">
                <span>Cost original (fără TVA):</span>
                <span className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                  {formatCurrency(
                    invoice.lines.reduce(
                      (s: number, l: any) => s + l.quantity * l.unitPrice,
                      0
                    ),
                    invoice.currency
                  )}
                </span>
              </div>
              <div className="flex justify-between text-[#6e6e73] dark:text-[#98989d]">
                <span>Subtotal re-factură:</span>
                <span className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">{formatCurrency(subtotal, currency)}</span>
              </div>
              <div className="flex justify-between text-[#6e6e73] dark:text-[#98989d]">
                <span>TVA ({lines[0]?.vatRate ?? 21}%):</span>
                <span className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">{formatCurrency(totalVAT, currency)}</span>
              </div>
              <div className="flex justify-between text-[15px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] border-t border-black/[0.06] dark:border-white/[0.08] pt-2.5 mt-2">
                <span>Total cu TVA:</span>
                <span className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                  {formatCurrency(total, currency)}
                </span>
              </div>
            </div>
            {/* Margin highlight */}
            <div
              className={`mt-4 p-3 rounded-xl flex items-center justify-between ${
                margin >= 0
                  ? "bg-emerald-500/[0.08] dark:bg-emerald-500/[0.14] border border-emerald-500/20"
                  : "bg-rose-500/[0.08] dark:bg-rose-500/[0.14] border border-rose-500/20"
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp
                  className={`w-4 h-4 ${margin >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
                />
                <span
                  className={`text-[12.5px] font-semibold ${margin >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}
                >
                  Adaos comercial
                </span>
              </div>
              <div className="text-right">
                <div
                  className={`text-[13.5px] font-bold ${margin >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}
                >
                  {margin >= 0 ? "+" : ""}
                  {formatCurrency(margin, currency)}
                </div>
                <div
                  className={`text-[11px] ${margin >= 0 ? "text-emerald-600 dark:text-emerald-400/80" : "text-rose-600 dark:text-rose-400/80"}`}
                >
                  {invoice.lines.reduce(
                    (s: number, l: any) => s + l.quantity * l.unitPrice,
                    0
                  ) > 0
                    ? `${((margin / invoice.lines.reduce((s: number, l: any) => s + l.quantity * l.unitPrice, 0)) * 100).toFixed(1)}% marjă`
                    : ""}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showNirModal && (
        <NirSelectorModal
          onClose={() => setShowNirModal(false)}
          onAdd={(selected) => {
            const newLines: EditableLine[] = selected.map(s => ({
              id: crypto.randomUUID(),
              description: s.description,
              quantity: s.quantity,
              unit: s.unit,
              originalUnitPrice: s.unitPrice,
              unitPrice: s.unitPrice,
              markupPercent: 0,
              vatRate: s.vatRate || 21,
              isCustom: true,
              nirLineId: s.nirLineId,
            }));
            setLines(prev => {
              const hasOnlyDefault =
                prev.length === 1 &&
                !prev[0].description &&
                !parseFloat(String(prev[0].unitPrice));
              return hasOnlyDefault ? newLines : [...prev, ...newLines];
            });
            setShowNirModal(false);
          }}
        />
      )}
    </div>
  );
}
