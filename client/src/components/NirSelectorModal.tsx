// NirSelectorModal.tsx — Modal selecție produse din NIR
import { useState, useMemo } from "react";
import { Search, X, ChevronLeft, ChevronRight, Package, Check, Plus } from "lucide-react";
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
  const [rowsPerPage, setRowsPerPage] = useState(15);
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
    const q = search.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return allLines.filter(l => {
      const hay = `${l.description} ${l.nirNumber} ${l.nirSupplier}`.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return hay.includes(q);
    });
  }, [allLines, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const paginated = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const key = (l: typeof allLines[0]) => `${l.nirId}-${l.lineId}`;

  const toggleLine = (l: typeof allLines[0]) => {
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

  const allPageSelected = paginated.length > 0 && paginated.every(l => selectedKeys.has(key(l)));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-4xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center">
              <Package className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Adaugă din NIR</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {allLines.length} produse din {nirList.length} NIR-uri
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800">
          <div style={{ position: "relative" }}>
            <Search className="w-4 h-4 text-slate-400" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", zIndex: 1 }} />
            <input
              className="glass-input w-full"
              style={{ paddingLeft: 36, paddingRight: search ? 80 : 16, borderRadius: 9999 }}
              placeholder="Caută produs, NIR, furnizor..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
            {search && (
              <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "var(--accent)", color: "white", borderRadius: 9999, padding: "2px 10px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
                {filtered.length} / {allLines.length}
              </div>
            )}
          </div>
        </div>

        {/* Tabel */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Se încarcă NIR-urile...</div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <th style={{ width: 40, textAlign: "center", padding: "10px 8px" }}>
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleAll}
                      className="w-3.5 h-3.5"
                      style={{ accentColor: "var(--accent)" }}
                    />
                  </th>
                  <th style={{ width: 42, textAlign: "center", padding: "10px 8px", color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Nr.</th>
                  <th style={{ padding: "10px 8px", textAlign: "left", color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Descriere</th>
                  <th style={{ width: 90, padding: "10px 8px", textAlign: "left", color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>NIR / Furnizor</th>
                  <th style={{ width: 60, padding: "10px 8px", textAlign: "center", color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>UM</th>
                  <th style={{ width: 80, padding: "10px 8px", textAlign: "right", color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Cant.</th>
                  <th style={{ width: 90, padding: "10px 8px", textAlign: "right", color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Preț/UM</th>
                  <th style={{ width: 90, padding: "10px 8px", textAlign: "right", color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total RON</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-secondary)", fontSize: 13 }}>
                      {search ? "Niciun produs găsit pentru căutarea ta." : "Nu există NIR-uri înregistrate."}
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
                        className={`border-b border-slate-100 dark:border-slate-800 transition-colors ${
                          isConsumed
                            ? "bg-red-50 dark:bg-red-950/20 cursor-not-allowed opacity-70"
                            : isSelected
                              ? "bg-sky-50 dark:bg-sky-900/20 cursor-pointer"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                        }`}
                      >
                        <td style={{ textAlign: "center", padding: "8px" }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isConsumed}
                            onChange={() => !isConsumed && toggleLine(l)}
                            onClick={e => e.stopPropagation()}
                            className="w-3.5 h-3.5"
                            style={{ accentColor: "var(--accent)" }}
                          />
                        </td>
                        <td style={{ textAlign: "center", padding: "8px", color: "var(--text-secondary)" }}>
                          {(page - 1) * rowsPerPage + i + 1}
                        </td>
                        <td style={{ padding: "8px", fontWeight: isSelected ? 600 : 400 }}>
                          <span className={isConsumed ? "line-through text-red-500 dark:text-red-400" : "text-slate-900 dark:text-white"}>
                            {l.description}
                          </span>
                          {isConsumed && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
                              CONSUMAT
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "8px" }}>
                          <div className="text-sky-700 dark:text-sky-400 font-mono font-bold text-[10px]">{l.nirNumber}</div>
                          <div className="text-slate-400 text-[10px]">{(l as any).nirSupplier}</div>
                        </td>
                        <td style={{ textAlign: "center", padding: "8px", color: "var(--text-secondary)" }}>{l.unit}</td>
                        <td style={{ textAlign: "right", padding: "8px", fontWeight: 600 }}>
                          {isConsumed ? (
                            <span className="text-red-500 font-bold">0</span>
                          ) : (
                            <span>{remaining.toFixed(2)}</span>
                          )}
                          {!isConsumed && (l as any).consumed > 0 && (
                            <span className="text-[10px] text-orange-500 ml-1">/{l.quantity.toFixed(0)}</span>
                          )}
                        </td>
                        <td style={{ textAlign: "right", padding: "8px" }}>{l.unitPrice.toFixed(2)}</td>
                        <td style={{ textAlign: "right", padding: "8px", fontWeight: 700 }}>{l.total > 0 ? l.total.toFixed(2) : (l.quantity * l.unitPrice).toFixed(2)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer paginare + acțiuni */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-secondary)", borderBottomLeftRadius: 12, borderBottomRightRadius: 12, flexWrap: "wrap", gap: 8 }}>
          {/* Stânga: paginare */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ whiteSpace: "nowrap", fontSize: 12 }}>
              Afișează&nbsp;
              <select
                value={rowsPerPage}
                onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
                style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 9999, padding: "2px 8px", fontSize: 12 }}
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={9999}>Toți</option>
              </select>
            </span>
            <span style={{ whiteSpace: "nowrap", fontSize: 12 }}>Total: <strong>{filtered.length}</strong> produse</span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 12, whiteSpace: "nowrap" }}>Pagina {page} din {totalPages}</span>
              <button
                className="btn btn-icon btn-ghost"
                onClick={() => setPage(p => p - 1)}
                disabled={page === 1}
                style={{ width: 28, height: 28 }}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                className="btn btn-icon btn-ghost"
                onClick={() => setPage(p => p + 1)}
                disabled={page === totalPages}
                style={{ width: 28, height: 28 }}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Dreapta: buton adaugă */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {selectedKeys.size > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 text-xs font-bold">
                <Check className="w-3 h-3" />
                {selectedKeys.size} selectate
              </span>
            )}
            <button
              onClick={onClose}
              className="px-4 h-8 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Anulează
            </button>
            <button
              onClick={handleAdd}
              disabled={selectedKeys.size === 0}
              className="flex items-center gap-1.5 px-4 h-8 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Adaugă {selectedKeys.size > 0 ? `(${selectedKeys.size})` : ""} în factură
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
