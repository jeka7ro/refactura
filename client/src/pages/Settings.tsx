// Settings — RefacturaRO
// Company profile, multi-currency, multi-language, multi-country, invoice defaults

import { useState, useEffect, useRef } from "react";
import { Building2, Globe, FileText, Bell, Shield, Check, ChevronRight, Search, Loader2, AlertCircle, Upload, X, Palette } from "lucide-react";
import { toast } from "sonner";
import {
  currencies,
  languages,
  countries,
  type Currency,
  type Language,
  type Country,
  type CompanySettings,
} from "@/lib/store";
import { trpc } from "@/lib/trpc";

const tabs = [
  { id: "company", label: "Firmă", icon: Building2 },
  { id: "invoicing", label: "Facturare", icon: FileText },
  { id: "appearance", label: "Aspect", icon: Palette },
  { id: "localization", label: "Localizare", icon: Globe },
  { id: "notifications", label: "Notificări", icon: Bell },
  { id: "security", label: "Securitate", icon: Shield },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState("company");
  const { data: userTenants = [], isLoading: isLoadingTenants } = trpc.tenants.list.useQuery();
  const currentTenant = userTenants[0];

  const [logoBase64, setLogoBase64] = useState<string>("");
  const logoInputRef = useRef<HTMLInputElement>(null);

  const THEMES = [
    { id: "blue",   label: "Albastru",       color: "#2563eb" },
    { id: "teal",   label: "Teal",           color: "#0d9488" },
    { id: "green",  label: "Verde",          color: "#16a34a" },
    { id: "rose",   label: "Roz",            color: "#e11d48" },
    { id: "violet", label: "Violet",         color: "#7c3aed" },
    { id: "orange", label: "Portocaliu",     color: "#ea580c" },
  ] as const;
  type ThemeId = typeof THEMES[number]["id"];

  const INVOICE_TEMPLATES = [
    { id: "classic", label: "Clasic",   desc: "Header înhăt, tabel cu borduri" },
    { id: "modern",  label: "Modern",   desc: "Bandă navy, badge albastru" },
    { id: "minimal", label: "Minimal",  desc: "Design curat, linii subtile" },
  ] as const;
  type TemplateId = typeof INVOICE_TEMPLATES[number]["id"];

  const [activeTheme, setActiveTheme] = useState<ThemeId>(() =>
    (localStorage.getItem("app-theme") as ThemeId) ?? "blue"
  );
  const [activeTemplate, setActiveTemplate] = useState<TemplateId>(() =>
    (localStorage.getItem("invoice-template") as TemplateId) ?? "classic"
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", activeTheme);
    localStorage.setItem("app-theme", activeTheme);
  }, [activeTheme]);

  useEffect(() => {
    localStorage.setItem("invoice-template", activeTemplate);
  }, [activeTemplate]);

  const [settings, setSettings] = useState<CompanySettings>(() => ({
    name: "",
    cui: "",
    regCom: "",
    address: "",
    city: "",
    county: "",
    country: "RO",
    email: "",
    phone: "",
    iban: "",
    bank: "",
    defaultCurrency: "RON",
    defaultLanguage: "ro",
    defaultVatRate: 19,
    invoicePrefix: "INV",
    invoiceStartNumber: 1,
    defaultDueDays: 15,
    defaultMarkupPercent: 20
  }));

  // Update settings when tenant data is loaded
  useEffect(() => {
    if (currentTenant && currentTenant.tenants) {
      let parsedSettings = {};
      try {
        if (currentTenant.tenants.settings) {
          parsedSettings = JSON.parse(currentTenant.tenants.settings);
        }
      } catch (e) {}

      setSettings(prev => ({
        ...prev,
        name: currentTenant.tenants.name || "",
        email: currentTenant.tenants.email || "",
        phone: currentTenant.tenants.phone || "",
        address: currentTenant.tenants.address || "",
        cui: currentTenant.tenants.cui || "",
        ...parsedSettings
      }));
      if ((parsedSettings as any).logoBase64) {
        setLogoBase64((parsedSettings as any).logoBase64);
      }
    }
  }, [currentTenant]);

  const [saving, setSaving] = useState(false);
  const [cuiLookupLoading, setCuiLookupLoading] = useState(false);
  const [cuiLookupError, setCuiLookupError] = useState("");

  const lookupCui = async () => {
    const cui = settings.cui.replace(/^RO/i, "").replace(/\s/g, "");
    if (!cui || cui.length < 2) return;
    setCuiLookupLoading(true);
    setCuiLookupError("");
    try {
      const res = await fetch(`/api/anaf/${cui}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setCuiLookupError(err.error || "CUI-ul nu a fost găsit în ANAF.");
        return;
      }
      const data = await res.json();
      if (data?.denumire) update("name", data.denumire);
      if (data?.adresa) update("address", data.adresa);
      if (data?.judet) update("city", data.judet);
      if (data?.nrRegCom) update("regCom", data.nrRegCom);
      if (data?.telefon) update("phone", data.telefon);
    } catch {
      setCuiLookupError("Eroare la căutare. Verificați conexiunea.");
    } finally {
      setCuiLookupLoading(false);
    }
  };


  const updateSettingsMutation = trpc.tenants.updateSettings.useMutation();

  const handleSave = async () => {
    setSaving(true);
    try {
      const settingsStr = JSON.stringify({
        regCom: settings.regCom,
        city: settings.city,
        county: settings.county,
        country: settings.country,
        iban: settings.iban,
        bank: settings.bank,
        defaultCurrency: settings.defaultCurrency,
        defaultLanguage: settings.defaultLanguage,
        defaultVatRate: settings.defaultVatRate,
        invoicePrefix: settings.invoicePrefix,
        invoiceStartNumber: settings.invoiceStartNumber,
        defaultDueDays: settings.defaultDueDays,
        defaultMarkupPercent: settings.defaultMarkupPercent,
        logoBase64: logoBase64 || ""
      });

      await updateSettingsMutation.mutateAsync({
        name: settings.name,
        cui: settings.cui,
        email: settings.email,
        phone: settings.phone,
        address: settings.address,
        settings: settingsStr,
      });

      toast.success("Setări salvate", { description: "Modificările au fost aplicate" });
    } catch (e: any) {
      toast.error("Eroare la salvare", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const update = (key: keyof CompanySettings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="p-3 sm:p-5 max-w-4xl mx-auto space-y-3">
      {/* Header */}
      <div>
        <h1 className="text-base font-bold text-slate-900 dark:text-white">Setări</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">Firmă, facturare și preferințe</p>
      </div>

      <div className="flex gap-4 flex-col md:flex-row">
        {/* Sidebar tabs */}
        <div className="md:w-40 flex-shrink-0">
          <nav className="space-y-0.5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    activeTab === tab.id
                      ? "bg-blue-600 text-white"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-3 min-w-0">
          {/* Company tab */}
          {activeTab === "company" && (
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3">
              <h2 className="text-xs font-bold text-slate-700 dark:text-white uppercase tracking-wide">Date Firmă</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <SettingField label="Denumire firmă" value={settings.name} onChange={(v) => update("name", v)} placeholder="ConstructMaster SRL" autocomplete="organization" />
                {/* CUI with ANAF lookup */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">CUI / CIF</label>
                  <div className="flex gap-1.5">
                    <input
                      value={settings.cui}
                      onChange={(e) => { update("cui", e.target.value); setCuiLookupError(""); }}
                      onKeyDown={(e) => e.key === "Enter" && lookupCui()}
                      placeholder="RO12345678"
                      autoComplete="off"
                      className="flex-1 px-3 h-8 text-xs rounded-lg border border-slate-200 dark:border-slate-700 focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-800 outline-none text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={lookupCui}
                      disabled={cuiLookupLoading || !settings.cui}
                      title="Caută date firmă după CUI (ANAF)"
                      className="flex items-center gap-1 px-2.5 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[10px] font-bold transition-colors flex-shrink-0"
                    >
                      {cuiLookupLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                      Auto-fill
                    </button>
                  </div>
                  {cuiLookupError && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-red-500">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {cuiLookupError}
                    </div>
                  )}
                </div>
                <SettingField label="Reg. Com." value={settings.regCom} onChange={(v) => update("regCom", v)} placeholder="J40/1234/2020" mono />
                <SettingField label="Email" value={settings.email} onChange={(v) => update("email", v)} placeholder="office@firma.ro" autocomplete="email" />
                <SettingField label="Telefon" value={settings.phone} onChange={(v) => update("phone", v)} placeholder="+40 21 123 4567" autocomplete="tel" />
                <div className="md:col-span-2">
                  <SettingField label="Adresă" value={settings.address} onChange={(v) => update("address", v)} placeholder="Str. Exemplu nr. 1" />
                </div>
                <SettingField label="Oraș" value={settings.city} onChange={(v) => update("city", v)} placeholder="București" />
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Țară</label>
                  <select value={settings.country} onChange={(e) => update("country", e.target.value as Country)}
                    className="w-full h-8 px-3 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500">
                    {countries.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Date Bancare</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <SettingField label="IBAN" value={settings.iban} onChange={(v) => update("iban", v)} placeholder="RO49AAAA..." mono />
                  <SettingField label="Bancă" value={settings.bank} onChange={(v) => update("bank", v)} placeholder="BCR" />
                </div>
              </div>

              {/* Logo firmă */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Logo Firmă</h3>
                <div className="flex items-center gap-3">
                  {logoBase64 ? (
                    <div className="relative">
                      <img src={logoBase64} alt="Logo" className="h-10 w-auto max-w-[100px] object-contain rounded-lg border border-slate-200 dark:border-slate-700 p-1 bg-white" />
                      <button
                        type="button"
                        onClick={() => setLogoBase64("")}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-10 w-24 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 text-[10px]">
                      Niciun logo
                    </div>
                  )}
                  <div>
                    <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 2 * 1024 * 1024) { alert("Logo prea mare. Max 2MB."); return; }
                        const reader = new FileReader();
                        reader.onload = (ev) => setLogoBase64(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      }}
                    />
                    <button type="button" onClick={() => logoInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors">
                      <Upload className="w-3 h-3" />
                      {logoBase64 ? "Schimbă" : "Încarcă"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Appearance tab */}
          {activeTab === "appearance" && (
            <div className="space-y-3">
              {/* Tema culori */}
              <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                <h2 className="text-xs font-bold text-slate-700 dark:text-white uppercase tracking-wide mb-3">Culoare interfață</h2>
                <div className="flex flex-wrap items-center gap-2">
                  {THEMES.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveTheme(t.id)}
                      title={t.label}
                      style={{ background: t.color }}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                        activeTheme === t.id ? "ring-2 ring-offset-1 ring-slate-400" : "opacity-70 hover:opacity-100"
                      }`}
                    >
                      {activeTheme === t.id && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                  <span className="text-xs text-slate-400 ml-1">
                    {THEMES.find(t => t.id === activeTheme)?.label}
                  </span>
                </div>
              </div>

              {/* Sablon factura */}
              <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                <h2 className="text-xs font-bold text-slate-700 dark:text-white uppercase tracking-wide mb-3">Model factură PDF</h2>
                <div className="grid grid-cols-3 gap-2">
                  {INVOICE_TEMPLATES.map(tmpl => (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => setActiveTemplate(tmpl.id)}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        activeTemplate === tmpl.id
                          ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                      }`}
                    >
                      {/* Preview compact */}
                      <div className={`w-full h-10 rounded mb-2 flex items-center justify-center ${
                        tmpl.id === "classic" ? "bg-slate-900" :
                        tmpl.id === "modern"  ? "bg-gradient-to-br from-slate-900 to-blue-900" :
                        "bg-white border border-slate-200"
                      }`}>
                        <FileText className={`w-5 h-5 ${
                          tmpl.id === "minimal" ? "text-slate-400" : "text-white"
                        }`} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{tmpl.label}</span>
                        {activeTemplate === tmpl.id && <Check className="w-3.5 h-3.5 text-blue-600" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Invoicing tab */}
          {activeTab === "invoicing" && (
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-5">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Setări Facturare</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SettingField label="Prefix re-factură" value={settings.invoicePrefix} onChange={(v) => update("invoicePrefix", v)} placeholder="RF" mono />
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Număr start</label>
                  <input type="number" value={settings.invoiceStartNumber} onChange={(e) => update("invoiceStartNumber", +e.target.value)}
                    className="w-full px-4 h-10 text-sm rounded-full border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 outline-none text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Zile scadență implicite</label>
                  <input type="number" value={settings.defaultDueDays} onChange={(e) => update("defaultDueDays", +e.target.value)}
                    className="w-full px-4 h-10 text-sm rounded-full border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 outline-none text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Adaos implicit (%)</label>
                  <input type="number" value={settings.defaultMarkupPercent} onChange={(e) => update("defaultMarkupPercent", +e.target.value)}
                    className="w-full px-4 h-10 text-sm rounded-full border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 outline-none text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Cotă TVA implicită (%)</label>
                  <select value={settings.defaultVatRate} onChange={(e) => update("defaultVatRate", +e.target.value)}
                    className="w-full h-10 px-4 text-sm rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
                    <option value={19}>19% — Standard</option>
                    <option value={9}>9% — Redusă</option>
                    <option value={5}>5% — Super-redusă</option>
                    <option value={0}>0% — Scutit</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Previzualizare numerotare</div>
                <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {settings.invoicePrefix}-2024-{String(settings.invoiceStartNumber).padStart(4, "0")}
                  </span>
                  <span className="text-xs text-slate-400">→ prima re-factură</span>
                </div>
              </div>
            </div>
          )}

          {/* Localization tab */}
          {activeTab === "localization" && (
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-5">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Localizare & Multi-Currency</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Monedă implicită</label>
                  <select value={settings.defaultCurrency} onChange={(e) => update("defaultCurrency", e.target.value as Currency)}
                    className="w-full h-10 px-4 text-sm rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
                    {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Limbă implicită facturi</label>
                  <select value={settings.defaultLanguage} onChange={(e) => update("defaultLanguage", e.target.value as Language)}
                    className="w-full h-10 px-4 text-sm rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
                    {languages.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Monede suportate</div>
                <div className="flex flex-wrap gap-2">
                  {currencies.map((c) => (
                    <div key={c} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                      c === settings.defaultCurrency
                        ? "bg-blue-50 text-blue-600 border-blue-200"
                        : "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                    }`}>
                      {c} {c === settings.defaultCurrency && "✓"}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Țări suportate</div>
                <div className="flex flex-wrap gap-2">
                  {countries.map((c) => (
                    <div key={c.code} className="px-3 py-1.5 rounded-full text-xs font-bold border bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                      {c.flag} {c.label}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2">Mai multe țări vor fi adăugate în versiunile viitoare.</p>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Limbi facturi</div>
                <div className="flex flex-wrap gap-2">
                  {languages.map((l) => (
                    <div key={l.code} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                      l.code === settings.defaultLanguage
                        ? "bg-blue-50 text-blue-600 border-blue-200"
                        : "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                    }`}>
                      {l.label} {l.code === settings.defaultLanguage && "✓"}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Notifications tab */}
          {activeTab === "notifications" && (
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Notificări</h2>
              {[
                { label: "Factură nouă importată", desc: "Notificare la fiecare import automat", enabled: true },
                { label: "Re-factură achitată", desc: "Când un client marchează plata", enabled: true },
                { label: "Scadență apropiată", desc: "Cu 3 zile înainte de scadență", enabled: true },
                { label: "Re-factură restantă", desc: "Când o factură depășește scadența", enabled: false },
                { label: "Eroare sincronizare", desc: "Când o integrare eșuează", enabled: true },
              ].map((notif, idx) => (
                <div key={idx} className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{notif.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{notif.desc}</div>
                  </div>
                  <button
                    onClick={() => toast.info("Setare actualizată")}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${notif.enabled ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-700"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${notif.enabled ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Security tab */}
          {activeTab === "security" && (
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Securitate</h2>
              {[
                { label: "Schimbă parola", desc: "Actualizează parola contului tău", action: "Schimbă" },
                { label: "Autentificare în doi pași (2FA)", desc: "Adaugă un strat extra de securitate", action: "Activează" },
                { label: "Sesiuni active", desc: "Gestionează dispozitivele conectate", action: "Vezi" },
                { label: "Log activitate", desc: "Istoricul acțiunilor din cont", action: "Descarcă" },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{item.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{item.desc}</div>
                  </div>
                  <button
                    onClick={() => toast.info(item.label, { description: "Funcție disponibilă în curând" })}
                    className="flex items-center gap-1.5 px-4 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors"
                  >
                    {item.action}
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Save button */}
          {(activeTab === "company" || activeTab === "invoicing" || activeTab === "localization") && (
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-60"
              >
                {saving ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-3 h-3" />}
                Salvează
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingField({ label, value, onChange, placeholder, mono, autocomplete }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  autocomplete?: string;
}) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autocomplete || "on"}
        className={`w-full px-3 h-8 text-xs rounded-lg border border-slate-200 dark:border-slate-700 focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-800 outline-none text-slate-900 dark:text-white transition-all${mono ? " font-mono" : ""}`}
      />
    </div>
  );
}
