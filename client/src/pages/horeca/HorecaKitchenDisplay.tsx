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
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
            <ChefHat className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Kitchen Display
            </h1>
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-medium">
              <span>{kitchenOrders.length} comenzi active</span>
              {isFetching && (
                <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex bg-slate-200/50 dark:bg-slate-700/50 p-1 rounded-full">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-full transition-colors ${viewMode === "grid" ? "bg-white dark:bg-slate-800 shadow-sm text-blue-600 dark:text-blue-400" : "text-slate-500 hover:text-slate-800 dark:text-slate-400"}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-full transition-colors ${viewMode === "list" ? "bg-white dark:bg-slate-800 shadow-sm text-blue-600 dark:text-blue-400" : "text-slate-500 hover:text-slate-800 dark:text-slate-400"}`}
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <select
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              className="appearance-none pr-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3 py-2 rounded-full text-sm font-medium focus:outline-none focus:border-blue-500 shadow-sm"
            >
              <option value={10}>10 carduri</option>
              <option value={20}>20 carduri</option>
              <option value={50}>50 carduri</option>
              <option value={9999}>Toate</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          {locations.length > 1 && (
            <div className="relative">
              <select
                value={locationId || ""}
                onChange={e => {
                  const val = e.target.value;
                  setSelectedLocationId(val.startsWith('bridge-') ? val as any : Number(val));
                }}
                className="appearance-none pr-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3 py-2 rounded-full text-sm font-medium focus:outline-none focus:border-blue-500 shadow-sm"
              >
                {locations.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {/* Grid/List de comenzi */}
      <div
        className={`flex-1 overflow-x-auto p-5 gap-5 bg-slate-100 dark:bg-slate-900 ${viewMode === "grid" ? "flex overflow-y-hidden" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 overflow-y-auto"}`}
      >
        {isLoading ? (
          <div className="w-full flex justify-center items-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : kitchenOrders.length === 0 ? (
          <div className="w-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
            <ChefHat className="w-20 h-20 mb-4 opacity-30 text-slate-400" />
            <p className="text-2xl font-bold">Bucătăria este liberă</p>
            <p className="text-slate-500 mt-2">
              Nu există comenzi active în așteptare
            </p>
          </div>
        ) : (
          kitchenOrders.map(order => {
            const isPreparing = order.status === "preparing";
            // Timpul scurs de la creare
            const createdTime = order.createdAt
              ? new Date(order.createdAt)
              : new Date();
            const timeDiffMin = Math.floor(
              (new Date().getTime() - createdTime.getTime()) / 60000
            );
            const isDelayed = timeDiffMin > 15; // peste 15 min = roșu

            return (
              <div
                key={order.id}
                className={`flex flex-col flex-shrink-0 h-full rounded-3xl border-2 overflow-hidden shadow-sm transition-all ${viewMode === "grid" ? "w-80" : "w-full min-h-[400px]"} ${isPreparing ? "bg-white dark:bg-slate-800 border-blue-400 dark:border-blue-500/50" : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700"}`}
              >
                {/* Order Header */}
                <div
                  className={`p-4 border-b flex-shrink-0 ${isPreparing ? "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30" : "bg-slate-50 dark:bg-slate-700/50 border-slate-100 dark:border-slate-700"}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-slate-900 dark:text-white font-black text-xl leading-none tracking-tight">
                        #{order.orderNumber}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold mt-1.5 flex items-center gap-1">
                        {order.type === "dine_in"
                          ? `Masă: ${order.tableNumber || "?"}`
                          : order.type === "takeaway"
                            ? "Ridicare"
                            : "Delivery"}
                        <span className="opacity-50 mx-1">•</span>
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
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold shadow-sm ${isDelayed ? "bg-red-500 text-white animate-pulse" : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"}`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      {timeDiffMin} min
                    </div>
                  </div>
                  {order.notes && (
                    <div className="mt-3 bg-amber-50 dark:bg-yellow-500/10 border border-amber-200 dark:border-yellow-500/20 text-amber-800 dark:text-yellow-400 px-3 py-2 rounded-md text-xs font-medium flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span className="leading-snug">{order.notes}</span>
                    </div>
                  )}
                </div>

                {/* Items */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {(
                    (order as any).lines ||
                    (order as any)._items ||
                    (order as any).items ||
                    []
                  )?.map((line: any) => (
                    <div
                      key={line.id || Math.random()}
                      className="border-b border-slate-100 dark:border-slate-700/50 pb-3 last:border-0 last:pb-0"
                    >
                      <div className="flex gap-3">
                        <span className="text-blue-600 dark:text-blue-400 font-bold text-lg leading-tight w-6">
                          {line.quantity}x
                        </span>
                        <div className="flex-1 pt-0.5">
                          <p className="text-slate-900 dark:text-white text-base leading-snug font-bold">
                            {line.name || line.productName}
                          </p>
                          {line.notes && (
                            <p className="text-amber-600 dark:text-yellow-400 text-sm mt-1 ml-1 flex items-start gap-1.5 font-medium">
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
                    <div className="text-center text-slate-400 text-sm mt-4 font-medium italic">
                      Nu s-au putut încărca produsele. Verificați conexiunea cu
                      Aggregator-ul.
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700 mt-auto flex-shrink-0">
                  {!isPreparing ? (
                    <button
                      onClick={() => handleStart(order.id)}
                      disabled={updateStatusMut.isPending}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-full font-bold text-base transition-colors shadow-sm"
                    >
                      <Play className="w-5 h-5 fill-current" />
                      Începe prepararea
                    </button>
                  ) : (
                    <button
                      onClick={() => handleFinish(order.id)}
                      disabled={updateStatusMut.isPending}
                      className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-full font-bold text-base transition-colors shadow-sm"
                    >
                      <CheckCircle2 className="w-6 h-6" />
                      GATA
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
