// Settings — RefacturaRO
// Company profile, multi-currency, multi-language, multi-country, invoice defaults

import { useState } from "react";
import { Building2, Globe, FileText, Bell, Shield, Check, ChevronRight, Search, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  mockCompanySettings,
  currencies,
  languages,
  countries,
  type Currency,
  type Language,
  type Country,
  type CompanySettings,
} from "@/lib/store";

const tabs = [
  { id: "company", label: "Firmă", icon: Building2 },
  { id: "invoicing", label: "Facturare", icon: FileText },
  { id: "localization", label: "Localizare", icon: Globe },
  { id: "notifications", label: "Notificări", icon: Bell },
  { id: "security", label: "Securitate", icon: Shield },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState("company");
  const [settings, setSettings] = useState<CompanySettings>(mockCompanySettings);
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


  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success("Setări salvate", { description: "Modificările au fost aplicate" });
    }, 1000);
  };

  const update = (key: keyof CompanySettings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Setări</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Configurează firma, facturarea și preferințele</p>
      </div>

      <div className="flex gap-6 flex-col md:flex-row">
        {/* Sidebar tabs */}
        <div className="md:w-48 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4">
          {/* Company tab */}
          {activeTab === "company" && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-5">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Date Firmă</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SettingField label="Denumire firmă" value={settings.name} onChange={(v) => update("name", v)} placeholder="ConstructMaster SRL" autocomplete="organization" />
                {/* CUI with ANAF lookup */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">CUI / CIF</label>
                  <div className="flex gap-2">
                    <input
                      value={settings.cui}
                      onChange={(e) => { update("cui", e.target.value); setCuiLookupError(""); }}
                      onKeyDown={(e) => e.key === "Enter" && lookupCui()}
                      placeholder="RO12345678"
                      autoComplete="off"
                      className="flex-1 px-4 h-10 text-sm rounded-full border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 outline-none text-slate-900 dark:text-white transition-all"
                    />
                    <button
                      type="button"
                      onClick={lookupCui}
                      disabled={cuiLookupLoading || !settings.cui}
                      title="Caută date firmă după CUI (ANAF)"
                      className="flex items-center gap-1.5 px-3 h-10 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition-colors flex-shrink-0"
                    >
                      {cuiLookupLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      {cuiLookupLoading ? "Caută..." : "Auto-fill"}
                    </button>
                  </div>
                  {cuiLookupError && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-red-500">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {cuiLookupError}
                    </div>
                  )}
                  <p className="text-xs text-slate-400 mt-1">Apasă Auto-fill pentru a completa automat datele din ANAF</p>
                </div>
                <SettingField label="Reg. Com." value={settings.regCom} onChange={(v) => update("regCom", v)} placeholder="J40/1234/2020" mono />
                <SettingField label="Email" value={settings.email} onChange={(v) => update("email", v)} placeholder="office@firma.ro" autocomplete="email" />
                <SettingField label="Telefon" value={settings.phone} onChange={(v) => update("phone", v)} placeholder="+40 21 123 4567" autocomplete="tel" />
                <div className="md:col-span-2">
                  <SettingField label="Adresă" value={settings.address} onChange={(v) => update("address", v)} placeholder="Str. Exemplu nr. 1" />
                </div>
                <SettingField label="Oraș" value={settings.city} onChange={(v) => update("city", v)} placeholder="București" />
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Țară</label>
                  <select value={settings.country} onChange={(e) => update("country", e.target.value as Country)}
                    className="w-full h-10 px-4 text-sm rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
                    {countries.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Date Bancare</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SettingField label="IBAN" value={settings.iban} onChange={(v) => update("iban", v)} placeholder="RO49AAAA..." mono />
                  <SettingField label="Bancă" value={settings.bank} onChange={(v) => update("bank", v)} placeholder="BCR" />
                </div>
              </div>
            </div>
          )}

          {/* Invoicing tab */}
          {activeTab === "invoicing" && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-5">
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
                <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
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
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-5">
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
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-4">
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
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-4">
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
                className="flex items-center gap-2 px-6 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all active:scale-[0.97] disabled:opacity-60"
              >
                {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                Salvează setările
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
      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autocomplete || "on"}
        className={`w-full px-4 h-10 text-sm rounded-full border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 outline-none text-slate-900 dark:text-white transition-all`}
      />
    </div>
  );
}
