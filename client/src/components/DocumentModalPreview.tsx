import { useEffect, useState, useRef } from "react";
import { X, Download, Loader2, FileText, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface DocumentModalPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  pdfUrl: string | null;
  filename?: string;
  type?: "invoice" | "nir" | "emitted";
}

export default function DocumentModalPreview({
  isOpen,
  onClose,
  title,
  pdfUrl,
  filename,
  type = "invoice",
}: DocumentModalPreviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);

  const fetchPdf = async () => {
    if (!pdfUrl) return;
    setLoading(true);
    setError(null);
    setBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    blobRef.current = null;

    try {
      const res = await fetch(pdfUrl, { credentials: "include" });
      if (!res.ok) {
        let msg = `Documentul nu a putut fi descărcat (Cod ${res.status})`;
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
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
    } catch (e: any) {
      setError(e?.message || "A apărut o problemă la încărcarea fișierului PDF.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && pdfUrl) {
      fetchPdf();
    } else {
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      blobRef.current = null;
      setError(null);
    }

    return () => {
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [isOpen, pdfUrl]);

  if (!isOpen || !pdfUrl) return null;

  const downloadFilename = filename || (type === "nir" ? "NIR.pdf" : "Factura.pdf");

  const handleDownload = () => {
    const blob = blobRef.current;
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadFilename.endsWith(".pdf") ? downloadFilename : `${downloadFilename}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (pdfUrl) {
      window.open(pdfUrl, "_blank");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        className="w-[96vw] max-w-6xl sm:max-w-6xl xl:max-w-7xl xl:sm:max-w-7xl h-[94vh] flex flex-col p-0 gap-0 overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl"
      >
        {/* Header Modal */}
        <DialogHeader className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 flex flex-row items-center justify-between space-y-0 gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {type === "nir" ? (
              <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 shrink-0">
                <FileText className="w-4 h-4" />
              </div>
            )}
            <DialogTitle className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {title}
            </DialogTitle>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownload}
              disabled={loading || Boolean(error)}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition shadow-2xs disabled:opacity-50 shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descarcă PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Închide fereastra"
              className="w-8 h-8 rounded-full shrink-0 aspect-square border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition shadow-2xs cursor-pointer"
            >
              <X className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </DialogHeader>

        {/* Content: Embedded PDF iframe or loading/error */}
        <div className="flex-1 w-full h-full relative bg-slate-100 dark:bg-slate-950">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 dark:bg-slate-900/90 z-10 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Se încarcă documentul...</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center bg-white dark:bg-slate-900">
              <AlertTriangle className="w-9 h-9 text-amber-500" />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Nu s-a putut previzualiza documentul</p>
              <p className="text-xs text-slate-500 max-w-md">{error}</p>
              <button
                type="button"
                onClick={fetchPdf}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reîncearcă</span>
              </button>
            </div>
          )}

          {blobUrl && !error && (
            <iframe
              src={blobUrl}
              title={title}
              className="w-full h-full border-none bg-white"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
