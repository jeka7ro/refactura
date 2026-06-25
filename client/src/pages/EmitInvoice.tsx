// EmitInvoice.tsx — Creare Factură Nouă Direct din Platformă
import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, Plus, Trash2, Save, Send, FileText,
  ChevronDown, ChevronUp, User, Calendar, Hash, AlertCircle, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { formatCurrency, currencies, type Currency } from "@/lib/store";

const VAT_RATES = [0, 5, 9, 19];
const UNITS = ["buc", "ore", "luni", "kg", "m", "m2", "m3", "l", "set", "servicii"];

interface Line {
  id: string;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  unit: string;
  vatRate: number;
  total: number;
}

const defaultLine = (): Line => ({
  id: crypto.randomUUID(),
  description: "",
  quantity: 1,
  unitPrice: 0,
  unit: "buc",
  vatRate: 19,
  total: 0,
});

function computeLine(line: Line) {
  const qty = parseFloat(String(line.quantity)) || 0;
  const price = parseFloat(String(line.unitPrice)) || 0;
  return Math.round(qty * price * 100) / 100;
}

export default function EmitInvoice() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  // Client
  const [selectedClientId, setSelectedClientId] = useState<string>("");
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
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });
  const [notes, setNotes] = useState("");

  // Lines
  const [lines, setLines] = useState<Line[]>([defaultLine()]);
  const [saving, setSaving] = useState(false);

  // Data
  const { data: clientsData } = trpc.clients.list.useQuery();
  const { data: nextNumber } = trpc.emittedInvoice.nextNumber.useQuery({ series });
  const { data: tenantsData = [] } = trpc.tenants.list.useQuery();
  const tenant = tenantsData[0];

  const createMutation = trpc.emittedInvoice.create.useMutation({
    onSuccess: (data) => {
      utils.emittedInvoice.list.invalidate();
      toast.success("Factura a fost creată cu succes!");
      navigate(`/facturi-emise-nou/${data.id}`);
    },
    onError: (err) => toast.error("Eroare: " + err.message),
  });

  const clients = clientsData || [];
  const filteredClients = useMemo(() =>
    clients.filter(c =>
      c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      (c.cui || "").includes(clientSearch)
    ), [clients, clientSearch]);

  // Auto fill from nextNumber
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
    setLines(prev => prev.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [field]: value };
      updated.total = computeLine(updated);
      return updated;
    }));
  }, []);

  const subtotal = useMemo(() => lines.reduce((s, l) => s + computeLine(l), 0), [lines]);
  const totalVAT = useMemo(() =>
    lines.reduce((s, l) => s + Math.round(computeLine(l) * (parseFloat(String(l.vatRate)) / 100) * 100) / 100, 0),
    [lines]);
  const total = subtotal + totalVAT;

  const handleSave = async (status: "draft" | "sent" = "draft") => {
    if (!clientName.trim()) { toast.error("Te rog selectează sau introduceți un client"); return; }
    if (lines.some(l => !l.description.trim())) { toast.error("Toate liniile trebuie să aibă o descriere"); return; }
    setSaving(true);
    try {
      await createMutation.mutateAsync({
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
        notes,
        lines: lines.map((l, i) => ({
          description: l.description,
          quantity: parseFloat(String(l.quantity)) || 1,
          unitPrice: parseFloat(String(l.unitPrice)) || 0,
          unit: l.unit,
          vatRate: l.vatRate,
          total: computeLine(l),
          lineOrder: i,
        })),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/facturi-emise-nou")}
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Emite Factură Nouă
            </h1>
            <p className="text-sm text-slate-500 font-medium">{invoiceNumber || "Număr nou..."}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSave("draft")}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvează Ciornă
          </button>
          <button
            onClick={() => handleSave("sent")}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Emite Factura
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Client + Invoice Meta */}
        <div className="lg:col-span-2 space-y-4">
          {/* Furnizor Info */}
          {tenant && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-lg p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500 mb-1.5">Emitent (Furnizor)</p>
              <p className="font-bold text-sm text-slate-900 dark:text-white">{tenant.name}</p>
              {tenant.cui && <p className="text-xs text-slate-500 mt-0.5">CUI: {tenant.cui}</p>}
              {tenant.address && <p className="text-xs text-slate-500">{tenant.address}</p>}
            </div>
          )}

          {/* Client Card */}
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <User className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Client (Cumpărător)</span>
            </div>

            {/* Client search dropdown */}
            <div className="relative">
              <input
                type="text"
                placeholder="Caută client sau adaugă manual..."
                value={showClientDropdown ? clientSearch : clientName}
                onChange={e => {
                  if (!showClientDropdown) {
                    setClientName(e.target.value);
                    setSelectedClientId("");
                  }
                  setClientSearch(e.target.value);
                }}
                onFocus={() => setShowClientDropdown(true)}
                onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                className="w-full h-9 px-3 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {showClientDropdown && filteredClients.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredClients.slice(0, 8).map(c => (
                    <button
                      key={c.id}
                      onMouseDown={() => selectClient(c)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm text-slate-900 dark:text-white"
                    >
                      <div className="font-medium">{c.name}</div>
                      {c.cui && <div className="text-xs text-slate-400">CUI: {c.cui}</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {[
              { label: "CUI / CIF", value: clientCUI, set: setClientCUI },
              { label: "Reg. Com.", value: clientRegCom, set: setClientRegCom },
              { label: "Adresă", value: clientAddress, set: setClientAddress },
              { label: "Localitate", value: clientCity, set: setClientCity },
              { label: "Email", value: clientEmail, set: setClientEmail, type: "email" },
              { label: "Telefon", value: clientPhone, set: setClientPhone },
            ].map(({ label, value, set, type }) => (
              <div key={label}>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</label>
                <input
                  type={type || "text"}
                  value={value}
                  onChange={e => set(e.target.value)}
                  className="w-full h-8 px-3 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>

          {/* Invoice Meta */}
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Hash className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Detalii Factură</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Serie</label>
                <input
                  value={series}
                  onChange={e => setSeries(e.target.value.toUpperCase())}
                  className="w-full h-8 px-3 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Număr</label>
                <input
                  value={invoiceNumber}
                  onChange={e => setInvoiceNumber(e.target.value)}
                  className="w-full h-8 px-3 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Monedă</label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value as Currency)}
                className="w-full h-8 px-3 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {currencies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Data Emiterii</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={e => setIssueDate(e.target.value)}
                  className="w-full h-8 px-3 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Scadență</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full h-8 px-3 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Observații</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Observații opționale..."
              />
            </div>
          </div>
        </div>

        {/* Right: Lines */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Linii Factură</span>
              </div>
              <button
                onClick={addLine}
                className="flex items-center gap-1 px-3 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Adaugă Linie
              </button>
            </div>

            {/* Lines table header */}
            <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800/30 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
              <div className="col-span-5">Descriere</div>
              <div className="col-span-1 text-center">Cant.</div>
              <div className="col-span-2 text-right">Preț/U</div>
              <div className="col-span-1 text-center">TVA %</div>
              <div className="col-span-1 text-center">U.M.</div>
              <div className="col-span-1 text-right">Total</div>
              <div className="col-span-1"></div>
            </div>

            {/* Lines */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {lines.map((line, index) => (
                <div key={line.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
                  <div className="col-span-12 md:col-span-5">
                    <input
                      type="text"
                      placeholder={`Descriere produs/serviciu ${index + 1}`}
                      value={line.description}
                      onChange={e => updateLine(line.id, "description", e.target.value)}
                      className="w-full h-8 px-2 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-4 md:col-span-1">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.quantity}
                      onChange={e => updateLine(line.id, "quantity", e.target.value)}
                      className="w-full h-8 px-2 text-sm text-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitPrice}
                      onChange={e => updateLine(line.id, "unitPrice", e.target.value)}
                      className="w-full h-8 px-2 text-sm text-right border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-4 md:col-span-1">
                    <select
                      value={line.vatRate}
                      onChange={e => updateLine(line.id, "vatRate", parseFloat(e.target.value))}
                      className="w-full h-8 px-1 text-xs text-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {VAT_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  </div>
                  <div className="col-span-4 md:col-span-1">
                    <select
                      value={line.unit}
                      onChange={e => updateLine(line.id, "unit", e.target.value)}
                      className="w-full h-8 px-1 text-xs text-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="col-span-3 md:col-span-1 text-right">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {formatCurrency(computeLine(line), currency)}
                    </span>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {lines.length > 1 && (
                      <button
                        onClick={() => removeLine(line.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 px-4 py-4">
              <div className="flex flex-col items-end gap-1.5 text-sm">
                <div className="flex items-center gap-8 text-slate-600 dark:text-slate-400">
                  <span>Subtotal (fără TVA):</span>
                  <span className="font-medium w-28 text-right">{formatCurrency(subtotal, currency)}</span>
                </div>
                <div className="flex items-center gap-8 text-slate-600 dark:text-slate-400">
                  <span>TVA:</span>
                  <span className="font-medium w-28 text-right">{formatCurrency(totalVAT, currency)}</span>
                </div>
                <div className="flex items-center gap-8 border-t border-slate-300 dark:border-slate-600 pt-2 mt-1">
                  <span className="font-black text-base text-slate-900 dark:text-white">TOTAL DE PLATĂ:</span>
                  <span className="font-black text-base text-blue-600 w-28 text-right">{formatCurrency(total, currency)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* TVA Breakdown */}
          {totalVAT > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Detaliu TVA</p>
              <div className="space-y-1">
                {[...new Set(lines.map(l => l.vatRate))].sort().map(rate => {
                  const base = lines.filter(l => l.vatRate === rate).reduce((s, l) => s + computeLine(l), 0);
                  const vat = Math.round(base * (rate / 100) * 100) / 100;
                  return (
                    <div key={rate} className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>TVA {rate}% aplicat la {formatCurrency(base, currency)}</span>
                      <span className="font-semibold">{formatCurrency(vat, currency)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
