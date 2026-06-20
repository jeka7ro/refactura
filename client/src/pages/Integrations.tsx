// Integrations — RefacturaRO
// Connect SmartBill, SPV, Oblio and other accounting systems

import { useState } from "react";
import { Plug, Check, X, RefreshCw, AlertCircle, ExternalLink, Eye, EyeOff, Zap } from "lucide-react";
import { toast } from "sonner";
import { mockIntegrations, type Integration } from "@/lib/store";
import { trpc } from "@/lib/trpc";

export default function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>(mockIntegrations);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [apiKeyDraft, setApiKeyDraft] = useState("");

  const importSpvMutation = trpc.invoices.importSpv.useMutation();

  const toggleEnabled = (id: string) => {
    setIntegrations((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, enabled: !i.enabled, status: !i.enabled ? "connected" : "disconnected" }
          : i
      )
    );
    const integration = integrations.find((i) => i.id === id);
    if (integration) {
      toast.success(integration.enabled ? `${integration.name} dezactivat` : `${integration.name} activat`);
    }
  };

  const testConnection = (id: string) => {
    setTesting(id);
    setTimeout(() => {
      setTesting(null);
      const integration = integrations.find((i) => i.id === id);
      if (integration?.status === "connected") {
        toast.success(`${integration.name} — Conexiune OK`, { description: "API-ul răspunde corect" });
      } else {
        toast.error(`${integration?.name} — Conexiune eșuată`, { description: "Verifică cheia API" });
      }
    }, 2000);
  };

  const saveApiKey = (id: string) => {
    setIntegrations((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, apiKey: apiKeyDraft, status: "connected", enabled: true } : i
      )
    );
    setEditingId(null);
    toast.success("Cheie API salvată", { description: "Integrarea a fost configurată" });
  };

  const importSpvMutation = trpc.invoices.importSpv.useMutation();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    toast.loading("Procesare fișiere XML...", { id: "spv-sync" });
    
    try {
      const parsedInvoices = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.name.endsWith(".xml")) continue;
        
        const text = await file.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "text/xml");
        
        // Basic UBL XML parsing
        const getTagValue = (tagName: string) => doc.getElementsByTagName(tagName)[0]?.textContent || "";
        
        const supplierName = getTagValue("cbc:RegistrationName") || getTagValue("cbc:Name");
        const supplierCUI = getTagValue("cbc:CompanyID");
        const invoiceNumber = getTagValue("cbc:ID");
        const issueDate = getTagValue("cbc:IssueDate");
        const dueDate = getTagValue("cbc:DueDate") || issueDate;
        
        const total = parseFloat(doc.getElementsByTagName("cac:LegalMonetaryTotal")[0]?.getElementsByTagName("cbc:TaxInclusiveAmount")[0]?.textContent || "0");
        const totalVAT = parseFloat(doc.getElementsByTagName("cac:TaxTotal")[0]?.getElementsByTagName("cbc:TaxAmount")[0]?.textContent || "0");
        const currency = doc.getElementsByTagName("cbc:DocumentCurrencyCode")[0]?.textContent || "RON";
        
        const lineNodes = doc.getElementsByTagName("cac:InvoiceLine");
        const lines = [];
        for (let j = 0; j < lineNodes.length; j++) {
          const node = lineNodes[j];
          const qtyNode = node.getElementsByTagName("cbc:InvoicedQuantity")[0];
          const qty = parseFloat(qtyNode?.textContent || "1");
          const unit = qtyNode?.getAttribute("unitCode") || "buc";
          
          const price = parseFloat(node.getElementsByTagName("cac:Price")[0]?.getElementsByTagName("cbc:PriceAmount")[0]?.textContent || "0");
          const description = node.getElementsByTagName("cac:Item")[0]?.getElementsByTagName("cbc:Name")[0]?.textContent || "Articol";
          const vatRate = parseFloat(node.getElementsByTagName("cac:Item")[0]?.getElementsByTagName("cac:ClassifiedTaxCategory")[0]?.getElementsByTagName("cbc:Percent")[0]?.textContent || "19");
          
          lines.push({ description, quantity: qty, unitPrice: price, unit, vatRate });
        }
        
        parsedInvoices.push({
          invoiceNumber,
          supplierName,
          supplierCUI,
          issueDate,
          dueDate,
          total,
          totalVAT,
          currency,
          lines
        });
      }
      
      if (parsedInvoices.length === 0) {
        toast.error("Nu s-au găsit facturi valide în fișierele selectate", { id: "spv-sync" });
        return;
      }
      
      await importSpvMutation.mutateAsync(parsedInvoices);
      toast.success(`${parsedInvoices.length} facturi importate cu succes din SPV!`, { id: "spv-sync" });
      
    } catch (err: any) {
      toast.error("Eroare la procesarea XML: " + err.message, { id: "spv-sync" });
    }
    
    // Reset file input
    e.target.value = '';
  };

  const syncNow = (id: string) => {
    if (id === "spv") {
      document.getElementById("spv-file-input")?.click();
      return;
    }
    
    const integration = integrations.find((i) => i.id === id);
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 2500)),
      {
        loading: `Sincronizare ${integration?.name}...`,
        success: `${integration?.name} sincronizat — 3 facturi noi`,
        error: "Eroare la sincronizare",
      }
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <input 
        type="file" 
        id="spv-file-input" 
        multiple 
        accept=".xml" 
        className="hidden" 
        onChange={handleFileUpload} 
      />
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Integrări</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Conectează-te la SmartBill, SPV ANAF, Oblio și alte sisteme de contabilitate
        </p>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 p-4 flex items-start gap-3">
        <Zap className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-bold text-blue-900 dark:text-blue-200">Import automat activat</div>
          <div className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
            Facturile sunt sincronizate automat la fiecare 4 ore. Poți declanșa o sincronizare manuală oricând.
          </div>
        </div>
      </div>

      {/* Integrations list */}
      <div className="space-y-4">
        {integrations.map((integration) => (
          <div key={integration.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  {/* Logo placeholder */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0"
                    style={{ backgroundColor: integration.logoColor }}
                  >
                    {integration.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">{integration.name}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        integration.status === "connected"
                          ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                          : integration.status === "error"
                          ? "bg-rose-50 text-rose-600 border-rose-200"
                          : "bg-slate-50 text-slate-500 border-slate-200"
                      }`}>
                        {integration.status === "connected" ? "Conectat" : integration.status === "error" ? "Eroare" : "Deconectat"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 max-w-md">{integration.description}</p>
                  </div>
                </div>

                {/* Toggle */}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-500">{integration.enabled ? "Activ" : "Inactiv"}</span>
                  <button
                    onClick={() => toggleEnabled(integration.id)}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                      integration.enabled ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-700"
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                      integration.enabled ? "translate-x-5" : "translate-x-0"
                    }`} />
                  </button>
                </div>
              </div>

              {/* Stats row */}
              {integration.status === "connected" && (
                <div className="mt-4 flex items-center gap-6 text-xs text-slate-500">
                  {integration.lastSync && (
                    <span>Ultima sincronizare: <strong className="text-slate-700 dark:text-slate-300">{new Date(integration.lastSync).toLocaleString("ro-RO")}</strong></span>
                  )}
                  {integration.syncCount !== undefined && (
                    <span>Facturi importate: <strong className="text-slate-700 dark:text-slate-300">{integration.syncCount}</strong></span>
                  )}
                </div>
              )}

              {/* API Key section */}
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                {editingId === integration.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={apiKeyDraft}
                      onChange={(e) => setApiKeyDraft(e.target.value)}
                      placeholder="Introdu cheia API..."
                      className="flex-1 h-9 px-4 text-sm rounded-full border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button onClick={() => saveApiKey(integration.id)} className="px-4 h-9 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all">
                      Salvează
                    </button>
                    <button onClick={() => setEditingId(null)} className="px-4 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors">
                      Anulează
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      {integration.apiKey ? (
                        <>
                          <span className="text-xs text-slate-500">
                            {showKey[integration.id] ? integration.apiKey : "••••••••••••••••••••"}
                          </span>
                          <button
                            onClick={() => setShowKey((prev) => ({ ...prev, [integration.id]: !prev[integration.id] }))}
                            className="w-6 h-6 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
                          >
                            {showKey[integration.id] ? <EyeOff className="w-3 h-3 text-slate-400" /> : <Eye className="w-3 h-3 text-slate-400" />}
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">Nicio cheie API configurată</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setEditingId(integration.id); setApiKeyDraft(integration.apiKey || ""); }}
                        className="px-3 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors"
                      >
                        {integration.apiKey ? "Modifică cheie" : "Configurează"}
                      </button>
                      {integration.enabled && (
                        <>
                          <button
                            onClick={() => testConnection(integration.id)}
                            disabled={testing === integration.id}
                            className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors disabled:opacity-60"
                          >
                            {testing === integration.id ? (
                              <span className="w-3 h-3 border-2 border-slate-400 border-t-slate-700 rounded-full animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                            Testează
                          </button>
                          <button
                            onClick={() => syncNow(integration.id)}
                            className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all active:scale-[0.97]"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Sincronizează
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Coming soon */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-dashed border-slate-300 dark:border-slate-700 p-6">
        <div className="text-center">
          <Plug className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <div className="text-sm font-bold text-slate-500">Mai multe integrări în curând</div>
          <div className="text-xs text-slate-400 mt-1">Saga, WinMentor, Ciel, Nexus, QuickBooks, Xero...</div>
          <button
            onClick={() => toast.info("Cerere înregistrată", { description: "Te vom notifica când integrarea va fi disponibilă" })}
            className="mt-4 px-5 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors"
          >
            Solicită integrare
          </button>
        </div>
      </div>
    </div>
  );
}
