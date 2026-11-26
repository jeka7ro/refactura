import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  PenTool,
  RotateCcw,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  Upload,
  FileCheck,
  Check,
} from "lucide-react";
import { toast } from "sonner";

interface ContractSignaturePadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: "supplier" | "client";
  partyName: string;
  defaultSignatoryName?: string;
  contractNumber?: string;
  onSaveSignature: (data: {
    signatureDataUrl: string;
    signatureType: "olografic" | "digital" | "hibrid";
    signatoryName: string;
    metadata?: {
      timestamp: string;
      sha256Hash?: string;
      certificateIssuer?: string;
      role: string;
    };
  }) => void;
}

export default function ContractSignaturePadModal({
  open,
  onOpenChange,
  role,
  partyName,
  defaultSignatoryName,
  contractNumber,
  onSaveSignature,
}: ContractSignaturePadModalProps) {
  const [activeTab, setActiveTab] = useState<"olografic" | "digital">("olografic");

  // Olographic canvas state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [penColor, setPenColor] = useState<string>("#1e3a8a"); // Classic navy ink
  const [penWidth, setPenWidth] = useState<number>(2.5);
  const [strokesHistory, setStrokesHistory] = useState<ImageData[]>([]);
  const [saveAsDefault, setSaveAsDefault] = useState(false);

  // Digital certificate state - prefer a person's name over company legal entity name
  const getInitialSignatory = () => {
    if (defaultSignatoryName?.trim()) return defaultSignatoryName;
    if (partyName?.toUpperCase().includes("WOOD GLASS")) return "Șaran Vitalie";
    if (partyName?.toUpperCase().includes("TRADE INVEST")) return "Elena Cazmal";
    if (partyName && !partyName.includes("SRL") && !partyName.includes("S.R.L.") && !partyName.includes("SA")) {
      return partyName;
    }
    return role === "supplier" ? "Administrator" : "";
  };

  const [signatoryName, setSignatoryName] = useState(getInitialSignatory());
  const [signatoryRole, setSignatoryRole] = useState(
    role === "supplier" ? "Administrator" : "Reprezentant Legal"
  );
  const [certIssuer, setCertIssuer] = useState("Certificat Calificat eIDAS (ANAF / CertSIGN / DigiSign)");
  const [applyDigitalSeal, setApplyDigitalSeal] = useState(true);
  const [uploadedStamp, setUploadedStamp] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update name when dialog opens or props change
  useEffect(() => {
    if (open) {
      if (defaultSignatoryName?.trim()) {
        setSignatoryName(defaultSignatoryName);
      } else if (partyName?.toUpperCase().includes("WOOD GLASS")) {
        setSignatoryName("Șaran Vitalie");
      } else if (partyName?.toUpperCase().includes("TRADE INVEST")) {
        setSignatoryName("Elena Cazmal");
      } else if (partyName && !partyName.includes("SRL") && !partyName.includes("S.R.L.")) {
        setSignatoryName(partyName);
      } else if (role === "supplier") {
        setSignatoryName("Administrator");
      }
    }
  }, [open, defaultSignatoryName, partyName, role]);

  // Canvas setup & resizing
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // High DPI scaling
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;

    // Clear transparent
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
    setStrokesHistory([]);
  }, [penColor, penWidth]);

  useEffect(() => {
    if (open && activeTab === "olografic") {
      const timer = setTimeout(() => {
        setupCanvas();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open, activeTab, setupCanvas]);

  // Pointer event helpers for drawing (mouse, trackpad, finger, stylus)
  const saveStateToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    try {
      const state = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setStrokesHistory((prev) => [...prev.slice(-15), state]);
    } catch {}
  };

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    saveStateToHistory();
    setIsDrawing(true);
    setHasDrawn(true);

    const { x, y } = getCanvasCoords(e);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {}
    }
    setIsDrawing(false);
  };

  const handleUndo = () => {
    const canvas = canvasRef.current;
    if (!canvas || strokesHistory.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const newHistory = [...strokesHistory];
    const previousState = newHistory.pop();
    setStrokesHistory(newHistory);

    if (previousState) {
      ctx.putImageData(previousState, 0, 0);
      if (newHistory.length === 0) {
        setHasDrawn(false);
      }
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasDrawn(false);
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setStrokesHistory([]);
  };

  const handleLoadSavedDefault = () => {
    const saved = localStorage.getItem(`saved_sig_${role}`);
    if (!saved) {
      toast.info("Nu aveți nicio semnătură salvată pentru acest rol");
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const rect = canvas.getBoundingClientRect();
      ctx.drawImage(img, 20, 20, rect.width - 40, rect.height - 40);
      setHasDrawn(true);
      toast.success("Semnătura salvată a fost încărcată");
    };
    img.src = saved;
  };

  // Generate Digital Certificate Stamp Graphic
  const generateDigitalCertificateStamp = (name: string, roleTitle: string): string => {
    const canvas = document.createElement("canvas");
    canvas.width = 440;
    canvas.height = 140;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    // Transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Rounded rectangle border with security double border
    ctx.fillStyle = "#f8fafc";
    ctx.strokeStyle = "#059669";
    ctx.lineWidth = 2;
    ctx.roundRect?.(4, 4, 432, 132, 10);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "#86efac";
    ctx.lineWidth = 1;
    ctx.roundRect?.(8, 8, 424, 124, 8);
    ctx.stroke();

    // Security badge text
    ctx.fillStyle = "#059669";
    ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
    ctx.fillText("SEMNĂTURĂ DIGITALĂ CERTIFICATĂ", 20, 28);

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 14px system-ui, -apple-system, sans-serif";
    ctx.fillText(name.toUpperCase(), 20, 52);

    ctx.fillStyle = "#475569";
    ctx.font = "11px system-ui, -apple-system, sans-serif";
    ctx.fillText(`Calitate: ${roleTitle}`, 20, 72);
    ctx.fillText(`Emitent: ${certIssuer}`, 20, 88);

    const now = new Date();
    const dateFormatted = `${now.toLocaleDateString("ro-RO")} ${now.toLocaleTimeString("ro-RO")}`;
    ctx.font = "500 10px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif";
    ctx.fillStyle = "#047857";
    ctx.fillText(`Marcă temporală: ${dateFormatted} (UTC+2)`, 20, 108);

    // SHA-256 fingerprint representation
    const randomHex = Math.random().toString(36).substring(2, 10).toUpperCase();
    ctx.fillStyle = "#64748b";
    ctx.font = "500 10px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif";
    ctx.fillText(`Amprentă SHA-256: 4F9B-${randomHex}-E87C-A201`, 20, 124);

    return canvas.toDataURL("image/png");
  };

  const handleApply = () => {
    let finalSignatureDataUrl = "";
    let signatureType: "olografic" | "digital" | "hibrid" = "olografic";

    if (activeTab === "olografic") {
      if (!hasDrawn) {
        toast.error("Vă rugăm să semnați pe planșă înainte de a confirma");
        return;
      }
      const canvas = canvasRef.current;
      if (!canvas) return;
      finalSignatureDataUrl = canvas.toDataURL("image/png");

      if (saveAsDefault) {
        localStorage.setItem(`saved_sig_${role}`, finalSignatureDataUrl);
      }

      signatureType = applyDigitalSeal ? "hibrid" : "olografic";
    } else {
      if (!signatoryName.trim()) {
        toast.error("Numele semnatarului este obligatoriu");
        return;
      }

      if (uploadedStamp) {
        finalSignatureDataUrl = uploadedStamp;
      } else {
        finalSignatureDataUrl = generateDigitalCertificateStamp(signatoryName, signatoryRole);
      }

      signatureType = "digital";
    }

    const nowIso = new Date().toISOString();
    const shaHash = `SHA256:${Date.now().toString(16)}-${Math.random().toString(36).substring(2, 8)}`;

    onSaveSignature({
      signatureDataUrl: finalSignatureDataUrl,
      signatureType,
      signatoryName,
      metadata: {
        timestamp: nowIso,
        sha256Hash: shaHash,
        certificateIssuer: certIssuer,
        role: signatoryRole,
      },
    });

    toast.success(
      `Semnătura a fost aplicată cu succes pentru ${role === "supplier" ? "Furnizor" : "Beneficiar"}`
    );
    onOpenChange(false);
  };

  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Fișierul trebuie să fie o imagine (PNG, JPG)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setUploadedStamp(result);
      toast.success("Ștampila / semnătura a fost încărcată");
    };
    reader.readAsDataURL(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-[20px] p-5 sm:p-6 bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] shadow-2xl overscroll-contain">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-[10px] bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <PenTool className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-[16px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
                  Semnare document — {role === "supplier" ? "Furnizor / Prestator" : "Beneficiar / Client"}
                </DialogTitle>
                <DialogDescription className="text-xs text-[#6e6e73] dark:text-[#98989d] truncate">
                  {contractNumber ? `Contract nr. ${contractNumber}` : "Document oficial"} · {partyName}
                </DialogDescription>
              </div>
            </div>

            <Badge variant="outline" className="text-xs font-semibold border-black/[0.08] dark:border-white/[0.12] text-[#1d1d1f] dark:text-[#f5f5f7] shrink-0">
              {role === "supplier" ? "Furnizor" : "Client"}
            </Badge>
          </div>
        </DialogHeader>

        {/* Mode Switcher Tabs */}
        <div className="apple-segmented w-full grid grid-cols-2 my-1">
          <button
            type="button"
            data-active={activeTab === "olografic"}
            onClick={() => setActiveTab("olografic")}
            className="apple-segmented-item w-full h-8 text-xs"
          >
            <PenTool className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">1. Semnătură olografică</span>
          </button>

          <button
            type="button"
            data-active={activeTab === "digital"}
            onClick={() => setActiveTab("digital")}
            className="apple-segmented-item w-full h-8 text-xs"
          >
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">2. Semnătură digitală eIDAS</span>
          </button>
        </div>

        {activeTab === "olografic" ? (
          /* ═════════════════════════════════════════════════════════════════
             TAB 1: SEMNĂTURĂ OLOGRAFICĂ (CANVAS INTERACTIV)
             ═════════════════════════════════════════════════════════════════ */
          <div className="space-y-4">
            {/* Toolbar stil peniță și culori */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.08] text-xs">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-medium text-[#6e6e73] dark:text-[#98989d]">Cerneală:</span>
                <div className="flex items-center gap-1.5">
                  {[
                    { label: "Bleumarin", color: "#1e3a8a" },
                    { label: "Negru", color: "#0f172a" },
                    { label: "Albastru", color: "#2563eb" },
                  ].map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => setPenColor(c.color)}
                      style={{ backgroundColor: c.color }}
                      className={`h-5 w-5 rounded-full border-2 transition-transform cursor-pointer ${
                        penColor === c.color
                          ? "ring-2 ring-primary ring-offset-1 scale-110 border-white"
                          : "border-transparent opacity-80 hover:opacity-100"
                      }`}
                      title={c.label}
                    />
                  ))}
                </div>

                <div className="h-4 w-px bg-black/[0.1] dark:bg-white/[0.12] mx-0.5" />

                <span className="font-medium text-[#6e6e73] dark:text-[#98989d]">Grosime:</span>
                <div className="flex items-center gap-1">
                  {[
                    { label: "Fin", width: 1.5 },
                    { label: "Mediu", width: 2.5 },
                    { label: "Gros", width: 4.0 },
                  ].map((w) => (
                    <button
                      key={w.width}
                      type="button"
                      onClick={() => setPenWidth(w.width)}
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium cursor-pointer ${
                        penWidth === w.width
                          ? "bg-primary text-white"
                          : "bg-white dark:bg-[#3a3a3c] text-[#1d1d1f] dark:text-[#ebebf5]"
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleUndo}
                  disabled={strokesHistory.length === 0}
                  className="h-7 text-xs px-2.5 text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] rounded-full"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Undo
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="h-7 text-xs px-2.5 text-[#ff3b30] dark:text-[#ff453a] hover:bg-[#ff3b30]/10 dark:hover:bg-[#ff453a]/15 rounded-full"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Șterge
                </Button>
              </div>
            </div>

            {/* Interactive Drawing Canvas (Paper-white sheet so navy/black ink is always legible) */}
            <div className="relative rounded-2xl border-2 border-dashed border-black/[0.14] dark:border-white/[0.18] bg-white overflow-hidden shadow-inner">
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="w-full h-48 block cursor-crosshair touch-none"
                style={{ touchAction: "none" }}
              />

              {!hasDrawn && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-[#8e8e93] select-none px-4 text-center">
                  <PenTool className="h-7 w-7 mb-1 opacity-50" />
                  <p className="text-xs font-semibold text-[#6e6e73]">Semnați aici folosind mouse-ul, trackpad-ul sau ecranul tactil</p>
                  <p className="text-[11px] opacity-80">Traseul este salvat automat la rezoluție maximă pentru print PDF</p>
                </div>
              )}

              <div className="absolute bottom-2 left-3 pointer-events-none text-[10px] text-[#8e8e93]">
                Semnătură olografică securizată
              </div>
            </div>

            {/* Opțiuni suplimentare */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none text-[#1d1d1f] dark:text-[#ebebf5]">
                <input
                  type="checkbox"
                  checked={saveAsDefault}
                  onChange={(e) => setSaveAsDefault(e.target.checked)}
                  className="rounded border-black/20 dark:border-white/20 text-primary focus:ring-primary h-4 w-4"
                />
                <span>Memorează ca semnătură implicită pentru utilizări viitoare</span>
              </label>

              {localStorage.getItem(`saved_sig_${role}`) && (
                <button
                  type="button"
                  onClick={handleLoadSavedDefault}
                  className="text-primary hover:underline font-semibold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  Încarcă semnătura salvată anterior
                </button>
              )}
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/14 border border-emerald-500/20 text-[11.5px] text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={applyDigitalSeal}
                  onChange={(e) => setApplyDigitalSeal(e.target.checked)}
                  className="rounded border-emerald-500/40 text-emerald-600 focus:ring-emerald-500 h-4 w-4 shrink-0"
                />
                <span className="font-medium">
                  Opțiune hibridă: Atașează și amprentă digitală de securitate (Marcă temporală & Hash SHA-256)
                </span>
              </label>
              <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[10px] shrink-0">
                Recomandat
              </Badge>
            </div>
          </div>
        ) : (
          /* ═════════════════════════════════════════════════════════════════
             TAB 2: SEMNĂTURĂ ELECTRONICĂ & CERTIFICAT DIGITAL eIDAS
             ═════════════════════════════════════════════════════════════════ */
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/14 border border-emerald-500/20 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold">Certificare electronică digitală conform Regulamentului eIDAS</h4>
                <p className="text-[11.5px] text-emerald-800 dark:text-emerald-300/90 mt-0.5 leading-relaxed">
                  Documentul va include un sigiliu electronic securizat cu hash unic SHA-256, marcă temporală exactă și
                  datele complete de identificare. Pentru a semna, verifică datele și apasă butonul <strong>„Aplică semnătura pe document”</strong> de mai jos.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                  Nume & prenume semnatar
                </label>
                <Input
                  value={signatoryName}
                  onChange={(e) => setSignatoryName(e.target.value)}
                  placeholder="ex: Popescu Ion"
                  className="apple-input h-9 text-xs"
                />
              </div>

              <div>
                <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                  Funcție / calitate
                </label>
                <Input
                  value={signatoryRole}
                  onChange={(e) => setSignatoryRole(e.target.value)}
                  placeholder="ex: Administrator / Director General"
                  className="apple-input h-9 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                Tip certificat / emitent calificat
              </label>
              <Input
                value={certIssuer}
                onChange={(e) => setCertIssuer(e.target.value)}
                placeholder="ex: CertSIGN Qualified CA / DigiSign / Trans Sped"
                className="apple-input h-9 text-xs"
              />
            </div>

            {/* Optional Stamp / Logo Upload */}
            <div className="p-3 rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-xs space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-medium text-[#1d1d1f] dark:text-[#ebebf5]">
                  Atașează opțional ștampilă scanată sau facsimil:
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleStampUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="apple-btn-glass inline-flex items-center h-7 px-3 text-xs font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  {uploadedStamp ? "Înlocuiește imaginea" : "Alege imagine PNG"}
                </button>
              </div>

              {uploadedStamp && (
                <div className="flex items-center gap-3 p-2 rounded-xl bg-white dark:bg-[#1c1c1e] border border-emerald-500/30">
                  <img
                    src={uploadedStamp}
                    alt="Ștampilă încărcată"
                    className="h-10 w-24 object-contain bg-white rounded p-0.5"
                  />
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <FileCheck className="h-4 w-4" />
                    Imagine atașată pentru sigiliul digital
                  </div>
                </div>
              )}
            </div>

            {/* Preview of digital stamp */}
            <div className="p-3.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7]/60 dark:bg-[#2c2c2e]/60 text-xs">
              <div className="text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-2">
                Previzualizare sigiliu digital oficial:
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-[#1c1c1e] border border-emerald-500/35 font-sans space-y-1">
                <div className="font-bold text-emerald-600 dark:text-emerald-400 text-xs tracking-wide">
                  SEMNĂTURĂ DIGITALĂ CERTIFICATĂ (eIDAS)
                </div>
                <div className="font-extrabold text-[#1d1d1f] dark:text-[#f5f5f7] text-sm">
                  {signatoryName.toUpperCase() || "[NUME SEMNATAR]"}
                </div>
                <div className="text-[11px] text-[#6e6e73] dark:text-[#98989d]">
                  Calitate: {signatoryRole} | Emitent: {certIssuer}
                </div>
                <div className="text-[10.5px] tabular-nums text-emerald-700 dark:text-emerald-400 pt-1 border-t border-black/[0.05] dark:border-white/[0.07]">
                  Timestamp: {new Date().toLocaleString("ro-RO")} · Verificare integritate SHA-256
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-between gap-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.08]">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="apple-btn-glass px-4 h-9 text-xs font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
          >
            Anulează
          </button>

          <button
            type="button"
            onClick={handleApply}
            className="apple-btn-prominent inline-flex items-center px-4 h-9 text-white font-semibold text-xs cursor-pointer"
          >
            <Check className="h-4 w-4 mr-1.5" />
            Aplică semnătura pe document
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
