// Integrations — RefacturaRO
// Connect SmartBill, SPV, Oblio and other accounting systems

import { useState, useMemo, useRef, useEffect } from "react";
import { Plug, Check, X, RefreshCw, AlertCircle, ExternalLink, Eye, EyeOff, Zap, Loader2, Bot, Send, ChevronDown, ChevronUp, Settings } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

// ── AI Assistant for setup guidance ────────────────────────────────────────

type Message = { role: "user" | "ai"; text: string };

type SetupStep = "greeting" | "provider" | "oblio_email" | "oblio_secret" | "oblio_cif" | "done";

function useSetupAssistant(onConfigSave: (provider: string, config: Record<string, string>) => void) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "ai", text: "👋 Salut! Sunt asistentul tău de configurare. Te ajut să conectezi rapid o platformă de facturare.\n\nCe platformă vrei să conectezi?\n• **Oblio** — introdu `oblio`\n• **SmartBill** — introdu `smartbill`\n• **SPV ANAF** — introdu `spv`" }
  ]);
  const [step, setStep] = useState<SetupStep>("provider");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [selectedProvider, setSelectedProvider] = useState("");

  const respond = (userText: string) => {
    const trimmed = userText.trim().toLowerCase();
    const newMessages: Message[] = [...messages, { role: "user", text: userText }];

    if (step === "provider") {
      if (trimmed.includes("oblio")) {
        setSelectedProvider("oblio");
        setStep("oblio_email");
        newMessages.push({ role: "ai", text: "Perfect! Oblio este o alegere excelentă 🧡\n\n**Pasul 1/3** — Care este adresa de email cu care ești logat pe oblio.eu?" });
      } else if (trimmed.includes("smartbill")) {
        setSelectedProvider("smartbill");
        newMessages.push({ role: "ai", text: "SmartBill vine în curând! 🔜\n\nDeocamdată poți configura **Oblio** sau **SPV ANAF**. Care preferi?" });
      } else if (trimmed.includes("spv")) {
        setSelectedProvider("spv");
        newMessages.push({ role: "ai", text: "Integrarea SPV ANAF necesită un certificat digital calificat și înregistrarea aplicației pe portalul ANAF. Contactează-ne pentru asistență sau alege **Oblio** pentru o configurare rapidă." });
      } else {
        newMessages.push({ role: "ai", text: "Nu am recunoscut platforma. Te rog scrie `oblio`, `smartbill` sau `spv`." });
      }
    } else if (step === "oblio_email") {
      if (!userText.includes("@")) {
        newMessages.push({ role: "ai", text: "Hm, ăsta nu pare un email valid. Încearcă din nou — ex: `emailul_tau@gmail.com`" });
      } else {
        setDraft(d => ({ ...d, email: userText.trim() }));
        setStep("oblio_secret");
        newMessages.push({ role: "ai", text: `Email salvat ✅\n\n**Pasul 2/3** — Acum am nevoie de **API Secret**.\n\nÎl găsești în Oblio la:\n🔗 Setări → Date Cont → câmpul **API secret**\n\nCopiază-l și paste-uiește-l aici.` });
      }
    } else if (step === "oblio_secret") {
      if (userText.trim().length < 20) {
        newMessages.push({ role: "ai", text: "Cheia pare prea scurtă. Asigură-te că ai copiat tot textul din câmpul API Secret (fără spații la capăt)." });
      } else {
        setDraft(d => ({ ...d, apiSecret: userText.trim() }));
        setStep("oblio_cif");
        newMessages.push({ role: "ai", text: `API Secret salvat ✅\n\n**Pasul 3/3** — Ultimul pas! Am nevoie de **CUI-ul (CIF-ul) firmei** tale din Oblio.\n\nÎl găsești la:\n🔗 Setări → Date Firmă → câmpul **Cod Fiscal**\n\nEx: \`42322117\`` });
      }
    } else if (step === "oblio_cif") {
      const cifClean = userText.trim().replace(/^RO/i, "");
      if (!/^\d{6,10}$/.test(cifClean)) {
        newMessages.push({ role: "ai", text: "CIF-ul trebuie să fie format din 6-10 cifre (ex: `42322117`). Încearcă din nou." });
      } else {
        const finalConfig = { ...draft, cif: cifClean };
        setDraft(finalConfig);
        setStep("done");
        newMessages.push({ role: "ai", text: `✅ **Configurare completă!**\n\n📧 Email: ${finalConfig.email}\n🔑 API Secret: ${"•".repeat(Math.min(finalConfig.apiSecret?.length || 0, 20))}\n🏢 CIF: ${cifClean}\n\nSalvez acum configurarea și pornesc sincronizarea...` });
        onConfigSave("oblio", finalConfig);
      }
    } else if (step === "done") {
      newMessages.push({ role: "ai", text: "Configurarea e gata! Apasă **Sincronizează acum** pe cardul Oblio pentru a importa facturile." });
    }

    setMessages(newMessages);
  };

  return { messages, respond, step };
}

// ── Provider config form ────────────────────────────────────────────────────

function OblioConfigForm({ onSave, saving }: { onSave: (cfg: Record<string, string>) => void; saving: boolean }) {
  const [email, setEmail] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [cif, setCif] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Configurare Oblio</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email cont Oblio"
          className="h-9 px-3 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <div className="relative">
          <input
            type={showSecret ? "text" : "password"}
            value={apiSecret}
            onChange={e => setApiSecret(e.target.value)}
            placeholder="API Secret"
            className="w-full h-9 px-3 pr-9 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            type="button"
            onClick={() => setShowSecret(s => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        <input
          type="text"
          value={cif}
          onChange={e => setCif(e.target.value)}
          placeholder="CIF firmă (ex: 42322117)"
          className="h-9 px-3 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            if (!email || !apiSecret || !cif) { toast.error("Completează toate câmpurile"); return; }
            onSave({ email, apiSecret, cif: cif.replace(/^RO/i, "") });
          }}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 h-8 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Salvează configurarea
        </button>
        <a
          href="https://www.oblio.eu/account/settings"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-orange-600 transition-colors"
        >
          <ExternalLink className="w-3 h-3" /> Oblio → Date Cont
        </a>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

const PROVIDERS = [
  {
    id: "smartbill",
    name: "SmartBill",
    description: "Importă automat facturile emise și primite din SmartBill.",
    logoColor: "#2563eb",
    comingSoon: true,
  },
  {
    id: "spv",
    name: "SPV ANAF",
    description: "Importă e-Factura din spațiul privat virtual prin OAuth2 sau XML manual.",
    logoColor: "#3730a3",
    comingSoon: false,
  },
  {
    id: "oblio",
    name: "Oblio",
    description: "Conectare Oblio pentru import facturi și sincronizare automată clienți.",
    logoColor: "#f97316",
    comingSoon: false,
  },
];

export default function Integrations() {
  const [showAI, setShowAI] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [configuringId, setConfiguringId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const aiEndRef = useRef<HTMLDivElement>(null);

  const { data: dbIntegrations = [], isLoading, refetch } = trpc.integrations.list.useQuery();
  const upsertMutation = trpc.integrations.upsert.useMutation({
    onSuccess: () => refetch(),
  });
  const syncOblioMutation = trpc.integrations.syncOblio.useMutation({
    onSuccess: (result) => {
      const msg = `✅ Sync complet: ${result.imported} facturi noi, ${result.clientsImported} clienți noi`;
      toast.success(msg);
      refetch();
      setSyncing(null);
    },
    onError: (e) => {
      toast.error("Eroare sync Oblio: " + e.message);
      setSyncing(null);
    }
  });

  const getDbIntegration = (id: string) => dbIntegrations.find((i: any) => i.provider === id);

  const saveOblioConfig = async (config: Record<string, string>) => {
    await upsertMutation.mutateAsync({
      provider: "oblio",
      apiKey: config.apiSecret,
      apiSecret: JSON.stringify({ email: config.email, cif: config.cif }),
      status: "active",
    });
    toast.success("Oblio configurat cu succes! 🎉");
    setConfiguringId(null);
  };

  const handleSyncOblio = () => {
    setSyncing("oblio");
    syncOblioMutation.mutate();
  };

  // AI setup assistant
  const { messages, respond, step } = useSetupAssistant(async (provider, config) => {
    if (provider === "oblio") {
      await saveOblioConfig(config);
    }
  });

  const handleAISend = () => {
    if (!aiInput.trim()) return;
    respond(aiInput);
    setAiInput("");
  };

  useEffect(() => {
    aiEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // SPV file upload handler
  const importSpvMutation = trpc.invoices.importFromSpv.useMutation({
    onSuccess: (r) => toast.success(`${r.count} facturi importate din SPV`),
    onError: (e) => toast.error(e.message),
  });

  const handleSpvXml = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    toast.loading("Procesare XML...", { id: "spv" });
    try {
      const parsedInvoices = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.name.endsWith(".xml")) continue;
        const text = await file.text();
        const doc = new DOMParser().parseFromString(text, "text/xml");
        const get = (t: string) => doc.getElementsByTagName(t)[0]?.textContent || "";
        parsedInvoices.push({
          invoiceNumber: get("cbc:ID"),
          supplierName: get("cbc:RegistrationName") || get("cbc:Name"),
          supplierCUI: get("cbc:CompanyID"),
          issueDate: get("cbc:IssueDate"),
          dueDate: get("cbc:DueDate") || get("cbc:IssueDate"),
          total: parseFloat(doc.getElementsByTagName("cac:LegalMonetaryTotal")[0]?.getElementsByTagName("cbc:TaxInclusiveAmount")[0]?.textContent || "0"),
          totalVAT: parseFloat(doc.getElementsByTagName("cac:TaxTotal")[0]?.getElementsByTagName("cbc:TaxAmount")[0]?.textContent || "0"),
          currency: get("cbc:DocumentCurrencyCode") || "RON",
          lines: [],
        });
      }
      if (!parsedInvoices.length) { toast.error("Niciun XML valid", { id: "spv" }); return; }
      await importSpvMutation.mutateAsync(parsedInvoices);
      toast.success(`${parsedInvoices.length} facturi importate!`, { id: "spv" });
    } catch (err: any) {
      toast.error(err.message, { id: "spv" });
    }
    e.target.value = "";
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <input type="file" id="spv-file-input" multiple accept=".xml" className="hidden" onChange={handleSpvXml} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Integrări</h1>
          <p className="text-sm text-slate-500 mt-0.5">Conectează platformele tale de facturare</p>
        </div>
        <button
          onClick={() => setShowAI(v => !v)}
          className="flex items-center gap-2 px-4 h-9 rounded-full bg-gradient-to-r from-violet-600 to-blue-600 text-white text-xs font-bold shadow hover:opacity-90 transition-opacity"
        >
          <Bot className="w-3.5 h-3.5" />
          Asistent AI Setup
        </button>
      </div>

      {/* AI Assistant Panel */}
      {showAI && (
        <div className="bg-white rounded-2xl border border-violet-200 shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-600 to-blue-600">
            <Bot className="w-4 h-4 text-white" />
            <span className="text-sm font-bold text-white">Asistent AI — Configurare integrări</span>
            <button onClick={() => setShowAI(false)} className="ml-auto text-white/70 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="h-64 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "ai" && (
                  <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0 mt-1 mr-2">
                    <Bot className="w-3 h-3 text-white" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-line ${
                  m.role === "ai"
                    ? "bg-white border border-slate-200 text-slate-700 rounded-tl-sm"
                    : "bg-violet-600 text-white rounded-tr-sm"
                }`}>
                  {m.text.replace(/\*\*(.*?)\*\*/g, "$1")}
                </div>
              </div>
            ))}
            <div ref={aiEndRef} />
          </div>
          <div className="p-3 border-t border-slate-100 flex gap-2">
            <input
              value={aiInput}
              onChange={e => setAiInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAISend()}
              placeholder={step === "done" ? "Configurare completă!" : "Scrie răspunsul tău..."}
              disabled={step === "done"}
              className="flex-1 h-9 px-3 text-sm rounded-full border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:opacity-50"
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

      {/* Integration Cards */}
      <div className="space-y-4">
        {PROVIDERS.map((provider) => {
          const db = getDbIntegration(provider.id);
          const isActive = db?.status === "active";
          const isConfiguring = configuringId === provider.id;
          let parsedMeta: any = {};
          try { parsedMeta = db?.apiSecret ? JSON.parse(db.apiSecret) : {}; } catch {}

          return (
            <div key={provider.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0"
                      style={{ backgroundColor: provider.logoColor }}
                    >
                      {provider.name.slice(0, 2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">{provider.name}</h3>
                        {provider.comingSoon ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200">
                            În curând
                          </span>
                        ) : isActive ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Activ
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-200">
                            Neconectat
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 max-w-sm">{provider.description}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  {!provider.comingSoon && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Oblio specific actions */}
                      {provider.id === "oblio" && isActive && (
                        <button
                          onClick={handleSyncOblio}
                          disabled={syncing === "oblio"}
                          className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all disabled:opacity-60"
                        >
                          {syncing === "oblio" ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          Sincronizează acum
                        </button>
                      )}
                      {/* SPV: XML upload */}
                      {provider.id === "spv" && (
                        <button
                          onClick={() => document.getElementById("spv-file-input")?.click()}
                          className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all"
                        >
                          <RefreshCw className="w-3 h-3" /> Import XML SPV
                        </button>
                      )}
                      {/* Config toggle */}
                      {provider.id !== "spv" && (
                        <button
                          onClick={() => setConfiguringId(isConfiguring ? null : provider.id)}
                          className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                        >
                          <Settings className="w-3 h-3" />
                          {isActive ? "Configurare" : "Conectează"}
                          {isConfiguring ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Stats if active */}
                {isActive && db?.lastSyncAt && (
                  <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                    <span>Ultima sincronizare: <strong className="text-slate-700">{db.lastSyncAt ? new Date(db.lastSyncAt).toLocaleString("ro-RO") : "—"}</strong></span>
                    {db.syncCount > 0 && <span>Facturi importate: <strong className="text-slate-700">{db.syncCount}</strong></span>}
                    {parsedMeta.email && <span>Cont: <strong className="text-slate-700">{parsedMeta.email}</strong></span>}
                  </div>
                )}

                {/* Configuration form */}
                {isConfiguring && provider.id === "oblio" && (
                  <OblioConfigForm onSave={saveOblioConfig} saving={upsertMutation.isPending} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Coming soon more */}
      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-6 text-center">
        <Plug className="w-7 h-7 text-slate-300 mx-auto mb-2" />
        <div className="text-sm font-bold text-slate-500">Mai multe integrări în curând</div>
        <div className="text-xs text-slate-400 mt-1">SmartBill, Saga, WinMentor, Ciel, QuickBooks...</div>
        <button
          onClick={() => toast.info("Cerere înregistrată", { description: "Te vom notifica la lansare" })}
          className="mt-3 px-4 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
        >
          Solicită integrare
        </button>
      </div>
    </div>
  );
}
