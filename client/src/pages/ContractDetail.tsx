import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Download,
  Printer,
  History,
  Plus,
  Clock,
  Building2,
  FileText,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Send,
  Edit,
  ExternalLink,
  Loader2,
  PenTool,
  FileSignature,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import ContractSignaturePadModal from "@/components/ContractSignaturePadModal";
import { toast } from "sonner";

export default function ContractDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const id = parseInt(params.id || "0");

  const {
    data: contract,
    isLoading,
    refetch,
  } = trpc.contracts.getById.useQuery({ id }, { enabled: !isNaN(id) && id > 0 });

  // Add Log state
  const [showAddLogModal, setShowAddLogModal] = useState(false);
  const [logActionType, setLogActionType] = useState("modificare_termeni");
  const [logExplanation, setLogExplanation] = useState("");
  const [logError, setLogError] = useState("");

  // Signature state
  const [showSigModal, setShowSigModal] = useState(false);
  const [sigRole, setSigRole] = useState<"supplier" | "client">("supplier");

  const signMutation = trpc.contracts.sign.useMutation({
    onSuccess: () => {
      refetch();
      const iframe = document.getElementById("pdf-frame") as HTMLIFrameElement;
      if (iframe) {
        iframe.src = `${pdfUrl}?t=${Date.now()}#view=FitH`;
      }
      toast.success("Semnătura a fost salvată și aplicată pe contract");
    },
    onError: (err) => {
      toast.error("Eroare la aplicarea semnăturii: " + err.message);
    },
  });

  const handleSaveSignature = (data: {
    signatureDataUrl: string;
    signatureType: "olografic" | "digital" | "hibrid";
    signatoryName: string;
    metadata?: any;
  }) => {
    if (!contract) return;
    signMutation.mutate({
      id: contract.id,
      role: sigRole,
      signatureType: data.signatureType,
      signatureData: data.signatureDataUrl,
      signatoryName: data.signatoryName,
      metadata: data.metadata,
    });
  };

  const addLogMutation = trpc.contracts.addLog.useMutation({
    onSuccess: () => {
      setShowAddLogModal(false);
      setLogExplanation("");
      setLogError("");
      refetch();
    },
    onError: (err) => {
      setLogError("Eroare la adăugarea notei: " + err.message);
    },
  });

  const pdfUrl = `/api/pdf/contract/${id}`;

  const getTypeLabel = (type?: string) => {
    switch (type) {
      case "act_aditional":
        return "Act Adițional";
      case "pv_receptie":
        return "Proces Verbal Recepție";
      case "anexa":
        return "Anexă Tehnică";
      default:
        return "Contract Cadru";
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "activ":
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 dark:bg-emerald-500/18 px-2.5 py-0.5 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>Activ</span>
          </span>
        );
      case "draft":
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/12 dark:bg-amber-500/18 px-2.5 py-0.5 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>În redactare</span>
          </span>
        );
      case "expirat":
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#ff3b30] dark:text-[#ff6961] bg-[#ff3b30]/12 dark:bg-[#ff453a]/18 px-2.5 py-0.5 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ff3b30] dark:bg-[#ff453a]" />
            <span>Expirat</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#6e6e73] dark:text-[#98989d] bg-[#f2f2f7] dark:bg-[#2c2c2e] px-2.5 py-0.5 rounded-full">
            <span>Reziliat</span>
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-[#6e6e73] dark:text-[#98989d]">
        <Loader2 className="h-7 w-7 animate-spin mb-3" />
        <p className="text-[13px] font-medium">Se încarcă documentul...</p>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="p-3 sm:p-5 max-w-full">
        <div className="apple-surface p-12 text-center">
          <FileText className="h-10 w-10 text-[#8e8e93] mx-auto mb-3" />
          <h2 className="text-lg font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
            Documentul nu a fost găsit
          </h2>
          <p className="text-[13px] text-[#6e6e73] dark:text-[#98989d] mt-1">
            Este posibil ca documentul să fi fost șters sau ID-ul este invalid.
          </p>
          <Link
            href="/contracte"
            className="apple-btn-prominent inline-flex items-center justify-center h-9 px-4 rounded-full text-white text-[12.5px] font-semibold mt-4"
          >
            Înapoi la Bibliotecă
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-5 overflow-x-hidden">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-0.5">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/contracte">
            <button
              type="button"
              aria-label="Înapoi la Contracte"
              className="apple-btn-glass h-9 w-9 rounded-full flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white transition-all cursor-pointer shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          </Link>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight tabular-nums">
                {getTypeLabel(contract.type)} {contract.number}
              </h1>
              {getStatusBadge(contract.status)}
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#3a3a3c] dark:text-[#ebebf5] bg-[#f2f2f7] dark:bg-[#2c2c2e] px-2.5 py-0.5 rounded-full">
                <Globe className="h-3 w-3 text-[#6e6e73] dark:text-[#98989d]" />
                <span>
                  {contract.language === "en"
                    ? "English (EN)"
                    : contract.language === "ro_en"
                      ? "Bilingv (RO - EN)"
                      : "Română (RO)"}
                </span>
              </span>
            </div>
            <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums">
              {contract.title} · Data încheierii:{" "}
              <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
                {contract.date}
              </strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowAddLogModal(true)}
            className="apple-btn-glass flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-semibold transition-all cursor-pointer"
          >
            <History className="h-3.5 w-3.5 text-[#6e6e73] dark:text-[#98989d] shrink-0" />
            <span>Adaugă Notă în Jurnal</span>
          </button>

          <Link
            href={`/contracte/new?parentContractId=${contract.id}&type=act_aditional`}
            className="apple-btn-glass flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-semibold transition-all"
          >
            <Plus className="h-3.5 w-3.5 text-[#0071e3] dark:text-[#0a84ff] shrink-0" />
            <span>Act Adițional Nou</span>
          </Link>

          <a
            href={`${pdfUrl}?download=1`}
            download
            className="apple-btn-glass flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-semibold transition-all"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Descarcă PDF</span>
          </a>

          <a
            href={`${pdfUrl}?download=1&format=word`}
            download
            className="apple-btn-glass flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-semibold transition-all"
          >
            <FileText className="h-3.5 w-3.5 text-[#0071e3] dark:text-[#0a84ff] shrink-0" />
            <span>Descarcă Word (.docx)</span>
          </a>

          <button
            type="button"
            onClick={() => {
              const iframe = document.getElementById("pdf-frame") as HTMLIFrameElement;
              if (iframe?.contentWindow) {
                iframe.contentWindow.print();
              } else {
                window.open(pdfUrl, "_blank");
              }
            }}
            className="apple-btn-glass flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-semibold transition-all cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5 text-[#6e6e73] dark:text-[#98989d] shrink-0" />
            <span>Tipărește</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSigRole(!contract.supplierSignature ? "supplier" : "client");
              setShowSigModal(true);
            }}
            className="apple-btn-prominent flex items-center justify-center gap-1.5 h-9 px-4 rounded-full text-white text-[12.5px] font-semibold transition-all cursor-pointer"
          >
            <PenTool className="h-3.5 w-3.5 shrink-0" />
            <span>Semnează Olografic / Digital</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: PDF Viewer */}
        <div className="lg:col-span-8 space-y-4 min-w-0">
          <div className="apple-surface overflow-hidden">
            <div className="bg-[#fafafa] dark:bg-white/[0.025] px-4 py-2.5 flex items-center justify-between text-[12.5px] text-[#6e6e73] dark:text-[#98989d] border-b border-black/[0.05] dark:border-white/[0.07]">
              <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-[#6e6e73] dark:text-[#98989d]" />
                Previzualizare PDF oficial (Format A4)
              </span>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#1d1d1f] dark:hover:text-white flex items-center gap-1 transition-colors font-medium"
              >
                <span>Deschide în tab nou</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="apple-doc-stage p-2 sm:p-3">
              <iframe
                id="pdf-frame"
                src={`${pdfUrl}#view=FitH`}
                className="w-full h-[850px] border-0 bg-white rounded-xl"
                title={`PDF Contract ${contract.number}`}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Partener, Detalii, Acte Aditionale & Jurnal */}
        <div className="lg:col-span-4 space-y-4 min-w-0">
          {/* Card Partener */}
          <div className="apple-surface p-5 space-y-3">
            <h3 className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#6e6e73] dark:text-[#98989d]" />
              Partener contractual
            </h3>

            <div>
              <div className="font-bold text-[15px] text-[#1d1d1f] dark:text-[#f5f5f7]">
                {contract.partnerName || "Nespecificat"}
              </div>
              <div className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-1.5 space-y-1 tabular-nums">
                {contract.partnerCui && (
                  <div>
                    CUI / CIF:{" "}
                    <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
                      {contract.partnerCui}
                    </strong>
                  </div>
                )}
                {contract.partnerSagaCode && (
                  <div>
                    Cod SAGA:{" "}
                    <span className="tabular-nums bg-[#f2f2f7] dark:bg-[#2c2c2e] px-2 py-0.5 rounded-full text-[11px] font-medium text-[#1d1d1f] dark:text-[#ebebf5]">
                      {contract.partnerSagaCode}
                    </span>
                  </div>
                )}
                {contract.partnerAddress && (
                  <div>
                    Adresă:{" "}
                    <span>
                      {contract.partnerAddress}
                      {contract.partnerCity ? `, ${contract.partnerCity}` : ""}
                    </span>
                  </div>
                )}
                {contract.partnerPhone && (
                  <div>
                    Tel: <span>{contract.partnerPhone}</span>
                  </div>
                )}
                {contract.partnerEmail && (
                  <div>
                    Email: <span>{contract.partnerEmail}</span>
                  </div>
                )}
              </div>
            </div>

            {contract.partnerId && (
              <Link
                href={`/clienti?search=${encodeURIComponent(contract.partnerCui || contract.partnerName || "")}`}
                className="apple-btn-glass w-full h-9 rounded-full flex items-center justify-center text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mt-2"
              >
                Deschide Fișa Partenerului
              </Link>
            )}
          </div>

          {/* Card Semnături & Certificare Digitală */}
          <div className="apple-surface p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-2">
                <FileSignature className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Semnături & certificare
              </h3>
              {contract.signatureType && contract.signatureType !== "none" && (
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300">
                  {contract.signatureType === "digital"
                    ? "Digital eIDAS"
                    : contract.signatureType === "hibrid"
                      ? "Hibrid"
                      : "Olografic"}
                </span>
              )}
            </div>

            <div className="space-y-3 text-xs">
              {/* Furnizor signature box */}
              <div className="p-3.5 rounded-2xl bg-[#f2f2f7] dark:bg-[#2c2c2e] space-y-2">
                <div className="flex items-center justify-between font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  <span>Furnizor / Prestator</span>
                  {contract.supplierSignature ? (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Semnat
                    </span>
                  ) : (
                    <span className="text-[11px] text-[#8e8e93]">Nesemnat</span>
                  )}
                </div>

                {contract.supplierSignature && (
                  <div className="py-2 text-center bg-white rounded-xl p-2 border border-black/[0.06]">
                    <img
                      src={contract.supplierSignature}
                      alt="Semnătură Furnizor"
                      className="max-h-12 max-w-[160px] object-contain mx-auto"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setSigRole("supplier");
                    setShowSigModal(true);
                  }}
                  className="apple-btn-glass w-full h-8 rounded-full flex items-center justify-center gap-1.5 text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                >
                  <PenTool className="h-3 w-3" />
                  <span>
                    {contract.supplierSignature ? "Re-semnează Furnizor" : "Semnează ca Furnizor"}
                  </span>
                </button>
              </div>

              {/* Beneficiar signature box */}
              <div className="p-3.5 rounded-2xl bg-[#f2f2f7] dark:bg-[#2c2c2e] space-y-2">
                <div className="flex items-center justify-between font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  <span>Beneficiar / Client</span>
                  {contract.clientSignature ? (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Semnat
                    </span>
                  ) : (
                    <span className="text-[11px] text-[#8e8e93]">Nesemnat</span>
                  )}
                </div>

                {contract.clientSignature && (
                  <div className="py-2 text-center bg-white rounded-xl p-2 border border-black/[0.06]">
                    <img
                      src={contract.clientSignature}
                      alt="Semnătură Beneficiar"
                      className="max-h-12 max-w-[160px] object-contain mx-auto"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setSigRole("client");
                    setShowSigModal(true);
                  }}
                  className="apple-btn-glass w-full h-8 rounded-full flex items-center justify-center gap-1.5 text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                >
                  <PenTool className="h-3 w-3" />
                  <span>
                    {contract.clientSignature ? "Re-semnează Beneficiar" : "Semnează ca Beneficiar"}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Acte Aditionale Legate */}
          <div className="apple-surface p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-[#6e6e73] dark:text-[#98989d]" />
                Acte adiționale ({contract.addendums?.length || 0})
              </h3>
              <Link
                href={`/contracte/new?parentContractId=${contract.id}&type=act_aditional`}
                className="apple-btn-glass px-2.5 h-7 rounded-full inline-flex items-center text-[11.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
              >
                + Adaugă
              </Link>
            </div>

            {(!contract.addendums || contract.addendums.length === 0) ? (
              <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d]">
                Nu există acte adiționale emise pentru acest contract.
              </p>
            ) : (
              <div className="space-y-2">
                {contract.addendums.map((a: any) => (
                  <Link
                    key={a.id}
                    href={`/contracte/${a.id}`}
                    className="block p-3 rounded-2xl bg-[#f2f2f7] dark:bg-[#2c2c2e] hover:brightness-97 dark:hover:brightness-110 transition-all"
                  >
                    <div className="flex items-center justify-between tabular-nums">
                      <span className="font-semibold text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {a.number}
                      </span>
                      <span className="text-[11px] text-[#6e6e73] dark:text-[#98989d]">
                        {a.date}
                      </span>
                    </div>
                    <p className="text-xs text-[#6e6e73] dark:text-[#98989d] mt-0.5 line-clamp-1">
                      {a.title}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Panou Jurnal Modificari & Explicatii (Audit Trail) */}
          <div className="apple-surface p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-2">
                <History className="h-4 w-4 text-[#6e6e73] dark:text-[#98989d]" />
                Jurnal modificări & explicații
              </h3>
              <span className="text-[11.5px] text-[#8e8e93] tabular-nums">
                {contract.logs?.length || 0} evenimente
              </span>
            </div>

            {(!contract.logs || contract.logs.length === 0) ? (
              <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d]">
                Nicio modificare înregistrată.
              </p>
            ) : (
              <div className="relative pl-5 space-y-3.5 border-l border-black/[0.08] dark:border-white/[0.1] mt-2">
                {contract.logs.map((l: any) => (
                  <div key={l.id} className="relative">
                    <div className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#8e8e93] border-2 border-white dark:border-[#1c1c1e]" />
                    <div>
                      <div className="flex items-center justify-between gap-1 text-[11px]">
                        <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                          {l.actionType.replace("_", " ")}
                        </span>
                        <span className="text-[#8e8e93] tabular-nums">
                          {new Date(l.createdAt).toLocaleDateString("ro-RO", {
                            day: "2-digit",
                            month: "short",
                            year: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-[#1d1d1f] dark:text-[#ebebf5] mt-1 font-medium bg-[#f2f2f7] dark:bg-[#2c2c2e] p-2.5 rounded-xl">
                        {l.explanation}
                      </p>
                      <div className="text-[11px] text-[#8e8e93] mt-1">
                        Autor: {l.userName || "Utilizator"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Adaugare Nota Jurnal */}
      <Dialog open={showAddLogModal} onOpenChange={setShowAddLogModal}>
        <DialogContent className="max-w-md rounded-[22px] p-6">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-bold flex items-center gap-2 text-[#1d1d1f] dark:text-[#f5f5f7]">
              <History className="h-4 w-4 text-[#6e6e73] dark:text-[#98989d]" />
              Adaugă Notă / Solicitare în Jurnal
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6e6e73] dark:text-[#98989d]">
              Notează orice solicitare, modificare de termen sau acord verbal cu privire la contractul {contract.number}.
            </DialogDescription>
          </DialogHeader>

          {logError && (
            <div className="text-xs text-[#ff3b30] dark:text-[#ff6961] bg-[#ff3b30]/10 p-2.5 rounded-xl">
              {logError}
            </div>
          )}

          <div className="space-y-3 mt-2">
            <div>
              <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">
                Tip eveniment:
              </label>
              <Select value={logActionType} onValueChange={setLogActionType}>
                <SelectTrigger className="apple-input text-xs h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl text-xs">
                  <SelectItem value="modificare_termeni">Modificare Termen Plată / Livrare</SelectItem>
                  <SelectItem value="modificare_pret">Actualizare Preț / Suplimentare Valoare</SelectItem>
                  <SelectItem value="prelungire">Prelungire Valabilitate</SelectItem>
                  <SelectItem value="act_aditional">Act Adițional Nou Încheiat</SelectItem>
                  <SelectItem value="notificare">Convorbire / Notificare Client</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">
                Explicație / Justificare obligatorie:
              </label>
              <textarea
                value={logExplanation}
                onChange={(e) => setLogExplanation(e.target.value)}
                rows={3}
                placeholder="Ex: Clientul a solicitat amânarea termenului de livrare cu 10 zile din cauza întârzierii șantierului..."
                className="apple-input w-full text-xs p-3 outline-none resize-none text-[#1d1d1f] dark:text-[#f5f5f7]"
              />
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <button
              type="button"
              onClick={() => setShowAddLogModal(false)}
              className="apple-btn-glass px-4 h-9 rounded-full text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
            >
              Anulează
            </button>
            <button
              type="button"
              disabled={!logExplanation.trim() || addLogMutation.isPending}
              onClick={() => {
                addLogMutation.mutate({
                  contractId: contract.id,
                  actionType: logActionType,
                  explanation: logExplanation,
                });
              }}
              className="apple-btn-prominent px-4 h-9 rounded-full text-white text-[12.5px] font-semibold disabled:opacity-50 cursor-pointer"
            >
              {addLogMutation.isPending ? "Se salvează..." : "Salvează Eveniment"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Signature Modal */}
      <ContractSignaturePadModal
        open={showSigModal}
        onOpenChange={setShowSigModal}
        role={sigRole}
        partyName={sigRole === "supplier" ? (contract.tenant?.name || "Furnizor") : (contract.partnerName || "Beneficiar")}
        contractNumber={contract.number}
        onSaveSignature={handleSaveSignature}
      />
    </div>
  );
}
