// Integrations — RefacturaRO
// Connect SmartBill, SPV, Oblio and other accounting systems

import { useState, useMemo, useRef, useEffect } from "react";
import {
  Plug,
  Check,
  X,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Zap,
  Loader2,
  Bot,
  Send,
  ChevronDown,
  ChevronUp,
  Settings,
  Upload,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { parseEfacturaXML } from "@/lib/efactura";
import JSZip from "jszip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── AI Assistant for setup guidance ────────────────────────────────────────

type Message = { role: "user" | "ai"; text: string };

type SetupStep =
  | "greeting"
  | "provider"
  | "oblio_email"
  | "oblio_secret"
  | "oblio_cif"
  | "done";

function useSetupAssistant(
  onConfigSave: (provider: string, config: Record<string, string>) => void
) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      text: "Salut! Sunt asistentul de configurare. Te ajut sa conectezi rapid o platforma de facturare.\n\nCe platforma vrei sa conectezi?\n- **Oblio** — scrie `oblio`\n- **SmartBill** — scrie `smartbill`\n- **SPV ANAF** — scrie `spv`",
    },
  ]);
  const [step, setStep] = useState<SetupStep>("provider");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [selectedProvider, setSelectedProvider] = useState("");

  const respond = (userText: string) => {
    const trimmed = userText.trim().toLowerCase();
    const newMessages: Message[] = [
      ...messages,
      { role: "user", text: userText },
    ];

    if (step === "provider") {
      if (trimmed.includes("oblio")) {
        setSelectedProvider("oblio");
        setStep("oblio_email");
        newMessages.push({
          role: "ai",
          text: "Perfect! **Pasul 1/3** — Care este adresa de email cu care esti logat pe oblio.eu?",
        });
      } else if (trimmed.includes("smartbill")) {
        setSelectedProvider("smartbill");
        newMessages.push({
          role: "ai",
          text: "SmartBill vine in curand!\n\nDeocamdata poti configura **Oblio** sau **SPV ANAF**. Care preferi?",
        });
      } else if (trimmed.includes("spv")) {
        setSelectedProvider("spv");
        newMessages.push({
          role: "ai",
          text: "Integrarea SPV ANAF necesită un certificat digital calificat și înregistrarea aplicației pe portalul ANAF.\n\n[Creează cont / Autentifică-te în SPV ANAF](https://www.anaf.ro/anaf/internet/ANAF/servicii_online/inregistrare_utilizatori)\n\nContactează-ne pentru asistență sau alege **Oblio** pentru o configurare rapidă.",
        });
      } else {
        newMessages.push({
          role: "ai",
          text: "Nu am recunoscut platforma. Te rog scrie `oblio`, `smartbill` sau `spv`.",
        });
      }
    } else if (step === "oblio_email") {
      if (!userText.includes("@")) {
        newMessages.push({
          role: "ai",
          text: "Hm, ăsta nu pare un email valid. Încearcă din nou — ex: `emailul_tau@gmail.com`",
        });
      } else {
        setDraft(d => ({ ...d, email: userText.trim() }));
        setStep("oblio_secret");
        newMessages.push({
          role: "ai",
          text: `Email salvat.\n\n**Pasul 2/3** — Acum am nevoie de **API Secret**.\n\nIl gasesti in Oblio la:\nSetari → Date Cont → campul **API secret**\n\nCopiaza-l si paste-uieste-l aici.`,
        });
      }
    } else if (step === "oblio_secret") {
      if (userText.trim().length < 20) {
        newMessages.push({
          role: "ai",
          text: "Cheia pare prea scurtă. Asigură-te că ai copiat tot textul din câmpul API Secret (fără spații la capăt).",
        });
      } else {
        setDraft(d => ({ ...d, apiSecret: userText.trim() }));
        setStep("oblio_cif");
        newMessages.push({
          role: "ai",
          text: `API Secret salvat.\n\n**Pasul 3/3** — Ultimul pas! Am nevoie de **CUI-ul (CIF-ul) firmei** tale din Oblio.\n\nIl gasesti la:\nSetari → Date Firma → campul **Cod Fiscal**\n\nEx: \`42322117\``,
        });
      }
    } else if (step === "oblio_cif") {
      const cifClean = userText.trim().replace(/^RO/i, "");
      if (!/^\d{6,10}$/.test(cifClean)) {
        newMessages.push({
          role: "ai",
          text: "CIF-ul trebuie să fie format din 6-10 cifre (ex: `42322117`). Încearcă din nou.",
        });
      } else {
        const finalConfig: Record<string, string> = { ...draft, cif: cifClean };
        setDraft(finalConfig);
        setStep("done");
        newMessages.push({
          role: "ai",
          text: `Configurare completa!\n\nEmail: ${finalConfig.email}\nAPI Secret: ${"•".repeat(Math.min(finalConfig.apiSecret?.length || 0, 20))}\nCIF: ${cifClean}\n\nSalvez acum configurarea si pornesc sincronizarea...`,
        });
        onConfigSave("oblio", finalConfig);
      }
    } else if (step === "done") {
      newMessages.push({
        role: "ai",
        text: "Configurarea e gata! Apasă **Sincronizează acum** pe cardul Oblio pentru a importa facturile.",
      });
    }

    setMessages(newMessages);
  };

  return { messages, respond, step };
}

// ── Provider config form ────────────────────────────────────────────────────

function SpvConfigForm({
  tenantCui,
  entityType,
  serverConfigured,
  hasActiveToken,
  tokenExpiresAt,
}: {
  tenantCui?: string;
  entityType?: "pj" | "pf";
  serverConfigured?: boolean;
  hasActiveToken?: boolean;
  tokenExpiresAt?: string | null;
}) {
  const cleanCode = String(tenantCui || "").replace(/^RO/i, "").trim();
  const isPf = entityType === "pf" || /^\d{13}$/.test(cleanCode);
  return (
    <div className="pt-3 border-t border-slate-100 dark:border-slate-700 space-y-3">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        Configurare SPV ANAF
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {/* CIF / CNP — din profilul activ */}
        <div className="relative">
          <input
            type="text"
            readOnly
            value={
              cleanCode
                ? isPf
                  ? cleanCode
                  : `RO${cleanCode}`
                : "—"
            }
            className="h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 w-full cursor-default tabular-nums"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-medium">
            {isPf ? "CNP" : "CIF"}
          </span>
        </div>
        {/* OAuth Token status */}
        <div className="relative">
          <input
            type="password"
            readOnly
            value={hasActiveToken ? "••••••••••••••••" : ""}
            placeholder={
              hasActiveToken ? undefined : "Token lipsă — reconectare necesară"
            }
            className="h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 w-full cursor-default placeholder:text-red-400"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-medium">
            Access Token
          </span>
        </div>
        {/* Client ID server */}
        <div className="relative">
          <input
            type="password"
            readOnly
            value={serverConfigured ? "••••••••••••••••" : ""}
            placeholder={
              serverConfigured ? undefined : "Neconfigurat pe server"
            }
            className="h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 w-full cursor-default placeholder:text-amber-500"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-medium">
            Client ID/Secret
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className={`flex items-center gap-1 text-xs font-medium ${hasActiveToken ? "text-emerald-600" : "text-red-500"}`}
        >
          {hasActiveToken ? (
            <Check className="w-3.5 h-3.5" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5" />
          )}
          {hasActiveToken
            ? `OAuth activ${tokenExpiresAt ? ` · expiră ${new Date(tokenExpiresAt).toLocaleDateString("ro-RO")}` : ""}`
            : "Niciun token OAuth — apasă toggle pentru reconectare"}
        </span>
        {!serverConfigured && (
          <span className="flex items-center gap-1 text-xs font-medium text-amber-500">
            <AlertCircle className="w-3.5 h-3.5" />
            Client ID/Secret lipsesc din env server
          </span>
        )}
        <a
          href="https://www.anaf.ro/anaf/internet/RO/spv"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 transition-colors ml-auto"
        >
          <ExternalLink className="w-3 h-3" /> ANAF Developer Portal
        </a>
      </div>
      {!tenantCui && (
        <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Completează și salvează mai întâi CNP-ul / CUI-ul profilului în pagina Setări înainte de autorizarea cu tokenul USB ANAF.
            </span>
          </div>
          <Link
            href="/setari"
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold whitespace-nowrap shrink-0 transition-colors"
          >
            Mergi la Setări
          </Link>
        </div>
      )}
      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        Conexiunea SPV se face prin OAuth ANAF. Tokenul se reînnoiește automat.
        {" "}{isPf ? "CNP-ul" : "CIF-ul"} este preluat din profilul activ.
      </p>
    </div>
  );
}

function OblioConfigForm({
  onSave,
  saving,
  initialData,
}: {
  onSave: (cfg: Record<string, string>) => void;
  saving: boolean;
  initialData?: any;
}) {
  const [email, setEmail] = useState(initialData?.email || "");
  const [apiSecret, setApiSecret] = useState(initialData?.apiSecret || "");
  const [cif, setCif] = useState(initialData?.cif || "");
  const [showSecret, setShowSecret] = useState(false);

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        Configurare Oblio
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email cont Oblio"
          className="h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <div className="relative">
          <input
            type={showSecret ? "text" : "password"}
            value={apiSecret}
            onChange={e => setApiSecret(e.target.value)}
            placeholder="API Secret"
            className="w-full h-9 px-3 pr-9 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            type="button"
            onClick={() => setShowSecret(s => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
          >
            {showSecret ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        <input
          type="text"
          value={cif}
          onChange={e => setCif(e.target.value)}
          placeholder="CIF / CUI firmă"
          className="h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            if (!email || !apiSecret || !cif) {
              toast.error("Completează toate câmpurile");
              return;
            }
            onSave({ email, apiSecret, cif: cif.replace(/^RO/i, "") });
          }}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 h-8 rounded-full bg-[var(--color-primary)] hover:opacity-90 text-white text-xs font-bold transition-all disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Check className="w-3 h-3" />
          )}
          Salvează configurarea
        </button>
        <a
          href="https://www.oblio.eu/account/settings"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
        >
          <ExternalLink className="w-3 h-3" /> Oblio → Date Cont
        </a>
      </div>
    </div>
  );
}

function SmartBillConfigForm({
  onSave,
  saving,
}: {
  onSave: (cfg: Record<string, string>) => void;
  saving: boolean;
}) {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [cif, setCif] = useState("");
  const [showToken, setShowToken] = useState(false);

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        Configurare SmartBill
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email cont SmartBill"
          className="h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <div className="relative">
          <input
            type={showToken ? "text" : "password"}
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="API Token"
            className="w-full h-9 px-3 pr-9 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            type="button"
            onClick={() => setShowToken(s => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
          >
            {showToken ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        <input
          type="text"
          value={cif}
          onChange={e => setCif(e.target.value)}
          placeholder="CIF / CUI firmă"
          className="h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            if (!email || !token || !cif) {
              toast.error("Completează toate câmpurile");
              return;
            }
            onSave({ email, token, cif: cif.replace(/^RO/i, "") });
          }}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Check className="w-3 h-3" />
          )}
          Salvează configurarea
        </button>
        <a
          href="https://cloud.smartbill.ro/core/configurare/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 transition-colors"
        >
          <ExternalLink className="w-3 h-3" /> SmartBill → Setări API
        </a>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

const PROVIDERS = [
  {
    id: "saga",
    name: "SAGA Accounting",
    description: "Exportă automat facturile și NIR-urile în format XML compatibil SAGA C.",
    logoColor: "#0284c7",
    logoText: "SAGA",
    logoBg: "#0284c7",
    comingSoon: false,
  },
  {
    id: "spv",
    name: "SPV ANAF",
    description:
      "Importă facturi primite (e-Factura XML) din spațiul privat virtual ANAF.",
    logoColor: "#003DA5",
    logoText: "SPV",
    logoUrl: "https://static.anaf.ro/static/10/Anaf/primapagina/anaf_ro.png",
    logoBg: "#ffffff",
    comingSoon: false,
  },
  {
    id: "oblio",
    name: "Oblio",
    description: "Sincronizează facturi emise și clienți din Oblio.",
    logoColor: "#7C3AED",
    logoText: "Ob",
    logoUrl: "https://www.oblio.eu/skins/site/assets/img/brand/logo-white.webp",
    logoBg: "#7C3AED",
    comingSoon: false,
  },
  {
    id: "smartbill",
    name: "SmartBill",
    description: "Importă automat facturile emise și primite din SmartBill.",
    logoColor: "#ffffff",
    logoText: "SB",
    logoUrl: "https://www.smartbill.ro/img/sb-logo-19-ani.svg",
    comingSoon: false,
  },
];

export default function Integrations() {
  const [showAI, setShowAI] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [configuringId, setConfiguringId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [deleteProviderId, setDeleteProviderId] = useState<string | null>(null);
  const [spvAuthError, setSpvAuthError] = useState<{ code: string; desc?: string } | null>(null);
  const aiEndRef = useRef<HTMLDivElement>(null);

  const {
    data: dbIntegrations = [],
    isLoading,
    refetch,
  } = trpc.integrations.list.useQuery();

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const spvSuccess = params.get("spv_success");
      const spvError = params.get("spv_error");
      const spvErrorDesc = params.get("spv_error_desc");

      if (spvSuccess === "true") {
        toast.success("Conectarea OAuth cu SPV ANAF a reușit!");
        setSpvAuthError(null);
        refetch();
        window.history.replaceState({}, "", window.location.pathname);
      } else if (spvError) {
        setSpvAuthError({
          code: spvError,
          desc: spvErrorDesc && spvErrorDesc !== "undefined" ? spvErrorDesc : undefined,
        });
        toast.error(`Autorizarea ANAF SPV a eșuat (${spvError}).`);
        window.history.replaceState({}, "", window.location.pathname);
      }
    } catch {}
  }, [refetch]);
  const upsertMutation = trpc.integrations.upsert.useMutation({
    onSuccess: () => refetch(),
    onError: e => toast.error("Eroare la salvare: " + e.message),
  });

  const exportSagaMutation = trpc.integrations.exportSaga.useMutation({
    onSuccess: (data: any) => {
      let blob: Blob;
      if (data.base64) {
        const binaryStr = window.atob(data.base64);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        blob = new Blob([bytes], { type: "application/xml; charset=windows-1250" });
      } else {
        blob = new Blob([data.xml], { type: "application/xml; charset=windows-1250" });
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename || `Export_SAGA.xml`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Fișierul SAGA a fost descărcat cu succes!");
    },
    onError: (err) => {
      toast.error("Eroare la generare SAGA: " + err.message);
    },
  });
  const disconnectOblioMutation = trpc.integrations.disconnectOblio.useMutation(
    {
      onSuccess: () => {
        toast.success("Integrarea Oblio a fost ștearsă/dezactivată");
        setDeleteProviderId(null);
        refetch();
      },
      onError: e => {
        toast.error("Eroare la ștergere: " + e.message);
        setDeleteProviderId(null);
      },
    }
  );
  const disconnectSpvMutation = trpc.integrations.disconnectSpv.useMutation({
    onSuccess: () => {
      toast.success("Integrarea SPV a fost ștearsă/dezactivată");
      setDeleteProviderId(null);
      refetch();
    },
    onError: e => {
      toast.error("Eroare la ștergere: " + e.message);
      setDeleteProviderId(null);
    },
  });
  const syncOblioMutation = trpc.integrations.syncOblio.useMutation({
    onSuccess: result => {
      const msg = `Sync complet: ${result.imported} facturi noi, ${result.clientsImported} clienti noi`;
      toast.success(msg);
      refetch();
      setSyncing(null);
    },
    onError: e => {
      toast.error("Eroare sync Oblio: " + e.message);
      setSyncing(null);
    },
  });

  const getDbIntegration = (id: string) =>
    dbIntegrations.find((i: any) => i.provider === id);
  const getSpvOAuthUrl = trpc.integrations.getSpvOAuthUrl.useQuery();
  const syncSpvMutation = trpc.integrations.syncSpv.useMutation({
    onSuccess: (result) => {
      if (result.limitHit > 0) {
        const facturiNoi = result.imported === 1 ? "1 factură nouă importată" : `${result.imported} facturi noi importate`;
        const facturiLimita = result.limitHit === 1 ? "1 factură" : `${result.limitHit} facturi`;
        toast.warning(
          `Sync complet: ${facturiNoi}.\n${facturiLimita} nu ${result.limitHit === 1 ? "a putut" : "au putut"} fi ${result.limitHit === 1 ? "descărcată" : "descărcate"} azi — ANAF permite maxim 10 descărcări/zi per fișier. ${result.limitHit === 1 ? "Va fi importată" : "Vor fi importate"} automat mâine.`,
          { duration: 8000 }
        );
      } else if (result.imported > 0) {
        const facturiNoi = result.imported === 1 ? "1 factură nouă importată" : `${result.imported} facturi noi importate`;
        toast.success(`Sync complet: ${facturiNoi} din SPV!`);
      } else {
        toast.success("SPV sincronizat! Nicio factură nouă de importat.");
      }
      refetch();
    },
    onError: e => {
      toast.error("Eroare SPV: " + e.message);
    },
  });

  const syncSmartBillMutation = trpc.integrations.syncSmartBill.useMutation({
    onSuccess: result => {
      const msg = `SmartBill sync complet: ${result.imported} facturi noi, ${result.clientsImported} clienți noi`;
      toast.success(msg);
      refetch();
      setSyncing(null);
    },
    onError: e => {
      toast.error("Eroare sync SmartBill: " + e.message);
      setSyncing(null);
    },
  });

  const saveOblioConfig = async (config: Record<string, string>) => {
    try {
      await upsertMutation.mutateAsync({
        provider: "oblio",
        apiKey: config.apiSecret,
        apiSecret: JSON.stringify({ email: config.email, cif: config.cif }),
        status: "active",
      });
      toast.success("Oblio configurat cu succes!");
      setConfiguringId(null);
    } catch {
      // Eroarea este afișată de onError pe upsertMutation
    }
  };

  const handleSyncOblio = () => {
    setSyncing("oblio");
    syncOblioMutation.mutate();
  };

  const handleSyncSmartBill = () => {
    setSyncing("smartbill");
    syncSmartBillMutation.mutate();
  };

  const saveSmartBillConfig = async (config: Record<string, string>) => {
    try {
      await upsertMutation.mutateAsync({
        provider: "smartbill",
        apiKey: config.token,
        apiSecret: JSON.stringify({ email: config.email, cif: config.cif }),
        status: "active",
      });
      toast.success("SmartBill configurat cu succes!");
      setConfiguringId(null);
    } catch {
      // Eroarea este afișată de onError pe upsertMutation
    }
  };

  // AI setup assistant
  const { messages, respond, step } = useSetupAssistant(
    async (provider, config) => {
      if (provider === "oblio") {
        await saveOblioConfig(config);
      }
    }
  );

  const handleAISend = () => {
    if (!aiInput.trim()) return;
    respond(aiInput);
    setAiInput("");
  };

  useEffect(() => {
    aiEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // SPV file upload handler — import manual XML + ZIP e-Factura
  const importSpvMutation = trpc.invoices.importSpv.useMutation();

  const parseXmlFile = async (xmlText: string): Promise<any | null> => {
    try {
      const data = parseEfacturaXML(xmlText);
      if (!data.issueDate && !data.total && !data.supplierName) return null;
      if (!data.invoiceNumber)
        data.invoiceNumber = `XML-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return { ...data, xmlContent: xmlText };
    } catch {
      return null;
    }
  };

  const handleSpvXml = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    toast.loading("Procesare fișiere SPV...", { id: "spv" });

    const parsedInvoices: any[] = [];
    let errorCount = 0;

    for (const file of files) {
      const name = file.name.toLowerCase();

      // Handle ZIP files (SPV downloads)
      if (name.endsWith(".zip")) {
        try {
          const zip = await JSZip.loadAsync(await file.arrayBuffer());
          const xmlEntries = Object.values(zip.files).filter(
            f =>
              f.name.toLowerCase().endsWith(".xml") &&
              !f.name.toLowerCase().includes("semnatura")
          );
          for (const entry of xmlEntries) {
            const xmlText = await entry.async("text");
            const parsed = await parseXmlFile(xmlText);
            if (parsed) parsedInvoices.push(parsed);
            else errorCount++;
          }
        } catch {
          errorCount++;
        }
        continue;
      }

      // Handle bare XML files
      if (name.endsWith(".xml")) {
        const xmlText = await file.text();
        const parsed = await parseXmlFile(xmlText);
        if (parsed) parsedInvoices.push(parsed);
        else errorCount++;
        continue;
      }

      errorCount++;
    }

    if (!parsedInvoices.length) {
      toast.error("Niciun fișier e-Factura valid", { id: "spv" });
      e.target.value = "";
      return;
    }

    try {
      await importSpvMutation.mutateAsync(parsedInvoices);
      toast.success(
        `${parsedInvoices.length} facturi importate!${errorCount ? ` (${errorCount} fișiere ignorate)` : ""}`,
        { id: "spv" }
      );
    } catch (err: any) {
      toast.error(err?.message || "Eroare import", { id: "spv" });
    }
    e.target.value = "";
  };

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-3">
      <input
        type="file"
        id="spv-file-input"
        multiple
        accept=".xml,.zip"
        className="hidden"
        onChange={handleSpvXml}
      />

      {/* Header — identic cu Facturi */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
            Integrări
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Conectează platformele tale de facturare
          </p>
        </div>
        <button
          onClick={() => setShowAI(v => !v)}
          className="flex items-center gap-1.5 px-3.5 h-8 rounded-full bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium transition-all"
        >
          <Bot className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Asistent AI Setup</span>
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "TOTAL INTEGRĂRI",
            value: PROVIDERS.length,
            color: "text-slate-700 dark:text-slate-200",
          },
          {
            label: "ACTIVE",
            value: (dbIntegrations as any[]).filter(
              (i: any) => i.status === "active"
            ).length,
            color: "text-emerald-600 dark:text-emerald-400",
          },
          {
            label: "NECONECTATE",
            value:
              PROVIDERS.length -
              (dbIntegrations as any[]).filter(
                (i: any) => i.status === "active"
              ).length,
            color: "text-slate-500 dark:text-slate-400",
          },
          {
            label: "ULTIMA SYNC",
            value: (() => {
              const last = (dbIntegrations as any[])
                .filter((i: any) => i.lastSyncAt)
                .sort(
                  (a: any, b: any) =>
                    new Date(b.lastSyncAt).getTime() -
                    new Date(a.lastSyncAt).getTime()
                )[0];
              return last
                ? new Date(last.lastSyncAt).toLocaleDateString("ro-RO")
                : "—";
            })(),
            color: "text-blue-600 dark:text-blue-400",
            small: true,
          },
        ].map(s => (
          <div
            key={s.label}
            className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.06] dark:border-white/[0.09] px-3.5 py-2.5 shadow-2xs"
          >
            <p className="text-[10px] font-semibold text-[#636366] dark:text-[#98989d] uppercase tracking-wide mb-0.5">
              {s.label}
            </p>
            <p
              className={`${(s as any).small ? "text-sm" : "text-lg"} font-bold tabular-nums leading-tight ${s.color}`}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* AI Assistant Panel */}
      {showAI && (
        <div className="bg-white dark:bg-slate-900 rounded-[22px] border border-violet-200 dark:border-violet-800 shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-600 to-blue-600">
            <Bot className="w-4 h-4 text-white" />
            <span className="text-sm font-bold text-white">
              Asistent AI — Configurare integrări
            </span>
            <button
              onClick={() => setShowAI(false)}
              className="ml-auto text-white/70 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="h-52 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-800">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "ai" && (
                  <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0 mt-1 mr-2">
                    <Bot className="w-3 h-3 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-line ${
                    m.role === "ai"
                      ? "bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-tl-sm"
                      : "bg-violet-600 text-white rounded-tr-sm"
                  }`}
                >
                  {m.text.replace(/\*\*(.*?)\*\*/g, "$1")}
                </div>
              </div>
            ))}
            <div ref={aiEndRef} />
          </div>
          <div className="p-3 border-t border-slate-100 dark:border-slate-700 flex gap-2">
            <input
              value={aiInput}
              onChange={e => setAiInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAISend()}
              placeholder={
                step === "done"
                  ? "Configurare completă!"
                  : "Scrie răspunsul tău..."
              }
              disabled={step === "done"}
              className="flex-1 h-9 px-3 text-sm rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:opacity-50"
            />
            <button
              onClick={handleAISend}
              disabled={!aiInput.trim() || step === "done"}
              className="w-9 h-9 rounded-full bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Eroare OAuth SPV ANAF */}
      {spvAuthError && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-[22px] p-4 text-xs text-red-950 dark:text-red-100 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="font-bold">
                Autorizarea ANAF SPV a fost respinsă ({spvAuthError.code}
                {spvAuthError.desc ? ` — ${spvAuthError.desc}` : ""})
              </p>
              <p className="leading-relaxed opacity-90">
                Serverul ANAF nu a primit certificatul digital din browser sau a folosit o sesiune TLS memorată fără certificat.
              </p>
              <ul className="list-disc pl-4 space-y-0.5 opacity-90">
                <li>
                  Verifică în <strong>Setări</strong> că firma are salvat CUI-ul real (și că tokenul USB este asociat în SPV ANAF pentru acest CUI).
                </li>
                <li>
                  Pe Mac în Chrome, dacă ai băgat tokenul USB după ce browserul era deschis, închide complet Chrome cu <strong>Cmd + Q</strong> și redeschide-l (sau deschide o fereastră Incognito cu <strong>Cmd + Shift + N</strong>), cu aplicația driverului de semnătură pornită.
                </li>
                <li>
                  Când apeși toggle-ul SPV ANAF, selectează certificatul digital din fereastra sistemului și introdu PIN-ul tokenului.
                </li>
              </ul>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSpvAuthError(null)}
            className="w-7 h-7 rounded-full inline-flex items-center justify-center text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 shrink-0 cursor-pointer"
            title="Închide mesajul"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Integrations Table */}
      <div className="bg-white dark:bg-slate-900 rounded-[22px] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <th className="text-left px-4 py-2.5 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[10px] w-10">
                NR.
              </th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[10px]">
                PLATFORMĂ
              </th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[10px]">
                DESCRIERE
              </th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[10px]">
                STATUS
              </th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[10px]">
                ULTIMA SYNC
              </th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[10px]">
                FACTURI
              </th>
              <th className="text-right px-4 py-2.5 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[10px]">
                ACȚIUNI
              </th>
            </tr>
          </thead>
          <tbody>
            {PROVIDERS.map((provider, idx) => {
              const db =
                (dbIntegrations as any[]).find(
                  (i: any) => i.provider === provider.id
                ) ?? getDbIntegration(provider.id);
              const isActive = db?.status === "active";
              const isConfiguring = configuringId === provider.id;
              let parsedMeta: any = {};
              try {
                parsedMeta = db?.apiSecret ? JSON.parse(db.apiSecret) : {};
              } catch {}

              return (
                <>
                  <tr
                    key={provider.id}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Nr */}
                    <td className="px-4 py-3 tabular-nums text-slate-400 dark:text-slate-500 text-[11px]">
                      {idx + 1}
                    </td>

                    {/* Platformă */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 ${
                            (provider as any).logoUrl
                              ? "w-16 h-9 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-white/95"
                              : "w-9 h-9"
                          }`}
                          style={
                            (provider as any).logoBg || !(provider as any).logoUrl
                              ? {
                                  backgroundColor:
                                    (provider as any).logoBg || provider.logoColor,
                                }
                              : undefined
                          }
                        >
                          {(provider as any).logoUrl ? (
                            <img
                              src={(provider as any).logoUrl}
                              alt={provider.name}
                              className="w-full h-full object-contain p-1"
                              onError={e => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          ) : (
                            <span className="text-white font-bold text-xs">
                              {(provider as any).logoText ||
                                provider.name.slice(0, 2)}
                            </span>
                          )}
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-white text-xs">
                          {provider.name}
                        </span>
                      </div>
                    </td>

                    {/* Descriere */}
                    <td className="px-3 py-3 text-slate-500 dark:text-slate-400 max-w-[200px] truncate">
                      {provider.description}
                    </td>

                    {/* Status — Toggle */}
                    <td className="px-3 py-3">
                      {provider.comingSoon ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-700">
                          În curând
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            if (isActive) {
                              setDeleteProviderId(provider.id);
                            } else {
                              // connect
                              if (provider.id === "spv") {
                                if (!getSpvOAuthUrl.data?.tenantCui) {
                                  setConfiguringId("spv");
                                  toast.error(
                                    "Completează mai întâi CUI-ul firmei în pagina Setări înainte de conectarea SPV."
                                  );
                                  return;
                                }
                                if (getSpvOAuthUrl.data?.url) {
                                  window.location.href = getSpvOAuthUrl.data.url;
                                } else {
                                  toast.error("Eroare generare link OAuth ANAF. Verificați logurile serverului.");
                                }
                              } else {
                                setConfiguringId(
                                  isConfiguring ? null : provider.id
                                );
                              }
                            }
                          }}
                          disabled={
                            disconnectOblioMutation.isPending ||
                            disconnectSpvMutation.isPending ||
                            upsertMutation.isPending
                          }
                          title={isActive ? "Dezactivează" : "Activează"}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 ${
                            isActive ? "" : "bg-slate-300 dark:bg-slate-600"
                          }`}
                          style={
                            isActive
                              ? { backgroundColor: "var(--color-primary)" }
                              : undefined
                          }
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                              isActive ? "translate-x-[22px]" : "translate-x-[2px]"
                            }`}
                          />
                        </button>
                      )}
                    </td>

                    {/* Ultima sync */}
                    <td className="px-3 py-3 tabular-nums text-slate-500 dark:text-slate-400 text-[11px]">
                      {db?.lastSyncAt
                        ? new Date(db.lastSyncAt).toLocaleString("ro-RO", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                    </td>

                    {/* Facturi importate */}
                    <td className="px-3 py-3 tabular-nums font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                      {(db?.syncCount || 0) > 0 ? db?.syncCount : "—"}
                    </td>

                    {/* Acțiuni */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 justify-end flex-nowrap">
                        {/* SPV */}
                        {provider.id === "spv" && !provider.comingSoon && (
                          <>
                            {isActive &&
                              (() => {
                                const spvConfigured = !!(
                                  getSpvOAuthUrl.data?.serverConfigured &&
                                  getSpvOAuthUrl.data?.tenantCui
                                );
                                return (
                                  <>
                                    <Select
                                      defaultValue="60"
                                      onValueChange={v =>
                                        ((window as any).__spvZile = v)
                                      }
                                      disabled={!spvConfigured}
                                    >
                                      <SelectTrigger className="h-8 w-24 text-[11px] rounded-full border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 disabled:opacity-50">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="7">
                                          7 zile
                                        </SelectItem>
                                        <SelectItem value="30">
                                          30 zile
                                        </SelectItem>
                                        <SelectItem value="60">
                                          60 zile
                                        </SelectItem>
                                        <SelectItem value="90">
                                          90 zile
                                        </SelectItem>
                                        <SelectItem value="180">
                                          6 luni
                                        </SelectItem>
                                        <SelectItem value="365">
                                          1 an
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <button
                                      onClick={() => {
                                        if (!spvConfigured) {
                                          toast.error(
                                            "Configurați mai întâi SPV — CIF, Client ID și Client Secret"
                                          );
                                          setConfiguringId(provider.id);
                                          return;
                                        }
                                        const zile = parseInt(
                                          (window as any).__spvZile || "60"
                                        );
                                        syncSpvMutation.mutate({ zile });
                                      }}
                                      disabled={syncSpvMutation.isPending}
                                      className="flex items-center gap-1 px-3 h-8 rounded-full bg-[var(--color-primary)] hover:opacity-90 text-white text-[11px] font-semibold transition-all disabled:opacity-60"
                                      title={
                                        !spvConfigured
                                          ? "Configurați mai întâi SPV"
                                          : "Sincronizează"
                                      }
                                    >
                                      {syncSpvMutation.isPending ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <RefreshCw className="w-3 h-3" />
                                      )}
                                      Sync
                                    </button>
                                  </>
                                );
                              })()}

                            <button
                              onClick={() =>
                                setConfiguringId(
                                  isConfiguring ? null : provider.id
                                )
                              }
                              className="flex items-center gap-1 px-3 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-semibold transition-colors"
                            >
                              <Settings className="w-3 h-3" />
                              {isConfiguring ? "Închide" : "Configurare"}
                            </button>
                            <button
                              onClick={() =>
                                document
                                  .getElementById("spv-file-input")
                                  ?.click()
                              }
                              disabled={importSpvMutation.isPending}
                              className="flex items-center gap-1 px-3 h-8 rounded-full bg-slate-600 hover:bg-slate-700 text-white text-[11px] font-semibold transition-all"
                            >
                              {importSpvMutation.isPending ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Upload className="w-3 h-3" />
                              )}
                              Import ZIP/XML
                            </button>
                          </>
                        )}

                        {/* Oblio */}
                        {provider.id === "oblio" && !provider.comingSoon && (
                          <>
                            {isActive && (
                              <button
                                onClick={handleSyncOblio}
                                disabled={syncing === "oblio"}
                                className="flex items-center gap-1 px-3 h-8 rounded-full bg-[var(--color-primary)] hover:opacity-90 text-white text-[11px] font-semibold transition-all disabled:opacity-60"
                              >
                                {syncing === "oblio" ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="w-3 h-3" />
                                )}
                                Sync
                              </button>
                            )}
                            <button
                              onClick={() =>
                                setConfiguringId(
                                  isConfiguring ? null : provider.id
                                )
                              }
                              className="flex items-center gap-1 px-3 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-semibold transition-colors"
                            >
                              <Settings className="w-3 h-3" />
                              {isConfiguring ? "Închide" : "Configurare"}
                            </button>
                          </>
                        )}

                        {/* SmartBill */}
                        {provider.id === "smartbill" &&
                          !provider.comingSoon && (
                            <>
                              {isActive && (
                                <button
                                  onClick={handleSyncSmartBill}
                                  disabled={syncing === "smartbill"}
                                  className="flex items-center gap-1 px-3 h-8 rounded-full bg-[var(--color-primary)] hover:opacity-90 text-white text-[11px] font-semibold transition-all disabled:opacity-60"
                                >
                                  {syncing === "smartbill" ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <RefreshCw className="w-3 h-3" />
                                  )}
                                  Sync
                                </button>
                              )}
                              <button
                                onClick={() =>
                                  setConfiguringId(
                                    isConfiguring ? null : provider.id
                                  )
                                }
                                className="flex items-center gap-1 px-3 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-semibold transition-colors"
                              >
                                <Settings className="w-3 h-3" />
                                {isConfiguring ? "Închide" : "Configurare"}
                              </button>
                            </>
                          )}

                        {/* SAGA */}
                        {provider.id === "saga" && (
                          <button
                            onClick={() => {
                              const d = new Date();
                              const month = d.getMonth() + 1;
                              const year = d.getFullYear();
                              exportSagaMutation.mutate({ month, year });
                            }}
                            disabled={exportSagaMutation.isPending}
                            className="flex items-center gap-1 px-3 h-8 rounded-full bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-semibold transition-colors disabled:opacity-60"
                          >
                            <Download className="w-3 h-3" />
                            {exportSagaMutation.isPending ? "Generare..." : "Descarcă XML"}
                          </button>
                        )}

                        {provider.comingSoon && (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Config form row */}
                  {isConfiguring && (
                    <tr
                      key={`${provider.id}-cfg`}
                      className="border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-800/80"
                    >
                      <td />
                      <td colSpan={6} className="px-4 py-3">
                        {provider.id === "spv" && (
                          <SpvConfigForm
                            key={db?.id ?? "spv-new"}
                            tenantCui={getSpvOAuthUrl.data?.tenantCui}
                            entityType={(getSpvOAuthUrl.data as any)?.entityType}
                            serverConfigured={
                              getSpvOAuthUrl.data?.serverConfigured
                            }
                            hasActiveToken={!!db?.apiKey}
                            tokenExpiresAt={
                              db?.tokenExpiresAt
                                ? String(db.tokenExpiresAt)
                                : null
                            }
                          />
                        )}
                        {provider.id === "oblio" && (
                          <OblioConfigForm
                            key={db?.id ?? "oblio-new"}
                            initialData={parsedMeta}
                            onSave={saveOblioConfig}
                            saving={upsertMutation.isPending}
                          />
                        )}
                        {provider.id === "smartbill" && (
                          <SmartBillConfigForm
                            key={db?.id ?? "sb-new"}
                            onSave={saveSmartBillConfig}
                            saving={upsertMutation.isPending}
                          />
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              <td
                colSpan={7}
                className="px-4 py-2 text-[11px] text-slate-400 dark:text-slate-500"
              >
                Total înregistrări:{" "}
                <strong className="text-slate-600 dark:text-slate-300">
                  {PROVIDERS.length}
                </strong>
                <span className="ml-4">
                  În curând: WinMentor, Ciel, QuickBooks
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog
        open={!!deleteProviderId}
        onOpenChange={o => !o && setDeleteProviderId(null)}
      >
        <AlertDialogContent className="rounded-[22px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Dezactivează integrarea?</AlertDialogTitle>
            <AlertDialogDescription>
              Această acțiune va deconecta integrarea{" "}
              <strong>
                {deleteProviderId === "oblio"
                  ? "Oblio"
                  : deleteProviderId === "smartbill"
                    ? "SmartBill"
                    : "SPV ANAF"}
              </strong>{" "}
              și va șterge token-ul de acces. Facturile importate anterior rămân
              neafectate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Anulează</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteProviderId === "oblio") {
                  disconnectOblioMutation.mutate();
                } else if (deleteProviderId === "spv") {
                  disconnectSpvMutation.mutate();
                } else if (deleteProviderId === "smartbill") {
                  upsertMutation.mutate(
                    {
                      provider: "smartbill",
                      apiKey: "",
                      apiSecret: "",
                      status: "inactive",
                    },
                    {
                      onSuccess: () => {
                        toast.success("Integrarea SmartBill a fost deconectată");
                        setDeleteProviderId(null);
                      },
                    }
                  );
                }
              }}
              className="rounded-full bg-red-600 hover:bg-red-700 text-white"
            >
              Da, dezactivează
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
