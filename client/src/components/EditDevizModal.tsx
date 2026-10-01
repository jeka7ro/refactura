import { useState, useEffect } from "react";
import { Loader2, Plus, Trash2, Save, X, FileText, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EditDevizModalProps {
  isOpen: boolean;
  onClose: () => void;
  devizId: number;
  onSuccess?: () => void;
}

interface DevizLineItem {
  id?: number;
  type: "MATERIAL" | "MANOPERA" | "UTILAJ" | "NORMA";
  code?: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export function EditDevizModal({
  isOpen,
  onClose,
  devizId,
  onSuccess,
}: EditDevizModalProps) {
  const { data, isLoading, refetch } = trpc.devize.getById.useQuery(
    { id: devizId },
    { enabled: isOpen && !!devizId }
  );

  const [lines, setLines] = useState<DevizLineItem[]>([]);
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (data?.deviz) {
      setNotes(data.deviz.notes || "");
      if (data.lines && data.lines.length > 0) {
        setLines(
          data.lines.map((l: any) => ({
            id: l.id,
            type: (l.type as any) || "MATERIAL",
            code: l.code || "",
            description: l.description || "",
            quantity: Number(l.quantity) || 1,
            unitPrice: Number(l.unitPrice) || 0,
          }))
        );
      } else {
        setLines([
          {
            type: "MATERIAL",
            code: "",
            description: "",
            quantity: 1,
            unitPrice: 0,
          },
        ]);
      }
      setErrorMsg(null);
    }
  }, [data]);

  const updateMutation = trpc.devize.update.useMutation({
    onSuccess: () => {
      toast.success("Devizul a fost actualizat cu succes!");
      refetch();
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      setErrorMsg(err.message || "A apărut o eroare la salvarea devizului.");
    },
  });

  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      {
        type: "MATERIAL",
        code: "",
        description: "",
        quantity: 1,
        unitPrice: 0,
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) {
      setErrorMsg("Devizul trebuie să conțină cel puțin un rând.");
      return;
    }
    setLines((prev) => prev.filter((_, i) => i !== index));
    setErrorMsg(null);
  };

  const handleLineChange = (
    index: number,
    field: keyof DevizLineItem,
    val: any
  ) => {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l;
        return { ...l, [field]: val };
      })
    );
  };

  const totalMaterials = lines
    .filter((l) => l.type === "MATERIAL")
    .reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);

  const totalLabor = lines
    .filter((l) => l.type === "MANOPERA" || l.type === "NORMA" || l.type === "UTILAJ")
    .reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);

  const totalDeviz = lines.reduce(
    (sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
    0
  );

  const handleSave = () => {
    setErrorMsg(null);
    if (lines.length === 0) {
      setErrorMsg("Devizul trebuie să conțină cel puțin un rând.");
      return;
    }

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.description.trim()) {
        setErrorMsg(`Rândul #${i + 1} nu are denumire completată.`);
        return;
      }
      if (l.quantity <= 0) {
        setErrorMsg(`Rândul #${i + 1} trebuie să aibă cantitate mai mare ca 0.`);
        return;
      }
      if (l.unitPrice < 0) {
        setErrorMsg(`Rândul #${i + 1} nu poate avea un preț unitar negativ.`);
        return;
      }
    }

    updateMutation.mutate({
      id: devizId,
      notes,
      lines: lines.map((l) => ({
        type: l.type,
        code: l.code || null,
        description: l.description.trim(),
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
      })),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl">
        <DialogHeader className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                Editare Deviz {data?.deviz?.number || `#${devizId}`}
              </DialogTitle>
              <p className="text-xs text-slate-400 mt-0.5">
                Modifică rândurile, tipul (material / manoperă) și prețurile din deviz
              </p>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
            <span className="text-xs text-slate-400 font-medium">Se încarcă datele devizului...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {errorMsg && (
              <div className="flex items-center gap-2 p-3 text-xs rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Tabelul de rânduri */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-2.5 py-2.5 text-center text-slate-400 font-semibold w-8">#</th>
                      <th className="px-2.5 py-2.5 text-left text-slate-600 dark:text-slate-300 font-semibold w-32">Tip</th>
                      <th className="px-2.5 py-2.5 text-left text-slate-600 dark:text-slate-300 font-semibold min-w-[200px]">Denumire articol / serviciu</th>
                      <th className="px-2.5 py-2.5 text-left text-slate-600 dark:text-slate-300 font-semibold w-24">Cod</th>
                      <th className="px-2.5 py-2.5 text-right text-slate-600 dark:text-slate-300 font-semibold w-24">Cantitate</th>
                      <th className="px-2.5 py-2.5 text-right text-slate-600 dark:text-slate-300 font-semibold w-28">Preț unitar</th>
                      <th className="px-2.5 py-2.5 text-right text-slate-600 dark:text-slate-300 font-semibold w-28">Total RON</th>
                      <th className="px-2 py-2.5 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {lines.map((line, idx) => {
                      const rowTotal = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="px-2.5 py-2 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="px-2.5 py-2">
                            <select
                              value={line.type}
                              onChange={(e) =>
                                handleLineChange(idx, "type", e.target.value as any)
                              }
                              className="w-full h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-sky-500 outline-none"
                            >
                              <option value="MATERIAL">Material</option>
                              <option value="MANOPERA">Manoperă</option>
                              <option value="UTILAJ">Utilaj</option>
                              <option value="NORMA">Normă</option>
                            </select>
                          </td>
                          <td className="px-2.5 py-2">
                            <input
                              type="text"
                              value={line.description}
                              onChange={(e) =>
                                handleLineChange(idx, "description", e.target.value)
                              }
                              placeholder="Descriere articol..."
                              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                            />
                          </td>
                          <td className="px-2.5 py-2">
                            <input
                              type="text"
                              value={line.code || ""}
                              onChange={(e) =>
                                handleLineChange(idx, "code", e.target.value)
                              }
                              placeholder="Cod opț."
                              className="w-full h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                            />
                          </td>
                          <td className="px-2.5 py-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.quantity}
                              onChange={(e) =>
                                handleLineChange(
                                  idx,
                                  "quantity",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-right text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                            />
                          </td>
                          <td className="px-2.5 py-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.unitPrice}
                              onChange={(e) =>
                                handleLineChange(
                                  idx,
                                  "unitPrice",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-right text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                            />
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {rowTotal.toFixed(2)}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(idx)}
                              title="Șterge rând"
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-2.5 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/50 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Adaugă rând
                </button>
              </div>
            </div>

            {/* Observații */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Observații deviz (opțional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observații despre lucrări, condiții etc..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none resize-none"
              />
            </div>

            {/* Totale */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="text-right sm:text-left">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Materiale
                </span>
                <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200">
                  {totalMaterials.toFixed(2)} RON
                </span>
              </div>
              <div className="text-right sm:text-left">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Manoperă / Utilaje
                </span>
                <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200">
                  {totalLabor.toFixed(2)} RON
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 block">
                  TOTAL DEVIZ
                </span>
                <span className="font-mono text-base font-black text-sky-700 dark:text-sky-300">
                  {totalDeviz.toFixed(2)} RON
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={updateMutation.isPending}
            className="px-4 h-9 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Anulează
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={updateMutation.isPending || isLoading}
            className="flex items-center gap-1.5 px-4 h-9 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Salvează deviz
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
