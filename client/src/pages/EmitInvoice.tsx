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
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { formatCurrency, currencies, type Currency } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

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
  const [clientCountry, setClientCountry] = useState("RO");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [showAdvancedClientInfo, setShowAdvancedClientInfo] = useState(false);

  // Invoice meta
  const [series, setSeries] = useState("FACT");
  const [invoiceNumDigits, setInvoiceNumDigits] = useState("");
  const fullInvoiceNumber = useMemo(() => {
    const s = series.trim();
    const n = invoiceNumDigits.trim();
    if (!s) return n;
    if (!n) return s;
    return `${s}-${n}`;
  }, [series, invoiceNumDigits]);
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
  const [createDeviz, setCreateDeviz] = useState(false);

  // Lines
  const [lines, setLines] = useState<Line[]>([defaultLine()]);
  const [saving, setSaving] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [showCodes, setShowCodes] = useState(false);

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
  const { data: seriesListData = [] } = trpc.emittedInvoice.seriesList.useQuery();
  const { data: nextNumber, isFetching: nextNumberLoading } =
    trpc.emittedInvoice.nextNumber.useQuery(
      { series },
      { enabled: !editId }
    );
  const { data: currentTenantObj } = trpc.tenants.current.useQuery();
  const { data: tenantsData = [] } = trpc.tenants.list.useQuery();
  const tenant = currentTenantObj || tenantsData[0]?.tenants;

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
  const upsertProductMutation = trpc.products.upsert.useMutation({
    onSuccess: () => utils.products.list.invalidate(),
  });

  const consumeLineMutation = trpc.nir.consumeLine.useMutation();

  const createMutation = trpc.emittedInvoice.create.useMutation({
    onSuccess: async (data, variables) => {
      // Consume stock for items added from NIR
      const stockLines = variables.lines
        .filter((l: any) => l.nirLineId)
        .map((l: any) => ({ nirLineId: l.nirLineId, qty: l.quantity }));
      
      if (stockLines.length > 0) {
        try {
          await consumeLineMutation.mutateAsync({ lines: stockLines });
        } catch (e) {
          console.error("Failed to consume stock", e);
        }
      }

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

  const clients = clientsData || [];
  const filteredClients = useMemo(() => {
    const q = (clientName || clientSearch || "").trim().toLowerCase();
    if (!q) return clients.slice(0, 8);
    return clients.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        (c.cui || "").toLowerCase().includes(q)
    );
  }, [clients, clientName, clientSearch]);

  // Parse tenant settings and bank accounts
  const tenantSettings = useMemo(() => {
    try {
      return tenant?.settings ? JSON.parse(tenant.settings) : {};
    } catch {
      return {};
    }
  }, [tenant]);

  const bankAccounts = useMemo(() => {
    if (
      tenantSettings.bankAccounts &&
      Array.isArray(tenantSettings.bankAccounts) &&
      tenantSettings.bankAccounts.length > 0
    ) {
      return tenantSettings.bankAccounts;
    }
    const list = [];
    if (tenantSettings.iban) {
      list.push({
        id: "ron",
        currency: "RON",
        iban: tenantSettings.iban,
        bank: tenantSettings.bank || "",
      });
    }
    if (tenantSettings.ibanEur) {
      list.push({
        id: "eur",
        currency: "EUR",
        iban: tenantSettings.ibanEur,
        bank: tenantSettings.bankEur || "",
      });
    }
    return list;
  }, [tenantSettings]);

  const [selectedIban, setSelectedIban] = useState("");
  const [selectedBank, setSelectedBank] = useState("");

  // Potrivire automată a contului bancar după valută
  useEffect(() => {
    if (bankAccounts.length > 0) {
      const match = bankAccounts.find(
        (a: any) =>
          (a.currency || "").toUpperCase() === (currency || "RON").toUpperCase()
      );
      if (match && match.iban) {
        setSelectedIban(match.iban);
        setSelectedBank(match.bank || "");
      } else if (!selectedIban && bankAccounts[0]?.iban) {
        setSelectedIban(bankAccounts[0].iban);
        setSelectedBank(bankAccounts[0].bank || "");
      }
    }
  }, [currency, bankAccounts]);

  const handleSeriesChange = (val: string) => {
    const newSeries = val.toUpperCase();
    setSeries(newSeries);
  };

  const handleNumDigitsChange = (val: string) => {
    let clean = val;
    const match = clean.match(/^([A-Za-z0-9_-]+?)-(.*)$/);
    if (match) {
      if (!series || series === "FACT") {
        setSeries(match[1].toUpperCase());
      }
      clean = match[2];
    }
    setInvoiceNumDigits(clean);
  };

  useEffect(() => {
    if (!editId && nextNumber) {
      const match = nextNumber.match(/^([A-Za-z0-9_-]+?)-(.*)$/);
      if (match) {
        setSeries(match[1]);
        setInvoiceNumDigits(match[2]);
      } else {
        setInvoiceNumDigits(nextNumber);
      }
    }
  }, [nextNumber, editId]);

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
      const invCountry =
        originalInvoice.clientCountry ||
        (originalInvoice.clientCUI?.trim().match(/^([A-Za-z]{2})/)?.[1]?.toUpperCase() || "RO");
      setClientCountry(invCountry);
      setClientEmail(originalInvoice.clientEmail || "");
      setClientPhone(originalInvoice.clientPhone || "");
      if (
        originalInvoice.clientAddress ||
        originalInvoice.clientCity ||
        (invCountry && invCountry !== "RO")
      ) {
        setShowAdvancedClientInfo(true);
      }
      setCurrency((originalInvoice.currency || "RON") as Currency);
      if ((originalInvoice as any).companyIBAN) {
        setSelectedIban((originalInvoice as any).companyIBAN);
      }
      if ((originalInvoice as any).companyBank) {
        setSelectedBank((originalInvoice as any).companyBank);
      }

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
        const origSeries = (originalInvoice.series || "").trim();
        const origNum = (originalInvoice.number || "").trim();
        if (origSeries && origNum.startsWith(`${origSeries}-`)) {
          setSeries(origSeries);
          setInvoiceNumDigits(origNum.slice(origSeries.length + 1));
        } else {
          const m = origNum.match(/^([A-Za-z0-9_-]+?)-(.*)$/);
          if (m) {
            setSeries(origSeries || m[1]);
            setInvoiceNumDigits(m[2]);
          } else {
            setSeries(origSeries || "FACT");
            setInvoiceNumDigits(origNum);
          }
        }
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
          setCreateDeviz(true);
          const origVat =
            originalInvoice.lines?.[0]?.vatRate !== undefined
              ? parseFloat(String(originalInvoice.lines[0].vatRate))
              : 21;
          const devizExpandedLines = linkedDevizForEdit.lines.map(dl => ({
            id: crypto.randomUUID(),
            description: dl.description,
            quantity: parseFloat(String(dl.quantity)) || 1,
            unitPrice: parseFloat(String(dl.unitPrice)) || 0,
            unit: dl.type === "MANOPERA" ? "ore" : "buc",
            vatRate:
              (dl as any).vatRate !== undefined && (dl as any).vatRate !== null
                ? parseFloat(String((dl as any).vatRate))
                : origVat,
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
    setClientSearch(c.name);
    setClientCUI(c.cui || "");
    setClientRegCom(c.regCom || "");
    setClientAddress(c.address || "");
    setClientCity(c.city || "");
    const cuiCountry = (c.cui || "").trim().match(/^([A-Za-z]{2})/)?.[1]?.toUpperCase();
    const resolvedCountry =
      c.country && c.country !== "RO" ? c.country : (cuiCountry || c.country || "RO");
    setClientCountry(resolvedCountry);
    setClientEmail(c.email || "");
    setClientPhone(c.phone || "");
    if (c.address || c.city || (resolvedCountry && resolvedCountry !== "RO")) {
      setShowAdvancedClientInfo(true);
    }
    setShowClientDropdown(false);
  };

  const lookupCui = async () => {
    const rawCui = clientCUI.trim().replace(/\s/g, "");
    if (!rawCui || rawCui.length < 2) return;

    // Detect country if CUI starts with 2 letters (e.g. BE0785292895 -> BE)
    const prefixMatch = rawCui.match(/^([A-Za-z]{2})(.*)$/);
    const isEuForeign = prefixMatch && prefixMatch[1].toUpperCase() !== "RO";

    if (isEuForeign) {
      const country = prefixMatch[1].toUpperCase();
      setClientCountry(country);
      setShowAdvancedClientInfo(true);
      setCuiLoading(true);
      try {
        const res = await fetch(`/api/vies/${encodeURIComponent(rawCui)}`);
        const d = await res.json().catch(() => ({}));
        if (!res.ok || !d.valid) {
          toast.error(d.error || `Codul de TVA ${rawCui} nu a fost găsit sau nu este valid în VIES.`);
          return;
        }
        setClientName(d.denumire || clientName);
        setClientSearch(d.denumire || clientName);
        setClientAddress(d.adresa || clientAddress);
        if (d.oras) setClientCity(d.oras);
        setClientCountry(d.country || country);
        setClientCUI(d.cui || rawCui.toUpperCase());
        toast.success(`Operator validat în VIES (${d.country}): ${d.denumire}`);
        // Pentru tranzacții intracomunitare, de regulă TVA este 0% (taxare inversă / scutit)
        setLines(prev => prev.map(l => ({ ...l, vatRate: 0 })));
      } catch {
        toast.error("Eroare la verificarea codului în VIES.");
      } finally {
        setCuiLoading(false);
      }
      return;
    }

    const cui = rawCui.replace(/^RO/i, "");
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
      setClientCountry("RO");
      toast.success("Date extrase de la ANAF cu succes.");
    } catch {
      toast.error("Eroare conexiune la ANAF.");
    } finally {
      setCuiLoading(false);
    }
  };

  const lookupCuiFromSearch = async (searchTerm: string) => {
    const clean = searchTerm.trim().replace(/\s/g, "");
    const euMatch = clean.match(/^([A-Za-z]{2})(.*)$/);
    const isEuForeign = euMatch && euMatch[1].toUpperCase() !== "RO" && euMatch[2].length >= 2;

    setCuiLoading(true);
    try {
      if (isEuForeign) {
        const res = await fetch(`/api/vies/${encodeURIComponent(clean)}`);
        const d = await res.json().catch(() => ({}));
        if (!res.ok || !d.valid) {
          toast.error(d.error || `Codul ${clean} nu a fost găsit în VIES.`);
          return;
        }
        setClientName(d.denumire || "");
        setClientSearch(d.denumire || "");
        setClientAddress(d.adresa || "");
        setClientCity(d.oras || "");
        setClientRegCom("");
        setClientCUI(d.cui || clean.toUpperCase());
        setClientCountry(d.country || euMatch[1].toUpperCase());
        setShowAdvancedClientInfo(true);
        setShowClientDropdown(false);
        toast.success(`Operator validat în VIES (${d.country}): ${d.denumire}`);
        setLines(prev => prev.map(l => ({ ...l, vatRate: 0 })));
      } else {
        const digits = clean.replace(/^RO/i, "").replace(/[^0-9]/g, "");
        if (!digits || digits.length < 2) {
          toast.error("Introduceți un CUI valid.");
          return;
        }
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
        setClientCountry("RO");
        setShowClientDropdown(false);
        toast.success("Date extrase din ANAF!");
      }
    } catch {
      toast.error("Eroare conexiune la server.");
    } finally {
      setCuiLoading(false);
    }
  };

  const addLine = () =>
    setLines(prev => {
      const lastVat = prev.length > 0 ? prev[prev.length - 1].vatRate : 21;
      return [...prev, { ...defaultLine(), vatRate: lastVat }];
    });
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

  const matchingProducts = useMemo(() => {
    const q = (catalogQuery || "").trim().toLowerCase();
    if (!q) return products.slice(0, 10);
    return products.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        (p.unit && p.unit.toLowerCase().includes(q))
    ).slice(0, 15);
  }, [products, catalogQuery]);

  const handleSelectProduct = (lineId: string, p: any) => {
    setLines(prev =>
      prev.map(l => {
        if (l.id === lineId) {
          const chosenVat =
            l.vatRate === 0
              ? 0
              : p.defaultVatRate !== undefined && p.defaultVatRate !== null
                ? Number(p.defaultVatRate)
                : l.vatRate;
          return {
            ...l,
            description: p.name,
            unit: p.unit || "buc",
            unitPrice: parseFloat(p.defaultPrice) || 0,
            vatRate: chosenVat,
          };
        }
        return l;
      })
    );
    setFocusedLineId(null);
  };

  const handleSelectFromCatalog = (lineId: string, item: any) => {
    setLines(prev =>
      prev.map(l => {
        if (l.id === lineId) {
          const chosenVat =
            l.vatRate === 0
              ? 0
              : item.vatRate !== undefined && item.vatRate !== null
                ? Number(item.vatRate)
                : l.vatRate;
          return {
            ...l,
            description: item.denumire || item.description || item.name,
            unitPrice: item.salePrice || item.price || 0,
            unit: item.unit || "buc",
            vatRate: chosenVat,
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
        if (line.description.trim()) {
          await upsertProductMutation
            .mutateAsync({
              name: line.description.trim(),
              unit: line.unit || "buc",
              defaultPrice: parseFloat(String(line.unitPrice)) || 0,
              defaultVatRate: parseFloat(String(line.vatRate)) || 0,
            })
            .catch(console.error);
        }
      }

      const detectedCountry =
        clientCountry ||
        (clientCUI.trim().match(/^([A-Za-z]{2})/)?.[1]?.toUpperCase() || "RO");

      const payload = {
        number: fullInvoiceNumber,
        series: series.trim() || undefined,
        companyIBAN: selectedIban || undefined,
        companyBank: selectedBank || undefined,
        clientId: selectedClientId ? parseInt(selectedClientId) : undefined,
        clientName: clientName.trim(),
        clientCUI: clientCUI.trim() || undefined,
        clientRegCom: clientRegCom.trim() || undefined,
        clientAddress: clientAddress.trim() || undefined,
        clientCity: clientCity.trim() || undefined,
        clientCountry: detectedCountry.slice(0, 2).toUpperCase(),
        clientEmail: clientEmail.trim() || undefined,
        clientPhone: clientPhone.trim() || undefined,
        issueDate,
        dueDate,
        subtotal,
        totalVAT,
        total,
        currency,
        status,
        notes: notesForSave,
        createDeviz,
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
            className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
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
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3.5 shadow-xs">
        {/* Row 1: Client Name, Data Emiterii, Data Scadenței, Monedă */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-start">
          <div className="sm:col-span-2 lg:col-span-5 relative">
            <label className={labelCls}>Nume sau Cod Fiscal Client *</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Nume, CUI (ANAF) sau CIF european (VIES)..."
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
                className={inputCls}
              />
              {showClientDropdown && (
                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg max-h-64 overflow-y-auto">
                  {filteredClients.length > 0 &&
                    filteredClients.map(c => (
                      <button
                        key={c.id}
                        type="button"
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
                  {(() => {
                    const raw = (clientName || clientSearch || "").trim().replace(/\s/g, "");
                    const euMatch = raw.match(/^([A-Za-z]{2})([A-Za-z0-9]+)$/);
                    const isEu = euMatch && euMatch[1].toUpperCase() !== "RO" && euMatch[2].length >= 2;
                    const digits = raw.replace(/^RO/i, "").replace(/[^0-9]/g, "");

                    if (isEu) {
                      return (
                        <button
                          type="button"
                          onMouseDown={e => {
                            e.preventDefault();
                            lookupCuiFromSearch(raw);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-sm font-semibold transition-colors"
                        >
                          <Search className="w-4 h-4" />
                          <span>
                            Caută CUI "{raw.toUpperCase()}" în VIES (UE)
                          </span>
                          {cuiLoading && (
                            <Loader2 className="w-4 h-4 animate-spin ml-auto" />
                          )}
                        </button>
                      );
                    }

                    if (digits.length >= 2) {
                      return (
                        <button
                          type="button"
                          onMouseDown={e => {
                            e.preventDefault();
                            lookupCuiFromSearch(raw);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-sm font-semibold transition-colors"
                        >
                          <Search className="w-4 h-4" />
                          <span>
                            Caută CUI "{digits}" în ANAF
                          </span>
                          {cuiLoading && (
                            <Loader2 className="w-4 h-4 animate-spin ml-auto" />
                          )}
                        </button>
                      );
                    }

                    return null;
                  })()}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            <label className={labelCls}>Data Emiterii *</label>
            <input
              type="date"
              value={issueDate}
              onChange={e => setIssueDate(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="lg:col-span-2">
            <label className={labelCls}>Data Scadenței</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <label className={labelCls}>Monedă</label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value as Currency)}
              className={selectCls}
            >
              <option value="RON">RON</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>

        {/* Row 2: Serie, Număr, Cont Bancar (IBAN) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-start">
          <div className="lg:col-span-2">
            <label className={labelCls}>Serie</label>
            <input
              list="series-suggestions"
              value={series}
              onChange={e => handleSeriesChange(e.target.value)}
              className={inputCls}
              placeholder="FACT, INV..."
            />
            <datalist id="series-suggestions">
              {seriesListData.map((s: string) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <div className="lg:col-span-3">
            <label className={labelCls}>Număr</label>
            <div className="relative flex items-center">
              {series.trim() ? (
                <div className="flex w-full items-center">
                  <span className="inline-flex items-center h-9 px-3 !rounded-l-md border border-r-0 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold tracking-wider select-none shrink-0">
                    {series.trim()} -
                  </span>
                  <input
                    value={invoiceNumDigits}
                    onChange={e => handleNumDigitsChange(e.target.value)}
                    className={cn(
                      inputCls,
                      "!rounded-l-none"
                    )}
                    placeholder="0001"
                  />
                </div>
              ) : (
                <input
                  value={invoiceNumDigits}
                  onChange={e => handleNumDigitsChange(e.target.value)}
                  className={inputCls}
                  placeholder="0001"
                />
              )}
              {nextNumberLoading && (
                <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-2.5 top-2.5 text-blue-500" />
              )}
            </div>
          </div>

          <div className="sm:col-span-2 lg:col-span-7">
            <label className={labelCls}>Cont Bancar (IBAN Factură)</label>
            <select
              value={selectedIban}
              onChange={e => {
                const chosen = bankAccounts.find((a: any) => a.iban === e.target.value);
                if (chosen) {
                  setSelectedIban(chosen.iban);
                  setSelectedBank(chosen.bank || "");
                } else {
                  setSelectedIban(e.target.value);
                }
              }}
              className={selectCls}
            >
              {bankAccounts.length === 0 && (
                <option value="">Fără cont bancar definit</option>
              )}
              {bankAccounts.map((a: any, i: number) => (
                <option key={a.id || i} value={a.iban}>
                  [{a.currency || "RON"}] {a.iban} {a.bank ? `(${a.bank})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowAdvancedClientInfo(!showAdvancedClientInfo)}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            {showAdvancedClientInfo ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
            {showAdvancedClientInfo
              ? "Ascunde Informații Opționale Client"
              : "Arată Informații Opționale Client (CUI, Adresă, etc.)"}
          </button>
        </div>

        {showAdvancedClientInfo && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-start">
              <div className="lg:col-span-3">
                <label className={labelCls}>
                  CUI / CIF
                  {cuiLoading && (
                    <Loader2 className="w-3 h-3 ml-1 inline animate-spin text-blue-500" />
                  )}
                </label>
                <input
                  value={clientCUI}
                  onChange={e => {
                    const val = e.target.value;
                    setClientCUI(val);
                    const m = val.trim().match(/^([A-Za-z]{2})/);
                    if (m && m[1].toUpperCase() !== "RO") {
                      setClientCountry(m[1].toUpperCase());
                    }
                  }}
                  onBlur={lookupCui}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      lookupCui();
                    }
                  }}
                  className={inputCls}
                  placeholder="ex: RO12345678 sau DE123456789 (VIES)"
                />
              </div>
              <div className="lg:col-span-3">
                <label className={labelCls}>Reg. Com.</label>
                <input
                  value={clientRegCom}
                  onChange={e => setClientRegCom(e.target.value)}
                  className={inputCls}
                  placeholder="ex: J40/123/2020"
                />
              </div>
              <div className="lg:col-span-3">
                <label className={labelCls}>Telefon Client</label>
                <input
                  value={clientPhone}
                  onChange={e => setClientPhone(e.target.value)}
                  className={inputCls}
                  placeholder="ex: 0722123456"
                />
              </div>
              <div className="lg:col-span-3">
                <label className={labelCls}>Email</label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={e => setClientEmail(e.target.value)}
                  className={inputCls}
                  placeholder="ex: client@exemplu.ro"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-start">
              <div className="sm:col-span-2 lg:col-span-6">
                <label className={labelCls}>Adresă</label>
                <input
                  value={clientAddress}
                  onChange={e => setClientAddress(e.target.value)}
                  className={inputCls}
                  placeholder="ex: Str. Florilor nr. 1"
                />
              </div>
              <div className="lg:col-span-4">
                <label className={labelCls}>Localitate</label>
                <input
                  value={clientCity}
                  onChange={e => setClientCity(e.target.value)}
                  className={inputCls}
                  placeholder="ex: București"
                />
              </div>
              <div className="lg:col-span-2">
                <label className={labelCls}>Țară</label>
                <input
                  value={clientCountry}
                  placeholder="RO, BE..."
                  maxLength={2}
                  onChange={e => setClientCountry(e.target.value.toUpperCase())}
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xs overflow-hidden">
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
        <div className="hidden md:grid grid-cols-12 gap-0 bg-[#1e1b4b] dark:bg-slate-800 text-white text-[11px] font-bold uppercase tracking-wider">
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
              className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-12 gap-3 md:gap-0 items-start md:items-center hover:bg-slate-50 dark:hover:bg-slate-800/30 p-4 md:p-0 border-b border-slate-200 dark:border-slate-800 md:border-b-0"
            >
              {showCodes && (
                <div className="col-span-2 sm:col-span-4 md:col-span-1 px-0 md:px-3 py-1 md:py-2 h-full flex flex-col md:flex-row md:items-center">
                  <label className="md:hidden text-[10px] font-bold text-slate-500 uppercase mb-1">Cod</label>
                  <input
                    type="text"
                    placeholder="Cod..."
                    value={line.devizCode || ""}
                    onChange={e =>
                      updateLine(line.id, "devizCode", e.target.value)
                    }
                    className="w-full h-8 px-2 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}
              <div
                className={cn(
                  "px-0 md:px-3 py-1 md:py-2 relative h-full flex flex-col justify-center col-span-2 sm:col-span-4",
                  showCodes
                    ? "md:col-span-4 md:border-l border-slate-100 dark:border-slate-800"
                    : "md:col-span-5"
                )}
              >
                <label className="md:hidden text-[10px] font-bold text-slate-500 uppercase mb-1">Denumire Produs / Serviciu</label>
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
                {focusedLineId === line.id && (
                  <div className="absolute top-11 left-0 right-0 md:left-3 md:right-3 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl max-h-72 overflow-y-auto rounded-md">
                    {matchingProducts.length > 0 && (
                      <div>
                        <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
                          <span>📦 Produsele Tale Salvate ({matchingProducts.length})</span>
                          <span className="text-[9px] text-blue-600 dark:text-blue-400 font-normal lowercase">completează automat U.M. și prețul</span>
                        </div>
                        {matchingProducts.map((p: any) => (
                          <button
                            key={`prod-${p.id}`}
                            type="button"
                            onMouseDown={e => {
                              e.preventDefault();
                              handleSelectProduct(line.id, p);
                            }}
                            className="w-full text-left px-3 py-2 border-b border-slate-100 dark:border-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-between gap-2"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                {p.name}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                  U.M: {p.unit || "buc"}
                                </span>
                                <span>Preț: {p.defaultPrice} {currency}</span>
                                {p.defaultVatRate !== undefined && (
                                  <span>TVA: {p.defaultVatRate}%</span>
                                )}
                              </div>
                            </div>
                            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap">
                              Selectează &rarr;
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {catalogData?.items && catalogData.items.length > 0 && (
                      <div>
                        <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                          Catalog Devize & Norme
                        </div>
                        {catalogData.items.map((item: any, i: number) => (
                          <button
                            key={`cat-${i}`}
                            type="button"
                            onMouseDown={e => {
                              e.preventDefault();
                              handleSelectFromCatalog(line.id, item);
                            }}
                            className="w-full text-left px-3 py-2 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                          >
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[9px] font-bold px-1.5 py-0.5 uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                {item.tip}
                              </span>
                              <span className="text-xs font-medium text-slate-500">
                                {item.cod}
                              </span>
                            </div>
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              {item.denumire}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {matchingProducts.length === 0 &&
                      (!catalogData?.items || catalogData.items.length === 0) &&
                      catalogQuery.trim().length > 0 && (
                        <div className="p-3 text-xs text-slate-500 text-center">
                          Produs nou. Va fi salvat automat în nomenclator cu U.M. și prețul ales la emitere.
                        </div>
                      )}
                  </div>
                )}
              </div>
              <div className="col-span-1 md:col-span-1 px-0 md:px-2 py-1 md:py-2 md:border-l border-slate-100 dark:border-slate-800 h-full flex flex-col justify-center">
                <label className="md:hidden text-[10px] font-bold text-slate-500 uppercase mb-1">U.M.</label>
                <select
                  value={line.unit}
                  onChange={e => updateLine(line.id, "unit", e.target.value)}
                  className="w-full h-8 px-1 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {!UNITS.includes(line.unit) && (
                    <option value={line.unit}>{line.unit}</option>
                  )}
                  {UNITS.map(u => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-1 md:col-span-1 px-0 md:px-2 py-1 md:py-2 md:border-l border-slate-100 dark:border-slate-800 flex flex-col justify-center">
                <label className="md:hidden text-[10px] font-bold text-slate-500 uppercase mb-1">Cant.</label>
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
                  className="w-full h-8 px-2 text-sm text-center md:text-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-1 md:col-span-1 px-0 md:px-2 py-1 md:py-2 md:border-l border-slate-100 dark:border-slate-800 flex flex-col justify-center">
                <label className="md:hidden text-[10px] font-bold text-slate-500 uppercase mb-1">TVA (%)</label>
                <select
                  value={
                    !isNaN(parseFloat(String(line.vatRate)))
                      ? parseFloat(String(line.vatRate))
                      : 21
                  }
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
              <div className="col-span-1 md:col-span-2 px-0 md:px-2 py-1 md:py-2 md:border-l border-slate-100 dark:border-slate-800 flex flex-col justify-center">
                <label className="md:hidden text-[10px] font-bold text-slate-500 uppercase mb-1">Preț (fără TVA)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.unitPrice}
                  onChange={e =>
                    updateLine(line.id, "unitPrice", e.target.value)
                  }
                  className="w-full h-8 px-2 text-sm text-left md:text-right border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-1 md:col-span-1 px-0 md:px-3 py-1 md:py-2 md:border-l border-slate-100 dark:border-slate-800 flex flex-col justify-center md:items-end">
                <label className="md:hidden text-[10px] font-bold text-slate-500 uppercase mb-1">Valoare</label>
                <span className="text-sm font-semibold text-slate-900 dark:text-white h-8 flex items-center justify-end">
                  {formatCurrency(computeLineTotal(line), currency)}
                </span>
              </div>
              <div className="col-span-1 md:col-span-1 px-0 md:px-2 py-1 md:py-2 md:border-l border-slate-100 dark:border-slate-800 flex items-center justify-end md:justify-center">
                {lines.length > 1 && (
                  <button
                    onClick={() => removeLine(line.id)}
                    className="w-8 h-8 md:w-7 md:h-7 flex items-center justify-center rounded text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 md:w-3.5 md:h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-0">
          <div className="lg:col-span-7 px-4 py-3 flex gap-2 flex-wrap">
            <button
              onClick={addLine}
              className="flex items-center gap-1.5 px-3 h-8 text-xs font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Adaugă rând liber
            </button>
          </div>
          <div className="lg:col-span-5 px-4 py-3 lg:border-l border-slate-200 dark:border-slate-700 space-y-1 bg-slate-50/50 dark:bg-slate-800/20 lg:bg-transparent">
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
      <div className="flex items-center justify-end gap-5 pb-4 flex-nowrap">
        {/* Toggle Creare Deviz - strict pe un singur rând */}
        <label className="inline-flex items-center gap-2 cursor-pointer select-none whitespace-nowrap shrink-0">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
            Creare Deviz
          </span>
          <Switch
            checked={createDeviz}
            onCheckedChange={setCreateDeviz}
          />
        </label>

        <button
          onClick={() => handleSave("draft")}
          disabled={saving}
          className="flex items-center gap-1.5 px-6 h-10 rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
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
          className="flex items-center gap-1.5 px-8 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Previzualizare / Emite Factura
        </button>
      </div>
    </div>
  );
}
