import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Key, Plus, Trash2, ShieldOff, Copy, Check, AlertTriangle, ExternalLink } from "lucide-react";
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
  const [keyToDelete, setKeyToDelete] = useState<{ id: number; name: string } | null>(null);

  const utils = trpc.useUtils();
  const { data: keys = [], isLoading } = trpc.apiKeys.list.useQuery();
  const createMut = trpc.apiKeys.create.useMutation({
    onSuccess: (data: any) => {
      setNewKey(data.rawKey);
      setNewName("");
      setShowCreate(false);
      utils.invalidate();
      toast.success("Cheia API a fost generată cu succes.");
    },
    onError: (e: any) => {
      toast.error(e?.message || "Eroare la generarea cheii API.", { id: "api-key-create-error" });
    },
  });
  const revokeMut = trpc.apiKeys.revoke.useMutation({
    onSuccess: () => {
      utils.invalidate();
      toast.success("Cheia API a fost revocată.");
    },
    onError: (e: any) => {
      toast.error(e?.message || "Eroare la revocarea cheii API.");
    },
  });
  const deleteMut = trpc.apiKeys.delete.useMutation({
    onSuccess: () => {
      utils.invalidate();
      setKeyToDelete(null);
      toast.success("Cheia API a fost ștearsă definitiv.");
    },
    onError: (e: any) => {
      toast.error(e?.message || "Eroare la ștergerea cheii API.");
    },
  });

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createMut.mutateAsync({ name: newName.trim() });
    } catch (e: any) {
      toast.error(e?.message || "Eroare la generarea cheii API.", { id: "api-key-create-error" });
    } finally {
      setCreating(false);
    }
  };

  const baseUrl = window.location.origin;

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <Key className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white">API Keys</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Conectează aplicații externe la datele tale</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 h-9 px-4 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Generează Key
        </button>
      </div>

      {/* New Key Created Banner */}
      {newKey && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-[22px] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">API Key generat cu succes!</p>
          </div>
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-700 rounded-xl px-3 py-2">
            <code className="flex-1 font-sans tabular-nums text-xs text-slate-700 dark:text-slate-300 break-all">{newKey}</code>
            <button onClick={() => copyToClipboard(newKey, setCopiedKey)}
              className="shrink-0 w-8 h-8 rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-900/40 flex items-center justify-center transition-colors">
              {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />}
            </button>
          </div>
          <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Copiază-l acum! Nu îl vei mai putea vedea după ce închizi această secțiune.</span>
          </div>
          <button onClick={() => setNewKey(null)} className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline">OK, am copiat</button>
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white/96 dark:bg-[#1c1c1e] border border-black/[0.06] dark:border-white/[0.09] rounded-[22px] p-4 space-y-3 shadow-xs">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Nume API Key</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Ex: „App Contabilitate”, „Dashboard Extern”</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Denumire aplicație externă..."
              className="flex-1 h-9 px-3.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
            <button onClick={handleCreate} disabled={creating || !newName.trim()}
              className="h-9 px-4 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium transition-colors">
              {creating ? "..." : "Generează"}
            </button>
            <button onClick={() => { setShowCreate(false); setNewName(""); }}
              className="h-9 px-4 rounded-full apple-btn-glass border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm transition-colors">
              Anulează
            </button>
          </div>
        </div>
      )}

      {/* Keys Table */}
      <div className="bg-white/96 dark:bg-[#1c1c1e] rounded-[22px] border border-black/[0.06] dark:border-white/[0.09] overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Chei Active</h2>
        </div>
        {isLoading ? (
          <div className="py-10 text-center text-slate-400 text-sm">Se încarcă...</div>
        ) : keys.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">
            <Key className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Nicio cheie API. Generează prima ta cheie.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50">
              <tr>
                {["Nume", "Prefix Key", "Status", "Ultima Utilizare", "Creat", "Acțiuni"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(keys as any[]).map((k) => (
                <tr key={k.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{k.name}</td>
                  <td className="px-4 py-3">
                    <code className="font-sans tabular-nums text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
                      {k.keyPrefix}…
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${k.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800" : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"}`}>
                      {k.isActive ? "Activ" : "Revocat"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString("ro-RO") : "Nefolosit"}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {new Date(k.createdAt).toLocaleDateString("ro-RO")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      {k.isActive && (
                        <button onClick={() => revokeMut.mutate({ id: k.id })}
                          title="Revocă"
                          className="w-8 h-8 rounded-full apple-btn-glass border border-slate-200 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center transition-colors">
                          <ShieldOff className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => setKeyToDelete({ id: k.id, name: k.name })}
                        title="Șterge"
                        className="w-8 h-8 rounded-full apple-btn-glass border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500 dark:text-red-400 flex items-center justify-center transition-colors">
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

      <AlertDialog open={!!keyToDelete} onOpenChange={(open) => !open && setKeyToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ștergi definitiv această cheie?</AlertDialogTitle>
            <AlertDialogDescription>
              Cheia API <strong>{keyToDelete?.name}</strong> va fi ștearsă ireversibil, iar aplicațiile externe care o folosesc nu se vor mai putea autentifica.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Anulează</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => keyToDelete && deleteMut.mutate({ id: keyToDelete.id })}
              className="rounded-full bg-red-600 hover:bg-red-700 text-white"
            >
              Șterge definitiv
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Docs */}
      <div className="bg-slate-900 dark:bg-slate-950 rounded-[22px] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ExternalLink className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-white">Referință API</h3>
        </div>
        <div className="space-y-4 text-xs tabular-nums">

          {/* Facturi Primite */}
          <p className="text-slate-400 text-xs font-sans font-semibold uppercase tracking-wider">Facturi Primite</p>
          <div>
            <p className="text-slate-500 mb-1"># Lista tuturor facturilor primite (filtre opționale)</p>
            <div className="bg-slate-800 rounded-xl p-3 text-emerald-400 overflow-x-auto">
              <p>GET {baseUrl}/api/v1/facturi-primite</p>
              <p className="text-slate-500">   ?from=2026-01-01 &amp;to=2026-12-31</p>
              <p className="text-slate-500">   &amp;supplier=Orange &amp;status=processed &amp;costCenterId=1</p>
              <p className="text-indigo-400">Authorization: Bearer sk_...</p>
            </div>
          </div>
          <div>
            <p className="text-slate-500 mb-1"># Detalii factură primită</p>
            <div className="bg-slate-800 rounded-xl p-3 text-emerald-400 overflow-x-auto">
              <p>GET {baseUrl}/api/v1/facturi-primite/:id</p>
              <p className="text-indigo-400">Authorization: Bearer sk_...</p>
            </div>
          </div>

          {/* Facturi Emise */}
          <p className="text-slate-400 text-xs font-sans font-semibold uppercase tracking-wider pt-2">Facturi Emise</p>
          <div>
            <p className="text-slate-500 mb-1"># Lista tuturor facturilor emise (filtre opționale)</p>
            <div className="bg-slate-800 rounded-xl p-3 text-emerald-400 overflow-x-auto">
              <p>GET {baseUrl}/api/v1/facturi-emise</p>
              <p className="text-slate-500">   ?from=2026-01-01 &amp;to=2026-12-31</p>
              <p className="text-slate-500">   &amp;client=Acme &amp;status=paid</p>
              <p className="text-indigo-400">Authorization: Bearer sk_...</p>
            </div>
          </div>
          <div>
            <p className="text-slate-500 mb-1"># Detalii factură emisă</p>
            <div className="bg-slate-800 rounded-xl p-3 text-emerald-400 overflow-x-auto">
              <p>GET {baseUrl}/api/v1/facturi-emise/:id</p>
              <p className="text-indigo-400">Authorization: Bearer sk_...</p>
            </div>
          </div>

          {/* Centre de Cost */}
          <p className="text-slate-400 text-xs font-sans font-semibold uppercase tracking-wider pt-2">Centre de Cost</p>
          <div>
            <div className="bg-slate-800 rounded-xl p-3 text-emerald-400 overflow-x-auto space-y-1">
              <p>GET {baseUrl}/api/v1/cost-centers</p>
              <p>GET {baseUrl}/api/v1/cost-centers/:id</p>
              <p>GET {baseUrl}/api/v1/cost-centers/:id/invoices</p>
              <p>GET {baseUrl}/api/v1/cost-centers/:id/summary</p>
              <p className="text-indigo-400">Authorization: Bearer sk_...</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
