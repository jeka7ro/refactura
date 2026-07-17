import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Plus, Box, ArrowDownToLine, Search, ChevronDown } from "lucide-react";
import { formatCurrency } from "@/lib/store";

export default function HorecaInventory() {
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
    null
  );
  const { data: localLocations = [], isLoading: isLoadingLocations } =
    trpc.horeca.locations.list.useQuery();

  const { data: bridgeLocations = [], isLoading: bridgeLoading } =
    trpc.horeca.kioskBridge.listLocations.useQuery(undefined, {
      refetchOnWindowFocus: false,
    });

  const mappedBridgeLocations = bridgeLocations.map((bl: any) => ({
    id: `bridge-${bl.id}`,
    name: bl.name,
  }));

  const locations = [...localLocations, ...mappedBridgeLocations];
  const isLoading = isLoadingLocations || bridgeLoading;

  useEffect(() => {
    if (!selectedLocationId && locations.length > 0) {
      setSelectedLocationId(locations[0].id);
    }
  }, [selectedLocationId, locations]);

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="p-8">
        <p className="text-slate-500">
          Nu ai definit nicio locație. Creează una din Setări.
        </p>
      </div>
    );
  }

  if (!selectedLocationId) {
    return null;
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-950">
      <div className="border-b border-slate-200 dark:border-slate-800 p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
              <Box className="w-6 h-6 text-indigo-500" />
              Gestiune & Stocuri
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Inventarul materiilor prime. Stocurile se deduc automat la
              vânzarea produselor prin rețetar.
            </p>
          </div>
          <div className="relative">
            <select
              value={selectedLocationId || ""}
              onChange={e => {
                const val = e.target.value;
                setSelectedLocationId(val.startsWith('bridge-') ? val as any : Number(val));
              }}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2 font-semibold shadow-sm min-w-[200px] appearance-none cursor-pointer pr-10 focus:outline-none focus:border-indigo-500 !rounded-full"
            >
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <InventoryDashboard locationId={selectedLocationId} />
      </div>
    </div>
  );
}

function InventoryDashboard({ locationId }: { locationId: number }) {
  const utils = trpc.useUtils();
  const { data: ingredients = [], isLoading } =
    trpc.horeca.inventory.listIngredients.useQuery({ locationId });

  const [searchTerm, setSearchTerm] = useState("");
  const [isEditing, setIsEditing] = useState<any>(null);
  const [isAddingStock, setIsAddingStock] = useState<any>(null);

  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(15);

  const upsertMut = trpc.horeca.inventory.upsertIngredient.useMutation({
    onSuccess: () => {
      toast.success("Ingredient salvat!");
      utils.horeca.inventory.listIngredients.invalidate();
      setIsEditing(null);
    },
    onError: e => toast.error(e.message),
  });

  const addStockMut = trpc.horeca.inventory.addStock.useMutation({
    onSuccess: () => {
      toast.success("Stoc actualizat!");
      utils.horeca.inventory.listIngredients.invalidate();
      setIsAddingStock(null);
    },
    onError: e => toast.error(e.message),
  });

  const filtered = ingredients.filter(i =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
  const paginatedItems = filtered.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  function handleSaveIngredient(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    upsertMut.mutate({
      id: isEditing?.id,
      locationId,
      name: fd.get("name") as string,
      unit: fd.get("unit") as string,
      unitCost: Number(fd.get("unitCost")),
    });
  }

  function handleAddStock(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    addStockMut.mutate({
      ingredientId: isAddingStock.id,
      locationId,
      quantity: Number(fd.get("quantity")),
      unitCost: Number(fd.get("unitCost")),
      reference: fd.get("reference") as string,
    });
  }

  return (
    <div className="flex flex-col h-full relative">
      {!isEditing && !isAddingStock && (
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-4 items-center justify-between">
          <div style={{ position: "relative" }} className="w-full max-w-sm">
            <Search
              className="w-4 h-4 text-slate-400"
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 1,
              }}
            />
            <input
              className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-all"
              style={{
                paddingLeft: 36,
                paddingRight: searchTerm ? 80 : 16,
                paddingTop: 8,
                paddingBottom: 8,
                borderRadius: 9999,
              }}
              placeholder="Caută materie primă..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
            />
            {searchTerm && (
              <div
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "#6366f1",
                  color: "white",
                  borderRadius: 9999,
                  padding: "2px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {filtered.length} / {ingredients.length}
              </div>
            )}
          </div>
          <button
            onClick={() => setIsEditing({})}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Materie Primă Nouă
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-sm flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th style={{ width: 50, textAlign: "center" }} className="px-4 py-3">Nr.</th>
                    <th className="px-4 py-3">Denumire</th>
                    <th className="px-4 py-3">Stoc Curent</th>
                    <th className="px-4 py-3">Cost Unitar</th>
                    <th className="px-4 py-3">Valoare Stoc</th>
                    <th className="px-4 py-3 text-right">Acțiuni</th>
                  </tr>
                </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {paginatedItems.map((item, index) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td style={{ textAlign: 'center', color: '#64748b', fontSize: 13 }} className="px-4 py-3">
                      {(page - 1) * rowsPerPage + index + 1}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      {item.name}
                    </td>
                    <td className="px-4 py-3 font-black text-indigo-600 dark:text-indigo-400">
                      {Number(item.currentStock).toFixed(2)} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {formatCurrency(Number(item.unitCost || 0), "RON")} / {item.unit}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                      {formatCurrency(
                        Number(item.currentStock) * Number(item.unitCost || 0),
                        "RON"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setIsAddingStock(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20 rounded-lg text-xs font-bold transition-colors border border-emerald-200 dark:border-emerald-500/30"
                        >
                          <ArrowDownToLine className="w-3.5 h-3.5" />
                          Recepție Stoc (NIR)
                        </button>
                        <button
                          onClick={() => setIsEditing(item)}
                          className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg text-xs font-bold transition-colors border border-slate-200 dark:border-slate-700"
                        >
                          Editează
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {paginatedItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500">
                      Nu s-au găsit date.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>

            {/* FOOTER PAGINARE */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color, #e2e8f0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-secondary, #f8fafc)', borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }} className="text-sm text-slate-600 dark:text-slate-400">
                <span style={{ whiteSpace: 'nowrap' }} className="relative inline-block">
                  Afișează&nbsp;
                  <select 
                    value={rowsPerPage} 
                    onChange={e => {
                      setRowsPerPage(Number(e.target.value));
                      setPage(1);
                    }} 
                    style={{ background: 'transparent', padding: '2px 24px 2px 12px' }}
                    className="dark:border-slate-700 dark:bg-slate-800 dark:text-white appearance-none cursor-pointer focus:outline-none border border-slate-300 rounded-full"
                  >
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={ingredients.length}>Toți</option>
                  </select>
                  <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </span>
                <span style={{ whiteSpace: 'nowrap' }}>Total înregistrări: <strong className="text-slate-900 dark:text-white">{total}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} className="text-sm text-slate-600 dark:text-slate-400">
                <span style={{ whiteSpace: 'nowrap' }}>Pagina {page} din {totalPages}</span>
                <button 
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full disabled:opacity-50 transition-colors" 
                  onClick={() => setPage(p => p - 1)} 
                  disabled={page === 1}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <button 
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full disabled:opacity-50 transition-colors" 
                  onClick={() => setPage(p => p + 1)} 
                  disabled={page === totalPages}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL ADAUGA/EDITEAZA INGREDIENT */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSaveIngredient}
            className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800"
          >
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                {isEditing.id ? "Editează Materia Primă" : "Adaugă Materie Primă Nouă"}
              </h3>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Denumire (ex: Făină Albă, Piept de pui)
                </label>
                <input
                  name="name"
                  defaultValue={isEditing.name}
                  required
                  autoFocus
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    Unitate Măsură
                  </label>
                  <select
                    name="unit"
                    defaultValue={isEditing.unit || "kg"}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white"
                  >
                    <option value="kg">Kilo (kg)</option>
                    <option value="g">Grame (g)</option>
                    <option value="l">Litri (l)</option>
                    <option value="ml">Mili (ml)</option>
                    <option value="buc">Bucăți</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    Cost Unitar Aprox. (RON)
                  </label>
                  <input
                    name="unitCost"
                    type="number"
                    step="0.01"
                    defaultValue={isEditing.unitCost || 0}
                    required
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsEditing(null)}
                className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Anulează
              </button>
              <button
                type="submit"
                disabled={upsertMut.isPending}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm"
              >
                {upsertMut.isPending ? "Se salvează..." : "Salvează"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL ADAUGA STOC (RECEPTIE) */}
      {isAddingStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <form
            onSubmit={handleAddStock}
            className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800"
          >
            <div className="p-5 border-b border-emerald-100 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10">
              <h3 className="font-bold text-lg text-emerald-800 dark:text-emerald-400">
                Recepție Nouă (Intrare Stoc)
              </h3>
              <p className="text-sm text-emerald-600 dark:text-emerald-500 mt-1">
                Produs: <strong>{isAddingStock.name}</strong> (Stoc actual:{" "}
                {Number(isAddingStock.currentStock).toFixed(2)}{" "}
                {isAddingStock.unit})
              </p>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    Cantitate Intrată ({isAddingStock.unit})
                  </label>
                  <input
                    name="quantity"
                    type="number"
                    step="0.0001"
                    required
                    autoFocus
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-lg font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    Cost de Achiziție Nou (RON)
                  </label>
                  <input
                    name="unitCost"
                    type="number"
                    step="0.01"
                    defaultValue={isAddingStock.unitCost}
                    required
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-sm font-semibold text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Referință Document (Nr. Factură / NIR)
                </label>
                <input
                  name="reference"
                  placeholder="ex: F12345"
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsAddingStock(null)}
                className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Anulează
              </button>
              <button
                type="submit"
                disabled={addStockMut.isPending}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg shadow-sm"
              >
                {addStockMut.isPending ? "Se adaugă..." : "Confirmă Recepția"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
