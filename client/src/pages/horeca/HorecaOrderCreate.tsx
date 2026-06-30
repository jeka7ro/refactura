// HorecaOrderCreate — Interfață POS pentru creare comandă nouă
// Design: left panel = meniu categorizat, right panel = coș curent
// UI rules: rounded-lg, no rounded-xl
// Proper Light/Dark mode styling (Premium UI)

import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  ShoppingBag,
  UtensilsCrossed,
  Minus,
  Plus,
  Trash2,
  Check,
  X,
  Loader2,
  ChefHat,
  Truck,
  Package,
  Search,
  Send,
  DollarSign,
  CreditCard,
  Banknote,
  ChevronLeft,
  MapPin,
  StickyNote,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/store";

type OrderType = "dine_in" | "takeaway" | "delivery";

interface CartItem {
  menuItemId: number;
  name: string;
  price: number;
  vatRate: number;
  quantity: number;
  notes: string;
}

const TYPE_OPTS = [
  {
    value: "dine_in",
    label: "La masă",
    icon: UtensilsCrossed,
    color: "bg-blue-600",
  },
  { value: "takeaway", label: "Ridicare", icon: Package, color: "bg-blue-600" },
  { value: "delivery", label: "Delivery", icon: Truck, color: "bg-blue-600" },
];

export default function HorecaOrderCreate() {
  const [, setLocation] = useLocation();
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
    null
  );
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null
  );
  const [selectedTableNumber, setSelectedTableNumber] = useState("");
  const [menuSearch, setMenuSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderNotes, setOrderNotes] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "card" | "mixed" | "voucher"
  >("cash");
  const [staffName, setStaffName] = useState("");

  const { data: locations = [] } = trpc.horeca.locations.list.useQuery();
  const locationId = selectedLocationId ?? locations[0]?.id ?? 0;

  const { data: categories = [] } = trpc.horeca.menu.listCategories.useQuery(
    { locationId },
    { enabled: locationId > 0 }
  );
  const { data: items = [] } = trpc.horeca.menu.listItems.useQuery(
    { locationId, categoryId: selectedCategoryId ?? undefined },
    { enabled: locationId > 0 }
  );
  const { data: tables = [] } = trpc.horeca.tables.list.useQuery(
    { locationId },
    { enabled: locationId > 0 && orderType === "dine_in" }
  );

  const utils = trpc.useUtils();
  const createMut = trpc.horeca.orders.create.useMutation({
    onSuccess: data => {
      toast.success(
        `Comandă ${(data as any).orderNumber} creată și trimisă la bucătărie!`
      );
      utils.horeca.orders.list.invalidate();
      utils.horeca.tables.list.invalidate();
      setLocation("/horeca/comenzi");
    },
    onError: e => toast.error(e.message),
  });

  // Filtrare meniu după search
  const filteredItems = useMemo(() => {
    const channel =
      orderType === "dine_in"
        ? "isAvailableDineIn"
        : orderType === "takeaway"
          ? "isAvailableTakeaway"
          : "isAvailableDelivery";
    const available = items.filter(i => i[channel as keyof typeof i]);
    if (!menuSearch.trim()) return available;
    const q = menuSearch
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return available.filter(i =>
      (i.name || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .includes(q)
    );
  }, [items, orderType, menuSearch]);

  // Cart operations
  function addToCart(item: (typeof items)[0]) {
    setCart(c => {
      const existing = c.find(ci => ci.menuItemId === item.id);
      if (existing)
        return c.map(ci =>
          ci.menuItemId === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      return [
        ...c,
        {
          menuItemId: item.id,
          name: item.name,
          price: Number(item.price),
          vatRate: item.vatRate || 9,
          quantity: 1,
          notes: "",
        },
      ];
    });
  }

  function updateQty(menuItemId: number, delta: number) {
    setCart(c =>
      c
        .map(ci =>
          ci.menuItemId === menuItemId
            ? { ...ci, quantity: Math.max(0, ci.quantity + delta) }
            : ci
        )
        .filter(ci => ci.quantity > 0)
    );
  }

  function removeFromCart(menuItemId: number) {
    setCart(c => c.filter(ci => ci.menuItemId !== menuItemId));
  }

  function updateItemNote(menuItemId: number, note: string) {
    setCart(c =>
      c.map(ci => (ci.menuItemId === menuItemId ? { ...ci, notes: note } : ci))
    );
  }

  // Calcul totale
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const vat = cart.reduce((s, i) => {
    const net = (i.price * i.quantity) / (1 + i.vatRate / 100);
    return s + (i.price * i.quantity - net);
  }, 0);
  const total = subtotal;

  function handleSubmit(sendToKitchen: boolean) {
    if (cart.length === 0) {
      toast.error("Adaugă cel puțin un produs în comandă");
      return;
    }
    if (orderType === "dine_in" && !selectedTableNumber) {
      toast.error("Selectează masa pentru comanda dine-in");
      return;
    }
    createMut.mutate({
      locationId,
      type: orderType,
      tableNumber: selectedTableNumber || undefined,
      staffName: staffName || undefined,
      notes: orderNotes || undefined,
      paymentMethod: showPayment ? paymentMethod : undefined,
      status: showPayment ? "paid" : sendToKitchen ? "sent" : "draft",
      lines: cart.map(ci => ({
        menuItemId: ci.menuItemId,
        name: ci.name,
        quantity: ci.quantity,
        unitPrice: ci.price,
        vatRate: ci.vatRate,
        notes: ci.notes || undefined,
      })),
    });
  }

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/horeca/comenzi")}
            className="p-2 text-slate-500 hover:text-slate-900 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-sm rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
            <ShoppingBag className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Comandă Nouă
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
              {cartCount} produse · {formatCurrency(total, "RON")}
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

      {/* Tip comandă */}
      <div className="flex gap-2 mb-4 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 p-1.5 rounded-xl w-fit">
        {TYPE_OPTS.map(opt => (
          <button
            key={opt.value}
            onClick={() => {
              setOrderType(opt.value as OrderType);
              setSelectedTableNumber("");
            }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm ${orderType === opt.value ? `${opt.color} text-white` : "bg-transparent text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"}`}
          >
            <opt.icon className="w-4 h-4" />
            {opt.label}
          </button>
        ))}
      </div>

      {/* Layout principal: Meniu stânga, Coș dreapta */}
      <div className="flex gap-5 flex-1 overflow-hidden">
        {/* ── MENIU PANEL (stânga) ─────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4">
          {/* Categorii */}
          <div className="flex gap-2 overflow-x-auto pb-3 mb-2 scrollbar-none">
            <button
              onClick={() => setSelectedCategoryId(null)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-colors shadow-sm border ${!selectedCategoryId ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"}`}
            >
              Toate
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCategoryId(c.id)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-colors shadow-sm border ${selectedCategoryId === c.id ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"}`}
              >
                {c.icon} {c.name}
              </button>
            ))}
          </div>

          {/* Search meniu */}
          <div className="relative mb-4">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 z-10" />
            <input
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 rounded-lg shadow-sm transition-colors"
              style={{
                paddingLeft: 36,
                paddingRight: 16,
                paddingTop: 10,
                paddingBottom: 10,
                fontSize: 14,
              }}
              placeholder="Caută produs..."
              value={menuSearch}
              onChange={e => setMenuSearch(e.target.value)}
            />
          </div>

          {/* Grilă produse */}
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {filteredItems.length === 0 ? (
              <div className="text-center py-16 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 border-dashed">
                <Search className="w-8 h-8 mx-auto mb-3 text-slate-400 dark:text-slate-500 opacity-50" />
                <p className="font-medium">
                  {menuSearch
                    ? "Niciun produs găsit"
                    : "Niciun produs disponibil pentru acest canal"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredItems.map(item => {
                  const inCart = cart.find(ci => ci.menuItemId === item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => addToCart(item)}
                      className={`relative p-4 rounded-xl border-2 text-left transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm ${inCart ? "bg-blue-50 dark:bg-blue-500/10 border-blue-500 dark:border-blue-500/60" : "bg-white dark:bg-slate-800/60 border-slate-100 dark:border-slate-700/50 hover:border-blue-400 dark:hover:border-blue-500/40"}`}
                    >
                      {inCart && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md">
                          {inCart.quantity}
                        </div>
                      )}
                      <p className="text-slate-900 dark:text-white font-bold text-sm leading-snug mb-2 pr-6">
                        {item.name}
                      </p>
                      <p className="text-blue-600 dark:text-blue-400 font-black text-lg mb-1">
                        {formatCurrency(Number(item.price), "RON")}
                      </p>
                      <p className="text-slate-500 dark:text-slate-500 text-xs font-medium">
                        {item.unit || "portie"} · TVA {item.vatRate}%
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── COȘ PANEL (dreapta) ──────────────────────────────────── */}
        <div className="w-96 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex-shrink-0">
          {/* Info comandă */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-800/50">
            <h3 className="text-slate-900 dark:text-white font-bold text-sm uppercase tracking-wider">
              Detalii comandă
            </h3>

            {/* Masă / Ospătar */}
            {orderType === "dine_in" && (
              <div>
                <label className="block text-slate-600 dark:text-slate-400 text-xs font-semibold mb-1">
                  Masă *
                </label>
                <select
                  value={selectedTableNumber}
                  onChange={e => setSelectedTableNumber(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-2.5 py-2 text-sm font-medium focus:outline-none focus:border-blue-500 shadow-sm"
                >
                  <option value="">— Selectează masa —</option>
                  {tables
                    .filter(t => t.status !== "cleaning")
                    .map(t => (
                      <option key={t.id} value={t.number}>
                        Masa {t.number} ({t.capacity} locuri){" "}
                        {t.status === "occupied" ? "⚠️ Ocupată" : ""}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-slate-600 dark:text-slate-400 text-xs font-semibold mb-1">
                Ospătar
              </label>
              <input
                value={staffName}
                onChange={e => setStaffName(e.target.value)}
                placeholder="Numele ospătarului"
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-2.5 py-2 text-sm font-medium focus:outline-none focus:border-blue-500 shadow-sm"
              />
            </div>
          </div>

          {/* Produse în coș */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {cart.length === 0 ? (
              <div className="text-center py-16 text-slate-500 dark:text-slate-400 text-sm font-medium flex flex-col items-center">
                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full mb-3">
                  <ShoppingBag className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                </div>
                Niciun produs adăugat
              </div>
            ) : (
              cart.map(item => (
                <div
                  key={item.menuItemId}
                  className="bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/50 rounded-xl p-3 shadow-sm transition-colors hover:border-slate-200 dark:hover:border-slate-600"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-slate-900 dark:text-white text-sm font-bold leading-snug flex-1">
                      {item.name}
                    </p>
                    <button
                      onClick={() => removeFromCart(item.menuItemId)}
                      className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-1 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    {/* Qty controls */}
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 shadow-sm">
                      <button
                        onClick={() => updateQty(item.menuItemId, -1)}
                        className="w-7 h-7 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-slate-900 dark:text-white text-sm font-black w-6 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQty(item.menuItemId, 1)}
                        className="w-7 h-7 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-blue-600 dark:text-blue-400 text-sm font-black">
                      {formatCurrency(item.price * item.quantity, "RON")}
                    </span>
                  </div>
                  {/* Notă pe produs */}
                  <input
                    value={item.notes}
                    onChange={e =>
                      updateItemNote(item.menuItemId, e.target.value)
                    }
                    placeholder="Notă bucătărie (ex: fără ceapă)..."
                    className="mt-3 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-md px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-blue-500 placeholder-slate-400 dark:placeholder-slate-500 shadow-sm"
                  />
                </div>
              ))
            )}
          </div>

          {/* Total + notă globală */}
          {cart.length > 0 && (
            <div className="border-t border-slate-100 dark:border-slate-800 p-4 space-y-4 bg-slate-50/50 dark:bg-slate-900/50">
              {/* Notă comandă */}
              <div>
                <label className="block text-slate-600 dark:text-slate-400 text-xs font-semibold mb-1 flex items-center gap-1.5">
                  <StickyNote className="w-3.5 h-3.5" /> Notă generală
                </label>
                <input
                  value={orderNotes}
                  onChange={e => setOrderNotes(e.target.value)}
                  placeholder="Observații pentru bucătărie..."
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:border-blue-500 shadow-sm"
                />
              </div>

              {/* Totale */}
              <div className="space-y-1.5 text-sm p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
                <div className="flex justify-between text-slate-600 dark:text-slate-400 font-medium">
                  <span>Subtotal ({cartCount} produse)</span>
                  <span className="text-slate-900 dark:text-slate-300">
                    {formatCurrency(subtotal, "RON")}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400 font-medium pb-2">
                  <span>TVA estimat</span>
                  <span className="text-slate-900 dark:text-slate-300">
                    {formatCurrency(vat, "RON")}
                  </span>
                </div>
                <div className="flex justify-between text-slate-900 dark:text-white font-black text-xl border-t border-slate-100 dark:border-slate-800 pt-3 mt-1">
                  <span>TOTAL</span>
                  <span className="text-blue-600 dark:text-blue-400">
                    {formatCurrency(total, "RON")}
                  </span>
                </div>
              </div>

              {/* Plată dacă e selectat */}
              {showPayment && (
                <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <label className="block text-slate-900 dark:text-white text-xs font-bold uppercase tracking-wider mb-2">
                    Metodă de plată
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { v: "cash", l: "Cash", icon: Banknote },
                      { v: "card", l: "Card", icon: CreditCard },
                      { v: "voucher", l: "Voucher", icon: DollarSign },
                      { v: "mixed", l: "Mixt", icon: DollarSign },
                    ].map(opt => (
                      <button
                        key={opt.v}
                        onClick={() => setPaymentMethod(opt.v as any)}
                        className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-bold transition-all shadow-sm border ${paymentMethod === opt.v ? "bg-emerald-600 border-emerald-600 text-white" : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600"}`}
                      >
                        <opt.icon className="w-3.5 h-3.5" /> {opt.l}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Acțiuni */}
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={createMut.isPending}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl font-bold text-base transition-colors shadow-sm"
                >
                  {createMut.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                  Trimite la bucătărie
                </button>
                <div className="flex gap-2.5">
                  <button
                    onClick={() => setShowPayment(s => !s)}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm"
                  >
                    <DollarSign className="w-4 h-4" />{" "}
                    {showPayment ? "Anulează plată" : "Plătește acum"}
                  </button>
                  {showPayment && (
                    <button
                      onClick={() => handleSubmit(false)}
                      disabled={createMut.isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm"
                    >
                      <Check className="w-4 h-4" /> Confirmă
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setCart([])}
                  className="w-full flex items-center justify-center gap-1.5 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white py-2 rounded-lg text-xs font-bold transition-colors mt-1"
                >
                  <X className="w-3.5 h-3.5" /> Golește coșul
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
