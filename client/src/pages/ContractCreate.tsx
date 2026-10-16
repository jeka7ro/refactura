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
  PenTool,
  Edit3,
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
import ContractVisualEditor from "@/components/ContractVisualEditor";

export default function ContractCreate() {
  const [, setLocation] = useLocation();

  // URL search params
  const searchParams = new URLSearchParams(window.location.search);
  const parentContractIdParam = searchParams.get("parentContractId");
  const typeParam = searchParams.get("type");
  const partnerIdParam = searchParams.get("partnerId");
  const modeParam = searchParams.get("mode"); // "editor" | "upload" | "generate"

  // Main Mode: "editor" (Visual rich editor & signatures) OR "upload" (Upload signed PDF) OR "generate" (Template generator)
  const [activeMode, setActiveMode] = useState<"editor" | "upload" | "generate">(
    modeParam === "generate" ? "generate" : modeParam === "upload" ? "upload" : "editor"
  );

  // Queries
  const { data: partners = [], isLoading: loadingPartners } = trpc.clients.list.useQuery();
  const { data: templates = [] } = trpc.contracts.getTemplates.useQuery();
  const { data: allContracts = [] } = trpc.contracts.list.useQuery();
  const { data: tenant } = trpc.tenants.current.useQuery();

  const parsedTenantSettings = useMemo(() => {
    if (!tenant?.settings) return null;
    try {
      return typeof tenant.settings === "string" ? JSON.parse(tenant.settings) : tenant.settings;
    } catch {
      return null;
    }
  }, [tenant?.settings]);

  const activeTenantName = tenant?.name || "Compania Ta";
  const activeTenantCui = tenant?.cui || parsedTenantSettings?.cui || parsedTenantSettings?.fiscalCode || "-";
  const activeTenantRegCom = parsedTenantSettings?.regCom || "-";
  const activeTenantCity = parsedTenantSettings?.city || "";
  const activeTenantAddress = tenant?.address || parsedTenantSettings?.address || "";
  const activeTenantIban = parsedTenantSettings?.iban || "-";
  const activeTenantBank = parsedTenantSettings?.bank || "-";

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
    typeParam === "act_aditional" ? "act-aditional-modificare" : "contract-vanzare-cumparare"
  );
  const [contractObject, setContractObject] = useState<string>(
    "Furnizarea de produse și prestarea de servicii conform comenzilor și specificațiilor tehnice agreate"
  );
  const [paymentTermDays, setPaymentTermDays] = useState<string>("7");
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
      ? "Contract semnat fizic, scanat și arhivat în biblioteca digitală"
      : activeMode === "editor"
      ? "Contract redactat în editorul vizual cu formatare și semnături"
      : "Contract generat digital din sistem"
  );
  const [contentHtml, setContentHtml] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Signatures State
  const [supplierSignature, setSupplierSignature] = useState<string | null>(null);
  const [clientSignature, setClientSignature] = useState<string | null>(null);
  const [signatureType, setSignatureType] = useState<"olografic" | "digital" | "hibrid" | "none">("none");
  const [digitalSignatureMetadata, setDigitalSignatureMetadata] = useState<any>(null);
  const [signedAt, setSignedAt] = useState<string | null>(null);

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

    // Replace Tenant Variables
    raw = raw
      .replace(/{{tenant\.name}}/g, activeTenantName)
      .replace(/{{tenant\.cui}}/g, activeTenantCui)
      .replace(/{{tenant\.regCom}}/g, activeTenantRegCom)
      .replace(/{{tenant\.city}}/g, activeTenantCity)
      .replace(/{{tenant\.address}}/g, activeTenantAddress)
      .replace(/{{tenant\.iban}}/g, activeTenantIban)
      .replace(/{{tenant\.bank}}/g, activeTenantBank);

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

  // Initializare sablon curat pentru Editor Vizual daca e gol
  useEffect(() => {
    if (activeMode === "editor" && !contentHtml) {
      setContentHtml(`
<h2 style="text-align: center; color: #1e3a8a; text-transform: uppercase; font-size: 16px; margin-bottom: 4px;">CONTRACT COMERCIAL DE FURNIZARE ȘI PRESTĂRI SERVICII</h2>
<p style="text-align: center; color: #64748b; font-size: 11px; margin-top: 0;">Nr. <strong>${docNumber}</strong> din data de <strong>${docDate}</strong></p>

<h3 style="color: #1e3a8a; font-size: 13px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 18px;">1. PĂRȚILE CONTRACTANTE</h3>
<p><strong>1.1. PRESTATOR / FURNIZOR:</strong> <strong>${activeTenantName}</strong>, cu sediul în ${activeTenantCity || "România"}, ${activeTenantAddress || "-"}, CUI: <strong>${activeTenantCui}</strong>, Reg. Com.: ${activeTenantRegCom}, Cont IBAN: <strong>${activeTenantIban}</strong>, deschis la ${activeTenantBank}, reprezentată legal prin Administrator,</p>
<p>și</p>
<p><strong>1.2. BENEFICIAR / CLIENT:</strong> <strong>${selectedPartner?.name || "[Selectați Partenerul din antet]"}</strong>, cu sediul în ${selectedPartner?.city || "-"}, ${selectedPartner?.address || "-"}, identificat prin CUI: <strong>${selectedPartner?.cui || "-"}</strong>, Reg. Com.: ${selectedPartner?.regCom || "-"}, reprezentat legal prin Administrator,</p>
<p>au convenit încheierea prezentului contract comercial cu respectarea următoarelor clauze:</p>

<h3 style="color: #1e3a8a; font-size: 13px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 18px;">2. OBIECTUL CONTRACTULUI</h3>
<p>Obiectul contractului îl constituie producția, livrarea de mărfuri/produse și/sau prestarea de servicii, conform comenzilor scrise, ofertelor și specificațiilor tehnice agreate între părți.</p>

<h3 style="color: #1e3a8a; font-size: 13px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 18px;">3. VALOAREA CONTRACTULUI ȘI MODALITĂȚI DE PLATĂ</h3>
<p>Valoarea contractului este de <strong>${docValue} ${docCurrency}</strong> (la care se adaugă TVA conform legii). Plățile se vor efectua prin transfer bancar pe baza facturilor fiscale emise de Prestator, cu termen de scadență de <strong>${paymentTermDays} zile</strong> calendaristice de la data emiterii facturii.</p>

<h3 style="color: #1e3a8a; font-size: 13px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 18px;">4. TERMENE DE LIVRARE ȘI GARANȚIE</h3>
<p>Termenul estimat de livrare este de <strong>${deliveryDays} zile</strong> de la confirmarea comenzii. Perioada de garanție comercială acordată este de <strong>${warrantyMonths} luni</strong> de la data recepției calitative și cantitative.</p>

<h3 style="color: #1e3a8a; font-size: 13px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 18px;">5. LITIGII ȘI DISPOZIȚII FINALE</h3>
<p>Litigiile de orice natură decurgând din derularea prezentului contract se vor soluționa pe cale amiabilă sau de instanțele judecătorești competente de la sediul Prestatorului.</p>
`);
    }
  }, [activeMode, activeTenantName, selectedPartner?.name, docNumber, docDate]);

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
        : `${docType === "pv_receptie" ? "Proces Verbal" : "Contract"} ${docNumber} - ${selectedPartner?.name || activeTenantName}`;

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
      contentHtml: activeMode === "upload" ? null : contentHtml,
      fileUrl: activeMode === "upload" && uploadedFile ? uploadedFile.fileUrl : null,
      fileName: activeMode === "upload" && uploadedFile ? uploadedFile.fileName : null,
      fileSize: activeMode === "upload" && uploadedFile ? uploadedFile.fileSize : null,
      supplierSignature,
      clientSignature,
      signatureType: signatureType !== "none" ? signatureType : undefined,
      digitalSignatureMetadata: digitalSignatureMetadata ? JSON.stringify(digitalSignatureMetadata) : undefined,
      signedAt,
      explanation:
        explanation ||
        (activeMode === "upload"
          ? "Contract semnat fizic, arhivat în bibliotecă"
          : activeMode === "editor"
          ? "Contract redactat în editorul vizual cu formatare și semnătură"
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
              {activeMode === "editor"
                ? "Editor Vizual Contract & Semnătură Olografică / Digitală"
                : activeMode === "upload"
                ? "Încarcă Contract / Act Adițional Semnat"
                : "Generează Contract Nou din Șablon"}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {activeMode === "editor"
                ? `Redactare liberă cu fonturi, culori, copy-paste din Word/Docs și semnături pentru ${activeTenantName}`
                : activeMode === "upload"
                ? `Asociere directă cu baza de parteneri ${activeTenantName}`
                : `Generare document oficial conform șabloanelor pentru ${activeTenantName}`}
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
                {activeMode === "editor"
                  ? "Salvează Contractul Formatat"
                  : activeMode === "upload"
                  ? "Salvează & Arhivează PDF"
                  : "Generează & Salvează"}
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

      {/* Main Mode Switcher Tabs: 3 Optiuni */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => {
            setActiveMode("editor");
            setExplanation("Contract redactat în editorul vizual cu formatare și semnătură");
          }}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-bold transition-all ${
            activeMode === "editor"
              ? "bg-white dark:bg-slate-900 text-primary shadow-sm border border-slate-200/80 dark:border-slate-700"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Edit3 className="h-4 w-4 text-primary" />
          <span>Editor Vizual & Semnătură</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wider font-extrabold">
            Recomandat
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveMode("upload");
            setExplanation("Contract semnat fizic, scanat și arhivat în biblioteca digitală");
          }}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-bold transition-all ${
            activeMode === "upload"
              ? "bg-white dark:bg-slate-900 text-primary shadow-sm border border-slate-200/80 dark:border-slate-700"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Upload className="h-4 w-4 text-emerald-600" />
          <span>Încarcă PDF Semnat Fizic</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveMode("generate");
            setExplanation("Contract generat digital din sistem");
          }}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-bold transition-all ${
            activeMode === "generate"
              ? "bg-white dark:bg-slate-900 text-primary shadow-sm border border-slate-200/80 dark:border-slate-700"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span>Generator Rapid Șabloane</span>
        </button>
      </div>

      {/* Content Form depending on Mode */}
      {activeMode === "editor" ? (
        /* ═════════════════════════════════════════════════════════════════════
           TAB: EDITOR VIZUAL & REDACTARE LIBERĂ (COPY-PASTE / STILURI / SEMNĂTURĂ)
           ═════════════════════════════════════════════════════════════════════ */
        <div className="space-y-6">
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

          {/* Visual Rich Editor Component */}
          <ContractVisualEditor
            value={contentHtml}
            onChange={(html) => setContentHtml(html)}
            tenantName={activeTenantName}
            tenantCui={activeTenantCui}
            tenantIban={activeTenantIban}
            tenantBank={activeTenantBank}
            partnerName={selectedPartner?.name || ""}
            partnerCui={selectedPartner?.cui || ""}
            docNumber={docNumber}
            docDate={docDate}
            docValue={docValue}
            docCurrency={docCurrency}
            onSetDocValue={(val) => setDocValue(val)}
            supplierSignature={supplierSignature}
            clientSignature={clientSignature}
            signatureType={signatureType}
            signedAt={signedAt}
            onUpdateSignatures={(sigs) => {
              if (sigs.supplierSignature !== undefined) setSupplierSignature(sigs.supplierSignature);
              if (sigs.clientSignature !== undefined) setClientSignature(sigs.clientSignature);
              if (sigs.signatureType !== undefined) setSignatureType(sigs.signatureType);
              if (sigs.signedAt !== undefined) setSignedAt(sigs.signedAt);
              if (sigs.metadata !== undefined) setDigitalSignatureMetadata(sigs.metadata);
            }}
          />

          {/* Audit Note */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-4 shadow-sm">
            <label className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center gap-1.5 mb-1.5">
              Notă Înregistrare / Istoric Audit (salvată timestampat în jurnal):
            </label>
            <Input
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Ex: Contract redactat și agreat cu clauze personalizate..."
              className="rounded-xl text-xs"
            />
          </div>
        </div>
      ) : activeMode === "upload" ? (
        /* ═════════════════════════════════════════════════════════════════════
           TAB 2: ÎNCARCĂ CONTRACT SEMNAT (PDF)
           ═════════════════════════════════════════════════════════════════════ */
        <div className="space-y-5">
          {/* Partner & Contract Meta Grid: 1, 2, 3 direct sus */}
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

          {/* Atașează Contract Semnat (PDF scanat sau document original) - Card Compact Sub 1, 2, 3 */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`rounded-2xl border-2 border-dashed transition-all p-4 ${
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
              <div className="flex items-center justify-center gap-3 py-2 text-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                <div className="text-left">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Se încarcă și se analizează contractul...
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Detectare automată număr, dată și CUI partener din fișierul PDF
                  </p>
                </div>
              </div>
            ) : uploadedFile ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-2 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 shadow-xs">
                <div className="flex items-center gap-3 min-w-0 text-left">
                  <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                    <FileCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                      {uploadedFile.fileName}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>Dimensiune: {formatFileSize(uploadedFile.fileSize)}</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Document atașat gata pentru salvare
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
                    className="rounded-xl text-xs h-7.5 px-3 border-slate-200 dark:border-slate-700"
                  >
                    Înlocuiește Fișier
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setUploadedFile(null)}
                    className="h-7.5 w-7.5 text-slate-400 hover:text-rose-500 rounded-xl"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-1 px-2">
                <div className="flex items-center gap-3 text-left">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <FileUp className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Atașează Fișierul Semnat (PDF scanat sau document semnat)</span>
                      <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                        Opțional / Recomandat
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Trageți PDF-ul direct aici sau alegeți fișierul de pe calculator pentru arhivare
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl text-xs font-semibold border-slate-300 dark:border-slate-700 shadow-xs h-8 shrink-0"
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  Alege PDF de pe Calculator
                </Button>
              </div>
            )}
          </div>

          {/* Audit Note */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-4 shadow-sm">
            <label className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center gap-1.5 mb-1.5">
              Notă Înregistrare / Istoric Audit (salvată timestampat în jurnal):
            </label>
            <Input
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Ex: Contract semnat fizic la sediul clientului, scanat și arhivat în bibliotecă..."
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
                        {activeTenantName}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        CUI: {activeTenantCui} {activeTenantRegCom !== "-" ? `| ${activeTenantRegCom}` : ""} {activeTenantAddress ? `| ${activeTenantAddress}` : ""}
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
                        : "CONTRACT COMERCIAL DE FURNIZARE / SERVICII"}
                    </h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Încheiat astăzi, {docDate}, între părțile contractante:
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-[11px]">
                    <div>
                      <div className="font-bold text-slate-700 dark:text-slate-300 uppercase">Prestator / Furnizor:</div>
                      <div className="font-semibold text-slate-900 dark:text-white">{activeTenantName}</div>
                      <div className="text-slate-500">CUI: {activeTenantCui} {activeTenantCity ? `| ${activeTenantCity}` : ""}</div>
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
                      Termen de scadență facturi: {paymentTermDays} zile calendaristice. Termen de execuție și livrare: {deliveryDays} zile lucrătoare de la confirmarea comenzii.
                    </div>
                    <div>
                      <strong className="text-slate-900 dark:text-white">Art. 3 Garanție: </strong>
                      Garanția comercială acordată este de {warrantyMonths} luni de la data recepției.
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-between text-[11px]">
                    <div>
                      <div className="font-bold">PRESTATOR:</div>
                      <div>{activeTenantName}</div>
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
