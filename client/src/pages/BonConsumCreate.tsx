import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2, ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
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
    <div className="p-3 sm:p-5 max-w-full space-y-5 overflow-x-hidden">
      {/* Header — Apple macOS Window Title & Action */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-0.5">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate("/bonuri-consum")}
            aria-label="Înapoi la Bonuri de Consum"
            className="apple-btn-glass w-9 h-9 rounded-full flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white transition-all cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight truncate">
              Creare Bon de Consum
            </h1>
            <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
              Selectează produse din stoc pentru a le consuma
            </p>
          </div>
        </div>
        <div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="apple-btn-prominent flex items-center justify-center gap-1.5 h-9 px-4 rounded-full text-white text-[12.5px] font-semibold transition-all disabled:opacity-50 cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? "Se salvează..." : "Salvează Bonul"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="apple-surface p-5 space-y-4 md:col-span-1 h-fit">
          <h2 className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
            Date document
          </h2>
          <div>
            <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1.5">
              Număr bon
            </label>
            <input
              type="text"
              value={number}
              onChange={e => setNumber(e.target.value)}
              className="apple-input w-full h-10 px-3.5 text-[13.5px] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1.5">
              Data
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="apple-input w-full h-10 px-3.5 text-[13.5px] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1.5">
              Gestiune
            </label>
            <input
              type="text"
              value={gestiune}
              onChange={e => setGestiune(e.target.value)}
              placeholder="Ex: Gestiunea Principală"
              className="apple-input w-full h-10 px-3.5 text-[13.5px] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
            />
          </div>
        </div>

        <div className="md:col-span-2 space-y-4 min-w-0">
          <div className="apple-surface overflow-hidden">
            <div className="px-4 py-3 border-b border-black/[0.05] dark:border-white/[0.07] flex justify-between items-center bg-[#fafafa] dark:bg-white/[0.025] gap-2 flex-wrap">
              <h2 className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Produse consumate
              </h2>
              <button
                type="button"
                onClick={() => setShowNirModal(true)}
                className="apple-btn-glass flex items-center gap-1.5 h-8 px-3.5 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] text-[12px] font-semibold transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />
                <span>Adaugă din Stoc</span>
              </button>
            </div>
            
            {lines.length === 0 ? (
              <div className="p-12 text-center text-[#6e6e73] dark:text-[#98989d] text-[13px]">
                Niciun produs adăugat. Apasă pe „Adaugă din Stoc” pentru a alege produse din inventar.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
                    <tr>
                      <th className="px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                        Denumire
                      </th>
                      <th className="px-4 py-3 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                        U/M
                      </th>
                      <th className="px-4 py-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                        Cantitate
                      </th>
                      <th className="px-4 py-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                        Preț unitar
                      </th>
                      <th className="px-4 py-3 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
                    {lines.map((l, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors"
                      >
                        <td
                          className="px-4 py-3 text-[13.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] max-w-[220px] truncate"
                          title={l.description}
                        >
                          {l.description}
                        </td>
                        <td className="px-4 py-3 text-center text-[13px] text-[#6e6e73] dark:text-[#98989d]">
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
                              newLines[idx].quantity = Math.min(val, l.maxQuantity);
                              setLines(newLines);
                            }}
                            className="apple-input w-24 h-8 text-right px-2.5 text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none tabular-nums"
                          />
                          <div className="text-[11px] text-[#8e8e93] mt-0.5 tabular-nums">
                            max: {l.maxQuantity}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-[13px] text-[#1d1d1f] dark:text-[#ebebf5]">
                          {formatNumber(l.unitPrice)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            aria-label="Șterge linie"
                            onClick={() => {
                              setLines(lines.filter((_, i) => i !== idx));
                            }}
                            className="apple-btn-destructive-soft w-8 h-8 rounded-full inline-flex items-center justify-center cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
              quantity: s.quantity,
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
