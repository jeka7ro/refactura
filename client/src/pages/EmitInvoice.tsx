// EmitInvoice.tsx — Creare Factură Nouă — Layout inspirat din Oblio
import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft, Plus, Trash2, Save, Send, Loader2, ChevronDown, ChevronUp
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { formatCurrency, currencies, type Currency } from "@/lib/store";

const VAT_RATES = [0, 5, 9, 19];
const UNITS = ["buc", "ore", "luni", "kg", "m", "m2", "m3", "l", "set", "servicii", "kg", "t"];

interface Line {
  id: string;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  unit: string;
  vatRate: number;
}

const defaultLine = (): Line => ({
  id: crypto.randomUUID(),
  description: "",
  quantity: 1,
  unitPrice: 0,
  unit: "buc",
  vatRate: 19,
});

function computeLineTotal(line: Line) {
  const qty = parseFloat(String(line.quantity)) || 0;
  const price = parseFloat(String(line.unitPrice)) || 0;
  return Math.round(qty * price * 100) / 100;
}
function computeLineVAT(line: Line) {
  return Math.round(computeLineTotal(line) * (parseFloat(String(line.vatRate)) / 100) * 100) / 10const inputCls = "w-full h-9 px-3 text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 !rounded-md text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500";
const selectCls = "w-full h-9 px-3 text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 !rounded-md text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500";
const labelCls = "block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1";

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
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0];
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

  // Data
  const { data: clientsData } = trpc.clients.list.useQuery();
  const { data: nextNumber } = trpc.emittedInvoice.nextNumber.useQuery({ series });
  const { data: tenantsData = [] } = trpc.tenants.list.useQuery();
  const tenant = tenantsData[0];

  const createMutation = trpc.emittedInvoice.create.useMutation({
    onSuccess: (data) => {
      utils.emittedInvoice.list.invalidate();
      toast.success("Factura a fost creată cu succes!");
      navigate("/facturi-emise-nou");
    },
    onError: (err) => toast.error("Eroare: " + err.message),
  });

  const clients = clientsData || [];
  const filteredClients = useMemo(() =>
    clients.filter(c =>
      c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      (c.cui || "").includes(clientSearch)
    ), [clients, clientSearch]);

  useEffect(() => {
    if (nextNumber && !invoiceNumber) setInvoiceNumber(nextNumber);
  }, [nextNumber]);

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

  const addLine = () => setLines(prev => [...prev, defaultLine()]);
  const removeLine = (id: string) => setLines(prev => prev.filter(l => l.id !== id));
  const updateLine = useCallback((id: string, field: keyof Line, value: any) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  }, []);

  const subtotal = useMemo(() => lines.reduce((s, l) => s + computeLineTotal(l), 0), [lines]);
  const totalVAT = useMemo(() => lines.reduce((s, l) => s + computeLineVAT(l), 0), [lines]);
  const total = subtotal + totalVAT;

  // Group VAT by rate
  const vatBreakdown = useMemo(() => {
    const map: Record<number, { base: number; vat: number }> = {};
    lines.forEach(l => {
      const r = parseFloat(String(l.vatRate));
      if (!map[r]) map[r] = { base: 0, vat: 0 };
      map[r].base += computeLineTotal(l);
      map[r].vat += computeLineVAT(l);
    });
    return Object.entries(map).map(([rate, v]) => ({ rate: parseFloat(rate), ...v }));
  }, [lines]);

  const notesForSave = [
    mentiuni,
    numarComanda ? `Comanda: ${numarComanda}` : "",
    numarContract ? `Contract: ${numarContract}` : "",
    intocmitDe ? `Întocmit de: ${intocmitDe}` : "",
    delegat ? `Delegat: ${delegat} ${carteIdentitate ? `(CI: ${carteIdentitate})` : ""}` : "",
    numarAviz ? `Aviz însoțire: ${numarAviz}` : "",
    auto ? `Auto: ${auto}` : "",
    agentVanzari ? `Agent vânzări: ${agentVanzari}` : "",
    punctLucru ? `Punct de lucru: ${punctLucru}` : "",
  ].filter(Boolean).join("\n");

  const handleSave = async (status: "draft" | "sent" = "draft") => {
    if (!clientName.trim()) { toast.error("Selectați sau introduceți un client"); return; }
    if (lines.some(l => !l.description.trim())) { toast.error("Toate liniile trebuie să aibă descriere"); return; }
    setSaving(true);
    try {
      await createMutation.mutateAsync({
        number: invoiceNumber, series,
        clientId: selectedClientId ? parseInt(selectedClientId) : undefined,
        clientName, clientCUI, clientRegCom, clientAddress, clientCity, clientEmail, clientPhone,
        issueDate, dueDate, subtotal, totalVAT, total, currency, status,
        notes: notesForSave,
        lines: lines.map((l, i) => ({
          description: l.description,
          quantity: parseFloat(String(l.quantity)) || 1,
          unitPrice: parseFloat(String(l.unitPrice)) || 0,
          unit: l.unit, vatRate: l.vatRate,
          total: computeLineTotal(l), lineOrder: i,
        })),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
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
              <p className="text-xs text-slate-500">{tenant.name}{tenant.cui ? ` • CUI: ${tenant.cui}` : ""}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSave("draft")}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 h-9 !rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvează Ciornă
          </button>
          <button
            onClick={() => handleSave("sent")}
            disabled={saving}
            className="flex items-center gap-1.5 px-8 h-9 !rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Emite Factura
          </button>
        </div>
      </div>

      {/* ── ROW 1: Client + Date + Serie ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 !rounded-md p-4 space-y-4">
        {/* TOP ROW */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          {/* Client Selection */}
          <div className="md:col-span-4 relative">
            <label className={labelCls}>Nume sau Cod Fiscal Client *</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Caută după nume sau CUI..."
                value={showClientDropdown ? clientSearch : clientName}
                onChange={e => {
                  if (!showClientDropdown) { setClientName(e.target.value); setSelectedClientId(""); }
                  setClientSearch(e.target.value);
                }}
                onFocus={() => setShowClientDropdown(true)}
                onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                className={inputCls}
              />
              {showClientDropdown && filteredClients.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded shadow-lg max-h-48 overflow-y-auto">
                  {filteredClients.slice(0, 8).map(c => (
                    <button key={c.id} onMouseDown={() => selectClient(c)}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-slate-800 text-sm">
                      <div className="font-medium text-slate-900 dark:text-white">{c.name}</div>
                      {c.cui && <div className="text-xs text-slate-400">CUI: {c.cui}</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Dates */}
          <div className="md:col-span-2">
            <label className={labelCls}>Data Emiterii *</label>
            <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className={inputCls} />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Data Scadenței</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} />
          </div>

          {/* Series + Number */}
          <div className="md:col-span-4 grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Serie</label>
              <input value={series} onChange={e => setSeries(e.target.value.toUpperCase())} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Număr</label>
              <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>

        {/* BOTTOM ROW (Client details + Moneda) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          {/* Client Details Grid */}
          <div className="md:col-span-4 grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>CUI / CIF</label>
              <input value={clientCUI} onChange={e => setClientCUI(e.target.value)} className={inputCls} placeholder="RO12345678" />
            </div>
            <div>
              <label className={labelCls}>Reg. Com.</label>
              <input value={clientRegCom} onChange={e => setClientRegCom(e.target.value)} className={inputCls} placeholder="J40/..." />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Adresă</label>
              <input value={clientAddress} onChange={e => setClientAddress(e.target.value)} className={inputCls} placeholder="Str. ..." />
            </div>
            <div>
              <label className={labelCls}>Localitate</label>
              <input value={clientCity} onChange={e => setClientCity(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Other settings */}
          <div className="md:col-span-2">
            <label className={labelCls}>Moneda Facturii</label>
            <select value={currency} onChange={e => setCurrency(e.target.value as Currency)} className={selectCls}>
              {currencies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Telefon Client</label>
            <input value={clientPhone} onChange={e => setClientPhone(e.target.value)} className={inputCls} />
          </div>
        </div>
      </div>

      {/* ── LINES TABLE — full width ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-12 gap-0 bg-[#1e1b4b] dark:bg-slate-800 text-white text-[11px] font-bold uppercase tracking-wider">
          <div className="col-span-5 px-4 py-2.5">Denumire Produs sau Serviciu</div>
          <div className="col-span-1 px-3 py-2.5 text-center border-l border-slate-700">U.M.</div>
          <div className="col-span-1 px-3 py-2.5 text-center border-l border-slate-700">Cant.</div>
          <div className="col-span-1 px-3 py-2.5 text-center border-l border-slate-700">Cotă TVA</div>
          <div className="col-span-2 px-3 py-2.5 text-right border-l border-slate-700">Preț (fără TVA)</div>
          <div className="col-span-1 px-3 py-2.5 text-right border-l border-slate-700">Valoare</div>
          <div className="col-span-1 px-3 py-2.5 text-center border-l border-slate-700"></div>
        </div>

        {/* Lines */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {lines.map((line, idx) => (
            <div key={line.id} className="grid grid-cols-12 gap-0 items-center hover:bg-slate-50 dark:hover:bg-slate-800/30">
              <div className="col-span-5 px-3 py-2">
                <input
                  type="text"
                  placeholder={`Denumire produs sau serviciu...`}
                  value={line.description}
                  onChange={e => updateLine(line.id, "description", e.target.value)}
                  className="w-full h-8 px-2 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-1 px-2 py-2 border-l border-slate-100 dark:border-slate-800">
                <select
                  value={line.unit}
                  onChange={e => updateLine(line.id, "unit", e.target.value)}
                  className="w-full h-8 px-1 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="col-span-1 px-2 py-2 border-l border-slate-100 dark:border-slate-800">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.quantity}
                  onChange={e => updateLine(line.id, "quantity", e.target.value)}
                  className="w-full h-8 px-2 text-sm text-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-1 px-2 py-2 border-l border-slate-100 dark:border-slate-800">
                <select
                  value={line.vatRate}
                  onChange={e => updateLine(line.id, "vatRate", parseFloat(e.target.value))}
                  className="w-full h-8 px-1 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {VAT_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                </select>
              </div>
              <div className="col-span-2 px-2 py-2 border-l border-slate-100 dark:border-slate-800">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.unitPrice}
                  onChange={e => updateLine(line.id, "unitPrice", e.target.value)}
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

        {/* Add line + Totals */}
        <div className="border-t border-slate-200 dark:border-slate-700 grid grid-cols-12">
          <div className="col-span-7 px-4 py-3">
            <button
              onClick={addLine}
              className="flex items-center gap-1.5 px-3 h-8 text-xs font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Adaugă Produs / Serviciu
            </button>
          </div>
          <div className="col-span-5 px-4 py-3 border-l border-slate-200 dark:border-slate-700 space-y-1">
            {vatBreakdown.map(({ rate, base, vat }) => (
              <div key={rate} className="flex justify-between text-xs text-slate-500">
                <span>TVA {rate}% × {formatCurrency(base, currency)}</span>
                <span className="font-medium">{formatCurrency(vat, currency)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
              <span>Total fără TVA:</span>
              <span className="font-semibold">{formatCurrency(subtotal, currency)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
              <span>TVA Total:</span>
              <span className="font-semibold">{formatCurrency(totalVAT, currency)}</span>
            </div>
            <div className="flex justify-between text-base font-black text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700 pt-2 mt-1">
              <span>TOTAL DE PLATĂ:</span>
              <span className="text-blue-600">{formatCurrency(total, currency)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── OPTIONAL FIELDS — collapsible ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded overflow-hidden">
        <button
          onClick={() => setShowOptional(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <span>Câmpuri Opționale <span className="text-slate-400 font-normal">(Delegat, Aviz, Comandă, Mențiuni...)</span></span>
          {showOptional ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
        {showOptional && (
          <div className="border-t border-slate-100 dark:border-slate-800 p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className={labelCls}>Întocmit de</label>
                <input value={intocmitDe} onChange={e => setIntocmitDe(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Delegat</label>
                <input value={delegat} onChange={e => setDelegat(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Carte Identitate</label>
                <input value={carteIdentitate} onChange={e => setCarteIdentitate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Nr. Aviz Însoțire</label>
                <input value={numarAviz} onChange={e => setNumarAviz(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Auto (nr. înmatriculare)</label>
                <input value={auto} onChange={e => setAuto(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Agent Vânzări</label>
                <input value={agentVanzari} onChange={e => setAgentVanzari(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Punct de Lucru Client</label>
                <input value={punctLucru} onChange={e => setPunctLucru(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Nr. Comandă</label>
                <input value={numarComanda} onChange={e => setNumarComanda(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Nr. Contract</label>
                <input value={numarContract} onChange={e => setNumarContract(e.target.value)} className={inputCls} />
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
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvează Ciornă
        </button>
        <button
          onClick={() => handleSave("sent")}
          disabled={saving}
          className="flex items-center gap-1.5 px-8 h-10 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Previzualizare / Emite Factura
        </button>
      </div>
    </div>
  );
}
