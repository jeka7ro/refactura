import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2, ArrowLeft, PackageOpen, Plus, Save, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import NirSelectorModal from "@/components/NirSelectorModal";
import { formatNumber } from "@/lib/utils";

export default function BonConsumCreate() {
  const [, navigate] = useLocation();
  const [saving, setSaving] = useState(false);
  const [showNirModal, setShowNirModal] = useState(false);

  const [number, setNumber] = useState(`BC-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [gestiune, setGestiune] = useState("");

  const [lines, setLines] = useState<any[]>([]);

  const createBon = trpc.bonuriConsum.create.useMutation();
  const consumeLineMutation = trpc.nir.consumeLine.useMutation();

  const handleSave = async () => {
    if (!number) return toast.error("Completează numărul bonului!");
    if (!date) return toast.error("Completează data!");
    if (lines.length === 0) return toast.error("Adaugă cel puțin un produs!");

    setSaving(true);
    try {
      const payload = {
        number,
        date,
        gestiune,
        lines: lines.map(l => ({
          description: l.description,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
        })),
      };

      const res = await createBon.mutateAsync(payload);

      // Consume stock
      const stockLines = lines
        .filter(l => l.nirLineId)
        .map(l => ({ nirLineId: l.nirLineId, qty: Number(l.quantity) }));
      
      if (stockLines.length > 0) {
        await consumeLineMutation.mutateAsync({ lines: stockLines });
      }

      toast.success("Bon de consum salvat și stoc actualizat!");
      navigate(`/bonuri-consum/${res.id}`);
    } catch (e: any) {
      toast.error("Eroare la salvare: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-full space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/bonuri-consum")}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <PackageOpen className="w-5 h-5 text-amber-600" />
            Creare Bon de Consum
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Selectează produse din stoc pentru a le consuma
          </p>
        </div>
        <div className="ml-auto">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-xl transition-all shadow-sm shadow-amber-600/20 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Se salvează..." : "Salvează Bonul"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-sm md:col-span-1 h-fit">
          <h2 className="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
            Date Document
          </h2>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Număr Bon</label>
            <input
              type="text"
              value={number}
              onChange={e => setNumber(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Data</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Gestiune</label>
            <input
              type="text"
              value={gestiune}
              onChange={e => setGestiune(e.target.value)}
              placeholder="Ex: Gestiunea Principală"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="md:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
              <h2 className="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Produse Consumate
              </h2>
              <button
                onClick={() => setShowNirModal(true)}
                className="flex items-center gap-1.5 px-3 h-8 text-xs font-semibold text-sky-700 border border-sky-200 bg-sky-50 hover:bg-sky-100 rounded transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Adaugă din Stoc
              </button>
            </div>
            
            {lines.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                Niciun produs adăugat. Apasă pe "Adaugă din Stoc" pentru a alege produse din inventar.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Denumire</th>
                      <th className="px-4 py-3 text-center">U/M</th>
                      <th className="px-4 py-3 text-right">Cantitate</th>
                      <th className="px-4 py-3 text-right">Preț unitar</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {lines.map((l, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white max-w-[200px] truncate" title={l.description}>
                          {l.description}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400">
                          {l.unit || "buc"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            min="0.01"
                            max={l.maxQuantity}
                            step="0.01"
                            value={l.quantity}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              const newLines = [...lines];
                              newLines[idx].quantity = Math.min(val, l.maxQuantity); // Prevent exceeding stock
                              setLines(newLines);
                            }}
                            className="w-24 text-right px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded outline-none focus:border-amber-500"
                          />
                          <div className="text-[9px] text-slate-400 mt-0.5">max: {l.maxQuantity}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-400">
                          {formatNumber(l.unitPrice)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setLines(lines.filter((_, i) => i !== idx));
                            }}
                            className="p-1.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {showNirModal && (
        <NirSelectorModal
          onClose={() => setShowNirModal(false)}
          onAdd={selected => {
            const newLines = selected.map(s => ({
              description: s.description,
              quantity: s.quantity, // this is the 'remaining' in NirSelectorModal
              maxQuantity: s.quantity,
              unitPrice: s.unitPrice,
              unit: s.unit,
              nirLineId: s.nirLineId,
            }));
            setLines(prev => [...prev, ...newLines]);
            setShowNirModal(false);
          }}
        />
      )}
    </div>
  );
}
