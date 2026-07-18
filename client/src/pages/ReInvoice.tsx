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
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
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

  const { data: tenantsData = [] } = trpc.tenants.list.useQuery();
  const tenantObj = tenantsData[0];
  const tenant = tenantObj?.tenants;
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
        lines: [
          {
            id: "line-auto-1",
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
            vatRate: 21,
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
          allLines.push(...d.lines.map(l => ({ ...l, id: `${d.id}-${l.id}` })));
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
            vatPercent: 21,
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
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [globalMarkup, setGlobalMarkup] = useState<number | string>(15);

  // Local interface to allow empty strings while typing
  interface EditableLine extends Omit<
    ReInvoiceLine,
    "quantity" | "unitPrice" | "markupPercent" | "currency"
  > {
    quantity: number | string;
    unitPrice: number | string;
    markupPercent?: number | string;
    currency?: string;
    isCustom?: boolean;
  }
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [showCodes, setShowCodes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

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

  // Load real clients from DB
  const { data: clientsData } = trpc.clients.list.useQuery();
  const realClients = clientsData ?? [];

  // tRPC mutations
  const createReInvoice = trpc.reinvoice.create.useMutation();
  const downloadPDF = trpc.reinvoice.downloadPDF.useMutation();
  const utils = trpc.useUtils();

  const filteredClients = useMemo(() => {
    if (!clientSearch) return realClients;
    const lower = clientSearch.toLowerCase();
    return realClients.filter(
      c =>
        c.name.toLowerCase().includes(lower) ||
        (c.cui && c.cui.toLowerCase().includes(lower))
    );
  }, [clientSearch, realClients]);

  const selectClient = (c: any) => {
    setSelectedClientId(String(c.id));
    setClientName(c.name);
    setClientCUI(c.cui || "");
    setClientRegCom(c.regCom || "");
    setClientAddress(c.address || "");
    setClientCity(c.city || "");
    setClientEmail(c.email || "");
    setClientPhone(c.phone || "");
    setShowClientDropdown(false);
    setClientSearch("");
  };

  const lookupCui = async () => {
    const cui = clientCUI.replace(/^RO/i, "").replace(/\s/g, "");
    if (!cui || cui.length < 2) return;
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
    const cui = searchTerm.replace(/^RO/i, "").replace(/\s/g, "");
    if (!cui || cui.length < 2) return;
    setCuiLoading(true);
    try {
      const res = await fetch(`/api/anaf/${cui}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "CUI negăsit în ANAF.");
        return;
      }
      const d = await res.json();
      setClientName(d.denumire || "");
      setClientAddress(d.adresa || "");
      setClientCity(d.judet || "");
      setClientRegCom(d.nrRegCom || "");
      setClientCUI(d.cui ? `RO${d.cui}` : cui);
      setClientSearch(d.denumire || "");
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
      due.setDate(due.getDate() + 30);
      setDueDate(due.toISOString().split("T")[0]);
      setLines(
        invoice.lines.map(l => {
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
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-8 text-center">
        <div className="text-slate-500">
          Factura nu a fost găsită în arhivă.
        </div>
        <Link href="/facturi-primite">
          <button className="mt-4 px-5 h-10 rounded-lg bg-blue-600 text-white text-sm font-bold">
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
          return {
            ...l,
            unitPrice: price,
            markupPercent: +(
              ((p - l.originalUnitPrice) / l.originalUnitPrice) *
              100
            ).toFixed(1),
          };
        }
        return l;
      })
    );
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

  const subtotal = lines.reduce(
    (s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
    0
  );
  const totalVAT = lines.reduce(
    (s, l) =>
      s +
      (Number(l.quantity) || 0) *
        (Number(l.unitPrice) || 0) *
        ((Number(l.vatRate) || 0) / 100),
    0
  );
  const total = subtotal + totalVAT;
  const originalTotal = invoice?.total || 0;
  const margin =
    subtotal -
    (invoice?.lines.reduce(
      (s, l) => s + Number(l.quantity) * Number(l.unitPrice),
      0
    ) || 0);

  const handleSave = async (asDraft: boolean) => {
    if (!selectedClientId) {
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
      const client = realClients.find(c => String(c.id) === selectedClientId);
      if (!client) {
        toast.error("Clientul selectat nu a fost găsit");
        setSaving(false);
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
        clientName: clientName,
        clientCUI: clientCUI || undefined,
        clientAddress: clientAddress || undefined,
        clientCity: clientCity || undefined,
        clientEmail: clientEmail || undefined,
        clientPhone: clientPhone || undefined,
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
            (Number(l.quantity) || 0) *
            (Number(l.unitPrice) || 0) *
            (1 + (Number(l.vatRate) || 0) / 100),
          lineOrder: idx,
        })),
      });
      await utils.reinvoice.list.invalidate();
      toast.success(asDraft ? "Ciornă salvată" : "Re-factură generată!", {
        description: asDraft
          ? `Ciornă ${result.number} salvată. Poți continua editarea mai târziu.`
          : `Re-factura ${result.number} a fost creată cu succes.`,
      });
      navigate("/re-facturi");
    } catch (err: any) {
      toast.error("Eroare la salvare", {
        description: err?.message ?? "A apărut o eroare neașteptată",
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
          vatPercent: Number((l as any).vatRate ?? 19),
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
      toast.success("Re-Factură generată cu succes!", { id: "save" });
      navigate(`/re-facturi/${res.id}`);
    } catch (e: any) {
      toast.error("Eroare la salvare: " + e.message, { id: "save" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {invoice.status === "refactured" && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-amber-400"
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
            <div className="ml-3">
              <p className="text-sm text-amber-700 font-bold">
                Atenție: Această factură a mai fost re-facturată anterior!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href={`/facturi-primite/${invoice.id}`}>
            <button className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <ArrowLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Re-Facturare
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Bazat pe: <span className="">{invoice.number}</span> —{" "}
              {invoice.supplierName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
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
                if (!client) return;

                const subtotal = lines.reduce(
                  (s, l) =>
                    s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
                  0
                );
                const totalVAT = lines.reduce(
                  (s, l) =>
                    s +
                    (Number(l.quantity) || 0) *
                      (Number(l.unitPrice) || 0) *
                      ((Number(l.vatRate) || 0) / 100),
                  0
                );
                const total = subtotal + totalVAT;

                await downloadPDF.mutateAsync({
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
                      (Number(l.quantity) || 0) *
                      (Number(l.unitPrice) || 0) *
                      (1 + (Number(l.vatRate) || 0) / 100),
                  })),
                  subtotal,
                  totalVAT,
                  total,
                  currency,
                  notes,
                });
                toast.success("PDF descărcat cu succes!");
              } catch (error) {
                toast.error("Eroare la descărcarea PDF");
              } finally {
                setDownloadingPDF(false);
              }
            }}
            disabled={downloadingPDF}
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors disabled:opacity-60"
          >
            {downloadingPDF ? (
              <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Descarcă PDF
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="px-3 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors disabled:opacity-60"
          >
            Salvează ciornă
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all active:scale-[0.97] disabled:opacity-60"
          >
            {saving ? (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            Generează Re-Factură
          </button>
        </div>
      </div>

      {/* Warning banner */}
      {invoice?.status === "refactured" && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex gap-3 items-start">
          <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-800 dark:text-amber-300">
              Atenție: Factură deja re-facturată
            </h3>
            <p className="text-xs text-amber-700 dark:text-amber-400/80 mt-1">
              Aceste documente au mai fost re-facturate anterior. Continuarea va
              crea o nouă re-factură. Poți ignora acest mesaj dacă știi ce faci.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {/* Top: Lines editor */}
        <div className="w-full space-y-4">
          {/* Global markup */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-bold text-blue-900 dark:text-blue-200">
                  Adaos global:
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={globalMarkup}
                  onChange={e => setGlobalMarkup(e.target.value)}
                  className="w-20 h-9 px-3 text-sm rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-center"
                  min={0}
                  max={500}
                />
                <span className="text-sm text-blue-700 dark:text-blue-300 font-semibold">
                  %
                </span>
              </div>
              <button
                onClick={applyGlobalMarkupToAll}
                className="px-4 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all active:scale-[0.97]"
              >
                Aplică pe toate liniile
              </button>
              {lines.length > 1 && (
                <button
                  onClick={mergeToOneLine}
                  className="px-4 h-9 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all active:scale-[0.97] flex items-center gap-1.5"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  Unifică în 1 linie
                </button>
              )}
              <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 ml-auto">
                <Info className="w-3.5 h-3.5" />
                Poți edita și individual fiecare linie
              </div>
            </div>
          </div>

          {/* Lines table */}
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Linii Re-Factură
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCodes(!showCodes)}
                  className="flex items-center gap-1.5 px-3 h-8 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                >
                  <Info className="w-3.5 h-3.5" />
                  {showCodes ? "Ascunde coduri" : "Arată coduri"}
                </button>
                <button
                  onClick={addLine}
                  className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adaugă linie
                </button>
              </div>
            </div>

            {/* Header Tabel */}
            <div className="hidden md:grid grid-cols-12 gap-0 bg-[#1e1b4b] dark:bg-slate-800 text-white text-[10px] font-bold uppercase tracking-wider">
              {showCodes ? (
                <>
                  <div className="col-span-1 px-3 py-2.5">Cod</div>
                  <div className="col-span-3 px-3 py-2.5 border-l border-slate-700">
                    Denumire Serviciu
                  </div>
                </>
              ) : (
                <div className="col-span-4 px-3 py-2.5">Denumire Serviciu</div>
              )}
              <div className="col-span-1 px-2 py-2.5 text-center border-l border-slate-700">
                U.M.
              </div>
              <div className="col-span-1 px-2 py-2.5 text-center border-l border-slate-700">
                Cant.
              </div>
              <div className="col-span-2 px-2 py-2.5 text-right border-l border-slate-700">
                Preț Orig.
              </div>
              <div className="col-span-1 px-2 py-2.5 text-center border-l border-slate-700">
                Adaos %
              </div>
              <div className="col-span-1 px-2 py-2.5 text-right border-l border-slate-700">
                Preț Nou
              </div>
              <div className="col-span-1 px-2 py-2.5 text-right border-l border-slate-700">
                Total
              </div>
              <div className="col-span-1"></div>
            </div>

            {/* Continut Tabel */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {lines.map(line => {
                const qty = Number(line.quantity) || 0;
                const uPrice = Number(line.unitPrice) || 0;
                const lineTotal = qty * uPrice;
                const lineClass = (line as any).isCustom
                  ? "bg-amber-50/50 dark:bg-amber-900/10"
                  : "";

                return (
                  <div
                    key={line.id}
                    className={`grid grid-cols-2 sm:grid-cols-4 md:grid-cols-12 gap-3 md:gap-0 items-start hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors p-4 md:p-0 border-b border-slate-200 dark:border-slate-800 md:border-b-0 ${lineClass}`}
                  >
                    {showCodes && (
                      <div className="col-span-2 sm:col-span-4 md:col-span-1 px-0 md:px-2 py-1 md:py-2 h-full flex flex-col md:flex-row md:items-center">
                        <label className="md:hidden text-[10px] font-bold text-slate-500 uppercase mb-1">Cod</label>
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
                          className="w-full h-8 px-2 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                        />
                      </div>
                    )}
                    <div
                      className={`px-0 md:px-2 py-1 md:py-2 relative h-full flex flex-col justify-center col-span-2 sm:col-span-4 ${showCodes ? "md:col-span-3 md:border-l border-slate-100 dark:border-slate-800" : "md:col-span-4"}`}
                    >
                      <label className="md:hidden text-[10px] font-bold text-slate-500 uppercase mb-1">Denumire Serviciu</label>
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
                          // Nu declanșa autocomplete pe textul default
                          const isDefault = line.description === "";
                          setCatalogQuery(isDefault ? "" : line.description);
                          // Selectează tot textul ca să poți scrie imediat
                          e.target.select();
                        }}
                        onBlur={() =>
                          setTimeout(() => setFocusedLineId(null), 200)
                        }
                        className="w-full h-8 px-2 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      {focusedLineId === line.id &&
                        catalogQuery.trim().length > 0 && (
                          <div className="absolute top-11 left-2 right-2 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                            {catalogLoading ? (
                              <div className="p-4 flex justify-center">
                                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                              </div>
                            ) : catalogData?.items?.length === 0 ? (
                              <div className="p-4 text-xs text-slate-500 text-center">
                                Niciun rezultat în catalog.
                              </div>
                            ) : (
                              catalogData?.items?.map(
                                (item: any, i: number) => (
                                  <button
                                    key={i}
                                    onMouseDown={e => {
                                      e.preventDefault();
                                      handleSelectFromCatalog(line.id, item);
                                    }}
                                    className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors"
                                  >
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                        {item.tip}
                                      </span>
                                      <span className="text-xs font-mono text-slate-500">
                                        {item.cod}
                                      </span>
                                    </div>
                                    <div className="text-xs font-medium text-slate-900 dark:text-slate-100 line-clamp-2 leading-tight">
                                      {item.denumire}
                                    </div>
                                  </button>
                                )
                              )
                            )}
                          </div>
                        )}
                    </div>
                    <div className="col-span-1 md:col-span-1 px-0 md:px-1 py-1 md:py-2 md:border-l border-slate-100 dark:border-slate-800 h-full flex flex-col justify-center">
                      <label className="md:hidden text-[10px] font-bold text-slate-500 uppercase mb-1">U.M.</label>
                      <input
                        value={line.unit}
                        onChange={e =>
                          updateLine(line.id, "unit", e.target.value)
                        }
                        className="w-full text-center text-xs bg-slate-50 dark:bg-slate-800 md:bg-transparent border border-slate-200 dark:border-slate-700 md:border-0 rounded md:rounded-none h-8 md:h-auto focus:outline-none focus:ring-1 focus:ring-blue-500 md:focus:ring-0"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-1 px-0 md:px-1 py-1 md:py-2 md:border-l border-slate-100 dark:border-slate-800 h-full flex flex-col justify-center">
                      <label className="md:hidden text-[10px] font-bold text-slate-500 uppercase mb-1">Cant.</label>
                      <input
                        type="number"
                        value={line.quantity}
                        onChange={e =>
                          updateLine(line.id, "quantity", e.target.value)
                        }
                        className="w-full text-center text-xs bg-slate-50 dark:bg-slate-800 md:bg-transparent border border-slate-200 dark:border-slate-700 md:border-0 rounded md:rounded-none h-8 md:h-auto focus:outline-none focus:ring-1 focus:ring-blue-500 md:focus:ring-0"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2 px-0 md:px-1 py-1 md:py-2 md:border-l border-slate-100 dark:border-slate-800 h-full flex flex-col justify-center md:items-end text-xs text-slate-500">
                      <label className="md:hidden text-[10px] font-bold text-slate-500 uppercase mb-1">Preț Orig.</label>
                      <span className="mt-1 md:mt-0">{formatCurrency(line.originalUnitPrice, currency)}</span>
                    </div>
                    <div className="col-span-1 md:col-span-1 px-0 md:px-1 py-1 md:py-2 md:border-l border-slate-100 dark:border-slate-800 h-full flex flex-col justify-center">
                      <label className="md:hidden text-[10px] font-bold text-slate-500 uppercase mb-1">Adaos %</label>
                      <input
                        type="number"
                        value={line.markupPercent}
                        onChange={e =>
                          updateLine(line.id, "markupPercent", e.target.value)
                        }
                        className="w-full text-center text-xs bg-white dark:bg-slate-800 md:bg-transparent border border-slate-200 dark:border-slate-700 md:border-0 rounded md:rounded-none h-8 md:h-auto focus:outline-none focus:ring-1 focus:ring-blue-500 md:focus:ring-0 text-amber-600 dark:text-amber-400 font-bold"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-1 px-0 md:px-1 py-1 md:py-2 md:border-l border-slate-100 dark:border-slate-800 h-full flex flex-col justify-center">
                      <label className="md:hidden text-[10px] font-bold text-slate-500 uppercase mb-1">Preț Nou</label>
                      <input
                        type="number"
                        value={line.unitPrice}
                        onChange={e =>
                          updateLine(line.id, "unitPrice", e.target.value)
                        }
                        className="w-full md:text-right text-xs bg-slate-50 dark:bg-slate-800 md:bg-transparent border border-slate-200 dark:border-slate-700 md:border-0 rounded md:rounded-none h-8 md:h-auto px-2 md:px-0 focus:outline-none focus:ring-1 focus:ring-blue-500 md:focus:ring-0 font-semibold text-blue-600"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-1 px-0 md:px-1 py-1 md:py-2 md:border-l border-slate-100 dark:border-slate-800 h-full flex flex-col justify-center md:items-end">
                      <label className="md:hidden text-[10px] font-bold text-slate-500 uppercase mb-1">Total</label>
                      <span className="text-xs font-bold text-slate-900 dark:text-white mt-1 md:mt-0">{formatCurrency(lineTotal, currency)}</span>
                    </div>
                    <div className="col-span-2 md:col-span-1 px-0 md:px-1 py-1 md:py-2 md:border-l border-slate-100 dark:border-slate-800 flex items-end md:items-center justify-end md:justify-center">
                      <button
                        onClick={() => removeLine(line.id)}
                        className="w-8 h-8 md:w-auto md:h-auto flex items-center justify-center rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 md:hover:bg-transparent dark:hover:bg-rose-900/30 md:dark:hover:bg-transparent transition-colors"
                      >
                        <Trash2 className="w-4 h-4 md:w-3.5 md:h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex gap-2">
              <button
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
                className="flex items-center gap-1.5 px-3 h-8 text-xs font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Adaugă rând liber
              </button>
            </div>
          </div>
        </div>

        {/* Bottom: Config panels */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Client selector */}
          <div className="md:col-span-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Client Final
              </span>
            </div>

            <div className="space-y-4">
              <div className="relative mb-4">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Nume sau Cod Fiscal Client *
                </label>
                <input
                  type="text"
                  placeholder="Nume, CUI sau caută în ANAF..."
                  value={showClientDropdown ? clientSearch : clientName}
                  onChange={e => {
                    if (!showClientDropdown) {
                      setClientName(e.target.value);
                      setSelectedClientId("");
                    }
                    setClientSearch(e.target.value);
                  }}
                  onFocus={() => setShowClientDropdown(true)}
                  onBlur={() =>
                    setTimeout(() => setShowClientDropdown(false), 200)
                  }
                  className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
                {showClientDropdown && clientSearch.trim() && (
                  <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded shadow-lg max-h-64 overflow-y-auto">
                    {filteredClients.length > 0 &&
                      filteredClients.slice(0, 8).map(c => (
                        <button
                          key={c.id}
                          onMouseDown={() => selectClient(c)}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm border-b border-slate-100 dark:border-slate-800 last:border-0"
                        >
                          <div className="font-medium text-slate-900 dark:text-white">
                            {c.name}
                          </div>
                          {c.cui && (
                            <div className="text-xs text-slate-400">
                              CUI: {c.cui}
                            </div>
                          )}
                        </button>
                      ))}
                    {clientSearch.replace(/[^0-9]/g, "").length >= 2 && (
                      <button
                        onMouseDown={e => {
                          e.preventDefault();
                          lookupCuiFromSearch(clientSearch);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-sm font-semibold transition-colors"
                      >
                        <Search className="w-4 h-4" />
                        <span>
                          Caută CUI "{clientSearch.replace(/[^0-9]/g, "")}" în
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
                  onClick={() => setShowAdvancedClientInfo(!showAdvancedClientInfo)}
                  className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  {showAdvancedClientInfo ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {showAdvancedClientInfo ? "Ascunde Informații Opționale Client" : "Arată Informații Opționale Client (CUI, Adresă, etc.)"}
                </button>
              </div>

              {showAdvancedClientInfo && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                        CUI / CIF{" "}
                        {cuiLoading && (
                          <Loader2 className="w-3 h-3 ml-1 inline animate-spin" />
                        )}
                      </label>
                      <input
                        value={clientCUI}
                        onChange={e => setClientCUI(e.target.value)}
                        onBlur={lookupCui}
                        className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                        Reg. Com.
                      </label>
                      <input
                        value={clientRegCom}
                        onChange={e => setClientRegCom(e.target.value)}
                        className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                        Telefon Client
                      </label>
                      <input
                        value={clientPhone}
                        onChange={e => setClientPhone(e.target.value)}
                        className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                        Email
                      </label>
                      <input
                        value={clientEmail}
                        onChange={e => setClientEmail(e.target.value)}
                        className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-8">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                        Adresă
                      </label>
                      <input
                        value={clientAddress}
                        onChange={e => setClientAddress(e.target.value)}
                        className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="col-span-4">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                        Localitate
                      </label>
                      <input
                        value={clientCity}
                        onChange={e => setClientCity(e.target.value)}
                        className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Invoice settings */}
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Setări Re-Factură
            </span>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                Monedă
              </label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value as Currency)}
                className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                {currencies.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                Scadență
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                Observații
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Mențiuni, condiții de plată..."
                className="w-full px-4 py-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-4">
              Sumar
            </span>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Cost original (fără TVA):</span>
                <span>
                  {formatCurrency(
                    invoice.lines.reduce(
                      (s, l) => s + l.quantity * l.unitPrice,
                      0
                    ),
                    invoice.currency
                  )}
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Subtotal re-factură:</span>
                <span>{formatCurrency(subtotal, currency)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>TVA ({lines[0]?.vatRate ?? 19}%):</span>
                <span>{formatCurrency(totalVAT, currency)}</span>
              </div>
              <div className="flex justify-between text-slate-900 dark:text-white border-t border-slate-100 dark:border-slate-800 pt-2 mt-2">
                <span>Total cu TVA:</span>
                <span className="text-blue-600">
                  {formatCurrency(total, currency)}
                </span>
              </div>
            </div>
            {/* Margin highlight */}
            <div
              className={`mt-4 p-3 rounded-lg flex items-center justify-between ${
                margin >= 0
                  ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
                  : "bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800"
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp
                  className={`w-4 h-4 ${margin >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                />
                <span
                  className={`text-xs font-bold ${margin >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}
                >
                  Adaos comercial
                </span>
              </div>
              <div className="text-right">
                <div
                  className={`text-sm ${margin >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}
                >
                  {margin >= 0 ? "+" : ""}
                  {formatCurrency(margin, currency)}
                </div>
                <div
                  className={`text-[11px] ${margin >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                >
                  {invoice.lines.reduce(
                    (s, l) => s + l.quantity * l.unitPrice,
                    0
                  ) > 0
                    ? `${((margin / invoice.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)) * 100).toFixed(1)}% marjă`
                    : ""}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
