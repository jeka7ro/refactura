// NIRCreate — Creare / Editare NIR (Nota de Intrare-Recepție)
// Format legal OMFP 2634/2015, cod formular 14-3-1/aA

import { useState, useEffect, useMemo } from "react";
import { Link, useParams } from "wouter";
import {
  ArrowLeft,
  ClipboardCheck,
  Plus,
  Trash2,
  Loader2,
  CheckCircle,
  Save,
  AlertTriangle,
  FileDown,
  FileCode,
  RefreshCw,
  Eye,
  Sparkles,
  FileText,
  ChevronDown,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import PlanConturiCombobox from "@/components/PlanConturiCombobox";
import ArticleCombobox from "@/components/ArticleCombobox";
import NirPreviewDialog from "@/components/NirPreviewDialog";
import PdfViewerDialog from "@/components/PdfViewerDialog";
import {
  SagaImportSimulatorModal,
  type SagaSimulationResult,
} from "@/components/SagaImportSimulatorModal";
import {
  saveWithFilePicker,
  getNirPdfFilename,
  getNirXmlFilename,
  encodeWindows1250Blob,
} from "@/lib/fileSave";
import {
  type CandidateArticle,
  computeNext088Seq,
  findBestArticleMatch,
  formatAppArticleCode,
  isAppGeneratedArticleCode,
} from "@shared/articleMatcher";

const normalizeName = (name: string) => {
  if (!name) return "";
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/\s+/g, " ") // replace multiple spaces with single space
    .trim()
    .toLowerCase();
};

export const SAGA_NIR_TYPES = [
  { code: "371", name: "Mărfuri", label: "371 — Mărfuri" },
  { code: "301", name: "Materii prime", label: "301 — Materii prime" },
  { code: "3021", name: "Materiale auxiliare", label: "3021 — Materiale auxiliare" },
  { code: "3022", name: "Combustibili", label: "3022 — Combustibili" },
  { code: "3024", name: "Piese de schimb", label: "3024 — Piese de schimb" },
  { code: "3028", name: "Consumabile", label: "3028 — Alte materiale consumabile" },
  { code: "303", name: "Obiecte de inventar", label: "303 — Obiecte de inventar" },
  { code: "381", name: "Ambalaje", label: "381 — Ambalaje" },
  { code: "345", name: "Produse finite", label: "345 — Produse finite" },
  { code: "341", name: "Semifabricate", label: "341 — Semifabricate" },
  { code: "361", name: "Animale și păsări", label: "361 — Animale și păsări" },
  { code: "321", name: "Materii prime în curs", label: "321 — Materii prime în curs" },
  { code: "327", name: "Mărfuri în curs", label: "327 — Mărfuri în curs" },
  { code: "4091", name: "Avansuri", label: "4091 — Avansuri furnizori stocuri" },
  { code: "605", name: "Utilități", label: "605 — Utilități (Energie și apă)" },
  { code: "6058", name: "Alte utilități", label: "6058 — Chelt. cu alte utilități" },
  { code: "611", name: "Reparații", label: "611 — Întreținere și reparații" },
  { code: "612", name: "Chirii", label: "612 — Chirii și redevențe" },
  { code: "624", name: "Transport", label: "624 — Transport bunuri" },
  { code: "626", name: "Telecomunicații", label: "626 — Poștă și telecomunicații" },
  { code: "628", name: "Servicii", label: "628 — Alte cheltuieli cu serviciile" },
  { code: "6231", name: "Protocol", label: "6231 — Cheltuieli de protocol" },
  { code: "6232", name: "Reclamă", label: "6232 — Reclamă și publicitate" },
  { code: "704", name: "Servicii prestate", label: "704 — Servicii prestate" },
];

const getAccountType = (accCode: string): string => {
  if (!accCode) return "Mărfuri";
  const c = accCode.trim();
  const matched = SAGA_NIR_TYPES.find(t => t.code === c);
  if (matched) return matched.name;
  if (c === "6058" || c.startsWith("6058")) return "Alte utilități";
  if (c.startsWith("371")) return "Mărfuri";
  if (c.startsWith("301")) return "Materii prime";
  if (c.startsWith("3021")) return "Materiale auxiliare";
  if (c.startsWith("3022")) return "Combustibili";
  if (c.startsWith("3024")) return "Piese de schimb";
  if (c.startsWith("3028")) return "Consumabile";
  if (c.startsWith("302")) return "Consumabile";
  if (c.startsWith("303")) return "Obiecte de inventar";
  if (c.startsWith("381")) return "Ambalaje";
  if (c.startsWith("345")) return "Produse finite";
  if (c.startsWith("341")) return "Semifabricate";
  if (c.startsWith("361")) return "Animale și păsări";
  if (c.startsWith("409")) return "Avansuri";
  if (c.startsWith("605")) return "Utilități";
  if (c.startsWith("611")) return "Reparații";
  if (c.startsWith("612")) return "Chirii";
  if (c.startsWith("624")) return "Transport";
  if (c.startsWith("626")) return "Telecomunicații";
  if (c.startsWith("6231") || c === "623") return "Protocol";
  if (c.startsWith("6232")) return "Reclamă";
  if (c.startsWith("628")) return "Servicii";
  if (c.startsWith("6") || c.startsWith("704")) return "Servicii";
  return "Mărfuri";
};

interface NirLineForm {
  id?: number;
  sagaArticleId?: number;
  articleSearchText?: string;
  matchType?: "exact" | "words_and_price" | "new_088" | "none";
  matchedWords?: string[];
  matchedSagaName?: string;
  description: string;
  unit: string;
  cantitateComanda: string;
  cantitateReceptionata: string;
  unitPrice: string;
  vatRate: string;
  total: string;
  observations: string;
  accountingType?: string;
  accountingAccount?: string;
}

const INPUT_CLS =
  "w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500";
const LABEL_CLS = "block text-[10px] font-bold uppercase text-slate-400 mb-0.5";

const CHEVRON_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`;
const SELECT_STYLE: React.CSSProperties = {
  appearance: "none",
  WebkitAppearance: "none",
  backgroundImage: CHEVRON_SVG,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 8px center",
  backgroundSize: "12px",
};
const SELECT_SM_STYLE: React.CSSProperties = {
  appearance: "none",
  WebkitAppearance: "none",
  backgroundImage: CHEVRON_SVG,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 5px center",
  backgroundSize: "10px",
};

// Mapare automată Tip → Cont
const TIP_TO_CONT: Record<string, string> = {
  Marfuri: "371",
  "Mărfuri": "371",
  "Materii prime": "301",
  "Materiale auxiliare": "3021",
  Combustibili: "3022",
  "Piese de schimb": "3024",
  Consumabile: "3028",
  "Alte mat. consumabile": "3028",
  "Obiecte de inventar": "303",
  Ambalaje: "381",
  "Produse finite": "345",
  Semifabricate: "341",
  "Animale și păsări": "361",
  "Materii prime în curs": "321",
  "Mărfuri în curs": "327",
  Nedefinit: "371",
  Servicii: "628",
  "Utilități": "605",
  "Alte utilități": "6058",
  "Alte utilitati": "6058",
  Salubrizare: "6058",
  Salubritate: "6058",
  "Reparații": "611",
  Chirii: "612",
  Transport: "624",
  "Telecomunicații": "626",
  "Servicii prestate": "704",
  Protocol: "6231",
  "Protocol & Recl.": "6231",
  "Protocol & Reclama": "6231",
  "Cheltuieli de protocol": "6231",
  Reclamă: "6232",
  "Reclamă & Pub.": "6232",
  "Reclamă și publicitate": "6232",
  Avans: "4091",
  Avansuri: "4091",
};

// Mapare automată Cont → Unitate de măsură (U/M) implicită
// (poate fi extinsă cu lista completă pe conturi)
export const CONT_TO_DEFAULT_UM: Record<string, string> = {
  "3028": "buc", // Consumabile / Alte materiale consumabile
  "301": "l",    // Materii prime
  "3022": "l",   // Combustibili
  "371": "buc",  // Mărfuri
  "3021": "buc", // Materiale auxiliare
  "3024": "buc", // Piese de schimb
  "303": "buc",  // Obiecte de inventar
  "381": "buc",  // Ambalaje
  "345": "buc",  // Produse finite
  "341": "buc",  // Semifabricate
};

// Coduri UN/ECE (e-Factura XML) → Unități de măsură uzuale în română
const UN_ECE_UNIT_MAP: Record<string, string> = {
  H87: "buc",
  C62: "buc",
  EA: "buc",
  PCE: "buc",
  NMP: "buc",
  XPP: "buc",
  NAR: "buc",
  BUC: "buc",
  "BUC.": "buc",
  BUCATA: "buc",
  BUCATI: "buc",
  "BUCĂȚI": "buc",
  KGM: "kg",
  KG: "kg",
  "KG.": "kg",
  GRM: "g",
  TNE: "t",
  LTR: "l",
  L: "l",
  LITRU: "l",
  LITRI: "l",
  MLT: "ml",
  MTR: "m",
  M: "m",
  LM: "m",
  CMT: "cm",
  MMT: "mm",
  MTK: "mp",
  MP: "mp",
  M2: "mp",
  MTQ: "mc",
  MC: "mc",
  M3: "mc",
  SET: "set",
  HUR: "oră",
  ORA: "oră",
  "ORĂ": "oră",
  ORE: "oră",
  BX: "cutie",
  XBX: "cutie",
  CUTIE: "cutie",
  CUT: "cutie",
  RO: "rolă",
  XRO: "rolă",
  ROLA: "rolă",
  "ROLĂ": "rolă",
  PK: "pachet",
  XPK: "pachet",
  PA: "pachet",
  PACHET: "pachet",
  PAC: "pachet",
  PR: "per",
  PER: "per",
  BG: "sac",
  XBG: "sac",
};

export const getDefaultUnitForAccount = (
  accCode?: string | null,
  typeName?: string | null,
  fallback = "buc"
): string => {
  const c = (accCode || "").trim();
  if (c && CONT_TO_DEFAULT_UM[c]) return CONT_TO_DEFAULT_UM[c];
  if (c.startsWith("3028") || c.startsWith("302")) {
    return c.startsWith("3022") ? (CONT_TO_DEFAULT_UM["3022"] || "l") : (CONT_TO_DEFAULT_UM["3028"] || "buc");
  }
  if (c.startsWith("301") || c.startsWith("321")) return CONT_TO_DEFAULT_UM["301"] || "l";
  if (c.startsWith("371") || c.startsWith("327")) return CONT_TO_DEFAULT_UM["371"] || "buc";
  if (c.startsWith("303")) return CONT_TO_DEFAULT_UM["303"] || "buc";
  if (c.startsWith("381")) return CONT_TO_DEFAULT_UM["381"] || "buc";
  if (c.startsWith("345")) return CONT_TO_DEFAULT_UM["345"] || "buc";
  if (c.startsWith("341")) return CONT_TO_DEFAULT_UM["341"] || "buc";

  const tLower = (typeName || "").trim().toLowerCase();
  if (tLower.includes("consumabil")) return CONT_TO_DEFAULT_UM["3028"] || "buc";
  if (tLower.includes("materii prime")) return CONT_TO_DEFAULT_UM["301"] || "l";
  if (tLower.includes("combustibil")) return CONT_TO_DEFAULT_UM["3022"] || "l";

  return fallback;
};

export const normalizeUnit = (
  rawUnit?: string | null,
  accCode?: string | null,
  typeName?: string | null
): string => {
  const trimmed = (rawUnit || "").trim();
  const upper = trimmed.toUpperCase();
  const isGenericXmlCode =
    !trimmed ||
    upper === "H87" ||
    upper === "C62" ||
    upper === "EA" ||
    upper === "PCE" ||
    upper === "NMP" ||
    upper === "XPP";

  if (isGenericXmlCode) {
    return getDefaultUnitForAccount(accCode, typeName, "buc");
  }
  if (UN_ECE_UNIT_MAP[upper]) {
    return UN_ECE_UNIT_MAP[upper];
  }
  return trimmed;
};

export default function NIRCreate() {
  const { id, invoiceId } = useParams<{ id?: string; invoiceId?: string }>();
  const nirId = id ? parseInt(id) : null;
  const sourceInvoiceId = invoiceId ? parseInt(invoiceId) : null;
  const isEdit = !!nirId;

  // Date NIR
  const [nirNumber, setNirNumber] = useState("");
  const [receiptDate, setReceiptDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [avizNumber, setAvizNumber] = useState("");
  const [gestiune, setGestiune] = useState("");
  const [accountingType, setAccountingType] = useState("Marfuri");
  const [accountingAccount, setAccountingAccount] = useState("371");
  const [currency, setCurrency] = useState("RON");
  const [exchangeRate, setExchangeRate] = useState("1.0000");
  const [notes, setNotes] = useState("");
  // Furnizor
  const [supplierName, setSupplierName] = useState("");
  const [supplierCUI, setSupplierCUI] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [spvIndex, setSpvIndex] = useState("");
  // Comisie receptie
  const [member1Name, setMember1Name] = useState("");
  const [member1Function, setMember1Function] = useState("Gestionar");
  const [member2Name, setMember2Name] = useState("");
  const [member2Function, setMember2Function] = useState("Contabil");
  const [member3Name, setMember3Name] = useState("");
  const [member3Function, setMember3Function] = useState("Sef depozit");
  // Diferente
  const [differenceNotes, setDifferenceNotes] = useState("");
  // Linii produse
  const [lines, setLines] = useState<NirLineForm[]>([]);
  const [status, setStatus] = useState<"draft" | "finalizat">("draft");
  const [loaded, setLoaded] = useState(false);
  // Toggle conturi
  const [showAccounting, setShowAccounting] = useState(true);
  const [generalUnit, setGeneralUnit] = useState("buc");
  const [generalVat, setGeneralVat] = useState("21");

  // Compute differences
  const hasDifferences = lines.some(
    l =>
      parseFloat(l.cantitateReceptionata || "0") !==
      parseFloat(l.cantitateComanda || "0")
  );

  // Queries
  const { data: nextNumber, refetch: refetchNextNumber } = trpc.nir.getNextNumber.useQuery(undefined, {
    enabled: !isEdit,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const { data: existingNir } = trpc.nir.getById.useQuery(
    { id: nirId! },
    { enabled: isEdit }
  );
  const { data: sourceInvoice } = trpc.invoiceArchive.getById.useQuery(
    { id: sourceInvoiceId! },
    { enabled: !!sourceInvoiceId, staleTime: 0 }
  );
  // Factură cu TAXARE INVERSĂ (UBL "AE") și TVA 0 → liniile NIR nu au voie să primească TVA din articole
  const sourceReverseCharge =
    !!sourceInvoice &&
    /<(?:cbc:)?ID>\s*AE\s*<\/(?:cbc:)?ID>/.test(String((sourceInvoice as any).rawXml || "")) &&
    Math.abs(parseFloat(String((sourceInvoice as any).totalVAT || "0"))) < 0.0001;
  const { data: archiveLines = [], isFetched: archiveLinesFetched } =
    trpc.invoiceArchive.getLines.useQuery(
      { id: sourceInvoiceId!, excludeNirId: isEdit ? nirId : undefined },
      { enabled: !!sourceInvoiceId, staleTime: 0 }
    );
  const { data: articles = [], isFetched: articlesFetched } = trpc.saga.articles.list.useQuery(undefined, {
    staleTime: 0,
    refetchOnMount: "always",
  });
  const { data: nextArticleCodeData } = trpc.saga.articles.nextCode.useQuery(undefined, {
    staleTime: 0,
    refetchOnMount: "always",
  });
  const { data: planConturiList = [] } = trpc.saga.planConturi.useQuery();

  const utils = trpc.useContext();

  const createNir = trpc.nir.createFromInvoice.useMutation({
    onSuccess: data => {
      toast.success(`NIR ${data.nirNumber} creat cu succes!`);
      utils.nir.list.invalidate();
      utils.nir.getNextNumber.invalidate();
      window.history.back();
    },
    onError: async e => {
      toast.error("Eroare: " + e.message);
      const fresh = await refetchNextNumber();
      const freshVal = typeof fresh.data === "string" ? fresh.data : (fresh.data as any)?.nextNumber;
      if (freshVal) setNirNumber(freshVal);
    },
  });

  const updateNir = trpc.nir.update.useMutation({
    onSuccess: () => {
      toast.success("NIR salvat!");
      utils.nir.list.invalidate();
      utils.nir.getById.invalidate({ id: nirId! });
    },
    onError: e => toast.error("Eroare: " + e.message),
  });

  const finalizeNir = trpc.nir.finalize.useMutation({
    onSuccess: () => {
      toast.success("NIR finalizat!");
      setStatus("finalizat");
      utils.nir.list.invalidate();
      utils.nir.getById.invalidate({ id: nirId! });
    },
    onError: e => toast.error("Eroare: " + e.message),
  });

  const { data: currentTenant } = trpc.tenants.current.useQuery();
  const exportNirMut = trpc.saga.exportNir.useMutation();
  const simulateNirImportMut = trpc.saga.simulateNirImport.useMutation();
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [invoicePdfOpen, setInvoicePdfOpen] = useState(false);
  const [commissionOpen, setCommissionOpen] = useState(false); // comisia de recepție: strânsă implicit
  const linkedInvoiceId: number | null = sourceInvoiceId || (existingNir as any)?.invoiceArchiveId || null;
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [simulationData, setSimulationData] = useState<SagaSimulationResult | null>(null);

  const handleOpenSagaSimulator = async () => {
    setSimulatorOpen(true);
    setSimulationData(null);
    try {
      const payload = buildPayload();
      const res = await simulateNirImportMut.mutateAsync({
        draftNir: {
          id: nirId || undefined,
          invoiceArchiveId: payload.invoiceArchiveId,
          nirNumber: payload.nirNumber || nirNumber || "NIR-NOU",
          receiptDate: payload.receiptDate || receiptDate,
          invoiceNumber: payload.invoiceNumber,
          avizNumber: payload.avizNumber,
          gestiune: payload.gestiune,
          supplierName: payload.supplierName || "Furnizor",
          supplierCUI: payload.supplierCUI,
          supplierAddress: payload.supplierAddress,
          accountingType: payload.accountingType,
          accountingAccount: payload.accountingAccount,
          currency: payload.currency,
          exchangeRate: payload.exchangeRate,
          spvIndex: spvIndex || undefined,
          lines: payload.lines.map((l) => ({
            description: l.description,
            unit: l.unit,
            cantitateReceptionata: l.cantitateReceptionata,
            unitPrice: l.unitPrice,
            vatRate: l.vatRate,
            total: l.total,
            accountingType: l.accountingType,
            accountingAccount: l.accountingAccount,
            sagaArticleId: l.sagaArticleId ?? undefined,
            articleCode: l.articleCode ?? undefined,
          })),
        },
      });
      setSimulationData(res as SagaSimulationResult);
    } catch (e: any) {
      toast.error("Eroare la simularea importului SAGA: " + (e?.message || e));
      setSimulatorOpen(false);
    }
  };

  const handleSaveSagaXml = async () => {
    if (!nirId) return;
    try {
      const suggestedName = getNirXmlFilename(
        currentTenant?.cui || (currentTenant as any)?.tenants?.cui,
        nirNumber,
        nirId
      );
      const savedName = await saveWithFilePicker(
        {
          suggestedName,
          acceptMimeType: "text/xml",
          description: "Fișier XML SAGA C (.xml)",
          extensions: [".xml"],
          pickerId: "nir_saga_xml",
        },
        async () => {
          const data = await exportNirMut.mutateAsync({ nirId });
          return encodeWindows1250Blob(data.xml);
        }
      );
      if (savedName) {
        toast.success(
          `Fișierul ${savedName} a fost salvat cu succes pentru import în SAGA C!`
        );
      }
    } catch (e: any) {
      toast.error("Eroare export SAGA XML: " + (e?.message || e));
    }
  };

  const handleSavePdfNir = async () => {
    if (!nirId) return;
    try {
      setIsSavingPdf(true);
      const suggestedName = getNirPdfFilename(nirNumber, nirId);
      const savedName = await saveWithFilePicker(
        {
          suggestedName,
          acceptMimeType: "application/pdf",
          description: "Document PDF NIR (.pdf)",
          extensions: [".pdf"],
          pickerId: "nir_pdf",
        },
        async () => {
          const res = await fetch(
            `/api/pdf/nir/${nirId}?download=1&showAccounting=${showAccounting}`,
            { credentials: "include" }
          );
          if (!res.ok) {
            throw new Error(`Eroare la generarea PDF-ului (${res.status})`);
          }
          return await res.blob();
        }
      );
      if (savedName) {
        toast.success(`Documentul ${savedName} a fost salvat cu succes!`);
      }
    } catch (e: any) {
      toast.error("Eroare salvare PDF NIR: " + (e?.message || e));
    } finally {
      setIsSavingPdf(false);
    }
  };

  // Reset when invoice changes
  useEffect(() => {
    if (!isEdit) {
      setLoaded(false);
      setNirNumber("");
      setLines([]);
      setSupplierName("");
      setSupplierCUI("");
      setSupplierAddress("");
      setInvoiceNumber("");
      setAvizNumber("");
      refetchNextNumber();
    }
  }, [sourceInvoiceId, isEdit]);

  // Init from next number
  useEffect(() => {
    if (!isEdit && nextNumber) {
      const val = typeof nextNumber === "string" ? nextNumber : (nextNumber as any)?.nextNumber;
      if (val && (!nirNumber || nirNumber.trim() === "")) {
        setNirNumber(val);
      }
    }
  }, [nextNumber, isEdit, nirNumber]);

  // Init from existing NIR
  useEffect(() => {
    if (isEdit && existingNir && !loaded && articlesFetched) {
      setNirNumber(existingNir.nirNumber);
      const existingInvDate = (existingNir as any).invoiceDate
        ? String((existingNir as any).invoiceDate).split("T")[0]
        : "";
      setReceiptDate(
        existingInvDate ||
          (existingNir.receiptDate ? String(existingNir.receiptDate).split("T")[0] : "")
      );
      setAvizNumber(existingNir.avizNumber || "");
      setGestiune(existingNir.gestiune || "");
      const headerAcc =
        existingNir.accountingAccount ||
        existingNir.lines?.[0]?.accountingAccount ||
        "371";
      const headerType =
        existingNir.accountingType ||
        existingNir.lines?.[0]?.accountingType ||
        getAccountType(headerAcc);
      setAccountingType(headerType);
      setAccountingAccount(headerAcc);
      const existingVat = (existingNir.lines && existingNir.lines[0]?.vatRate)
        ? String(parseFloat(String(existingNir.lines[0].vatRate)))
        : "21";
      setGeneralVat(existingVat);
      setSupplierName(existingNir.supplierName || "");
      setSupplierCUI(existingNir.supplierCUI || "");
      setSupplierAddress(existingNir.supplierAddress || "");
      setInvoiceNumber(existingNir.invoiceNumber || "");
      if ((existingNir as any).spvIndex) setSpvIndex((existingNir as any).spvIndex);
      setMember1Name(existingNir.member1Name || "");
      setMember1Function(existingNir.member1Function || "Gestionar");
      setMember2Name(existingNir.member2Name || "");
      setMember2Function(existingNir.member2Function || "Contabil");
      setMember3Name(existingNir.member3Name || "");
      setMember3Function(existingNir.member3Function || "Sef depozit");
      setDifferenceNotes(existingNir.differenceNotes || "");
      setNotes(existingNir.notes || "");
      if ((existingNir as any).currency) setCurrency(String((existingNir as any).currency).trim().toUpperCase());
      if ((existingNir as any).exchangeRate) setExchangeRate(String((existingNir as any).exchangeRate));
      setStatus((existingNir.status as any) || "draft");

      const candidatePool: CandidateArticle[] = (articles as any[]).map((a: any) => ({
        id: a.id,
        code: String(a.code || "").trim(),
        name: String(a.name || "").trim(),
        unit: a.unit,
        accountingAccount: a.accountingAccount,
        category: a.category,
        vatRate: a.vatRate,
        knownPrices: a.knownPrices || [],
        lastPrice: a.lastPrice ?? null,
      }));
      let next088Seq = computeNext088Seq(candidatePool.map((a) => a.code));

      const mappedExistingLines = (existingNir.lines || []).map((l: any) => {
        let code = String(l.articleCode || "").trim();
        let artId = l.sagaArticleId;
        let matchType: NirLineForm["matchType"] = "none";
        let matchedWords: string[] | undefined = undefined;
        let matchedSagaName: string | undefined = undefined;

        const lineAcc = l.accountingAccount || headerAcc || "371";
        const lineType = l.accountingType || getAccountType(lineAcc);
        const isServiceOrAdvance =
          String(lineAcc).startsWith("6") ||
          String(lineAcc).startsWith("7") ||
          String(lineAcc).startsWith("409") ||
          lineType === "Servicii" ||
          lineType === "Avans";

        if (!code && artId) {
          const a = candidatePool.find((art) => art.id === artId);
          if (a) {
            code = a.code || "";
            matchType = isAppGeneratedArticleCode(code) ? "new_088" : "exact";
            matchedSagaName = a.name;
          }
        }

        if (!code && !isServiceOrAdvance && l.description) {
          const smartMatch = findBestArticleMatch(
            l.description,
            l.unitPrice,
            candidatePool
          );
          if (smartMatch) {
            code = smartMatch.article.code;
            artId = smartMatch.article.id > 0 ? smartMatch.article.id : undefined;
            matchType = isAppGeneratedArticleCode(code)
              ? "new_088"
              : smartMatch.matchType;
            matchedWords = smartMatch.matchedWords;
            matchedSagaName = smartMatch.article.name;
          } else {
            code = formatAppArticleCode(next088Seq++);
            artId = undefined;
            matchType = "new_088";
            const parsedPrice = parseFloat(String(l.unitPrice || "0"));
            candidatePool.push({
              id: -next088Seq,
              code,
              name: l.description,
              unit: l.unit,
              accountingAccount: lineAcc,
              category: lineType,
              vatRate: l.vatRate,
              knownPrices: !isNaN(parsedPrice) && parsedPrice > 0 ? [parsedPrice] : [],
              lastPrice: !isNaN(parsedPrice) && parsedPrice > 0 ? parsedPrice : null,
            });
          }
        }

        const lineUnit = normalizeUnit(l.unit, lineAcc, lineType);

        return {
          id: l.id,
          sagaArticleId: artId,
          articleSearchText: code,
          matchType,
          matchedWords,
          matchedSagaName,
          description: l.description,
          unit: lineUnit,
          cantitateComanda: String(l.cantitateComanda || "0"),
          cantitateReceptionata: String(l.cantitateReceptionata || "0"),
          unitPrice: String(l.unitPrice || "0"),
          vatRate: (l.vatRate !== undefined && l.vatRate !== null && l.vatRate !== "") ? String(parseFloat(String(l.vatRate))) : "21",
          total: String(l.total || ""),
          observations: l.observations || "",
          accountingType: lineType,
          accountingAccount: lineAcc,
        };
      });

      setLines(mappedExistingLines);
      setGeneralUnit(
        mappedExistingLines[0]?.unit ||
          getDefaultUnitForAccount(headerAcc, headerType, "buc")
      );
      setLoaded(true);
    }
  }, [existingNir, isEdit, loaded, articles, articlesFetched, nextArticleCodeData]);

  // Init from source invoice (wait for both queries)
  useEffect(() => {
    if (!isEdit && sourceInvoice && !loaded && archiveLinesFetched && articlesFetched) {
      setSupplierName(sourceInvoice.supplierName || "");
      setSupplierCUI(sourceInvoice.supplierCUI || "");
      setInvoiceNumber(sourceInvoice.invoiceNumber || "");
      if (sourceInvoice.issueDate) {
        setReceiptDate(String(sourceInvoice.issueDate).split("T")[0]);
      }
      if (sourceInvoice.currency && sourceInvoice.currency.trim()) {
        setCurrency(sourceInvoice.currency.trim().toUpperCase());
      }
      if ((sourceInvoice as any).exchangeRate) {
        setExchangeRate(String((sourceInvoice as any).exchangeRate));
      }
      if ((sourceInvoice as any).spvIndex) setSpvIndex((sourceInvoice as any).spvIndex);
      const archLns = archiveLines as any[];
      const srcTotalNum = parseFloat(sourceInvoice?.total || "0");
      const isSourceCreditNote = srcTotalNum > 0
        ? false
        : !!(
            (sourceInvoice as any)?.isCreditNote ||
            sourceInvoice?.rawXml?.includes("<CreditNote") ||
            sourceInvoice?.rawXml?.includes(":CreditNote") ||
            sourceInvoice?.rawXml?.includes("CreditNoteLine") ||
            sourceInvoice?.rawXml?.includes("<cbc:InvoiceTypeCode>381</cbc:InvoiceTypeCode>") ||
            sourceInvoice?.rawXml?.includes("<InvoiceTypeCode>381</InvoiceTypeCode>") ||
            srcTotalNum < 0 ||
            ((sourceInvoice as any)?.notes || "").toLowerCase().includes("storno")
          );

      const candidatePool: CandidateArticle[] = (articles as any[]).map((a: any) => ({
        id: a.id,
        code: String(a.code || "").trim(),
        name: String(a.name || "").trim(),
        unit: a.unit,
        accountingAccount: a.accountingAccount,
        category: a.category,
        vatRate: a.vatRate,
        knownPrices: a.knownPrices || [],
        lastPrice: a.lastPrice ?? null,
      }));
      let next088Seq = computeNext088Seq(candidatePool.map((a) => a.code));

      if (archLns.length > 0) {
        const newLines = archLns
          .map((l: any) => {
            let qty = parseFloat(String(l.quantity || "1"));
            if (isSourceCreditNote && qty > 0) {
              qty = -qty;
            }
            const received = parseFloat(String(l.receivedQuantity || "0"));
            let remaining = qty;
            if (qty < 0) {
              // Poziție storno / avans negativ
              remaining = qty - received < 0 ? qty - received : 0;
            } else {
              remaining = Math.max(0, qty - received);
            }
            const unitPrice = parseFloat(String(l.unitPrice || "0"));

            const isAvans = (l.description || "").toLowerCase().includes("avans") || qty < 0;
            const isTransport = (l.description || "").toLowerCase().includes("transport");
            const isSalubrizare =
              (l.description || "").toLowerCase().includes("salubri") ||
              (l.description || "").toLowerCase().includes("deseu") ||
              (l.description || "").toLowerCase().includes("deșeu") ||
              (l.description || "").toLowerCase().includes("gunoi") ||
              (sourceInvoice?.supplierName || "").toLowerCase().includes("salubri") ||
              (sourceInvoice?.supplierName || "").toLowerCase().includes("salubritate");
            const isProtocol = (l.description || "").toLowerCase().includes("protocol") ||
              (l.description || "").toLowerCase().includes("cafea") ||
              (l.description || "").toLowerCase().includes("apa minerala") ||
              (l.description || "").toLowerCase().includes("apa plata");
            const isServiceText = (l.description || "").toLowerCase().includes("servici") || 
              (l.description || "").toLowerCase().includes("abonament") || 
              (l.description || "").toLowerCase().includes("manopera") ||
              (l.description || "").toLowerCase().includes("consultant") ||
              (l.description || "").toLowerCase().includes("reparatii") ||
              (l.description || "").toLowerCase().includes("intretinere") ||
              (l.description || "").toLowerCase().includes("gaz") ||
              (l.description || "").toLowerCase().includes("energie") ||
              (l.description || "").toLowerCase().includes("curent");

            // 1. Căutare inteligentă: denumire exactă SAU minimum 2 cuvinte semnificative + același preț unitar
            const smartMatch = findBestArticleMatch(
              l.description || "",
              unitPrice,
              candidatePool
            );
            const matchedArticle = smartMatch?.article;

            let defType = "Marfuri";
            let defAccount = "371";
            if (matchedArticle) {
              defType = matchedArticle.category || "Marfuri";
              defAccount = matchedArticle.accountingAccount || TIP_TO_CONT[defType] || "371";
              if (defType.toLowerCase().includes("materii prime") && (!defAccount || defAccount.startsWith("371") || defAccount.startsWith("302"))) {
                defAccount = "301";
              }
            } else if (isAvans) {
              defType = "Avans";
              defAccount = "4091";
            } else if (isSalubrizare) {
              defType = "Alte utilități";
              defAccount = "6058";
            } else if (isTransport) {
              defType = "Transport";
              defAccount = "624";
            } else if (isProtocol) {
              defType = "Protocol";
              defAccount = "6231";
            } else if (isServiceText) {
              defType = "Servicii";
              defAccount = "628";
            }

            const isServiceOrAdvance =
              defAccount.startsWith("6") ||
              defAccount.startsWith("7") ||
              defAccount.startsWith("409") ||
              defType === "Servicii" ||
              defType === "Avans";

            let assignedCode = "";
            let matchedId: number | undefined = undefined;
            let matchType: NirLineForm["matchType"] = "none";
            let matchedWords: string[] | undefined = undefined;
            let matchedSagaName: string | undefined = undefined;

            if (matchedArticle && !isServiceOrAdvance) {
              matchedId = matchedArticle.id > 0 ? matchedArticle.id : undefined;
              assignedCode = matchedArticle.code || "";
              matchType = isAppGeneratedArticleCode(assignedCode)
                ? "new_088"
                : smartMatch.matchType;
              matchedWords = smartMatch.matchedWords;
              matchedSagaName = matchedArticle.name;
            } else if (!isServiceOrAdvance) {
              // Articol nou de stoc: alocăm cod din plaja noastră 088xxxxx (fără suprapunere cu 000xxxxx din SAGA)
              assignedCode = formatAppArticleCode(next088Seq++);
              matchedId = undefined;
              matchType = "new_088";
              candidatePool.push({
                id: -next088Seq,
                code: assignedCode,
                name: l.description || "",
                unit: l.unit || "buc",
                accountingAccount: defAccount,
                category: defType,
                vatRate: String(l.vatRate || "21"),
                knownPrices: !isNaN(unitPrice) && unitPrice > 0 ? [unitPrice] : [],
                lastPrice: !isNaN(unitPrice) && unitPrice > 0 ? unitPrice : null,
              });
            }

            let calcTotal = (remaining * unitPrice).toFixed(2);
            let parsedLTotal = parseFloat(String(l.total || "0"));
            if (isSourceCreditNote && parsedLTotal > 0) {
              parsedLTotal = -parsedLTotal;
            }
            if (isSourceCreditNote && parseFloat(calcTotal) > 0) {
              calcTotal = (-parseFloat(calcTotal)).toFixed(2);
            }
            const finalTotal = !isNaN(parsedLTotal) && parsedLTotal !== 0 && Math.abs(parseFloat(calcTotal)) !== Math.abs(parsedLTotal)
              ? parsedLTotal.toFixed(2)
              : calcTotal;

            const rawLineUnit = matchedArticle
              ? matchedArticle.unit || l.unit || "buc"
              : l.unit || "buc";
            const normalizedLineUnit = normalizeUnit(
              rawLineUnit,
              defAccount,
              defType
            );

            return {
              sagaArticleId: matchedId,
              articleSearchText: assignedCode,
              matchType,
              matchedWords,
              matchedSagaName,
              description: l.description || "",
              unit: normalizedLineUnit,
              cantitateComanda: String(remaining),
              cantitateReceptionata: String(remaining),
              unitPrice: String(unitPrice),
              vatRate: sourceReverseCharge
                ? "0" // taxare inversă (AE): NIR fără TVA, indiferent de articol/linie
                : (l.vatRate !== undefined && l.vatRate !== null && l.vatRate !== "" && !isNaN(parseFloat(String(l.vatRate))))
                ? String(parseFloat(String(l.vatRate))) // cota de pe FACTURĂ are prioritate față de cota din nomenclatorul de articole
                : matchedArticle && matchedArticle.vatRate !== null && matchedArticle.vatRate !== undefined
                ? String(matchedArticle.vatRate)
                : "21",
              total: finalTotal,
              observations: "",
              accountingType: defType,
              accountingAccount: defAccount,
            };
          })
          .filter((l: any) => Math.abs(parseFloat(l.cantitateReceptionata || "0")) > 0 || Math.abs(parseFloat(l.total || "0")) > 0);

        if (newLines.length > 0) {
          setLines(newLines);
          if (newLines[0]?.accountingAccount) {
            setAccountingAccount(newLines[0].accountingAccount);
          }
          if (newLines[0]?.accountingType) {
            setAccountingType(newLines[0].accountingType);
          }
          if (newLines[0]?.unit) {
            setGeneralUnit(newLines[0].unit);
          }
          const dominantVat = newLines.find(l => l.vatRate && parseFloat(l.vatRate) > 0)?.vatRate || newLines[0]?.vatRate;
          if (dominantVat) {
            setGeneralVat(String(parseFloat(String(dominantVat))));
          }
        } else {
          toast.info("Toate produsele din această factură au fost deja recepționate!");
          setLines([]);
        }
      } else {
        let srcTotal = parseFloat(sourceInvoice.total || "0");
        let srcQty = isSourceCreditNote ? "-1" : "1";
        if (isSourceCreditNote && srcTotal > 0) srcTotal = -srcTotal;
        const fallbackCode = formatAppArticleCode(next088Seq++);

        setLines([
          {
            articleSearchText: fallbackCode,
            matchType: "new_088",
            description: `Marfă conform factură ${sourceInvoice.invoiceNumber || ""}`,
            unit: "buc",
            cantitateComanda: srcQty,
            cantitateReceptionata: srcQty,
            unitPrice: String(Math.abs(srcTotal)),
            vatRate: "21",
            total: String(srcTotal),
            observations: "",
            accountingType: "Marfuri",
            accountingAccount: "371",
          },
        ]);
      }
      setLoaded(true);
    }
  }, [sourceInvoice, archiveLines, archiveLinesFetched, isEdit, loaded, articles, articlesFetched, nextArticleCodeData]);

  const addLine = () => {
    setLines(prev => {
      const next088 = computeNext088Seq([
        ...(articles as any[]).map((a: any) => a.code),
        ...prev.map((l) => l.articleSearchText),
        ...(nextArticleCodeData ? [nextArticleCodeData] : []),
      ]);
      const acc = accountingAccount || "371";
      const isSrv = acc.startsWith("6") || acc.startsWith("7") || acc.startsWith("409");
      return [
        ...prev,
        {
          description: "",
          articleSearchText: isSrv ? "" : formatAppArticleCode(next088),
          matchType: isSrv ? "none" : "new_088",
          unit:
            generalUnit ||
            getDefaultUnitForAccount(accountingAccount, accountingType, "buc"),
          cantitateComanda: "1",
          cantitateReceptionata: "1",
          unitPrice: "0",
          vatRate: generalVat || "21",
          total: "0",
          observations: "",
          accountingType: accountingType || "Marfuri",
          accountingAccount: acc,
        },
      ];
    });
  };

  const removeLine = (idx: number) =>
    setLines(prev => prev.filter((_, i) => i !== idx));

  const updateLine = (
    idx: number,
    fieldOrPatch: keyof NirLineForm | Partial<NirLineForm>,
    value?: any
  ) => {
    setLines(prev => {
      const updated = [...prev];
      if (typeof fieldOrPatch === "object" && fieldOrPatch !== null) {
        updated[idx] = { ...updated[idx], ...fieldOrPatch };
        if (fieldOrPatch.accountingAccount && !fieldOrPatch.accountingType) {
          const t = getAccountType(fieldOrPatch.accountingAccount);
          if (t) updated[idx].accountingType = t;
        }
        if (
          (fieldOrPatch.accountingAccount || fieldOrPatch.accountingType) &&
          !("unit" in fieldOrPatch)
        ) {
          updated[idx].unit = getDefaultUnitForAccount(
            updated[idx].accountingAccount,
            updated[idx].accountingType,
            normalizeUnit(updated[idx].unit)
          );
        }
      } else {
        const field = fieldOrPatch as keyof NirLineForm;
        updated[idx] = { ...updated[idx], [field]: value };
        if (field === "accountingType" && value) {
          if (TIP_TO_CONT[value]) {
            updated[idx].accountingAccount = TIP_TO_CONT[value];
          }
          updated[idx].unit = getDefaultUnitForAccount(
            updated[idx].accountingAccount,
            value,
            normalizeUnit(updated[idx].unit)
          );
        }
        if (field === "accountingAccount" && value) {
          const t = getAccountType(value);
          if (t) updated[idx].accountingType = t;
          updated[idx].unit = getDefaultUnitForAccount(
            value,
            updated[idx].accountingType,
            normalizeUnit(updated[idx].unit)
          );
        }
      }

      const isQtyOrPriceChange =
        fieldOrPatch === "cantitateReceptionata" ||
        fieldOrPatch === "unitPrice" ||
        (typeof fieldOrPatch === "object" && ("cantitateReceptionata" in fieldOrPatch || "unitPrice" in fieldOrPatch));

      if (fieldOrPatch !== "total" && (isQtyOrPriceChange || !updated[idx].total)) {
        const qty = parseFloat(updated[idx].cantitateReceptionata) || 0;
        const price = parseFloat(updated[idx].unitPrice) || 0;
        const descLower = String(updated[idx].description || "").toLowerCase();
        const isDiscount = descLower.includes("rabat") || descLower.includes("discount") || descLower.includes("reducere") || (qty < 0 && price < 0);

        if (isDiscount) {
          const absQty = Math.abs(qty) || 1;
          const absPrice = Math.abs(price);
          updated[idx].unitPrice = absPrice.toFixed(2);
          updated[idx].cantitateReceptionata = String(-absQty);
          updated[idx].cantitateComanda = String(-absQty);
          updated[idx].total = (-absQty * absPrice).toFixed(2);
        } else {
          updated[idx].total = (qty * price).toFixed(2);
        }
      }
      
      // Auto-link article if description or unitPrice matches (exact or >= 2 words + same price)
      if (fieldOrPatch === "description" || fieldOrPatch === "unitPrice") {
        const descText = String(updated[idx].description || "");
        const priceVal = updated[idx].unitPrice;
        const candidatePool: CandidateArticle[] = (articles as any[]).map((a: any) => ({
          id: a.id,
          code: String(a.code || "").trim(),
          name: String(a.name || "").trim(),
          unit: a.unit,
          accountingAccount: a.accountingAccount,
          category: a.category,
          vatRate: a.vatRate,
          knownPrices: a.knownPrices || [],
          lastPrice: a.lastPrice ?? null,
        }));
        const smartMatch = findBestArticleMatch(descText, priceVal, candidatePool);
        if (smartMatch) {
          const matched = smartMatch.article;
          updated[idx].sagaArticleId = matched.id > 0 ? matched.id : undefined;
          updated[idx].articleSearchText = matched.code || matched.name;
          updated[idx].matchType = isAppGeneratedArticleCode(matched.code)
            ? "new_088"
            : smartMatch.matchType;
          updated[idx].matchedWords = smartMatch.matchedWords;
          updated[idx].matchedSagaName = matched.name;
          updated[idx].accountingType = matched.category || updated[idx].accountingType;
          updated[idx].accountingAccount = matched.accountingAccount || updated[idx].accountingAccount;
          updated[idx].unit = normalizeUnit(
            matched.unit || updated[idx].unit,
            updated[idx].accountingAccount,
            updated[idx].accountingType
          );
          if (matched.vatRate !== null && matched.vatRate !== undefined && !sourceReverseCharge) {
            updated[idx].vatRate = String(matched.vatRate);
          }
        } else if (fieldOrPatch === "description") {
          const lower = descText.toLowerCase();
          if (lower.includes("avans")) {
            updated[idx].accountingType = "Avans";
            updated[idx].accountingAccount = "4091";
            updated[idx].articleSearchText = "";
            updated[idx].matchType = "none";
          } else if (lower.includes("transport")) {
            updated[idx].accountingType = "Transport";
            updated[idx].accountingAccount = "624";
            updated[idx].articleSearchText = "";
            updated[idx].matchType = "none";
          } else if (lower.includes("protocol") || lower.includes("cafea")) {
            updated[idx].accountingType = "Protocol";
            updated[idx].accountingAccount = "6231";
            updated[idx].articleSearchText = "";
            updated[idx].matchType = "none";
          } else if (lower.includes("servici")) {
            updated[idx].accountingType = "Servicii";
            updated[idx].accountingAccount = "628";
            updated[idx].articleSearchText = "";
            updated[idx].matchType = "none";
          } else if (!updated[idx].articleSearchText || updated[idx].sagaArticleId) {
            const next088 = computeNext088Seq([
              ...(articles as any[]).map((a: any) => a.code),
              ...updated.map((l, i) => (i === idx ? "" : l.articleSearchText)),
              ...(nextArticleCodeData ? [nextArticleCodeData] : []),
            ]);
            updated[idx].sagaArticleId = undefined;
            updated[idx].articleSearchText = formatAppArticleCode(next088);
            updated[idx].matchType = "new_088";
            updated[idx].matchedWords = undefined;
            updated[idx].matchedSagaName = undefined;
          }
        }
      }
      
      // Auto-fill when selecting an article or typing code
      if (fieldOrPatch === "articleSearchText") {
        const cleanVal = String(value || "").trim();
        const codePart = cleanVal.split(" - ")[0].trim();
        const matched = articles.find(
          (a: any) =>
            a.code === cleanVal ||
            a.code === codePart ||
            a.name?.toLowerCase() === cleanVal.toLowerCase() ||
            `${a.code} - ${a.name}` === cleanVal
        );
        if (matched) {
          updated[idx].sagaArticleId = matched.id;
          updated[idx].articleSearchText = matched.code || matched.name;
          updated[idx].accountingType = matched.category || updated[idx].accountingType;
          updated[idx].accountingAccount = matched.accountingAccount || updated[idx].accountingAccount;
          updated[idx].unit = normalizeUnit(
            matched.unit || updated[idx].unit,
            updated[idx].accountingAccount,
            updated[idx].accountingType
          );
          if (matched.vatRate !== null && matched.vatRate !== undefined && !sourceReverseCharge) updated[idx].vatRate = String(matched.vatRate);
        } else {
          updated[idx].sagaArticleId = undefined;
          updated[idx].articleSearchText = value;
        }
      }
      return updated;
    });
  };

  const buildPayload = () => ({
    nirNumber,
    invoiceArchiveId: sourceInvoiceId || undefined,
    invoiceNumber,
    avizNumber: avizNumber || undefined,
    supplierName,
    supplierCUI,
    supplierAddress: supplierAddress || undefined,
    gestiune: gestiune || undefined,
    accountingType: accountingType || undefined,
    accountingAccount: accountingAccount || undefined,
    currency: currency || undefined,
    exchangeRate: exchangeRate || undefined,
    receiptDate,
    member1Name: member1Name || undefined,
    member1Function: member1Function || undefined,
    member2Name: member2Name || undefined,
    member2Function: member2Function || undefined,
    member3Name: member3Name || undefined,
    member3Function: member3Function || undefined,
    hasDifferences: hasDifferences ? 1 : 0,
    differenceNotes: differenceNotes || undefined,
    notes: notes || (spvIndex ? `Index încărcare SPV: ${spvIndex}` : undefined),
    lines: lines.map((l, idx) => ({
      id: l.id,
      description: l.description || "—",
      unit: l.unit,
      cantitateComanda: l.cantitateComanda,
      cantitateReceptionata: l.cantitateReceptionata,
      unitPrice: l.unitPrice,
      vatRate: l.vatRate,
      total: l.total,
      observations: l.observations,
      accountingType: l.accountingType,
      accountingAccount: l.accountingAccount,
      lineOrder: idx,
      sagaArticleId: l.sagaArticleId,
      articleCode: l.articleSearchText?.split(" - ")[0]?.trim() || undefined,
    })),
  });

  const handleSave = () => {
    if (!receiptDate) {
      toast.error("Data recepției este obligatorie!");
      return;
    }
    const payload = buildPayload();
    if (isEdit) updateNir.mutate({ id: nirId!, ...payload });
    else createNir.mutate(payload);
  };

  const totalFaraTva = lines.reduce(
    (s, l) => s + (parseFloat(l.total) || 0),
    0
  );
  const totalTva = lines.reduce(
    (s, l) => {
      const r = parseFloat(l.vatRate);
      const rate = isNaN(r) ? 21 : r; // 0% este valid
      return s + Math.round((((parseFloat(l.total) || 0) * rate) / 100) * 100) / 100;
    },
    0
  );
  const totalCuTva = totalFaraTva + totalTva;

  const invTotalNum = sourceInvoice?.total != null ? parseFloat(String(sourceInvoice.total)) : null;

  const isCreditNote = Boolean(
    invTotalNum !== null && !isNaN(invTotalNum)
      ? (invTotalNum < 0 || (
          (sourceInvoice as any)?.isCreditNote ||
          sourceInvoice?.rawXml?.includes("<CreditNote") ||
          sourceInvoice?.rawXml?.includes(":CreditNote") ||
          sourceInvoice?.rawXml?.includes("CreditNoteLine") ||
          sourceInvoice?.rawXml?.includes("<cbc:InvoiceTypeCode>381</cbc:InvoiceTypeCode>") ||
          sourceInvoice?.rawXml?.includes("<InvoiceTypeCode>381</InvoiceTypeCode>") ||
          ((sourceInvoice as any)?.notes || "").toLowerCase().includes("storno") ||
          (existingNir as any)?.notes?.toLowerCase().includes("storno")
        )) && invTotalNum <= 0
      : (
          (sourceInvoice as any)?.isCreditNote ||
          sourceInvoice?.rawXml?.includes("<CreditNote") ||
          sourceInvoice?.rawXml?.includes(":CreditNote") ||
          sourceInvoice?.rawXml?.includes("CreditNoteLine") ||
          sourceInvoice?.rawXml?.includes("<cbc:InvoiceTypeCode>381</cbc:InvoiceTypeCode>") ||
          sourceInvoice?.rawXml?.includes("<InvoiceTypeCode>381</InvoiceTypeCode>") ||
          ((sourceInvoice as any)?.notes || "").toLowerCase().includes("storno") ||
          (existingNir as any)?.notes?.toLowerCase().includes("storno") ||
          totalCuTva < 0
        )
  );

  return (
    <div className="p-3 sm:p-5 space-y-5 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
              <ClipboardCheck className="w-5 h-5" style={{ color: "var(--tenant-theme-color, #16a34a)" }} />
              {isEdit ? nirNumber : (nirNumber ? `NIR Nou — ${nirNumber}` : "NIR Nou")}
              {isCreditNote && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 ml-1">
                  STORNO
                </span>
              )}
              {spvIndex && (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 ml-1"
                  title={`Index încărcare ANAF SPV: ${spvIndex}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                  Index SPV: {spvIndex}
                </span>
              )}
              {currency && currency !== "RON" && currency !== "LEI" && (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 ml-1"
                  title={`Factură în valută (${currency}) la cursul de ${parseFloat(exchangeRate || "1").toFixed(4)} RON`}
                >
                  Valută: {currency} (Curs: {parseFloat(exchangeRate || "1").toFixed(4)})
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Notă de Intrare-Recepție — OMFP 2634/2015
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {linkedInvoiceId && (
            <button
              type="button"
              onClick={() => setInvoicePdfOpen(true)}
              title="Vezi factura furnizorului (PDF) direct în aplicație"
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-bold border border-amber-200 dark:border-amber-800 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Factură
            </button>
          )}
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            title="Vezi documentul NIR direct în aplicație, fără descărcare"
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-200 dark:border-indigo-800 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            Previzualizare
          </button>
          <button
            type="button"
            onClick={handleOpenSagaSimulator}
            disabled={simulateNirImportMut.isPending}
            title="Simulează și verifică cum va apărea acest NIR la importul în SAGA C (Intrări)"
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-950/60 text-sky-800 dark:text-sky-300 text-xs font-bold border border-sky-200 dark:border-sky-800 transition-colors disabled:opacity-50"
          >
            {simulateNirImportMut.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-sky-600" />
            )}
            Simulează SAGA
          </button>
          {isEdit && (
            <>
              <button
                type="button"
                onClick={handleSaveSagaXml}
                disabled={exportNirMut.isPending}
                title="Salvează fișier XML pentru SAGA C (alege calea de salvare)"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--tenant-theme-color, #16a34a) 10%, transparent)",
                  borderColor: "color-mix(in srgb, var(--tenant-theme-color, #16a34a) 25%, transparent)",
                  color: "var(--tenant-theme-color, #16a34a)",
                }}
                className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-bold border transition-colors hover:brightness-95 disabled:opacity-50"
              >
                {exportNirMut.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileCode className="w-3.5 h-3.5" />
                )}
                SAGA XML
              </button>
              <button
                type="button"
                onClick={handleSavePdfNir}
                disabled={isSavingPdf}
                title="Salvează PDF NIR (alege calea de salvare)"
                className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-50"
              >
                {isSavingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileDown className="w-3.5 h-3.5" />
                )}
                PDF NIR
              </button>
            </>
          )}
          {status !== "finalizat" && isEdit && (
            <button
              onClick={() => finalizeNir.mutate({ id: nirId! })}
              disabled={finalizeNir.isPending}
              style={{
                backgroundColor: "color-mix(in srgb, var(--tenant-theme-color, #16a34a) 10%, transparent)",
                borderColor: "color-mix(in srgb, var(--tenant-theme-color, #16a34a) 25%, transparent)",
                color: "var(--tenant-theme-color, #16a34a)",
              }}
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-bold border transition-colors hover:brightness-95"
            >
              {finalizeNir.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5" />
              )}
              Finalizează
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={createNir.isPending || updateNir.isPending}
            style={{ backgroundColor: "var(--tenant-theme-color, #16a34a)" }}
            className="flex items-center gap-1.5 px-4 h-8 rounded-lg text-white text-xs font-bold transition-all shadow-sm hover:brightness-90 active:brightness-75 disabled:opacity-60"
          >
            {createNir.isPending || updateNir.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {isEdit ? "Salvează" : "Creează NIR"}
          </button>
        </div>
      </div>

      {/* ─── SECȚIUNEA 1: Date NIR ─── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
          I. Date NIR
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
          <div>
            <label className={LABEL_CLS}>Nr. NIR *</label>
            <input
              type="text"
              value={nirNumber}
              onChange={e => setNirNumber(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800 text-sm font-mono font-bold text-slate-900 dark:text-white shadow-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="ex: NIR-2026-0001"
            />
          </div>
          <div>
            <label className={LABEL_CLS}>Dată recepție *</label>
            <input
              type="date"
              value={receiptDate}
              onChange={e => setReceiptDate(e.target.value)}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className={LABEL_CLS}>Nr. Factură furnizor</label>
            <input
              value={invoiceNumber}
              onChange={e => setInvoiceNumber(e.target.value)}
              className={INPUT_CLS}
              placeholder="Nr. factură"
            />
          </div>
          <div>
            <label className={LABEL_CLS}>Nr. Aviz de însoțire</label>
            <input
              value={avizNumber}
              onChange={e => setAvizNumber(e.target.value)}
              className={INPUT_CLS}
              placeholder="opțional"
            />
          </div>
          <div className="md:col-span-1">
            <label className={LABEL_CLS}>Gestiunea destinatară</label>
            <input
              value={gestiune}
              onChange={e => setGestiune(e.target.value)}
              className={INPUT_CLS}
              placeholder="Gestiune"
            />
          </div>
          <div>
            <label className={LABEL_CLS}>ID Încărcare SPV</label>
            <input
              type="text"
              value={spvIndex}
              onChange={e => setSpvIndex(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/30 text-xs font-mono font-bold text-teal-800 dark:text-teal-300 shadow-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Index ANAF SPV"
              title="Identificatorul de încărcare din Spațiul Privat Virtual ANAF"
            />
          </div>
          <div className="md:col-span-1 flex items-center gap-2">
            <label className="text-[10px] font-bold uppercase text-slate-400 whitespace-nowrap">Afișare Conturi</label>
            <button
              type="button"
              onClick={() => setShowAccounting(v => !v)}
              style={showAccounting ? { backgroundColor: "var(--tenant-theme-color, #16a34a)" } : {}}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showAccounting ? '' : 'bg-slate-300 dark:bg-slate-600'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${showAccounting ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          {showAccounting && (
            <div className="md:col-span-1">
              <label className={LABEL_CLS}>Tip / Cont (General)</label>
              <PlanConturiCombobox
                displayMode="name"
                value={accountingAccount}
                accounts={planConturiList}
                onChange={(cont, denumire) => {
                  setAccountingAccount(cont);
                  const t = denumire || getAccountType(cont);
                  setAccountingType(t);
                  const defaultUm = getDefaultUnitForAccount(
                    cont,
                    t,
                    generalUnit || "buc"
                  );
                  setGeneralUnit(defaultUm);
                  setLines(prev =>
                    prev.map(l => ({
                      ...l,
                      accountingType: t,
                      accountingAccount: cont,
                      unit: defaultUm,
                    }))
                  );
                }}
                placeholder="Tip (ex: Mărfuri)"
              />
            </div>
          )}
          <div className="md:col-span-1">
            <label className={LABEL_CLS}>U/M (General)</label>
            <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
              <select
                value={
                  lines.length > 0 && !lines.every(l => l.unit === generalUnit)
                    ? ""
                    : generalUnit
                }
                onChange={e => {
                  const u = e.target.value;
                  if (!u) return;
                  setGeneralUnit(u);
                  setLines(prev => prev.map(l => ({ ...l, unit: u })));
                }}
                style={SELECT_STYLE}
                className="w-full h-8 px-2.5 pr-7 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none border-none"
              >
                <option value="" disabled>
                  — Mixt (alege) —
                </option>
                <option value="buc">buc</option>
                <option value="kg">kg</option>
                <option value="l">l</option>
                <option value="m">m</option>
                <option value="mp">mp</option>
                <option value="mc">mc</option>
                <option value="set">set</option>
                <option value="cutie">cutie</option>
                <option value="rolă">rolă</option>
                <option value="oră">oră</option>
                <option value="pachet">pachet</option>
                <option value="per">per</option>
                <option value="sac">sac</option>
              </select>
            </div>
          </div>
          <div className="md:col-span-1">
            <label className={LABEL_CLS}>TVA (General) %</label>
            <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
              <select
                value={generalVat}
                onChange={e => {
                  const v = e.target.value;
                  setGeneralVat(v);
                  setLines(prev => prev.map(l => ({ ...l, vatRate: v })));
                }}
                style={SELECT_STYLE}
                className="w-full h-8 px-2.5 pr-7 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none border-none"
              >
                <option value="21">21</option>
                <option value="11">11</option>
                <option value="19">19</option>
                <option value="9">9</option>
                <option value="5">5</option>
                <option value="0">0</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ─── SECȚIUNEA 2: Furnizor ─── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
          II. Date Furnizor
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-1">
            <label className={LABEL_CLS}>Denumire furnizor</label>
            <input
              value={supplierName}
              onChange={e => setSupplierName(e.target.value)}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className={LABEL_CLS}>CUI / CIF Furnizor</label>
            <input
              value={supplierCUI}
              onChange={e => setSupplierCUI(e.target.value)}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className={LABEL_CLS}>Adresă furnizor</label>
            <input
              value={supplierAddress}
              onChange={e => setSupplierAddress(e.target.value)}
              className={INPUT_CLS}
              placeholder="Str., nr., localitate"
            />
          </div>
        </div>
      </div>

      {/* ─── SECȚIUNEA 3: Tabel produse ─── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              III. Produse / Servicii recepționate
            </p>
            <Link
              href="/saga-sync"
              target="_blank"
              className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Sincronizează articole noi din SAGA
            </Link>
          </div>
          <button
            onClick={addLine}
            style={{
              backgroundColor: "color-mix(in srgb, var(--tenant-theme-color, #16a34a) 10%, transparent)",
              borderColor: "color-mix(in srgb, var(--tenant-theme-color, #16a34a) 25%, transparent)",
              color: "var(--tenant-theme-color, #16a34a)",
            }}
            className="flex items-center gap-1 px-3 h-7 rounded-lg text-xs font-bold border transition-colors hover:brightness-95"
          >
            <Plus className="w-3 h-3" /> Adaugă linie
          </button>
        </div>
        <div className="overflow-x-auto pb-4">
          <table className="w-full text-xs min-w-[980px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="pl-3 pr-1 py-2 text-left text-[10px] font-bold uppercase text-slate-400 w-[32px]">Nr.</th>
                <th className="px-1 py-2 text-left text-[10px] font-bold uppercase text-slate-400 min-w-[150px]">Denumire produs/serviciu</th>
                <th className="px-1 py-2 text-left text-[10px] font-bold uppercase text-slate-400 min-w-[135px] w-[150px]">Articol (Stoc)</th>
                {showAccounting && <th className="px-1 py-2 text-left text-[10px] font-bold uppercase text-slate-400 min-w-[120px] w-[130px]">Tip</th>}
                <th className="px-1 py-2 text-center text-[10px] font-bold uppercase text-slate-400 w-[52px]">U/M</th>
                <th className="px-1 py-2 text-center text-[10px] font-bold uppercase text-slate-400 w-[62px]">Cant. doc.</th>
                <th
                  style={{ backgroundColor: "color-mix(in srgb, var(--tenant-theme-color, #16a34a) 8%, transparent)" }}
                  className="px-1 py-2 text-center text-[10px] font-bold uppercase text-slate-400 w-[66px]"
                >
                  Cant. recept.
                </th>
                <th className="px-1 py-2 text-right text-[10px] font-bold uppercase text-slate-400 w-[84px]">Preț unit.</th>
                <th className="px-1 py-2 text-center text-[10px] font-bold uppercase text-slate-400 w-[50px]">TVA %</th>
                <th className="px-1 py-2 text-right text-[10px] font-bold uppercase text-slate-400 w-[96px]">Valoare</th>
                <th className="px-1 py-2 text-left text-[10px] font-bold uppercase text-slate-400 min-w-[80px] w-[100px]">Obs.</th>
                <th className="pr-2 pl-1 py-2 w-[34px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={showAccounting ? 12 : 11} className="py-6 text-center text-xs text-slate-400">
                    Nicio linie. Apasă Adaugă linie.
                  </td>
                </tr>
              ) : (
                lines.map((line, idx) => {
                  const diff =
                    parseFloat(line.cantitateReceptionata || "0") !==
                    parseFloat(line.cantitateComanda || "0");
                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/20 ${diff ? "bg-amber-50/40 dark:bg-amber-900/10" : ""}`}
                    >
                      <td className="pl-3 pr-1 py-1.5 text-slate-400 font-semibold">{idx + 1}</td>
                      <td className="px-1 py-1.5 min-w-[150px]">
                        <input
                          value={line.description}
                          onChange={e => updateLine(idx, "description", e.target.value)}
                          className="w-full h-7 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
                          placeholder="Denumire produs sau serviciu..."
                        />
                      </td>
                      <td className="px-1 py-1.5 min-w-[135px]">
                        <div className="min-w-[130px]">
                          <ArticleCombobox
                            value={line.articleSearchText ?? ""}
                            articles={articles}
                            onChange={(code, art) => {
                              const patch: Partial<NirLineForm> = {
                                articleSearchText: code,
                                matchType: isAppGeneratedArticleCode(code)
                                  ? "new_088"
                                  : art
                                  ? "exact"
                                  : "none",
                                matchedWords: undefined,
                                matchedSagaName: art?.name,
                              };
                              if (art) {
                                if (art.id) patch.sagaArticleId = art.id;
                                if (art.vatRate !== null && art.vatRate !== undefined && !sourceReverseCharge) patch.vatRate = String(art.vatRate);
                                if (art.category) patch.accountingType = art.category;
                                if (art.accountingAccount) patch.accountingAccount = art.accountingAccount;
                                patch.unit = normalizeUnit(
                                  art.unit || line.unit,
                                  art.accountingAccount || line.accountingAccount,
                                  art.category || line.accountingType
                                );
                              }
                              updateLine(idx, patch);
                            }}
                            placeholder="Articol SAGA (lasă gol pt nou)"
                          />
                          {line.matchType === "words_and_price" ? (
                            <div
                              className="mt-0.5 text-[10px] text-indigo-700 dark:text-indigo-300 flex items-center gap-1 truncate max-w-[150px]"
                              title={`Asociat inteligent cu "${line.matchedSagaName || ""}" pe baza cuvintelor (${(line.matchedWords || []).join(", ")}) și a prețului identic`}
                            >
                              <Sparkles className="w-2.5 h-2.5 shrink-0 text-indigo-600" />
                              <span className="truncate">
                                Asociat (2+ cuv &amp; preț): <strong>{line.matchedSagaName}</strong>
                              </span>
                            </div>
                          ) : isAppGeneratedArticleCode(line.articleSearchText) ? (
                            <div
                              className="mt-0.5 text-[10px] text-violet-700 dark:text-violet-300 font-medium truncate"
                              title="Cod 088xxxxx generat automat de aplicație pentru articol nou (nu se suprapune cu SAGA 000xxxxx)"
                            >
                              Cod nou aplicație ({line.articleSearchText})
                            </div>
                          ) : line.articleSearchText && /^000\d+$/.test(line.articleSearchText.trim()) ? (
                            <div
                              className="mt-0.5 text-[10px] text-sky-700 dark:text-sky-300 font-medium truncate"
                              title={line.matchedSagaName || "Articol existent în SAGA C"}
                            >
                              Articol SAGA ({line.articleSearchText})
                            </div>
                          ) : null}
                        </div>
                      </td>
                      {showAccounting && (
                        <td className="px-1 py-1.5 min-w-[120px] w-[130px]">
                          <div className="min-w-[115px]">
                            <PlanConturiCombobox
                              size="sm"
                              displayMode="both"
                              value={line.accountingAccount || "371"}
                              accounts={planConturiList}
                              onChange={(cont, denumire) => {
                                const t = getAccountType(cont) || denumire || "Mărfuri";
                                updateLine(idx, {
                                  accountingAccount: cont,
                                  accountingType: t,
                                });
                              }}
                              placeholder="Tip (ex: 371)"
                            />
                          </div>
                        </td>
                      )}
                      <td className="px-1 py-1.5 w-[52px]">
                        <input
                          value={line.unit}
                          onChange={e => updateLine(idx, "unit", e.target.value)}
                          className="w-full h-7 px-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
                        />
                      </td>
                      <td className="px-1 py-1.5 w-[62px]">
                        <input
                          type="number"
                          value={line.cantitateComanda}
                          onChange={e => updateLine(idx, "cantitateComanda", e.target.value)}
                          className="w-full h-7 px-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 text-slate-600 focus:outline-none text-xs text-center"
                        />
                      </td>
                      <td
                        style={{ backgroundColor: "color-mix(in srgb, var(--tenant-theme-color, #16a34a) 6%, transparent)" }}
                        className="px-1 py-1.5 w-[66px]"
                      >
                        <input
                          type="number"
                          value={line.cantitateReceptionata}
                          onChange={e => updateLine(idx, "cantitateReceptionata", e.target.value)}
                          style={!diff ? {
                            borderColor: "color-mix(in srgb, var(--tenant-theme-color, #16a34a) 30%, transparent)",
                            color: "var(--tenant-theme-color, #16a34a)",
                          } : {}}
                          className={`w-full h-7 px-1 rounded-lg border focus:outline-none focus:ring-1 focus:ring-primary text-xs text-center font-bold ${diff ? "border-amber-300 text-amber-700 bg-amber-50" : "bg-white dark:bg-slate-800"}`}
                        />
                      </td>
                      <td className="px-1 py-1.5 w-[84px]">
                        <input
                          type="number"
                          value={line.unitPrice}
                          onChange={e => updateLine(idx, "unitPrice", e.target.value)}
                          className="w-full h-7 px-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-primary text-xs text-right"
                        />
                      </td>
                      <td className="px-1 py-1.5 w-[52px]">
                        <input
                          type="number"
                          value={line.vatRate === "" || line.vatRate == null ? "21" : line.vatRate}
                          onChange={e => updateLine(idx, "vatRate", e.target.value)}
                          className="w-full h-7 px-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 text-slate-600 focus:outline-none text-xs text-center"
                        />
                      </td>
                      <td className="px-1 py-1.5 w-[96px]">
                        <input
                          type="number"
                          step="0.01"
                          value={line.total}
                          onChange={e => updateLine(idx, "total", e.target.value)}
                          className="w-full h-7 px-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-primary text-xs text-right font-bold text-slate-700 dark:text-slate-300"
                        />
                      </td>
                      <td className="px-1 py-1.5 min-w-[80px]">
                        <input
                          value={line.observations}
                          onChange={e => updateLine(idx, "observations", e.target.value)}
                          placeholder="obs..."
                          className="w-full h-7 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                        />
                      </td>
                      <td className="pr-2 pl-1 py-1.5 w-[34px]">
                        <button
                          onClick={() => removeLine(idx)}
                          className="flex items-center justify-center w-6 h-6 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <td colSpan={showAccounting ? 9 : 8} className="px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 text-right">
                  TOTAL FĂRĂ TVA{currency && currency !== "RON" && currency !== "LEI" ? ` (${currency})` : ""}:
                </td>
                <td className="px-1 py-2 text-right text-sm font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  {totalFaraTva.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td colSpan={2}></td>
              </tr>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700/50">
                <td colSpan={showAccounting ? 9 : 8} className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 text-right">
                  TOTAL TVA{currency && currency !== "RON" && currency !== "LEI" ? ` (${currency})` : ""}:
                </td>
                <td className="px-1 py-1.5 text-right text-sm font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  {totalTva.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td colSpan={2}></td>
              </tr>
              <tr
                style={{
                  backgroundColor: "color-mix(in srgb, var(--tenant-theme-color, #16a34a) 8%, transparent)",
                  borderColor: "color-mix(in srgb, var(--tenant-theme-color, #16a34a) 20%, transparent)",
                }}
                className="border-t"
              >
                <td
                  colSpan={showAccounting ? 9 : 8}
                  style={{ color: "var(--tenant-theme-color, #16a34a)" }}
                  className="px-3 py-2 text-xs font-black text-right"
                >
                  {isCreditNote ? "TOTAL CU TVA (STORNO)" : "TOTAL CU TVA"}{currency && currency !== "RON" && currency !== "LEI" ? ` (${currency})` : ""}:
                </td>
                <td
                  style={{ color: "var(--tenant-theme-color, #16a34a)" }}
                  className="px-1 py-2 text-right text-[15px] font-black whitespace-nowrap"
                >
                  {totalCuTva.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td colSpan={2}></td>
              </tr>
              {currency && currency !== "RON" && currency !== "LEI" && (
                <tr className="bg-blue-50/70 dark:bg-blue-950/40 border-t border-blue-200 dark:border-blue-800/60">
                  <td
                    colSpan={showAccounting ? 9 : 8}
                    className="px-3 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-300 text-right"
                  >
                    Echivalent RON (curs {parseFloat(exchangeRate || "1").toFixed(4)}):
                  </td>
                  <td className="px-1 py-1.5 text-right text-xs font-black text-blue-800 dark:text-blue-200 whitespace-nowrap">
                    {(totalCuTva * (parseFloat(exchangeRate) || 1)).toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON
                  </td>
                  <td colSpan={2}></td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      </div>

      {/* ─── SECȚIUNEA 4: Diferențe (auto-show) ─── */}
      {hasDifferences && (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
              IV. Constatări diferențe cantitative
            </p>
          </div>
          <p className="text-xs text-amber-700 mb-2">
            Există diferențe între cantitățile din documente și cele efectiv
            recepționate. Conform legislației, NIR-ul se întocmește în 3
            exemplare.
          </p>
          <div>
            <label className="text-xs text-amber-700 mb-1 block font-medium">
              Detalii constatări diferențe
            </label>
            <textarea
              value={differenceNotes}
              onChange={e => setDifferenceNotes(e.target.value)}
              rows={3}
              placeholder="Descrieți motivele diferențelor constatate"
              className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            />
          </div>
        </div>
      )}

      {/* ─── SECȚIUNEA 5: Comisia de recepție ─── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
        <button
          type="button"
          onClick={() => setCommissionOpen(o => !o)}
          aria-expanded={commissionOpen}
          className="w-full flex items-center justify-between gap-3 text-left"
        >
          <span className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {hasDifferences ? "V." : "IV."} Comisia de recepție
            </span>
            {!commissionOpen && (
              <span className="block text-xs text-slate-500 dark:text-slate-400 truncate mt-1">
                {[
                  [member1Name, member1Function],
                  [member2Name, member2Function],
                  [member3Name, member3Function],
                ]
                  .map(([n, f]) => [n, f].filter(Boolean).join(" – "))
                  .filter(Boolean)
                  .join("  •  ") || "Nicio persoană completată — apasă pentru a completa"}
              </span>
            )}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${commissionOpen ? "rotate-180" : ""}`}
          />
        </button>

        {commissionOpen && (
        <>
        <p className="text-xs text-slate-400 mt-3 mb-3">
          Completați numele și funcția membrilor comisiei de recepție.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              name: member1Name,
              setName: setMember1Name,
              func: member1Function,
              setFunc: setMember1Function,
              label: "Membru 1",
            },
            {
              name: member2Name,
              setName: setMember2Name,
              func: member2Function,
              setFunc: setMember2Function,
              label: "Membru 2",
            },
            {
              name: member3Name,
              setName: setMember3Name,
              func: member3Function,
              setFunc: setMember3Function,
              label: "Membru 3",
            },
          ].map((m, i) => (
            <div
              key={i}
              className="border border-slate-100 dark:border-slate-800 rounded-lg p-3 space-y-2"
            >
              <p className="text-[10px] font-bold uppercase text-slate-400">
                {m.label}
              </p>
              <div>
                <label className={LABEL_CLS}>Nume și Prenume</label>
                <input
                  value={m.name}
                  onChange={e => m.setName(e.target.value)}
                  className={INPUT_CLS}
                  placeholder="Ion Popescu"
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Funcția</label>
                <input
                  value={m.func}
                  onChange={e => m.setFunc(e.target.value)}
                  className={INPUT_CLS}
                  placeholder="Funcție"
                />
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="text-[10px] text-slate-400">Semnătură</label>
                <div className="h-8 border-b-2 border-slate-300 dark:border-slate-600 mt-1 w-full"></div>
              </div>
            </div>
          ))}
        </div>
        </>
        )}
      </div>

      {/* ─── SECȚIUNEA 6: Observații ─── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
          Observații generale
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Observații privind recepția mărfurilor..."
          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
        />
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center gap-3 pb-4 flex-wrap">
        <div className="text-xs text-slate-400">
          {hasDifferences && (
            <span className="flex items-center gap-1 text-amber-600 font-medium">
              <AlertTriangle className="w-3.5 h-3.5" />
              Diferențe detectate — 3 exemplare obligatorii
            </span>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => window.history.back()}
            className="px-4 h-9 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Anulează
          </button>
          {isEdit && status !== "finalizat" && (
            <button
              onClick={() => finalizeNir.mutate({ id: nirId! })}
              disabled={finalizeNir.isPending}
              style={{
                backgroundColor: "color-mix(in srgb, var(--tenant-theme-color, #16a34a) 12%, transparent)",
                borderColor: "color-mix(in srgb, var(--tenant-theme-color, #16a34a) 30%, transparent)",
                color: "var(--tenant-theme-color, #16a34a)",
              }}
              className="flex items-center gap-1.5 px-4 h-9 rounded-lg border text-sm font-bold transition-all hover:brightness-95"
            >
              <CheckCircle className="w-4 h-4" /> Finalizează NIR
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={createNir.isPending || updateNir.isPending}
            style={{ backgroundColor: "var(--tenant-theme-color, #16a34a)" }}
            className="flex items-center gap-1.5 px-5 h-9 rounded-lg text-white text-sm font-bold transition-all shadow-sm hover:brightness-90 active:brightness-75 disabled:opacity-60"
          >
            {createNir.isPending || updateNir.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isEdit ? "Salvează modificările" : "Creează NIR"}
          </button>
        </div>
      </div>
      <NirPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        getPayload={() => ({ ...buildPayload(), spvIndex, status })}
        showAccounting={showAccounting}
        nirNumber={nirNumber}
        nirId={nirId}
      />
      <PdfViewerDialog
        open={invoicePdfOpen}
        onOpenChange={setInvoicePdfOpen}
        url={linkedInvoiceId ? `/api/pdf/archive/${linkedInvoiceId}` : null}
        title={`Factură ${invoiceNumber || ""}`.trim()}
        fileName={`Factura-${String(invoiceNumber || linkedInvoiceId || "document").replace(/[\\/:*?"<>|]/g, "_")}.pdf`}
      />
      <SagaImportSimulatorModal
        open={simulatorOpen}
        onOpenChange={setSimulatorOpen}
        loading={simulateNirImportMut.isPending}
        data={simulationData}
      />
    </div>
  );
}
