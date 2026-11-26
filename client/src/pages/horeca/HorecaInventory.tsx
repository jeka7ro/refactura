import { useState, useEffect } from "react";
import { usePersistentRowsPerPage } from "@/hooks/usePersistentRowsPerPage";
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
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="apple-surface p-8 text-center">
        <p className="text-[#6e6e73] dark:text-[#98989d] text-sm">
          Nu ai definit nicio locație. Creează una din Setări.
        </p>
      </div>
    );
  }

  if (!selectedLocationId) {
    return null;
  }

  return (
    <div className="space-y-4 max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-0.5">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
            Gestiune & stocuri
          </h1>
          <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
            Inventarul materiilor prime. Stocurile se deduc automat la
            vânzarea produselor prin rețetar.
          </p>
        </div>
        <div className="relative self-start sm:self-auto">
          <select
            value={selectedLocationId || ""}
            onChange={e => {
              const val = e.target.value;
              setSelectedLocationId(val.startsWith("bridge-") ? (val as any) : Number(val));
            }}
            className="apple-pill-control pl-3.5 pr-8 h-[34px] text-[12.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] min-w-[180px] appearance-none cursor-pointer focus:outline-none"
          >
            {locations.map(loc => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      <InventoryDashboard locationId={selectedLocationId} />
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
  const [rowsPerPage, setRowsPerPage] = usePersistentRowsPerPage("horeca_inventory", 15);

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
    <div className="space-y-4 relative">
      {!isEditing && !isAddingStock && (
        <div className="apple-surface px-3 py-2.5 flex flex-wrap gap-2.5 items-center justify-between">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              style={{
                paddingLeft: 34,
                paddingRight: searchTerm ? 80 : 16,
              }}
              className="apple-pill-control rounded-full w-full h-[34px] text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none focus:bg-white dark:focus:bg-[#2c2c2e]"
              placeholder="Caută materie primă..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
            />
            {searchTerm && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-black/[0.07] dark:bg-white/[0.14] text-[#1d1d1f] dark:text-white rounded-full px-2 py-0.5 text-[10.5px] font-semibold tabular-nums whitespace-nowrap">
                {filtered.length} / {ingredients.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsEditing({})}
            className="apple-btn-prominent inline-flex items-center gap-1.5 text-white px-4 h-[34px] font-semibold text-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Materie primă nouă
          </button>
        </div>
      )}

      <div>
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="apple-surface overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#fafafa] dark:bg-white/[0.025] text-[#6e6e73] dark:text-[#98989d] font-medium text-[12px] border-b border-black/[0.05] dark:border-white/[0.07]">
                  <tr>
                    <th className="px-4 py-3 w-12 text-center font-medium">Nr.</th>
                    <th className="px-4 py-3 font-medium">Denumire</th>
                    <th className="px-4 py-3 font-medium">Stoc curent</th>
                    <th className="px-4 py-3 font-medium">Cost unitar</th>
                    <th className="px-4 py-3 font-medium">Valoare stoc</th>
                    <th className="px-4 py-3 font-medium text-right">Acțiuni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06] tabular-nums">
                  {paginatedItems.map((item, index) => (
                    <tr
                      key={item.id}
                      className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors"
                    >
                      <td className="px-4 py-3 text-center text-[#8e8e93] text-xs font-medium">
                        {(page - 1) * rowsPerPage + index + 1}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-[13.5px]">
                        {item.name}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {Number(item.currentStock).toFixed(2)} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-[#6e6e73] dark:text-[#98989d]">
                        {formatCurrency(Number(item.unitCost || 0), "RON")} / {item.unit}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#1d1d1f] dark:text-[#ebebf5]">
                        {formatCurrency(
                          Number(item.currentStock) * Number(item.unitCost || 0),
                          "RON"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setIsAddingStock(item)}
                            className="inline-flex items-center gap-1.5 px-3 h-8 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/18 dark:bg-emerald-500/18 dark:text-emerald-300 rounded-full text-xs font-semibold transition-colors border border-emerald-500/20 cursor-pointer"
                          >
                            <ArrowDownToLine className="w-3.5 h-3.5" />
                            Recepție stoc (NIR)
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditing(item)}
                            className="apple-btn-glass px-3.5 h-8 text-[#1d1d1f] dark:text-[#f5f5f7] text-xs font-medium cursor-pointer"
                          >
                            Editează
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginatedItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-[#6e6e73] dark:text-[#98989d] text-[13px]">
                        Nu s-au găsit date.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* FOOTER PAGINARE */}
            <div className="px-4 sm:px-5 py-3 border-t border-black/[0.05] dark:border-white/[0.07] flex items-center justify-between flex-wrap gap-2 bg-[#fafafa] dark:bg-white/[0.02] text-xs text-[#6e6e73] dark:text-[#98989d] tabular-nums">
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <span>Afișează</span>
                  <div className="relative inline-block">
                    <select
                      value={rowsPerPage}
                      onChange={e => {
                        setRowsPerPage(Number(e.target.value));
                        setPage(1);
                      }}
                      className="apple-pill-control appearance-none pl-3 pr-7 h-7 text-xs text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                    >
                      <option value={10}>10</option>
                      <option value={15}>15</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={ingredients.length || 9999}>Toți</option>
                    </select>
                    <ChevronDown className="w-3 h-3 text-[#6e6e73] dark:text-[#98989d] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </span>
                <span className="whitespace-nowrap">
                  Total înregistrări: <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">{total}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="whitespace-nowrap">Pagina {page} din {totalPages}</span>
                <button
                  type="button"
                  className="apple-btn-glass w-7 h-7 flex items-center justify-center text-[#1d1d1f] dark:text-[#f5f5f7] disabled:opacity-40 cursor-pointer"
                  onClick={() => setPage(p => p - 1)}
                  disabled={page === 1}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <button
                  type="button"
                  className="apple-btn-glass w-7 h-7 flex items-center justify-center text-[#1d1d1f] dark:text-[#f5f5f7] disabled:opacity-40 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm p-4 overscroll-contain">
          <form
            onSubmit={handleSaveIngredient}
            className="bg-white dark:bg-[#1c1c1e] rounded-[20px] shadow-2xl w-full max-w-md overflow-hidden border border-black/[0.08] dark:border-white/[0.10]"
          >
            <div className="p-5 border-b border-black/[0.06] dark:border-white/[0.08] bg-[#fafafa] dark:bg-white/[0.025]">
              <h3 className="font-bold text-[16px] text-[#1d1d1f] dark:text-[#f5f5f7]">
                {isEditing.id ? "Editează materia primă" : "Adaugă materie primă nouă"}
              </h3>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">
                  Denumire (ex: Făină albă, Piept de pui)
                </label>
                <input
                  name="name"
                  defaultValue={isEditing.name}
                  required
                  autoFocus
                  className="apple-input w-full h-10 px-3.5 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">
                    Unitate măsură
                  </label>
                  <select
                    name="unit"
                    defaultValue={isEditing.unit || "kg"}
                    className="apple-input w-full h-10 px-3.5 text-sm cursor-pointer"
                  >
                    <option value="kg">Kilo (kg)</option>
                    <option value="g">Grame (g)</option>
                    <option value="l">Litri (l)</option>
                    <option value="ml">Mili (ml)</option>
                    <option value="buc">Bucăți</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">
                    Cost unitar aprox. (RON)
                  </label>
                  <input
                    name="unitCost"
                    type="number"
                    step="0.01"
                    defaultValue={isEditing.unitCost || 0}
                    required
                    className="apple-input w-full h-10 px-3.5 text-sm tabular-nums"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 bg-[#fafafa] dark:bg-white/[0.025] border-t border-black/[0.06] dark:border-white/[0.08] flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsEditing(null)}
                className="apple-btn-glass px-4 h-9 text-xs font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
              >
                Anulează
              </button>
              <button
                type="submit"
                disabled={upsertMut.isPending}
                className="apple-btn-prominent px-5 h-9 text-white text-xs font-semibold cursor-pointer"
              >
                {upsertMut.isPending ? "Se salvează..." : "Salvează"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL ADAUGA STOC (RECEPTIE) */}
      {isAddingStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm p-4 overscroll-contain">
          <form
            onSubmit={handleAddStock}
            className="bg-white dark:bg-[#1c1c1e] rounded-[20px] shadow-2xl w-full max-w-md overflow-hidden border border-black/[0.08] dark:border-white/[0.10]"
          >
            <div className="p-5 border-b border-emerald-500/20 bg-emerald-500/10">
              <h3 className="font-bold text-[16px] text-emerald-800 dark:text-emerald-300">
                Recepție nouă (intrare stoc)
              </h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums">
                Produs: <strong>{isAddingStock.name}</strong> (Stoc actual:{" "}
                {Number(isAddingStock.currentStock).toFixed(2)}{" "}
                {isAddingStock.unit})
              </p>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">
                    Cantitate intrată ({isAddingStock.unit})
                  </label>
                  <input
                    name="quantity"
                    type="number"
                    step="0.0001"
                    required
                    autoFocus
                    className="apple-input w-full h-10 px-3.5 text-base font-bold tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">
                    Cost de achiziție nou (RON)
                  </label>
                  <input
                    name="unitCost"
                    type="number"
                    step="0.01"
                    defaultValue={isAddingStock.unitCost}
                    required
                    className="apple-input w-full h-10 px-3.5 text-sm font-semibold tabular-nums"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">
                  Referință document (Nr. factură / NIR)
                </label>
                <input
                  name="reference"
                  placeholder="ex: F12345"
                  className="apple-input w-full h-10 px-3.5 text-sm"
                />
              </div>
            </div>
            <div className="p-4 bg-[#fafafa] dark:bg-white/[0.025] border-t border-black/[0.06] dark:border-white/[0.08] flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsAddingStock(null)}
                className="apple-btn-glass px-4 h-9 text-xs font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
              >
                Anulează
              </button>
              <button
                type="submit"
                disabled={addStockMut.isPending}
                className="apple-btn-prominent px-5 h-9 text-white text-xs font-semibold cursor-pointer"
              >
                {addStockMut.isPending ? "Se adaugă..." : "Confirmă recepția"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
