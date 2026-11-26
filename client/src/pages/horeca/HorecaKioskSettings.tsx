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
      toast.success("Setări actualizate pe Smart Kiosk!");
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
    <div className="max-w-full space-y-4 overflow-x-hidden fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-0.5">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
            Setări Kiosk
          </h1>
          <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums">
            Conectat la{" "}
            <span className="text-primary font-semibold">Smart Kiosk API</span>{" "}
            —{" "}
            <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
              {bridgeLocations.length}
            </strong>{" "}
            locații
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              refetchLocations();
              if (selectedLocationId) refetchDetail();
            }}
            className="apple-btn-glass inline-flex items-center gap-1.5 px-3.5 h-9 text-xs font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
          >
            <RefreshCcw className="w-3.5 h-3.5" /> Reîncarcă
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={updateMut.isPending || !selectedLocationId}
            className="apple-btn-prominent inline-flex items-center gap-1.5 px-4 h-9 text-xs font-semibold text-white disabled:opacity-40 cursor-pointer"
          >
            {updateMut.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Salvează pe Smart Kiosk
          </button>
        </div>
      </div>

      {/* Location Selector */}
      <div className="apple-surface p-4 sm:p-5">
        <label className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1.5 block">
          Selectează locația Smart Kiosk
        </label>
        <select
          value={selectedLocationId || ""}
          onChange={e => setSelectedLocationId(e.target.value)}
          className="apple-pill-control w-full h-9 px-3.5 text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] focus:outline-none cursor-pointer"
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
      </div>

      {/* Main content */}
      {loadingDetail && selectedLocationId ? (
        <div className="p-8 flex justify-center">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : selectedLocationId ? (
        <Tabs defaultValue="aspect" className="w-full">
          <div className="apple-surface px-3 py-2.5 mb-4">
            <TabsList className="apple-segmented grid w-full grid-cols-2 sm:grid-cols-5 h-auto p-1 !rounded-2xl sm:!rounded-full">
              <TabsTrigger
                value="aspect"
                className="py-1.5 rounded-full text-xs font-medium"
              >
                Branduri & bannere
              </TabsTrigger>
              <TabsTrigger
                value="screensaver"
                className="py-1.5 rounded-full text-xs font-medium"
              >
                Screensaver
              </TabsTrigger>
              <TabsTrigger
                value="language"
                className="py-1.5 rounded-full text-xs font-medium"
              >
                Limbi & PIN
              </TabsTrigger>
              <TabsTrigger
                value="syrve"
                className="py-1.5 rounded-full text-xs font-medium"
              >
                Syrve (iiko)
              </TabsTrigger>
              <TabsTrigger
                value="promo"
                className="py-1.5 rounded-full text-xs font-medium col-span-2 sm:col-span-1"
              >
                Promoții
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="mt-4">
            {/* ──────── TAB: Branduri & Bannere ──────── */}
            <TabsContent value="aspect" className="space-y-4 outline-none">
              {/* Branduri Active */}
              <Card className="apple-surface border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[16px] text-[#1d1d1f] dark:text-[#f5f5f7]">
                    <Settings className="w-4 h-4 text-primary" /> Branduri
                    active — {selectedLocName}
                  </CardTitle>
                  <CardDescription className="text-[#6e6e73] dark:text-[#98989d] text-xs">
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
                      className="apple-input h-9"
                    />
                    <button
                      type="button"
                      onClick={addBrand}
                      className="apple-btn-glass inline-flex items-center px-4 h-9 text-xs font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1.5" /> Adaugă
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {brands.length === 0 && (
                      <span className="text-xs text-[#6e6e73] dark:text-[#98989d]">
                        Niciun brand.
                      </span>
                    )}
                    {brands.map(b => (
                      <div
                        key={b}
                        className="bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#ebebf5] px-3 py-1 rounded-full text-xs flex items-center gap-2 font-medium border border-black/[0.06] dark:border-white/[0.08]"
                      >
                        {b}
                        <button
                          type="button"
                          onClick={() => removeBrand(b)}
                          className="text-[#8e8e93] hover:text-[#ff3b30] cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Bannere */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="apple-surface border-0">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[16px] text-[#1d1d1f] dark:text-[#f5f5f7]">
                      <ImageIcon className="w-4 h-4 text-primary" /> Banner sus
                    </CardTitle>
                    <CardDescription className="text-[#6e6e73] dark:text-[#98989d] text-xs">
                      Afișat în antetul ecranului Kiosk
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-[#6e6e73] dark:text-[#98989d]">URL imagine</Label>
                      <Input
                        placeholder="https://..."
                        value={topBannerUrl}
                        onChange={e => setTopBannerUrl(e.target.value)}
                        className="apple-input h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-[#6e6e73] dark:text-[#98989d]">Înălțime (vh unități)</Label>
                      <Input
                        type="number"
                        value={topBannerHeight}
                        onChange={e =>
                          setTopBannerHeight(Number(e.target.value))
                        }
                        min={1}
                        max={30}
                        className="apple-input h-9 tabular-nums"
                      />
                    </div>
                    {topBannerUrl && (
                      <div className="rounded-xl overflow-hidden border border-black/[0.08] dark:border-white/[0.10] mt-2">
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

                <Card className="apple-surface border-0">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[16px] text-[#1d1d1f] dark:text-[#f5f5f7]">
                      <ImageIcon className="w-4 h-4 text-primary" /> Banner jos
                    </CardTitle>
                    <CardDescription className="text-[#6e6e73] dark:text-[#98989d] text-xs">
                      Afișat în subsolul ecranului Kiosk
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-[#6e6e73] dark:text-[#98989d]">URL imagine</Label>
                      <Input
                        placeholder="https://..."
                        value={bottomBannerUrl}
                        onChange={e => setBottomBannerUrl(e.target.value)}
                        className="apple-input h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-[#6e6e73] dark:text-[#98989d]">Text alternativ</Label>
                      <Input
                        placeholder="Text care apare dacă nu e imagine"
                        value={bottomBannerText}
                        onChange={e => setBottomBannerText(e.target.value)}
                        className="apple-input h-9"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-[#6e6e73] dark:text-[#98989d]">Înălțime (vh)</Label>
                        <Input
                          type="number"
                          value={bottomBannerHeight}
                          onChange={e =>
                            setBottomBannerHeight(Number(e.target.value))
                          }
                          min={1}
                          max={20}
                          className="apple-input h-9 tabular-nums"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-[#6e6e73] dark:text-[#98989d]">Background</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={bottomBannerBg}
                            onChange={e => setBottomBannerBg(e.target.value)}
                            className="w-12 p-1 h-9 rounded-lg"
                          />
                          <Input
                            type="text"
                            value={bottomBannerBg}
                            onChange={e => setBottomBannerBg(e.target.value)}
                            className="apple-input h-9 tabular-nums text-xs"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-[#6e6e73] dark:text-[#98989d]">Logo URL (opțional, apare în banner)</Label>
                      <Input
                        placeholder="https://..."
                        value={bottomBannerLogoUrl}
                        onChange={e => setBottomBannerLogoUrl(e.target.value)}
                        className="apple-input h-9"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ──────── TAB: Screensaver ──────── */}
            <TabsContent value="screensaver" className="space-y-4 outline-none">
              <Card className="apple-surface border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[16px] text-[#1d1d1f] dark:text-[#f5f5f7]">
                    <MonitorSmartphone className="w-4 h-4 text-primary" />{" "}
                    Screensaver / poster
                  </CardTitle>
                  <CardDescription className="text-[#6e6e73] dark:text-[#98989d] text-xs">
                    Video sau imagine care apare după 60s de inactivitate
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#6e6e73] dark:text-[#98989d]">URL poster (MP4, JPG, PNG)</Label>
                    <Input
                      placeholder="https://cdn.example.com/screensaver.mp4"
                      value={posterUrl}
                      onChange={e => setPosterUrl(e.target.value)}
                      className="apple-input h-9"
                    />
                    <p className="text-xs text-[#6e6e73] dark:text-[#98989d]">
                      Un MP4 va rula în buclă. O imagine va fi afișată pe tot
                      ecranul.
                    </p>
                  </div>
                  {posterUrl && (
                    <div className="rounded-xl overflow-hidden border border-black/[0.08] dark:border-white/[0.10] bg-black">
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

                  {kioskConfigs?.posters &&
                    Object.keys(kioskConfigs.posters).length > 0 && (
                      <div className="mt-4 p-4 bg-[#f2f2f7] dark:bg-[#2c2c2e] rounded-xl border border-black/[0.06] dark:border-white/[0.08]">
                        <p className="text-xs font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-2">
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
                              <span className="text-[#6e6e73] dark:text-[#98989d] truncate">
                                {config.type}: {config.url?.substring(0, 60)}...
                              </span>
                              <span
                                className={
                                  config.enabled
                                    ? "text-emerald-600 dark:text-emerald-400 font-medium"
                                    : "text-[#ff3b30] dark:text-[#ff453a] font-medium"
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
            <TabsContent value="language" className="space-y-4 outline-none">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="apple-surface border-0">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[16px] text-[#1d1d1f] dark:text-[#f5f5f7]">
                      <Shield className="w-4 h-4 text-primary" /> Kiosk PIN
                    </CardTitle>
                    <CardDescription className="text-[#6e6e73] dark:text-[#98989d] text-xs">
                      Protecție pentru ieșirea din modul kiosk
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-[#6e6e73] dark:text-[#98989d]">Cod PIN numeric</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="Ex: 1234"
                        value={kioskPin}
                        onChange={e => setKioskPin(e.target.value)}
                        className="apple-input h-10 tabular-nums text-lg tracking-widest"
                      />
                      <p className="text-xs text-[#6e6e73] dark:text-[#98989d]">
                        Lasă gol pentru a dezactiva protecția.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="apple-surface border-0">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[16px] text-[#1d1d1f] dark:text-[#f5f5f7]">
                      <Languages className="w-4 h-4 text-primary" /> Limbi
                      suportate
                    </CardTitle>
                    <CardDescription className="text-[#6e6e73] dark:text-[#98989d] text-xs">
                      Selectează limbile în care clienții pot folosi kiosk-ul
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-4">
                      {["ro", "en"].map(lang => (
                        <label
                          key={lang}
                          className="flex items-center gap-2 cursor-pointer select-none text-[#1d1d1f] dark:text-[#ebebf5]"
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-primary rounded"
                            checked={langs.includes(lang)}
                            onChange={() => toggleLang(lang)}
                          />
                          <span className="font-semibold text-xs">
                            {lang === "ro" ? "Română" : "English"}
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-[#6e6e73] dark:text-[#98989d]">Limba implicită</Label>
                      <select
                        value={defaultLang}
                        onChange={e => setDefaultLang(e.target.value)}
                        className="apple-input w-full h-9 px-3 text-sm cursor-pointer"
                      >
                        {langs.map(l => (
                          <option key={l} value={l}>
                            {l.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-[#6e6e73] dark:text-[#98989d]">Culoare buton limbă</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={langButtonColor}
                            onChange={e => setLangButtonColor(e.target.value)}
                            className="w-12 p-1 h-9 rounded-lg"
                          />
                          <Input
                            value={langButtonColor}
                            onChange={e => setLangButtonColor(e.target.value)}
                            className="apple-input h-9 tabular-nums text-xs"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-[#6e6e73] dark:text-[#98989d]">Selector poziție</Label>
                        <select
                          value={langSelectorPosition}
                          onChange={e =>
                            setLangSelectorPosition(e.target.value)
                          }
                          className="apple-input w-full h-9 px-3 text-sm cursor-pointer"
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
            <TabsContent value="syrve" className="space-y-4 outline-none">
              <Card className="apple-surface border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[16px] text-[#1d1d1f] dark:text-[#f5f5f7]">
                    <Blocks className="w-4 h-4 text-primary" /> Syrve (iiko)
                    Organization ID per brand
                  </CardTitle>
                  <CardDescription className="text-[#6e6e73] dark:text-[#98989d] text-xs">
                    Suprascrie ID-ul de organizație pentru fiecare brand activ
                    pe această locație.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {brands.length === 0 ? (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Adaugă branduri în tab-ul &quot;Branduri &amp;
                      bannere&quot; mai întâi.
                    </p>
                  ) : (
                    brands.map(bId => (
                      <div
                        key={bId}
                        className="flex items-center gap-4 p-3 bg-[#f2f2f7] dark:bg-[#2c2c2e] rounded-xl border border-black/[0.06] dark:border-white/[0.08]"
                      >
                        <Label className="w-32 font-semibold text-xs text-[#1d1d1f] dark:text-[#f5f5f7]">{bId}</Label>
                        <Input
                          placeholder="Lăsați gol = ID-ul global din .env"
                          value={orgIds[bId] || ""}
                          onChange={e =>
                            setOrgIds({ ...orgIds, [bId]: e.target.value })
                          }
                          className="apple-input h-9 tabular-nums text-xs bg-white dark:bg-[#1c1c1e]"
                        />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ──────── TAB: Promoții ──────── */}
            <TabsContent value="promo" className="space-y-4 outline-none">
              <Card className="apple-surface border-0">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-[16px] text-[#1d1d1f] dark:text-[#f5f5f7]">
                        <Gift className="w-4 h-4 text-primary" /> Roata
                        norocului
                      </CardTitle>
                      <CardDescription className="text-[#6e6e73] dark:text-[#98989d] text-xs">
                        Activează promoția pe ecranul de comandă finalizată
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-[#1d1d1f] dark:text-[#ebebf5]">Activ</Label>
                      <input
                        type="checkbox"
                        checked={promoActive}
                        onChange={e => setPromoActive(e.target.checked)}
                        className="w-4 h-4 accent-primary"
                      />
                    </div>
                  </div>
                </CardHeader>
                {promoActive && (
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-[#6e6e73] dark:text-[#98989d]">Brand promoție</Label>
                        <select
                          value={promoBrandId}
                          onChange={e => setPromoBrandId(e.target.value)}
                          className="apple-input w-full h-9 px-3 text-sm cursor-pointer"
                        >
                          <option value="">Toate brandurile</option>
                          {brands.map(b => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-[#6e6e73] dark:text-[#98989d]">Valoare min. comandă (RON)</Label>
                        <Input
                          type="number"
                          value={promoMinOrder}
                          onChange={e =>
                            setPromoMinOrder(Number(e.target.value))
                          }
                          min={0}
                          className="apple-input h-9 tabular-nums"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-[#6e6e73] dark:text-[#98989d]">Apare la fiecare X comenzi</Label>
                        <Input
                          type="number"
                          value={promoOrdersToAppear}
                          onChange={e =>
                            setPromoOrdersToAppear(Number(e.target.value))
                          }
                          min={1}
                          className="apple-input h-9 tabular-nums"
                        />
                      </div>
                    </div>

                    {promoData && Object.keys(promoData).length > 0 && (
                      <div className="mt-4 p-4 bg-[#f2f2f7] dark:bg-[#2c2c2e] rounded-xl border border-black/[0.06] dark:border-white/[0.08]">
                        <p className="text-xs font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-3">
                          Configurare roată din Smart Kiosk:
                        </p>
                        {Object.entries(promoData).map(
                          ([brandId, config]: [string, any]) => (
                            <div key={brandId} className="mb-3">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="font-bold text-primary text-xs">
                                  {brandId}
                                </span>
                                <span
                                  className={`text-[10.5px] font-medium px-2 py-0.5 rounded-full ${config.active ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" : "bg-[#ff3b30]/12 text-[#d70015] dark:text-[#ff6961]"}`}
                                >
                                  {config.active ? "Activ" : "Inactiv"}
                                </span>
                              </div>
                              {config.config?.slices && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs tabular-nums">
                                  {config.config.slices
                                    .slice(0, 8)
                                    .map((s: any, i: number) => (
                                      <div
                                        key={i}
                                        className="p-1.5 rounded-lg text-center truncate font-medium"
                                        style={{
                                          backgroundColor: s.bg + "20",
                                          color: s.bg,
                                        }}
                                      >
                                        {s.name} ({s.probability?.toFixed(0)}%)
                                      </div>
                                    ))}
                                  {config.config.slices.length > 8 && (
                                    <span className="text-[#6e6e73] dark:text-[#98989d] p-1.5">
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
        <div className="apple-surface text-center text-[#6e6e73] dark:text-[#98989d] text-sm py-12">
          Selectează o locație pentru a vedea setările.
        </div>
      )}
    </div>
  );
}
