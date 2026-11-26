// NirSelectorModal.tsx — Modal selecție produse din NIR
import { useState, useMemo } from "react";
import { usePersistentRowsPerPage } from "@/hooks/usePersistentRowsPerPage";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Package,
  Check,
  Plus,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

interface SelectedLine {
  nirId: number;
  nirNumber: string;
  lineId: number;
  nirLineId: number; // pentru consumeLine
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}

interface Props {
  onClose: () => void;
  onAdd: (lines: SelectedLine[]) => void;
}

export default function NirSelectorModal({ onClose, onAdd }: Props) {
  const { data: nirList = [], isLoading } = trpc.nir.listWithLines.useQuery();

  const [search, setSearch] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = usePersistentRowsPerPage("nir_selector_modal", 15);
  const [expandedNir, setExpandedNir] = useState<number | null>(null);

  // Flatten all lines with NIR info for search
  const allLines = useMemo(() => {
    return nirList.flatMap(n =>
      n.lines.map(l => {
        const receptat = parseFloat(String(l.cantitateReceptionata || 0));
        const consumed = parseFloat(String((l as any).consumedQty || 0));
        const remaining = Math.max(0, receptat - consumed);
        return {
          nirId: n.id,
          nirNumber: n.nirNumber,
          nirDate: n.receiptDate,
          nirSupplier: n.supplierName || "—",
          lineId: l.id,
          nirLineId: l.id,
          description: l.description,
          unit: l.unit || "buc",
          quantity: receptat,
          remaining,
          consumed,
          isConsumed: remaining <= 0,
          unitPrice: parseFloat(String(l.unitPrice || 0)),
          vatRate: parseFloat(String(l.vatRate || 21)),
          total: parseFloat(String(l.total || 0)),
        };
      })
    );
  }, [nirList]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allLines;
    const q = search
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return allLines.filter(l => {
      const hay = `${l.description} ${l.nirNumber} ${l.nirSupplier}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return hay.includes(q);
    });
  }, [allLines, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const paginated = filtered.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  const key = (l: (typeof allLines)[0]) => `${l.nirId}-${l.lineId}`;

  const toggleLine = (l: (typeof allLines)[0]) => {
    const k = key(l);
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const toggleAll = () => {
    if (paginated.every(l => selectedKeys.has(key(l)))) {
      setSelectedKeys(prev => {
        const next = new Set(prev);
        paginated.forEach(l => next.delete(key(l)));
        return next;
      });
    } else {
      setSelectedKeys(prev => {
        const next = new Set(prev);
        paginated.forEach(l => next.add(key(l)));
        return next;
      });
    }
  };

  const handleAdd = () => {
    const toAdd = allLines.filter(l => selectedKeys.has(key(l)));
    onAdd(toAdd);
    onClose();
  };

  const allPageSelected =
    paginated.length > 0 && paginated.every(l => selectedKeys.has(key(l)));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm p-4 overscroll-contain"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-[#1c1c1e] rounded-[20px] shadow-2xl border border-black/[0.08] dark:border-white/[0.10] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[10px] bg-[#0071e3]/10 dark:bg-[#0a84ff]/18 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4 text-[#0071e3] dark:text-[#0a84ff]" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
                Adaugă din stoc
              </h2>
              <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d] tabular-nums">
                {allLines.length} produse din {nirList.length} NIR-uri
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="apple-btn-glass w-8 h-8 flex items-center justify-center rounded-full text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-black/[0.05] dark:border-white/[0.07] bg-[#fafafa] dark:bg-white/[0.02]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              style={{
                paddingLeft: 34,
                paddingRight: search ? 84 : 16,
              }}
              className="apple-pill-control rounded-full w-full h-9 text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none focus:bg-white dark:focus:bg-[#2c2c2e]"
              placeholder="Caută produs, NIR, furnizor..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            {search && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-black/[0.07] dark:bg-white/[0.14] text-[#1d1d1f] dark:text-white rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums whitespace-nowrap">
                {filtered.length} / {allLines.length}
              </span>
            )}
          </div>
        </div>

        {/* Tabel */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-[#6e6e73] dark:text-[#98989d] text-sm">
              Se încarcă NIR-urile...
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-[#fafafa] dark:bg-[#242426] border-b border-black/[0.05] dark:border-white/[0.07]">
                <tr>
                  <th className="w-10 text-center py-3 px-2">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded cursor-pointer"
                    />
                  </th>
                  <th className="w-11 text-center py-3 px-2 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                    Nr.
                  </th>
                  <th className="py-3 px-3 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                    Descriere
                  </th>
                  <th className="w-32 py-3 px-3 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                    NIR / Furnizor
                  </th>
                  <th className="w-16 py-3 px-2 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                    UM
                  </th>
                  <th className="w-20 py-3 px-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                    Cant.
                  </th>
                  <th className="w-24 py-3 px-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                    Preț/UM
                  </th>
                  <th className="w-24 py-3 px-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                    Total RON
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
                {paginated.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="text-center py-12 px-4 text-[#6e6e73] dark:text-[#98989d] text-[13px]"
                    >
                      {search
                        ? "Niciun produs găsit pentru căutarea ta."
                        : "Nu există NIR-uri înregistrate."}
                    </td>
                  </tr>
                ) : (
                  paginated.map((l, i) => {
                    const k = key(l);
                    const isSelected = selectedKeys.has(k);
                    const isConsumed = (l as any).isConsumed;
                    const remaining = (l as any).remaining ?? l.quantity;
                    return (
                      <tr
                        key={k}
                        onClick={() => !isConsumed && toggleLine(l)}
                        className={`transition-colors ${
                          isConsumed
                            ? "bg-[#ff3b30]/[0.04] dark:bg-[#ff453a]/[0.08] cursor-not-allowed opacity-70"
                            : isSelected
                              ? "bg-[#0071e3]/[0.06] dark:bg-[#0a84ff]/[0.14] cursor-pointer"
                              : "hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] cursor-pointer"
                        }`}
                      >
                        <td className="text-center py-2.5 px-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isConsumed}
                            onChange={() => !isConsumed && toggleLine(l)}
                            onClick={e => e.stopPropagation()}
                            className="w-4 h-4 rounded cursor-pointer"
                          />
                        </td>
                        <td className="text-center py-2.5 px-2 text-[#8e8e93] tabular-nums">
                          {(page - 1) * rowsPerPage + i + 1}
                        </td>
                        <td
                          className={`py-2.5 px-3 ${
                            isSelected ? "font-semibold" : "font-normal"
                          }`}
                        >
                          <span
                            className={
                              isConsumed
                                ? "line-through text-[#ff3b30] dark:text-[#ff453a]"
                                : "text-[#1d1d1f] dark:text-[#f5f5f7]"
                            }
                          >
                            {l.description}
                          </span>
                          {isConsumed && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#ff3b30]/10 text-[#d70015] dark:bg-[#ff453a]/18 dark:text-[#ff6961]">
                              Consumat
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="text-[#0071e3] dark:text-[#64d2ff] tabular-nums font-semibold text-[11px]">
                            {l.nirNumber}
                          </div>
                          <div className="text-[#6e6e73] dark:text-[#98989d] text-[11px] truncate max-w-[140px]">
                            {(l as any).nirSupplier}
                          </div>
                        </td>
                        <td className="text-center py-2.5 px-2 text-[#6e6e73] dark:text-[#98989d]">
                          {l.unit}
                        </td>
                        <td className="text-right py-2.5 px-3 font-semibold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">
                          {isConsumed ? (
                            <span className="text-[#ff3b30] dark:text-[#ff453a] font-bold">0</span>
                          ) : (
                            <span>{remaining.toFixed(2)}</span>
                          )}
                          {!isConsumed && (l as any).consumed > 0 && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 ml-1">
                              /{l.quantity.toFixed(0)}
                            </span>
                          )}
                        </td>
                        <td className="text-right py-2.5 px-3 tabular-nums text-[#1d1d1f] dark:text-[#ebebf5]">
                          {l.unitPrice.toFixed(2)}
                        </td>
                        <td className="text-right py-2.5 px-3 font-semibold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">
                          {l.total > 0
                            ? l.total.toFixed(2)
                            : (l.quantity * l.unitPrice).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer paginare + acțiuni */}
        <div className="px-5 py-3 border-t border-black/[0.06] dark:border-white/[0.08] bg-[#fafafa] dark:bg-white/[0.025] flex items-center justify-between flex-wrap gap-2.5 text-xs text-[#6e6e73] dark:text-[#98989d]">
          {/* Stânga: paginare */}
          <div className="flex items-center gap-3 flex-wrap tabular-nums">
            <span className="whitespace-nowrap inline-flex items-center gap-1.5">
              <span>Afișează</span>
              <select
                value={rowsPerPage}
                onChange={e => {
                  setRowsPerPage(Number(e.target.value));
                  setPage(1);
                }}
                className="apple-pill-control h-7 px-2.5 text-xs text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={9999}>Toți</option>
              </select>
            </span>
            <span className="whitespace-nowrap">
              Total: <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">{filtered.length}</strong> produse
            </span>
            <div className="flex items-center gap-1">
              <span className="whitespace-nowrap mr-1">
                Pagina {page} din {totalPages}
              </span>
              <button
                type="button"
                className="apple-btn-glass w-7 h-7 flex items-center justify-center text-[#1d1d1f] dark:text-[#f5f5f7] disabled:opacity-40 cursor-pointer"
                onClick={() => setPage(p => p - 1)}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="apple-btn-glass w-7 h-7 flex items-center justify-center text-[#1d1d1f] dark:text-[#f5f5f7] disabled:opacity-40 cursor-pointer"
                onClick={() => setPage(p => p + 1)}
                disabled={page === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Dreapta: buton adaugă */}
          <div className="flex items-center gap-2">
            {selectedKeys.size > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0071e3]/10 dark:bg-[#0a84ff]/18 text-[#0071e3] dark:text-[#64d2ff] text-xs font-semibold tabular-nums">
                <Check className="w-3 h-3" />
                {selectedKeys.size} selectate
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="apple-btn-glass px-4 h-8 text-xs font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
            >
              Anulează
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={selectedKeys.size === 0}
              className="apple-btn-prominent flex items-center gap-1.5 px-4 h-8 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Adaugă {selectedKeys.size > 0 ? `(${selectedKeys.size})` : ""} în
              factură
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
