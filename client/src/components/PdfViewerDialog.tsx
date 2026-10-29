// PdfViewerDialog — vizualizare PDF direct în fereastră (fără tab sau pagină nouă)

import { useEffect, useRef, useState } from "react";
import { Loader2, FileDown, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { saveWithFilePicker } from "@/lib/fileSave";

interface PdfViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** URL-ul care returnează PDF-ul (același domeniu, cu cookie de autentificare). */
  url: string | null;
  title: string;
  /** Nume sugerat la „Salvează PDF…”. */
  fileName: string;
}

export default function PdfViewerDialog({ open, onOpenChange, url, title, fileName }: PdfViewerDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);

  useEffect(() => {
    if (!open || !url) return;
    let cancelled = false;
    let createdUrl: string | null = null;
    setLoading(true);
    setError(null);
    setBlobUrl(null);
    blobRef.current = null;
    (async () => {
      try {
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) {
          let msg = `Eroare la încărcarea PDF-ului (${res.status})`;
          try {
            const j = await res.json();
            if (j?.error) msg = j.error;
          } catch {
            /* ignore */
          }
          throw new Error(msg);
        }
        const blob = await res.blob();
        if (cancelled) return;
        blobRef.current = blob;
        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Eroare necunoscută");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [open, url]);

  const handleSave = async () => {
    const blob = blobRef.current;
    if (!blob) return;
    try {
      const savedName = await saveWithFilePicker(
        {
          suggestedName: fileName,
          acceptMimeType: "application/pdf",
          description: "Document PDF (.pdf)",
          extensions: [".pdf"],
          pickerId: "pdf_viewer",
        },
        async () => blob
      );
      if (savedName) toast.success(`Documentul ${savedName} a fost salvat cu succes!`);
    } catch (e: any) {
      toast.error("Eroare salvare PDF: " + (e?.message || e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl w-[95vw] h-[92vh] flex flex-col gap-3 p-4">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between gap-3 pr-8 flex-wrap">
            <DialogTitle>{title}</DialogTitle>
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
        </DialogHeader>
        <div className="flex-1 min-h-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
          {loading && !blobUrl && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-7 h-7 animate-spin" style={{ color: "var(--tenant-theme-color, #16a34a)" }} />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-6">
              <AlertTriangle className="w-7 h-7 text-amber-500" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Nu s-a putut încărca PDF-ul</p>
              <p className="text-xs text-slate-500">{error}</p>
            </div>
          )}
          {blobUrl && !error && <iframe title={title} src={blobUrl} className="w-full h-full border-0 bg-white" />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
