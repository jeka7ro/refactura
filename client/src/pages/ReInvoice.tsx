// ReInvoice — RefacturaRO
// Core re-invoicing workflow: edit lines, set markup/unit price, select client, generate

import { useState, useEffect } from "react";
import { Link, useParams, useLocation } from "wouter";
import { ArrowLeft, Plus, Trash2, Percent, TrendingUp, Users, Check, Info, Download } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  mockInvoices,
  formatCurrency,
  currencies,
  type Currency,
  type ReInvoiceLine,
} from "@/lib/store";

export default function ReInvoice() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const invoice = mockInvoices.find((i) => i.id === id);

  const [selectedClientId, setSelectedClientId] = useState("");
  const [currency, setCurrency] = useState<Currency>("RON");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [globalMarkup, setGlobalMarkup] = useState<number | string>(15);
  
  // Local interface to allow empty strings while typing
  interface EditableLine extends Omit<ReInvoiceLine, "quantity" | "unitPrice" | "markupPercent"> {
    quantity: number | string;
    unitPrice: number | string;
    markupPercent?: number | string;
  }
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  // Load real clients from DB
  const { data: clientsData } = trpc.clients.list.useQuery();
  const realClients = clientsData ?? [];

  // tRPC mutations
  const createReInvoice = trpc.reinvoice.create.useMutation();
  const downloadPDF = trpc.reinvoice.downloadPDF.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (invoice) {
      setCurrency(invoice.currency);
      const due = new Date();
      due.setDate(due.getDate() + 30);
      setDueDate(due.toISOString().split("T")[0]);
      setLines(
        invoice.lines.map((l) => ({
          ...l,
          originalUnitPrice: l.unitPrice,
          markupPercent: 15,
          unitPrice: +(l.unitPrice * 1.15).toFixed(2),
        }))
      );
    }
  }, [invoice?.id]);

  if (!invoice) {
    return (
      <div className="p-8 text-center">
        <div className="text-slate-500">Factura nu a fost găsită.</div>
        <Link href="/facturi-primite">
          <button className="mt-4 px-5 h-10 rounded-full bg-blue-600 text-white text-sm font-bold">← Înapoi</button>
        </Link>
      </div>
    );
  }

  const applyGlobalMarkupToAll = () => {
    const markupVal = Number(globalMarkup) || 0;
    setLines((prev) =>
      prev.map((l) => ({
        ...l,
        markupPercent: markupVal,
        unitPrice: +(l.originalUnitPrice * (1 + markupVal / 100)).toFixed(2),
      }))
    );
    toast.success(`Adaos de ${markupVal}% aplicat pe toate liniile`);
  };

  const updateLineMarkup = (lineId: string, markup: string | number) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id === lineId) {
          const m = Number(markup) || 0;
          return { ...l, markupPercent: markup, unitPrice: +(l.originalUnitPrice * (1 + m / 100)).toFixed(2) };
        }
        return l;
      })
    );
  };

  const updateLinePrice = (lineId: string, price: string | number) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id === lineId) {
          const p = Number(price) || 0;
          return {
            ...l,
            unitPrice: price,
            markupPercent: +((((p - l.originalUnitPrice) / l.originalUnitPrice) * 100)).toFixed(1),
          };
        }
        return l;
      })
    );
  };

  const updateLineQty = (lineId: string, qty: string | number) => {
    setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, quantity: qty } : l)));
  };

  const removeLine = (lineId: string) => {
    setLines((prev) => prev.filter((l) => l.id !== lineId));
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        description: "",
        quantity: 1,
        unitPrice: 0,
        originalUnitPrice: 0,
        unit: "buc",
        vatRate: 21,
        currency,
        markupPercent: 0,
      },
    ]);
  };

  const subtotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  const totalVAT = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0) * (l.vatRate / 100), 0);
  const total = subtotal + totalVAT;
  const originalTotal = invoice.total;
  const margin = subtotal - invoice.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  const handleSave = async (asDraft: boolean) => {
    if (!selectedClientId) {
      toast.error("Selectează un client", { description: "Este necesar un client pentru re-facturare" });
      return;
    }
    if (lines.length === 0) {
      toast.error("Nu există linii", { description: "Adaugă cel puțin o linie pentru re-factură" });
      return;
    }
    setSaving(true);
    try {
      const client = realClients.find((c) => String(c.id) === selectedClientId);
      if (!client) {
        toast.error("Clientul selectat nu a fost găsit");
        setSaving(false);
        return;
      }
      const today = new Date().toISOString().split("T")[0];
      const result = await createReInvoice.mutateAsync({
        sourceInvoiceId: invoice?.id,
        sourceInvoiceNumber: invoice?.number,
        sourceSupplierName: invoice?.supplierName,
        clientId: client.id,
        clientName: client.name,
        clientCUI: client.cui ?? undefined,
        clientAddress: client.address ?? undefined,
        clientCity: client.city ?? undefined,
        clientEmail: client.email ?? undefined,
        clientPhone: client.phone ?? undefined,
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
          originalUnitPrice: l.originalUnitPrice,
          unitPrice: Number(l.unitPrice) || 0,
          unit: l.unit,
          vatRate: l.vatRate,
          markupPercent: Number(l.markupPercent) || 0,
          total: (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0) * (1 + (l.vatRate ?? 21) / 100),
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
      toast.error("Eroare la salvare", { description: err?.message ?? "A apărut o eroare neașteptată" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href={`/facturi-primite/${invoice.id}`}>
            <button className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <ArrowLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Re-Facturare</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Bazat pe: <span className="">{invoice.number}</span> — {invoice.supplierName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              if (!selectedClientId) {
                toast.error("Selectează un client", { description: "Este necesar un client pentru descărcare PDF" });
                return;
              }
              setDownloadingPDF(true);
              try {
                const client = realClients.find((c) => String(c.id) === selectedClientId);
                if (!client) return;
                
                const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
                const totalVAT = lines.reduce((s, l) => s + l.quantity * l.unitPrice * (l.vatRate / 100), 0);
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
                  companyName: "ConstructMaster SRL",
                  companyCUI: "RO12345678",
                  companyAddress: "Str. Constructorilor nr. 25, Sector 3",
                  companyCity: "București",
                  companyCounty: "Ilfov",
                  companyEmail: "office@constructmaster.ro",
                  companyPhone: "+40 21 987 6543",
                  companyIBAN: "RO49AAAA1B31007593840000",
                  companyBank: "BRD",
                  lines: lines.map((l) => ({
                    description: l.description,
                    quantity: l.quantity,
                    unitPrice: l.unitPrice,
                    unit: l.unit,
                    vatRate: l.vatRate,
                    total: l.quantity * l.unitPrice * (1 + l.vatRate / 100),
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
            className="flex items-center gap-2 px-5 h-10 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold transition-colors disabled:opacity-60"
          >
            {downloadingPDF ? <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
            Descarcă PDF
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="px-5 h-10 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold transition-colors disabled:opacity-60"
          >
            Salvează ciornă
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex items-center gap-2 px-5 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all active:scale-[0.97] disabled:opacity-60"
          >
            {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
            Generează Re-Factură
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Lines editor */}
        <div className="xl:col-span-2 space-y-4">
          {/* Global markup */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-bold text-blue-900 dark:text-blue-200">Adaos global:</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={globalMarkup}
                  onChange={(e) => setGlobalMarkup(e.target.value)}
                  className="w-20 h-9 px-3 text-sm rounded-full border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-center"
                  min={0}
                  max={500}
                />
                <span className="text-sm text-blue-700 dark:text-blue-300 font-semibold">%</span>
              </div>
              <button
                onClick={applyGlobalMarkupToAll}
                className="px-4 h-9 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all active:scale-[0.97]"
              >
                Aplică pe toate liniile
              </button>
              <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 ml-auto">
                <Info className="w-3.5 h-3.5" />
                Poți edita și individual fiecare linie
              </div>
            </div>
          </div>

          {/* Lines table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Linii Re-Factură</h2>
              <button
                onClick={addLine}
                className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Adaugă linie
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="text-left px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Descriere</th>
                    <th className="text-right px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Cant.</th>
                    <th className="text-right px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Preț Orig.</th>
                    <th className="text-right px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Adaos %</th>
                    <th className="text-right px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Preț Nou</th>
                    <th className="text-right px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Total</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {lines.map((line, idx) => (
                    <tr key={line.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-3">
                        <input
                          value={line.description}
                          onChange={(e) => setLines((prev) => prev.map((l) => l.id === line.id ? { ...l, description: e.target.value } : l))}
                          className="w-full text-sm text-slate-900 dark:text-white bg-transparent border-b border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-blue-500 outline-none py-0.5 transition-colors"
                          placeholder="Descriere produs/serviciu"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          value={line.quantity}
                          onChange={(e) => updateLineQty(line.id, e.target.value)}
                          className="w-16 text-sm text-right text-slate-900 dark:text-white bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
                          min={0}
                        />
                      </td>
                      <td className="px-3 py-3 text-right text-xs text-slate-400">
                        {formatCurrency(line.originalUnitPrice, line.currency)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            value={line.markupPercent ?? 0}
                            onChange={(e) => updateLineMarkup(line.id, e.target.value)}
                            className="w-16 text-sm text-right text-slate-900 dark:text-white bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
                            min={-100}
                            max={1000}
                          />
                          <span className="text-xs text-slate-400">%</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          value={line.unitPrice}
                          onChange={(e) => updateLinePrice(line.id, e.target.value)}
                          className="w-24 text-sm text-right text-blue-600 bg-transparent border border-blue-200 dark:border-blue-800 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
                          min={0}
                          step={0.01}
                        />
                      </td>
                      <td className="px-3 py-3 text-right text-sm text-slate-900 dark:text-white">
                        {formatCurrency((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0), line.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => removeLine(line.id)}
                          className="w-7 h-7 rounded-full hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-colors text-slate-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Config panel */}
        <div className="space-y-4">
          {/* Client selector */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Client Final</span>
            </div>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full h-10 px-4 text-sm rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            >
              <option value="">Selectează client...</option>
              {realClients.map((c) => (
                <option key={c.id} value={String(c.id)}>{c.name}{c.cui ? ` — ${c.cui}` : ""}</option>
              ))}
            </select>
            {selectedClientId && (() => {
              const client = realClients.find((c) => String(c.id) === selectedClientId);
              return client ? (
                <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs space-y-1">
                  <div className="text-slate-500">{client.address}, {client.city}</div>
                  <div className="text-slate-500">{client.email}</div>

                </div>
              ) : null;
            })()}
            <Link href="/clienti">
              <button className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-blue-600 font-semibold hover:underline">
                <Plus className="w-3.5 h-3.5" />
                Client nou
              </button>
            </Link>
          </div>

          {/* Invoice settings */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Setări Re-Factură</span>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Monedă</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="w-full h-10 px-4 text-sm rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Scadență</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full h-10 px-4 text-sm rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Observații</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Mențiuni, condiții de plată..."
                className="w-full px-4 py-3 text-sm rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-4">Sumar</span>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Cost original (fără TVA):</span>
                <span>{formatCurrency(invoice.lines.reduce((s,l)=>s+l.quantity*l.unitPrice,0), invoice.currency)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Subtotal re-factură:</span>
                <span>{formatCurrency(subtotal, currency)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>TVA ({lines[0]?.vatRate ?? 21}%):</span>
                <span>{formatCurrency(totalVAT, currency)}</span>
              </div>
              <div className="flex justify-between text-slate-900 dark:text-white border-t border-slate-100 dark:border-slate-800 pt-2 mt-2">
                <span>Total cu TVA:</span>
                <span className="text-blue-600">{formatCurrency(total, currency)}</span>
              </div>
            </div>
            {/* Margin highlight */}
            <div className={`mt-4 p-3 rounded-xl flex items-center justify-between ${
              margin >= 0 ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800" : "bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800"
            }`}>
              <div className="flex items-center gap-2">
                <TrendingUp className={`w-4 h-4 ${margin >= 0 ? "text-emerald-600" : "text-rose-600"}`} />
                <span className={`text-xs font-bold ${margin >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>Adaos comercial</span>
              </div>
              <div className="text-right">
                <div className={`text-sm ${margin >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
                  {margin >= 0 ? "+" : ""}{formatCurrency(margin, currency)}
                </div>
                <div className={`text-[11px] ${margin >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {invoice.lines.reduce((s,l)=>s+l.quantity*l.unitPrice,0) > 0
                    ? `${((margin / invoice.lines.reduce((s,l)=>s+l.quantity*l.unitPrice,0)) * 100).toFixed(1)}% marjă`
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
