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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
            <Calculator className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Închidere de Zi (Z)
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
              Management Ture, Fond Sertar & Raport Z
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {locations.length > 1 && (
            <select
              value={locationId}
              onChange={e => setSelectedLocationId(Number(e.target.value))}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3 py-2 rounded-lg text-sm font-medium focus:outline-none focus:border-blue-500 shadow-sm"
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
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Partea stânga: Tura Curentă */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />{" "}
              Stare Tură
            </h2>
            {currentShift ? (
              <span className="px-2.5 py-1 text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-lg">
                DESCHISĂ
              </span>
            ) : (
              <span className="px-2.5 py-1 text-xs font-bold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 rounded-lg">
                ÎNCHISĂ
              </span>
            )}
          </div>

          <div className="p-5">
            {!currentShift ? (
              <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                  <Lock className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                  Tura este închisă
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                  Deschide tura pentru a permite preluarea de noi comenzi și
                  marcarea bonurilor.
                </p>

                <div className="text-left space-y-3 mb-6 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Fond sertar la deschidere (Cash)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">
                      RON
                    </span>
                    <input
                      type="number"
                      value={startCash}
                      onChange={e => setStartCash(Number(e.target.value))}
                      className="w-full pl-12 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg font-bold text-lg text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  onClick={() => openMut.mutate({ locationId, startCash })}
                  disabled={openMut.isPending}
                  className="w-full flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors shadow-sm"
                >
                  {openMut.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Play className="w-5 h-5" fill="currentColor" />
                  )}
                  Deschide Tura
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Deschisă la
                    </p>
                    <p className="font-bold text-slate-900 dark:text-white">
                      {formatDateTime(currentShift.openedAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Fond inițial
                    </p>
                    <p className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(Number(currentShift.startCash), "RON")}
                    </p>
                  </div>
                </div>

                {!isClosing ? (
                  <button
                    onClick={() => setIsClosing(true)}
                    className="w-full flex justify-center items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors shadow-sm mt-4"
                  >
                    <Square className="w-5 h-5" fill="currentColor" />
                    Închide Ziua (Z)
                  </button>
                ) : (
                  <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-4 rounded-xl mt-4 animate-in fade-in zoom-in duration-200">
                    <h3 className="font-bold text-red-900 dark:text-red-400 mb-2">
                      Confirmare Închidere Z
                    </h3>
                    <p className="text-sm text-red-800 dark:text-red-300 mb-4">
                      Numără banii din sertar. Sistemul va calcula automat
                      diferențele.
                    </p>

                    <div className="space-y-3 mb-4">
                      <div>
                        <label className="block text-xs font-bold uppercase text-red-800 dark:text-red-300 mb-1">
                          Total Cash Numărat (RON)
                        </label>
                        <input
                          type="number"
                          value={actualCash}
                          onChange={e => setActualCash(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-500/30 rounded-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase text-red-800 dark:text-red-300 mb-1">
                          Note (opțional)
                        </label>
                        <input
                          type="text"
                          value={notes}
                          onChange={e => setNotes(e.target.value)}
                          placeholder="Motiv eventuale diferențe..."
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-500/30 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsClosing(false)}
                        className="flex-1 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-500/30 text-slate-700 dark:text-slate-300 font-bold py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
                      >
                        Anulează
                      </button>
                      <button
                        onClick={() =>
                          closeMut.mutate({
                            id: currentShift.id,
                            endCashActual: actualCash,
                            notes,
                          })
                        }
                        disabled={closeMut.isPending}
                        className="flex-1 flex justify-center items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-lg"
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
        <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 p-4 rounded-xl text-sm text-blue-800 dark:text-blue-300 flex gap-3 shadow-sm">
          <Banknote className="w-5 h-5 flex-shrink-0" />
          <p>
            La închiderea zilei (Raport Z), sistemul compară{" "}
            <strong>Fondul inițial + Vânzările Cash</strong> cu banii fizici
            numărați în sertar. Odată închisă tura, comenzile aferente sunt
            blocate împotriva modificărilor.
          </p>
        </div>
      </div>

      {/* Partea dreaptă: Istoric Ture */}
      <div className="lg:col-span-2">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600 dark:text-blue-400" />{" "}
              Istoric Ture & Rapoarte Z
            </h2>
            <div className="text-sm font-medium text-slate-500 bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
              Total: {pastShifts.length}
            </div>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <tr className="text-slate-600 dark:text-slate-400 text-left font-semibold">
                  <th className="px-4 py-3 text-center text-xs uppercase tracking-wider w-12">
                    Nr.
                  </th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wider">
                    Deschidere
                  </th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wider">
                    Închidere (Z)
                  </th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wider text-right">
                    Vânzări
                  </th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wider text-right">
                    Card
                  </th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wider text-right">
                    Cash Așteptat
                  </th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wider text-right">
                    Cash Numărat
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
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
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-center text-slate-400 font-medium">
                        {(safePage - 1) * rowsPerPage + idx + 1}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                        {formatDateTime(shift.openedAt)}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                        {shift.status === "open" ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            Tură Activă
                          </span>
                        ) : shift.closedAt ? (
                          formatDateTime(shift.closedAt)
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-blue-600 dark:text-blue-400">
                        {formatCurrency(Number(shift.totalSales), "RON")}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                        {formatCurrency(Number(shift.totalCard), "RON")}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                        {formatCurrency(expected, "RON")}
                      </td>
                      <td className="px-4 py-3 text-right font-bold">
                        {shift.status === "open" ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <div className="flex flex-col items-end">
                            <span
                              className={
                                isDiff
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-emerald-600 dark:text-emerald-400"
                              }
                            >
                              {formatCurrency(actual, "RON")}
                            </span>
                            {isDiff && (
                              <span className="text-[10px] text-red-500 bg-red-50 dark:bg-red-500/10 px-1.5 rounded">
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

          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80">
            <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">
              Pagina {safePage} din {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
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
