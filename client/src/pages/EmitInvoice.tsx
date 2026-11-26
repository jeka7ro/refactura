// EmitInvoice.tsx — Creare Factură Nouă — Layout inspirat din Oblio
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useLocation, useParams, Link } from "wouter";
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
  Calculator,
  Mail,
  ShieldCheck,
  Lock,
  RotateCcw,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { formatCurrency, currencies, type Currency } from "@/lib/store";
import { cn, cleanErrorMessage } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { InvoiceCurrencyCalculator } from "@/components/InvoiceCurrencyCalculator";
import { BnrInvoiceRateToggle } from "@/components/BnrInvoiceRateToggle";
import { ContractInvoiceToggle } from "@/components/ContractInvoiceToggle";

const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI",
  "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT",
  "NL", "PL", "PT", "SE", "SI", "SK",
]);

export const REVERSE_CHARGE_LEGAL_TEXT =
  "VAT reverse charge – VAT to be accounted for by the recipient in accordance with Article 196 of Council Directive 2006/112/EC";

export const isReverseChargeNotePresent = (notes: string): boolean => {
  return /VAT\s+reverse\s+charge/i.test(notes || "") || /taxare\s+invers[aă].*196/i.test(notes || "");
};

export const removeReverseChargeNote = (text: string): string => {
  return (text || "")
    .split("\n")
    .filter(line => !/VAT\s+reverse\s+charge/i.test(line) && !/taxare\s+invers[aă].*196/i.test(line))
    .join("\n")
    .trim();
};

export const addReverseChargeNote = (text: string): string => {
  const cleaned = removeReverseChargeNote(text);
  return cleaned ? `${cleaned}\n${REVERSE_CHARGE_LEGAL_TEXT}` : REVERSE_CHARGE_LEGAL_TEXT;
};

const VAT_RATES = [21, 11, 19, 9, 5, 0];
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
  nirLineId?: number;
  total?: number;
  lineOrder?: number;
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
  "w-full h-9 px-3 text-[16px] sm:text-[13px] border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] !rounded-xl text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] focus:outline-none focus:border-[#0071e3] transition-colors";
const selectCls =
  "w-full h-9 px-3 text-[16px] sm:text-[13px] border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] !rounded-xl text-[#1d1d1f] dark:text-[#f5f5f7] focus:outline-none focus:border-[#0071e3] cursor-pointer transition-colors";
const labelCls =
  "block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1";

export default function EmitInvoice() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  // Client fields
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientCode, setClientCode] = useState("");
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
    let n = invoiceNumDigits.trim();
    if (!s) return n;
    if (!n) return s;
    // Strip series prefix if already present in n (prevents FACT-FACT 0009)
    const prefixRegex = new RegExp(`^${s}[\\s_-]*`, "i");
    n = n.replace(prefixRegex, "").trim();
    if (s.startsWith("WOOD")) {
      return `${s} ${n}`;
    }
    return `${s}-${n}`;
  }, [series, invoiceNumDigits]);
  const [currency, setCurrency] = useState<Currency>("RON");
  const [issueDate, setIssueDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
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
  const [dataContract, setDataContract] = useState("");
  const [mentiuni, setMentiuni] = useState("");
  const [createDeviz, setCreateDeviz] = useState(false);
  const [sendEmailToClient, setSendEmailToClient] = useState(false);
  const [isReverseCharge, setIsReverseCharge] = useState(false);
  const userManualReverseChargeRef = useRef(false);
  const autoReverseChargeRef = useRef(false);
  const [isQrPontajActive, setIsQrPontajActive] = useState(false);
  const [loadingQrPontaj, setLoadingQrPontaj] = useState(false);
  const [qrDevizNominal, setQrDevizNominal] = useState<any[]>([]);
  const [qrTenantId, setQrTenantId] = useState<number>(2);
  const [qrMonth, setQrMonth] = useState<number>(() => {
    const d = new Date();
    return d.getMonth() + 1;
  });
  const [qrYear, setQrYear] = useState<number>(() => {
    const d = new Date();
    return d.getFullYear();
  });

  const { data: qrTenantsData } = trpc.qrPontaj.getTenants.useQuery(undefined, {
    enabled: isQrPontajActive,
    staleTime: 60000,
  });

  const { data: bnrData } = trpc.system.getBnrRates.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const { data: bnrRateQuery } = trpc.system.getBnrRateForDate.useQuery(
    { date: issueDate || new Date().toISOString().split("T")[0], currency },
    { enabled: currency !== "RON" && !!issueDate }
  );

  const currentBnrRateForInvoice = useMemo(() => {
    if (bnrRateQuery?.rate) return bnrRateQuery.rate;
    if (!bnrData) return null;
    let targetRate =
      bnrData.rates?.[currency] ||
      (currency === "EUR" ? 5.3370 : currency === "USD" ? 4.7571 : currency === "GBP" ? 6.3104 : 1);
    if (issueDate && Array.isArray(bnrData.history) && bnrData.history.length > 0) {
      let matched = bnrData.history.find((h: any) => h.date === issueDate);
      if (!matched) {
        const sortedPrior = [...bnrData.history]
          .filter((h: any) => h.date <= issueDate)
          .sort((a: any, b: any) => b.date.localeCompare(a.date));
        if (sortedPrior.length > 0) {
          matched = sortedPrior[0];
        }
      }
      if (matched && (matched as any)[currency]) {
        targetRate = (matched as any)[currency];
      }
    }
    return targetRate;
  }, [bnrRateQuery, bnrData, issueDate, currency]);

  const [invoiceBnrRate, setInvoiceBnrRate] = useState<number | null>(null);
  const effectiveInvoiceBnrRate =
    invoiceBnrRate ||
    currentBnrRateForInvoice ||
    (bnrData?.rates?.[currency] ?? (currency === "EUR" ? 5.3370 : currency === "USD" ? 4.7571 : 1));
  const effectiveBnrRateDate = bnrRateQuery?.date || issueDate;

  const [appliedQrExchangeRate, setAppliedQrExchangeRate] = useState<number | null>(null);
  const [qrPricePerUser, setQrPricePerUser] = useState<string>("3.50");
  const [rawQrData, setRawQrData] = useState<any>(null);

  const qrTenantsList = useMemo(() => {
    if (qrTenantsData && Array.isArray(qrTenantsData)) {
      return qrTenantsData;
    }
    return [];
  }, [qrTenantsData]);

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
  const { data: searchPartnersData } = trpc.clients.searchPartners.useQuery({
    query: clientSearch || clientName || undefined,
    onlyClients: true,
  });
  const { data: productsData } = trpc.products.list.useQuery();
  const { data: seriesListData = [] } = trpc.emittedInvoice.seriesList.useQuery();
  const { data: nextNumber, isFetching: nextNumberLoading } =
    trpc.emittedInvoice.nextNumber.useQuery(
      { series },
      { enabled: !editId }
    );
  const { data: currentTenantObj } = trpc.tenants.current.useQuery();
  const { data: tenantsData = [] } = trpc.tenants.list.useQuery();
  const tenant =
    currentTenantObj ||
    (tenantsData as any[])[0]?.tenants ||
    (tenantsData as any[])[0];

  const sourceId = stornoId || editId;
  const { data: originalInvoice } = trpc.emittedInvoice.getById.useQuery(
    { id: parseInt(sourceId!) },
    { enabled: !!sourceId }
  );

  const isSpvValidated = Boolean(
    editId &&
    originalInvoice &&
    ((originalInvoice as any).spvStatus === "validat" || Boolean((originalInvoice as any).spvIndex))
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
          toast.warning("Factura a fost emisă, dar actualizarea stocului NIR a întâmpinat o eroare.");
        }
      }

      utils.emittedInvoice.list.invalidate();
      if ((data as any)?.emailSent) {
        toast.success(`Factura a fost creată și trimisă cu succes pe email la ${clientEmail.trim()}!`);
      } else if ((data as any)?.emailError) {
        toast.warning(`Factura a fost creată, dar trimiterea pe email a eșuat: ${(data as any).emailError}`);
      } else {
        toast.success("Factura a fost creată cu succes!");
      }
      navigate("/facturi-emise-nou");
    },
  });

  const updateMutation = trpc.emittedInvoice.update.useMutation();

  const devizeUpdateMutation = trpc.devize.update.useMutation();

  const clients = useMemo(
    () => (clientsData || []).filter((c: any) => c.isSupplier !== 1),
    [clientsData]
  );
  const partnerResults = searchPartnersData || [];
  const filteredClients = useMemo(() => {
    if (partnerResults.length > 0) return partnerResults;
    const q = (clientName || clientSearch || "").trim().toLowerCase();
    if (!q) return clients.slice(0, 10);
    return clients.filter(
      (c: any) =>
        c.name.toLowerCase().includes(q) ||
        (c.cui || "").toLowerCase().includes(q) ||
        (c.sagaCode || c.code || "").toLowerCase().includes(q)
    );
  }, [partnerResults, clients, clientName, clientSearch]);

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
    if (series) {
      const prefixRegex = new RegExp(`^${series.trim()}[\\s_-]*`, "i");
      clean = clean.replace(prefixRegex, "");
    }
    const match = clean.match(/^([A-Za-z0-9_-]+?)[\s_-]+(.*)$/);
    if (match && !/^\d+$/.test(match[1])) {
      if (!series || series === "FACT") {
        setSeries(match[1].toUpperCase());
      }
      clean = match[2];
    }
    setInvoiceNumDigits(clean);
  };

  useEffect(() => {
    if (!editId && nextNumber) {
      const match = nextNumber.match(/^([A-Za-z0-9_-]+?)[\s_-]+(.*)$/);
      if (match) {
        setSeries(match[1]);
        let digits = match[2];
        const prefixRegex = new RegExp(`^${match[1]}[\\s_-]*`, "i");
        digits = digits.replace(prefixRegex, "").trim();
        setInvoiceNumDigits(digits);
      } else {
        setInvoiceNumDigits(nextNumber);
      }
    }
  }, [nextNumber, editId]);

  // Set default series from seriesListData (e.g. WOODR for RoWood)
  useEffect(() => {
    if (!editId && seriesListData.length > 0 && (series === "FACT" || !series)) {
      if (!seriesListData.includes("FACT")) {
        setSeries(seriesListData[0]);
      }
    }
  }, [seriesListData, editId, series]);

  // Switch between external and internal series on currency change if available
  useEffect(() => {
    if (!editId && seriesListData.length > 0) {
      if (currency !== "RON" && seriesListData.includes("WOODE") && series === "WOODR") {
        setSeries("WOODE");
      } else if (currency === "RON" && seriesListData.includes("WOODR") && series === "WOODE") {
        setSeries("WOODR");
      }
    }
  }, [currency, seriesListData, editId, series]);

  // Support ?clientId= in query string
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const cId = searchParams.get("clientId");
    if (cId && clientsData && clientsData.length > 0 && !editId && !stornoId && !selectedClientId) {
      const match = clientsData.find((c: any) => String(c.id) === cId);
      if (match) {
        setSelectedClientId(String(match.id));
        setClientName(match.name || "");
        setClientCode((match as any).sagaCode || "");
        setClientCUI(match.cui || "");
        setClientRegCom(match.regCom || "");
        setClientAddress(match.address || "");
        setClientCity(match.city || "");
        const invCountry =
          match.country ||
          (match.cui?.trim().match(/^([A-Za-z]{2})/)?.[1]?.toUpperCase() || "RO");
        setClientCountry(invCountry);
        setClientEmail(match.email || "");
        if (match.email && match.email.includes("@")) {
          setSendEmailToClient(true);
        }
        setClientPhone(match.phone || "");
        if (match.currency && (match.currency === "RON" || match.currency === "EUR" || match.currency === "USD")) {
          setCurrency(match.currency as Currency);
        }
        if (match.address || match.city || (match as any).sagaCode || (invCountry && invCountry !== "RO")) {
          setShowAdvancedClientInfo(true);
        }
      }
    }
  }, [clientsData, editId, stornoId, selectedClientId]);

  // Pre-fill Edit or Storno data
  useEffect(() => {
    if (originalInvoice && sourceId) {
      if (originalInvoice.clientId)
        setSelectedClientId(String(originalInvoice.clientId));
      setClientName(originalInvoice.clientName || "");
      setClientCode((originalInvoice as any).clientCode || "");
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
        (originalInvoice as any).clientCode ||
        (invCountry && invCountry !== "RO")
      ) {
        setShowAdvancedClientInfo(true);
      }
      setCurrency((originalInvoice.currency || "RON") as Currency);
      const cursMatch = (originalInvoice.notes || "").match(/curs\s+([0-9]+[.,][0-9]+)/i);
      if (cursMatch) {
        const parsed = parseFloat(cursMatch[1].replace(",", "."));
        if (parsed > 0) setInvoiceBnrRate(parsed);
      }
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

  // Sync reverse charge toggle if loaded notes already have the legal mention
  useEffect(() => {
    if (isReverseChargeNotePresent(mentiuni) && !isReverseCharge) {
      setIsReverseCharge(true);
    }
  }, [mentiuni, isReverseCharge]);

  // Auto-enable Reverse Charge ONLY for EU foreign clients (unless manually toggled)
  useEffect(() => {
    if (userManualReverseChargeRef.current) return;

    const normalizedCountry = (clientCountry || "RO").trim().toUpperCase();
    const isEuForeign =
      normalizedCountry !== "RO" && EU_COUNTRIES.has(normalizedCountry);

    if (isEuForeign && !isReverseCharge) {
      autoReverseChargeRef.current = true;
      setIsReverseCharge(true);
      setMentiuni(prev => addReverseChargeNote(prev));
      setLines(prev =>
        prev.map(l =>
          l.vatRate === 21 || l.vatRate === 19 || l.vatRate === 11
            ? { ...l, vatRate: 0 }
            : l
        )
      );
    } else if (!isEuForeign && isReverseCharge) {
      if (autoReverseChargeRef.current) {
        autoReverseChargeRef.current = false;
        setIsReverseCharge(false);
        setMentiuni(prev => removeReverseChargeNote(prev));
        setLines(prev =>
          prev.map(l => (l.vatRate === 0 ? { ...l, vatRate: 21 } : l))
        );
      } else if (!isReverseChargeNotePresent(mentiuni)) {
        setIsReverseCharge(false);
      }
    }
  }, [clientCountry, isReverseCharge, mentiuni]);

  const [cuiLoading, setCuiLoading] = useState(false);

  const selectClient = (c: any) => {
    setSelectedClientId(c.source === "client" ? String(c.id) : "");
    setClientName(c.name);
    setClientSearch(c.name);
    const code = c.sagaCode || c.code || "";
    setClientCode(code);
    const rawCui = (c.cui || "").trim().toUpperCase();
    const isVat = c.tva === 1 || c.tva === true || rawCui.startsWith("RO");
    const formattedCui =
      isVat && !rawCui.startsWith("RO") && /^\d+$/.test(rawCui)
        ? `RO${rawCui}`
        : rawCui;
    setClientCUI(formattedCui);
    setClientRegCom(c.regCom || "");
    setClientAddress(c.address || "");
    setClientCity(c.city || "");
    const cuiCountry = (c.cui || "").trim().match(/^([A-Za-z]{2})/)?.[1]?.toUpperCase();
    const resolvedCountry =
      c.country && c.country !== "RO" ? c.country : (cuiCountry || c.country || "RO");
    setClientCountry(resolvedCountry);
    setClientEmail(c.email || "");
    if (c.email && c.email.includes("@")) {
      setSendEmailToClient(true);
    }
    setClientPhone(c.phone || "");
    if (c.address || c.city || code || (resolvedCountry && resolvedCountry !== "RO")) {
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
        // Operator validat în VIES
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
      if (d.cui || d.cif) {
        setClientCUI(d.cif || d.cui);
      }
      toast.success("Date extrase de la ANAF cu succes.");
    } catch {
      toast.error("Eroare conexiune la ANAF.");
    } finally {
      setCuiLoading(false);
    }
  };

  const lookupCuiFromSearch = async (searchTerm: string) => {
    const clean = searchTerm.trim().replace(/\s/g, "");
    const euCountryCodes = ["AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "EL", "ES", "FI", "FR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "SE", "SI", "SK"];
    const euMatch = clean.match(/^([A-Za-z]{2})([0-9A-Za-z]+)$/);
    const isEuForeign = euMatch && euCountryCodes.includes(euMatch[1].toUpperCase()) && /\d/.test(euMatch[2]);

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
        const resolvedCui = d.cif || d.cui || (d.tva ? `RO${digits}` : digits);
        setClientCUI(resolvedCui);
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

  const handleToggleReverseCharge = (checked: boolean) => {
    userManualReverseChargeRef.current = true;
    setIsReverseCharge(checked);
    if (checked) {
      setMentiuni(prev => addReverseChargeNote(prev));
      setLines(prev =>
        prev.map(l => (l.vatRate === 21 || l.vatRate === 19 || l.vatRate === 11 ? { ...l, vatRate: 0 } : l))
      );
      toast.success("Taxare Inversă activată: Cota TVA setată la 0% și mențiunea Art. 196 adăugată pe factură.");
    } else {
      setMentiuni(prev => removeReverseChargeNote(prev));
      setLines(prev =>
        prev.map(l => (l.vatRate === 0 ? { ...l, vatRate: 21 } : l))
      );
      toast.info("Taxare Inversă dezactivată.");
    }
  };

  const applyCalculatedLinesAndDeviz = (data: any, priceEur: number, rate: number) => {
    if (!data) return;
    const basePriceEur = priceEur > 0 ? priceEur : 3.5;

    if (data.invoice_lines && data.invoice_lines.length > 0) {
      const mappedLines: Line[] = data.invoice_lines.map((il: any, idx: number) => {
        const isReduced = il.unit_price_eur && il.unit_price_eur < (data.invoice_lines[0]?.unit_price_eur || 3.5);
        const lineUnitEur = isReduced ? (basePriceEur * 0.5) : basePriceEur;
        const unitPriceRon = Math.round(lineUnitEur * rate * 100) / 100;
        const lineBaseRon = Math.round(il.quantity * unitPriceRon * 100) / 100;

        return {
          id: `qr-line-${idx}-${Date.now()}`,
          description: il.description,
          quantity: il.quantity,
          unit: il.unit || il.unit_measure || "pers",
          unitPrice: unitPriceRon,
          vatRate: il.vat_percent ?? il.tva_percent ?? 21,
          total: lineBaseRon,
          lineOrder: idx,
          devizCode: `QR-${idx + 1}`,
        };
      });
      setLines(mappedLines);
    }

    const countEmployees = data.deviz_nominal?.length || 0;
    const contractRef = data.client?.contract_reference || "Contract SaaS Nr. 9 din 09.09.2026";
    const rateText = ` (${basePriceEur.toFixed(2)} EUR/persoană, Curs BNR: 1 EUR = ${rate.toFixed(4)} RON din data emiterii)`;
    const noteMention = `Conform ${contractRef}${rateText}. Anexă deviz nominal Smart QR Pontaj (${countEmployees} angajați) atașată.`;
    setMentiuni(prev => {
      if (!prev || !prev.trim()) return noteMention;
      const cleanPrev = prev
        .split("\n")
        .filter(l => !l.includes("Smart QR Pontaj") && !l.includes("Contract SaaS"))
        .join("\n")
        .trim();
      return cleanPrev ? `${cleanPrev}\n${noteMention}` : noteMention;
    });
    setNumarContract(contractRef);

    setCreateDeviz(true);

    if (data.deviz_nominal && data.deviz_nominal.length > 0) {
      const nominalLines = data.deviz_nominal.map((emp: any, i: number) => {
        const ratePercent = emp.rate_percent || 100;
        const empAmountEur = (ratePercent / 100) * basePriceEur;
        const empAmountRon = Math.round(empAmountEur * rate * 100) / 100;

        return {
          type: "MANOPERA" as const,
          code: `EMP-${emp.employee_id || i + 1}`,
          description: `${emp.name} (${emp.job_title}) - Activ ${emp.days_active}/${emp.days_in_month} zile (${emp.interval_activ})`,
          quantity: 1,
          unitPrice: empAmountRon,
          total: empAmountRon,
        };
      });
      setQrDevizNominal(nominalLines);
    } else {
      setQrDevizNominal([]);
    }
  };

  const fetchAndApplyQrData = async (tenantId: number, month: number, year: number, forceRate?: number) => {
    setLoadingQrPontaj(true);
    try {
      const rateToUse = forceRate ?? currentBnrRateForInvoice ?? undefined;
      let data: any = null;
      try {
        const trpcRes = await utils.client.qrPontaj.getDeviz.query({
          tenantId,
          month,
          year,
          exchangeRate: rateToUse,
        });
        data = trpcRes;
      } catch (trpcErr) {
        if (!import.meta.env.DEV) {
          throw trpcErr;
        }
        let directUrl = `http://localhost:5001/api/billing/deviz?tenant_id=${tenantId}&month=${month}&year=${year}`;
        if (rateToUse) {
          directUrl += `&exchange_rate=${rateToUse}`;
        }
        const directRes = await fetch(directUrl);
        if (!directRes.ok) {
          throw new Error(`Eroare comunicare QR Pontaj (Status ${directRes.status})`);
        }
        data = await directRes.json();
      }

      if (!data) {
        throw new Error("Nu s-au putut prelua datele din QR Pontaj");
      }

      if (data.error) {
        toast.warning(data.error);
        return;
      }

      setRawQrData(data);

      const effectiveRate = data.exchange_rate ? Number(data.exchange_rate) : (rateToUse || 5.3370);
      setAppliedQrExchangeRate(effectiveRate);

      const basePriceEur = Number(data.invoice_lines?.[0]?.unit_price_eur || data.deviz_nominal?.[0]?.unit_price_eur || 3.5);
      setQrPricePerUser(basePriceEur.toFixed(2));

      const partnerName = data.client?.name || "Client";
      setClientName(partnerName);
      setClientSearch(partnerName);
      if (clientsData && clientsData.length > 0) {
        const found = clientsData.find((c: any) =>
          c.name.toLowerCase().includes(partnerName.toLowerCase()) ||
          (c.cui && data.client?.cui && c.cui.includes(data.client.cui))
        );
        if (found) {
          selectClient(found);
        }
      }

      setCurrency("RON");

      applyCalculatedLinesAndDeviz(data, basePriceEur, effectiveRate);

      const countEmployees = data.deviz_nominal?.length || 0;
      toast.success(`Datele din Smart QR Pontaj au fost preluate (${countEmployees} angajați).`);
    } catch (err: any) {
      console.error("Eroare preluare QR Pontaj:", err);
      toast.error(`Nu s-au putut prelua datele: ${err.message}`);
    } finally {
      setLoadingQrPontaj(false);
    }
  };

  const handleToggleQrPontaj = async (checked: boolean) => {
    setIsQrPontajActive(checked);
    if (!checked) {
      toast.info("Preluarea automată Smart QR a fost dezactivată.");
      return;
    }
    await fetchAndApplyQrData(qrTenantId, qrMonth, qrYear);
  };

  const handleQrParamChange = async (tenantId: number, month: number, year: number) => {
    setQrTenantId(tenantId);
    setQrMonth(month);
    setQrYear(year);
    await fetchAndApplyQrData(tenantId, month, year);
  };

  const addLine = () =>
    setLines(prev => {
      const defaultVat = isReverseCharge ? 0 : 21;
      const lastVat =
        prev.length > 0 && prev[prev.length - 1].vatRate !== undefined
          ? prev[prev.length - 1].vatRate
          : defaultVat;
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

  const [productPage, setProductPage] = useState(1);
  const PRODUCTS_PER_PAGE = 10;

  const filteredSavedProducts = useMemo(() => {
    const q = (catalogQuery || "").trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p: any) =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.unit && p.unit.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
    );
  }, [products, catalogQuery]);

  const totalProductPages = Math.ceil(filteredSavedProducts.length / PRODUCTS_PER_PAGE) || 1;

  const paginatedProducts = useMemo(() => {
    const start = (productPage - 1) * PRODUCTS_PER_PAGE;
    return filteredSavedProducts.slice(start, start + PRODUCTS_PER_PAGE);
  }, [filteredSavedProducts, productPage]);

  // Resetare la prima pagină când se schimbă căutarea sau linia selectată
  useEffect(() => {
    setProductPage(1);
  }, [catalogQuery, focusedLineId]);

  const matchingProducts = filteredSavedProducts;

  const handleSelectProduct = (lineId: string, p: any) => {
    setLines(prev =>
      prev.map(l => {
        if (l.id === lineId) {
          const chosenVat = isReverseCharge
            ? 0
            : p.defaultVatRate !== undefined &&
              p.defaultVatRate !== null &&
              !isNaN(Number(p.defaultVatRate)) &&
              Number(p.defaultVatRate) > 0
            ? Number(p.defaultVatRate)
            : l.vatRate && l.vatRate > 0
            ? l.vatRate
            : 21;
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
          const chosenVat = isReverseCharge
            ? 0
            : item.vatRate !== undefined &&
              item.vatRate !== null &&
              !isNaN(Number(item.vatRate)) &&
              Number(item.vatRate) > 0
            ? Number(item.vatRate)
            : l.vatRate && l.vatRate > 0
            ? l.vatRate
            : 21;
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
    () => Math.round(lines.reduce((s, l) => s + computeLineTotal(l), 0) * 100) / 100,
    [lines]
  );
  const totalVAT = useMemo(
    () => Math.round(lines.reduce((s, l) => s + computeLineVAT(l), 0) * 100) / 100,
    [lines]
  );
  const total = Math.round((subtotal + totalVAT) * 100) / 100;

  const bnrNoteMatch = useMemo(() => {
    const m = mentiuni.match(
      /^(?:Curs BNR|Factură (?:emisă|calculată) la cursul BNR)[^\n]*/m
    );
    return m ? m[0] : null;
  }, [mentiuni]);

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
    isReverseCharge && !isReverseChargeNotePresent(mentiuni)
      ? addReverseChargeNote(mentiuni)
      : mentiuni,
    currency !== "RON" && !mentiuni.toLowerCase().includes("curs")
      ? `Curs ${currency} = ${effectiveInvoiceBnrRate.toFixed(4)} Lei (din ${effectiveBnrRateDate || issueDate})`
      : "",
    numarComanda ? `Comanda: ${numarComanda}` : "",
    numarContract && !mentiuni.toLowerCase().includes("contract")
      ? (dataContract ? `Contract: ${numarContract} din ${dataContract}` : `Contract: ${numarContract}`)
      : "",
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
    if (isSpvValidated) {
      toast.error("Această factură este deja validată în SPV și nu mai poate fi modificată. Conform legii fiscale, este necesară o factură de stornare.");
      return;
    }
    if (!clientName.trim()) {
      toast.error("Selectați sau introduceți un client");
      return;
    }
    if (lines.some(l => !l.description.trim())) {
      toast.error("Toate liniile trebuie să aibă descriere");
      return;
    }
    if (sendEmailToClient && (!clientEmail || !clientEmail.trim() || !clientEmail.includes("@"))) {
      toast.error("Vă rugăm să introduceți o adresă de email validă pentru client pentru a putea trimite factura pe email.");
      setShowAdvancedClientInfo(true);
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

      let finalClientCui = clientCUI.trim().toUpperCase();
      const clientObj: any = clientsData?.find((c: any) => String(c.id) === selectedClientId);
      const isClientVatPayer = clientObj?.tva === 1 || clientObj?.tva === true;
      if (detectedCountry === "RO" && (isClientVatPayer || totalVAT > 0)) {
        const cleanDigits = finalClientCui.replace(/^RO/i, "");
        if (/^\d+$/.test(cleanDigits)) {
          finalClientCui = `RO${cleanDigits}`;
        }
      }

      const payload = {
        number: fullInvoiceNumber,
        series: series.trim() || undefined,
        companyIBAN: selectedIban || undefined,
        companyBank: selectedBank || undefined,
        clientId: selectedClientId ? parseInt(selectedClientId) : undefined,
        clientName: clientName.trim(),
        clientCode: clientCode.trim() || undefined,
        clientCUI: finalClientCui || undefined,
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
        customDevizLines: qrDevizNominal.length > 0 ? qrDevizNominal : undefined,
        devizNotes: qrDevizNominal.length > 0 ? "Anexă deviz nominal Smart QR Pontaj" : undefined,
        sendEmailToClient,
        representativeName: delegat.trim() || undefined,
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
        // Sincronizăm devizul linked dacă există
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
        await utils.emittedInvoice.list.invalidate();
        toast.success("Factura a fost actualizată!");
        navigate("/facturi-emise-nou");
      } else {
        await createMutation.mutateAsync(payload);
      }
    } catch (err) {
      toast.error(
        cleanErrorMessage(
          err,
          editId ? "Eroare la actualizarea facturii." : "Eroare la crearea facturii."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-4 pb-20 sm:pb-28 overflow-x-hidden">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate("/facturi-emise-nou")}
            className="w-8 h-8 flex items-center justify-center rounded-full apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7] transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
              Emite Factură Nouă
            </h1>
            {tenant && (
              <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums truncate">
                {tenant.name}
                {tenant.cui ? ` • CUI: ${tenant.cui}` : ""}
              </p>
            )}
          </div>
        </div>
      </div>

      {isSpvValidated && (
        <div className="apple-surface border-amber-500/30 dark:border-amber-500/30 p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-amber-500/12 dark:bg-amber-500/18 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-[13.5px] text-[#1d1d1f] dark:text-[#f5f5f7]">Factură blocată la editare (Document oficial înregistrat în SPV)</p>
              <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 leading-relaxed">
                Această factură a fost deja transmisă și validată în RO e-Factura / SPV{(originalInvoice as any)?.spvIndex ? ` (Index: ${(originalInvoice as any)?.spvIndex})` : ""}. Conform legislației fiscale (OUG 120/2021 și Codul Fiscal art. 330), documentul original oficial nu mai poate fi modificat direct. Pentru corecții, emiteți o factură de stornare.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/facturi-emise-nou/view/${editId}`}>
              <button
                type="button"
                className="px-3.5 h-8 rounded-full apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-medium transition-colors cursor-pointer"
              >
                Vezi Factura
              </button>
            </Link>
            <Link href={`/facturi-emise-nou/storno/${editId}`}>
              <button
                type="button"
                className="flex items-center gap-1.5 px-3.5 h-8 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-[12.5px] font-semibold transition-all active:scale-[0.97] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Stornează Factura
              </button>
            </Link>
          </div>
        </div>
      )}

      <div className="apple-surface p-4 sm:p-5 space-y-4 !overflow-visible">
        {/* Date Factură: Serie, Număr, Data Emiterii, Data Scadenței, Monedă, Cont Bancar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end pb-3.5 border-b border-black/[0.05] dark:border-white/[0.07]">
          <div className="lg:col-span-1">
            <div className="h-6 flex items-center mb-1">
              <label className={labelCls + " !mb-0"}>Serie</label>
            </div>
            <input
              type="text"
              value={series}
              onChange={e => handleSeriesChange(e.target.value)}
              className={inputCls}
              placeholder="FACT"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="lg:col-span-2">
            <div className="h-6 flex items-center mb-1">
              <label className={labelCls + " !mb-0"}>Număr</label>
            </div>
            <div className="relative flex items-center">
              {series.trim() ? (
                <div className="flex w-full items-center">
                  <span className="inline-flex items-center h-9 px-2.5 !rounded-l-xl border border-r-0 border-black/[0.06] dark:border-white/[0.08] bg-[#e5e5ea] dark:bg-[#3a3a3c] text-[#1d1d1f] dark:text-[#f5f5f7] text-xs font-semibold tracking-wider select-none shrink-0 tabular-nums">
                    {series.trim()}{series.trim().startsWith("WOOD") ? "" : " -"}
                  </span>
                  <input
                    value={invoiceNumDigits}
                    onChange={e => handleNumDigitsChange(e.target.value)}
                    className={cn(inputCls, "!rounded-l-none tabular-nums")}
                    placeholder="0001"
                    autoComplete="off"
                  />
                </div>
              ) : (
                <input
                  value={invoiceNumDigits}
                  onChange={e => handleNumDigitsChange(e.target.value)}
                  className={cn(inputCls, "tabular-nums")}
                  placeholder="0001"
                  autoComplete="off"
                />
              )}
              {nextNumberLoading && (
                <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-2.5 top-2.5 text-[#6e6e73]" />
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="h-6 flex items-center mb-1">
              <label className={labelCls + " !mb-0"}>Data emiterii *</label>
            </div>
            <input
              type="date"
              value={issueDate}
              onChange={e => {
                const newDate = e.target.value;
                setIssueDate(newDate);
                if (newDate) {
                  const d = new Date(newDate + "T00:00:00");
                  if (!isNaN(d.getTime())) {
                    d.setDate(d.getDate() + 7);
                    setDueDate(d.toISOString().split("T")[0]);
                  }
                }
              }}
              className={cn(inputCls, "tabular-nums")}
            />
          </div>

          <div className="lg:col-span-2">
            <div className="h-6 flex items-center mb-1">
              <label className={labelCls + " !mb-0"}>Data scadenței</label>
            </div>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className={cn(inputCls, "tabular-nums")}
            />
          </div>

          <div className={currency !== "RON" ? "sm:col-span-1 lg:col-span-1" : "sm:col-span-1 lg:col-span-2"}>
            <div className="h-6 flex items-center mb-1">
              <label className={labelCls + " !mb-0"}>Monedă</label>
            </div>
            <select
              value={currency}
              onChange={e => {
                setCurrency(e.target.value as Currency);
                setInvoiceBnrRate(null);
              }}
              className={selectCls}
            >
              <option value="RON">RON</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
          </div>

          {currency !== "RON" && (
            <div className="sm:col-span-1 lg:col-span-2">
              <div className="h-6 flex items-center justify-between mb-1">
                <label className={labelCls + " !mb-0 text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1 truncate"}>
                  Curs BNR ({currency})
                </label>
                {effectiveBnrRateDate && (
                  <span className="text-[11px] text-[#8e8e93] tabular-nums" title="Data oficială a cursului BNR">
                    {effectiveBnrRateDate.split("-").reverse().join(".")}
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  value={invoiceBnrRate ?? effectiveInvoiceBnrRate}
                  onChange={e => {
                    const v = parseFloat(e.target.value);
                    setInvoiceBnrRate(isNaN(v) ? null : v);
                  }}
                  className={`${inputCls} font-semibold tabular-nums text-amber-700 dark:text-amber-300 pr-10`}
                  placeholder="5.3370"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#8e8e93] pointer-events-none">
                  Lei
                </span>
              </div>
            </div>
          )}

          <div className={currency !== "RON" ? "sm:col-span-2 lg:col-span-2" : "sm:col-span-2 lg:col-span-3"}>
            <div className="h-6 flex items-center mb-1">
              <label className={labelCls + " !mb-0 truncate"}>Cont bancar (IBAN factură)</label>
            </div>
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

        {/* Date Client (CUI, Nume, Reg Com, Cod SAGA, Țară, Adresă, Localitate, Contact) — ÎNTOTDEAUNA VIZIBIL DIRECT */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
              Date client / cumpărător
            </span>
            {clientCode && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11.5px] font-medium border border-amber-500/20">
                Cod SAGA: <strong className="tabular-nums font-semibold">{clientCode}</strong>
              </span>
            )}
          </div>

          {/* Rând 1 Client: CUI/CIF primul, Nume Client al doilea, Reg. Com., Cod SAGA, Țară */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-start">
            <div className="lg:col-span-3">
              <label className={labelCls}>
                CUI / CIF *
                {cuiLoading && (
                  <Loader2 className="w-3 h-3 ml-1 inline animate-spin text-[#6e6e73]" />
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
                placeholder="ex: RO12345678 sau 12345678"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-4 relative">
              <label className={labelCls}>Nume client / companie *</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Nume, CUI, Cod SAGA sau CIF..."
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
                  autoComplete="off"
                  spellCheck={false}
                />
                {showClientDropdown && (
                  <div className="absolute z-20 w-full mt-1.5 bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] rounded-2xl shadow-xl max-h-64 overflow-y-auto">
                    {filteredClients.length > 0 &&
                      filteredClients.map((c: any) => (
                        <button
                          key={`${c.source || 'c'}-${c.id}`}
                          type="button"
                          onMouseDown={() => selectClient(c)}
                          className="apple-card-btn w-full text-left px-3.5 py-2.5 hover:bg-[#f2f2f7] dark:hover:bg-[#2c2c2e] text-[13px] border-b border-black/[0.045] dark:border-white/[0.06] last:border-0 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
                              {c.name}
                            </span>
                            {(c.sagaCode || c.code) && (
                              <span className="shrink-0 px-1.5 py-0.5 text-[10.5px] tabular-nums font-medium rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                                Cod: {c.sagaCode || c.code}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums">
                            {c.cui && <span>CUI: {c.cui}</span>}
                            {c.city && <span>• {c.city}</span>}
                            {c.source === "saga_furnizor" && (
                              <span className="text-[10px] font-semibold text-[#0071e3] dark:text-[#409cff] bg-[#0071e3]/10 px-1.5 py-0.5 rounded">SAGA</span>
                            )}
                          </div>
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
                            className="apple-card-btn w-full flex items-center gap-2 px-3.5 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[13px] font-semibold transition-colors cursor-pointer"
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
                            className="apple-card-btn w-full flex items-center gap-2 px-3.5 py-2.5 bg-[#0071e3]/10 hover:bg-[#0071e3]/15 text-[#0071e3] dark:text-[#409cff] text-[13px] font-semibold transition-colors cursor-pointer"
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
              <label className={labelCls}>Reg. Com.</label>
              <input
                value={clientRegCom}
                onChange={e => setClientRegCom(e.target.value)}
                className={inputCls}
                placeholder="ex: J40/123/2020"
                autoComplete="off"
              />
            </div>

            <div className="lg:col-span-1">
              <label className={labelCls}>Cod SAGA</label>
              <input
                value={clientCode}
                onChange={e => setClientCode(e.target.value)}
                className={inputCls}
                placeholder="ex: 00001"
                autoComplete="off"
              />
            </div>

            <div className="lg:col-span-2">
              <label className={labelCls}>Țară</label>
              <input
                value={clientCountry}
                placeholder="RO, FR, BE..."
                maxLength={2}
                onChange={e => setClientCountry(e.target.value.toUpperCase())}
                className={inputCls}
                autoComplete="off"
              />
            </div>
          </div>

          {/* Rând 2 Client: Adresă, Localitate, Telefon, Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-start">
            <div className="sm:col-span-2 lg:col-span-5">
              <label className={labelCls}>Adresă</label>
              <input
                value={clientAddress}
                onChange={e => setClientAddress(e.target.value)}
                className={inputCls}
                placeholder="ex: Str. Florilor nr. 1"
                autoComplete="off"
              />
            </div>
            <div className="lg:col-span-3">
              <label className={labelCls}>Localitate</label>
              <input
                value={clientCity}
                onChange={e => setClientCity(e.target.value)}
                className={inputCls}
                placeholder="ex: Brașov"
                autoComplete="off"
              />
            </div>
            <div className="lg:col-span-2">
              <label className={labelCls}>Telefon client</label>
              <input
                value={clientPhone}
                onChange={e => setClientPhone(e.target.value)}
                className={inputCls}
                placeholder="ex: 0722123456"
                autoComplete="off"
              />
            </div>
            <div className="lg:col-span-2">
              <label className={labelCls}>Email</label>
              <input
                type="email"
                value={clientEmail}
                onChange={e => setClientEmail(e.target.value)}
                className={inputCls}
                placeholder="ex: client@exemplu.ro"
                autoComplete="off"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="apple-surface !overflow-visible">
        <div className="p-3.5 sm:px-4 bg-[#fafafa] dark:bg-white/[0.025] rounded-t-[16px] border-b border-black/[0.05] dark:border-white/[0.07] flex justify-between items-center flex-wrap gap-2">
          <h3 className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
            Linii factură
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <InvoiceCurrencyCalculator
              currentCurrency={currency}
              activeExchangeRate={effectiveInvoiceBnrRate}
              issueDate={issueDate}
              lines={lines.map((l, idx) => ({
                id: l.id,
                description: l.description || `Linia ${idx + 1}`,
                unitPrice: l.unitPrice,
              }))}
              onApplyPrice={(price, lineId) => {
                setLines(prev => {
                  if (!prev || prev.length === 0) {
                    return [{ ...defaultLine(), unitPrice: price, quantity: 1 }];
                  }
                  const targetIdx = lineId ? prev.findIndex(l => l.id === lineId) : 0;
                  const finalIdx = targetIdx >= 0 ? targetIdx : 0;
                  return prev.map((l, idx) => {
                    if (idx === finalIdx) {
                      return {
                        ...l,
                        unitPrice: price,
                        quantity:
                          !l.quantity || parseFloat(String(l.quantity)) === 0
                            ? 1
                            : l.quantity,
                      };
                    }
                    return l;
                  });
                });
              }}
              trigger={
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3.5 h-8 rounded-full apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-medium transition-colors cursor-pointer"
                  title="Calculator Valutar BNR"
                >
                  <Calculator className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Calculator Valutar</span>
                </button>
              }
            />
            <button
              type="button"
              onClick={() => setShowCodes(!showCodes)}
              className="flex items-center gap-1.5 px-3.5 h-8 rounded-full apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-medium transition-colors cursor-pointer"
            >
              {showCodes ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
              {showCodes ? "Ascunde coduri" : "Arată coduri"}
            </button>
          </div>
        </div>
        <div className="hidden md:grid grid-cols-12 gap-0 bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07] text-[#6e6e73] dark:text-[#98989d] text-[12px] font-medium">
          {showCodes ? (
            <>
              <div className="col-span-1 px-3 py-2.5">Cod</div>
              <div className="col-span-3 px-3 py-2.5 border-l border-black/[0.05] dark:border-white/[0.07]">
                Denumire produs sau serviciu
              </div>
            </>
          ) : (
            <div className="col-span-4 px-4 py-2.5">
              Denumire produs sau serviciu
            </div>
          )}
          <div className="col-span-1 px-2 py-2.5 text-center border-l border-black/[0.05] dark:border-white/[0.07]">
            U.M.
          </div>
          <div className="col-span-1 px-2 py-2.5 text-center border-l border-black/[0.05] dark:border-white/[0.07]">
            Cant.
          </div>
          <div className="col-span-1 px-2 py-2.5 text-center border-l border-black/[0.05] dark:border-white/[0.07]">
            Cotă TVA
          </div>
          <div className="col-span-2 px-3 py-2.5 text-right border-l border-black/[0.05] dark:border-white/[0.07]">
            Preț (fără TVA)
          </div>
          <div className="col-span-2 px-3 py-2.5 text-right border-l border-black/[0.05] dark:border-white/[0.07]">
            Valoare
          </div>
          <div className="col-span-1 px-2 py-2.5 text-center border-l border-black/[0.05] dark:border-white/[0.07]"></div>
        </div>

        <div className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
          {lines.map((line, idx) => (
            <div
              key={line.id}
              className={cn(
                "grid grid-cols-2 sm:grid-cols-4 md:grid-cols-12 gap-3 md:gap-0 items-start md:items-center hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] p-4 md:p-0 border-b border-black/[0.045] dark:border-white/[0.06] md:border-b-0 transition-colors",
                focusedLineId === line.id ? "relative z-30" : "relative z-0"
              )}
            >
              {showCodes && (
                <div className="col-span-2 sm:col-span-4 md:col-span-1 px-0 md:px-3 py-1 md:py-2 h-full flex flex-col md:flex-row md:items-center">
                  <label className="md:hidden text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">Cod</label>
                  <input
                    type="text"
                    placeholder="Cod..."
                    value={line.devizCode || ""}
                    onChange={e =>
                      updateLine(line.id, "devizCode", e.target.value)
                    }
                    className="w-full h-8 px-2.5 text-[16px] md:text-[13px] border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] rounded-xl text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] focus:outline-none focus:border-[#0071e3] transition-colors"
                  />
                </div>
              )}
              <div
                className={cn(
                  "px-0 md:px-3 py-1 md:py-2 relative h-full flex flex-col justify-center col-span-2 sm:col-span-4",
                  focusedLineId === line.id ? "z-40" : "z-0",
                  showCodes
                    ? "md:col-span-3 md:border-l border-black/[0.045] dark:border-white/[0.06]"
                    : "md:col-span-4"
                )}
              >
                <label className="md:hidden text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">Denumire produs / serviciu</label>
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
                  className="w-full h-8 px-2.5 text-[16px] md:text-[13px] border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] rounded-xl text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] focus:outline-none focus:border-[#0071e3] transition-colors"
                />
                {focusedLineId === line.id && (
                  <div
                    onMouseDown={e => {
                      e.stopPropagation();
                    }}
                    className="absolute top-11 left-0 z-50 w-[580px] max-w-[92vw] sm:min-w-[480px] bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] shadow-2xl rounded-2xl overflow-hidden flex flex-col"
                  >
                    {filteredSavedProducts.length > 0 && (
                      <div className="flex flex-col">
                        <div className="px-3.5 py-2 bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] select-none">
                          <span className="flex items-center gap-1.5">
                            <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">Produsele tale salvate ({filteredSavedProducts.length})</span>
                            {totalProductPages > 1 && (
                              <span className="text-[#8e8e93] font-normal text-[11px] tabular-nums">
                                (pag. {productPage}/{totalProductPages})
                              </span>
                            )}
                          </span>
                          <span className="text-[11px] text-[#0071e3] dark:text-[#409cff] font-normal">
                            completează automat U.M. și prețul
                          </span>
                        </div>

                        {/* Lista de produse (câte 10 pe pagină), cu text întreg fără trunchiere */}
                        <div className="divide-y divide-black/[0.045] dark:divide-white/[0.06] max-h-80 overflow-y-auto">
                          {paginatedProducts.map((p: any) => (
                            <button
                              key={`prod-${p.id}`}
                              type="button"
                              onMouseDown={e => {
                                e.preventDefault();
                                handleSelectProduct(line.id, p);
                              }}
                              className="apple-card-btn w-full text-left px-3.5 py-2.5 hover:bg-[#f2f2f7] dark:hover:bg-[#2c2c2e] transition-colors flex items-center justify-between gap-3 group cursor-pointer"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] whitespace-normal break-words leading-snug">
                                  {p.name}
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-[11.5px] text-[#6e6e73] dark:text-[#98989d] flex-wrap tabular-nums">
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10.5px] font-medium bg-[#0071e3]/10 text-[#0071e3] dark:text-[#409cff] border border-[#0071e3]/20">
                                    U.M: {p.unit || "buc"}
                                  </span>
                                  <span className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                                    Preț: {p.defaultPrice} {currency}
                                  </span>
                                  {p.defaultVatRate !== undefined && (
                                    <span>
                                      TVA: {p.defaultVatRate}%
                                    </span>
                                  )}
                                  {p.category && (
                                    <span className="text-[11px] text-[#8e8e93]">
                                      [{p.category}]
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="text-[11.5px] text-[#0071e3] dark:text-[#409cff] font-semibold whitespace-nowrap px-2.5 py-1 rounded-full bg-[#0071e3]/10 border border-[#0071e3]/20 group-hover:bg-[#0071e3] group-hover:text-white transition-colors shrink-0">
                                Selectează &rarr;
                              </span>
                            </button>
                          ))}
                        </div>

                        {/* Bara de paginare câte 10 cu Precedenta și Următoarea */}
                        {filteredSavedProducts.length > PRODUCTS_PER_PAGE && (
                          <div className="px-3.5 py-2 bg-[#fafafa] dark:bg-white/[0.025] border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between text-xs text-[#6e6e73] dark:text-[#98989d] select-none tabular-nums">
                            <span className="font-medium text-[11.5px]">
                              Afișare {(productPage - 1) * PRODUCTS_PER_PAGE + 1} – {Math.min(productPage * PRODUCTS_PER_PAGE, filteredSavedProducts.length)} din {filteredSavedProducts.length}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={productPage <= 1}
                                onMouseDown={e => {
                                  e.preventDefault();
                                  setProductPage(p => Math.max(1, p - 1));
                                }}
                                className="px-2.5 h-7 rounded-full apple-btn-glass font-medium text-[11.5px] text-[#1d1d1f] dark:text-[#f5f5f7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                              >
                                ← Precedenta
                              </button>
                              <span className="px-1.5 text-[11.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                                {productPage} / {totalProductPages}
                              </span>
                              <button
                                type="button"
                                disabled={productPage >= totalProductPages}
                                onMouseDown={e => {
                                  e.preventDefault();
                                  setProductPage(p => Math.min(totalProductPages, p + 1));
                                }}
                                className="px-2.5 h-7 rounded-full apple-btn-glass font-medium text-[11.5px] text-[#1d1d1f] dark:text-[#f5f5f7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                              >
                                Următoarea →
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {catalogData?.items && catalogData.items.length > 0 && (
                      <div className="border-t border-black/[0.06] dark:border-white/[0.08]">
                        <div className="px-3.5 py-2 bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] border-b border-black/[0.06] dark:border-white/[0.08]">
                          Catalog devize & norme
                        </div>
                        <div className="max-h-56 overflow-y-auto divide-y divide-black/[0.045] dark:divide-white/[0.06]">
                          {catalogData.items.map((item: any, i: number) => (
                            <button
                              key={`cat-${i}`}
                              type="button"
                              onMouseDown={e => {
                                e.preventDefault();
                                handleSelectFromCatalog(line.id, item);
                              }}
                              className="apple-card-btn w-full text-left px-3.5 py-2 hover:bg-[#f2f2f7] dark:hover:bg-[#2c2c2e] transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[10.5px] font-medium px-1.5 py-0.5 rounded-md bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#98989d] border border-black/[0.06] dark:border-white/[0.08]">
                                  {item.tip}
                                </span>
                                <span className="text-xs font-medium text-[#6e6e73] dark:text-[#98989d] tabular-nums">
                                  {item.cod}
                                </span>
                              </div>
                              <div className="text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] whitespace-normal break-words leading-tight">
                                {item.denumire}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {filteredSavedProducts.length === 0 &&
                      (!catalogData?.items || catalogData.items.length === 0) &&
                      catalogQuery.trim().length > 0 && (
                        <div className="p-3.5 text-[12.5px] text-[#6e6e73] dark:text-[#98989d] text-center">
                          Produs nou. Va fi salvat automat în nomenclator cu U.M. și prețul ales la emitere.
                        </div>
                      )}
                  </div>
                )}
              </div>
              <div className="col-span-1 md:col-span-1 px-0 md:px-2 py-1 md:py-2 md:border-l border-black/[0.045] dark:border-white/[0.06] h-full flex flex-col justify-center">
                <label className="md:hidden text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">U.M.</label>
                <select
                  value={line.unit}
                  onChange={e => updateLine(line.id, "unit", e.target.value)}
                  className="w-full h-8 px-1.5 text-[16px] md:text-[12.5px] border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] rounded-xl text-[#1d1d1f] dark:text-[#f5f5f7] focus:outline-none focus:border-[#0071e3] cursor-pointer transition-colors"
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
              <div className="col-span-1 md:col-span-1 px-0 md:px-2 py-1 md:py-2 md:border-l border-black/[0.045] dark:border-white/[0.06] flex flex-col justify-center">
                <label className="md:hidden text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">Cant.</label>
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
                      toast.warning(`Stoc insuficient în NIR`, {
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
                  className="w-full h-8 px-2 text-[16px] md:text-[13px] tabular-nums text-center md:text-center border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] rounded-xl text-[#1d1d1f] dark:text-[#f5f5f7] focus:outline-none focus:border-[#0071e3] transition-colors"
                />
              </div>
              <div className="col-span-1 md:col-span-1 px-0 md:px-2 py-1 md:py-2 md:border-l border-black/[0.045] dark:border-white/[0.06] flex flex-col justify-center">
                <label className="md:hidden text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">TVA (%)</label>
                <select
                  value={
                    !isNaN(parseFloat(String(line.vatRate)))
                      ? parseFloat(String(line.vatRate))
                      : 21
                  }
                  onChange={e =>
                    updateLine(line.id, "vatRate", parseFloat(e.target.value))
                  }
                  className="w-full h-8 px-1.5 text-[16px] md:text-[12.5px] tabular-nums border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] rounded-xl text-[#1d1d1f] dark:text-[#f5f5f7] focus:outline-none focus:border-[#0071e3] cursor-pointer transition-colors"
                >
                  {VAT_RATES.map(r => (
                    <option key={r} value={r}>
                      {r}%{isReverseCharge && r === 0 ? " (Taxare Inversă)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-1 md:col-span-2 px-0 md:px-2 py-1 md:py-2 md:border-l border-black/[0.045] dark:border-white/[0.06] flex flex-col justify-center">
                <label className="md:hidden text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">Preț (fără TVA)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.unitPrice}
                  onChange={e =>
                    updateLine(line.id, "unitPrice", e.target.value)
                  }
                  className="w-full h-8 px-2.5 text-[16px] md:text-[13px] tabular-nums text-left md:text-right border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] rounded-xl text-[#1d1d1f] dark:text-[#f5f5f7] focus:outline-none focus:border-[#0071e3] transition-colors"
                />
              </div>
              <div className="col-span-1 md:col-span-2 px-0 md:px-3 py-1 md:py-2 md:border-l border-black/[0.045] dark:border-white/[0.06] flex flex-col justify-center md:items-end">
                <label className="md:hidden text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">Valoare</label>
                <span className="text-[13.5px] font-semibold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] h-8 flex items-center justify-end whitespace-nowrap text-right">
                  {formatCurrency(computeLineTotal(line), currency)}
                </span>
              </div>
              <div className="col-span-1 md:col-span-1 px-0 md:px-2 py-1 md:py-2 md:border-l border-black/[0.045] dark:border-white/[0.06] flex items-center justify-end md:justify-center">
                {lines.length > 1 && (
                  <button
                    type="button"
                    aria-label="Șterge linia"
                    onClick={() => removeLine(line.id)}
                    className="w-8 h-8 md:w-7 md:h-7 flex items-center justify-center rounded-full text-[#8e8e93] hover:bg-rose-500/12 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 md:w-3.5 md:h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-black/[0.05] dark:border-white/[0.07] grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-0">
          <div className="lg:col-span-7 px-4 py-3.5 flex flex-col justify-between">
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={addLine}
                className="flex items-center gap-1.5 px-3.5 h-8 text-[12.5px] font-medium apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7] rounded-full transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Adaugă rând
              </button>
            </div>

            {bnrNoteMatch && (
              <div className="mt-3 p-3 rounded-xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.05] dark:border-white/[0.07] text-xs">
                <p className="tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] leading-relaxed font-medium text-[12px]">
                  {bnrNoteMatch}
                </p>
              </div>
            )}

            {isReverseCharge && (
              <div className="mt-2.5 p-3 rounded-xl bg-[#0071e3]/[0.06] dark:bg-[#0071e3]/[0.12] border border-[#0071e3]/20 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#409cff]" />
                  <span>Taxare Inversă / VAT Reverse Charge (Art. 196):</span>
                </div>
                <p className="tabular-nums text-[#6e6e73] dark:text-[#98989d] leading-relaxed text-[11.5px]">
                  {REVERSE_CHARGE_LEGAL_TEXT}
                </p>
              </div>
            )}
          </div>
          <div className="lg:col-span-5 px-4 py-3.5 lg:border-l border-black/[0.05] dark:border-white/[0.07] space-y-1.5 bg-[#fafafa] dark:bg-white/[0.02] lg:bg-transparent tabular-nums rounded-b-[16px] lg:rounded-bl-none">
            {vatBreakdown.map(({ rate, base, vat }) => (
              <div
                key={rate}
                className="flex justify-between items-center text-[12px] text-[#6e6e73] dark:text-[#98989d]"
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span>
                    TVA {rate}% × {formatCurrency(base, currency)}
                  </span>
                  {rate === 0 && isReverseCharge && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10.5px] font-medium bg-[#0071e3]/10 text-[#0071e3] dark:text-[#409cff]">
                      Reverse Charge (Art. 196)
                    </span>
                  )}
                </div>
                <span className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                  {formatCurrency(vat, currency)}
                </span>
              </div>
            ))}
            {isReverseCharge && (
              <div className="text-[11.5px] font-medium text-[#0071e3] dark:text-[#409cff] bg-[#0071e3]/[0.06] dark:bg-[#0071e3]/[0.12] px-2.5 py-1 rounded-lg border border-[#0071e3]/15 leading-tight">
                VAT reverse charge – Directiva 2006/112/CE Art. 196
              </div>
            )}
            <div className="flex justify-between text-[13px] text-[#6e6e73] dark:text-[#98989d] pt-1.5 border-t border-black/[0.05] dark:border-white/[0.07]">
              <span>Total fără TVA:</span>
              <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                {formatCurrency(subtotal, currency)}
              </span>
            </div>
            <div className="flex justify-between text-[13px] text-[#6e6e73] dark:text-[#98989d]">
              <span>TVA total:</span>
              <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                {formatCurrency(totalVAT, currency)}
              </span>
            </div>
            <div className="flex justify-between text-[16px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] border-t border-black/[0.06] dark:border-white/[0.08] pt-2 mt-1">
              <span>Total de plată:</span>
              <span className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                {formatCurrency(total, currency)}
              </span>
            </div>

            {currency !== "RON" && (
              <div className="mt-2.5 pt-2.5 border border-amber-500/25 bg-amber-500/[0.06] dark:bg-amber-500/[0.10] p-3 rounded-xl flex items-center justify-between gap-2">
                <div>
                  <p className="text-[12px] font-semibold text-amber-800 dark:text-amber-300">
                    Echivalent Lei (Curs BNR)
                  </p>
                  <p className="text-[11px] text-[#6e6e73] dark:text-[#98989d]">
                    1 {currency} = {effectiveInvoiceBnrRate.toFixed(4)} Lei ({effectiveBnrRateDate || issueDate})
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[15px] sm:text-[16px] font-bold text-amber-700 dark:text-amber-400">
                    ≈ {formatCurrency(total * effectiveInvoiceBnrRate, "RON")}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="apple-surface overflow-hidden">
        <button
          type="button"
          onClick={() => setShowOptional(o => !o)}
          className="apple-card-btn w-full flex items-center justify-between px-4 py-3 text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
        >
          <span>
            Câmpuri opționale{" "}
            <span className="text-[#6e6e73] dark:text-[#98989d] font-normal">
              (Delegat, Aviz, Comandă, Mențiuni...)
            </span>
          </span>
          {showOptional ? (
            <ChevronUp className="w-4 h-4 text-[#8e8e93]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#8e8e93]" />
          )}
        </button>
        {showOptional && (
          <div className="border-t border-black/[0.05] dark:border-white/[0.07] p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
                <label className={labelCls}>Carte identitate</label>
                <input
                  value={carteIdentitate}
                  onChange={e => setCarteIdentitate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Nr. aviz însoțire</label>
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
                <label className={labelCls}>Agent vânzări</label>
                <input
                  value={agentVanzari}
                  onChange={e => setAgentVanzari(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Punct de lucru client</label>
                <input
                  value={punctLucru}
                  onChange={e => setPunctLucru(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Nr. comandă</label>
                <input
                  value={numarComanda}
                  onChange={e => setNumarComanda(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Nr. contract</label>
                <input
                  value={numarContract}
                  onChange={e => setNumarContract(e.target.value)}
                  className={inputCls}
                  placeholder="ex: 392"
                />
              </div>
              <div>
                <label className={labelCls}>Data contract</label>
                <input
                  type="date"
                  value={dataContract}
                  onChange={e => setDataContract(e.target.value)}
                  className={cn(inputCls, "tabular-nums")}
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
                className="w-full px-3 py-2 text-[16px] sm:text-[13px] border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] rounded-xl text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] focus:outline-none focus:border-[#0071e3] resize-none transition-colors"
              />
            </div>
          </div>
        )}
      </div>

      {/* Panou Opțiuni & Acțiuni Salvare Factură */}
      <div className="space-y-4 pt-2">
        {/* Card Toggles & Opțiuni (Curs BNR, Taxare Inversă, Email, Deviz, Smart QR) */}
        <div className="apple-surface p-3.5 sm:p-4 flex flex-col gap-3">
          {/* Rând Unificat de Comutatoare (Toggles) */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 text-xs">
            {/* Toggle Curs BNR */}
            <BnrInvoiceRateToggle
              currency={currency}
              issueDate={issueDate}
              total={total}
              totalVAT={totalVAT}
              notes={mentiuni}
              onNotesChange={setMentiuni}
              onRateChange={(rate) => setInvoiceBnrRate(rate)}
            />

            <span className="hidden sm:inline-block w-px h-4 bg-black/[0.08] dark:bg-white/[0.10]" />

            {/* Toggle Contract (Nr. și Dată) */}
            <ContractInvoiceToggle
              clientId={selectedClientId ? parseInt(selectedClientId, 10) : undefined}
              clientName={clientName}
              notes={mentiuni}
              onNotesChange={setMentiuni}
              contractNumber={numarContract}
              onContractNumberChange={setNumarContract}
              contractDate={dataContract}
              onContractDateChange={setDataContract}
            />

            <span className="hidden sm:inline-block w-px h-4 bg-black/[0.08] dark:bg-white/[0.10]" />

            {/* Toggle Taxare Inversă / VAT Reverse Charge */}
            <label className="inline-flex items-center gap-2 cursor-pointer select-none whitespace-nowrap">
              <span className="text-[12.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] whitespace-nowrap flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isReverseCharge ? "bg-[#0071e3] animate-pulse" : "bg-black/20 dark:bg-white/20"
                  }`}
                />
                Taxare Inversă
              </span>
              <Switch
                checked={isReverseCharge}
                onCheckedChange={handleToggleReverseCharge}
              />
            </label>

            <span className="hidden sm:inline-block w-px h-4 bg-black/[0.08] dark:bg-white/[0.10]" />

            {/* Toggle Creare Deviz */}
            <label className="inline-flex items-center gap-2 cursor-pointer select-none whitespace-nowrap">
              <span className="text-[12.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] whitespace-nowrap">
                Creare Deviz
              </span>
              <Switch
                checked={createDeviz}
                onCheckedChange={setCreateDeviz}
              />
            </label>

            <span className="hidden sm:inline-block w-px h-4 bg-black/[0.08] dark:bg-white/[0.10]" />

            {/* Toggle Trimite Factura pe Email */}
            <div className="inline-flex items-center gap-2 flex-wrap">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none whitespace-nowrap">
                <Mail className="w-4 h-4 text-[#6e6e73] dark:text-[#98989d]" />
                <span className="text-[12.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] whitespace-nowrap">
                  Trimite pe Email
                </span>
                <Switch
                  checked={sendEmailToClient}
                  onCheckedChange={checked => {
                    setSendEmailToClient(checked);
                    if (checked && !clientEmail) {
                      setShowAdvancedClientInfo(true);
                    }
                  }}
                />
              </label>
              {sendEmailToClient && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.08] text-xs">
                  <span className="text-[11px] text-[#6e6e73] dark:text-[#98989d] font-medium">La:</span>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={e => setClientEmail(e.target.value)}
                    placeholder="adresa@client.ro"
                    className="bg-transparent text-xs text-[#1d1d1f] dark:text-[#f5f5f7] outline-none w-36 placeholder:text-[#8e8e93]"
                  />
                </div>
              )}
            </div>

            {tenant?.id === 1 && (
              <>
                <span className="hidden sm:inline-block w-px h-4 bg-black/[0.08] dark:bg-white/[0.10]" />

                {/* Toggle Preluare Deviz Smart QR — strict Tenant 1 */}
                <label className="inline-flex items-center gap-2 cursor-pointer select-none whitespace-nowrap">
                  <QrCode className="w-4 h-4 text-[#0071e3] dark:text-[#409cff]" />
                  <span className="text-[12.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] whitespace-nowrap flex items-center gap-1.5">
                    Preluare Deviz Smart QR
                    {loadingQrPontaj && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0071e3]" />}
                  </span>
                  <Switch
                    checked={isQrPontajActive}
                    onCheckedChange={handleToggleQrPontaj}
                    disabled={loadingQrPontaj}
                  />
                </label>
              </>
            )}
          </div>

          {/* Sub-bar Parametri Smart QR (Afișat pe rând dedicat când comutatorul este activ) */}
          {tenant?.id === 1 && isQrPontajActive && (
            <div className="pt-2.5 border-t border-black/[0.05] dark:border-white/[0.07] flex items-center gap-2 flex-wrap text-xs">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0071e3]/10 text-[#0071e3] dark:text-[#409cff] font-semibold text-[11.5px] shrink-0">
                <QrCode className="w-3 h-3" />
                <span>Parametri Smart QR:</span>
              </div>

              <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.08] text-xs flex-wrap tabular-nums">
                <span className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] font-medium">Client:</span>
                <select
                  value={qrTenantId}
                  onChange={e => handleQrParamChange(Number(e.target.value), qrMonth, qrYear)}
                  disabled={loadingQrPontaj}
                  className="bg-transparent text-xs text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold outline-none cursor-pointer pr-1"
                >
                  {qrTenantsList.map((t: any) => (
                    <option key={t.id} value={t.id} className="text-[#1d1d1f] dark:text-[#f5f5f7] bg-white dark:bg-[#1c1c1e]">
                      {t.nume} {t.active_employees_count !== undefined ? `(${t.active_employees_count} pers)` : ""}
                    </option>
                  ))}
                </select>

                <span className="text-black/[0.15] dark:text-white/[0.15]">|</span>

                <span className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] font-medium">Luna:</span>
                <select
                  value={qrMonth}
                  onChange={e => handleQrParamChange(qrTenantId, Number(e.target.value), qrYear)}
                  disabled={loadingQrPontaj}
                  className="bg-transparent text-xs text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold outline-none cursor-pointer pr-1"
                >
                  <option value={1} className="text-[#1d1d1f] dark:text-[#f5f5f7] bg-white dark:bg-[#1c1c1e]">Ianuarie</option>
                  <option value={2} className="text-[#1d1d1f] dark:text-[#f5f5f7] bg-white dark:bg-[#1c1c1e]">Februarie</option>
                  <option value={3} className="text-[#1d1d1f] dark:text-[#f5f5f7] bg-white dark:bg-[#1c1c1e]">Martie</option>
                  <option value={4} className="text-[#1d1d1f] dark:text-[#f5f5f7] bg-white dark:bg-[#1c1c1e]">Aprilie</option>
                  <option value={5} className="text-[#1d1d1f] dark:text-[#f5f5f7] bg-white dark:bg-[#1c1c1e]">Mai</option>
                  <option value={6} className="text-[#1d1d1f] dark:text-[#f5f5f7] bg-white dark:bg-[#1c1c1e]">Iunie</option>
                  <option value={7} className="text-[#1d1d1f] dark:text-[#f5f5f7] bg-white dark:bg-[#1c1c1e]">Iulie</option>
                  <option value={8} className="text-[#1d1d1f] dark:text-[#f5f5f7] bg-white dark:bg-[#1c1c1e]">August</option>
                  <option value={9} className="text-[#1d1d1f] dark:text-[#f5f5f7] bg-white dark:bg-[#1c1c1e]">Septembrie</option>
                  <option value={10} className="text-[#1d1d1f] dark:text-[#f5f5f7] bg-white dark:bg-[#1c1c1e]">Octombrie</option>
                  <option value={11} className="text-[#1d1d1f] dark:text-[#f5f5f7] bg-white dark:bg-[#1c1c1e]">Noiembrie</option>
                  <option value={12} className="text-[#1d1d1f] dark:text-[#f5f5f7] bg-white dark:bg-[#1c1c1e]">Decembrie</option>
                </select>

                <select
                  value={qrYear}
                  onChange={e => handleQrParamChange(qrTenantId, qrMonth, Number(e.target.value))}
                  disabled={loadingQrPontaj}
                  className="bg-transparent text-xs text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold outline-none cursor-pointer"
                >
                  <option value={2025} className="text-[#1d1d1f] dark:text-[#f5f5f7] bg-white dark:bg-[#1c1c1e]">2025</option>
                  <option value={2026} className="text-[#1d1d1f] dark:text-[#f5f5f7] bg-white dark:bg-[#1c1c1e]">2026</option>
                  <option value={2027} className="text-[#1d1d1f] dark:text-[#f5f5f7] bg-white dark:bg-[#1c1c1e]">2027</option>
                </select>

                <span className="text-black/[0.15] dark:text-white/[0.15]">|</span>

                <div className="flex items-center gap-1">
                  <span className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] font-medium">Preț:</span>
                  <span className="text-xs font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {qrPricePerUser} EUR
                  </span>
                </div>

                <span className="text-black/[0.15] dark:text-white/[0.15]">|</span>

                <div className="flex items-center gap-1">
                  <span className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] font-medium">Curs BNR:</span>
                  <span className="text-xs font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {appliedQrExchangeRate ? appliedQrExchangeRate.toFixed(4) : (currentBnrRateForInvoice ? currentBnrRateForInvoice.toFixed(4) : "5.3370")}
                  </span>
                </div>

                <button
                  type="button"
                  aria-label="Reîncarcă datele din Smart QR"
                  onClick={() => fetchAndApplyQrData(qrTenantId, qrMonth, qrYear)}
                  disabled={loadingQrPontaj}
                  title="Reîncarcă datele din Smart QR"
                  className="ml-1 w-7 h-7 rounded-full inline-flex items-center justify-center text-[#0071e3] hover:bg-[#0071e3]/10 dark:text-[#409cff] transition-colors cursor-pointer"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${loadingQrPontaj ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Butoane Salvare & Emitere Factură */}
        <div className="flex items-center justify-between flex-wrap gap-4 pt-1">
          <div className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] font-medium">
            Factură în <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">{currency}</strong> · Serie & Număr: <span className="tabular-nums font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{fullInvoiceNumber || series}</span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {isSpvValidated ? (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 px-4 h-10 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                  <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Factură blocată la editare (Validată în SPV)</span>
                </div>
                <Link href={`/facturi-emise-nou/storno/${editId}`}>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-6 h-10 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-[13.5px] font-semibold shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Emite Factură Storno
                  </button>
                </Link>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleSave("draft")}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-6 h-10 rounded-full apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7] text-[13.5px] font-semibold transition-colors disabled:opacity-60 whitespace-nowrap cursor-pointer"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Salvează Ciornă
                </button>
                <button
                  type="button"
                  onClick={() => handleSave("sent")}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-8 h-10 rounded-full apple-btn-prominent text-[13.5px] font-semibold transition-all disabled:opacity-60 whitespace-nowrap cursor-pointer active:scale-[0.99]"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Emite Factura
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
