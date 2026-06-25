// NIRCreate — Creare / Editare NIR (Nota de Intrare-Recepție)
// Pre-populat din factura sursă dacă vine cu invoiceId

import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { ArrowLeft, ClipboardCheck, Plus, Trash2, Loader2, CheckCircle, Save, FileDown } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatDate } from "@/lib/store";

interface NirLineForm {
  id?: number;
  description: string;
  unit: string;
  cantitateComanda: string;
  cantitateReceptionata: string;
  unitPrice: string;
  vatRate: string;
  total: string;
  observations: string;
}

export default function NIRCreate() {
  const { id, invoiceId } = useParams<{ id?: string; invoiceId?: string }>();
  const nirId = id ? parseInt(id) : null;
  const sourceInvoiceId = invoiceId ? parseInt(invoiceId) : null;
  const isEdit = !!nirId;

  const [nirNumber, setNirNumber] = useState("");
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split("T")[0]);
  const [supplierName, setSupplierName] = useState("");
  const [supplierCUI, setSupplierCUI] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<NirLineForm[]>([]);
  const [status, setStatus] = useState<"draft" | "finalizat">("draft");
  const [loaded, setLoaded] = useState(false);

  // Load next NIR number
  const { data: nextNumber } = trpc.nir.getNextNumber.useQuery(undefined, { enabled: !isEdit });

  // Load existing NIR for edit
  const { data: existingNir } = trpc.nir.getById.useQuery(
    { id: nirId! },
    { enabled: isEdit }
  );

  // Load source invoice
  const { data: sourceInvoice } = trpc.invoiceArchive.getById.useQuery(
    { id: sourceInvoiceId! },
    { enabled: !!sourceInvoiceId }
  );

  // Load archive lines for source invoice
  const { data: archiveLines = [] } = trpc.invoiceArchive.getLines.useQuery(
    { id: sourceInvoiceId! },
    { enabled: !!sourceInvoiceId }
  );

  const utils = trpc.useContext();

  const createNir = trpc.nir.createFromInvoice.useMutation({
    onSuccess: (data) => {
      toast.success(`NIR ${data.nirNumber} creat cu succes!`);
      utils.nir.list.invalidate();
      window.history.back();
    },
    onError: (e) => toast.error("Eroare: " + e.message),
  });

  const updateNir = trpc.nir.update.useMutation({
    onSuccess: () => {
      toast.success("NIR salvat!");
      utils.nir.list.invalidate();
      utils.nir.getById.invalidate({ id: nirId! });
    },
    onError: (e) => toast.error("Eroare: " + e.message),
  });

  const finalizeNir = trpc.nir.finalize.useMutation({
    onSuccess: () => {
      toast.success("NIR finalizat!");
      setStatus("finalizat");
      utils.nir.list.invalidate();
      utils.nir.getById.invalidate({ id: nirId! });
    },
    onError: (e) => toast.error("Eroare: " + e.message),
  });

  // Init from next number
  useEffect(() => {
    if (!isEdit && nextNumber && !loaded) {
      setNirNumber(nextNumber);
    }
  }, [nextNumber, isEdit, loaded]);

  // Init from existing NIR
  useEffect(() => {
    if (isEdit && existingNir && !loaded) {
      setNirNumber(existingNir.nirNumber);
      setReceiptDate(existingNir.receiptDate);
      setSupplierName(existingNir.supplierName || "");
      setSupplierCUI(existingNir.supplierCUI || "");
      setInvoiceNumber(existingNir.invoiceNumber || "");
      setNotes(existingNir.notes || "");
      setStatus(existingNir.status as any || "draft");
      setLines((existingNir.lines || []).map((l: any) => ({
        id: l.id,
        description: l.description,
        unit: l.unit || "buc",
        cantitateComanda: String(l.cantitateComanda || "0"),
        cantitateReceptionata: String(l.cantitateReceptionata || "0"),
        unitPrice: String(l.unitPrice || "0"),
        vatRate: String(l.vatRate || "19"),
        total: String(l.total || "0"),
        observations: l.observations || "",
      })));
      setLoaded(true);
    }
  }, [existingNir, isEdit, loaded]);

  // Init from source invoice
  useEffect(() => {
    if (!isEdit && sourceInvoice && !loaded) {
      setSupplierName(sourceInvoice.supplierName || "");
      setSupplierCUI(sourceInvoice.supplierCUI || "");
      setInvoiceNumber(sourceInvoice.invoiceNumber || "");
      // Build lines from invoice archive lines or one default line
      const archLns = (archiveLines as any[]);
      if (archLns.length > 0) {
        setLines(archLns.map((l: any, idx: number) => ({
          description: l.description || "",
          unit: l.unit || "buc",
          cantitateComanda: String(l.quantity || "1"),
          cantitateReceptionata: String(l.quantity || "1"),
          unitPrice: String(l.unitPrice || "0"),
          vatRate: String(l.vatRate || "19"),
          total: String(l.total || "0"),
          observations: "",
        })));
      } else {
        // Fallback: one generic line from invoice header
        setLines([{
          description: `Marfă conform factură ${sourceInvoice.invoiceNumber || ""}`,
          unit: "buc",
          cantitateComanda: "1",
          cantitateReceptionata: "1",
          unitPrice: String(sourceInvoice.total || "0"),
          vatRate: "19",
          total: String(sourceInvoice.total || "0"),
          observations: "",
        }]);
      }
      setLoaded(true);
    }
  }, [sourceInvoice, archiveLines, isEdit, loaded]);

  const addLine = () => setLines(prev => [...prev, {
    description: "", unit: "buc",
    cantitateComanda: "1", cantitateReceptionata: "1",
    unitPrice: "0", vatRate: "19", total: "0", observations: "",
  }]);

  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx));

  const updateLine = (idx: number, field: keyof NirLineForm, value: string) => {
    setLines(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      // Recalculate total
      if (field === "cantitateReceptionata" || field === "unitPrice") {
        const qty = parseFloat(updated[idx].cantitateReceptionata) || 0;
        const price = parseFloat(updated[idx].unitPrice) || 0;
        updated[idx].total = (qty * price).toFixed(2);
      }
      return updated;
    });
  };

  const handleSave = () => {
    if (!nirNumber || !receiptDate) {
      toast.error("Nr. NIR și data recepției sunt obligatorii!");
      return;
    }
    const payload = {
      nirNumber,
      invoiceArchiveId: sourceInvoiceId || undefined,
      invoiceNumber,
      supplierName,
      supplierCUI,
      receiptDate,
      notes,
      lines: lines.map((l, idx) => ({
        description: l.description || "—",
        unit: l.unit,
        cantitateComanda: l.cantitateComanda,
        cantitateReceptionata: l.cantitateReceptionata,
        unitPrice: l.unitPrice,
        vatRate: l.vatRate,
        total: l.total,
        observations: l.observations,
        lineOrder: idx,
      })),
    };
    if (isEdit) {
      updateNir.mutate({ id: nirId!, ...payload });
    } else {
      createNir.mutate(payload);
    }
  };

  const totalReceptionat = lines.reduce((s, l) => s + (parseFloat(l.total) || 0), 0);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
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
              {isEdit ? `NIR ${nirNumber}` : "NIR Nou"}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEdit ? (status === "finalizat" ? "Finalizat ✓" : "Draft — nesalvat") : "Notă de Intrare-Recepție"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {status !== "finalizat" && isEdit && (
            <button
              onClick={() => finalizeNir.mutate({ id: nirId! })}
              disabled={finalizeNir.isPending}
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200 transition-colors"
            >
              {finalizeNir.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              Finalizează NIR
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={createNir.isPending || updateNir.isPending}
            className="flex items-center gap-1.5 px-4 h-8 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors shadow-sm disabled:opacity-60"
          >
            {(createNir.isPending || updateNir.isPending) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {isEdit ? "Salvează" : "Creează NIR"}
          </button>
        </div>
      </div>

      {/* 3 Cards header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card NIR Info */}
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date NIR</p>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Nr. NIR *</label>
            <input value={nirNumber} onChange={e => setNirNumber(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Dată recepție *</label>
            <input type="date" value={receiptDate} onChange={e => setReceiptDate(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Card Furnizor */}
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Furnizor</p>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Nume furnizor</label>
            <input value={supplierName} onChange={e => setSupplierName(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">CUI Furnizor</label>
            <input value={supplierCUI} onChange={e => setSupplierCUI(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Card Factură sursă + Total */}
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Factură & Total</p>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Nr. Factură sursă</label>
            <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Total recepționat:</span>
              <span className="font-black text-teal-700 text-sm">
                {totalReceptionat.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON
              </span>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-slate-500">Linii produse:</span>
              <span className="font-semibold text-slate-900 dark:text-white">{lines.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Observații */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">Observații NIR</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          placeholder="Observații generale despre recepție..."
          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
        />
      </div>

      {/* Tabel linii produse */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Produse / Servicii recepționate
          </h2>
          <button onClick={addLine}
            className="flex items-center gap-1 px-3 h-7 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-bold border border-teal-200 transition-colors">
            <Plus className="w-3 h-3" /> Adaugă linie
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-slate-400 w-6">#</th>
                <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-slate-400 min-w-[200px]">Descriere produs/serviciu</th>
                <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-slate-400 w-16">UM</th>
                <th className="px-2 py-2 text-center text-[10px] font-bold uppercase text-slate-400 w-24">Cant. Comandată</th>
                <th className="px-2 py-2 text-center text-[10px] font-bold uppercase text-slate-400 w-24 bg-teal-50 dark:bg-teal-900/20">Cant. Recepționată</th>
                <th className="px-2 py-2 text-right text-[10px] font-bold uppercase text-slate-400 w-24">Preț unitar</th>
                <th className="px-2 py-2 text-right text-[10px] font-bold uppercase text-slate-400 w-24">Total (RON)</th>
                <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-slate-400 min-w-[120px]">Observații</th>
                <th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {lines.length === 0 ? (
                <tr><td colSpan={9} className="py-6 text-center text-xs text-slate-400">
                  Nicio linie. Apasă „Adaugă linie".
                </td></tr>
              ) : lines.map((line, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                  <td className="px-2 py-1.5 text-slate-400">{idx + 1}</td>
                  <td className="px-2 py-1.5">
                    <input value={line.description}
                      onChange={e => updateLine(idx, "description", e.target.value)}
                      className="w-full h-7 px-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input value={line.unit}
                      onChange={e => updateLine(idx, "unit", e.target.value)}
                      className="w-full h-7 px-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs text-center"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" value={line.cantitateComanda}
                      onChange={e => updateLine(idx, "cantitateComanda", e.target.value)}
                      className="w-full h-7 px-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 focus:outline-none text-xs text-center"
                    />
                  </td>
                  <td className="px-2 py-1.5 bg-teal-50/30 dark:bg-teal-900/10">
                    <input type="number" value={line.cantitateReceptionata}
                      onChange={e => updateLine(idx, "cantitateReceptionata", e.target.value)}
                      className="w-full h-7 px-2 rounded border border-teal-200 dark:border-teal-700 bg-white dark:bg-slate-800 text-teal-700 font-bold focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs text-center"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" value={line.unitPrice}
                      onChange={e => updateLine(idx, "unitPrice", e.target.value)}
                      className="w-full h-7 px-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs text-right"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right text-xs font-bold text-slate-700 dark:text-slate-300">
                    {parseFloat(line.total || "0").toLocaleString("ro-RO", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-2 py-1.5">
                    <input value={line.observations}
                      onChange={e => updateLine(idx, "observations", e.target.value)}
                      placeholder="obs..."
                      className="w-full h-7 px-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <button onClick={() => removeLine(idx)}
                      className="flex items-center justify-center w-6 h-6 rounded bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <td colSpan={6} className="px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 text-right">
                  TOTAL RECEPȚIONAT:
                </td>
                <td className="px-2 py-2 text-right text-sm font-black text-teal-700 dark:text-teal-400">
                  {totalReceptionat.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Footer save buttons */}
      <div className="flex justify-end gap-3 pb-4">
        <button onClick={() => window.history.back()}
          className="px-4 h-9 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
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
        <button onClick={handleSave}
          disabled={createNir.isPending || updateNir.isPending}
          className="flex items-center gap-1.5 px-5 h-9 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold transition-colors shadow-sm disabled:opacity-60"
        >
          {(createNir.isPending || updateNir.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isEdit ? "Salvează modificările" : "Creează NIR"}
        </button>
      </div>
    </div>
  );
}
