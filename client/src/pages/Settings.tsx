// Settings — RefacturaRO
// Company profile, multi-currency, multi-language, multi-country, invoice defaults

import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Building2,
  User,
  Globe,
  FileText,
  Bell,
  Shield,
  Check,
  ChevronRight,
  Search,
  Loader2,
  AlertCircle,
  Upload,
  X,
  Palette,
  Plus,
  Trash2,
  Image as ImageIcon,
  Lock,
  ShieldCheck,
  KeyRound,
  Copy,
  ExternalLink,
  LayoutGrid,
  Database,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  currencies,
  languages,
  countries,
  type Currency,
  type Language,
  type Country,
  type CompanySettings,
  type BankAccount,
} from "@/lib/store";
import { trpc } from "@/lib/trpc";

const tabs = [
  { id: "company", label: "Firmă", icon: Building2 },
  { id: "pf", label: "Persoană Fizică", icon: User },
  { id: "invoicing", label: "Facturare", icon: FileText },
  { id: "appearance", label: "Aspect", icon: Palette },
  { id: "localization", label: "Localizare", icon: Globe },
  { id: "notifications", label: "Notificări", icon: Bell },
  { id: "security", label: "Securitate", icon: Shield },
  { id: "accountant", label: "Portal Contabil", icon: ShieldCheck },
  { id: "gdpr", label: "GDPR & Date", icon: Shield },
];

function parseBankAccountsFromSettings(parsedSettings: any): BankAccount[] {
  const accounts: BankAccount[] = [];
  if (
    parsedSettings?.bankAccounts &&
    Array.isArray(parsedSettings.bankAccounts) &&
    parsedSettings.bankAccounts.length > 0
  ) {
    accounts.push(...parsedSettings.bankAccounts.map((a: any) => ({ ...a })));
  } else {
    accounts.push({
      id: "acc_ron",
      currency: "RON",
      iban: parsedSettings?.iban || "",
      bank: parsedSettings?.bank || "",
      isDefault: true,
    });
    if (parsedSettings?.ibanEur) {
      accounts.push({
        id: "acc_eur",
        currency: "EUR",
        iban: parsedSettings.ibanEur,
        bank: parsedSettings.bankEur || "",
        isDefault: false,
      });
    }
  }
  if (accounts.length > 0) {
    accounts[0] = { ...accounts[0], currency: "RON", isDefault: true };
  }
  return accounts;
}

export default function Settings() {
  const [location] = useLocation();
  const search = useSearch();
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const qTab = new URLSearchParams(search || window.location.search).get("tab");
      if (qTab && tabs.some((t) => t.id === qTab)) return qTab;
    } catch {}
    return "company";
  });

  useEffect(() => {
    try {
      const qTab = new URLSearchParams(search || window.location.search).get("tab");
      if (qTab && tabs.some((t) => t.id === qTab)) {
        setActiveTab(qTab);
      }
    } catch {}
  }, [location, search]);
  const { data: currentTenantData, isLoading: isLoadingTenants } =
    trpc.tenants.current.useQuery();
  const { data: entityPair } = trpc.tenants.getEntityPair.useQuery();
  const hasAutoSelectedTabRef = useRef(false);
  useEffect(() => {
    if (hasAutoSelectedTabRef.current || !entityPair) return;
    try {
      const qTab = new URLSearchParams(window.location.search).get("tab");
      if (qTab) {
        hasAutoSelectedTabRef.current = true;
        return;
      }
    } catch {}
    hasAutoSelectedTabRef.current = true;
    if (entityPair.activeType === "pf") {
      setActiveTab("pf");
    }
  }, [entityPair?.activeType]);

  const currentTenant = useMemo(() => {
    if (currentTenantData) return { tenants: currentTenantData };
    return null;
  }, [currentTenantData]);
  const firmData = useMemo(
    () =>
      entityPair?.pj ||
      (entityPair?.activeType !== "pf" ? currentTenantData : null),
    [entityPair, currentTenantData]
  );

  const switchingToTypeRef = useRef<"pj" | "pf">("pj");

  const applyTenantSessionAndNavigate = (
    token?: string,
    targetTenantId?: number,
    targetType?: "pj" | "pf",
    successMsg?: string
  ) => {
    if (token) {
      localStorage.setItem("authToken", token);
    }
    try {
      localStorage.removeItem("tenant-theme-color");
      const savedPinEntries: [string, string][] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith("smart_invoice_unlocked_pin_")) {
          const v = sessionStorage.getItem(k);
          if (v) savedPinEntries.push([k, v]);
        }
      }
      sessionStorage.clear();
      for (const [k, v] of savedPinEntries) {
        sessionStorage.setItem(k, v);
      }
      if (
        targetTenantId &&
        sessionStorage.getItem(`smart_invoice_unlocked_pin_${targetTenantId}`) === "true"
      ) {
        sessionStorage.setItem("smart_invoice_pin_session_unlocked", String(targetTenantId));
      }
    } catch {}
    if (successMsg) {
      toast.success(successMsg);
    }
    window.location.href = targetType === "pf" ? "/setari?tab=pf" : "/setari?tab=company";
  };

  const switchTenantMutation = trpc.tenants.switchTenant.useMutation({
    onSuccess: (data) => {
      applyTenantSessionAndNavigate(
        data?.token,
        data?.tenantId,
        switchingToTypeRef.current,
        "Profilul activ a fost schimbat."
      );
    },
    onError: (err: any) => {
      toast.error(err?.message || "Eroare la schimbarea profilului.");
    },
  });

  const [logoBase64, setLogoBase64] = useState<string>("");
  const [logoHasBackground, setLogoHasBackground] = useState<boolean>(false);
  const [logoBgColor, setLogoBgColor] = useState<string>("#0f172a");
  const logoInputRef = useRef<HTMLInputElement>(null);

  const THEMES = [
    { id: "blue", label: "Albastru", color: "#2563eb" },
    { id: "teal", label: "Teal", color: "#0d9488" },
    { id: "green", label: "Verde", color: "#16a34a" },
    { id: "rose", label: "Roz", color: "#e11d48" },
    { id: "violet", label: "Violet", color: "#7c3aed" },
    { id: "navy", label: "Navy", color: "#003366" },
  ] as const;
  type ThemeId = (typeof THEMES)[number]["id"] | "custom";

  const INVOICE_TEMPLATES = [
    { id: "classic", label: "Clasic", desc: "Header înhăt, tabel cu borduri" },
    { id: "modern", label: "Modern", desc: "Bandă navy, badge albastru" },
    { id: "minimal", label: "Minimal", desc: "Design curat, linii subtile" },
  ] as const;
  type TemplateId = (typeof INVOICE_TEMPLATES)[number]["id"];

  const [activeTheme, setActiveTheme] = useState<ThemeId>(
    () => (localStorage.getItem("app-theme") as ThemeId) ?? "green"
  );
  const [themeColor, setThemeColor] = useState<string>(() => {
    const fromStorage = localStorage.getItem("tenant-theme-color");
    if (fromStorage) return fromStorage;
    const savedTheme = (localStorage.getItem("app-theme") as ThemeId) || "green";
    return THEMES.find(t => t.id === savedTheme)?.color || "#16a34a";
  });
  const [activeTemplate, setActiveTemplate] = useState<TemplateId>(() => {
    const saved = localStorage.getItem("invoice-template") as TemplateId;
    return saved === "modern" ? "classic" : (saved ?? "classic");
  });

  const isCustomColor = useMemo(
    () => !THEMES.some(t => t.color.toLowerCase() === themeColor.toLowerCase()),
    [themeColor]
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", activeTheme);
    localStorage.setItem("app-theme", activeTheme);
  }, [activeTheme]);

  useEffect(() => {
    localStorage.setItem("invoice-template", activeTemplate);
  }, [activeTemplate]);

  const saveAppearance = async (
    newTheme: ThemeId,
    newColor: string,
    newTemplate: TemplateId = activeTemplate
  ) => {
    setActiveTheme(newTheme);
    setThemeColor(newColor);
    setActiveTemplate(newTemplate);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("app-theme", newTheme);
    localStorage.setItem("tenant-theme-color", newColor);
    localStorage.setItem("invoice-template", newTemplate);

    if (newColor) {
      document.documentElement.style.setProperty("--primary", newColor);
      document.documentElement.style.setProperty("--sidebar-primary", newColor);
      document.documentElement.style.setProperty("--color-primary", newColor);
      document.documentElement.style.setProperty("--tenant-theme-color", newColor);
    }

    try {
      let parsed: any = {};
      try {
        const rawSettings =
          currentTenant?.tenants?.settings ||
          (currentTenant as any)?.settings ||
          "{}";
        parsed = typeof rawSettings === "string" ? JSON.parse(rawSettings) : rawSettings;
      } catch {}

      parsed.theme = newTheme;
      parsed.themeColor = newColor;
      parsed.invoiceTemplate = newTemplate;

      await updateSettingsMutation.mutateAsync({
        settings: JSON.stringify(parsed),
      });

      await utils.tenants.current.invalidate();
      await utils.tenants.list.invalidate();
      toast.success("Culoare și aspect salvate", { id: "appearance-saved" });
    } catch (e: any) {
      console.error("Eroare la salvarea aspectului:", e);
    }
  };

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
    defaultVatRate: 21,
    invoicePrefix: "INV",
    invoiceStartNumber: 1,
    defaultDueDays: 7,
    defaultMarkupPercent: 20,
  }));

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([
    {
      id: "ron-1",
      currency: "RON",
      iban: "",
      bank: "",
      isDefault: true,
    },
  ]);

  const [pfLastName, setPfLastName] = useState("");
  const [pfFirstName, setPfFirstName] = useState("");
  const [pfCnp, setPfCnp] = useState("");
  const [pfEmail, setPfEmail] = useState("");
  const [pfPhone, setPfPhone] = useState("");
  const [pfAddress, setPfAddress] = useState("");
  const [pfCity, setPfCity] = useState("");
  const [pfCountry, setPfCountry] = useState<Country>("RO");
  const [pfBankAccounts, setPfBankAccounts] = useState<BankAccount[]>([
    {
      id: "pf-ron-1",
      currency: "RON",
      iban: "",
      bank: "",
      isDefault: true,
    },
  ]);

  // Update company (PJ) settings when company tenant data is loaded
  useEffect(() => {
    if (firmData) {
      let parsedSettings: any = {};
      try {
        if (firmData.settings) {
          parsedSettings = JSON.parse(firmData.settings);
        }
      } catch {}

      setSettings({
        regCom: "",
        city: "",
        county: "",
        country: "RO",
        iban: "",
        bank: "",
        defaultCurrency: "RON",
        defaultLanguage: "ro",
        defaultVatRate: 21,
        invoicePrefix: "INV",
        invoiceStartNumber: 1,
        defaultDueDays: 7,
        defaultMarkupPercent: 20,
        ...parsedSettings,
        name: firmData.name || "",
        email: firmData.email || "",
        phone: firmData.phone || "",
        address: firmData.address || "",
        cui: firmData.cui || "",
      });

      setBankAccounts(parseBankAccountsFromSettings(parsedSettings));
      setLogoBase64(parsedSettings.logoBase64 || "");
      setLogoHasBackground(Boolean(parsedSettings.logoHasBackground));
      setLogoBgColor(parsedSettings.logoBgColor || "#0f172a");
    }
  }, [firmData?.id, firmData?.settings, firmData?.name]);

  // Keep active theme / template in sync with the active workspace
  useEffect(() => {
    if (currentTenant?.tenants?.settings) {
      let parsedSettings: any = {};
      try {
        parsedSettings = JSON.parse(currentTenant.tenants.settings);
      } catch {}
      if (parsedSettings.theme) {
        setActiveTheme(parsedSettings.theme as ThemeId);
        document.documentElement.setAttribute("data-theme", parsedSettings.theme);
        localStorage.setItem("app-theme", parsedSettings.theme);
      }
      if (parsedSettings.themeColor) {
        setThemeColor(parsedSettings.themeColor);
        localStorage.setItem("tenant-theme-color", parsedSettings.themeColor);
        document.documentElement.style.setProperty("--primary", parsedSettings.themeColor);
        document.documentElement.style.setProperty("--sidebar-primary", parsedSettings.themeColor);
        document.documentElement.style.setProperty("--color-primary", parsedSettings.themeColor);
        document.documentElement.style.setProperty("--tenant-theme-color", parsedSettings.themeColor);
      } else if (parsedSettings.theme) {
        const found = THEMES.find(t => t.id === parsedSettings.theme);
        if (found) {
          setThemeColor(found.color);
          localStorage.setItem("tenant-theme-color", found.color);
          document.documentElement.style.setProperty("--primary", found.color);
          document.documentElement.style.setProperty("--sidebar-primary", found.color);
          document.documentElement.style.setProperty("--color-primary", found.color);
          document.documentElement.style.setProperty("--tenant-theme-color", found.color);
        }
      }
      if (parsedSettings.invoiceTemplate) {
        const tmpl = parsedSettings.invoiceTemplate === "modern" ? "classic" : parsedSettings.invoiceTemplate;
        setActiveTemplate(tmpl as TemplateId);
        localStorage.setItem("invoice-template", tmpl);
      }
    }
  }, [currentTenant?.tenants?.id, currentTenant?.tenants?.settings]);

  // Hydrate separate Persoana Fizica tab ONLY from paired PF profile (empty if not created yet)
  useEffect(() => {
    const pfRow = entityPair?.pf;
    if (!pfRow) {
      setPfLastName("");
      setPfFirstName("");
      setPfCnp("");
      setPfEmail("");
      setPfPhone("");
      setPfAddress("");
      setPfCity("");
      setPfCountry("RO");
      setPfBankAccounts([
        { id: "acc_ron", currency: "RON", iban: "", bank: "", isDefault: true },
      ]);
      return;
    }
    let parsedPf: any = {};
    try {
      if (pfRow.settings) {
        parsedPf = JSON.parse(pfRow.settings);
      }
    } catch {}
    if (parsedPf.lastName || parsedPf.firstName) {
      setPfLastName(parsedPf.lastName || "");
      setPfFirstName(parsedPf.firstName || "");
    } else {
      const rawFull = (pfRow.name || "").trim();
      const spaceIdx = rawFull.indexOf(" ");
      if (spaceIdx > 0) {
        setPfLastName(rawFull.slice(0, spaceIdx).trim());
        setPfFirstName(rawFull.slice(spaceIdx + 1).trim());
      } else {
        setPfLastName(rawFull);
        setPfFirstName("");
      }
    }
    setPfCnp(pfRow.cui || "");
    setPfEmail(pfRow.email || "");
    setPfPhone(pfRow.phone || "");
    setPfAddress(pfRow.address || "");
    setPfCity(parsedPf.city || "");
    setPfCountry((parsedPf.country as Country) || "RO");
    setPfBankAccounts(parseBankAccountsFromSettings(parsedPf));
  }, [entityPair?.pf?.id, entityPair?.pf?.settings, entityPair?.pf?.name]);

  const addBankAccountFor = (
    setter: React.Dispatch<React.SetStateAction<BankAccount[]>>,
    curr: string = "EUR"
  ) => {
    setter(prev => [
      ...prev,
      {
        id: "acc_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
        currency: curr,
        iban: "",
        bank: "",
        isDefault: false,
      },
    ]);
  };

  const updateBankAccountFor = (
    setter: React.Dispatch<React.SetStateAction<BankAccount[]>>,
    index: number,
    field: keyof BankAccount,
    val: any
  ) => {
    setter(prev =>
      prev.map((acc, i) => (i === index ? { ...acc, [field]: val } : acc))
    );
  };

  const removeBankAccountFor = (
    setter: React.Dispatch<React.SetStateAction<BankAccount[]>>,
    index: number
  ) => {
    setter(prev => {
      const filtered = prev.filter((_, i) => i !== index);
      if (filtered.length === 0) {
        return [{ id: "acc_ron", currency: "RON", iban: "", bank: "", isDefault: true }];
      }
      return filtered;
    });
  };

  const [saving, setSaving] = useState(false);
  const [savingPf, setSavingPf] = useState(false);
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

  const utils = trpc.useUtils();
  const updateSettingsMutation = trpc.tenants.updateSettings.useMutation();
  const upsertPfMutation = trpc.tenants.upsertPersonalProfile.useMutation();
  const exportDataMutation = trpc.gdpr.exportData.useMutation();
  const deleteAccountMutation = trpc.gdpr.deleteAccount.useMutation();
  const changePasswordMutation = trpc.auth.changePassword.useMutation();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const handleSave = async () => {
    const cleanCode = String(settings.cui || "").replace(/\s+/g, "");
    setSaving(true);
    try {
      const primaryRon = bankAccounts.find(a => a.currency === "RON") || bankAccounts[0];
      const primaryEur = bankAccounts.find(a => a.currency === "EUR");

      let existingParsed: Record<string, any> = {};
      try {
        if (firmData?.settings) {
          existingParsed = JSON.parse(String(firmData.settings));
        }
      } catch {}

      const settingsStr = JSON.stringify({
        ...existingParsed,
        entityType: "pj",
        regCom: settings.regCom,
        city: settings.city,
        county: settings.county,
        country: settings.country,
        iban: primaryRon?.iban || settings.iban,
        bank: primaryRon?.bank || settings.bank,
        ibanEur: primaryEur?.iban || "",
        bankEur: primaryEur?.bank || "",
        bankAccounts: bankAccounts,
        defaultCurrency: settings.defaultCurrency,
        defaultLanguage: settings.defaultLanguage,
        defaultVatRate: settings.defaultVatRate,
        invoicePrefix: settings.invoicePrefix,
        invoiceStartNumber: settings.invoiceStartNumber,
        defaultDueDays: settings.defaultDueDays,
        defaultMarkupPercent: settings.defaultMarkupPercent,
        logoBase64: logoBase64 || "",
        logoHasBackground: Boolean(logoHasBackground),
        logoBgColor: logoBgColor || "#0f172a",
        theme: activeTheme,
        themeColor: themeColor,
        invoiceTemplate: activeTemplate,
      });

      await updateSettingsMutation.mutateAsync({
        name: settings.name,
        cui: cleanCode,
        email: settings.email,
        phone: settings.phone,
        address: settings.address,
        settings: settingsStr,
        targetTenantId: firmData?.id,
      });

      await Promise.all([
        utils.tenants.current.invalidate(),
        utils.tenants.getEntityPair.invalidate(),
        utils.tenants.list.invalidate(),
        utils.auth.me.invalidate(),
      ]);

      toast.success("Setări salvate", {
        description: "Modificările au fost aplicate",
      });
    } catch (e: any) {
      toast.error("Eroare la salvare", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePf = async () => {
    const cleanLastName = pfLastName.trim();
    const cleanFirstName = pfFirstName.trim();
    const cleanCnp = pfCnp.replace(/\s+/g, "");
    if (!cleanLastName) {
      toast.error("Introduceți numele de familie.");
      return;
    }
    if (!cleanFirstName) {
      toast.error("Introduceți prenumele.");
      return;
    }
    if (!/^\d{13}$/.test(cleanCnp)) {
      toast.error("CNP-ul trebuie să conțină exact 13 cifre.");
      return;
    }
    setSavingPf(true);
    try {
      const shouldSwitchImmediately = !entityPair?.pf;
      const res = await upsertPfMutation.mutateAsync({
        lastName: cleanLastName,
        firstName: cleanFirstName,
        cnp: cleanCnp,
        email: pfEmail.trim() || undefined,
        phone: pfPhone.trim() || undefined,
        address: pfAddress.trim() || undefined,
        city: pfCity.trim() || undefined,
        country: pfCountry || "RO",
        bankAccounts: pfBankAccounts,
        switchToPf: shouldSwitchImmediately,
      });

      if (res?.token) {
        applyTenantSessionAndNavigate(
          res.token,
          res.pfTenantId,
          "pf",
          "Profilul de Persoană Fizică a fost salvat și activat."
        );
        return;
      }

      await Promise.all([
        utils.tenants.getEntityPair.invalidate(),
        utils.tenants.current.invalidate(),
        utils.auth.me.invalidate(),
      ]);
      toast.success("Datele de Persoană Fizică au fost salvate.");
    } catch (e: any) {
      toast.error("Eroare la salvarea profilului", { description: e?.message });
    } finally {
      setSavingPf(false);
    }
  };

  const update = (key: keyof CompanySettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleExportData = async () => {
    try {
      toast.loading("Pregătim arhiva ta...", { id: "export" });
      const data = await exportDataMutation.mutateAsync();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `smart-erp-gdpr-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Datele au fost descărcate cu succes!", { id: "export" });
    } catch (e: any) {
      toast.error("Eroare la exportul datelor.", { id: "export" });
    }
  };

  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "STERGE") {
      toast.error("Confirmare incorectă. Contul NU a fost șters.");
      return;
    }
    try {
      await deleteAccountMutation.mutateAsync();
      setShowDeleteAccountDialog(false);
      localStorage.removeItem("authToken");
      window.location.href = "/";
    } catch (e: any) {
      toast.error(e?.message || "A apărut o eroare la ștergerea contului.");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      toast.error("Parola nouă nu coincide cu confirmarea.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Parola nouă trebuie să aibă minim 8 caractere.");
      return;
    }
    try {
      await changePasswordMutation.mutateAsync({ currentPassword, newPassword });
      toast.success("Parola a fost schimbată cu succes!");
      setShowPasswordForm(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err) {
      toast.error((err as Error).message || "A apărut o eroare la schimbarea parolei.");
    }
  };

  // Cod PIN de acces companie
  const { data: pinStatus, refetch: refetchPinStatus } = trpc.tenants.getPinStatus.useQuery();
  const setPinMutation = trpc.tenants.setPin.useMutation();
  const disablePinMutation = trpc.tenants.disablePin.useMutation();

  const [pinFormMode, setPinFormMode] = useState<"idle" | "set" | "change" | "disable">("idle");
  const [pinCurrent, setPinCurrent] = useState("");
  const [pinNew, setPinNew] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinError, setPinError] = useState("");

  const resetPinForm = () => {
    setPinFormMode("idle");
    setPinCurrent("");
    setPinNew("");
    setPinConfirm("");
    setPinError("");
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError("");

    if (pinFormMode === "change" && !pinCurrent.trim()) {
      setPinError("Introduceți codul PIN actual.");
      return;
    }

    if (!/^\d{4}$/.test(pinNew.trim())) {
      setPinError("Codul PIN trebuie să conțină exact 4 cifre.");
      return;
    }

    if (pinNew !== pinConfirm) {
      setPinError("Confirmarea codului PIN nu coincide.");
      return;
    }

    try {
      await setPinMutation.mutateAsync({
        pin: pinNew.trim(),
        currentPin: pinFormMode === "change" ? pinCurrent.trim() : undefined,
      });

      const tid = currentTenant?.tenants?.id || pinStatus?.tenantId || currentTenantData?.id;
      if (tid) {
        try {
          sessionStorage.setItem("smart_invoice_pin_session_unlocked", String(tid));
          sessionStorage.setItem(`smart_invoice_unlocked_pin_${tid}`, "true");
        } catch {}
      }

      await refetchPinStatus();
      resetPinForm();
      toast.success(
        pinFormMode === "change"
          ? "Codul PIN a fost modificat cu succes."
          : "Codul PIN a fost activat cu succes."
      );
    } catch (err: any) {
      setPinError(err.message || "A apărut o eroare la salvarea codului PIN.");
    }
  };

  const handleDisablePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError("");

    if (!pinCurrent.trim()) {
      setPinError("Introduceți codul PIN actual pentru confirmare.");
      return;
    }

    try {
      await disablePinMutation.mutateAsync({ pin: pinCurrent.trim() });
      try {
        sessionStorage.removeItem("smart_invoice_pin_session_unlocked");
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const k = sessionStorage.key(i);
          if (
            k &&
            (k.startsWith("smart_invoice_unlocked_pin") ||
              k === "smart_invoice_pin_session_unlocked")
          ) {
            sessionStorage.removeItem(k);
          }
        }
      } catch {}
      await refetchPinStatus();
      resetPinForm();
      toast.success("Protecția cu cod PIN a fost dezactivată.");
    } catch (err: any) {
      setPinError(err.message || "Cod PIN incorect. Dezactivarea a eșuat.");
    }
  };

  // Portal Contabil
  const { data: accountantPortalConfig, refetch: refetchAccountantConfig } =
    trpc.tenants.getAccountantPortalConfig.useQuery();
  const updateAccountantConfigMutation =
    trpc.tenants.updateAccountantPortalConfig.useMutation();

  const [portalEnabled, setPortalEnabled] = useState(false);
  const [portalPin, setPortalPin] = useState("");
  const [portalSlug, setPortalSlug] = useState("");
  const [portalViewMode, setPortalViewMode] = useState<"modern" | "saga">("saga");
  const [isCopiedPortalLink, setIsCopiedPortalLink] = useState(false);

  useEffect(() => {
    if (accountantPortalConfig) {
      setPortalEnabled(accountantPortalConfig.enabled);
      setPortalSlug(accountantPortalConfig.customSlug || "");
      setPortalViewMode(
        accountantPortalConfig.defaultViewMode === "modern" ? "modern" : "saga"
      );
    }
  }, [accountantPortalConfig]);

  const portalShareUrl = useMemo(() => {
    const slug = (portalSlug || accountantPortalConfig?.customSlug || accountantPortalConfig?.token || "").trim();
    if (!slug) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "https://facturaspv.ro";
    return `${origin}/contabil/${slug}`;
  }, [portalSlug, accountantPortalConfig?.customSlug, accountantPortalConfig?.token]);

  const clearPortalLocalViewOverrides = () => {
    try {
      localStorage.removeItem("smart_invoice_accountant_view_mode");
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith("smart_invoice_accountant_view_override_")) {
          sessionStorage.removeItem(k);
        }
      }
    } catch {}
  };

  const handleChangePortalViewMode = async (nextMode: "modern" | "saga") => {
    setPortalViewMode(nextMode);
    clearPortalLocalViewOverrides();
    try {
      await updateAccountantConfigMutation.mutateAsync({
        enabled: portalEnabled,
        defaultViewMode: nextMode,
      });
      await refetchAccountantConfig();
      toast.success(
        nextMode === "modern"
          ? "Portalul contabil se va deschide în Interfața Normală."
          : "Portalul contabil se va deschide în Interfața SAGA."
      );
    } catch (err: any) {
      toast.error(err?.message || "Eroare la salvarea modului de afișare.");
    }
  };

  const handleSavePortalConfig = async (regenerate: boolean = false, clearPin: boolean = false) => {
    try {
      clearPortalLocalViewOverrides();
      await updateAccountantConfigMutation.mutateAsync({
        enabled: portalEnabled,
        pin: portalPin ? portalPin.trim() : undefined,
        clearPin,
        customSlug: portalSlug ? portalSlug.trim() : undefined,
        regenerateToken: regenerate,
        defaultViewMode: portalViewMode,
      });
      await refetchAccountantConfig();
      setPortalPin("");
      toast.success(
        regenerate
          ? "Link-ul a fost regenerat!"
          : clearPin
          ? "Codul PIN a fost eliminat!"
          : "Setările portalului contabil au fost salvate!"
      );
    } catch (err: any) {
      toast.error(err?.message || "Eroare la salvarea setărilor portalului.");
    }
  };

  return (
    <div className="p-3 sm:p-5 max-w-full overflow-x-hidden space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
          Setări
        </h1>
        <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
          Firmă, facturare și preferințe
        </p>
      </div>

      <div className="flex gap-4 flex-col md:flex-row items-start">
        {/* Sidebar tabs */}
        <div className="w-full md:w-52 shrink-0 apple-surface p-2">
          <nav className="flex md:flex-col gap-1 overflow-x-auto no-scrollbar">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={
                    activeTab === tab.id
                      ? { backgroundColor: "var(--tenant-theme-color, " + (themeColor || "#0071e3") + ")" }
                      : undefined
                  }
                  className={`md:w-full shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-full text-[12.5px] transition-all cursor-pointer ${
                    activeTab === tab.id
                      ? "text-white shadow-xs font-semibold"
                      : "font-medium text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4 min-w-0 w-full">
          {/* Company tab */}
          {activeTab === "company" && (
            <div className="apple-surface p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Date firmă
                </h2>
                {entityPair?.pf && (
                  entityPair.activeType === "pj" ? (
                    <button
                      type="button"
                      disabled={switchTenantMutation.isPending}
                      onClick={() => {
                        switchingToTypeRef.current = "pf";
                        switchTenantMutation.mutate({ tenantId: Number(entityPair.pf!.id) });
                      }}
                      className="apple-btn-glass px-3 h-8 text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Comută pe {entityPair.pf.name} (PF)</span>
                    </button>
                  ) : entityPair.pj ? (
                    <button
                      type="button"
                      disabled={switchTenantMutation.isPending}
                      onClick={() => {
                        switchingToTypeRef.current = "pj";
                        switchTenantMutation.mutate({ tenantId: Number(entityPair.pj!.id) });
                      }}
                      className="apple-btn-glass px-3 h-8 text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Activează firmă ({entityPair.pj.name})</span>
                    </button>
                  ) : null
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <SettingField
                  label="Denumire firmă"
                  value={settings.name}
                  onChange={v => update("name", v)}
                  placeholder="ConstructMaster SRL"
                  autocomplete="organization"
                />
                {/* CUI with ANAF lookup */}
                <div>
                  <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                    CUI / CIF
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={settings.cui}
                      onChange={e => {
                        update("cui", e.target.value);
                        setCuiLookupError("");
                      }}
                      onKeyDown={e => e.key === "Enter" && lookupCui()}
                      placeholder="RO12345678"
                      autoComplete="off"
                      className="flex-1 min-w-0 px-3 h-9 text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] outline-none text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={lookupCui}
                      disabled={cuiLookupLoading || !settings.cui}
                      title="Caută date firmă după CUI (ANAF)"
                      className="apple-btn-prominent inline-flex items-center gap-1.5 px-3.5 h-9 disabled:opacity-50 text-[12px] font-semibold shrink-0 cursor-pointer"
                    >
                      {cuiLookupLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Search className="w-3.5 h-3.5" />
                      )}
                      Auto-fill
                    </button>
                  </div>
                  {cuiLookupError && (
                    <div className="flex items-center gap-1 mt-1 text-[11px] text-rose-500">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {cuiLookupError}
                    </div>
                  )}
                </div>
                <SettingField
                  label="Reg. Com."
                  value={settings.regCom}
                  onChange={v => update("regCom", v)}
                  placeholder="J40/1234/2020"
                  mono
                />
                <SettingField
                  label="Email"
                  value={settings.email}
                  onChange={v => update("email", v)}
                  placeholder="office@firma.ro"
                  autocomplete="email"
                />
                <SettingField
                  label="Telefon"
                  value={settings.phone}
                  onChange={v => update("phone", v)}
                  placeholder="+40 21 123 4567"
                  autocomplete="tel"
                />
                <div className="md:col-span-2">
                  <SettingField
                    label="Adresă"
                    value={settings.address}
                    onChange={v => update("address", v)}
                    placeholder="Str. Exemplu nr. 1"
                  />
                </div>
                <SettingField
                  label="Oraș"
                  value={settings.city}
                  onChange={v => update("city", v)}
                  placeholder="București"
                />
                <div>
                  <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                    Țară
                  </label>
                  <select
                    value={settings.country}
                    onChange={e => update("country", e.target.value as Country)}
                    className="w-full h-9 px-3 text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none cursor-pointer"
                  >
                    {countries.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <BankAccountsSection
                subtitle="Adaugă conturile bancare ale firmei în RON, EUR, USD etc."
                accounts={bankAccounts}
                onAdd={() => addBankAccountFor(setBankAccounts, "EUR")}
                onUpdate={(idx, field, val) => updateBankAccountFor(setBankAccounts, idx, field, val)}
                onRemove={(idx) => removeBankAccountFor(setBankAccounts, idx)}
              />

              {/* Logo firmă */}
              <div className="pt-4 border-t border-black/[0.05] dark:border-white/[0.07] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    Logo firmă
                  </h3>
                  {logoBase64 && (
                    <span className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d]">
                      PNG, JPG sau SVG (Max 2MB)
                    </span>
                  )}
                </div>

                <div className="flex items-start gap-4">
                  {logoBase64 ? (
                    <div
                      className={`relative inline-flex items-center justify-center p-2 rounded-xl transition-all shadow-xs ${
                        logoHasBackground
                          ? "border border-black/10"
                          : "bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-dashed border-black/[0.12] dark:border-white/[0.14]"
                      }`}
                      style={{
                        backgroundColor: logoHasBackground ? logoBgColor : undefined,
                      }}
                    >
                      <img
                        src={logoBase64}
                        alt="Logo"
                        className="h-9 w-auto max-w-[130px] object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => setLogoBase64("")}
                        className="absolute -top-2.5 -right-2.5 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 shadow transition-colors cursor-pointer"
                        title="Șterge logo"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-12 w-28 rounded-xl border-2 border-dashed border-black/[0.12] dark:border-white/[0.14] flex flex-col items-center justify-center text-[#8e8e93] text-[11px] gap-0.5">
                      <ImageIcon className="w-4 h-4 opacity-40" />
                      <span>Niciun logo</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 2 * 1024 * 1024) {
                          toast.error("Logo prea mare. Dimensiunea maximă este 2MB.");
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = ev =>
                          setLogoBase64(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="apple-btn-glass inline-flex items-center gap-1.5 px-3.5 h-8 text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-medium cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {logoBase64 ? "Schimbă logo" : "Încarcă logo"}
                    </button>
                    <p className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d]">
                      Recomandat PNG transparent.
                    </p>
                  </div>
                </div>

                {/* Toggle Fundal Logo & Color Picker */}
                {logoBase64 && (
                  <div className="mt-3 pt-3 border-t border-black/[0.05] dark:border-white/[0.07] space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                          Fundal pentru logo (pe Facturi și PDF-uri)
                        </div>
                        <div className="text-[12px] text-[#6e6e73] dark:text-[#98989d]">
                          {logoHasBackground
                            ? "Logo-ul va fi afișat într-un card cu fundalul selectat mai jos."
                            : "Logo-ul va fi afișat fără fundal (transparent, direct pe albul paginii)."}
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={logoHasBackground}
                          onChange={e => setLogoHasBackground(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 bg-black/[0.12] peer-focus:outline-none rounded-full peer dark:bg-white/[0.16] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0071e3]"></div>
                      </label>
                    </div>

                    {/* Color picker când toggle-ul este activ */}
                    {logoHasBackground && (
                      <div className="p-3.5 bg-[#f2f2f7] dark:bg-[#2c2c2e] rounded-xl border border-black/[0.05] dark:border-white/[0.07] space-y-2.5">
                        <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block">
                          Culoare fundal logo
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-2 bg-white dark:bg-[#1c1c1e] px-2.5 py-1 rounded-xl border border-black/[0.06] dark:border-white/[0.08]">
                            <input
                              type="color"
                              value={logoBgColor}
                              onChange={e => setLogoBgColor(e.target.value)}
                              className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                            />
                            <input
                              type="text"
                              value={logoBgColor}
                              onChange={e => setLogoBgColor(e.target.value)}
                              placeholder="#0f172a"
                              className="w-20 text-xs tabular-nums uppercase bg-transparent outline-none text-[#1d1d1f] dark:text-[#f5f5f7]"
                            />
                          </div>

                          <div className="flex items-center gap-1.5 ml-1 flex-wrap">
                            <span className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] font-medium mr-1">
                              Paletă rapidă:
                            </span>
                            {[
                              { label: "Graphite", color: "#1c1c1e" },
                              { label: "Negru", color: "#000000" },
                              { label: "Navy", color: "#1e3a5f" },
                              { label: "Smarald", color: "#065f46" },
                              { label: "Indigo", color: "#3730a3" },
                              { label: "Alb", color: "#ffffff" },
                            ].map(c => (
                              <button
                                key={c.color}
                                type="button"
                                onClick={() => setLogoBgColor(c.color)}
                                title={`${c.label} (${c.color})`}
                                className={`w-7 h-7 rounded-full border transition-all cursor-pointer ${
                                  logoBgColor.toLowerCase() === c.color.toLowerCase()
                                    ? "ring-2 ring-[#0071e3] scale-110 border-white"
                                    : "border-black/[0.15] dark:border-white/[0.20] hover:scale-105"
                                }`}
                                style={{ backgroundColor: c.color }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Persoană Fizică tab */}
          {activeTab === "pf" && (
            <div className="apple-surface p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    Date persoană fizică
                  </h2>
                  <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
                    Profil separat pe CNP cu mesaje SPV și facturi complet izolate de firmă.
                  </p>
                </div>
                {entityPair?.pf && (
                  entityPair.activeType !== "pf" ? (
                    <button
                      type="button"
                      disabled={switchTenantMutation.isPending}
                      onClick={() => {
                        switchingToTypeRef.current = "pf";
                        switchTenantMutation.mutate({ tenantId: Number(entityPair.pf!.id) });
                      }}
                      className="apple-btn-glass px-3 h-8 text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Comută pe Persoană Fizică</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300">
                        Profil activ acum
                      </span>
                      {entityPair.pj && (
                        <button
                          type="button"
                          disabled={switchTenantMutation.isPending}
                          onClick={() => {
                            switchingToTypeRef.current = "pj";
                            switchTenantMutation.mutate({ tenantId: Number(entityPair.pj!.id) });
                          }}
                          className="apple-btn-glass px-3 h-8 text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Building2 className="w-3.5 h-3.5" />
                          <span>Comută pe Firmă</span>
                        </button>
                      )}
                    </div>
                  )
                )}
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <SettingField
                    label="Nume"
                    value={pfLastName}
                    onChange={setPfLastName}
                    placeholder="Popescu"
                    autocomplete="family-name"
                  />
                  <SettingField
                    label="Prenume"
                    value={pfFirstName}
                    onChange={setPfFirstName}
                    placeholder="Ion"
                    autocomplete="given-name"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                      CNP (13 cifre)
                    </label>
                    <input
                      value={pfCnp}
                      inputMode="numeric"
                      maxLength={13}
                      onChange={e =>
                        setPfCnp(e.target.value.replace(/\D/g, "").slice(0, 13))
                      }
                      placeholder="1850101123456"
                      autoComplete="off"
                      className="w-full px-3 h-9 text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] outline-none text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] tabular-nums"
                    />
                  </div>
                  <SettingField
                    label="Email"
                    value={pfEmail}
                    onChange={setPfEmail}
                    placeholder="nume@exemplu.ro"
                    autocomplete="email"
                  />
                  <SettingField
                    label="Telefon"
                    value={pfPhone}
                    onChange={setPfPhone}
                    placeholder="+40 722 000 000"
                    autocomplete="tel"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <SettingField
                      label="Adresă domiciliu"
                      value={pfAddress}
                      onChange={setPfAddress}
                      placeholder="Str. Exemplu nr. 1"
                    />
                  </div>
                  <SettingField
                    label="Oraș"
                    value={pfCity}
                    onChange={setPfCity}
                    placeholder="București"
                  />
                  <div>
                    <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                      Țară
                    </label>
                    <select
                      value={pfCountry}
                      onChange={e => setPfCountry(e.target.value as Country)}
                      className="w-full h-9 px-3 text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none cursor-pointer"
                    >
                      {countries.map(c => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <BankAccountsSection
                subtitle="Adaugă conturile bancare personale în RON, EUR, USD etc."
                accounts={pfBankAccounts}
                onAdd={() => addBankAccountFor(setPfBankAccounts, "EUR")}
                onUpdate={(idx, field, val) =>
                  updateBankAccountFor(setPfBankAccounts, idx, field, val)
                }
                onRemove={idx => removeBankAccountFor(setPfBankAccounts, idx)}
              />
            </div>
          )}

          {/* Appearance tab */}
          {activeTab === "appearance" && (
            <div className="space-y-4">
              {/* Tema culori */}
              <div className="apple-surface p-5 sm:p-6 space-y-4">
                <div>
                  <h2 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    Culoare temă & accent factură
                  </h2>
                  <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
                    Această culoare este folosită pentru butoane, elemente active și caseta <strong>TOTAL DE PLATĂ</strong> din facturi și PDF.
                  </p>
                </div>

                {/* Paletă teme */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {THEMES.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => saveAppearance(t.id, t.color, activeTemplate)}
                        title={`${t.label} (${t.color})`}
                        style={{ background: t.color }}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-xs cursor-pointer ${
                          !isCustomColor && activeTheme === t.id
                            ? "ring-2 ring-offset-2 ring-[#0071e3] scale-105"
                            : "opacity-85 hover:opacity-100 hover:scale-105"
                        }`}
                      >
                        {!isCustomColor && activeTheme === t.id && (
                          <Check className="w-4 h-4 text-white" />
                        )}
                      </button>
                    ))}

                    {/* Selector de culoare (Color Picker) */}
                    <div className="relative" title="Apasă pentru a alege orice culoare dorită din paletă">
                      <div
                        className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-xs cursor-pointer overflow-hidden ${
                          isCustomColor
                            ? "ring-2 ring-offset-2 ring-[#0071e3] scale-105"
                            : "opacity-85 hover:opacity-100 hover:scale-105"
                        }`}
                        style={{
                          background: isCustomColor
                            ? themeColor
                            : "conic-gradient(from 180deg at 50% 50%, #f43f5e 0deg, #ec4899 45deg, #a855f7 90deg, #6366f1 135deg, #3b82f6 180deg, #14b8a6 225deg, #22c55e 270deg, #eab308 315deg, #f43f5e 360deg)",
                        }}
                      >
                        {isCustomColor ? (
                          <Check className="w-4 h-4 text-white drop-shadow" />
                        ) : (
                          <Palette className="w-4 h-4 text-white drop-shadow" />
                        )}
                        <input
                          type="color"
                          value={themeColor}
                          onChange={e => saveAppearance("custom", e.target.value, activeTemplate)}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          title="Alege orice culoare dorită"
                        />
                      </div>
                    </div>

                    {/* Etichetă & input HEX */}
                    <div className="flex items-center gap-2 ml-1 bg-[#f2f2f7] dark:bg-[#2c2c2e] px-3 py-1.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08]">
                      <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                        {isCustomColor ? "Personalizată:" : `${THEMES.find(t => t.id === activeTheme)?.label || "Verde"}:`}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full shadow-inner border border-black/10" style={{ backgroundColor: themeColor }} />
                        <input
                          type="text"
                          value={themeColor}
                          onChange={e => saveAppearance("custom", e.target.value, activeTemplate)}
                          placeholder="#16A34A"
                          className="w-20 text-[12.5px] tabular-nums uppercase bg-transparent outline-none text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Previzualizare card Total de plată */}
                <div className="pt-3 border-t border-black/[0.05] dark:border-white/[0.07]">
                  <span className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-2">
                    Previzualizare total factură
                  </span>
                  <div className="max-w-xs bg-[#f2f2f7] dark:bg-[#2c2c2e] p-3.5 rounded-2xl border border-black/[0.05] dark:border-white/[0.07] space-y-1.5">
                    <div className="flex justify-between text-[12.5px] text-[#6e6e73] dark:text-[#98989d]">
                      <span>Total fără TVA:</span>
                      <span className="font-semibold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">733.44 RON</span>
                    </div>
                    <div className="flex justify-between text-[12.5px] text-[#6e6e73] dark:text-[#98989d]">
                      <span>Total TVA:</span>
                      <span className="font-semibold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">154.02 RON</span>
                    </div>
                    <div
                      className="flex justify-between py-2 px-3 text-[13.5px] font-bold text-white rounded-xl shadow-xs transition-colors"
                      style={{ backgroundColor: themeColor }}
                    >
                      <span>TOTAL DE PLATĂ:</span>
                      <span className="tabular-nums">887.46 RON</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sablon factura */}
              <div className="apple-surface p-5 sm:p-6">
                <h2 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-3">
                  Model factură PDF
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {INVOICE_TEMPLATES.map(tmpl => (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => saveAppearance(activeTheme, themeColor, tmpl.id)}
                      className={`apple-card-btn p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        activeTemplate === tmpl.id
                          ? "border-[#0071e3] bg-[#0071e3]/[0.05] dark:bg-[#0a84ff]/[0.10]"
                          : "border-black/[0.08] dark:border-white/[0.10] bg-[#f2f2f7]/60 dark:bg-[#2c2c2e]/60 hover:border-black/[0.16] dark:hover:border-white/[0.20]"
                      }`}
                    >
                      <div
                        className={`w-full h-10 rounded-xl mb-2.5 flex items-center justify-center ${
                          tmpl.id === "classic"
                            ? "bg-[#1d1d1f]"
                            : tmpl.id === "modern"
                              ? "bg-gradient-to-br from-[#1d1d1f] to-[#0071e3]"
                              : "bg-white border border-black/[0.08]"
                        }`}
                      >
                        <FileText
                          className={`w-5 h-5 ${
                            tmpl.id === "minimal"
                              ? "text-[#8e8e93]"
                              : "text-white"
                          }`}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                          {tmpl.label}
                        </span>
                        {activeTemplate === tmpl.id && (
                          <Check className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Invoicing tab */}
          {activeTab === "invoicing" && (
            <div className="apple-surface p-5 sm:p-6 space-y-5">
              <h2 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Setări facturare
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SettingField
                  label="Prefix re-factură"
                  value={settings.invoicePrefix}
                  onChange={v => update("invoicePrefix", v)}
                  placeholder="RF"
                  mono
                />
                <div>
                  <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                    Număr start
                  </label>
                  <input
                    type="number"
                    value={settings.invoiceStartNumber}
                    onChange={e =>
                      update("invoiceStartNumber", +e.target.value)
                    }
                    className="w-full px-3.5 h-9 text-[13px] tabular-nums rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] outline-none text-[#1d1d1f] dark:text-[#f5f5f7]"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                    Zile scadență implicite
                  </label>
                  <input
                    type="number"
                    value={settings.defaultDueDays}
                    onChange={e => update("defaultDueDays", +e.target.value)}
                    className="w-full px-3.5 h-9 text-[13px] tabular-nums rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] outline-none text-[#1d1d1f] dark:text-[#f5f5f7]"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                    Adaos implicit (%)
                  </label>
                  <input
                    type="number"
                    value={settings.defaultMarkupPercent}
                    onChange={e =>
                      update("defaultMarkupPercent", +e.target.value)
                    }
                    className="w-full px-3.5 h-9 text-[13px] tabular-nums rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] outline-none text-[#1d1d1f] dark:text-[#f5f5f7]"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                    Cotă TVA implicită (%)
                  </label>
                  <select
                    value={settings.defaultVatRate}
                    onChange={e => update("defaultVatRate", +e.target.value)}
                    className="w-full h-9 px-3.5 text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none cursor-pointer"
                  >
                    <option value={21}>21% — Standard</option>
                    <option value={11}>11% — Redusă (din 01.08.2025)</option>
                    <option value={19}>19% — Veche (până în 31.07.2025)</option>
                    <option value={9}>9% — Veche redusă</option>
                    <option value={5}>5% — Veche super-redusă</option>
                    <option value={0}>0% — Scutit</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-black/[0.05] dark:border-white/[0.07]">
                <div className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-2">
                  Previzualizare numerotare
                </div>
                <div className="flex items-center gap-2 p-3.5 bg-[#f2f2f7] dark:bg-[#2c2c2e] rounded-xl">
                  <span className="text-[14px] font-semibold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {settings.invoicePrefix}-2024-
                    {String(settings.invoiceStartNumber).padStart(4, "0")}
                  </span>
                  <span className="text-[12px] text-[#6e6e73] dark:text-[#98989d]">
                    → prima re-factură
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Localization tab */}
          {activeTab === "localization" && (
            <div className="apple-surface p-5 sm:p-6 space-y-5">
              <h2 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Localizare & multi-currency
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                    Monedă implicită
                  </label>
                  <select
                    value={settings.defaultCurrency}
                    onChange={e =>
                      update("defaultCurrency", e.target.value as Currency)
                    }
                    className="w-full h-9 px-3.5 text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none cursor-pointer"
                  >
                    {currencies.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                    Limbă implicită facturi
                  </label>
                  <select
                    value={settings.defaultLanguage}
                    onChange={e =>
                      update("defaultLanguage", e.target.value as Language)
                    }
                    className="w-full h-9 px-3.5 text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none cursor-pointer"
                  >
                    {languages.map(l => (
                      <option key={l.code} value={l.code}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-black/[0.05] dark:border-white/[0.07]">
                <div className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-2.5">
                  Monede suportate
                </div>
                <div className="flex flex-wrap gap-2">
                  {currencies.map(c => (
                    <div
                      key={c}
                      style={
                        c === settings.defaultCurrency
                          ? { backgroundColor: "var(--tenant-theme-color, #0071e3)" }
                          : undefined
                      }
                      className={`px-3 py-1.5 rounded-full text-[12px] font-semibold ${
                        c === settings.defaultCurrency
                          ? "text-white"
                          : "bg-[#f2f2f7] text-[#3a3a3c] dark:bg-[#2c2c2e] dark:text-[#ebebf5]"
                      }`}
                    >
                      {c}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-black/[0.05] dark:border-white/[0.07]">
                <div className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-2.5">
                  Țări suportate
                </div>
                <div className="flex flex-wrap gap-2">
                  {countries.map(c => (
                    <div
                      key={c.code}
                      className="px-3 py-1.5 rounded-full text-[12px] font-medium bg-[#f2f2f7] text-[#3a3a3c] dark:bg-[#2c2c2e] dark:text-[#ebebf5]"
                    >
                      {c.flag} {c.label}
                    </div>
                  ))}
                </div>
                <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d] mt-2">
                  Mai multe țări vor fi adăugate în versiunile viitoare.
                </p>
              </div>

              <div className="pt-4 border-t border-black/[0.05] dark:border-white/[0.07]">
                <div className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-2.5">
                  Limbi facturi
                </div>
                <div className="flex flex-wrap gap-2">
                  {languages.map(l => (
                    <div
                      key={l.code}
                      style={
                        l.code === settings.defaultLanguage
                          ? { backgroundColor: "var(--tenant-theme-color, #0071e3)" }
                          : undefined
                      }
                      className={`px-3 py-1.5 rounded-full text-[12px] font-semibold ${
                        l.code === settings.defaultLanguage
                          ? "text-white"
                          : "bg-[#f2f2f7] text-[#3a3a3c] dark:bg-[#2c2c2e] dark:text-[#ebebf5]"
                      }`}
                    >
                      {l.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Notifications tab */}
          {activeTab === "notifications" && (
            <div className="apple-surface p-5 sm:p-6 space-y-2">
              <h2 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-2">
                Notificări
              </h2>
              {[
                {
                  label: "Factură nouă importată",
                  desc: "Notificare la fiecare import automat",
                  enabled: true,
                },
                {
                  label: "Re-factură încasată",
                  desc: "Când un client marchează plata",
                  enabled: true,
                },
                {
                  label: "Scadență apropiată",
                  desc: "Cu 3 zile înainte de scadență",
                  enabled: true,
                },
                {
                  label: "Re-factură restantă",
                  desc: "Când o factură depășește scadența",
                  enabled: false,
                },
                {
                  label: "Eroare sincronizare",
                  desc: "Când o integrare eșuează",
                  enabled: true,
                },
              ].map((notif, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-3 border-b border-black/[0.05] dark:border-white/[0.07] last:border-0"
                >
                  <div>
                    <div className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                      {notif.label}
                    </div>
                    <div className="text-[12px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
                      {notif.desc}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toast.info("Setare actualizată")}
                    style={
                      notif.enabled
                        ? { backgroundColor: "var(--tenant-theme-color, #0071e3)" }
                        : undefined
                    }
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer ${
                      notif.enabled ? "" : "bg-black/[0.12] dark:bg-white/[0.16]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-xs transition-transform duration-200 ${
                        notif.enabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Security tab */}
          {activeTab === "security" && (
            <div className="apple-surface p-5 sm:p-6 space-y-4">
              <h2 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Securitate
              </h2>

              {/* Card PIN de acces companie */}
              <div className="border border-black/[0.05] dark:border-white/[0.07] rounded-2xl p-4 sm:p-5 bg-[#f2f2f7]/60 dark:bg-[#2c2c2e]/60 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#3a3a3c] flex items-center justify-center text-[#0071e3] dark:text-[#0a84ff] shrink-0 shadow-2xs">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                          Cod PIN de acces firmă
                        </h3>
                        {pinStatus?.pinEnabled ? (
                          <>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300">
                              <ShieldCheck className="w-3 h-3" />
                              PIN activ
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white dark:bg-[#3a3a3c] text-[#6e6e73] dark:text-[#ebebf5]">
                              Auto-blocare la 10 min
                            </span>
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-black/[0.06] text-[#6e6e73] dark:bg-white/[0.10] dark:text-[#98989d]">
                            Inactiv
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d] mt-1 max-w-xl leading-relaxed">
                        Protejează datele firmei în birourile unde computerul sau adresa de email sunt partajate.
                        Când este activ, se va cere codul PIN la fiecare conectare și ecranul se va bloca automat după 10 minute de inactivitate.
                      </p>
                    </div>
                  </div>

                  {pinFormMode === "idle" && (
                    <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                      {pinStatus?.pinEnabled ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              resetPinForm();
                              setPinFormMode("change");
                            }}
                            className="apple-btn-glass px-3.5 h-8 text-[#1d1d1f] dark:text-[#f5f5f7] text-[12px] font-medium cursor-pointer"
                          >
                            Modifică PIN
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              resetPinForm();
                              setPinFormMode("disable");
                            }}
                            className="apple-btn-glass px-3.5 h-8 text-rose-600 dark:text-rose-400 text-[12px] font-medium cursor-pointer"
                          >
                            Dezactivează
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            resetPinForm();
                            setPinFormMode("set");
                          }}
                          className="apple-btn-prominent px-4 h-8 text-[12px] font-semibold cursor-pointer"
                        >
                          Setează cod acces
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Formulare Setare / Modificare / Dezactivare PIN */}
                {pinFormMode !== "idle" && (
                  <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.08]">
                    {pinError && (
                      <div className="mb-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-center gap-2 text-rose-700 dark:text-rose-300 text-[12px] font-medium">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{pinError}</span>
                      </div>
                    )}

                    {(pinFormMode === "set" || pinFormMode === "change") && (
                      <form onSubmit={handleSavePin} className="space-y-3 max-w-md">
                        <div className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                          {pinFormMode === "set"
                            ? "Configurare cod PIN nou"
                            : "Modificare cod PIN existent"}
                        </div>

                        {pinFormMode === "change" && (
                          <div>
                            <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                              Cod PIN actual (4 cifre)
                            </label>
                            <input
                              type="password"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={4}
                              value={pinCurrent}
                              onChange={e => {
                                const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 4);
                                setPinCurrent(val);
                                if (pinError) setPinError("");
                              }}
                              required
                              placeholder="••••"
                              className="w-full px-3 h-9 text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none tabular-nums"
                            />
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                              Cod PIN nou (exact 4 cifre)
                            </label>
                            <input
                              type="password"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={4}
                              value={pinNew}
                              onChange={e => {
                                const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 4);
                                setPinNew(val);
                                if (pinError) setPinError("");
                              }}
                              required
                              placeholder="••••"
                              className="w-full px-3 h-9 text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none tabular-nums"
                            />
                          </div>
                          <div>
                            <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                              Confirmă codul PIN
                            </label>
                            <input
                              type="password"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={4}
                              value={pinConfirm}
                              onChange={e => {
                                const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 4);
                                setPinConfirm(val);
                                if (pinError) setPinError("");
                              }}
                              required
                              placeholder="••••"
                              className="w-full px-3 h-9 text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none tabular-nums"
                            />
                          </div>
                        </div>

                        <div className="flex gap-2 justify-end pt-1">
                          <button
                            type="button"
                            onClick={resetPinForm}
                            className="apple-btn-glass px-3.5 h-8 text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                          >
                            Anulează
                          </button>
                          <button
                            type="submit"
                            disabled={setPinMutation.isPending}
                            className="apple-btn-prominent px-4 h-8 text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            {setPinMutation.isPending ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <ShieldCheck className="w-3.5 h-3.5" />
                            )}
                            {pinFormMode === "set" ? "Activează PIN" : "Salvează noul PIN"}
                          </button>
                        </div>
                      </form>
                    )}

                    {pinFormMode === "disable" && (
                      <form onSubmit={handleDisablePin} className="space-y-3 max-w-md">
                        <div className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                          Dezactivare cod PIN de acces
                        </div>
                        <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d]">
                          Introduceți codul PIN actual pentru a confirma oprirea protecției cu PIN.
                        </p>
                        <div>
                          <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                            Cod PIN actual
                          </label>
                          <input
                            type="password"
                            inputMode="numeric"
                            maxLength={10}
                            value={pinCurrent}
                            onChange={e => {
                              setPinCurrent(e.target.value);
                              if (pinError) setPinError("");
                            }}
                            required
                            placeholder="••••"
                            className="w-full px-3 h-9 text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none tabular-nums"
                          />
                        </div>

                        <div className="flex gap-2 justify-end pt-1">
                          <button
                            type="button"
                            onClick={resetPinForm}
                            className="apple-btn-glass px-3.5 h-8 text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                          >
                            Anulează
                          </button>
                          <button
                            type="submit"
                            disabled={disablePinMutation.isPending}
                            className="px-4 h-8 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            {disablePinMutation.isPending ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Lock className="w-3.5 h-3.5" />
                            )}
                            Confirmă dezactivarea
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>

              {showPasswordForm ? (
                <form
                  onSubmit={handleChangePassword}
                  className="space-y-3 border border-black/[0.05] dark:border-white/[0.07] p-4 rounded-2xl bg-[#f2f2f7]/60 dark:bg-[#2c2c2e]/60"
                >
                  <h3 className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    Schimbă parola
                  </h3>
                  <div>
                    <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                      Parola curentă
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      required
                      className="w-full px-3 h-9 text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                      Parola nouă
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      className="w-full px-3 h-9 text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                      Confirmă parola nouă
                    </label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={e => setConfirmNewPassword(e.target.value)}
                      required
                      minLength={8}
                      className="w-full px-3 h-9 text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                    />
                  </div>
                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setShowPasswordForm(false)}
                      className="apple-btn-glass px-3.5 h-8 text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                    >
                      Anulează
                    </button>
                    <button
                      type="submit"
                      disabled={changePasswordMutation.isPending}
                      className="apple-btn-prominent px-4 h-8 text-[12px] font-semibold inline-flex items-center justify-center min-w-[85px] cursor-pointer"
                    >
                      {changePasswordMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        "Salvează"
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between py-3 border-b border-black/[0.05] dark:border-white/[0.07]">
                  <div>
                    <div className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                      Schimbă parola
                    </div>
                    <div className="text-[12px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
                      Actualizează parola contului tău
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPasswordForm(true)}
                    className="apple-btn-glass inline-flex items-center gap-1.5 px-4 h-8 text-[#1d1d1f] dark:text-[#f5f5f7] text-[12px] font-medium cursor-pointer"
                  >
                    Schimbă
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              )}

              {[
                {
                  label: "Autentificare în doi pași (2FA)",
                  desc: "Adaugă un strat extra de securitate",
                  action: "Activează",
                },
                {
                  label: "Sesiuni active",
                  desc: "Gestionează dispozitivele conectate",
                  action: "Vezi",
                },
                {
                  label: "Log activitate",
                  desc: "Istoricul acțiunilor din cont",
                  action: "Descarcă",
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-3 border-b border-black/[0.05] dark:border-white/[0.07] last:border-0"
                >
                  <div>
                    <div className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                      {item.label}
                    </div>
                    <div className="text-[12px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
                      {item.desc}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      toast.info(item.label, {
                        description: "Funcție disponibilă în curând",
                      })
                    }
                    className="apple-btn-glass inline-flex items-center gap-1.5 px-4 h-8 text-[#1d1d1f] dark:text-[#f5f5f7] text-[12px] font-medium cursor-pointer"
                  >
                    {item.action}
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Portal Contabil tab */}
          {activeTab === "accountant" && (
            <div className="apple-surface p-5 sm:p-6 space-y-5">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    Portalul contabilului
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300">
                    Vizualizare securizată
                  </span>
                </div>
                <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-1 leading-relaxed">
                  Oferă contabilului un link securizat protejat prin cod PIN. Contabilul poate vizualiza facturile primite, descărca fișele NIR, fișierele PDF și XML-ul pentru SAGA C, fără acces la restul aplicației.
                </p>
              </div>

              {/* Activare Portal */}
              <div className="flex items-center justify-between py-3.5 border-b border-black/[0.05] dark:border-white/[0.07]">
                <div className="pr-4">
                  <div className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    Stare portal
                  </div>
                  <div className="text-[12px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
                    Activează sau dezactivează accesul contabilului pe baza link-ului.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPortalEnabled(!portalEnabled)}
                  style={
                    portalEnabled
                      ? { backgroundColor: "var(--tenant-theme-color, #16a34a)" }
                      : undefined
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                    portalEnabled ? "" : "bg-black/[0.12] dark:bg-white/[0.16]"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                      portalEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Mod Interfață Portal (Normală vs SAGA) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5 border-b border-black/[0.05] dark:border-white/[0.07]">
                <div className="pr-4">
                  <div className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    Interfață implicită portal
                  </div>
                  <div className="text-[12px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
                    Alegeți interfața în care se deschide automat portalul pentru contabil, fără comutare manuală.
                  </div>
                </div>
                <div
                  role="group"
                  aria-label="Interfață implicită portal contabil"
                  className="apple-segmented self-start sm:self-auto shrink-0"
                >
                  <button
                    type="button"
                    data-active={portalViewMode === "modern"}
                    onClick={() => handleChangePortalViewMode("modern")}
                    disabled={updateAccountantConfigMutation.isPending}
                    className="apple-segmented-item px-3.5"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Interfață Normală</span>
                  </button>
                  <button
                    type="button"
                    data-active={portalViewMode === "saga"}
                    onClick={() => handleChangePortalViewMode("saga")}
                    disabled={updateAccountantConfigMutation.isPending}
                    className="apple-segmented-item px-3.5"
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>Interfață SAGA</span>
                  </button>
                </div>
              </div>

              {/* Link de acces */}
              <div className="space-y-3 py-3 border-b border-black/[0.05] dark:border-white/[0.07]">
                <div>
                  <label className="block text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    Link de acces contabil
                  </label>
                  <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
                    Trimiteți acest link contabilului pe WhatsApp sau Email.
                  </p>
                </div>
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                  <div className="flex-1 min-w-0 px-3.5 py-2 rounded-xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.08] tabular-nums text-[12.5px] text-[#1d1d1f] dark:text-[#f5f5f7] select-all truncate">
                    {portalShareUrl || "Se generează link-ul..."}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!portalShareUrl) return;
                      navigator.clipboard.writeText(portalShareUrl);
                      setIsCopiedPortalLink(true);
                      toast.success("Link-ul portalului a fost copiat în clipboard!");
                      setTimeout(() => setIsCopiedPortalLink(false), 2000);
                    }}
                    className="apple-btn-glass inline-flex items-center gap-1.5 h-9 px-4 text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-medium shrink-0 cursor-pointer"
                  >
                    {isCopiedPortalLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Copiat</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiază</span>
                      </>
                    )}
                  </button>
                  <a
                    href={portalShareUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="apple-btn-prominent h-9 px-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Deschide Portalul</span>
                  </a>
                </div>
              </div>

              {/* Cod / Identificator URL Personalizat */}
              {(() => {
                const rawExampleBase = (settings.name || currentTenantData?.name || "")
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .toLowerCase()
                  .replace(/\b(s\.?r\.?l\.?|s\.?a\.?|s\.?c\.?|p\.?f\.?a\.?|i\.?i\.?|workspace)\b/g, " ")
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-+|-+$/g, "");
                const portalSlugExample1 = rawExampleBase || "firma-mea";
                const portalSlugExample2 = rawExampleBase
                  ? `contabilitate-${rawExampleBase.split("-").slice(0, 2).join("-")}`
                  : "contabilitate-firma";
                const portalHostPrefix =
                  typeof window !== "undefined" && window.location?.host
                    ? `${window.location.host}/contabil/`
                    : "facturaspv.ro/contabil/";

                return (
                  <div className="space-y-2 py-3 border-b border-black/[0.05] dark:border-white/[0.07]">
                    <label className="block text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                      Identificator URL personalizat (codul din link)
                    </label>
                    <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d]">
                      Puteți personaliza codul din link cu denumirea firmei sau orice text doriți (ex:{" "}
                      <code className="font-sans font-semibold tabular-nums px-1.5 py-0.5 rounded bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {portalSlugExample1}
                      </code>
                      ,{" "}
                      <code className="font-sans font-semibold tabular-nums px-1.5 py-0.5 rounded bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {portalSlugExample2}
                      </code>
                      ).
                    </p>
                    <div className="flex items-center max-w-md">
                      <span className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] tabular-nums select-none px-3 py-2 rounded-l-xl bg-[#e5e5ea] dark:bg-[#3a3a3c] border border-r-0 border-black/[0.06] dark:border-white/[0.08]">
                        {portalHostPrefix}
                      </span>
                      <input
                        type="text"
                        value={portalSlug}
                        onChange={(e) =>
                          setPortalSlug(
                            e.target.value
                              .toLowerCase()
                              .replace(/\s+/g, "-")
                              .replace(/[^a-z0-9-_]/g, "")
                          )
                        }
                        placeholder="cod-firma"
                        className="flex-1 min-w-0 px-3 py-2 rounded-r-xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.08] tabular-nums text-[12.5px] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                      />
                    </div>
                    <div className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d]">
                      Sau puteți{" "}
                      <button
                        type="button"
                        onClick={() => handleSavePortalConfig(true)}
                        disabled={updateAccountantConfigMutation.isPending}
                        className="text-[#0071e3] dark:text-[#64d2ff] hover:underline cursor-pointer"
                      >
                        genera automat un cod aleator nou
                      </button>
                      .
                    </div>
                  </div>
                );
              })()}

              {/* Cod PIN Securitate */}
              <div className="space-y-3 py-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <label className="block text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                      Cod PIN acces contabil (4 cifre)
                    </label>
                    <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
                      {accountantPortalConfig?.hasPin
                        ? "Protecția prin cod PIN este activată. Pentru a schimba codul, introduceți un PIN nou de 4 cifre și salvați."
                        : "Setați un cod PIN de 4 cifre pentru a bloca accesul neautorizat la documente."}
                    </p>
                  </div>
                  {accountantPortalConfig?.hasPin && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300">
                      <Lock className="w-3 h-3" />
                      PIN activ
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 max-w-sm flex-wrap">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={portalPin}
                    onChange={(e) => setPortalPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="ex: 1234"
                    className="w-36 px-3 py-2 rounded-xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.08] text-center tabular-nums font-bold tracking-widest text-[#1d1d1f] dark:text-[#f5f5f7] text-base outline-none"
                  />
                  <span className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d]">
                    {portalPin.length === 4 ? "Gata de actualizare" : "Maxim 4 cifre"}
                  </span>
                  {accountantPortalConfig?.hasPin && (
                    <button
                      type="button"
                      onClick={() => handleSavePortalConfig(false, true)}
                      disabled={updateAccountantConfigMutation.isPending}
                      className="text-xs text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                    >
                      Elimină PIN-ul
                    </button>
                  )}
                </div>
              </div>

              {/* Buton Salvare */}
              <div className="pt-4 border-t border-black/[0.05] dark:border-white/[0.07] flex justify-end">
                <button
                  type="button"
                  onClick={() => handleSavePortalConfig(false)}
                  disabled={updateAccountantConfigMutation.isPending}
                  className="apple-btn-prominent inline-flex items-center gap-2 px-5 h-9 font-semibold text-[13px] disabled:opacity-50 cursor-pointer"
                >
                  {updateAccountantConfigMutation.isPending && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>Salvează modificările</span>
                </button>
              </div>
            </div>
          )}

          {/* GDPR tab */}
          {activeTab === "gdpr" && (
            <div className="apple-surface p-5 sm:p-6 space-y-5">
              <div>
                <h2 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Confidențialitate & date personale
                </h2>
                <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-1">
                  Gestionează datele contului tău conform normelor GDPR.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 py-3 border-b border-black/[0.05] dark:border-white/[0.07]">
                  <div className="pr-4">
                    <div className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                      Exportă datele mele
                    </div>
                    <div className="text-[12px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
                      Descarcă o copie completă a datelor tale (facturi, clienți, istoric) în format JSON.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportData}
                    disabled={exportDataMutation.isPending}
                    className="apple-btn-glass inline-flex items-center justify-center gap-1.5 px-4 h-8 text-[#1d1d1f] dark:text-[#f5f5f7] text-[12px] font-medium whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {exportDataMutation.isPending ? "Se descarcă..." : "Exportă JSON"}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 py-3">
                  <div className="pr-4">
                    <div className="text-[13.5px] font-semibold text-rose-600 dark:text-rose-400">
                      Șterge contul
                    </div>
                    <div className="text-[12px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
                      Șterge permanent datele de autentificare. Facturile emise vor fi păstrate anonimizat conform obligațiilor fiscale (10 ani).
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteConfirmText("");
                      setShowDeleteAccountDialog(true);
                    }}
                    disabled={deleteAccountMutation.isPending}
                    className="apple-btn-glass inline-flex items-center justify-center gap-1.5 px-4 h-8 text-rose-600 dark:text-rose-400 text-[12px] font-medium whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {deleteAccountMutation.isPending ? "Se șterge..." : "Șterge contul"}
                  </button>
                </div>
              </div>
            </div>
          )}

          <AlertDialog
            open={showDeleteAccountDialog}
            onOpenChange={(open) => {
              setShowDeleteAccountDialog(open);
              if (!open) setDeleteConfirmText("");
            }}
          >
            <AlertDialogContent className="bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Șterge definitiv contul?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-[#6e6e73] dark:text-[#98989d]">
                  Ești sigur că vrei să-ți ștergi definitiv contul? Acest proces este ireversibil.
                  Scrie cuvântul <strong>STERGE</strong> pentru a confirma.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="STERGE"
                autoComplete="off"
                className="tabular-nums bg-[#f2f2f7] dark:bg-[#2c2c2e] border-black/[0.06] dark:border-white/[0.08]"
              />
              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={() => setDeleteConfirmText("")}
                  className="rounded-full apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7]"
                >
                  Anulează
                </AlertDialogCancel>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleteConfirmText !== "STERGE" || deleteAccountMutation.isPending}
                  onClick={handleDeleteAccount}
                  className="rounded-full bg-red-600 hover:bg-red-700 text-white"
                >
                  {deleteAccountMutation.isPending ? "Se șterge..." : "Șterge definitiv contul"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Save button */}
          {(activeTab === "company" ||
            activeTab === "pf" ||
            activeTab === "invoicing" ||
            activeTab === "localization") && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={activeTab === "pf" ? handleSavePf : handleSave}
                disabled={activeTab === "pf" ? savingPf : saving}
                className="apple-btn-prominent inline-flex items-center gap-1.5 px-5 h-9 text-[13px] font-semibold disabled:opacity-60 cursor-pointer"
              >
                {(activeTab === "pf" ? savingPf : saving) ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                {activeTab === "pf" && !entityPair?.pf
                  ? "Salvează și activează Persoana Fizică"
                  : "Salvează"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BankAccountsSection({
  subtitle,
  accounts,
  onAdd,
  onUpdate,
  onRemove,
}: {
  subtitle: string;
  accounts: BankAccount[];
  onAdd: () => void;
  onUpdate: (index: number, field: keyof BankAccount, val: any) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="pt-4 border-t border-black/[0.05] dark:border-white/[0.07] space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
            Date bancare & conturi (IBAN)
          </h3>
          <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d]">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="apple-btn-glass inline-flex items-center gap-1.5 px-3.5 h-8 text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Adaugă cont / IBAN
        </button>
      </div>

      <div className="space-y-2.5">
        {accounts.map((acc, idx) => (
          <div
            key={acc.id || idx}
            className="p-3.5 bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.05] dark:border-white/[0.07] rounded-2xl space-y-2.5 relative"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Cont {idx + 1}
                </span>
                {idx === 0 && (
                  <span className="px-2 py-0.5 text-[10.5px] font-medium rounded-full bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300">
                    Principal
                  </span>
                )}
              </div>
              {accounts.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemove(idx)}
                  className="text-[#8e8e93] hover:text-rose-500 p-1 transition-colors cursor-pointer"
                  title="Șterge acest cont"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
              <div className="sm:col-span-3">
                <label className="text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                  Valută
                </label>
                <select
                  value={acc.currency || "RON"}
                  onChange={e => onUpdate(idx, "currency", e.target.value)}
                  className="w-full h-9 px-2.5 text-[12.5px] font-semibold rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none cursor-pointer"
                >
                  <option value="RON">RON (Lei)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CHF">CHF</option>
                </select>
              </div>
              <div className="sm:col-span-5">
                <label className="text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                  IBAN
                </label>
                <input
                  type="text"
                  value={acc.iban}
                  onChange={e => onUpdate(idx, "iban", e.target.value.toUpperCase())}
                  placeholder="RO49AAAA..."
                  className="w-full h-9 px-3 text-[12.5px] tabular-nums rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none"
                />
              </div>
              <div className="sm:col-span-4">
                <label className="text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                  Bancă
                </label>
                <input
                  type="text"
                  value={acc.bank}
                  onChange={e => onUpdate(idx, "bank", e.target.value)}
                  placeholder="ex: Unicredit, BCR..."
                  className="w-full h-9 px-3 text-[12.5px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingField({
  label,
  value,
  onChange,
  placeholder,
  mono,
  autocomplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  autocomplete?: string;
}) {
  return (
    <div>
      <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
        {label}
      </label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autocomplete || "on"}
        className={`w-full px-3 h-9 text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] outline-none text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] transition-all${
          mono ? " tabular-nums" : ""
        }`}
      />
    </div>
  );
}
