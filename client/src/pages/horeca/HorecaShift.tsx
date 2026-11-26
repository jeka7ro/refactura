import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency, formatDateTime } from "@/lib/store";
import { toast } from "sonner";
import {
  Calculator,
  Check,
  ChevronLeft,
  ChevronRight,
  Play,
  Square,
  Lock,
  Wallet,
  CreditCard,
  Banknote,
  Clock,
  History,
  Loader2,
} from "lucide-react";

export default function HorecaShift() {
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
    null
  );
  const { data: locations = [] } = trpc.horeca.locations.list.useQuery();
  const locationId = selectedLocationId ?? locations[0]?.id ?? 0;

  return (
    <div className="space-y-4 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-0.5">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
            Închidere de zi (Z)
          </h1>
          <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
            Management ture, fond sertar & raport Z
          </p>
        </div>
        <div className="flex gap-2">
          {locations.length > 1 && (
            <select
              value={locationId}
              onChange={e => setSelectedLocationId(Number(e.target.value))}
              className="apple-pill-control px-3.5 h-[34px] text-[12.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] focus:outline-none cursor-pointer"
            >
              {locations.map(l => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {locationId > 0 && <ShiftManager locationId={locationId} />}
    </div>
  );
}

function ShiftManager({ locationId }: { locationId: number }) {
  const utils = trpc.useUtils();
  const { data: currentShift, isLoading: isLoadingCurrent } =
    trpc.horeca.shifts.getCurrent.useQuery({ locationId });
  const { data: pastShifts = [], isLoading: isLoadingPast } =
    trpc.horeca.shifts.list.useQuery({ locationId });

  // Open Shift State
  const [startCash, setStartCash] = useState<number>(0);
  const openMut = trpc.horeca.shifts.openShift.useMutation({
    onSuccess: () => {
      toast.success("Tură deschisă cu succes!");
      utils.horeca.shifts.getCurrent.invalidate();
      utils.horeca.shifts.list.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  // Close Shift State
  const [isClosing, setIsClosing] = useState(false);
  const [actualCash, setActualCash] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const closeMut = trpc.horeca.shifts.closeShift.useMutation({
    onSuccess: () => {
      toast.success("Tură închisă. Raportul Z a fost salvat!");
      setIsClosing(false);
      utils.horeca.shifts.getCurrent.invalidate();
      utils.horeca.shifts.list.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const [page, setPage] = useState(1);
  const rowsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(pastShifts.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const paginated = pastShifts.slice(
    (safePage - 1) * rowsPerPage,
    safePage * rowsPerPage
  );

  if (isLoadingCurrent || isLoadingPast) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="w-7 h-7 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Partea stânga: Tura Curentă */}
      <div className="lg:col-span-1 space-y-4">
        <div className="apple-surface overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 border-b border-black/[0.05] dark:border-white/[0.07] bg-[#fafafa] dark:bg-white/[0.025] flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#6e6e73] dark:text-[#98989d]" />{" "}
              Stare tură
            </h2>
            {currentShift ? (
              <span className="px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300 rounded-full border border-emerald-500/20">
                Deschisă
              </span>
            ) : (
              <span className="px-2.5 py-0.5 text-[11px] font-semibold bg-[#f2f2f7] text-[#6e6e73] dark:bg-[#2c2c2e] dark:text-[#98989d] rounded-full border border-black/[0.06] dark:border-white/[0.08]">
                Închisă
              </span>
            )}
          </div>

          <div className="p-5">
            {!currentShift ? (
              <div className="text-center">
                <div className="mx-auto w-14 h-14 bg-[#f2f2f7] dark:bg-[#2c2c2e] rounded-full flex items-center justify-center mb-4">
                  <Lock className="w-7 h-7 text-[#8e8e93]" />
                </div>
                <h3 className="text-base font-bold text-[#1d1d1f] dark:text-[#f5f5f7] mb-1.5">
                  Tura este închisă
                </h3>
                <p className="text-[13px] text-[#6e6e73] dark:text-[#98989d] mb-5">
                  Deschide tura pentru a permite preluarea de noi comenzi și
                  marcarea bonurilor.
                </p>

                <div className="text-left space-y-2 mb-5 bg-[#f2f2f7]/70 dark:bg-[#2c2c2e] p-4 rounded-xl border border-black/[0.06] dark:border-white/[0.08]">
                  <label className="block text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                    Fond sertar la deschidere (Cash)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6e6e73] dark:text-[#98989d] text-xs font-semibold">
                      RON
                    </span>
                    <input
                      type="number"
                      value={startCash}
                      onChange={e => setStartCash(Number(e.target.value))}
                      className="w-full pl-12 pr-4 h-10 bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] rounded-xl font-bold text-base tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] focus:outline-none focus:ring-2 focus:ring-primary/25"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openMut.mutate({ locationId, startCash })}
                  disabled={openMut.isPending}
                  className="apple-btn-prominent w-full flex justify-center items-center gap-2 text-white font-semibold h-10 text-sm cursor-pointer"
                >
                  {openMut.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" fill="currentColor" />
                  )}
                  Deschide tura
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-6 tabular-nums">
                  <div>
                    <p className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                      Deschisă la
                    </p>
                    <p className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-sm mt-0.5">
                      {formatDateTime(currentShift.openedAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                      Fond inițial
                    </p>
                    <p className="font-semibold text-emerald-700 dark:text-emerald-300 text-sm mt-0.5">
                      {formatCurrency(Number(currentShift.startCash), "RON")}
                    </p>
                  </div>
                </div>

                {!isClosing ? (
                  <button
                    type="button"
                    onClick={() => setIsClosing(true)}
                    className="w-full flex justify-center items-center gap-2 bg-[#ff3b30] hover:bg-[#d70015] text-white font-semibold h-10 rounded-full transition-colors shadow-sm mt-4 cursor-pointer text-sm"
                  >
                    <Square className="w-4 h-4" fill="currentColor" />
                    Închide ziua (Z)
                  </button>
                ) : (
                  <div className="bg-[#ff3b30]/[0.07] dark:bg-[#ff453a]/[0.12] border border-[#ff3b30]/20 p-4 rounded-2xl mt-4 animate-in fade-in zoom-in duration-200">
                    <h3 className="font-bold text-[#d70015] dark:text-[#ff6961] mb-1.5 text-sm">
                      Confirmare închidere Z
                    </h3>
                    <p className="text-xs text-[#6e6e73] dark:text-[#ebebf5]/80 mb-4 leading-relaxed">
                      Numără banii din sertar. Sistemul va calcula automat
                      diferențele.
                    </p>

                    <div className="space-y-3 mb-4">
                      <div>
                        <label className="block text-[12px] font-medium text-[#1d1d1f] dark:text-[#ebebf5] mb-1">
                          Total cash numărat (RON)
                        </label>
                        <input
                          type="number"
                          value={actualCash}
                          onChange={e => setActualCash(Number(e.target.value))}
                          className="w-full px-3.5 h-9 bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.12] rounded-xl font-bold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] focus:outline-none focus:ring-2 focus:ring-[#ff3b30]/40"
                        />
                      </div>
                      <div>
                        <label className="block text-[12px] font-medium text-[#1d1d1f] dark:text-[#ebebf5] mb-1">
                          Note (opțional)
                        </label>
                        <input
                          type="text"
                          value={notes}
                          onChange={e => setNotes(e.target.value)}
                          placeholder="Motiv eventuale diferențe..."
                          className="w-full px-3.5 h-9 bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.12] rounded-xl text-xs text-[#1d1d1f] dark:text-[#f5f5f7] focus:outline-none focus:ring-2 focus:ring-[#ff3b30]/40"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setIsClosing(false)}
                        className="apple-btn-glass flex-1 text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold h-9 text-xs cursor-pointer"
                      >
                        Anulează
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          closeMut.mutate({
                            id: currentShift.id,
                            endCashActual: actualCash,
                            notes,
                          })
                        }
                        disabled={closeMut.isPending}
                        className="flex-1 flex justify-center items-center gap-1.5 bg-[#ff3b30] hover:bg-[#d70015] text-white font-semibold h-9 rounded-full text-xs cursor-pointer"
                      >
                        {closeMut.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}{" "}
                        Confirmă Z
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="apple-surface p-4 text-[12.5px] text-[#6e6e73] dark:text-[#98989d] flex gap-3 leading-relaxed">
          <Banknote className="w-4 h-4 flex-shrink-0 text-[#0071e3] dark:text-[#64d2ff] mt-0.5" />
          <p>
            La închiderea zilei (Raport Z), sistemul compară{" "}
            <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">Fondul inițial + Vânzările Cash</strong> cu banii fizici
            numărați în sertar. Odată închisă tura, comenzile aferente sunt
            blocate împotriva modificărilor.
          </p>
        </div>
      </div>

      {/* Partea dreaptă: Istoric Ture */}
      <div className="lg:col-span-2">
        <div className="apple-surface overflow-hidden flex flex-col h-full">
          <div className="px-4 sm:px-5 py-3.5 border-b border-black/[0.05] dark:border-white/[0.07] bg-[#fafafa] dark:bg-white/[0.025] flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-2">
              <History className="w-4 h-4 text-[#6e6e73] dark:text-[#98989d]" />{" "}
              Istoric ture & rapoarte Z
            </h2>
            <div className="text-xs font-medium text-[#6e6e73] dark:text-[#98989d] bg-[#f2f2f7] dark:bg-[#2c2c2e] px-3 py-1 rounded-full tabular-nums">
              Total: <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">{pastShifts.length}</strong>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
                <tr className="text-[#6e6e73] dark:text-[#98989d] text-left font-medium text-[12px]">
                  <th className="px-4 py-3 text-center font-medium w-12">
                    Nr.
                  </th>
                  <th className="px-4 py-3 font-medium">
                    Deschidere
                  </th>
                  <th className="px-4 py-3 font-medium">
                    Închidere (Z)
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    Vânzări
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    Card
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    Cash așteptat
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    Cash numărat
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06] tabular-nums">
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[#6e6e73] dark:text-[#98989d] text-[13px]">
                      Nu există ture înregistrate.
                    </td>
                  </tr>
                )}
                {paginated.map((shift, idx) => {
                  const expected = Number(shift.endCashExpected);
                  const actual = Number(shift.endCashActual);
                  const diff = actual - expected;
                  const isDiff =
                    shift.status === "closed" && Math.abs(diff) > 0.1;

                  return (
                    <tr
                      key={shift.id}
                      className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors"
                    >
                      <td className="px-4 py-3 text-center text-[#8e8e93] text-xs font-medium">
                        {(safePage - 1) * rowsPerPage + idx + 1}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#1d1d1f] dark:text-[#ebebf5] text-[13px]">
                        {formatDateTime(shift.openedAt)}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#1d1d1f] dark:text-[#ebebf5] text-[13px]">
                        {shift.status === "open" ? (
                          <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
                            Tură activă
                          </span>
                        ) : shift.closedAt ? (
                          formatDateTime(shift.closedAt)
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-[13.5px]">
                        {formatCurrency(Number(shift.totalSales), "RON")}
                      </td>
                      <td className="px-4 py-3 text-right text-[#6e6e73] dark:text-[#98989d] text-[13px]">
                        {formatCurrency(Number(shift.totalCard), "RON")}
                      </td>
                      <td className="px-4 py-3 text-right text-[#6e6e73] dark:text-[#98989d] text-[13px]">
                        {formatCurrency(expected, "RON")}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {shift.status === "open" ? (
                          <span className="text-[#8e8e93]">—</span>
                        ) : (
                          <div className="flex flex-col items-end gap-0.5">
                            <span
                              className={
                                isDiff
                                  ? "text-[#ff3b30] dark:text-[#ff453a]"
                                  : "text-emerald-700 dark:text-emerald-300"
                              }
                            >
                              {formatCurrency(actual, "RON")}
                            </span>
                            {isDiff && (
                              <span className="text-[10px] text-[#d70015] dark:text-[#ff6961] bg-[#ff3b30]/10 px-2 py-0.5 rounded-full">
                                Dif: {diff > 0 ? "+" : ""}
                                {formatCurrency(diff, "RON")}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 sm:px-5 py-3 border-t border-black/[0.05] dark:border-white/[0.07] flex items-center justify-between bg-[#fafafa] dark:bg-white/[0.02] text-xs text-[#6e6e73] dark:text-[#98989d] tabular-nums">
            <span>
              Pagina {safePage} din {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="apple-btn-glass w-7 h-7 flex items-center justify-center text-[#1d1d1f] dark:text-[#f5f5f7] disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="apple-btn-glass w-7 h-7 flex items-center justify-center text-[#1d1d1f] dark:text-[#f5f5f7] disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
