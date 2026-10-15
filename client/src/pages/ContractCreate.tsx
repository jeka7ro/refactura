import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  FileSignature,
  FileText,
  Sparkles,
  Building2,
  Calendar,
  Save,
  Loader2,
  Upload,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  FileUp,
  X,
  RefreshCw,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PartnerCombobox, { PartnerItem } from "@/components/PartnerCombobox";

export default function ContractCreate() {
  const [, setLocation] = useLocation();

  // URL search params
  const searchParams = new URLSearchParams(window.location.search);
  const parentContractIdParam = searchParams.get("parentContractId");
  const typeParam = searchParams.get("type");
  const partnerIdParam = searchParams.get("partnerId");
  const modeParam = searchParams.get("mode"); // "upload" | "generate"

  // Main Mode: "upload" (Upload existing signed PDF) OR "generate" (Digital template generator)
  const [activeMode, setActiveMode] = useState<"upload" | "generate">(
    modeParam === "generate" ? "generate" : "upload"
  );

  // Queries
  const { data: partners = [], isLoading: loadingPartners } = trpc.clients.list.useQuery();
  const { data: templates = [] } = trpc.contracts.getTemplates.useQuery();
  const { data: allContracts = [] } = trpc.contracts.list.useQuery();
  const { data: tenant } = trpc.tenants.current.useQuery();

  // Form State
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(
    partnerIdParam ? parseInt(partnerIdParam) : null
  );
  const [parentContractId, setParentContractId] = useState<number | null>(
    parentContractIdParam ? parseInt(parentContractIdParam) : null
  );

  const [docType, setDocType] = useState<string>(typeParam || "contract");
  const [docNumber, setDocNumber] = useState<string>(() => {
    const year = new Date().getFullYear();
    const rand = Math.floor(100 + Math.random() * 900);
    return typeParam === "act_aditional" ? `ACT-${year}/${rand}` : `CTR-${year}/${rand}`;
  });
  const [docDate, setDocDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [validFrom, setValidFrom] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [validUntil, setValidUntil] = useState<string>("");
  const [docValue, setDocValue] = useState<string>("0.00");
  const [docCurrency, setDocCurrency] = useState<string>("RON");
  const [docStatus, setDocStatus] = useState<"activ" | "draft" | "expirat" | "reziliat">("activ");

  // Generator specific fields
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    typeParam === "act_aditional" ? "act-aditional-modificare" : "contract-cadru-woodglass"
  );
  const [contractObject, setContractObject] = useState<string>(
    "Fabricarea, livrarea și montajul de tâmplărie din aluminiu și confecții din sticlă securizată"
  );
  const [paymentTermDays, setPaymentTermDays] = useState<string>("30");
  const [deliveryDays, setDeliveryDays] = useState<string>("15");
  const [warrantyMonths, setWarrantyMonths] = useState<string>("24");
  const [customClauses, setCustomClauses] = useState<string>("");

  // Upload specific fields
  const [uploadedFile, setUploadedFile] = useState<{
    fileUrl: string;
    fileName: string;
    fileSize: number;
    detectedNumber?: string | null;
    detectedCui?: string | null;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Common fields
  const [explanation, setExplanation] = useState<string>(
    activeMode === "upload"
      ? "Contract semnat fizic, scanat și arhivat în biblioteca digitală Wood Glass"
      : "Contract generat digital din sistem"
  );
  const [contentHtml, setContentHtml] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Selected Partner Details
  const selectedPartner = useMemo(() => {
    return partners.find((p: any) => p.id === selectedPartnerId);
  }, [partners, selectedPartnerId]);

  // Selected Parent Contract
  const parentContract = useMemo(() => {
    return allContracts.find((c: any) => c.id === parentContractId);
  }, [allContracts, parentContractId]);

  // Auto-set partner if parent contract exists
  useEffect(() => {
    if (parentContract && parentContract.partnerId && !selectedPartnerId) {
      setSelectedPartnerId(parentContract.partnerId);
    }
  }, [parentContract, selectedPartnerId]);

  // Handle File Upload to /api/upload-contract
  const handleUploadFile = async (file: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setErrorMsg("Sunt acceptate doar fișiere în format PDF.");
      return;
    }

    setIsUploading(true);
    setErrorMsg("");

    const formData = new FormData();
    formData.append("files", file);

    try {
      const res = await fetch("/api/upload-contract", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Eroare la încărcarea fișierului");
      }

      if (data.files && data.files.length > 0) {
        const f = data.files[0];
        setUploadedFile(f);

        // Auto-fill contract number if detected from file name
        if (f.detectedNumber && (!docNumber || docNumber.startsWith("CTR-"))) {
          setDocNumber(f.detectedNumber);
        }

        // Auto-match partner by CUI if detected and no partner selected yet
        if (f.detectedCui && !selectedPartnerId) {
          const cleanSearch = f.detectedCui.replace(/^ro/i, "").trim();
          const match = partners.find((p: any) => {
            const pCui = String(p.cui || "")
              .replace(/^ro/i, "")
              .trim();
            return pCui === cleanSearch;
          });
          if (match) {
            setSelectedPartnerId(match.id);
          }
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Eroare la upload PDF.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFile(e.dataTransfer.files[0]);
    }
  };

  // Compile HTML for template generator
  useEffect(() => {
    if (activeMode !== "generate") return;

    const tmpl = templates.find((t) => t.id === selectedTemplateId);
    if (!tmpl) return;

    let raw = tmpl.contentHtml || "";

    // Replace Tenant Variables (Wood Glass SRL)
    raw = raw
      .replace(/{{tenant\.name}}/g, tenant?.name || "WOOD GLASS SRL")
      .replace(/{{tenant\.cui}}/g, (tenant as any)?.fiscalCode || "RO28396216")
      .replace(/{{tenant\.regCom}}/g, "J08/1314/2011")
      .replace(/{{tenant\.city}}/g, "Brașov")
      .replace(/{{tenant\.address}}/g, "Str. Automotoarelor 12")
      .replace(/{{tenant\.iban}}/g, "RO00BTRL0000000000000000")
      .replace(/{{tenant\.bank}}/g, "Banca Transilvania");

    // Replace Partner Variables
    if (selectedPartner) {
      raw = raw
        .replace(/{{partner\.name}}/g, selectedPartner.name || "Nespecificat")
        .replace(/{{partner\.cui}}/g, selectedPartner.cui || "-")
        .replace(/{{partner\.regCom}}/g, selectedPartner.regCom || "-")
        .replace(/{{partner\.city}}/g, selectedPartner.city || "-")
        .replace(/{{partner\.address}}/g, selectedPartner.address || "-")
        .replace(/{{partner\.iban}}/g, "-")
        .replace(/{{partner\.bank}}/g, "-")
        .replace(/{{partner\.delegat}}/g, "Administrator");
    } else {
      raw = raw
        .replace(/{{partner\.name}}/g, "[Selectați Partenerul]")
        .replace(/{{partner\.cui}}/g, "-")
        .replace(/{{partner\.regCom}}/g, "-")
        .replace(/{{partner\.city}}/g, "-")
        .replace(/{{partner\.address}}/g, "-")
        .replace(/{{partner\.iban}}/g, "-")
        .replace(/{{partner\.bank}}/g, "-")
        .replace(/{{partner\.delegat}}/g, "Administrator");
    }

    // Replace Contract Variables
    raw = raw
      .replace(/{{contract\.number}}/g, docNumber)
      .replace(/{{contract\.date}}/g, docDate)
      .replace(/{{contract\.value}}/g, docValue)
      .replace(/{{contract\.currency}}/g, docCurrency)
      .replace(/{{contract\.paymentTerm}}/g, paymentTermDays)
      .replace(/{{contract\.deliveryDays}}/g, deliveryDays)
      .replace(/{{contract\.warrantyMonths}}/g, warrantyMonths)
      .replace(/{{contract\.glassWarrantyMonths}}/g, "36")
      .replace(/{{contract\.explanation}}/g, explanation || "Convenit de comun acord")
      .replace(/{{contract\.notes}}/g, contractObject || "Lucrările se execută conform anexei.");

    // Replace Parent Contract Variables
    if (parentContract) {
      raw = raw
        .replace(/{{parentContract\.number}}/g, parentContract.number)
        .replace(/{{parentContract\.date}}/g, parentContract.date);
    } else {
      raw = raw
        .replace(/{{parentContract\.number}}/g, "principal")
        .replace(/{{parentContract\.date}}/g, docDate);
    }

    setContentHtml(raw);
  }, [
    activeMode,
    selectedTemplateId,
    templates,
    selectedPartner,
    parentContract,
    tenant,
    docNumber,
    docDate,
    docValue,
    docCurrency,
    paymentTermDays,
    deliveryDays,
    warrantyMonths,
    contractObject,
    explanation,
  ]);

  const createMutation = trpc.contracts.create.useMutation({
    onSuccess: (res) => {
      setLocation(`/contracte/${res.id}`);
    },
    onError: (err) => {
      setErrorMsg("Eroare salvare contract: " + err.message);
    },
  });

  const handleSave = () => {
    if (!docNumber.trim()) {
      setErrorMsg("Numărul documentului este obligatoriu.");
      return;
    }
    if (!docDate.trim()) {
      setErrorMsg("Data documentului este obligatorie.");
      return;
    }

    if (activeMode === "upload" && !uploadedFile) {
      setErrorMsg("Vă rugăm să selectați și să încărcați fișierul PDF al contractului semnat.");
      return;
    }

    setErrorMsg("");

    const title =
      docType === "act_aditional"
        ? `Act Adițional ${docNumber} la Contract ${parentContract?.number || ""}`
        : `${docType === "pv_receptie" ? "Proces Verbal" : "Contract"} ${docNumber} - ${selectedPartner?.name || "Wood Glass"}`;

    createMutation.mutate({
      partnerId: selectedPartnerId,
      parentContractId: parentContractId,
      type: docType,
      title,
      number: docNumber,
      date: docDate,
      validFrom,
      validUntil: validUntil || null,
      value: docValue,
      currency: docCurrency,
      status: docStatus,
      contentHtml: activeMode === "generate" ? contentHtml : null,
      fileUrl: activeMode === "upload" && uploadedFile ? uploadedFile.fileUrl : null,
      fileName: activeMode === "upload" && uploadedFile ? uploadedFile.fileName : null,
      fileSize: activeMode === "upload" && uploadedFile ? uploadedFile.fileSize : null,
      explanation:
        explanation ||
        (activeMode === "upload"
          ? "Contract semnat fizic, arhivat în bibliotecă"
          : "Contract generat digital din sistem"),
    });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "0 KB";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="w-full max-w-full p-3 sm:p-5 space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="h-9 w-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Link href="/contracte">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>

          <div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <FileSignature className="h-6 w-6 text-primary" />
              {activeMode === "upload"
                ? "Încarcă Contract / Act Adițional Semnat"
                : "Generează Contract Nou din Șablon"}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Asociere directă cu baza de clienți și furnizori SAGA Wood Glass SRL
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Button
            variant="outline"
            asChild
            className="rounded-xl border-slate-300 dark:border-slate-700 text-xs"
          >
            <Link href="/contracte">Anulează</Link>
          </Button>

          <Button
            onClick={handleSave}
            disabled={createMutation.isPending || isUploading}
            className="rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-xs shadow-sm"
          >
            {createMutation.isPending ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" />
                Se salvează...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Save className="h-4 w-4" />
                {activeMode === "upload" ? "Salvează & Arhivează PDF" : "Generează & Salvează"}
              </span>
            )}
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-3.5 rounded-2xl text-xs text-rose-700 dark:text-rose-300 font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Mode Switcher Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => {
            setActiveMode("upload");
            setExplanation("Contract semnat fizic, scanat și arhivat în biblioteca digitală Wood Glass");
          }}
          className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs font-bold transition-all ${
            activeMode === "upload"
              ? "bg-white dark:bg-slate-900 text-primary shadow-sm border border-slate-200/80 dark:border-slate-700"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Upload className="h-4 w-4" />
          <span>Am deja contractul semnat (Încarcă PDF / Scanare)</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wider font-extrabold">
            Recomandat
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveMode("generate");
            setExplanation("Contract generat digital din sistem");
          }}
          className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs font-bold transition-all ${
            activeMode === "generate"
              ? "bg-white dark:bg-slate-900 text-primary shadow-sm border border-slate-200/80 dark:border-slate-700"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>Vreau să redactez un document nou (Generează din Șablon)</span>
        </button>
      </div>

      {/* Content Form depending on Mode */}
      {activeMode === "upload" ? (
        /* ═════════════════════════════════════════════════════════════════════
           TAB 1: ÎNCARCĂ CONTRACT SEMNAT (PDF)
           ═════════════════════════════════════════════════════════════════════ */
        <div className="space-y-6">
          {/* File Upload Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`rounded-2xl border-2 border-dashed transition-all p-6 sm:p-8 text-center ${
              isDragging
                ? "border-primary bg-primary/5"
                : uploadedFile
                ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20"
                : "border-slate-300 dark:border-slate-700 bg-card hover:border-primary/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleUploadFile(e.target.files[0]);
                }
              }}
              className="hidden"
            />

            {isUploading ? (
              <div className="flex flex-col items-center justify-center py-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Se încarcă și se analizează contractul...
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Detectare automată număr, dată și CUI partener din conținut
                </p>
              </div>
            ) : uploadedFile ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 max-w-2xl mx-auto p-4 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 shadow-xs">
                <div className="flex items-center gap-3 min-w-0 text-left">
                  <div className="h-11 w-11 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                    <FileCheck className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                      {uploadedFile.fileName}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>Dimensiune: {formatFileSize(uploadedFile.fileSize)}</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Gata pentru arhivare
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-xl text-xs h-8 border-slate-200 dark:border-slate-700"
                  >
                    Înlocuiește Fișier
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setUploadedFile(null)}
                    className="h-8 w-8 text-slate-400 hover:text-rose-500 rounded-xl"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-2">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center mb-3">
                  <FileUp className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Trageți și plasați fișierul PDF aici
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                  Încărcați contractul sau actul adițional semnat (PDF scanat). Sistemul va extrage automat numărul și CUI-ul pentru potrivire instantă cu partenerul.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 rounded-xl text-xs font-semibold border-slate-300 dark:border-slate-700 shadow-xs"
                >
                  <Upload className="h-3.5 w-3.5 mr-2 text-primary" />
                  Alege Fișier PDF de pe Calculator
                </Button>
              </div>
            )}
          </div>

          {/* Partner & Contract Meta Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Pas 1: Match Partener SAGA */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-4 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-primary" />
                  1. Partener Contractual
                </span>
                <span className="text-[10px] text-slate-400 font-normal">
                  {partners.length} în SAGA
                </span>
              </h3>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Caută Client sau Furnizor:
                </label>
                <PartnerCombobox
                  value={selectedPartnerId}
                  onChange={(id) => setSelectedPartnerId(id)}
                  partners={partners as any[]}
                  placeholder="Caută după nume, CUI sau cod..."
                />
              </div>

              {selectedPartner && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-[11px] space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                    <span className="truncate">{selectedPartner.name}</span>
                    {selectedPartner.isSupplier === 1 ? (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        Furnizor
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                        Client
                      </span>
                    )}
                  </div>
                  <div className="text-slate-500 font-mono text-[10px]">
                    CUI: {selectedPartner.cui || "-"} | Cod SAGA: {selectedPartner.sagaCode || "-"}
                  </div>
                  <div className="text-slate-500 truncate text-[10px]">
                    {selectedPartner.city || "-"}, {selectedPartner.address || "-"}
                  </div>
                </div>
              )}
            </div>

            {/* Pas 2: Tip Document & Legătură */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-4 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-primary" />
                2. Tip Document
              </h3>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Clasificare Document:
                </label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger className="rounded-xl text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl text-xs">
                    <SelectItem value="contract">Contract Cadru / Comercial</SelectItem>
                    <SelectItem value="act_aditional">Act Adițional</SelectItem>
                    <SelectItem value="pv_receptie">Proces Verbal Recepție</SelectItem>
                    <SelectItem value="anexa">Anexă Tehnică / Caiet de Sarcini</SelectItem>
                    <SelectItem value="acord">Acord de Confidențialitate (NDA)</SelectItem>
                    <SelectItem value="altul">Alt Document Semnat</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {docType === "act_aditional" && (
                <div>
                  <label className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 block mb-1">
                    Legați de Contractul Principal:
                  </label>
                  <Select
                    value={parentContractId ? String(parentContractId) : ""}
                    onValueChange={(val) => setParentContractId(val ? parseInt(val) : null)}
                  >
                    <SelectTrigger className="rounded-xl text-xs h-9 border-purple-200 dark:border-purple-800">
                      <SelectValue placeholder="Alege contractul principal..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl text-xs">
                      {allContracts
                        .filter(
                          (c: any) =>
                            c.type === "contract" &&
                            (!selectedPartnerId || c.partnerId === selectedPartnerId)
                        )
                        .map((c: any) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.number} — {c.partnerName || "Fără partener"} ({c.date})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Status Document:
                </label>
                <Select
                  value={docStatus}
                  onValueChange={(v) => setDocStatus(v as any)}
                >
                  <SelectTrigger className="rounded-xl text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl text-xs">
                    <SelectItem value="activ">Activ / În vigoare</SelectItem>
                    <SelectItem value="draft">În Verificare / Ciornă</SelectItem>
                    <SelectItem value="expirat">Expirat</SelectItem>
                    <SelectItem value="reziliat">Reziliat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Pas 3: Număr, Date, Valoare */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-4 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-primary" />
                3. Date & Valoare
              </h3>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Număr:
                  </label>
                  <Input
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                    className="h-8 rounded-xl text-xs mt-0.5"
                    placeholder="ex: 145/2026"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Dată Semnare:
                  </label>
                  <Input
                    type="date"
                    value={docDate}
                    onChange={(e) => setDocDate(e.target.value)}
                    className="h-8 rounded-xl text-xs mt-0.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Valabil De La:
                  </label>
                  <Input
                    type="date"
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                    className="h-8 rounded-xl text-xs mt-0.5"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Valabil Până La:
                  </label>
                  <Input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="h-8 rounded-xl text-xs mt-0.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Valoare Contract:
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={docValue}
                    onChange={(e) => setDocValue(e.target.value)}
                    className="h-8 rounded-xl text-xs mt-0.5 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Monedă:
                  </label>
                  <Select value={docCurrency} onValueChange={setDocCurrency}>
                    <SelectTrigger className="h-8 rounded-xl text-xs mt-0.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl text-xs">
                      <SelectItem value="RON">RON</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Audit Note */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-4 shadow-sm">
            <label className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center gap-1.5 mb-1.5">
              Notă Înregistrare / Istoric Audit (salvată timestampat în jurnal):
            </label>
            <Input
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Ex: Contract semnat fizic la sediul clientului, scanat și arhivat în biblioteca Wood Glass..."
              className="rounded-xl text-xs"
            />
          </div>
        </div>
      ) : (
        /* ═════════════════════════════════════════════════════════════════════
           TAB 2: GENEREAZĂ DIN ȘABLON DIGITAL (NO RAW HTML TEXTAREA!)
           ═════════════════════════════════════════════════════════════════════ */
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Parameters Column */}
            <div className="space-y-4">
              {/* Sablon */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-4 shadow-sm space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                  1. Șablon Document
                </h3>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger className="rounded-xl text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl text-xs">
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Partener Combobox */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-4 shadow-sm space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-primary" />
                    2. Partener Contractual
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {partners.length} în SAGA
                  </span>
                </h3>

                <PartnerCombobox
                  value={selectedPartnerId}
                  onChange={(id) => setSelectedPartnerId(id)}
                  partners={partners as any[]}
                  placeholder="Caută după nume, CUI sau cod..."
                />

                {selectedPartner && (
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-[11px] space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                      <span className="truncate">{selectedPartner.name}</span>
                      {selectedPartner.isSupplier === 1 ? (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          Furnizor
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                          Client
                        </span>
                      )}
                    </div>
                    <div className="text-slate-500 font-mono text-[10px]">
                      CUI: {selectedPartner.cui || "-"} | Cod SAGA: {selectedPartner.sagaCode || "-"}
                    </div>
                  </div>
                )}
              </div>

              {/* Parametri Comerciali */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-4 shadow-sm space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-primary" />
                  3. Date Comerciale
                </h3>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Număr:
                    </label>
                    <Input
                      value={docNumber}
                      onChange={(e) => setDocNumber(e.target.value)}
                      className="h-8 rounded-xl text-xs mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Dată:
                    </label>
                    <Input
                      type="date"
                      value={docDate}
                      onChange={(e) => setDocDate(e.target.value)}
                      className="h-8 rounded-xl text-xs mt-0.5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-medium text-slate-600">Scadență (zile):</label>
                    <Input
                      value={paymentTermDays}
                      onChange={(e) => setPaymentTermDays(e.target.value)}
                      className="h-8 rounded-xl text-xs mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-slate-600">Livrare (zile):</label>
                    <Input
                      value={deliveryDays}
                      onChange={(e) => setDeliveryDays(e.target.value)}
                      className="h-8 rounded-xl text-xs mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-slate-600">Garanție (luni):</label>
                    <Input
                      value={warrantyMonths}
                      onChange={(e) => setWarrantyMonths(e.target.value)}
                      className="h-8 rounded-xl text-xs mt-0.5"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Obiectul Contractului / Specificații:
                  </label>
                  <textarea
                    rows={3}
                    value={contractObject}
                    onChange={(e) => setContractObject(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 mt-0.5 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* Right Clean Document Sheet Preview (No raw HTML code!) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-primary" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                      Previzualizare Document Formatat (Format A4)
                    </h3>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    Generare Automată PDF
                  </Badge>
                </div>

                {/* Formatted Paper Sheet View */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-6 sm:p-8 shadow-inner text-slate-800 dark:text-slate-200 text-xs leading-relaxed space-y-4">
                  <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex justify-between items-start">
                    <div>
                      <div className="text-base font-extrabold text-slate-900 dark:text-white uppercase tracking-tight">
                        WOOD GLASS SRL
                      </div>
                      <div className="text-[11px] text-slate-500">
                        CUI: RO28396216 | J08/1314/2011 | Brașov, Str. Automotoarelor 12
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-xs text-primary">{docNumber}</div>
                      <div className="text-[11px] text-slate-500">{docDate}</div>
                    </div>
                  </div>

                  <div className="text-center py-2">
                    <h2 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                      {selectedTemplateId === "act-aditional-modificare"
                        ? "ACT ADIȚIONAL DE MODIFICARE"
                        : "CONTRACT COMERCIAL DE LIVRARE ȘI MONTAJ"}
                    </h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Încheiat astăzi, {docDate}, între părțile contractante:
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-[11px]">
                    <div>
                      <div className="font-bold text-slate-700 dark:text-slate-300 uppercase">Prestator / Furnizor:</div>
                      <div className="font-semibold text-slate-900 dark:text-white">WOOD GLASS SRL</div>
                      <div className="text-slate-500">CUI: RO28396216 | Brașov</div>
                    </div>
                    <div>
                      <div className="font-bold text-slate-700 dark:text-slate-300 uppercase">Beneficiar / Partener:</div>
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {selectedPartner?.name || "[Alegeți partenerul din stânga]"}
                      </div>
                      <div className="text-slate-500">
                        CUI: {selectedPartner?.cui || "-"} | {selectedPartner?.city || "-"}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 text-slate-700 dark:text-slate-300 text-[11px]">
                    <div>
                      <strong className="text-slate-900 dark:text-white">Art. 1 Obiectul contractului: </strong>
                      {contractObject}
                    </div>
                    <div>
                      <strong className="text-slate-900 dark:text-white">Art. 2 Termen de plată și livrare: </strong>
                      Termen de scadență facturi: {paymentTermDays} zile calendaristice. Termen de execuție și livrare: {deliveryDays} zile lucrătoare de la confirmarea măsurătorilor finale.
                    </div>
                    <div>
                      <strong className="text-slate-900 dark:text-white">Art. 3 Garanție: </strong>
                      Garanția pentru montaj și feronerie este de {warrantyMonths} luni, iar garanția pentru pachetele de sticlă termoizolantă este de 36 luni.
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-between text-[11px]">
                    <div>
                      <div className="font-bold">PRESTATOR:</div>
                      <div>WOOD GLASS SRL</div>
                      <div className="text-slate-400 mt-4">[Semnătură & Ștampilă]</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">BENEFICIAR:</div>
                      <div>{selectedPartner?.name || "..."}</div>
                      <div className="text-slate-400 mt-4">[Semnătură & Ștampilă]</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
