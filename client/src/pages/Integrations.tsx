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
    <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.08] space-y-3">
      <p className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
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
            className="h-9 px-3 text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] w-full cursor-default tabular-nums outline-none"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[#8e8e93] font-medium">
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
            className="h-9 px-3 text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] w-full cursor-default placeholder:text-rose-500 outline-none"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[#8e8e93] font-medium">
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
            className="h-9 px-3 text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] w-full cursor-default placeholder:text-amber-500 outline-none"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[#8e8e93] font-medium">
            Client ID/Secret
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className={`flex items-center gap-1 text-xs font-medium ${hasActiveToken ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}
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
          className="flex items-center gap-1 text-xs text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] transition-colors ml-auto"
        >
          <ExternalLink className="w-3 h-3" /> ANAF Developer Portal
        </a>
      </div>
      {!tenantCui && (
        <div className="p-3 rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <span>
              Completează și salvează mai întâi CNP-ul / CUI-ul profilului în pagina Setări înainte de autorizarea cu tokenul USB ANAF.
            </span>
          </div>
          <Link
            href="/setari"
            className="apple-btn-prominent px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0"
          >
            Mergi la Setări
          </Link>
        </div>
      )}
      <p className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d]">
        Conexiunea SPV se face prin OAuth ANAF. Tokenul se reînnoiește automat.{" "}
        {isPf ? "CNP-ul" : "CIF-ul"} este preluat din profilul activ.
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
    <div className="mt-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.08] space-y-3">
      <p className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
        Configurare Oblio
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email cont Oblio"
          className="h-9 px-3 text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none"
        />
        <div className="relative">
          <input
            type={showSecret ? "text" : "password"}
            value={apiSecret}
            onChange={e => setApiSecret(e.target.value)}
            placeholder="API Secret"
            className="w-full h-9 px-3 pr-9 text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none"
          />
          <button
            type="button"
            onClick={() => setShowSecret(s => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]"
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
          className="h-9 px-3 text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none tabular-nums"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (!email || !apiSecret || !cif) {
              toast.error("Completează toate câmpurile");
              return;
            }
            onSave({ email, apiSecret, cif: cif.replace(/^RO/i, "") });
          }}
          disabled={saving}
          className="apple-btn-prominent inline-flex items-center gap-1.5 px-4 h-8 text-[12.5px] font-semibold disabled:opacity-60 cursor-pointer"
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
          className="flex items-center gap-1 text-xs text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] transition-colors"
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
    <div className="mt-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.08] space-y-3">
      <p className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
        Configurare SmartBill
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email cont SmartBill"
          className="h-9 px-3 text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none"
        />
        <div className="relative">
          <input
            type={showToken ? "text" : "password"}
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="API Token"
            className="w-full h-9 px-3 pr-9 text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none"
          />
          <button
            type="button"
            onClick={() => setShowToken(s => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]"
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
          className="h-9 px-3 text-[13px] rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none tabular-nums"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (!email || !token || !cif) {
              toast.error("Completează toate câmpurile");
              return;
            }
            onSave({ email, token, cif: cif.replace(/^RO/i, "") });
          }}
          disabled={saving}
          className="apple-btn-prominent inline-flex items-center gap-1.5 px-4 h-8 text-[12.5px] font-semibold disabled:opacity-60 cursor-pointer"
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
          className="flex items-center gap-1 text-xs text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] transition-colors"
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
    <div className="p-3 sm:p-5 max-w-full space-y-4 overflow-x-hidden">
      <input
        type="file"
        id="spv-file-input"
        multiple
        accept=".xml,.zip"
        className="hidden"
        onChange={handleSpvXml}
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
            Integrări
          </h1>
          <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
            Conectează platformele tale de facturare
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAI(v => !v)}
          className="apple-btn-glass inline-flex items-center gap-1.5 px-4 h-9 text-[12.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
        >
          <Bot className="w-3.5 h-3.5" />
          <span>Asistent AI Setup</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Total integrări",
            value: PROVIDERS.length,
            icon: <Plug className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />,
            iconBg: "bg-[#f2f4f7] dark:bg-[#2c2c2e]",
          },
          {
            label: "Active",
            value: (dbIntegrations as any[]).filter(
              (i: any) => i.status === "active"
            ).length,
            icon: <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
            iconBg: "bg-[#eefbf3] dark:bg-emerald-500/18",
          },
          {
            label: "Neconectate",
            value:
              PROVIDERS.length -
              (dbIntegrations as any[]).filter(
                (i: any) => i.status === "active"
              ).length,
            icon: <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />,
            iconBg: "bg-[#fff6eb] dark:bg-amber-500/18",
          },
          {
            label: "Ultima sincronizare",
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
            icon: <RefreshCw className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d]" />,
            iconBg: "bg-[#f2f4f7] dark:bg-[#2c2c2e]",
            small: true,
          },
        ].map(s => (
          <div
            key={s.label}
            className="apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5"
          >
            <div className="flex items-center justify-between gap-2 w-full">
              <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
                {s.label}
              </span>
              <span className={`w-7 h-7 rounded-[8px] ${s.iconBg} flex items-center justify-center shrink-0`}>
                {s.icon}
              </span>
            </div>
            <p
              className={`${
                (s as any).small ? "text-[18px] sm:text-[22px]" : "text-[24px] sm:text-[26px]"
              } font-bold tabular-nums tracking-[-0.028em] leading-none text-[#1d1d1f] dark:text-[#f5f5f7] truncate`}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* AI Assistant Panel */}
      {showAI && (
        <div className="apple-surface overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.08]">
            <span className="w-7 h-7 rounded-[8px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />
            </span>
            <span className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
              Asistent AI — Configurare integrări
            </span>
            <button
              type="button"
              onClick={() => setShowAI(false)}
              className="ml-auto w-7 h-7 rounded-full inline-flex items-center justify-center text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="h-52 overflow-y-auto p-4 space-y-3 bg-[#f5f5f7] dark:bg-[#141416]">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "ai" && (
                  <div className="w-6 h-6 rounded-full bg-[#e5e5ea] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0 mt-1 mr-2">
                    <Bot className="w-3 h-3 text-[#1d1d1f] dark:text-[#f5f5f7]" />
                  </div>
                )}
                <div
                  style={
                    m.role === "user"
                      ? { backgroundColor: "var(--tenant-theme-color, #0071e3)" }
                      : undefined
                  }
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[13px] whitespace-pre-line ${
                    m.role === "ai"
                      ? "bg-white dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.08] text-[#1d1d1f] dark:text-[#f5f5f7] rounded-tl-sm"
                      : "text-white rounded-tr-sm"
                  }`}
                >
                  {m.text.replace(/\*\*(.*?)\*\*/g, "$1")}
                </div>
              </div>
            ))}
            <div ref={aiEndRef} />
          </div>
          <div className="p-3 border-t border-black/[0.06] dark:border-white/[0.08] flex gap-2">
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
              className="flex-1 h-9 px-3.5 text-[13px] rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleAISend}
              disabled={!aiInput.trim() || step === "done"}
              className="apple-btn-prominent w-9 h-9 flex items-center justify-center disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Eroare OAuth SPV ANAF */}
      {spvAuthError && (
        <div className="apple-surface border-rose-500/30 p-4 text-[12.5px] text-[#1d1d1f] dark:text-[#f5f5f7] flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="font-semibold text-rose-700 dark:text-rose-300">
                Autorizarea ANAF SPV a fost respinsă ({spvAuthError.code}
                {spvAuthError.desc ? ` — ${spvAuthError.desc}` : ""})
              </p>
              <p className="leading-relaxed text-[#6e6e73] dark:text-[#98989d]">
                Serverul ANAF nu a primit certificatul digital din browser sau a folosit o sesiune TLS memorată fără certificat.
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-[#6e6e73] dark:text-[#98989d]">
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
            className="w-7 h-7 rounded-full inline-flex items-center justify-center text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 shrink-0 cursor-pointer"
            title="Închide mesajul"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Integrations Table */}
      <div className="apple-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
              <tr>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap w-12">
                  Nr.
                </th>
                <th className="text-left px-3 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Platformă
                </th>
                <th className="text-left px-3 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Descriere
                </th>
                <th className="text-left px-3 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Status
                </th>
                <th className="text-left px-3 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Ultima sincronizare
                </th>
                <th className="text-left px-3 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Facturi
                </th>
                <th className="text-right px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Acțiuni
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
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
                      className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors"
                    >
                      {/* Nr */}
                      <td className="px-4 py-3.5 tabular-nums text-[#8e8e93] text-[12px] font-medium">
                        {idx + 1}
                      </td>

                      {/* Platformă */}
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`rounded-xl flex items-center justify-center overflow-hidden shrink-0 ${
                              (provider as any).logoUrl
                                ? "w-16 h-9 border border-black/[0.08] dark:border-white/[0.10] bg-white"
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
                          <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-[13.5px] whitespace-nowrap">
                            {provider.name}
                          </span>
                        </div>
                      </td>

                      {/* Descriere */}
                      <td className="px-3 py-3.5 text-[12.5px] text-[#6e6e73] dark:text-[#98989d] max-w-[240px] truncate">
                        {provider.description}
                      </td>

                      {/* Status — Toggle */}
                      <td className="px-3 py-3.5">
                        {provider.comingSoon ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/12 text-amber-700 dark:bg-amber-500/18 dark:text-amber-300">
                            În curând
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (isActive) {
                                setDeleteProviderId(provider.id);
                              } else {
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
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-60 cursor-pointer ${
                              isActive ? "" : "bg-black/[0.12] dark:bg-white/[0.16]"
                            }`}
                            style={
                              isActive
                                ? { backgroundColor: "var(--tenant-theme-color, var(--color-primary))" }
                                : undefined
                            }
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform duration-200 ${
                                isActive ? "translate-x-[22px]" : "translate-x-[2px]"
                              }`}
                            />
                          </button>
                        )}
                      </td>

                      {/* Ultima sync */}
                      <td className="px-3 py-3.5 tabular-nums text-[#6e6e73] dark:text-[#98989d] text-[12.5px] whitespace-nowrap">
                        {db?.lastSyncAt
                          ? new Date(db.lastSyncAt).toLocaleString("ro-RO", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "—"}
                      </td>

                      {/* Facturi importate */}
                      <td className="px-3 py-3.5 tabular-nums font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-[13px]">
                        {(db?.syncCount || 0) > 0 ? db?.syncCount : "—"}
                      </td>

                      {/* Acțiuni */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
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
                                        <SelectTrigger className="apple-pill-control !h-8 w-24 text-[12px] border-0 shadow-none disabled:opacity-50">
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
                                        type="button"
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
                                        className="apple-btn-prominent inline-flex items-center gap-1 px-3 h-8 text-[12px] font-semibold disabled:opacity-60 cursor-pointer"
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
                                type="button"
                                onClick={() =>
                                  setConfiguringId(
                                    isConfiguring ? null : provider.id
                                  )
                                }
                                className="apple-btn-glass inline-flex items-center gap-1 px-3 h-8 text-[#1d1d1f] dark:text-[#f5f5f7] text-[12px] font-medium cursor-pointer"
                              >
                                <Settings className="w-3 h-3" />
                                {isConfiguring ? "Închide" : "Configurare"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  document
                                    .getElementById("spv-file-input")
                                    ?.click()
                                }
                                disabled={importSpvMutation.isPending}
                                className="apple-btn-glass inline-flex items-center gap-1 px-3 h-8 text-[#1d1d1f] dark:text-[#f5f5f7] text-[12px] font-medium cursor-pointer disabled:opacity-60"
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
                                  type="button"
                                  onClick={handleSyncOblio}
                                  disabled={syncing === "oblio"}
                                  className="apple-btn-prominent inline-flex items-center gap-1 px-3 h-8 text-[12px] font-semibold disabled:opacity-60 cursor-pointer"
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
                                type="button"
                                onClick={() =>
                                  setConfiguringId(
                                    isConfiguring ? null : provider.id
                                  )
                                }
                                className="apple-btn-glass inline-flex items-center gap-1 px-3 h-8 text-[#1d1d1f] dark:text-[#f5f5f7] text-[12px] font-medium cursor-pointer"
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
                                    type="button"
                                    onClick={handleSyncSmartBill}
                                    disabled={syncing === "smartbill"}
                                    className="apple-btn-prominent inline-flex items-center gap-1 px-3 h-8 text-[12px] font-semibold disabled:opacity-60 cursor-pointer"
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
                                  type="button"
                                  onClick={() =>
                                    setConfiguringId(
                                      isConfiguring ? null : provider.id
                                    )
                                  }
                                  className="apple-btn-glass inline-flex items-center gap-1 px-3 h-8 text-[#1d1d1f] dark:text-[#f5f5f7] text-[12px] font-medium cursor-pointer"
                                >
                                  <Settings className="w-3 h-3" />
                                  {isConfiguring ? "Închide" : "Configurare"}
                                </button>
                              </>
                            )}

                          {/* SAGA */}
                          {provider.id === "saga" && (
                            <button
                              type="button"
                              onClick={() => {
                                const d = new Date();
                                const month = d.getMonth() + 1;
                                const year = d.getFullYear();
                                exportSagaMutation.mutate({ month, year });
                              }}
                              disabled={exportSagaMutation.isPending}
                              className="apple-btn-prominent inline-flex items-center gap-1 px-3 h-8 text-[12px] font-semibold disabled:opacity-60 cursor-pointer"
                            >
                              <Download className="w-3 h-3" />
                              {exportSagaMutation.isPending ? "Generare..." : "Descarcă XML"}
                            </button>
                          )}

                          {provider.comingSoon && (
                            <span className="text-[12px] text-[#8e8e93]">—</span>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Config form row */}
                    {isConfiguring && (
                      <tr
                        key={`${provider.id}-cfg`}
                        className="bg-[#fafafa] dark:bg-white/[0.02]"
                      >
                        <td />
                        <td colSpan={6} className="px-4 py-3.5">
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
              <tr className="border-t border-black/[0.05] dark:border-white/[0.07] bg-[#fafafa] dark:bg-white/[0.02]">
                <td
                  colSpan={7}
                  className="px-4 py-2.5 text-[12px] text-[#6e6e73] dark:text-[#98989d]"
                >
                  Total înregistrări:{" "}
                  <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums">
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
      </div>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog
        open={!!deleteProviderId}
        onOpenChange={o => !o && setDeleteProviderId(null)}
      >
        <AlertDialogContent className="bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#1d1d1f] dark:text-[#f5f5f7]">
              Dezactivează integrarea?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#6e6e73] dark:text-[#98989d]">
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
            <AlertDialogCancel className="rounded-full apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7]">
              Anulează
            </AlertDialogCancel>
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
