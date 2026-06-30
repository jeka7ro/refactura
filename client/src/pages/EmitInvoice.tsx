// EmitInvoice.tsx — Creare Factură Nouă — Layout inspirat din Oblio
import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  Search,
  EyeOff,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { formatCurrency, currencies, type Currency } from "@/lib/store";
import { cn } from "@/lib/utils";
import NirSelectorModal from "@/components/NirSelectorModal";

const VAT_RATES = [0, 5, 9, 19, 21];
const UNITS = [
  "buc",
  "ore",
  "luni",
  "kg",
  "m",
  "m2",
  "m3",
  "l",
  "set",
  "servicii",
  "t",
];

interface Line {
  id: string;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  unit: string;
  vatRate: number;
  devizCode?: string;
  devizType?: string;
  maxQuantity?: number; // cantitate maximă din NIR
}

const defaultLine = (): Line => ({
  id: crypto.randomUUID(),
  description: "",
  quantity: 1,
  unitPrice: 0,
  unit: "buc",
  vatRate: 21,
});

function computeLineTotal(line: Line) {
  const qty = parseFloat(String(line.quantity)) || 0;
  const price = parseFloat(String(line.unitPrice)) || 0;
  return Math.round(qty * price * 100) / 100;
}
function computeLineVAT(line: Line) {
  return (
    Math.round(
      computeLineTotal(line) * (parseFloat(String(line.vatRate)) / 100) * 100
    ) / 100
  );
}

const inputCls =
  "w-full h-9 px-3 text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 !rounded-md text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500";
const selectCls =
  "w-full h-9 px-3 text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 !rounded-md text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500";
const labelCls =
  "block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1";

export default function EmitInvoice() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  // Client fields
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

  // Invoice meta
  const [series, setSeries] = useState("FACT");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [currency, setCurrency] = useState<Currency>("RON");
  const [issueDate, setIssueDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });

  // Additional fields (like Oblio)
  const [intocmitDe, setIntocmitDe] = useState("");
  const [delegat, setDelegat] = useState("");
  const [carteIdentitate, setCarteIdentitate] = useState("");
  const [numarAviz, setNumarAviz] = useState("");
  const [auto, setAuto] = useState("");
  const [agentVanzari, setAgentVanzari] = useState("");
  const [punctLucru, setPunctLucru] = useState("");
  const [numarComanda, setNumarComanda] = useState("");
  const [numarContract, setNumarContract] = useState("");
  const [mentiuni, setMentiuni] = useState("");

  // Lines
  const [lines, setLines] = useState<Line[]>([defaultLine()]);
  const [saving, setSaving] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [showCodes, setShowCodes] = useState(false);
  const [showNirModal, setShowNirModal] = useState(false);

  // Autocomplete
  const [focusedLineId, setFocusedLineId] = useState<string | null>(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const { data: catalogData, isLoading: catalogLoading } =
    trpc.edevize.search.useQuery(
      { query: catalogQuery || undefined, limit: 15 },
      { enabled: !!focusedLineId && catalogQuery.length > 0 }
    );

  const params = useParams<{ id?: string; stornoId?: string }>();
  const stornoId = params?.stornoId;
  const editId = params?.id && params.id !== "new" ? params.id : null;

  // Data
  const { data: clientsData } = trpc.clients.list.useQuery();
  const { data: productsData } = trpc.products.list.useQuery();
  const { data: nextNumber } = trpc.emittedInvoice.nextNumber.useQuery({
    series,
  });
  const { data: tenantsData = [] } = trpc.tenants.list.useQuery();
  const tenantObj = tenantsData[0];
  const tenant = tenantObj?.tenants;

  const sourceId = stornoId || editId;
  const { data: originalInvoice } = trpc.emittedInvoice.getById.useQuery(
    { id: parseInt(sourceId!) },
    { enabled: !!sourceId }
  );

  // Dacă edităm o factură, verificăm dacă are deviz linked — îl expandăm în linii individuale
  const { data: linkedDevizForEdit } = trpc.devize.getByInvoiceId.useQuery(
    { invoiceId: parseInt(editId!) },
    { enabled: !!editId }
  );

  const products = productsData || [];
  const createProductMutation = trpc.products.create.useMutation({
    onSuccess: () => utils.products.list.invalidate(),
  });

  const createMutation = trpc.emittedInvoice.create.useMutation({
    onSuccess: () => {
      utils.emittedInvoice.list.invalidate();
      toast.success("Factura a fost creată cu succes!");
      navigate("/facturi-emise-nou");
    },
    onError: err => toast.error("Eroare la creare: " + err.message),
  });

  const updateMutation = trpc.emittedInvoice.update.useMutation({
    onSuccess: () => {
      utils.emittedInvoice.list.invalidate();
      toast.success("Factura a fost actualizată!");
      navigate("/facturi-emise-nou");
    },
    onError: err => toast.error("Eroare la actualizare: " + err.message),
  });

  const devizeUpdateMutation = trpc.devize.update.useMutation();
  const consumeLineMutation = trpc.nir.consumeLine.useMutation();

  const clients = clientsData || [];
  const filteredClients = useMemo(
    () =>
      clients.filter(
        c =>
          c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
          (c.cui || "").includes(clientSearch)
      ),
    [clients, clientSearch]
  );

  useEffect(() => {
    if (nextNumber && !invoiceNumber) setInvoiceNumber(nextNumber);
  }, [nextNumber]);

  // Pre-fill Edit or Storno data
  useEffect(() => {
    if (originalInvoice && sourceId) {
      if (originalInvoice.clientId)
        setSelectedClientId(String(originalInvoice.clientId));
      setClientName(originalInvoice.clientName || "");
      setClientCUI(originalInvoice.clientCUI || "");
      setClientRegCom(originalInvoice.clientRegCom || "");
      setClientAddress(originalInvoice.clientAddress || "");
      setClientCity(originalInvoice.clientCity || "");
      setClientEmail(originalInvoice.clientEmail || "");
      setClientPhone(originalInvoice.clientPhone || "");
      setCurrency((originalInvoice.currency || "RON") as Currency);

      let oldNotes = originalInvoice.notes || "";

      if (stornoId) {
        const stornoLines = originalInvoice.lines.map(l => ({
          id: crypto.randomUUID(),
          description: l.description,
          quantity: -Math.abs(parseFloat(String(l.quantity))),
          unitPrice: parseFloat(String(l.unitPrice)),
          unit: l.unit || "buc",
          vatRate: !isNaN(parseFloat(String(l.vatRate)))
            ? parseFloat(String(l.vatRate))
            : 21,
        }));
        setLines(stornoLines.length ? stornoLines : [defaultLine()]);

        const stornoNote = `Storno la factura seria ${originalInvoice.series} nr. ${originalInvoice.number} din ${originalInvoice.issueDate.split("T")[0]}`;
        setMentiuni(stornoNote);
      } else if (editId) {
        setSeries(originalInvoice.series || "FACT");
        setInvoiceNumber(originalInvoice.number);
        if (originalInvoice.issueDate)
          setIssueDate(originalInvoice.issueDate.split("T")[0]);
        if (originalInvoice.dueDate)
          setDueDate(originalInvoice.dueDate.split("T")[0]);

        const editLines = originalInvoice.lines.map(l => ({
          id: crypto.randomUUID(),
          description: l.description,
          quantity: parseFloat(String(l.quantity)),
          unitPrice: parseFloat(String(l.unitPrice)),
          unit: l.unit || "buc",
          vatRate: !isNaN(parseFloat(String(l.vatRate)))
            ? parseFloat(String(l.vatRate))
            : 21,
          devizCode: (l as any).devizCode,
          devizType: (l as any).devizType,
        }));

        // Dacă există deviz linked și există linii în el, le folosim în loc de linia sumară
        if (linkedDevizForEdit?.lines && linkedDevizForEdit.lines.length > 0) {
          const devizExpandedLines = linkedDevizForEdit.lines.map(dl => ({
            id: crypto.randomUUID(),
            description: dl.description,
            quantity: parseFloat(String(dl.quantity)) || 1,
            unitPrice: parseFloat(String(dl.unitPrice)) || 0,
            unit: dl.type === "MANOPERA" ? "ore" : "buc",
            vatRate: 21,
            devizCode: dl.code || "",
            devizType: dl.type,
          }));
          setLines(devizExpandedLines.length ? devizExpandedLines : editLines);
        } else {
          setLines(editLines.length ? editLines : [defaultLine()]);
        }

        let cleanNotes = oldNotes;
        const oblioKeys = [
          "Întocmit de:",
          "CNP:",
          "Delegat:",
          "Număr aviz:",
          "Auto:",
          "Mijloc transport:",
          "Agent vânzări:",
          "Punct de lucru:",
          "Număr comandă:",
          "Număr contract:",
        ];
        const noteLines = oldNotes.split("\n");
        const restNotes = noteLines.filter(
          line => !oblioKeys.some(k => line.startsWith(k))
        );
        setMentiuni(restNotes.join("\n").trim());
      }

      if (oldNotes.includes("Întocmit de:")) {
        const parts = oldNotes.split("\n");
        parts.forEach(p => {
          if (p.startsWith("Întocmit de: "))
            setIntocmitDe(p.replace("Întocmit de: ", ""));
          if (p.startsWith("CNP: ")) setCarteIdentitate(p.replace("CNP: ", ""));
          if (p.startsWith("Delegat: ")) setDelegat(p.replace("Delegat: ", ""));
          if (p.startsWith("Număr aviz: "))
            setNumarAviz(p.replace("Număr aviz: ", ""));
          if (p.startsWith("Auto: ")) setAuto(p.replace("Auto: ", ""));
          if (p.startsWith("Mijloc transport: "))
            setAuto(p.replace("Mijloc transport: ", ""));
          if (p.startsWith("Agent vânzări: "))
            setAgentVanzari(p.replace("Agent vânzări: ", ""));
          if (p.startsWith("Punct de lucru: "))
            setPunctLucru(p.replace("Punct de lucru: ", ""));
          if (p.startsWith("Număr comandă: "))
            setNumarComanda(p.replace("Număr comandă: ", ""));
          if (p.startsWith("Număr contract: "))
            setNumarContract(p.replace("Număr contract: ", ""));
        });
      }
    }
  }, [originalInvoice, sourceId, stornoId, editId, linkedDevizForEdit]);

  const [cuiLoading, setCuiLoading] = useState(false);

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

  const addLine = () => setLines(prev => [...prev, defaultLine()]);
  const removeLine = (id: string) =>
    setLines(prev => prev.filter(l => l.id !== id));
  const updateLine = useCallback(
    (id: string, field: keyof Line, value: any) => {
      setLines(prev =>
        prev.map(l => (l.id === id ? { ...l, [field]: value } : l))
      );
    },
    []
  );

  const handleSelectFromCatalog = (lineId: string, item: any) => {
    setLines(prev =>
      prev.map(l => {
        if (l.id === lineId) {
          return {
            ...l,
            description: item.denumire || item.description || item.name,
            unitPrice: item.salePrice || item.price || 0,
            unit: item.unit || "buc",
            vatRate: item.vatRate || 21,
            devizType: item.tip || item.type,
            devizCode: item.cod || item.code,
          };
        }
        return l;
      })
    );
    setFocusedLineId(null);
  };

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + computeLineTotal(l), 0),
    [lines]
  );
  const totalVAT = useMemo(
    () => lines.reduce((s, l) => s + computeLineVAT(l), 0),
    [lines]
  );
  const total = subtotal + totalVAT;

  const vatBreakdown = useMemo(() => {
    const map: Record<number, { base: number; vat: number }> = {};
    lines.forEach(l => {
      const r = parseFloat(String(l.vatRate));
      if (!map[r]) map[r] = { base: 0, vat: 0 };
      map[r].base += computeLineTotal(l);
      map[r].vat += computeLineVAT(l);
    });
    return Object.entries(map).map(([rate, v]) => ({
      rate: parseFloat(rate),
      ...v,
    }));
  }, [lines]);

  const notesForSave = [
    mentiuni,
    numarComanda ? `Comanda: ${numarComanda}` : "",
    numarContract ? `Contract: ${numarContract}` : "",
    intocmitDe ? `Întocmit de: ${intocmitDe}` : "",
    delegat
      ? `Delegat: ${delegat} ${carteIdentitate ? `(CI: ${carteIdentitate})` : ""}`
      : "",
    numarAviz ? `Aviz însoțire: ${numarAviz}` : "",
    auto ? `Auto: ${auto}` : "",
    agentVanzari ? `Agent vânzări: ${agentVanzari}` : "",
    punctLucru ? `Punct de lucru: ${punctLucru}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const handleSave = async (status: "draft" | "sent" = "draft") => {
    if (!clientName.trim()) {
      toast.error("Selectați sau introduceți un client");
      return;
    }
    if (lines.some(l => !l.description.trim())) {
      toast.error("Toate liniile trebuie să aibă descriere");
      return;
    }
    setSaving(true);
    try {
      for (const line of lines) {
        if (
          !products.some(
            p => p.name.toLowerCase() === line.description.toLowerCase().trim()
          )
        ) {
          await createProductMutation
            .mutateAsync({
              name: line.description.trim(),
              unit: line.unit,
              defaultPrice: parseFloat(String(line.unitPrice)) || 0,
              defaultVatRate: line.vatRate,
            })
            .catch(console.error);
        }
      }

      const payload = {
        number: invoiceNumber,
        series,
        clientId: selectedClientId ? parseInt(selectedClientId) : undefined,
        clientName,
        clientCUI,
        clientRegCom,
        clientAddress,
        clientCity,
        clientEmail,
        clientPhone,
        issueDate,
        dueDate,
        subtotal,
        totalVAT,
        total,
        currency,
        status,
        notes: notesForSave,
        lines: lines.map((l, i) => ({
          description: l.description,
          quantity: parseFloat(String(l.quantity)) || 1,
          unitPrice: parseFloat(String(l.unitPrice)) || 0,
          unit: l.unit,
          vatRate: parseFloat(String(l.vatRate)) || 0,
          total: computeLineTotal(l),
          lineOrder: i,
          devizCode: l.devizCode,
          devizType: l.devizType,
        })),
      };

      if (editId) {
        await updateMutation.mutateAsync({ id: parseInt(editId), ...payload });
        // Sincroniezăm devizul linked dacă există
        if (linkedDevizForEdit?.deviz?.id) {
          const devizLines = lines.map(l => ({
            type: (l.devizType === "MANOPERA"
              ? "MANOPERA"
              : l.devizType === "NORMA"
                ? "NORMA"
                : l.devizType === "UTILAJ"
                  ? "UTILAJ"
                  : "MATERIAL") as "MATERIAL" | "MANOPERA" | "UTILAJ" | "NORMA",
            code: l.devizCode || null,
            description: l.description,
            quantity: parseFloat(String(l.quantity)) || 1,
            unitPrice: parseFloat(String(l.unitPrice)) || 0,
          }));
          await devizeUpdateMutation.mutateAsync({
            id: linkedDevizForEdit.deviz.id,
            lines: devizLines,
          });
        }
      } else {
        await createMutation.mutateAsync(payload);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/facturi-emise-nou")}
            className="w-8 h-8 flex items-center justify-center !rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
              Emite Factură Nouă
            </h1>
            {tenant && (
              <p className="text-xs text-slate-500">
                {tenant.name}
                {tenant.cui ? ` • CUI: ${tenant.cui}` : ""}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSave("draft")}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 h-9 !rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Salvează Ciornă
          </button>
          <button
            onClick={() => handleSave("sent")}
            disabled={saving}
            className="flex items-center gap-1.5 px-8 h-9 !rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Emite Factura
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 !rounded-md p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          <div className="md:col-span-4 relative">
            <label className={labelCls}>Nume sau Cod Fiscal Client *</label>
            <div className="relative">
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
                className={inputCls}
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
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Data Emiterii *</label>
            <input
              type="date"
              value={issueDate}
              onChange={e => setIssueDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Data Scadenței</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="md:col-span-4 grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Serie</label>
              <input
                value={series}
                onChange={e => setSeries(e.target.value.toUpperCase())}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Număr</label>
              <input
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          <div className="md:col-span-4 grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>
                CUI / CIF
                {cuiLoading && (
                  <Loader2 className="w-3 h-3 ml-1 inline animate-spin" />
                )}
              </label>
              <input
                value={clientCUI}
                onChange={e => setClientCUI(e.target.value)}
                onBlur={lookupCui}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Reg. Com.</label>
              <input
                value={clientRegCom}
                onChange={e => setClientRegCom(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Moneda facturii</label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value as Currency)}
              className={inputCls}
            >
              <option value="RON">RON</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
          <div className="md:col-span-6">
            <label className={labelCls}>Telefon Client</label>
            <input
              value={clientPhone}
              onChange={e => setClientPhone(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          <div className="md:col-span-6">
            <label className={labelCls}>Adresă</label>
            <input
              value={clientAddress}
              onChange={e => setClientAddress(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="md:col-span-3">
            <label className={labelCls}>Localitate</label>
            <input
              value={clientCity}
              onChange={e => setClientCity(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="md:col-span-3">
            <label className={labelCls}>Email</label>
            <input
              type="email"
              value={clientEmail}
              onChange={e => setClientEmail(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded">
        <div className="p-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Linii Factură
          </h3>
          <button
            onClick={() => setShowCodes(!showCodes)}
            className="flex items-center gap-1.5 px-3 h-8 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            {showCodes ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            {showCodes ? "Ascunde coduri" : "Arată coduri"}
          </button>
        </div>
        <div className="grid grid-cols-12 gap-0 bg-[#1e1b4b] dark:bg-slate-800 text-white text-[11px] font-bold uppercase tracking-wider">
          {showCodes ? (
            <>
              <div className="col-span-1 px-4 py-2.5">Cod</div>
              <div className="col-span-4 px-4 py-2.5 border-l border-slate-700">
                Denumire Produs sau Serviciu
              </div>
            </>
          ) : (
            <div className="col-span-5 px-4 py-2.5">
              Denumire Produs sau Serviciu
            </div>
          )}
          <div className="col-span-1 px-3 py-2.5 text-center border-l border-slate-700">
            U.M.
          </div>
          <div className="col-span-1 px-3 py-2.5 text-center border-l border-slate-700">
            Cant.
          </div>
          <div className="col-span-1 px-3 py-2.5 text-center border-l border-slate-700">
            Cotă TVA
          </div>
          <div className="col-span-2 px-3 py-2.5 text-right border-l border-slate-700">
            Preț (fără TVA)
          </div>
          <div className="col-span-1 px-3 py-2.5 text-right border-l border-slate-700">
            Valoare
          </div>
          <div className="col-span-1 px-3 py-2.5 text-center border-l border-slate-700"></div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {lines.map((line, idx) => (
            <div
              key={line.id}
              className="grid grid-cols-12 gap-0 items-start hover:bg-slate-50 dark:hover:bg-slate-800/30"
            >
              {showCodes && (
                <div className="col-span-1 px-3 py-2 h-full flex items-center">
                  <input
                    type="text"
                    placeholder="Cod..."
                    value={line.devizCode || ""}
                    onChange={e =>
                      updateLine(line.id, "devizCode", e.target.value)
                    }
                    className="w-full h-8 px-2 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
              )}
              <div
                className={cn(
                  "px-3 py-2 relative h-full flex flex-col justify-center",
                  showCodes
                    ? "col-span-4 border-l border-slate-100 dark:border-slate-800"
                    : "col-span-5"
                )}
              >
                <input
                  type="text"
                  placeholder={`Căutare sau denumire liberă...`}
                  value={line.description}
                  onChange={e => {
                    updateLine(line.id, "description", e.target.value);
                    setCatalogQuery(e.target.value);
                    setHighlightedIdx(-1);
                  }}
                  onFocus={e => {
                    setFocusedLineId(line.id);
                    const isDefault =
                      line.description === "" ||
                      line.description === "Produs / Serviciu nou";
                    setCatalogQuery(isDefault ? "" : line.description);
                    setHighlightedIdx(-1);
                    e.target.select();
                  }}
                  onKeyDown={e => {
                    const items = catalogData?.items ?? [];
                    if (!items.length) return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setHighlightedIdx(i => Math.min(i + 1, items.length - 1));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setHighlightedIdx(i => Math.max(i - 1, 0));
                    } else if (e.key === "Enter" && highlightedIdx >= 0) {
                      e.preventDefault();
                      handleSelectFromCatalog(line.id, items[highlightedIdx]);
                      setHighlightedIdx(-1);
                    } else if (e.key === "Escape") {
                      setFocusedLineId(null);
                      setHighlightedIdx(-1);
                    }
                  }}
                  onBlur={() =>
                    setTimeout(() => {
                      setFocusedLineId(null);
                      setHighlightedIdx(-1);
                    }, 200)
                  }
                  className="w-full h-8 px-2 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {focusedLineId === line.id &&
                  catalogQuery.trim().length > 0 && (
                    <div className="absolute top-11 left-3 right-3 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl max-h-64 overflow-y-auto">
                      {catalogLoading ? (
                        <div className="p-4 flex justify-center">
                          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                        </div>
                      ) : catalogData?.items?.length === 0 ? (
                        <div className="p-4 text-xs text-slate-500 text-center">
                          Niciun rezultat în catalog.
                        </div>
                      ) : (
                        catalogData?.items?.map((item: any, i: number) => (
                          <button
                            key={i}
                            onMouseDown={e => {
                              e.preventDefault();
                              handleSelectFromCatalog(line.id, item);
                            }}
                            onMouseEnter={() => setHighlightedIdx(i)}
                            className={cn(
                              "catalog-dropdown-item w-full text-left px-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors",
                              highlightedIdx === i
                                ? "bg-blue-600 text-white"
                                : "hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            )}
                          >
                            <div className="flex items-center gap-2 mb-0.5">
                              <span
                                className={cn(
                                  "text-[9px] font-bold px-1.5 py-0.5 uppercase tracking-wider",
                                  highlightedIdx === i
                                    ? "bg-white/20 text-white"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                )}
                              >
                                {item.tip}
                              </span>
                              <span
                                className={cn(
                                  "text-xs font-mono",
                                  highlightedIdx === i
                                    ? "text-blue-100"
                                    : "text-slate-500"
                                )}
                              >
                                {item.cod}
                              </span>
                            </div>
                            <div
                              className={cn(
                                "text-sm font-medium line-clamp-2 leading-tight",
                                highlightedIdx === i
                                  ? "text-white"
                                  : "text-slate-900 dark:text-slate-100"
                              )}
                            >
                              {item.denumire}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
              </div>
              <div className="col-span-1 px-2 py-2 border-l border-slate-100 dark:border-slate-800 h-full flex items-center">
                <select
                  value={line.unit}
                  onChange={e => updateLine(line.id, "unit", e.target.value)}
                  className="w-full h-8 px-1 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {UNITS.map(u => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-1 px-2 py-2 border-l border-slate-100 dark:border-slate-800">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  max={line.maxQuantity}
                  value={line.quantity}
                  onChange={e => {
                    const val = parseFloat(e.target.value) || 0;
                    if (
                      line.maxQuantity !== undefined &&
                      val > line.maxQuantity
                    ) {
                      toast(`⚠️ Stoc insuficient în NIR`, {
                        description: `„${line.description.slice(0, 45)}" — disponibil: ${line.maxQuantity} ${line.unit}`,
                        duration: 4000,
                        style: {
                          background: "#fff7ed",
                          border: "1px solid #fb923c",
                          color: "#9a3412",
                          borderRadius: 10,
                          fontSize: 13,
                        },
                      });
                    }
                    updateLine(line.id, "quantity", e.target.value);
                  }}
                  className="w-full h-8 px-2 text-sm text-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-1 px-2 py-2 border-l border-slate-100 dark:border-slate-800">
                <select
                  value={line.vatRate}
                  onChange={e =>
                    updateLine(line.id, "vatRate", parseFloat(e.target.value))
                  }
                  className="w-full h-8 px-1 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {VAT_RATES.map(r => (
                    <option key={r} value={r}>
                      {r}%
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 px-2 py-2 border-l border-slate-100 dark:border-slate-800">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.unitPrice}
                  onChange={e =>
                    updateLine(line.id, "unitPrice", e.target.value)
                  }
                  className="w-full h-8 px-2 text-sm text-right border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-1 px-3 py-2 border-l border-slate-100 dark:border-slate-800 text-right">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(computeLineTotal(line), currency)}
                </span>
              </div>
              <div className="col-span-1 px-2 py-2 border-l border-slate-100 dark:border-slate-800 flex justify-center">
                {lines.length > 1 && (
                  <button
                    onClick={() => removeLine(line.id)}
                    className="w-7 h-7 flex items-center justify-center rounded text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 grid grid-cols-12">
          <div className="col-span-7 px-4 py-3 flex gap-2 flex-wrap">
            <button
              onClick={addLine}
              className="flex items-center gap-1.5 px-3 h-8 text-xs font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Adaugă rând liber
            </button>
            <button
              onClick={() => setShowNirModal(true)}
              className="flex items-center gap-1.5 px-3 h-8 text-xs font-semibold text-sky-700 border border-sky-200 bg-sky-50 hover:bg-sky-100 rounded transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Adaugă din NIR
            </button>
          </div>
          <div className="col-span-5 px-4 py-3 border-l border-slate-200 dark:border-slate-700 space-y-1">
            {vatBreakdown.map(({ rate, base, vat }) => (
              <div
                key={rate}
                className="flex justify-between text-xs text-slate-500"
              >
                <span>
                  TVA {rate}% × {formatCurrency(base, currency)}
                </span>
                <span className="font-medium">
                  {formatCurrency(vat, currency)}
                </span>
              </div>
            ))}
            <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
              <span>Total fără TVA:</span>
              <span className="font-semibold">
                {formatCurrency(subtotal, currency)}
              </span>
            </div>
            <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
              <span>TVA Total:</span>
              <span className="font-semibold">
                {formatCurrency(totalVAT, currency)}
              </span>
            </div>
            <div className="flex justify-between text-base font-black text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700 pt-2 mt-1">
              <span>TOTAL DE PLATĂ:</span>
              <span className="text-blue-600">
                {formatCurrency(total, currency)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded overflow-hidden">
        <button
          onClick={() => setShowOptional(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <span>
            Câmpuri Opționale{" "}
            <span className="text-slate-400 font-normal">
              (Delegat, Aviz, Comandă, Mențiuni...)
            </span>
          </span>
          {showOptional ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>
        {showOptional && (
          <div className="border-t border-slate-100 dark:border-slate-800 p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className={labelCls}>Întocmit de</label>
                <input
                  value={intocmitDe}
                  onChange={e => setIntocmitDe(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Delegat</label>
                <input
                  value={delegat}
                  onChange={e => setDelegat(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Carte Identitate</label>
                <input
                  value={carteIdentitate}
                  onChange={e => setCarteIdentitate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Nr. Aviz Însoțire</label>
                <input
                  value={numarAviz}
                  onChange={e => setNumarAviz(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Auto (nr. înmatriculare)</label>
                <input
                  value={auto}
                  onChange={e => setAuto(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Agent Vânzări</label>
                <input
                  value={agentVanzari}
                  onChange={e => setAgentVanzari(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Punct de Lucru Client</label>
                <input
                  value={punctLucru}
                  onChange={e => setPunctLucru(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Nr. Comandă</label>
                <input
                  value={numarComanda}
                  onChange={e => setNumarComanda(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Nr. Contract</label>
                <input
                  value={numarContract}
                  onChange={e => setNumarContract(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="mt-4">
              <label className={labelCls}>Mențiuni (apar pe factură)</label>
              <textarea
                value={mentiuni}
                onChange={e => setMentiuni(e.target.value)}
                rows={3}
                placeholder={`Exemplu: "Aceasta factură circulă fără semnătură și ștampilă."`}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Save buttons bottom */}
      <div className="flex justify-end gap-3 pb-4">
        <button
          onClick={() => handleSave("draft")}
          disabled={saving}
          className="flex items-center gap-1.5 px-6 h-10 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 transition-colors disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Salvează Ciornă
        </button>
        <button
          onClick={() => handleSave("sent")}
          disabled={saving}
          className="flex items-center gap-1.5 px-8 h-10 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Previzualizare / Emite Factura
        </button>
      </div>
      {showNirModal && (
        <NirSelectorModal
          onClose={() => setShowNirModal(false)}
          onAdd={async nirLines => {
            const newLines = nirLines.map(nl => ({
              id: crypto.randomUUID(),
              description: nl.description,
              quantity: nl.quantity,
              unitPrice: nl.unitPrice,
              unit: nl.unit,
              vatRate: nl.vatRate || 21,
              maxQuantity: nl.quantity,
            }));
            setLines(prev => {
              const hasOnlyDefault =
                prev.length === 1 &&
                !prev[0].description &&
                !parseFloat(String(prev[0].unitPrice));
              return hasOnlyDefault ? newLines : [...prev, ...newLines];
            });
            // Marchează liniile ca consumate în NIR
            try {
              await consumeLineMutation.mutateAsync({
                lines: nirLines.map(nl => ({
                  nirLineId: nl.nirLineId,
                  qty: nl.quantity,
                })),
              });
            } catch (e) {
              console.error("consumeLine error", e);
            }
            setShowNirModal(false);
          }}
        />
      )}
    </div>
  );
}
