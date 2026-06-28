// HorecaKitchenDisplay — Kitchen Display System (KDS)
// UI: Kanban-style columns, rounded-lg, focus on readability from a distance

import { useState, useEffect } from "react";
import {
  ChefHat, Loader2, Check, Clock, AlertTriangle, Play,
  CheckCircle2, RefreshCw
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function HorecaKitchenDisplay() {
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);

  const { data: locations = [] } = trpc.horeca.locations.list.useQuery();
  const locationId = selectedLocationId ?? locations[0]?.id ?? 0;

  const utils = trpc.useUtils();

  // Polling rapid pentru bucătărie (la fiecare 10 secunde)
  const { data: orders = [], isLoading, isFetching } = trpc.horeca.orders.list.useQuery(
    { locationId, date: new Date().toISOString().slice(0, 10) },
    {
      enabled: locationId > 0,
      refetchInterval: 10000,
    }
  );

  const updateStatusMut = trpc.horeca.orders.updateStatus.useMutation({
    onSuccess: () => { utils.horeca.orders.list.invalidate(); },
    onError: e => toast.error(e.message),
  });

  // Filtrăm doar comenzile active pentru bucătărie
  const kitchenOrders = orders.filter(o => ["sent", "preparing"].includes(o.status || ""));

  // Sortăm: cele mai vechi primele (după createdAt)
  kitchenOrders.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeA - timeB;
  });

  function handleStart(orderId: number) {
    updateStatusMut.mutate({ id: orderId, status: "preparing" });
  }

  function handleFinish(orderId: number) {
    updateStatusMut.mutate({ id: orderId, status: "ready" });
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-lg overflow-hidden border border-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-slate-800/80 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500/20 rounded-lg">
            <ChefHat className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Kitchen Display</h1>
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <span>{kitchenOrders.length} comenzi active</span>
              {isFetching && <RefreshCw className="w-3 h-3 animate-spin" />}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {locations.length > 1 && (
            <select value={locationId} onChange={e => setSelectedLocationId(Number(e.target.value))}
              className="bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-red-500">
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Grid de comenzi */}
      <div className="flex-1 overflow-x-auto p-4 flex gap-4">
        {isLoading ? (
          <div className="w-full flex justify-center items-center">
            <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
          </div>
        ) : kitchenOrders.length === 0 ? (
          <div className="w-full flex flex-col items-center justify-center text-slate-500">
            <ChefHat className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-xl">Bucătăria este liberă</p>
          </div>
        ) : (
          kitchenOrders.map(order => {
            const isPreparing = order.status === "preparing";
            // Timpul scurs de la creare
            const createdTime = order.createdAt ? new Date(order.createdAt) : new Date();
            const timeDiffMin = Math.floor((new Date().getTime() - createdTime.getTime()) / 60000);
            const isDelayed = timeDiffMin > 15; // peste 15 min = roșu

            return (
              <div key={order.id} className={`flex flex-col w-80 flex-shrink-0 rounded-lg border-2 overflow-hidden ${isPreparing ? "bg-slate-800 border-orange-500/50" : "bg-slate-800/80 border-slate-700"} shadow-xl`}>
                {/* Order Header */}
                <div className={`p-3 border-b ${isPreparing ? "bg-orange-500/20 border-orange-500/30" : "border-slate-700 bg-slate-700/50"}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-white font-bold text-lg leading-none">#{order.orderNumber}</p>
                      <p className="text-slate-400 text-xs mt-1">
                        {order.type === "dine_in" ? `Masă: ${order.tableNumber || "?"}` : order.type === "takeaway" ? "Ridicare" : "Delivery"}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${isDelayed ? "bg-red-500 text-white animate-pulse" : "bg-slate-700 text-slate-300"}`}>
                      <Clock className="w-3 h-3" />
                      {timeDiffMin} min
                    </div>
                  </div>
                  {order.notes && (
                    <div className="mt-2 bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 px-2 py-1.5 rounded text-xs font-medium flex items-start gap-1.5">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      {order.notes}
                    </div>
                  )}
                </div>

                {/* Items */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {(order as any).lines?.map((line: any) => (
                    <div key={line.id} className="border-b border-slate-700/50 pb-2 last:border-0 last:pb-0">
                      <div className="flex gap-2">
                        <span className="text-orange-400 font-bold w-6">{line.quantity}x</span>
                        <div className="flex-1">
                          <p className="text-white text-base leading-tight font-medium">{line.name}</p>
                          {line.notes && <p className="text-yellow-400 text-sm mt-0.5 ml-1 flex items-center gap-1">↳ {line.notes}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="p-3 bg-slate-900 border-t border-slate-700 mt-auto">
                  {!isPreparing ? (
                    <button onClick={() => handleStart(order.id)} disabled={updateStatusMut.isPending}
                      className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-lg font-bold text-lg transition-colors">
                      <Play className="w-5 h-5 fill-current" />
                      Începe prepararea
                    </button>
                  ) : (
                    <button onClick={() => handleFinish(order.id)} disabled={updateStatusMut.isPending}
                      className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold text-lg transition-colors">
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
