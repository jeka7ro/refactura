import { useEffect, useState, useRef } from "react";
import { X, Download, Loader2, FileText, CheckCircle2, AlertTriangle, RefreshCw, Printer, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface DocumentModalPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  pdfUrl: string | null;
  filename?: string;
  type?: "invoice" | "nir" | "emitted";
  theme?: "modern" | "saga";
}

export default function DocumentModalPreview({
  isOpen,
  onClose,
  title,
  pdfUrl,
  filename,
  type = "invoice",
  theme = "modern",
}: DocumentModalPreviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);

  // Determină URL-ul complet autorizat (asigură atașarea token-ului contabil dacă există)
  const getEffectiveUrl = (url: string | null): string => {
    if (!url) return "";
    let finalUrl = url;

    // Căutăm token contabil dacă nu e deja în URL
    if (!finalUrl.includes("accountantToken=")) {
      let accToken: string | null = null;
      try {
        if (typeof window !== "undefined") {
          for (let i = 0; i < sessionStorage.length; i++) {
            const k = sessionStorage.key(i);
            if (k && k.startsWith("smart_invoice_accountant_session")) {
              const v = sessionStorage.getItem(k);
              if (v) {
                accToken = v;
                break;
              }
            }
          }
        }
      } catch {}

      if (accToken) {
        const sep = finalUrl.includes("?") ? "&" : "?";
        finalUrl = `${finalUrl}${sep}accountantToken=${encodeURIComponent(accToken)}`;
      }
    }
    return finalUrl;
  };

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
      const headers: Record<string, string> = {};
      try {
        const authToken = localStorage.getItem("authToken");
        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }
      } catch {}

      const effectiveUrl = getEffectiveUrl(pdfUrl);

      // Extragem accountantToken din URL pentru a-l trimite și în header-ul x-accountant-token
      try {
        const m = effectiveUrl.match(/[?&]accountantToken=([^&]+)/);
        if (m && m[1]) {
          headers["x-accountant-token"] = decodeURIComponent(m[1]);
        }
      } catch {}

      const res = await fetch(effectiveUrl, { credentials: "include", headers });
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
  const effectiveDownloadUrl = getEffectiveUrl(pdfUrl);

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
    } else if (effectiveDownloadUrl) {
      window.open(effectiveDownloadUrl, "_blank");
    }
  };

  if (theme === "saga") {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent
          showCloseButton={false}
          className="w-[96vw] max-w-6xl xl:max-w-7xl h-[94vh] flex flex-col p-0 gap-0 overflow-hidden bg-[#ECE9D8] text-slate-900 border-2 border-[#1F4E79] rounded-none shadow-2xl font-sans"
        >
          {/* Header Fereastră Clasică SAGA C */}
          <div className="bg-[#1F4E79] text-white px-3 py-1.5 flex items-center justify-between select-none">
            <div className="flex items-center gap-2 min-w-0">
              <span className="bg-[#E59866] text-black font-extrabold px-1 rounded-xs text-[10px] tracking-tight shrink-0 shadow-2xs">
                SC
              </span>
              <span className="font-bold text-xs truncate">
                SAGA C 3.0 — [Vizualizare {type === "nir" ? "NIR" : "Factură"}] — {title}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onClose}
                aria-label="Închide fereastra"
                className="w-5 h-5 bg-[#C0C0C0] hover:bg-red-600 hover:text-white text-black border border-[#808080] flex items-center justify-center font-bold text-xs cursor-pointer leading-none transition-colors"
                title="Închide fereastra (Esc)"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Bara de unelte / Acțiuni SAGA */}
          <div className="bg-[#F0F4F8] border-b border-[#BDC7D1] px-3 py-1.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownload}
                disabled={loading || Boolean(error)}
                className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 border border-[#BDC7D1] text-slate-800 font-semibold rounded text-xs shadow-2xs cursor-pointer disabled:opacity-50"
                title="Descarcă fișierul PDF pe calculator"
              >
                <Download className="w-3.5 h-3.5 text-blue-700" />
                <span>Descarcă PDF</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (blobUrl) {
                    window.open(blobUrl, "_blank");
                  } else if (effectiveDownloadUrl) {
                    window.open(effectiveDownloadUrl, "_blank");
                  }
                }}
                disabled={loading || Boolean(error)}
                className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 border border-[#BDC7D1] text-slate-800 font-semibold rounded text-xs shadow-2xs cursor-pointer disabled:opacity-50"
                title="Deschide documentul într-o filă nouă pentru listare/tipărire"
              >
                <ExternalLink className="w-3.5 h-3.5 text-emerald-700" />
                <span>Tipărire / Tab Nou</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 bg-white hover:bg-slate-100 border border-[#BDC7D1] text-slate-700 font-medium rounded text-xs cursor-pointer shadow-2xs"
            >
              Închide [Esc]
            </button>
          </div>

          {/* Canvas Document */}
          <div className="flex-1 w-full h-full relative bg-[#7F7F7F]">
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-10 text-slate-700">
                <Loader2 className="w-8 h-8 animate-spin text-[#1F4E79] mb-2" />
                <p className="text-xs font-semibold">Se încarcă documentul SAGA...</p>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center bg-white">
                <AlertTriangle className="w-9 h-9 text-amber-500" />
                <p className="text-sm font-bold text-slate-800">Nu s-a putut deschide documentul</p>
                <p className="text-xs text-slate-500 max-w-md">{error}</p>
                <button
                  type="button"
                  onClick={fetchPdf}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-300"
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        className="w-[96vw] max-w-6xl sm:max-w-6xl xl:max-w-7xl xl:sm:max-w-7xl h-[94vh] flex flex-col p-0 gap-0 overflow-hidden bg-white/96 dark:bg-[#1c1c1e]/96 backdrop-blur-2xl border border-black/[0.08] dark:border-white/[0.12] rounded-[22px] shadow-2xl"
      >
        {/* Header Modal */}
        <DialogHeader className="px-5 py-3 border-b border-black/[0.06] dark:border-white/[0.08] bg-[#f5f7fb]/85 dark:bg-white/[0.03] backdrop-blur-md flex flex-row items-center justify-between space-y-0 gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {type === "nir" ? (
              <div className="w-8 h-8 rounded-xl bg-teal-500/12 dark:bg-teal-500/20 border border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-blue-500/12 dark:bg-blue-500/20 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <FileText className="w-4 h-4" />
              </div>
            )}
            <DialogTitle className="text-sm font-bold text-[#1d1d1f] dark:text-white truncate">
              {title}
            </DialogTitle>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownload}
              disabled={loading || Boolean(error)}
              className="apple-btn-prominent inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-semibold text-white transition disabled:opacity-50 shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descarcă PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Închide fereastra"
              className="apple-btn-glass w-8 h-8 rounded-full shrink-0 aspect-square text-[#3a3a3c] dark:text-[#ebebf5] flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </DialogHeader>

        {/* Content: Embedded PDF iframe or loading/error */}
        <div className="flex-1 w-full h-full relative bg-[#f2f2f7] dark:bg-black">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 dark:bg-[#1c1c1e]/90 z-10 text-[#636366] dark:text-[#98989d]">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
              <p className="text-xs font-semibold text-[#1d1d1f] dark:text-white">Se încarcă documentul...</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center bg-white dark:bg-[#1c1c1e]">
              <AlertTriangle className="w-9 h-9 text-amber-500" />
              <p className="text-sm font-bold text-[#1d1d1f] dark:text-white">Nu s-a putut previzualiza documentul</p>
              <p className="text-xs text-[#636366] dark:text-[#98989d] max-w-md">{error}</p>
              <button
                type="button"
                onClick={fetchPdf}
                className="apple-btn-glass mt-2 inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-semibold text-[#1d1d1f] dark:text-white transition"
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
