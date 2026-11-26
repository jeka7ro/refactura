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
    <div className="p-3 sm:p-5 max-w-full space-y-4 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
            API Keys
          </h1>
          <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
            Conectează aplicații externe la datele tale
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="apple-btn-prominent inline-flex items-center gap-1.5 h-9 px-4 text-[13px] font-semibold cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Generează Key
        </button>
      </div>

      {/* New Key Created Banner */}
      {newKey && (
        <div className="apple-surface p-4 space-y-3 border-emerald-500/30">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <p className="text-[13.5px] font-semibold text-emerald-700 dark:text-emerald-300">
              API Key generat cu succes!
            </p>
          </div>
          <div className="flex items-center gap-2 bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.08] rounded-xl px-3 py-2">
            <code className="flex-1 font-sans tabular-nums text-[12.5px] text-[#1d1d1f] dark:text-[#f5f5f7] break-all">
              {newKey}
            </code>
            <button
              type="button"
              onClick={() => copyToClipboard(newKey, setCopiedKey)}
              className="apple-btn-glass shrink-0 w-8 h-8 flex items-center justify-center cursor-pointer"
            >
              {copiedKey ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d]" />
              )}
            </button>
          </div>
          <div className="flex items-start gap-2 text-[12px] text-amber-700 dark:text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Copiază-l acum! Nu îl vei mai putea vedea după ce închizi această secțiune.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setNewKey(null)}
            className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] underline cursor-pointer"
          >
            OK, am copiat
          </button>
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <div className="apple-surface p-4 space-y-3">
          <div>
            <p className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
              Nume API Key
            </p>
            <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
              Ex: „App Contabilitate”, „Dashboard Extern”
            </p>
          </div>
          <div className="flex flex-wrap sm:flex-nowrap gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Denumire aplicație externă..."
              className="flex-1 min-w-0 h-9 px-3.5 rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] text-[13px] outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="apple-btn-prominent h-9 px-4 text-[13px] font-semibold disabled:opacity-50 cursor-pointer"
            >
              {creating ? "..." : "Generează"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setNewName("");
              }}
              className="apple-btn-glass h-9 px-4 text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
            >
              Anulează
            </button>
          </div>
        </div>
      )}

      {/* Keys Table */}
      <div className="apple-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-black/[0.05] dark:border-white/[0.07]">
          <h2 className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
            Chei active
          </h2>
        </div>
        {isLoading ? (
          <div className="py-10 text-center text-[#6e6e73] dark:text-[#98989d] text-[13px]">
            Se încarcă...
          </div>
        ) : keys.length === 0 ? (
          <div className="py-10 text-center text-[#6e6e73] dark:text-[#98989d] text-[13px]">
            <Key className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Nicio cheie API. Generează prima ta cheie.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
                <tr>
                  {[
                    "Nume",
                    "Prefix key",
                    "Status",
                    "Ultima utilizare",
                    "Creat",
                    "Acțiuni",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
                {(keys as any[]).map((k) => (
                  <tr
                    key={k.id}
                    className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors"
                  >
                    <td className="px-4 py-3 text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                      {k.name}
                    </td>
                    <td className="px-4 py-3">
                      <code className="font-sans tabular-nums text-[12px] bg-[#f2f2f7] dark:bg-[#2c2c2e] px-2.5 py-0.5 rounded-full text-[#3a3a3c] dark:text-[#ebebf5]">
                        {k.keyPrefix}…
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                          k.isActive
                            ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300"
                            : "bg-[#f2f2f7] text-[#6e6e73] dark:bg-[#2c2c2e] dark:text-[#98989d]"
                        }`}
                      >
                        {k.isActive ? "Activ" : "Revocat"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12.5px] tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                      {k.lastUsedAt
                        ? new Date(k.lastUsedAt).toLocaleString("ro-RO")
                        : "Nefolosit"}
                    </td>
                    <td className="px-4 py-3 text-[12.5px] tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                      {new Date(k.createdAt).toLocaleDateString("ro-RO")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {k.isActive && (
                          <button
                            type="button"
                            onClick={() => revokeMut.mutate({ id: k.id })}
                            title="Revocă"
                            className="apple-btn-glass w-8 h-8 text-amber-600 dark:text-amber-400 flex items-center justify-center cursor-pointer"
                          >
                            <ShieldOff className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setKeyToDelete({ id: k.id, name: k.name })}
                          title="Șterge"
                          className="apple-btn-glass w-8 h-8 text-rose-600 dark:text-rose-400 flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AlertDialog open={!!keyToDelete} onOpenChange={(open) => !open && setKeyToDelete(null)}>
        <AlertDialogContent className="bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#1d1d1f] dark:text-[#f5f5f7]">
              Ștergi definitiv această cheie?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#6e6e73] dark:text-[#98989d]">
              Cheia API <strong>{keyToDelete?.name}</strong> va fi ștearsă ireversibil, iar aplicațiile externe care o folosesc nu se vor mai putea autentifica.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7]">
              Anulează
            </AlertDialogCancel>
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
      <div className="apple-surface p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ExternalLink className="w-4 h-4 text-[#6e6e73] dark:text-[#98989d]" />
          <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
            Referință API
          </h3>
        </div>
        <div className="space-y-4 text-[12px] tabular-nums">
          {/* Facturi Primite */}
          <p className="text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-semibold">
            Facturi primite
          </p>
          <div>
            <p className="text-[#6e6e73] dark:text-[#98989d] mb-1">
              # Lista tuturor facturilor primite (filtre opționale)
            </p>
            <div className="bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.05] dark:border-white/[0.07] rounded-xl p-3 text-emerald-700 dark:text-emerald-400 overflow-x-auto">
              <p>GET {baseUrl}/api/v1/facturi-primite</p>
              <p className="text-[#6e6e73] dark:text-[#98989d]">
                {"   "}?from=2026-01-01 &amp;to=2026-12-31
              </p>
              <p className="text-[#6e6e73] dark:text-[#98989d]">
                {"   "}&amp;supplier=Orange &amp;status=processed &amp;costCenterId=1
              </p>
              <p className="text-[#0071e3] dark:text-[#64d2ff]">
                Authorization: Bearer sk_...
              </p>
            </div>
          </div>
          <div>
            <p className="text-[#6e6e73] dark:text-[#98989d] mb-1">
              # Detalii factură primită
            </p>
            <div className="bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.05] dark:border-white/[0.07] rounded-xl p-3 text-emerald-700 dark:text-emerald-400 overflow-x-auto">
              <p>GET {baseUrl}/api/v1/facturi-primite/:id</p>
              <p className="text-[#0071e3] dark:text-[#64d2ff]">
                Authorization: Bearer sk_...
              </p>
            </div>
          </div>

          {/* Facturi Emise */}
          <p className="text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-semibold pt-2">
            Facturi emise
          </p>
          <div>
            <p className="text-[#6e6e73] dark:text-[#98989d] mb-1">
              # Lista tuturor facturilor emise (filtre opționale)
            </p>
            <div className="bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.05] dark:border-white/[0.07] rounded-xl p-3 text-emerald-700 dark:text-emerald-400 overflow-x-auto">
              <p>GET {baseUrl}/api/v1/facturi-emise</p>
              <p className="text-[#6e6e73] dark:text-[#98989d]">
                {"   "}?from=2026-01-01 &amp;to=2026-12-31
              </p>
              <p className="text-[#6e6e73] dark:text-[#98989d]">
                {"   "}&amp;client=Acme &amp;status=paid
              </p>
              <p className="text-[#0071e3] dark:text-[#64d2ff]">
                Authorization: Bearer sk_...
              </p>
            </div>
          </div>
          <div>
            <p className="text-[#6e6e73] dark:text-[#98989d] mb-1">
              # Detalii factură emisă
            </p>
            <div className="bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.05] dark:border-white/[0.07] rounded-xl p-3 text-emerald-700 dark:text-emerald-400 overflow-x-auto">
              <p>GET {baseUrl}/api/v1/facturi-emise/:id</p>
              <p className="text-[#0071e3] dark:text-[#64d2ff]">
                Authorization: Bearer sk_...
              </p>
            </div>
          </div>

          {/* Centre de Cost */}
          <p className="text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-semibold pt-2">
            Centre de cost
          </p>
          <div>
            <div className="bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.05] dark:border-white/[0.07] rounded-xl p-3 text-emerald-700 dark:text-emerald-400 overflow-x-auto space-y-1">
              <p>GET {baseUrl}/api/v1/cost-centers</p>
              <p>GET {baseUrl}/api/v1/cost-centers/:id</p>
              <p>GET {baseUrl}/api/v1/cost-centers/:id/invoices</p>
              <p>GET {baseUrl}/api/v1/cost-centers/:id/summary</p>
              <p className="text-[#0071e3] dark:text-[#64d2ff]">
                Authorization: Bearer sk_...
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
