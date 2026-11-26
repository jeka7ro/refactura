// HorecaKitchenDisplay — Kitchen Display System (KDS)
// UI: Kanban-style columns, full screen layout for tablet/kitchen screen
// Proper Light/Dark mode styling (Premium UI)

import { useState, useEffect, useRef } from "react";
import {
  ChefHat,
  Loader2,
  Check,
  Clock,
  AlertTriangle,
  Play,
  CheckCircle2,
  RefreshCw,
  LayoutGrid,
  List as ListIcon,
  Calendar,
  ChevronDown,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function HorecaKitchenDisplay() {
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
    null
  );
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [limit, setLimit] = useState<number>(50);

  const { data: localLocations = [] } = trpc.horeca.locations.list.useQuery();

  const { data: bridgeLocations = [] } =
    trpc.horeca.kioskBridge.listLocations.useQuery(undefined, {
      refetchOnWindowFocus: false,
    });

  const mappedBridgeLocations = bridgeLocations.map((bl: any) => ({
    id: `bridge-${bl.id}`,
    name: bl.name,
  }));

  const locations = [...localLocations, ...mappedBridgeLocations];
  const locationId = selectedLocationId ?? locations[0]?.id ?? 0;

  const utils = trpc.useUtils();

  // Polling rapid pentru bucătărie (la fiecare 10 secunde)
  const {
    data: localOrders = [],
    isLoading,
    isFetching,
  } = trpc.horeca.orders.list.useQuery(
    { locationId, date: new Date().toISOString().slice(0, 10) },
    {
      enabled: locationId > 0,
      refetchInterval: 10000,
    }
  );

  // Smart Kiosk Bridge — fetch real orders (from IIKO/POS/Smart Kiosk)
  const { data: bridgeOrdersData } =
    trpc.horeca.kioskBridge.listOrders.useQuery(
      { limit: 50, status: "pending,confirmed,preparing,ready" },
      {
        refetchInterval: 5000,
        refetchOnWindowFocus: false,
      }
    );

  const usesBridge = (bridgeOrdersData?.orders || []).length > 0;
  const orders = usesBridge
    ? (bridgeOrdersData?.orders || []).map((o: any, idx: number) => ({
        id: idx + 1,
        orderNumber: String(o.orderNumber),
        tableNumber: o.tableNumber || null,
        staffName: o.brand || null,
        type: o.orderType || "takeaway",
        status: o.status === "pending" ? "sent" : o.status || "sent",
        totalAmount: o.totalAmount || 0,
        guestCount: null,
        createdAt: new Date(o.createdAt),
        _brand: o.brand,
        _items: o.items || [],
      }))
    : localOrders;

  const updateStatusMut = trpc.horeca.orders.updateStatus.useMutation({
    onSuccess: () => {
      utils.horeca.orders.list.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  // Filtrăm doar comenzile active pentru bucătărie
  const kitchenOrders = orders
    .filter((o: any) => ["sent", "preparing"].includes(o.status || ""))
    .slice(0, limit);

  // Sortăm: cele mai vechi primele (după createdAt)
  kitchenOrders.sort((a: any, b: any) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeA - timeB;
  });

  // Notificare sonoră pentru comenzi noi
  const prevHighestIdRef = useRef<number>(0);
  useEffect(() => {
    if (kitchenOrders.length === 0) return;
    
    const currentHighestId = Math.max(...kitchenOrders.map((o: any) => Number(o.id) || 0));
    
    if (prevHighestIdRef.current > 0 && currentHighestId > prevHighestIdRef.current) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); 
        oscillator.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.5);
      } catch (e) {
        console.error("Notificare audio eșuată", e);
      }
    }
    prevHighestIdRef.current = currentHighestId;
  }, [kitchenOrders]);

  function handleStart(orderId: number) {
    updateStatusMut.mutate({ id: orderId, status: "preparing" });
  }

  function handleFinish(orderId: number) {
    updateStatusMut.mutate({ id: orderId, status: "ready" });
  }

  return (
    <div className="flex flex-col h-full space-y-4 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-0.5">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
            Kitchen Display
          </h1>
          <div className="flex items-center gap-2 text-[#6e6e73] dark:text-[#98989d] text-[12.5px] mt-0.5 tabular-nums">
            <span>
              <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
                {kitchenOrders.length}
              </strong>{" "}
              comenzi active
            </span>
            {isFetching && (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#8e8e93]" />
            )}
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="apple-segmented">
            <button
              type="button"
              data-active={viewMode === "grid"}
              onClick={() => setViewMode("grid")}
              className="apple-segmented-item px-2.5"
              title="Vizualizare coloane"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              data-active={viewMode === "list"}
              onClick={() => setViewMode("list")}
              className="apple-segmented-item px-2.5"
              title="Vizualizare grilă"
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <select
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              className="apple-pill-control appearance-none pl-3.5 pr-8 h-[34px] text-[12.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] focus:outline-none cursor-pointer"
            >
              <option value={10}>10 carduri</option>
              <option value={20}>20 carduri</option>
              <option value={50}>50 carduri</option>
              <option value={9999}>Toate</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          {locations.length > 1 && (
            <div className="relative">
              <select
                value={locationId || ""}
                onChange={e => {
                  const val = e.target.value;
                  setSelectedLocationId(val.startsWith("bridge-") ? (val as any) : Number(val));
                }}
                className="apple-pill-control appearance-none pl-3.5 pr-8 h-[34px] text-[12.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] focus:outline-none cursor-pointer"
              >
                {locations.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {/* Grid/List de comenzi */}
      <div
        className={`flex-1 overflow-x-auto p-4 gap-4 apple-surface ${
          viewMode === "grid"
            ? "flex overflow-y-hidden min-h-[460px]"
            : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 overflow-y-auto min-h-[460px]"
        }`}
      >
        {isLoading ? (
          <div className="w-full flex justify-center items-center py-16">
            <Loader2 className="w-7 h-7 text-primary animate-spin" />
          </div>
        ) : kitchenOrders.length === 0 ? (
          <div className="w-full flex flex-col items-center justify-center text-[#6e6e73] dark:text-[#98989d] py-16">
            <ChefHat className="w-16 h-16 mb-3 opacity-25 text-[#8e8e93]" />
            <p className="text-xl font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">Bucătăria este liberă</p>
            <p className="text-[#6e6e73] dark:text-[#98989d] text-[13px] mt-1">
              Nu există comenzi active în așteptare
            </p>
          </div>
        ) : (
          kitchenOrders.map((order: any) => {
            const isPreparing = order.status === "preparing";
            const createdTime = order.createdAt
              ? new Date(order.createdAt)
              : new Date();
            const timeDiffMin = Math.floor(
              (new Date().getTime() - createdTime.getTime()) / 60000
            );
            const isDelayed = timeDiffMin > 15;

            return (
              <div
                key={order.id}
                className={`flex flex-col flex-shrink-0 h-full rounded-2xl border overflow-hidden transition-all ${
                  viewMode === "grid" ? "w-80" : "w-full min-h-[380px]"
                } ${
                  isPreparing
                    ? "bg-[#f2f2f7]/60 dark:bg-[#2c2c2e] border-primary/50"
                    : "bg-[#f2f2f7]/40 dark:bg-[#242426] border-black/[0.06] dark:border-white/[0.08]"
                }`}
              >
                {/* Order Header */}
                <div
                  className={`p-4 border-b flex-shrink-0 ${
                    isPreparing
                      ? "bg-primary/[0.08] dark:bg-primary/[0.14] border-primary/20"
                      : "bg-[#fafafa] dark:bg-white/[0.03] border-black/[0.05] dark:border-white/[0.07]"
                  }`}
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <div>
                      <p className="text-[#1d1d1f] dark:text-[#f5f5f7] font-bold text-xl leading-none tracking-tight tabular-nums">
                        #{order.orderNumber}
                      </p>
                      <p className="text-[#6e6e73] dark:text-[#98989d] text-xs font-medium mt-1.5 flex items-center gap-1 tabular-nums">
                        {order.type === "dine_in"
                          ? `Masă: ${order.tableNumber || "?"}`
                          : order.type === "takeaway"
                            ? "Ridicare"
                            : "Delivery"}
                        <span className="opacity-50 mx-0.5">·</span>
                        <Calendar className="w-3 h-3" />
                        {createdTime.toLocaleDateString("ro-RO", {
                          day: "2-digit",
                          month: "2-digit",
                        })}{" "}
                        {createdTime.toLocaleTimeString("ro-RO", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums ${
                        isDelayed
                          ? "bg-[#ff3b30] text-white animate-pulse"
                          : "bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#ebebf5] border border-black/[0.06] dark:border-white/[0.08]"
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      {timeDiffMin} min
                    </div>
                  </div>
                  {order.notes && (
                    <div className="mt-2.5 bg-amber-500/12 border border-amber-500/20 text-amber-800 dark:text-amber-300 px-3 py-2 rounded-xl text-xs font-medium flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span className="leading-snug">{order.notes}</span>
                    </div>
                  )}
                </div>

                {/* Items */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {(
                    (order as any).lines ||
                    (order as any)._items ||
                    (order as any).items ||
                    []
                  )?.map((line: any) => (
                    <div
                      key={line.id || Math.random()}
                      className="border-b border-black/[0.05] dark:border-white/[0.07] pb-3 last:border-0 last:pb-0"
                    >
                      <div className="flex gap-3">
                        <span className="text-primary font-bold text-base leading-tight w-6 tabular-nums">
                          {line.quantity}x
                        </span>
                        <div className="flex-1">
                          <p className="text-[#1d1d1f] dark:text-[#f5f5f7] text-[15px] leading-snug font-semibold">
                            {line.name || line.productName}
                          </p>
                          {line.notes && (
                            <p className="text-amber-700 dark:text-amber-300 text-xs mt-1 ml-1 flex items-start gap-1.5 font-medium">
                              <span className="opacity-50">↳</span> {line.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(
                    (order as any).lines ||
                    (order as any)._items ||
                    (order as any).items ||
                    []
                  ).length === 0 && (
                    <div className="text-center text-[#8e8e93] text-xs mt-4 italic">
                      Nu s-au putut încărca produsele. Verificați conexiunea cu
                      Aggregator-ul.
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="p-3 bg-white dark:bg-[#1c1c1e] border-t border-black/[0.05] dark:border-white/[0.07] mt-auto flex-shrink-0">
                  {!isPreparing ? (
                    <button
                      type="button"
                      onClick={() => handleStart(order.id)}
                      disabled={updateStatusMut.isPending}
                      className="apple-btn-prominent w-full flex items-center justify-center gap-2 text-white h-11 font-semibold text-sm cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      Începe prepararea
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleFinish(order.id)}
                      disabled={updateStatusMut.isPending}
                      className="apple-btn-prominent w-full flex items-center justify-center gap-2 text-white h-11 font-semibold text-sm cursor-pointer"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      Gata
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
