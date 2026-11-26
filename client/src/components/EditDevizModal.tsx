import { useState, useEffect } from "react";
import {
  Loader2,
  Plus,
  Trash2,
  Save,
  FileText,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  const [devizNumber, setDevizNumber] = useState("");
  const [devizDate, setDevizDate] = useState("");
  const [lines, setLines] = useState<DevizLineItem[]>([]);
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (data?.deviz) {
      setNotes(data.deviz.notes || "");
      setDevizNumber(data.deviz.number || "");
      if (data.deviz.date) {
        const d = new Date(data.deviz.date);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        setDevizDate(`${yyyy}-${mm}-${dd}`);
      }
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
    onError: err => {
      setErrorMsg(err.message || "A apărut o eroare la salvarea devizului.");
    },
  });

  const handleAddLine = () => {
    setLines(prev => [
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
    setLines(prev => prev.filter((_, i) => i !== index));
    setErrorMsg(null);
  };

  const handleLineChange = (
    index: number,
    field: keyof DevizLineItem,
    val: any
  ) => {
    setLines(prev =>
      prev.map((l, i) => {
        if (i !== index) return l;
        return { ...l, [field]: val };
      })
    );
  };

  const totalMaterials = lines
    .filter(l => l.type === "MATERIAL")
    .reduce(
      (sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
      0
    );

  const totalLabor = lines
    .filter(
      l => l.type === "MANOPERA" || l.type === "NORMA" || l.type === "UTILAJ"
    )
    .reduce(
      (sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
      0
    );

  const totalDeviz = lines.reduce(
    (sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
    0
  );

  const handleSave = () => {
    setErrorMsg(null);
    if (!devizDate) {
      setErrorMsg("Data devizului este obligatorie.");
      return;
    }

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
      number: devizNumber || undefined,
      date: devizDate,
      notes,
      lines: lines.map(l => ({
        type: l.type,
        code: l.code || null,
        description: l.description.trim(),
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
      })),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] rounded-[20px] shadow-2xl overscroll-contain">
        <DialogHeader className="p-4 sm:p-5 border-b border-black/[0.06] dark:border-white/[0.08] flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[10px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center text-[#0071e3] dark:text-[#0a84ff] shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-[16px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
                Editare deviz {data?.deviz?.number || `#${devizId}`}
              </DialogTitle>
              <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
                Modifică data, numărul, rândurile și prețurile din deviz
              </p>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-[#6e6e73]" />
            <span className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] font-medium">
              Se încarcă datele devizului...
            </span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain">
            {errorMsg && (
              <div className="flex items-center gap-2 p-3 text-[12.5px] rounded-xl bg-[#ff3b30]/10 dark:bg-[#ff453a]/16 text-[#d70015] dark:text-[#ff6961] border border-[#ff3b30]/20">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Antet Deviz: Număr, Data, Factură asociată */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-[#f2f2f7]/65 dark:bg-[#2c2c2e]/50 border border-black/[0.05] dark:border-white/[0.07] rounded-2xl">
              <div>
                <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">
                  Nr. deviz
                </label>
                <input
                  type="text"
                  value={devizNumber}
                  onChange={e => setDevizNumber(e.target.value)}
                  placeholder="DEV-..."
                  className="apple-input w-full h-9 px-3 text-[13px] font-semibold tabular-nums outline-none"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">
                  <Calendar className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d]" />
                  Data devizului
                </label>
                <input
                  type="date"
                  value={devizDate}
                  onChange={e => setDevizDate(e.target.value)}
                  className="apple-input w-full h-9 px-3 text-[13px] font-semibold tabular-nums outline-none"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">
                  Factură asociată
                </label>
                <div className="h-9 px-3 rounded-[12px] bg-black/[0.04] dark:bg-white/[0.06] text-[13px] font-medium text-[#6e6e73] dark:text-[#98989d] flex items-center tabular-nums">
                  {data?.deviz?.invoiceId
                    ? `Factura #${data.deviz.invoiceId}`
                    : "Neasociată"}
                </div>
              </div>
            </div>

            {/* Tabelul de rânduri */}
            <div className="apple-surface overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
                    <tr>
                      <th className="px-3 py-2.5 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] w-10">
                        Nr.
                      </th>
                      <th className="px-3 py-2.5 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] w-36">
                        Tip
                      </th>
                      <th className="px-3 py-2.5 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] min-w-[200px]">
                        Denumire articol / serviciu
                      </th>
                      <th className="px-3 py-2.5 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] w-24">
                        Cod
                      </th>
                      <th className="px-3 py-2.5 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] w-24">
                        Cantitate
                      </th>
                      <th className="px-3 py-2.5 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] w-28">
                        Preț unitar
                      </th>
                      <th className="px-3 py-2.5 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] w-28">
                        Total RON
                      </th>
                      <th className="px-2 py-2.5 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
                    {lines.map((line, idx) => {
                      const rowTotal =
                        (Number(line.quantity) || 0) *
                        (Number(line.unitPrice) || 0);
                      return (
                        <tr
                          key={idx}
                          className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors"
                        >
                          <td className="px-3 py-2 text-center text-[#8e8e93] tabular-nums text-[12px]">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2">
                            <Select
                              value={line.type}
                              onValueChange={val =>
                                handleLineChange(idx, "type", val as any)
                              }
                            >
                              <SelectTrigger className="apple-input h-8 px-2.5 text-[12.5px] w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="MATERIAL">Material</SelectItem>
                                <SelectItem value="MANOPERA">Manoperă</SelectItem>
                                <SelectItem value="UTILAJ">Utilaj</SelectItem>
                                <SelectItem value="NORMA">Normă</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={line.description}
                              onChange={e =>
                                handleLineChange(idx, "description", e.target.value)
                              }
                              placeholder="Descriere articol..."
                              className="apple-input w-full h-8 px-2.5 text-[12.5px] outline-none"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={line.code || ""}
                              onChange={e =>
                                handleLineChange(idx, "code", e.target.value)
                              }
                              placeholder="Cod opț."
                              className="apple-input w-full h-8 px-2 text-[12.5px] tabular-nums outline-none"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.quantity}
                              onChange={e =>
                                handleLineChange(
                                  idx,
                                  "quantity",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="apple-input w-full h-8 px-2 text-[12.5px] tabular-nums text-right outline-none"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.unitPrice}
                              onChange={e =>
                                handleLineChange(
                                  idx,
                                  "unitPrice",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="apple-input w-full h-8 px-2 text-[12.5px] tabular-nums text-right outline-none"
                            />
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                            {rowTotal.toFixed(2)}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(idx)}
                              title="Șterge rând"
                              aria-label="Șterge rând"
                              className="w-7 h-7 rounded-full apple-btn-glass flex items-center justify-center text-[#6e6e73] dark:text-[#98989d] hover:text-[#ff3b30] dark:hover:text-[#ff453a] transition-colors cursor-pointer mx-auto"
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

              <div className="p-2.5 bg-[#fafafa] dark:bg-white/[0.02] border-t border-black/[0.05] dark:border-white/[0.07] flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="apple-btn-glass flex items-center gap-1.5 h-8 px-3.5 rounded-full text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adaugă rând</span>
                </button>
              </div>
            </div>

            {/* Observații */}
            <div>
              <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">
                Observații deviz (opțional)
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Observații despre lucrări, condiții etc..."
                rows={2}
                className="apple-input w-full px-3 py-2 text-[13px] outline-none resize-none"
              />
            </div>

            {/* Totale */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#f2f2f7]/65 dark:bg-[#2c2c2e]/50 p-3.5 rounded-2xl border border-black/[0.05] dark:border-white/[0.07]">
              <div className="text-right sm:text-left">
                <span className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block">
                  Materiale
                </span>
                <span className="tabular-nums text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  {totalMaterials.toFixed(2)} RON
                </span>
              </div>
              <div className="text-right sm:text-left">
                <span className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block">
                  Manoperă / Utilaje
                </span>
                <span className="tabular-nums text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  {totalLabor.toFixed(2)} RON
                </span>
              </div>
              <div className="text-right">
                <span className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block">
                  Total deviz
                </span>
                <span className="tabular-nums text-[18px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.02em]">
                  {totalDeviz.toFixed(2)} RON
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="p-3.5 sm:p-4 border-t border-black/[0.06] dark:border-white/[0.08] bg-[#fafafa] dark:bg-white/[0.02] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={updateMutation.isPending}
            className="apple-btn-glass px-4 h-9 rounded-full text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] disabled:opacity-50 cursor-pointer"
          >
            Anulează
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={updateMutation.isPending || isLoading}
            className="apple-btn-prominent flex items-center justify-center gap-1.5 px-4 h-9 rounded-full text-white text-[12.5px] font-semibold disabled:opacity-50 cursor-pointer"
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>Salvează deviz</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
