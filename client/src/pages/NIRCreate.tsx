// NIRCreate — Creare / Editare NIR (Nota de Intrare-Recepție)
// Format legal OMFP 2634/2015, cod formular 14-3-1/aA

import { useState, useEffect } from "react";
import { useParams } from "wouter";
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
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface NirLineForm {
  id?: number;
  sagaArticleId?: number;
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
  "Materii prime": "301",
  Consumabile: "3028",
  Nedefinit: "371",
  Servicii: "704",
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
  const [notes, setNotes] = useState("");
  // Furnizor
  const [supplierName, setSupplierName] = useState("");
  const [supplierCUI, setSupplierCUI] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
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
  const [generalVat, setGeneralVat] = useState("19");

  // Compute differences
  const hasDifferences = lines.some(
    l =>
      parseFloat(l.cantitateReceptionata || "0") !==
      parseFloat(l.cantitateComanda || "0")
  );

  // Queries
  const { data: nextNumber } = trpc.nir.getNextNumber.useQuery(undefined, {
    enabled: !isEdit,
  });
  const { data: existingNir } = trpc.nir.getById.useQuery(
    { id: nirId! },
    { enabled: isEdit }
  );
  const { data: sourceInvoice } = trpc.invoiceArchive.getById.useQuery(
    { id: sourceInvoiceId! },
    { enabled: !!sourceInvoiceId, staleTime: 0 }
  );
  const { data: archiveLines = [], isFetched: archiveLinesFetched } =
    trpc.invoiceArchive.getLines.useQuery(
      { id: sourceInvoiceId!, excludeNirId: isEdit ? nirId : undefined },
      { enabled: !!sourceInvoiceId, staleTime: 0 }
    );
  const { data: articles = [] } = trpc.saga.articles.list.useQuery();

  const utils = trpc.useContext();

  const createNir = trpc.nir.createFromInvoice.useMutation({
    onSuccess: data => {
      toast.success(`NIR ${data.nirNumber} creat cu succes!`);
      utils.nir.list.invalidate();
      window.history.back();
    },
    onError: e => toast.error("Eroare: " + e.message),
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

  // Reset when invoice changes
  useEffect(() => {
    if (!isEdit) {
      setLoaded(false);
      setLines([]);
      setSupplierName("");
      setSupplierCUI("");
      setSupplierAddress("");
      setInvoiceNumber("");
      setAvizNumber("");
    }
  }, [sourceInvoiceId, isEdit]);

  // Init from next number
  useEffect(() => {
    if (!isEdit && nextNumber && !loaded) setNirNumber(nextNumber.nextNumber);
  }, [nextNumber, isEdit, loaded]);

  // Init from existing NIR
  useEffect(() => {
    if (isEdit && existingNir && !loaded) {
      setNirNumber(existingNir.nirNumber);
      setReceiptDate(existingNir.receiptDate);
      setAvizNumber(existingNir.avizNumber || "");
      setGestiune(existingNir.gestiune || "");
      setAccountingType(existingNir.accountingType || "Marfuri");
      setAccountingAccount(existingNir.accountingAccount || "371");
      setGeneralUnit("buc"); // default when loaded, as line units might differ
      setGeneralVat("19");
      setSupplierName(existingNir.supplierName || "");
      setSupplierCUI(existingNir.supplierCUI || "");
      setSupplierAddress(existingNir.supplierAddress || "");
      setInvoiceNumber(existingNir.invoiceNumber || "");
      setMember1Name(existingNir.member1Name || "");
      setMember1Function(existingNir.member1Function || "Gestionar");
      setMember2Name(existingNir.member2Name || "");
      setMember2Function(existingNir.member2Function || "Contabil");
      setMember3Name(existingNir.member3Name || "");
      setMember3Function(existingNir.member3Function || "Sef depozit");
      setDifferenceNotes(existingNir.differenceNotes || "");
      setNotes(existingNir.notes || "");
      setStatus((existingNir.status as any) || "draft");
      setLines(
        (existingNir.lines || []).map((l: any) => ({
          id: l.id,
          description: l.description,
          unit: l.unit || "buc",
          cantitateComanda: String(l.cantitateComanda || "0"),
          cantitateReceptionata: String(l.cantitateReceptionata || "0"),
          unitPrice: String(l.unitPrice || "0"),
          vatRate: (l.vatRate !== undefined && l.vatRate !== null && l.vatRate !== "") ? String(l.vatRate) : "19",
          total: String(l.total || ""),
          observations: l.observations || "",
          accountingType: l.accountingType || "Marfuri",
          accountingAccount: l.accountingAccount || "371",
        }))
      );
      setLoaded(true);
    }
  }, [existingNir, isEdit, loaded]);

  // Init from source invoice (wait for both queries)
  useEffect(() => {
    if (!isEdit && sourceInvoice && !loaded && archiveLinesFetched) {
      setSupplierName(sourceInvoice.supplierName || "");
      setSupplierCUI(sourceInvoice.supplierCUI || "");
      setInvoiceNumber(sourceInvoice.invoiceNumber || "");
      const archLns = archiveLines as any[];
      if (archLns.length > 0) {
        const newLines = archLns
          .map((l: any) => {
            const qty = parseFloat(String(l.quantity || "1"));
            const received = parseFloat(String(l.receivedQuantity || "0"));
            const remaining = Math.max(0, qty - received);
            const unitPrice = parseFloat(String(l.unitPrice || "0"));
            return {
              description: l.description || "",
              unit: l.unit || "buc",
              cantitateComanda: String(remaining),
              cantitateReceptionata: String(remaining),
              unitPrice: String(unitPrice),
              vatRate: (l.vatRate !== undefined && l.vatRate !== null && l.vatRate !== "") ? String(l.vatRate) : "19",
              total: String((remaining * unitPrice).toFixed(2)),
              observations: "",
              accountingType: "Marfuri",
              accountingAccount: "371",
            };
          })
          .filter((l: any) => parseFloat(l.cantitateReceptionata) > 0);

        if (newLines.length > 0) {
          setLines(newLines);
        } else {
          toast.info("Toate produsele din această factură au fost deja recepționate!");
          setLines([]);
        }
      } else {
        setLines([
          {
            description: `Marfă conform factură ${sourceInvoice.invoiceNumber || ""}`,
            unit: "buc",
            cantitateComanda: "1",
            cantitateReceptionata: "1",
            unitPrice: String(sourceInvoice.total || "0"),
            vatRate: "19",
            total: String(sourceInvoice.total || "0"),
            observations: "",
            accountingType: "Marfuri",
            accountingAccount: "371",
          },
        ]);
      }
      setLoaded(true);
    }
  }, [sourceInvoice, archiveLines, archiveLinesFetched, isEdit, loaded]);

  const addLine = () =>
    setLines(prev => [
      ...prev,
      {
        description: "",
        unit: "buc",
        cantitateComanda: "1",
        cantitateReceptionata: "1",
        unitPrice: "0",
        vatRate: "19",
        total: "0",
        observations: "",
        accountingType: "Marfuri",
        accountingAccount: "371",
      },
    ]);

  const removeLine = (idx: number) =>
    setLines(prev => prev.filter((_, i) => i !== idx));

  const updateLine = (idx: number, field: keyof NirLineForm, value: string) => {
    setLines(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      if (field === "cantitateReceptionata" || field === "unitPrice") {
        const qty = parseFloat(updated[idx].cantitateReceptionata) || 0;
        const price = parseFloat(updated[idx].unitPrice) || 0;
        updated[idx].total = (qty * price).toFixed(2);
      }
      // Când schimbi Tipul pe rând, actualizează automat Contul pe același rând
      if (field === "accountingType") {
        updated[idx].accountingAccount = TIP_TO_CONT[value] || "371";
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
    receiptDate,
    member1Name: member1Name || undefined,
    member1Function: member1Function || undefined,
    member2Name: member2Name || undefined,
    member2Function: member2Function || undefined,
    member3Name: member3Name || undefined,
    member3Function: member3Function || undefined,
    hasDifferences: hasDifferences ? 1 : 0,
    differenceNotes: differenceNotes || undefined,
    notes: notes || undefined,
    lines: lines.map((l, idx) => ({
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
    })),
  });

  const handleSave = () => {
    if (!nirNumber || !receiptDate) {
      toast.error("Nr. NIR și data recepției sunt obligatorii!");
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
    (s, l) => s + ((parseFloat(l.total) || 0) * (parseFloat(l.vatRate) || 19) / 100),
    0
  );
  const totalCuTva = totalFaraTva + totalTva;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-full">
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
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-teal-600" />
              {isEdit ? nirNumber : "NIR Nou"}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Notă de Intrare-Recepție — OMFP 2634/2015
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isEdit && (
            <a
              href={`/api/pdf/nir/${nirId}?download=1&showAccounting=${showAccounting}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Descarcă PDF NIR"
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 transition-colors"
            >
              <FileDown className="w-3.5 h-3.5" />
              PDF NIR
            </a>
          )}
          {status !== "finalizat" && isEdit && (
            <button
              onClick={() => finalizeNir.mutate({ id: nirId! })}
              disabled={finalizeNir.isPending}
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200 transition-colors"
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
            className="flex items-center gap-1.5 px-4 h-8 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors shadow-sm disabled:opacity-60"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className={LABEL_CLS}>Nr. NIR *</label>
            <input
              type="number"
              value={nirNumber}
              onChange={e => setNirNumber(e.target.value)}
              className={INPUT_CLS}
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
          <div className="md:col-span-1 flex items-center gap-2">
            <label className="text-[10px] font-bold uppercase text-slate-400 whitespace-nowrap">Afișare Conturi</label>
            <button
              type="button"
              onClick={() => setShowAccounting(v => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showAccounting ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-600'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${showAccounting ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          {showAccounting && (
            <>
              <div className="md:col-span-1">
                <label className={LABEL_CLS}>Tip (General)</label>
                <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                  <select
                    value={accountingType}
                    onChange={e => {
                      const tip = e.target.value;
                      const cont = TIP_TO_CONT[tip] || "371";
                      setAccountingType(tip);
                      setAccountingAccount(cont);
                      setLines(prev => prev.map(l => ({ ...l, accountingType: tip, accountingAccount: cont })));
                    }}
                    style={SELECT_STYLE}
                    className="w-full h-8 px-2.5 pr-7 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none border-none"
                  >
                    <option value="Marfuri">Mărfuri</option>
                    <option value="Materii prime">Materii prime</option>
                    <option value="Consumabile">Consumabile</option>
                    <option value="Nedefinit">Nedefinit</option>
                    <option value="Servicii">Servicii</option>
                  </select>
                </div>
              </div>
              <div className="md:col-span-1">
                <label className={LABEL_CLS}>Cont (General)</label>
                <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                  <select
                    value={accountingAccount}
                    onChange={e => {
                      const cont = e.target.value;
                      setAccountingAccount(cont);
                      setLines(prev => prev.map(l => ({ ...l, accountingAccount: cont })));
                    }}
                    style={SELECT_STYLE}
                    className="w-full h-8 px-2.5 pr-7 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none border-none"
                  >
                    <option value="371">371 - Mărfuri</option>
                    <option value="301">301 - Materii prime</option>
                    <option value="3028">3028 - Alte mat. consumabile</option>
                    <option value="3021">3021 - Mat. auxiliare</option>
                    <option value="3024">3024 - Piese de schimb</option>
                    <option value="704">704 - Servicii prestate</option>
                  </select>
                </div>
              </div>
            </>
          )}
          <div className="md:col-span-1">
            <label className={LABEL_CLS}>U/M (General)</label>
            <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
              <select
                value={generalUnit}
                onChange={e => {
                  const u = e.target.value;
                  setGeneralUnit(u);
                  setLines(prev => prev.map(l => ({ ...l, unit: u })));
                }}
                style={SELECT_STYLE}
                className="w-full h-8 px-2.5 pr-7 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none border-none"
              >
                <option value="buc">buc</option>
                <option value="kg">kg</option>
                <option value="l">l</option>
                <option value="m">m</option>
                <option value="mp">mp</option>
                <option value="set">set</option>
                <option value="cutie">cutie</option>
                <option value="rolă">rolă</option>
                <option value="oră">oră</option>
                <option value="pachet">pachet</option>
                <option value="EA">EA</option>
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
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            III. Produse / Servicii recepționate
          </p>
          <button
            onClick={addLine}
            className="flex items-center gap-1 px-3 h-7 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-bold border border-teal-200 transition-colors"
          >
            <Plus className="w-3 h-3" /> Adaugă linie
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[950px] table-fixed">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-slate-400 w-[30px]">Nr.</th>
                <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-slate-400">Denumire produs/serviciu</th>
                <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-slate-400 w-[140px]">Articol (Stoc)</th>
                {showAccounting && <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-slate-400 w-[110px]">Tip</th>}
                {showAccounting && <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-slate-400 w-[80px]">Cont</th>}
                <th className="px-2 py-2 text-center text-[10px] font-bold uppercase text-slate-400 w-[70px]">U/M</th>
                <th className="px-2 py-2 text-center text-[10px] font-bold uppercase text-slate-400 w-[70px]">Cant. doc.</th>
                <th className="px-2 py-2 text-center text-[10px] font-bold uppercase text-slate-400 w-[70px] bg-teal-50 dark:bg-teal-900/20">Cant. recept.</th>
                <th className="px-2 py-2 text-right text-[10px] font-bold uppercase text-slate-400 w-[80px]">Preț unit.</th>
                <th className="px-2 py-2 text-center text-[10px] font-bold uppercase text-slate-400 w-[70px]">TVA %</th>
                <th className="px-2 py-2 text-right text-[10px] font-bold uppercase text-slate-400 w-[90px]">Valoare</th>
                <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-slate-400 w-[80px]">Obs.</th>
                <th className="px-1 py-2 w-[36px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={showAccounting ? 13 : 11} className="py-6 text-center text-xs text-slate-400">
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
                      <td className="px-2 py-1.5 text-slate-400">{idx + 1}</td>
                      <td className="px-2 py-1.5">
                        <input
                          value={line.description}
                          onChange={e => updateLine(idx, "description", e.target.value)}
                          className="w-full h-7 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                          <select
                            value={line.sagaArticleId || ""}
                            onChange={e => {
                              const val = e.target.value;
                              if (val) {
                                const found = articles.find((a: any) => String(a.id) === val);
                                if (found) {
                                  setLines(curr => {
                                    const newLines = [...curr];
                                    newLines[idx] = {
                                      ...newLines[idx],
                                      sagaArticleId: found.id,
                                      unit: found.unit || "buc",
                                      accountingAccount: found.accountingAccount || "371",
                                      accountingType: found.category || "Marfuri"
                                    };
                                    return newLines;
                                  });
                                }
                              } else {
                                updateLine(idx, "sagaArticleId", "");
                              }
                            }}
                            style={SELECT_SM_STYLE}
                            className="w-full h-7 px-2 pr-6 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none border-none"
                          >
                            <option value="">-- Neselectat --</option>
                            {articles.map((a: any) => (
                              <option key={a.id} value={a.id}>{a.code ? `${a.code} - ` : ""}{a.name}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                      {showAccounting && (
                        <td className="px-1 py-1.5">
                          <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                            <select
                              value={line.accountingType || "Marfuri"}
                              onChange={e => updateLine(idx, "accountingType", e.target.value)}
                              style={SELECT_SM_STYLE}
                              className="w-full h-7 px-2 pr-6 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none border-none"
                            >
                              <option value="Marfuri">Mărfuri</option>
                              <option value="Materii prime">Materii prime</option>
                              <option value="Consumabile">Consumabile</option>
                              <option value="Nedefinit">Nedefinit</option>
                              <option value="Servicii">Servicii</option>
                            </select>
                          </div>
                        </td>
                      )}
                      {showAccounting && (
                        <td className="px-1 py-1.5">
                          <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                            <select
                              value={line.accountingAccount || "371"}
                              onChange={e => updateLine(idx, "accountingAccount", e.target.value)}
                              style={SELECT_SM_STYLE}
                              className="w-full h-7 px-2 pr-6 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none border-none"
                            >
                              <option value="371">371</option>
                              <option value="301">301</option>
                              <option value="3028">3028</option>
                              <option value="3021">3021</option>
                              <option value="3024">3024</option>
                              <option value="704">704</option>
                            </select>
                          </div>
                        </td>
                      )}
                      <td className="px-1 py-1.5">
                        <input
                          value={line.unit}
                          onChange={e => updateLine(idx, "unit", e.target.value)}
                          className="w-full h-7 px-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <input
                          type="number"
                          value={line.cantitateComanda}
                          onChange={e => updateLine(idx, "cantitateComanda", e.target.value)}
                          className="w-full h-7 px-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 text-slate-600 focus:outline-none text-xs text-center"
                        />
                      </td>
                      <td className="px-1 py-1.5 bg-teal-50/30 dark:bg-teal-900/10">
                        <input
                          type="number"
                          value={line.cantitateReceptionata}
                          onChange={e => updateLine(idx, "cantitateReceptionata", e.target.value)}
                          className={`w-full h-7 px-1 rounded-lg border focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs text-center font-bold ${diff ? "border-amber-300 text-amber-700 bg-amber-50" : "border-teal-200 text-teal-700 bg-white dark:bg-slate-800"}`}
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <input
                          type="number"
                          value={line.unitPrice}
                          onChange={e => updateLine(idx, "unitPrice", e.target.value)}
                          className="w-full h-7 px-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs text-right"
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <input
                          type="number"
                          value={line.vatRate || "19"}
                          onChange={e => updateLine(idx, "vatRate", e.target.value)}
                          className="w-full h-7 px-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 text-slate-600 focus:outline-none text-xs text-center"
                        />
                      </td>
                      <td className="px-1 py-1.5 text-right font-bold text-slate-700 dark:text-slate-300">
                        {parseFloat(line.total || "0").toLocaleString("ro-RO", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-1 py-1.5">
                        <input
                          value={line.observations}
                          onChange={e => updateLine(idx, "observations", e.target.value)}
                          placeholder="obs..."
                          className="w-full h-7 px-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
                        />
                      </td>
                      <td className="px-1 py-1.5">
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
                <td colSpan={showAccounting ? 9 : 7} className="px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 text-right">
                  TOTAL FĂRĂ TVA:
                </td>
                <td className="px-1 py-2 text-right text-sm font-bold text-slate-700 dark:text-slate-300">
                  {totalFaraTva.toLocaleString("ro-RO", { minimumFractionDigits: 2 })}
                </td>
                <td colSpan={2}></td>
              </tr>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700/50">
                <td colSpan={showAccounting ? 9 : 7} className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 text-right">
                  TOTAL TVA:
                </td>
                <td className="px-1 py-1.5 text-right text-sm font-bold text-slate-700 dark:text-slate-300">
                  {totalTva.toLocaleString("ro-RO", { minimumFractionDigits: 2 })}
                </td>
                <td colSpan={2}></td>
              </tr>
              <tr className="bg-teal-50/50 dark:bg-teal-900/10 border-t border-teal-100 dark:border-teal-800/50">
                <td colSpan={showAccounting ? 9 : 7} className="px-3 py-2 text-xs font-black text-teal-700 dark:text-teal-400 text-right">
                  TOTAL CU TVA:
                </td>
                <td className="px-1 py-2 text-right text-[15px] font-black text-teal-700 dark:text-teal-400">
                  {totalCuTva.toLocaleString("ro-RO", { minimumFractionDigits: 2 })}
                </td>
                <td colSpan={2}></td>
              </tr>
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
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
          {hasDifferences ? "V." : "IV."} Comisia de recepție
        </p>
        <p className="text-xs text-slate-400 mb-3">
          Completați numele și funcția membrilor comisiei de recepție.
        </p>
        
        <datalist id="saga-articles-list">
          {articles.map((a: any) => (
            <option key={a.id} value={a.name}>{a.code} - {a.name}</option>
          ))}
        </datalist>

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
              className="flex items-center gap-1.5 px-4 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors"
            >
              <CheckCircle className="w-4 h-4" /> Finalizează NIR
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={createNir.isPending || updateNir.isPending}
            className="flex items-center gap-1.5 px-5 h-9 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold transition-colors shadow-sm disabled:opacity-60"
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
    </div>
  );
}
