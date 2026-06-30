import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  UtensilsCrossed,
  ShoppingBag,
  Store,
  RefreshCcw,
  Eye,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MonitorSmartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

/**
 * HorecaTestPanel — READ-ONLY visualization of Smart Kiosk data
 * Shows menu, orders, and brands from the Smart Kiosk API for testing
 * DOES NOT send any commands to kitchen/Syrve
 */
export default function HorecaTestPanel() {
  const [selectedBrand, setSelectedBrand] = useState("rollmaster");
  const [selectedLocId, setSelectedLocId] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  // Bridge queries
  const { data: locationsData = [], refetch: refetchLocs } =
    trpc.horeca.kioskBridge.listLocations.useQuery(undefined, {
      refetchOnWindowFocus: false,
    });

  const { data: brandsData, refetch: refetchBrands } =
    trpc.horeca.kioskBridge.listBrands.useQuery(undefined, {
      refetchOnWindowFocus: false,
    });

  const {
    data: menuData,
    isLoading: menuLoading,
    refetch: refetchMenu,
  } = trpc.horeca.kioskBridge.getMenu.useQuery(
    { brandId: selectedBrand, locId: selectedLocId || undefined },
    { refetchOnWindowFocus: false }
  );

  const {
    data: ordersData,
    isLoading: ordersLoading,
    refetch: refetchOrders,
  } = trpc.horeca.kioskBridge.listOrders.useQuery(
    { limit: 100 },
    { refetchOnWindowFocus: false, refetchInterval: 10000 }
  );

  const categories = menuData?.categories || [];
  const products = menuData?.products || [];
  const orders = ordersData?.orders || [];
  const brands = brandsData?.brands || [];

  const filteredOrders = orders.filter((o: any) => {
    if (orderSearch) {
      const q = orderSearch.toLowerCase();
      return (
        String(o.orderNumber).includes(q) ||
        (o.brand || "").toLowerCase().includes(q) ||
        (o.locationName || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const statusColors: Record<string, string> = {
    pending:
      "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400",
    confirmed:
      "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400",
    preparing:
      "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-400",
    ready:
      "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400",
    delivered:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400",
    completed:
      "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400",
  };

  const refreshAll = () => {
    refetchLocs();
    refetchBrands();
    refetchMenu();
    refetchOrders();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <MonitorSmartphone className="w-6 h-6 text-primary" /> Kiosk Monitor
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Vizualizare READ-ONLY: meniu Syrve, comenzi și branduri •{" "}
            <span className="text-orange-500 font-bold">
              Nu trimite nimic la bucătărie
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={`http://localhost:4010/?loc=${selectedLocId || "9c63cff6-1d66-442d-a98d-2302656e3943"}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" className="gap-2">
              <ExternalLink className="w-4 h-4" /> Kiosk Live
            </Button>
          </a>
          <Button variant="outline" onClick={refreshAll} className="gap-2">
            <RefreshCcw className="w-4 h-4" /> Refresh Tot
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-3xl font-bold text-primary">
              {locationsData.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Locații</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-3xl font-bold text-primary">{brands.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Branduri</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-3xl font-bold text-primary">{products.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Produse ({selectedBrand})
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-3xl font-bold text-primary">{orders.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Comenzi Total</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="menu" className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-auto p-1 bg-secondary/50 rounded-lg">
          <TabsTrigger
            value="menu"
            className="py-2.5 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
          >
            <UtensilsCrossed className="w-4 h-4" /> Meniu Syrve (
            {products.length})
          </TabsTrigger>
          <TabsTrigger
            value="orders"
            className="py-2.5 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
          >
            <ShoppingBag className="w-4 h-4" /> Comenzi ({orders.length})
          </TabsTrigger>
          <TabsTrigger
            value="brands"
            className="py-2.5 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
          >
            <Store className="w-4 h-4" /> Branduri ({brands.length})
          </TabsTrigger>
          <TabsTrigger
            value="simulator"
            className="py-2.5 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
          >
            <MonitorSmartphone className="w-4 h-4" /> Simulator UI
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          {/* ──── TAB: Simulator ──── */}
          <TabsContent value="simulator" className="outline-none">
            <div className="flex gap-3 items-end mb-4">
              <div className="flex-1">
                <Label className="mb-1 block text-xs">Locație Simulată</Label>
                <select
                  value={selectedLocId}
                  onChange={e => setSelectedLocId(e.target.value)}
                  className="w-full bg-background border border-input rounded-full px-3 py-2 text-sm"
                >
                  {locationsData.map((l: any) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                  <option value="9c63cff6-1d66-442d-a98d-2302656e3943">
                    Locație Default Fallback (9c63...)
                  </option>
                </select>
              </div>
            </div>
            <div className="w-full h-[800px] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <iframe
                src={`http://localhost:4010/?loc=${selectedLocId || "9c63cff6-1d66-442d-a98d-2302656e3943"}`}
                className="w-full h-full border-none"
                title="Kiosk Simulator"
              />
            </div>
          </TabsContent>

          {/* ──── TAB: Meniu ──── */}
          <TabsContent value="menu" className="outline-none space-y-4">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Label className="mb-1 block text-xs">Brand</Label>
                <select
                  value={selectedBrand}
                  onChange={e => setSelectedBrand(e.target.value)}
                  className="w-full bg-background border border-input rounded-full px-3 py-2 text-sm"
                >
                  <option value="rollmaster">Roll Master</option>
                  <option value="lovesushi">Love Sushi</option>
                  <option value="pokiwoki">Poki Woki</option>
                  <option value="smashme">SmashMe</option>
                  <option value="ikura">Ikura</option>
                  <option value="crunch">Crunch</option>
                </select>
              </div>
              <div className="flex-1">
                <Label className="mb-1 block text-xs">Locație (opțional)</Label>
                <select
                  value={selectedLocId}
                  onChange={e => setSelectedLocId(e.target.value)}
                  className="w-full bg-background border border-input rounded-full px-3 py-2 text-sm"
                >
                  <option value="">Fără filtru de locație</option>
                  {locationsData.map((l: any) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                variant="secondary"
                onClick={() => refetchMenu()}
                className="gap-2"
              >
                <RefreshCcw className="w-4 h-4" /> Reîncarcă
              </Button>
            </div>

            {menuLoading ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="animate-spin text-primary w-8 h-8" />
              </div>
            ) : (
              <>
                {/* Categories */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {categories.map((c: any) => (
                    <span
                      key={c.id || c.name}
                      className="bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-xs font-medium"
                    >
                      {c.name}
                    </span>
                  ))}
                </div>

                {/* Products grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {products.slice(0, 60).map((p: any) => (
                    <Card
                      key={p.id}
                      className="overflow-hidden hover:shadow-md transition-shadow"
                    >
                      {p.image && (
                        <div className="h-28 bg-secondary/30 overflow-hidden">
                          <img
                            src={
                              p.image?.startsWith("http")
                                ? p.image
                                : `http://localhost:4000/api/image-proxy?url=${encodeURIComponent(p.image)}`
                            }
                            alt={p.name}
                            className="w-full h-full object-cover"
                            onError={e => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                        </div>
                      )}
                      <CardContent className="p-3">
                        <p className="font-semibold text-sm truncate">
                          {p.name}
                        </p>
                        <p className="text-primary font-bold text-sm mt-1">
                          {p.price} RON
                        </p>
                        {p.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {p.description}
                          </p>
                        )}
                        {(p.isVegetarian || p.isSpicy) && (
                          <div className="flex gap-1 mt-1">
                            {p.isVegetarian && (
                              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                                🌱 Veg
                              </span>
                            )}
                            {p.isSpicy && (
                              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                                🌶️ Spicy
                              </span>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {products.length > 60 && (
                  <p className="text-center text-sm text-muted-foreground mt-4">
                    Se afișează primele 60 din {products.length} produse.
                  </p>
                )}
              </>
            )}
          </TabsContent>

          {/* ──── TAB: Comenzi ──── */}
          <TabsContent value="orders" className="outline-none space-y-4">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Label className="mb-1 block text-xs">Caută Comandă</Label>
                <Input
                  placeholder="Nr. comandă, brand, locație..."
                  value={orderSearch}
                  onChange={e => setOrderSearch(e.target.value)}
                />
              </div>
              <Button
                variant="secondary"
                onClick={() => refetchOrders()}
                className="gap-2"
              >
                <RefreshCcw className="w-4 h-4" /> Refresh
              </Button>
            </div>

            <p className="text-xs text-amber-600 font-semibold">
              ⚠️ Vizualizare READ-ONLY — comenzile NU sunt trimise la bucătărie
              din acest panou
            </p>

            {ordersLoading ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="animate-spin text-primary w-8 h-8" />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>
                  Nicio comandă găsită. Plasează o comandă de test din Kiosk
                  (localhost:4010).
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredOrders.map((o: any) => (
                  <Card key={o._id} className="overflow-hidden">
                    <div
                      className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-secondary/30 transition-colors"
                      onClick={() =>
                        setExpandedOrder(expandedOrder === o._id ? null : o._id)
                      }
                    >
                      <div className="w-16 text-center">
                        <span className="text-xl font-bold text-primary">
                          #{o.orderNumber}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">
                            {o.brand}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[o.status] || "bg-slate-100 text-slate-600"}`}
                          >
                            {o.status}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {o.orderType}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {o.locationName || o.locationId} • {o.channel} •{" "}
                          {new Date(o.createdAt).toLocaleString("ro-RO")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">{o.totalAmount} RON</p>
                        <p className="text-xs text-muted-foreground">
                          {o.items?.length || 0} produse
                        </p>
                      </div>
                      <div>
                        {expandedOrder === o._id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                    {expandedOrder === o._id && o.items && (
                      <div className="px-4 pb-4 border-t border-border">
                        <table className="w-full text-sm mt-3">
                          <thead>
                            <tr className="text-xs text-muted-foreground">
                              <th className="text-left pb-2 font-medium">
                                Produs
                              </th>
                              <th className="text-center pb-2 font-medium">
                                Cant.
                              </th>
                              <th className="text-right pb-2 font-medium">
                                Preț
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {o.items.map((item: any, idx: number) => (
                              <tr
                                key={idx}
                                className="border-t border-border/50"
                              >
                                <td className="py-2">
                                  <p className="font-medium">{item.name}</p>
                                  {item.modifiers &&
                                    item.modifiers.length > 0 && (
                                      <p className="text-xs text-muted-foreground">
                                        +{" "}
                                        {item.modifiers
                                          .map((m: any) => m.name)
                                          .join(", ")}
                                      </p>
                                    )}
                                </td>
                                <td className="text-center">
                                  {item.quantity || 1}
                                </td>
                                <td className="text-right font-medium">
                                  {item.totalPrice || item.price} RON
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {o.syrveOrderId && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Syrve ID:{" "}
                            <span className="font-mono">{o.syrveOrderId}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ──── TAB: Branduri ──── */}
          <TabsContent value="brands" className="outline-none space-y-4">
            {brands.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Store className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Niciun brand configurat în Smart Kiosk.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {brands.map((b: any) => (
                  <Card
                    key={b.id}
                    className="overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-4 p-4">
                      {b.logoUrl && (
                        <img
                          src={
                            b.logoUrl.startsWith("http")
                              ? b.logoUrl
                              : `http://localhost:4000${b.logoUrl}`
                          }
                          alt={b.name}
                          className="w-16 h-16 rounded-lg object-contain bg-white border border-border"
                          onError={e => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="font-bold text-lg">{b.name || b.id}</h3>
                        <p className="text-xs text-muted-foreground font-mono">
                          {b.id}
                        </p>
                        {b.primaryColor && (
                          <div className="flex items-center gap-2 mt-2">
                            <div
                              className="w-5 h-5 rounded-full border border-border"
                              style={{ backgroundColor: b.primaryColor }}
                            ></div>
                            <span className="text-xs font-mono">
                              {b.primaryColor}
                            </span>
                          </div>
                        )}
                        {b.syrveMenuId && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Syrve Menu:{" "}
                            <span className="font-mono">
                              {b.syrveMenuId.substring(0, 20)}...
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
