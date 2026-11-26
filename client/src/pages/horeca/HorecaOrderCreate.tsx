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
  const [submitting, setSubmitting] = useState(false);
  const createMut = trpc.horeca.orders.create.useMutation();
  const addLineMut = trpc.horeca.orders.addLine.useMutation();
  const updateStatusMut = trpc.horeca.orders.updateStatus.useMutation();

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

  async function handleSubmit(sendToKitchen: boolean) {
    if (cart.length === 0) {
      toast.error("Adaugă cel puțin un produs în comandă");
      return;
    }
    if (orderType === "dine_in" && !selectedTableNumber) {
      toast.error("Selectează masa pentru comanda dine-in");
      return;
    }
    setSubmitting(true);
    try {
      const order = await createMut.mutateAsync({
        locationId,
        type: orderType,
        tableNumber: selectedTableNumber || undefined,
        staffName: staffName || undefined,
        notes: orderNotes || undefined,
      });

      for (const ci of cart) {
        await addLineMut.mutateAsync({
          orderId: (order as any).id,
          menuItemId: ci.menuItemId,
          name: ci.name,
          quantity: String(ci.quantity),
          unitPrice: String(ci.price),
          vatRate: ci.vatRate,
          notes: ci.notes || undefined,
        });
      }

      const targetStatus = showPayment
        ? "paid"
        : sendToKitchen
          ? "sent"
          : "draft";
      if (targetStatus !== "draft" || showPayment) {
        await updateStatusMut.mutateAsync({
          id: (order as any).id,
          status: targetStatus,
          paymentMethod: showPayment ? paymentMethod : undefined,
        });
      }

      toast.success(
        `Comandă ${(order as any).orderNumber || `#${(order as any).id}`} creată${sendToKitchen ? " și trimisă la bucătărie" : ""}!`
      );
      utils.horeca.orders.list.invalidate();
      utils.horeca.tables.list.invalidate();
      setLocation("/horeca/comenzi");
    } catch (e: any) {
      toast.error(e?.message || "Eroare la salvarea comenzii");
    } finally {
      setSubmitting(false);
    }
  }

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="flex flex-col h-full max-w-full overflow-x-hidden space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setLocation("/horeca/comenzi")}
            className="apple-btn-glass w-9 h-9 flex items-center justify-center text-[#1d1d1f] dark:text-[#f5f5f7] shrink-0 cursor-pointer"
          >
            <ChevronLeft className="w-4.5 h-4.5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight truncate">
              Comandă nouă
            </h1>
            <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums">
              <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
                {cartCount}
              </strong>{" "}
              produse ·{" "}
              <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
                {formatCurrency(total, "RON")}
              </strong>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {locations.length > 1 && (
            <select
              value={locationId}
              onChange={e => setSelectedLocationId(Number(e.target.value))}
              className="apple-pill-control px-3.5 h-[34px] text-[12.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] focus:outline-none max-w-full cursor-pointer"
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

      {/* Tip comandă inside apple-surface */}
      <div className="apple-surface px-3 py-2.5">
        <div className="apple-segmented flex-wrap sm:flex-nowrap !rounded-2xl sm:!rounded-full max-w-full">
          {TYPE_OPTS.map(opt => (
            <button
              key={opt.value}
              type="button"
              data-active={orderType === opt.value}
              onClick={() => {
                setOrderType(opt.value as OrderType);
                setSelectedTableNumber("");
              }}
              className="apple-segmented-item px-4 h-8 text-xs"
            >
              <opt.icon className="w-3.5 h-3.5" />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Layout principal: Meniu stânga, Coș dreapta */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 overflow-y-auto lg:overflow-hidden">
        {/* ── MENIU PANEL (stânga) ─────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 apple-surface p-4">
          {/* Categorii + Search */}
          <div className="flex gap-1.5 overflow-x-auto pb-3 mb-2 no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedCategoryId(null)}
              className={`flex-shrink-0 px-3.5 h-8 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                !selectedCategoryId
                  ? "apple-btn-prominent text-white"
                  : "apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7]"
              }`}
            >
              Toate
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategoryId(c.id)}
                className={`flex-shrink-0 px-3.5 h-8 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  selectedCategoryId === c.id
                    ? "apple-btn-prominent text-white"
                    : "apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7]"
                }`}
              >
                {c.icon} {c.name}
              </button>
            ))}
          </div>

          {/* Search meniu */}
          <div className="relative mb-4">
            <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              style={{
                paddingLeft: 34,
                paddingRight: 16,
              }}
              className="apple-pill-control rounded-full w-full h-9 text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none focus:bg-white dark:focus:bg-[#2c2c2e]"
              placeholder="Caută produs..."
              value={menuSearch}
              onChange={e => setMenuSearch(e.target.value)}
            />
          </div>

          {/* Grilă produse */}
          <div className="flex-1 overflow-y-auto pr-1">
            {filteredItems.length === 0 ? (
              <div className="text-center py-16 text-[#6e6e73] dark:text-[#98989d] bg-[#f5f5f7]/60 dark:bg-white/[0.02] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] border-dashed">
                <Search className="w-8 h-8 mx-auto mb-3 text-[#8e8e93] opacity-50" />
                <p className="text-[13px] font-medium">
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
                      type="button"
                      onClick={() => addToCart(item)}
                      className={`apple-card-btn relative p-3.5 rounded-2xl border text-left transition-all cursor-pointer tabular-nums ${
                        inCart
                          ? "bg-primary/[0.08] dark:bg-primary/[0.16] border-primary"
                          : "bg-[#f2f2f7]/60 dark:bg-[#2c2c2e] border-black/[0.06] dark:border-white/[0.08] hover:border-black/[0.15] dark:hover:border-white/[0.18]"
                      }`}
                    >
                      {inCart && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-white text-xs font-bold shadow-xs">
                          {inCart.quantity}
                        </div>
                      )}
                      <p className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold text-[13.5px] leading-snug mb-2 pr-6">
                        {item.name}
                      </p>
                      <p className="text-[#1d1d1f] dark:text-[#f5f5f7] font-bold text-base mb-0.5">
                        {formatCurrency(Number(item.price), "RON")}
                      </p>
                      <p className="text-[#6e6e73] dark:text-[#98989d] text-[11px] font-medium">
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
        <div className="w-full lg:w-96 flex flex-col apple-surface overflow-hidden flex-shrink-0">
          {/* Info comandă */}
          <div className="p-4 border-b border-black/[0.05] dark:border-white/[0.07] space-y-3 bg-[#fafafa] dark:bg-white/[0.02]">
            <h3 className="text-[#1d1d1f] dark:text-[#f5f5f7] font-bold text-[14px]">
              Detalii comandă
            </h3>

            {/* Masă / Ospătar */}
            {orderType === "dine_in" && (
              <div>
                <label className="block text-[#6e6e73] dark:text-[#98989d] text-[12px] font-medium mb-1">
                  Masă *
                </label>
                <select
                  value={selectedTableNumber}
                  onChange={e => setSelectedTableNumber(e.target.value)}
                  className="apple-input w-full h-9 px-3 text-sm cursor-pointer"
                >
                  <option value="">— Selectează masa —</option>
                  {tables
                    .filter(t => t.status !== "cleaning")
                    .map(t => (
                      <option key={t.id} value={t.number}>
                        Masa {t.number} ({t.capacity} locuri){" "}
                        {t.status === "occupied" ? "(Ocupată)" : ""}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-[#6e6e73] dark:text-[#98989d] text-[12px] font-medium mb-1">
                Ospătar
              </label>
              <input
                value={staffName}
                onChange={e => setStaffName(e.target.value)}
                placeholder="Numele ospătarului"
                className="apple-input w-full h-9 px-3 text-sm"
              />
            </div>
          </div>

          {/* Produse în coș */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {cart.length === 0 ? (
              <div className="text-center py-14 text-[#6e6e73] dark:text-[#98989d] text-[13px] font-medium flex flex-col items-center">
                <div className="p-4 bg-[#f2f2f7] dark:bg-[#2c2c2e] rounded-full mb-3">
                  <ShoppingBag className="w-7 h-7 text-[#8e8e93]" />
                </div>
                Niciun produs adăugat
              </div>
            ) : (
              cart.map(item => (
                <div
                  key={item.menuItemId}
                  className="bg-[#f2f2f7]/70 dark:bg-[#2c2c2e] border border-black/[0.05] dark:border-white/[0.07] rounded-xl p-3 tabular-nums"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-[#1d1d1f] dark:text-[#f5f5f7] text-[13.5px] font-semibold leading-snug flex-1">
                      {item.name}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.menuItemId)}
                      className="text-[#8e8e93] hover:text-[#ff3b30] dark:hover:text-[#ff453a] p-1 hover:bg-[#ff3b30]/10 rounded-full transition-colors flex-shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    {/* Qty controls */}
                    <div className="flex items-center gap-1 bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] rounded-full p-0.5">
                      <button
                        type="button"
                        onClick={() => updateQty(item.menuItemId, -1)}
                        className="w-6 h-6 flex items-center justify-center text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-white rounded-full transition-colors cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-[#1d1d1f] dark:text-[#f5f5f7] text-xs font-bold w-6 text-center">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQty(item.menuItemId, 1)}
                        className="w-6 h-6 flex items-center justify-center text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-white rounded-full transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-[#1d1d1f] dark:text-[#f5f5f7] text-[13.5px] font-bold">
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
                    className="mt-2.5 w-full bg-white dark:bg-[#1c1c1e] border border-black/[0.06] dark:border-white/[0.08] text-[#1d1d1f] dark:text-[#f5f5f7] rounded-lg px-2.5 py-1.5 text-xs placeholder:text-[#8e8e93] focus:outline-none"
                  />
                </div>
              ))
            )}
          </div>

          {/* Total + notă globală */}
          {cart.length > 0 && (
            <div className="border-t border-black/[0.05] dark:border-white/[0.07] p-4 space-y-3.5 bg-[#fafafa] dark:bg-white/[0.02] tabular-nums">
              {/* Notă comandă */}
              <div>
                <label className="block text-[#6e6e73] dark:text-[#98989d] text-[12px] font-medium mb-1 flex items-center gap-1.5">
                  <StickyNote className="w-3.5 h-3.5" /> Notă generală
                </label>
                <input
                  value={orderNotes}
                  onChange={e => setOrderNotes(e.target.value)}
                  placeholder="Observații pentru bucătărie..."
                  className="apple-input w-full h-9 px-3 text-xs"
                />
              </div>

              {/* Totale */}
              <div className="space-y-1.5 text-[13px] p-3 bg-white dark:bg-[#1c1c1e] border border-black/[0.06] dark:border-white/[0.08] rounded-xl">
                <div className="flex justify-between text-[#6e6e73] dark:text-[#98989d]">
                  <span>Subtotal ({cartCount} produse)</span>
                  <span className="text-[#1d1d1f] dark:text-[#ebebf5] font-medium">
                    {formatCurrency(subtotal, "RON")}
                  </span>
                </div>
                <div className="flex justify-between text-[#6e6e73] dark:text-[#98989d] pb-2">
                  <span>TVA estimat</span>
                  <span className="text-[#1d1d1f] dark:text-[#ebebf5] font-medium">
                    {formatCurrency(vat, "RON")}
                  </span>
                </div>
                <div className="flex justify-between text-[#1d1d1f] dark:text-[#f5f5f7] font-bold text-lg border-t border-black/[0.05] dark:border-white/[0.07] pt-2.5">
                  <span>Total</span>
                  <span>
                    {formatCurrency(total, "RON")}
                  </span>
                </div>
              </div>

              {/* Plată dacă e selectat */}
              {showPayment && (
                <div className="bg-white dark:bg-[#1c1c1e] p-3 rounded-xl border border-black/[0.06] dark:border-white/[0.08]">
                  <label className="block text-[#6e6e73] dark:text-[#98989d] text-[12px] font-medium mb-2">
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
                        type="button"
                        onClick={() => setPaymentMethod(opt.v as any)}
                        className={`flex items-center justify-center gap-1.5 px-2 h-8 text-xs font-semibold transition-all cursor-pointer ${
                          paymentMethod === opt.v
                            ? "apple-btn-prominent text-white"
                            : "apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7]"
                        }`}
                      >
                        <opt.icon className="w-3.5 h-3.5" /> {opt.l}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Acțiuni */}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  disabled={submitting}
                  className="apple-btn-prominent w-full flex items-center justify-center gap-2 disabled:opacity-50 text-white h-10 font-semibold text-sm cursor-pointer"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Trimite la bucătărie
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPayment(s => !s)}
                    className="apple-btn-glass flex-1 flex items-center justify-center gap-1.5 text-[#1d1d1f] dark:text-[#f5f5f7] h-9 text-xs font-semibold cursor-pointer"
                  >
                    <DollarSign className="w-3.5 h-3.5" />{" "}
                    {showPayment ? "Anulează plată" : "Plătește acum"}
                  </button>
                  {showPayment && (
                    <button
                      type="button"
                      onClick={() => handleSubmit(false)}
                      disabled={submitting}
                      className="apple-btn-prominent flex-1 flex items-center justify-center gap-1.5 disabled:opacity-50 text-white h-9 text-xs font-semibold cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" /> Confirmă
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="w-full flex items-center justify-center gap-1.5 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] text-[#6e6e73] hover:text-[#ff3b30] dark:text-[#98989d] dark:hover:text-[#ff453a] h-8 rounded-full text-xs font-medium transition-colors cursor-pointer"
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
