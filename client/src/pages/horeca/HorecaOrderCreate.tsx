// HorecaOrderCreate — Interfață POS pentru creare comandă nouă
// Design: left panel = meniu categorizat, right panel = coș curent
// UI rules: rounded-lg, no rounded-xl

import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  ShoppingBag, UtensilsCrossed, Minus, Plus, Trash2,
  Check, X, Loader2, ChefHat, Truck, Package,
  Search, Send, DollarSign, CreditCard, Banknote,
  ChevronLeft, MapPin, StickyNote,
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
  { value: "dine_in",  label: "La masă",  icon: UtensilsCrossed, color: "bg-orange-600" },
  { value: "takeaway", label: "Ridicare", icon: Package,          color: "bg-amber-600" },
  { value: "delivery", label: "Delivery", icon: Truck,            color: "bg-blue-600" },
];

export default function HorecaOrderCreate() {
  const [, setLocation] = useLocation();
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedTableNumber, setSelectedTableNumber] = useState("");
  const [menuSearch, setMenuSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderNotes, setOrderNotes] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "mixed" | "voucher">("cash");
  const [staffName, setStaffName] = useState("");

  const { data: locations = [] } = trpc.horeca.locations.list.useQuery();
  const locationId = selectedLocationId ?? locations[0]?.id ?? 0;

  const { data: categories = [] } = trpc.horeca.menu.listCategories.useQuery({ locationId }, { enabled: locationId > 0 });
  const { data: items = [] } = trpc.horeca.menu.listItems.useQuery({ locationId, categoryId: selectedCategoryId ?? undefined }, { enabled: locationId > 0 });
  const { data: tables = [] } = trpc.horeca.tables.list.useQuery({ locationId }, { enabled: locationId > 0 && orderType === "dine_in" });

  const utils = trpc.useUtils();
  const createMut = trpc.horeca.orders.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Comandă ${(data as any).orderNumber} creată și trimisă la bucătărie!`);
      utils.horeca.orders.list.invalidate();
      utils.horeca.tables.list.invalidate();
      setLocation("/horeca/comenzi");
    },
    onError: e => toast.error(e.message),
  });

  // Filtrare meniu după search
  const filteredItems = useMemo(() => {
    const channel = orderType === "dine_in" ? "isAvailableDineIn" : orderType === "takeaway" ? "isAvailableTakeaway" : "isAvailableDelivery";
    const available = items.filter(i => i[channel as keyof typeof i]);
    if (!menuSearch.trim()) return available;
    const q = menuSearch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return available.filter(i => (i.name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q));
  }, [items, orderType, menuSearch]);

  // Cart operations
  function addToCart(item: typeof items[0]) {
    setCart(c => {
      const existing = c.find(ci => ci.menuItemId === item.id);
      if (existing) return c.map(ci => ci.menuItemId === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci);
      return [...c, { menuItemId: item.id, name: item.name, price: Number(item.price), vatRate: item.vatRate || 9, quantity: 1, notes: "" }];
    });
  }

  function updateQty(menuItemId: number, delta: number) {
    setCart(c => c.map(ci => ci.menuItemId === menuItemId ? { ...ci, quantity: Math.max(0, ci.quantity + delta) } : ci).filter(ci => ci.quantity > 0));
  }

  function removeFromCart(menuItemId: number) {
    setCart(c => c.filter(ci => ci.menuItemId !== menuItemId));
  }

  function updateItemNote(menuItemId: number, note: string) {
    setCart(c => c.map(ci => ci.menuItemId === menuItemId ? { ...ci, notes: note } : ci));
  }

  // Calcul totale
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const vat = cart.reduce((s, i) => {
    const net = (i.price * i.quantity) / (1 + i.vatRate / 100);
    return s + (i.price * i.quantity - net);
  }, 0);
  const total = subtotal;

  function handleSubmit(sendToKitchen: boolean) {
    if (cart.length === 0) { toast.error("Adaugă cel puțin un produs în comandă"); return; }
    if (orderType === "dine_in" && !selectedTableNumber) { toast.error("Selectează masa pentru comanda dine-in"); return; }
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
          <button onClick={() => setLocation("/horeca/comenzi")}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <ShoppingBag className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Comandă Nouă</h1>
            <p className="text-slate-400 text-sm">{cartCount} produse · {formatCurrency(total, "RON")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {locations.length > 1 && (
            <select value={locationId} onChange={e => setSelectedLocationId(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-orange-500">
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Tip comandă */}
      <div className="flex gap-2 mb-4">
        {TYPE_OPTS.map(opt => (
          <button key={opt.value} onClick={() => { setOrderType(opt.value as OrderType); setSelectedTableNumber(""); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${orderType === opt.value ? `${opt.color} text-white` : "bg-slate-800 border border-slate-700 text-slate-400 hover:text-white"}`}>
            <opt.icon className="w-4 h-4" />
            {opt.label}
          </button>
        ))}
      </div>

      {/* Layout principal: Meniu stânga, Coș dreapta */}
      <div className="flex gap-4 flex-1 overflow-hidden">
        {/* ── MENIU PANEL (stânga) ─────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Categorii */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none">
            <button onClick={() => setSelectedCategoryId(null)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!selectedCategoryId ? "bg-orange-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}>
              Toate
            </button>
            {categories.map(c => (
              <button key={c.id} onClick={() => setSelectedCategoryId(c.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedCategoryId === c.id ? "bg-orange-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}>
                {c.icon} {c.name}
              </button>
            ))}
          </div>

          {/* Search meniu */}
          <div style={{ position: "relative" }} className="mb-3">
            <Search className="w-4 h-4 text-slate-500" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input
              className="w-full bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-orange-500"
              style={{ paddingLeft: 36, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 9999, fontSize: 14 }}
              placeholder="Caută produs..."
              value={menuSearch}
              onChange={e => setMenuSearch(e.target.value)}
            />
          </div>

          {/* Grilă produse */}
          <div className="flex-1 overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                {menuSearch ? "Niciun produs găsit" : "Niciun produs disponibil pentru acest canal"}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {filteredItems.map(item => {
                  const inCart = cart.find(ci => ci.menuItemId === item.id);
                  return (
                    <button key={item.id}
                      onClick={() => addToCart(item)}
                      className={`relative p-3 rounded-lg border text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${inCart ? "bg-orange-500/20 border-orange-500/60" : "bg-slate-800/60 border-slate-700/50 hover:border-orange-500/40"}`}>
                      {inCart && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-orange-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {inCart.quantity}
                        </div>
                      )}
                      <p className="text-white font-medium text-sm leading-tight mb-1 pr-6">{item.name}</p>
                      <p className="text-orange-400 font-bold text-sm">{formatCurrency(Number(item.price), "RON")}</p>
                      <p className="text-slate-500 text-xs">{item.unit || "portie"} · TVA {item.vatRate}%</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── COȘ PANEL (dreapta) ──────────────────────────────────── */}
        <div className="w-80 flex flex-col bg-slate-800/60 border border-slate-700/50 rounded-lg overflow-hidden flex-shrink-0">
          {/* Info comandă */}
          <div className="p-4 border-b border-slate-700/50 space-y-3">
            <h3 className="text-white font-semibold text-sm">Detalii comandă</h3>

            {/* Masă / Ospătar */}
            {orderType === "dine_in" && (
              <div>
                <label className="block text-slate-400 text-xs mb-1">Masă *</label>
                <select value={selectedTableNumber} onChange={e => setSelectedTableNumber(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-orange-500">
                  <option value="">— Selectează masa —</option>
                  {tables.filter(t => t.status !== "cleaning").map(t => (
                    <option key={t.id} value={t.number}>
                      Masa {t.number} ({t.capacity} locuri) {t.status === "occupied" ? "⚠️ Ocupată" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-slate-400 text-xs mb-1">Ospătar</label>
              <input value={staffName} onChange={e => setStaffName(e.target.value)}
                placeholder="Numele ospătarului"
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-orange-500" />
            </div>
          </div>

          {/* Produse în coș */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                Niciun produs adăugat
              </div>
            ) : cart.map(item => (
              <div key={item.menuItemId} className="bg-slate-700/50 rounded-lg p-2.5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-white text-sm font-medium leading-tight flex-1">{item.name}</p>
                  <button onClick={() => removeFromCart(item.menuItemId)}
                    className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  {/* Qty controls */}
                  <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-0.5">
                    <button onClick={() => updateQty(item.menuItemId, -1)}
                      className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-white text-sm font-bold w-5 text-center">{item.quantity}</span>
                    <button onClick={() => updateQty(item.menuItemId, 1)}
                      className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-orange-400 text-sm font-bold">{formatCurrency(item.price * item.quantity, "RON")}</span>
                </div>
                {/* Notă pe produs */}
                <input value={item.notes} onChange={e => updateItemNote(item.menuItemId, e.target.value)}
                  placeholder="Notă bucătărie (ex: fără ceapă)..."
                  className="mt-2 w-full bg-slate-800/50 border border-slate-600/50 text-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-orange-500 placeholder-slate-600" />
              </div>
            ))}
          </div>

          {/* Total + notă globală */}
          {cart.length > 0 && (
            <div className="border-t border-slate-700/50 p-3 space-y-3">
              {/* Notă comandă */}
              <div>
                <label className="block text-slate-400 text-xs mb-1 flex items-center gap-1">
                  <StickyNote className="w-3 h-3" /> Notă generală
                </label>
                <input value={orderNotes} onChange={e => setOrderNotes(e.target.value)}
                  placeholder="Observații pentru bucătărie..."
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-orange-500" />
              </div>

              {/* Totale */}
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal ({cartCount} produse)</span>
                  <span>{formatCurrency(subtotal, "RON")}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>TVA estimat</span>
                  <span>{formatCurrency(vat, "RON")}</span>
                </div>
                <div className="flex justify-between text-white font-bold text-base border-t border-slate-700 pt-2 mt-2">
                  <span>TOTAL</span>
                  <span className="text-orange-400">{formatCurrency(total, "RON")}</span>
                </div>
              </div>

              {/* Plată dacă e selectat */}
              {showPayment && (
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Metodă de plată</label>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { v: "cash",    l: "Cash",    icon: Banknote },
                      { v: "card",    l: "Card",    icon: CreditCard },
                      { v: "voucher", l: "Voucher", icon: DollarSign },
                      { v: "mixed",   l: "Mixt",    icon: DollarSign },
                    ].map(opt => (
                      <button key={opt.v} onClick={() => setPaymentMethod(opt.v as any)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${paymentMethod === opt.v ? "bg-green-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}>
                        <opt.icon className="w-3 h-3" /> {opt.l}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Acțiuni */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={createMut.isPending}
                  className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium transition-colors">
                  {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Trimite la bucătărie
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPayment(s => !s)}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-green-700 hover:bg-green-600 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                    <DollarSign className="w-4 h-4" /> {showPayment ? "Anulează plată" : "Plătește acum"}
                  </button>
                  {showPayment && (
                    <button
                      onClick={() => handleSubmit(false)}
                      disabled={createMut.isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                      <Check className="w-4 h-4" /> Confirmă
                    </button>
                  )}
                </div>
                <button onClick={() => setCart([])}
                  className="w-full flex items-center justify-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white py-1.5 rounded-lg text-xs transition-colors">
                  <X className="w-3 h-3" /> Golește coșul
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
