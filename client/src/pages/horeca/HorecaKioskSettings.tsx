import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Save,
  Loader2,
  Image as ImageIcon,
  Palette,
  Settings,
  Plus,
  Trash2,
  Gift,
  X,
  MonitorSmartphone,
  Shield,
  Languages,
  Blocks,
  RefreshCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";

/**
 * HorecaKioskSettings — Full settings panel connected to Smart Kiosk backend via bridge proxy
 *
 * This page reads/writes directly to the Smart Kiosk API (localhost:4000)
 * through a tRPC bridge (horeca.kioskBridge.*) on our ERP backend.
 */
export default function HorecaKioskSettings() {
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null
  );

  // ── Bridge queries: fetch real data from Smart Kiosk API ──
  const {
    data: bridgeLocations = [],
    isLoading: loadingLocs,
    refetch: refetchLocations,
  } = trpc.horeca.kioskBridge.listLocations.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const {
    data: locationDetail,
    isLoading: loadingDetail,
    refetch: refetchDetail,
  } = trpc.horeca.kioskBridge.getLocation.useQuery(
    { locationId: selectedLocationId! },
    { enabled: !!selectedLocationId, refetchOnWindowFocus: false }
  );

  const { data: promoData } = trpc.horeca.kioskBridge.getPromotions.useQuery(
    undefined,
    {
      refetchOnWindowFocus: false,
    }
  );

  const { data: kioskConfigs } =
    trpc.horeca.kioskBridge.getKioskConfigs.useQuery(undefined, {
      refetchOnWindowFocus: false,
    });

  const updateMut = trpc.horeca.kioskBridge.updateLocation.useMutation({
    onSuccess: () => {
      toast.success("✅ Setări actualizate pe Smart Kiosk!");
      refetchDetail();
      refetchLocations();
    },
    onError: err => toast.error("Eroare Smart Kiosk: " + err.message),
  });

  // ── Local form state ──
  const [brands, setBrands] = useState<string[]>([]);
  const [newBrand, setNewBrand] = useState("");
  const [orgIds, setOrgIds] = useState<Record<string, string>>({});
  const [kioskPin, setKioskPin] = useState("");
  const [posterUrl, setPosterUrl] = useState("");
  const [topBannerUrl, setTopBannerUrl] = useState("");
  const [topBannerHeight, setTopBannerHeight] = useState(3);
  const [bottomBannerUrl, setBottomBannerUrl] = useState("");
  const [bottomBannerText, setBottomBannerText] = useState("");
  const [bottomBannerHeight, setBottomBannerHeight] = useState(2);
  const [bottomBannerBg, setBottomBannerBg] = useState("#1e293b");
  const [bottomBannerLogoUrl, setBottomBannerLogoUrl] = useState("");
  const [langs, setLangs] = useState<string[]>(["ro"]);
  const [defaultLang, setDefaultLang] = useState("ro");
  const [langButtonColor, setLangButtonColor] = useState("#0f172a");
  const [langSelectorPosition, setLangSelectorPosition] = useState("after");
  const [promoActive, setPromoActive] = useState(false);
  const [promoBrandId, setPromoBrandId] = useState("");
  const [promoMinOrder, setPromoMinOrder] = useState(0);
  const [promoOrdersToAppear, setPromoOrdersToAppear] = useState(1);

  // ── Sync form state from location detail ──
  useEffect(() => {
    if (locationDetail) {
      setBrands(locationDetail.brands || []);
      setOrgIds(locationDetail.orgIds || {});
      setKioskPin(locationDetail.kioskPin || "");
      setPosterUrl(locationDetail.posterUrl || "");
      setTopBannerUrl(locationDetail.topBannerUrl || "");
      setTopBannerHeight(locationDetail.topBannerHeight || 3);
      setBottomBannerUrl(locationDetail.bottomBannerUrl || "");
      setBottomBannerText(locationDetail.bottomBannerText || "");
      setBottomBannerHeight(locationDetail.bottomBannerHeight || 2);
      setBottomBannerBg(locationDetail.bottomBannerBg || "#1e293b");
      setBottomBannerLogoUrl(locationDetail.bottomBannerLogoUrl || "");
      setLangs(
        locationDetail.languages && locationDetail.languages.length > 0
          ? locationDetail.languages
          : ["ro"]
      );
      setDefaultLang(locationDetail.defaultLanguage || "ro");
      setLangButtonColor(locationDetail.langButtonColor || "#0f172a");
      setLangSelectorPosition(locationDetail.langSelectorPosition || "after");
      setPromoActive(locationDetail.promoActive || false);
      setPromoBrandId(locationDetail.promoBrandId || "");
      setPromoMinOrder(locationDetail.promoMinOrderValue || 0);
      setPromoOrdersToAppear(locationDetail.promoOrdersToAppear || 1);
    }
  }, [locationDetail]);

  useEffect(() => {
    if (bridgeLocations.length > 0 && !selectedLocationId) {
      setSelectedLocationId(bridgeLocations[0].id);
    }
  }, [bridgeLocations, selectedLocationId]);

  // ── Save handler ──
  const handleSave = () => {
    if (!selectedLocationId) return;
    updateMut.mutate({
      locationId: selectedLocationId,
      data: {
        brands,
        orgIds,
        kioskPin,
        posterUrl,
        topBannerUrl,
        topBannerHeight,
        bottomBannerUrl,
        bottomBannerText,
        bottomBannerHeight,
        bottomBannerBg,
        bottomBannerLogoUrl,
        languages: langs,
        defaultLanguage: defaultLang,
        langButtonColor,
        langSelectorPosition,
        promoActive,
        promoBrandId,
        promoMinOrderValue: promoMinOrder,
        promoOrdersToAppear,
      },
    });
  };

  const addBrand = () => {
    const b = newBrand.trim().toLowerCase();
    if (b && !brands.includes(b)) {
      setBrands([...brands, b]);
      setNewBrand("");
    }
  };

  const removeBrand = (b: string) => setBrands(brands.filter(x => x !== b));

  const toggleLang = (lang: string) => {
    if (langs.includes(lang)) {
      if (langs.length > 1) {
        const next = langs.filter(l => l !== lang);
        setLangs(next);
        if (defaultLang === lang) setDefaultLang(next[0]);
      }
    } else {
      setLangs([...langs, lang]);
    }
  };

  const selectedLocName = useMemo(() => {
    return (
      bridgeLocations.find((l: any) => l.id === selectedLocationId)?.name || ""
    );
  }, [bridgeLocations, selectedLocationId]);

  if (loadingLocs) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto fade-in">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" /> Setări Kiosk
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Conectat la{" "}
            <span className="text-primary font-semibold">Smart Kiosk API</span>{" "}
            — {bridgeLocations.length} locații
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              refetchLocations();
              if (selectedLocationId) refetchDetail();
            }}
            className="gap-2"
          >
            <RefreshCcw className="w-4 h-4" /> Refresh
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateMut.isPending || !selectedLocationId}
            className="gap-2"
          >
            {updateMut.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Salvează pe Smart Kiosk
          </Button>
        </div>
      </div>

      {/* Location Selector */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <Label className="mb-2 block">Selectează Locația Smart Kiosk</Label>
          <select
            value={selectedLocationId || ""}
            onChange={e => setSelectedLocationId(e.target.value)}
            className="w-full bg-background border border-input rounded-full px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50"
          >
            <option value="" disabled>
              Alege o locație...
            </option>
            {bridgeLocations.map((l: any) => (
              <option key={l.id} value={l.id}>
                {l.name} — {l.brands?.join(", ") || "fără branduri"}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Main content */}
      {loadingDetail && selectedLocationId ? (
        <div className="p-8 flex justify-center">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : selectedLocationId ? (
        <Tabs defaultValue="aspect" className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-auto p-1 bg-secondary/50 rounded-lg">
            <TabsTrigger
              value="aspect"
              className="py-2.5 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs sm:text-sm"
            >
              Branduri & Bannere
            </TabsTrigger>
            <TabsTrigger
              value="screensaver"
              className="py-2.5 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs sm:text-sm"
            >
              Screensaver
            </TabsTrigger>
            <TabsTrigger
              value="language"
              className="py-2.5 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs sm:text-sm"
            >
              Limbi & PIN
            </TabsTrigger>
            <TabsTrigger
              value="syrve"
              className="py-2.5 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs sm:text-sm"
            >
              Syrve (iiko)
            </TabsTrigger>
            <TabsTrigger
              value="promo"
              className="py-2.5 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs sm:text-sm"
            >
              Promoții
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            {/* ──────── TAB: Branduri & Bannere ──────── */}
            <TabsContent value="aspect" className="space-y-6 outline-none">
              {/* Branduri Active */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Settings className="w-5 h-5 text-primary" /> Branduri
                    Active — {selectedLocName}
                  </CardTitle>
                  <CardDescription>
                    Brandurile care apar pe ecranul Kiosk-ului
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 mb-4">
                    <Input
                      placeholder="rollmaster, lovesushi, pokiwoki..."
                      value={newBrand}
                      onChange={e => setNewBrand(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && addBrand()}
                    />
                    <Button variant="secondary" onClick={addBrand}>
                      <Plus className="w-4 h-4 mr-2" /> Adaugă
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {brands.length === 0 && (
                      <span className="text-sm text-muted-foreground">
                        Niciun brand.
                      </span>
                    )}
                    {brands.map(b => (
                      <div
                        key={b}
                        className="bg-secondary text-secondary-foreground px-3 py-1.5 rounded-full text-sm flex items-center gap-2 font-medium"
                      >
                        {b}
                        <button
                          onClick={() => removeBrand(b)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Bannere */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <ImageIcon className="w-5 h-5 text-primary" /> Banner Sus
                    </CardTitle>
                    <CardDescription>
                      Afișat în antetul ecranului Kiosk
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label>URL Imagine</Label>
                      <Input
                        placeholder="https://..."
                        value={topBannerUrl}
                        onChange={e => setTopBannerUrl(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Înălțime (vh unități)</Label>
                      <Input
                        type="number"
                        value={topBannerHeight}
                        onChange={e =>
                          setTopBannerHeight(Number(e.target.value))
                        }
                        min={1}
                        max={30}
                      />
                    </div>
                    {topBannerUrl && (
                      <div className="rounded-lg overflow-hidden border border-border mt-2">
                        <img
                          src={topBannerUrl}
                          alt="Top Banner Preview"
                          className="w-full h-20 object-cover"
                          onError={e => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <ImageIcon className="w-5 h-5 text-primary" /> Banner Jos
                    </CardTitle>
                    <CardDescription>
                      Afișat în subsolul ecranului Kiosk
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label>URL Imagine</Label>
                      <Input
                        placeholder="https://..."
                        value={bottomBannerUrl}
                        onChange={e => setBottomBannerUrl(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Text Alternativ</Label>
                      <Input
                        placeholder="Text care apare dacă nu e imagine"
                        value={bottomBannerText}
                        onChange={e => setBottomBannerText(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Înălțime (vh)</Label>
                        <Input
                          type="number"
                          value={bottomBannerHeight}
                          onChange={e =>
                            setBottomBannerHeight(Number(e.target.value))
                          }
                          min={1}
                          max={20}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Background</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={bottomBannerBg}
                            onChange={e => setBottomBannerBg(e.target.value)}
                            className="w-12 p-1 h-9"
                          />
                          <Input
                            type="text"
                            value={bottomBannerBg}
                            onChange={e => setBottomBannerBg(e.target.value)}
                            className="font-mono text-xs"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Logo URL (opțional, apare în banner)</Label>
                      <Input
                        placeholder="https://..."
                        value={bottomBannerLogoUrl}
                        onChange={e => setBottomBannerLogoUrl(e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ──────── TAB: Screensaver ──────── */}
            <TabsContent value="screensaver" className="space-y-6 outline-none">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MonitorSmartphone className="w-5 h-5 text-primary" />{" "}
                    Screensaver / Poster
                  </CardTitle>
                  <CardDescription>
                    Video sau imagine care apare după 60s de inactivitate
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>URL Poster (MP4, JPG, PNG)</Label>
                    <Input
                      placeholder="https://cdn.example.com/screensaver.mp4"
                      value={posterUrl}
                      onChange={e => setPosterUrl(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Un MP4 va rula în buclă. O imagine va fi afișată pe tot
                      ecranul.
                    </p>
                  </div>
                  {posterUrl && (
                    <div className="rounded-lg overflow-hidden border border-border bg-black">
                      {posterUrl.endsWith(".mp4") ? (
                        <video
                          src={posterUrl}
                          autoPlay
                          loop
                          muted
                          className="w-full h-48 object-cover"
                        />
                      ) : (
                        <img
                          src={posterUrl}
                          alt="Poster Preview"
                          className="w-full h-48 object-cover"
                          onError={e => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      )}
                    </div>
                  )}

                  {/* Show kiosk configs from bridge */}
                  {kioskConfigs?.posters &&
                    Object.keys(kioskConfigs.posters).length > 0 && (
                      <div className="mt-4 p-4 bg-secondary/20 rounded-lg border border-border">
                        <p className="text-sm font-medium mb-2">
                          Configurări existente per brand:
                        </p>
                        {Object.entries(kioskConfigs.posters).map(
                          ([brandId, config]: [string, any]) => (
                            <div
                              key={brandId}
                              className="flex items-center gap-3 text-xs py-1"
                            >
                              <span className="font-bold text-primary">
                                {brandId}
                              </span>
                              <span className="text-muted-foreground">
                                {config.type}: {config.url?.substring(0, 60)}...
                              </span>
                              <span
                                className={
                                  config.enabled
                                    ? "text-green-600"
                                    : "text-red-500"
                                }
                              >
                                {config.enabled ? "Activ" : "Inactiv"}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ──────── TAB: Limbi & PIN ──────── */}
            <TabsContent value="language" className="space-y-6 outline-none">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Shield className="w-5 h-5 text-primary" /> Kiosk PIN
                    </CardTitle>
                    <CardDescription>
                      Protecție pentru ieșirea din modul kiosk
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Cod PIN Numeric</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="Ex: 1234"
                        value={kioskPin}
                        onChange={e => setKioskPin(e.target.value)}
                        className="font-mono text-lg tracking-widest"
                      />
                      <p className="text-xs text-muted-foreground">
                        Lasă gol pentru a dezactiva protecția.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Languages className="w-5 h-5 text-primary" /> Limbi
                      Suportate
                    </CardTitle>
                    <CardDescription>
                      Selectează limbile în care clienții pot folosi kiosk-ul
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-4">
                      {["ro", "en"].map(lang => (
                        <label
                          key={lang}
                          className="flex items-center gap-2 cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-primary rounded"
                            checked={langs.includes(lang)}
                            onChange={() => toggleLang(lang)}
                          />
                          <span className="uppercase font-semibold text-sm">
                            {lang === "ro" ? "🇷🇴 Română" : "🇬🇧 English"}
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <Label>Limba Default</Label>
                      <select
                        value={defaultLang}
                        onChange={e => setDefaultLang(e.target.value)}
                        className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm"
                      >
                        {langs.map(l => (
                          <option key={l} value={l}>
                            {l.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Culoare Buton Limbă</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={langButtonColor}
                            onChange={e => setLangButtonColor(e.target.value)}
                            className="w-12 p-1 h-9"
                          />
                          <Input
                            value={langButtonColor}
                            onChange={e => setLangButtonColor(e.target.value)}
                            className="font-mono text-xs"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Selector Poziție</Label>
                        <select
                          value={langSelectorPosition}
                          onChange={e =>
                            setLangSelectorPosition(e.target.value)
                          }
                          className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm"
                        >
                          <option value="before">Înainte de Welcome</option>
                          <option value="after">După Welcome</option>
                        </select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ──────── TAB: Syrve ──────── */}
            <TabsContent value="syrve" className="space-y-6 outline-none">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Blocks className="w-5 h-5 text-primary" /> Syrve (iiko)
                    Organization ID per Brand
                  </CardTitle>
                  <CardDescription>
                    Suprascrie ID-ul de organizație pentru fiecare brand activ
                    pe această locație.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {brands.length === 0 ? (
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      Adaugă branduri în tab-ul &quot;Branduri &amp;
                      Bannere&quot; mai întâi.
                    </p>
                  ) : (
                    brands.map(bId => (
                      <div
                        key={bId}
                        className="flex items-center gap-4 p-3 bg-secondary/20 rounded-lg border border-border"
                      >
                        <Label className="w-32 font-bold text-sm">{bId}</Label>
                        <Input
                          placeholder="Lăsați gol = ID-ul global din .env"
                          value={orgIds[bId] || ""}
                          onChange={e =>
                            setOrgIds({ ...orgIds, [bId]: e.target.value })
                          }
                          className="font-mono text-xs"
                        />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ──────── TAB: Promoții ──────── */}
            <TabsContent value="promo" className="space-y-6 outline-none">
              <Card className="border-primary/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Gift className="w-5 h-5 text-primary" /> Roata
                        Norocului
                      </CardTitle>
                      <CardDescription>
                        Activează promoția pe ecranul de comandă finalizată
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label>Activ</Label>
                      <input
                        type="checkbox"
                        checked={promoActive}
                        onChange={e => setPromoActive(e.target.checked)}
                        className="w-5 h-5 accent-primary"
                      />
                    </div>
                  </div>
                </CardHeader>
                {promoActive && (
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Brand Promoție</Label>
                        <select
                          value={promoBrandId}
                          onChange={e => setPromoBrandId(e.target.value)}
                          className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm"
                        >
                          <option value="">Toate brandurile</option>
                          {brands.map(b => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Valoare Min. Comandă (RON)</Label>
                        <Input
                          type="number"
                          value={promoMinOrder}
                          onChange={e =>
                            setPromoMinOrder(Number(e.target.value))
                          }
                          min={0}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Apare la fiecare X comenzi</Label>
                        <Input
                          type="number"
                          value={promoOrdersToAppear}
                          onChange={e =>
                            setPromoOrdersToAppear(Number(e.target.value))
                          }
                          min={1}
                        />
                      </div>
                    </div>

                    {/* Show existing promo configs from bridge */}
                    {promoData && Object.keys(promoData).length > 0 && (
                      <div className="mt-4 p-4 bg-secondary/20 rounded-lg border border-border">
                        <p className="text-sm font-medium mb-3">
                          Configurare Roată din Smart Kiosk:
                        </p>
                        {Object.entries(promoData).map(
                          ([brandId, config]: [string, any]) => (
                            <div key={brandId} className="mb-3">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-primary text-sm">
                                  {brandId}
                                </span>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full ${config.active ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400" : "bg-red-100 text-red-700"}`}
                                >
                                  {config.active ? "Activ" : "Inactiv"}
                                </span>
                              </div>
                              {config.config?.slices && (
                                <div className="grid grid-cols-4 gap-1 text-xs">
                                  {config.config.slices
                                    .slice(0, 8)
                                    .map((s: any, i: number) => (
                                      <div
                                        key={i}
                                        className="p-1.5 rounded text-center truncate"
                                        style={{
                                          backgroundColor: s.bg + "20",
                                          color: s.bg,
                                        }}
                                      >
                                        {s.name} ({s.probability?.toFixed(0)}%)
                                      </div>
                                    ))}
                                  {config.config.slices.length > 8 && (
                                    <span className="text-muted-foreground p-1.5">
                                      +{config.config.slices.length - 8} mai
                                      multe...
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      ) : (
        <div className="text-center text-muted-foreground py-12">
          Selectează o locație pentru a vedea setările.
        </div>
      )}
    </div>
  );
}
