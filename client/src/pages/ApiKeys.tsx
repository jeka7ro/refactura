import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Key, Plus, Trash2, ShieldOff, Copy, Check, AlertTriangle, ExternalLink } from "lucide-react";

function copyToClipboard(text: string, setCopied: (v: boolean) => void) {
  navigator.clipboard.writeText(text).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  });
}

export default function ApiKeysPage() {
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const utils = trpc.useUtils();
  const { data: keys = [], isLoading } = trpc.apiKeys.list.useQuery();
  const createMut = trpc.apiKeys.create.useMutation({
    onSuccess: (data: any) => {
      setNewKey(data.rawKey);
      setNewName("");
      setShowCreate(false);
      utils.invalidate();
    },
  });
  const revokeMut = trpc.apiKeys.revoke.useMutation({ onSuccess: () => utils.invalidate() });
  const deleteMut = trpc.apiKeys.delete.useMutation({ onSuccess: () => utils.invalidate() });

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try { await createMut.mutateAsync({ name: newName.trim() }); }
    finally { setCreating(false); }
  };

  const baseUrl = window.location.origin;

  return (
    <div className="p-5 max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <Key className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white">API Keys</h1>
            <p className="text-xs text-slate-500">Conecteaza aplicatii externe la datele tale</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Generează Key
        </button>
      </div>

      {/* New Key Created Banner */}
      {newKey && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">API Key generat cu succes!</p>
          </div>
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-700 rounded-lg px-3 py-2">
            <code className="flex-1 text-xs text-slate-700 dark:text-slate-300 break-all">{newKey}</code>
            <button onClick={() => copyToClipboard(newKey, setCopiedKey)}
              className="shrink-0 w-7 h-7 rounded-md hover:bg-emerald-100 flex items-center justify-center transition-colors">
              {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
            </button>
          </div>
          <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Copiaza-l acum! Nu il vei mai putea vedea dupa ce inchizi aceasta sectiune.</span>
          </div>
          <button onClick={() => setNewKey(null)} className="text-xs text-slate-500 hover:text-slate-700 underline">OK, am copiat</button>
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Nume API Key</p>
          <p className="text-xs text-slate-500">Ex: "App Contabilitate", "Dashboard Extern"</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Denumire aplicatie externa..."
              className="flex-1 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
            <button onClick={handleCreate} disabled={creating || !newName.trim()}
              className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium transition-colors">
              {creating ? "..." : "Generează"}
            </button>
            <button onClick={() => { setShowCreate(false); setNewName(""); }}
              className="h-9 px-3 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 text-sm transition-colors">
              Anulează
            </button>
          </div>
        </div>
      )}

      {/* Keys Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Chei Active</h2>
        </div>
        {isLoading ? (
          <div className="py-10 text-center text-slate-400 text-sm">Se incarca...</div>
        ) : keys.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">
            <Key className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Nicio cheie API. Genereaza prima ta cheie.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50">
              <tr>
                {["Nume", "Prefix Key", "Status", "Ultima Utilizare", "Creat", "Actiuni"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {(keys as any[]).map((k) => (
                <tr key={k.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{k.name}</td>
                  <td className="px-4 py-3">
                    <code className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded font-mono text-slate-600 dark:text-slate-300">
                      {k.keyPrefix}…
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${k.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}>
                      {k.isActive ? "Activ" : "Revocat"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString("ro-RO") : "Nefolosit"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(k.createdAt).toLocaleDateString("ro-RO")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {k.isActive && (
                        <button onClick={() => revokeMut.mutate({ id: k.id })}
                          title="Revoca"
                          className="w-7 h-7 rounded-lg border border-slate-200 hover:bg-amber-50 text-amber-600 flex items-center justify-center transition-colors">
                          <ShieldOff className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => { if (confirm("Stergi definitiv aceasta cheie?")) deleteMut.mutate({ id: k.id }); }}
                        title="Sterge"
                        className="w-7 h-7 rounded-lg border border-slate-200 hover:bg-red-50 text-red-500 flex items-center justify-center transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Docs */}
      <div className="bg-slate-900 dark:bg-slate-950 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ExternalLink className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-white">Cum se foloseste</h3>
        </div>
        <div className="space-y-3 text-xs font-mono">
          <div>
            <p className="text-slate-500 mb-1"># Lista centre de cost</p>
            <div className="bg-slate-800 rounded-lg p-3 text-emerald-400 overflow-x-auto">
              <p>GET {baseUrl}/api/v1/cost-centers</p>
              <p>Authorization: Bearer sk_...</p>
            </div>
          </div>
          <div>
            <p className="text-slate-500 mb-1"># Facturi pe centru (cu filtre optionale)</p>
            <div className="bg-slate-800 rounded-lg p-3 text-emerald-400 overflow-x-auto">
              <p>GET {baseUrl}/api/v1/cost-centers/1/invoices?from=2026-01-01&to=2026-12-31</p>
              <p>Authorization: Bearer sk_...</p>
            </div>
          </div>
          <div>
            <p className="text-slate-500 mb-1"># Sumar KPI centru</p>
            <div className="bg-slate-800 rounded-lg p-3 text-emerald-400 overflow-x-auto">
              <p>GET {baseUrl}/api/v1/cost-centers/1/summary</p>
              <p>Authorization: Bearer sk_...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
