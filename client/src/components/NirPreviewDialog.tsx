// NirPreviewDialog — previzualizare NIR direct în aplicație (fără descărcare)
// Generează PDF-ul din starea curentă a formularului (inclusiv modificări nesalvate)
// și îl afișează într-un viewer încorporat.

import { useEffect, useRef, useState } from "react";
import { Loader2, FileDown, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { saveWithFilePicker, getNirPdfFilename } from "@/lib/fileSave";

interface NirPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Returnează payload-ul curent al formularului NIR. */
  getPayload: () => Record<string, any>;
  showAccounting: boolean;
  nirNumber?: string;
  nirId?: number | null;
}

export default function NirPreviewDialog({
  open,
  onOpenChange,
  getPayload,
  showAccounting,
  nirNumber,
  nirId,
}: NirPreviewDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);

  const revoke = () => {
    setBlobUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/pdf/nir-preview?showAccounting=${showAccounting}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(getPayload()),
        }
      );
      if (!res.ok) {
        let msg = `Eroare la generarea previzualizării (${res.status})`;
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      const blob = await res.blob();
      blobRef.current = blob;
      setBlobUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch (e: any) {
      setError(e?.message || "Eroare necunoscută");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      generate();
    } else {
      revoke();
      blobRef.current = null;
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSave = async () => {
    const blob = blobRef.current;
    if (!blob) return;
    try {
      const savedName = await saveWithFilePicker(
        {
          suggestedName: getNirPdfFilename(nirNumber, nirId),
          acceptMimeType: "application/pdf",
          description: "Document PDF NIR (.pdf)",
          extensions: [".pdf"],
          pickerId: "nir_pdf",
        },
        async () => blob
      );
      if (savedName) toast.success(`Documentul ${savedName} a fost salvat cu succes!`);
    } catch (e: any) {
      toast.error("Eroare salvare PDF NIR: " + (e?.message || e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl w-[95vw] h-[92vh] flex flex-col gap-3 p-4">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between gap-3 pr-8 flex-wrap">
            <div>
              <DialogTitle>{/^nir/i.test((nirNumber || "").trim()) ? `Previzualizare ${(nirNumber || "").trim()}` : `Previzualizare NIR ${nirNumber || ""}`.trim()}</DialogTitle>
              <DialogDescription className="text-xs">
                Documentul reflectă datele curente din formular, inclusiv modificările nesalvate.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={generate}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                Reîmprospătează
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={loading || !blobUrl}
                style={{ backgroundColor: "var(--tenant-theme-color, #16a34a)" }}
                className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-white text-xs font-bold disabled:opacity-50 hover:brightness-90"
              >
                <FileDown className="w-3.5 h-3.5" />
                Salvează PDF…
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
          {loading && !blobUrl && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2
                className="w-7 h-7 animate-spin"
                style={{ color: "var(--tenant-theme-color, #16a34a)" }}
              />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-6">
              <AlertTriangle className="w-7 h-7 text-amber-500" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Nu s-a putut genera previzualizarea
              </p>
              <p className="text-xs text-slate-500">{error}</p>
            </div>
          )}
          {blobUrl && !error && (
            <iframe
              title="Previzualizare NIR"
              src={blobUrl}
              className="w-full h-full border-0 bg-white"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

