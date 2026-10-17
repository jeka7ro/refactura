import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  FileSignature,
  FileText,
  Building2,
  Calendar,
  Save,
  Loader2,
  Upload,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Edit3,
  Phone,
  Mail,
  UserCheck,
  Globe,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PartnerCombobox from "@/components/PartnerCombobox";
import ContractVisualEditor from "@/components/ContractVisualEditor";
import { toast } from "sonner";
import { compileContractTemplate, ContractLanguage } from "@/lib/contractCompiler";


export default function ContractCreate() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  // Limbă Contract: "ro" (Română), "en" (Engleză), "ro_en" (Bilingv 2 coloane)
  const [docLanguage, setDocLanguage] = useState<ContractLanguage>("ro");

  // URL search params
  const searchParams = new URLSearchParams(window.location.search);
  const parentContractIdParam = searchParams.get("parentContractId");
  const typeParam = searchParams.get("type");
  const partnerIdParam = searchParams.get("partnerId");
  const modeParam = searchParams.get("mode");

  // Main Mode: "editor" (Visual rich editor & signatures) OR "upload" (Upload signed PDF)
  const [activeMode, setActiveMode] = useState<"editor" | "upload">(
    modeParam === "upload" ? "upload" : "editor"
  );

  // Queries
  const { data: partners = [] } = trpc.clients.list.useQuery();
  const { data: templates = [] } = trpc.contracts.getTemplates.useQuery({ language: docLanguage });
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
  const [docCurrency, setDocCurrency] = useState<string>("EUR");
  const [docStatus, setDocStatus] = useState<"activ" | "draft" | "expirat" | "reziliat">("activ");

  // Template selection
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [contractObject, setContractObject] = useState<string>(
    "Platformă Digitală de Pontaj & Evidență a Muncii GetApp Smart QR conform Art. 119 Codul Muncii"
  );
  const [paymentTermDays, setPaymentTermDays] = useState<string>("7");
  const [deliveryDays, setDeliveryDays] = useState<string>("15");
  const [warrantyMonths, setWarrantyMonths] = useState<string>("24");

  // Parametri comerciali & perioade (opționale și configurabile în timp real de utilizator)
  const [hasTrial, setHasTrial] = useState<boolean>(false);
  const [trialMonths, setTrialMonths] = useState<number>(1);
  const [hasPromo, setHasPromo] = useState<boolean>(true);
  const [promoPrice, setPromoPrice] = useState<string>("3.50");
  const [promoMonths, setPromoMonths] = useState<number>(3);
  const [basePrice, setBasePrice] = useState<string>("4.00");
  const [totalDurationMonths, setTotalDurationMonths] = useState<number>(15);
  const [autoRenewalMonths, setAutoRenewalMonths] = useState<number>(12);

  // Date contact partener (reprezentant legal, telefon, email)
  const [partnerContactName, setPartnerContactName] = useState<string>("");
  const [partnerPhone, setPartnerPhone] = useState<string>("");
  const [partnerEmail, setPartnerEmail] = useState<string>("");

  // Toggle panou setări avansate și parametri comerciali
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

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
  const [explanation, setExplanation] = useState<string>("Contract redactat în editorul vizual");
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

  // Sincronizare inițială automată a datelor de contact când se încarcă sau selectează partenerul
  useEffect(() => {
    if (selectedPartner) {
      if (!partnerContactName && (selectedPartner.contactPerson || selectedPartner.delegat)) {
        setPartnerContactName(selectedPartner.contactPerson || selectedPartner.delegat || "");
      }
      if (!partnerPhone && selectedPartner.phone) {
        setPartnerPhone(selectedPartner.phone);
      }
      if (!partnerEmail && selectedPartner.email) {
        setPartnerEmail(selectedPartner.email);
      }
    }
  }, [selectedPartner]);

  // Helper calcul automat data expirare contract
  const computeValidUntilDate = (startDateStr: string, totalMonths: number, trialMonthsCount: number): string => {
    try {
      const parts = startDateStr.split("-");
      if (parts.length !== 3) return "";
      const y = parseInt(parts[0]);
      const m = parseInt(parts[1]) - 1;
      const d = parseInt(parts[2]);
      const date = new Date(y, m, d);
      date.setMonth(date.getMonth() + totalMonths + trialMonthsCount);
      const resY = date.getFullYear();
      const resM = String(date.getMonth() + 1).padStart(2, "0");
      const resD = String(date.getDate()).padStart(2, "0");
      return `${resY}-${resM}-${resD}`;
    } catch {
      return "";
    }
  };

  // Functie de aplicare sau reincarcare a unui sablon in editor
  const handleApplyTemplate = (
    tmplId: string,
    partnerOverride?: any,
    commercialOverride?: {
      basePrice?: string;
      hasTrial?: boolean;
      trialMonths?: number;
      hasPromo?: boolean;
      promoPrice?: string;
      promoMonths?: number;
      totalDurationMonths?: number;
      autoRenewalMonths?: number;
    },
    contactOverride?: {
      contactName?: string;
      phone?: string;
      email?: string;
    },
    langOverride?: ContractLanguage,
    templatesOverride?: any[]
  ) => {
    setSelectedTemplateId(tmplId);
    const activeLang = langOverride || docLanguage;
    const activeTemplates = templatesOverride || templates;

    if (tmplId === "empty") {
      setContentHtml(`
        <h2 style="text-align: center; color: #0f172a; font-size: 16px; margin-bottom: 4px; text-transform: uppercase;">
          CONTRACT COMERCIAL
        </h2>
        <p style="text-align: center; color: #64748b; font-size: 11px;">Nr. ${docNumber} din data de ${docDate}</p>
        <p>Introduceți clauzele contractuale aici...</p>
      `);
      return;
    }

    const tmpl = activeTemplates.find((t: any) => t.id === tmplId);
    if (!tmpl) return;

    const currentPartner = partnerOverride !== undefined ? partnerOverride : selectedPartner;

    let targetCurrency = docCurrency;
    let targetValue = docValue;
    let targetTerm = paymentTermDays;
    let targetObj = contractObject;
    let targetExplanation = explanation;

    let curBase = commercialOverride?.basePrice !== undefined ? commercialOverride.basePrice : basePrice;
    let curTrial = commercialOverride?.hasTrial !== undefined ? commercialOverride.hasTrial : hasTrial;
    let curTrialM = commercialOverride?.trialMonths !== undefined ? commercialOverride.trialMonths : trialMonths;
    let curPromo = commercialOverride?.hasPromo !== undefined ? commercialOverride.hasPromo : hasPromo;
    let curPromoP = commercialOverride?.promoPrice !== undefined ? commercialOverride.promoPrice : promoPrice;
    let curPromoM = commercialOverride?.promoMonths !== undefined ? commercialOverride.promoMonths : promoMonths;
    let curTotM = commercialOverride?.totalDurationMonths !== undefined ? commercialOverride.totalDurationMonths : totalDurationMonths;
    let curRenM = commercialOverride?.autoRenewalMonths !== undefined ? commercialOverride.autoRenewalMonths : autoRenewalMonths;

    const curContactName = contactOverride?.contactName !== undefined ? contactOverride.contactName : partnerContactName;
    const curPhone = contactOverride?.phone !== undefined ? contactOverride.phone : partnerPhone;
    const curEmail = contactOverride?.email !== undefined ? contactOverride.email : partnerEmail;

    if (!commercialOverride) {
      if (tmplId === "contract-saas-smart-qr") {
        curBase = "4.00";
        curTrial = false;
        curTrialM = 1;
        curPromo = true;
        curPromoP = "3.50";
        curPromoM = 3;
        curTotM = 15;
        curRenM = 12;
        setBasePrice(curBase);
        setHasTrial(curTrial);
        setTrialMonths(curTrialM);
        setHasPromo(curPromo);
        setPromoPrice(curPromoP);
        setPromoMonths(curPromoM);
        setTotalDurationMonths(curTotM);
        setAutoRenewalMonths(curRenM);
      } else if (tmplId === "contract-saas-digital-signage") {
        curBase = "10.00";
        curTrial = false;
        curTrialM = 1;
        curPromo = false;
        curPromoP = "8.00";
        curPromoM = 3;
        curTotM = 12;
        curRenM = 12;
        setBasePrice(curBase);
        setHasTrial(curTrial);
        setTrialMonths(curTrialM);
        setHasPromo(curPromo);
        setPromoPrice(curPromoP);
        setPromoMonths(curPromoM);
        setTotalDurationMonths(curTotM);
        setAutoRenewalMonths(curRenM);
      }
    }

    if (tmplId === "contract-saas-smart-qr") {
      targetCurrency = "EUR";
      targetValue = "0.00";
      targetTerm = "7";
      targetObj = "Platformă Digitală de Pontaj & Evidență a Muncii GetApp Smart QR conform Art. 119 Codul Muncii";
      targetExplanation = "Contract SaaS GetApp Smart QR conform Art. 119 Codul Muncii";
      setDocType("contract");
      setDocCurrency("EUR");
      setPaymentTermDays("7");
      setContractObject(targetObj);
      setExplanation(targetExplanation);
    } else if (tmplId === "contract-saas-digital-signage") {
      targetCurrency = "EUR";
      targetValue = "0.00";
      targetTerm = "7";
      targetObj = "Gestiune și Redare Conținut Digital Signage pe Ecrane TV Smart Displays";
      targetExplanation = "Contract Digital Signage Smart Displays (Ecrane TV & Meniuri Digitale)";
      setDocType("contract");
      setDocCurrency("EUR");
      setPaymentTermDays("7");
      setContractObject(targetObj);
      setExplanation(targetExplanation);
    } else if (tmplId === "act-aditional-modificare") {
      targetExplanation = "Modificare termeni contractuali / tarife / licențe";
      setDocType("act_aditional");
      setExplanation(targetExplanation);
    } else if (tmplId === "pv-receptie-lucrari") {
      setDocType("pv_receptie");
    } else if (tmplId === "contract-vanzare-cumparare") {
      targetCurrency = "RON";
      setDocCurrency("RON");
    }

    if (docDate && curTotM) {
      const calculated = computeValidUntilDate(docDate, curTotM, curTrial ? curTrialM : 0);
      if (calculated) setValidUntil(calculated);
    }

    const compiled = compileContractTemplate({
      rawHtml: tmpl.contentHtml || "",
      tenant,
      tenantSettings: parsedTenantSettings,
      partner: currentPartner,
      partnerContactName: curContactName,
      partnerPhone: curPhone,
      partnerEmail: curEmail,
      docNumber,
      docDate,
      docValue: targetValue,
      docCurrency: targetCurrency,
      paymentTermDays: targetTerm,
      deliveryDays,
      warrantyMonths,
      contractObject: targetObj,
      explanation: targetExplanation,
      parentContract,
      hasTrial: curTrial,
      trialMonths: curTrialM,
      hasPromo: curPromo,
      promoPrice: curPromoP,
      promoMonths: curPromoM,
      basePrice: curBase,
      totalDurationMonths: curTotM,
      autoRenewalMonths: curRenM,
      docLanguage: activeLang,
    });

    setContentHtml(compiled);
  };

  // Schimbare dinamică limbă contract (Română, Engleză, Bilingv 2 coloane)
  const handleLanguageChange = async (newLang: ContractLanguage) => {
    setDocLanguage(newLang);
    try {
      const freshTemplates = await utils.contracts.getTemplates.fetch({ language: newLang });
      if (selectedTemplateId) {
        handleApplyTemplate(
          selectedTemplateId,
          selectedPartner,
          {
            basePrice,
            hasTrial,
            trialMonths,
            hasPromo,
            promoPrice,
            promoMonths,
            totalDurationMonths,
            autoRenewalMonths,
          },
          {
            contactName: partnerContactName,
            phone: partnerPhone,
            email: partnerEmail,
          },
          newLang,
          freshTemplates
        );
      }
    } catch (err) {
      console.error("Error refreshing template language:", err);
    }
  };

  // Gestionare modificare parametri comerciali cu reactivitate live
  const handleCommercialChange = (updates: {
    basePrice?: string;
    hasTrial?: boolean;
    trialMonths?: number;
    hasPromo?: boolean;
    promoPrice?: string;
    promoMonths?: number;
    totalDurationMonths?: number;
    autoRenewalMonths?: number;
  }) => {
    const newBase = updates.basePrice !== undefined ? updates.basePrice : basePrice;
    const newHasTrial = updates.hasTrial !== undefined ? updates.hasTrial : hasTrial;
    const newTrialMonths = updates.trialMonths !== undefined ? updates.trialMonths : trialMonths;
    const newHasPromo = updates.hasPromo !== undefined ? updates.hasPromo : hasPromo;
    const newPromoPrice = updates.promoPrice !== undefined ? updates.promoPrice : promoPrice;
    const newPromoMonths = updates.promoMonths !== undefined ? updates.promoMonths : promoMonths;
    const newDuration = updates.totalDurationMonths !== undefined ? updates.totalDurationMonths : totalDurationMonths;
    const newRenewal = updates.autoRenewalMonths !== undefined ? updates.autoRenewalMonths : autoRenewalMonths;

    if (updates.basePrice !== undefined) setBasePrice(newBase);
    if (updates.hasTrial !== undefined) setHasTrial(newHasTrial);
    if (updates.trialMonths !== undefined) setTrialMonths(newTrialMonths);
    if (updates.hasPromo !== undefined) setHasPromo(newHasPromo);
    if (updates.promoPrice !== undefined) setPromoPrice(newPromoPrice);
    if (updates.promoMonths !== undefined) setPromoMonths(newPromoMonths);
    if (updates.totalDurationMonths !== undefined) setTotalDurationMonths(newDuration);
    if (updates.autoRenewalMonths !== undefined) setAutoRenewalMonths(newRenewal);

    if (docDate && newDuration) {
      const calculatedUntil = computeValidUntilDate(docDate, newDuration, newHasTrial ? newTrialMonths : 0);
      if (calculatedUntil) setValidUntil(calculatedUntil);
    }

    if (selectedTemplateId) {
      handleApplyTemplate(
        selectedTemplateId,
        selectedPartner,
        {
          basePrice: newBase,
          hasTrial: newHasTrial,
          trialMonths: newTrialMonths,
          hasPromo: newHasPromo,
          promoPrice: newPromoPrice,
          promoMonths: newPromoMonths,
          totalDurationMonths: newDuration,
          autoRenewalMonths: newRenewal,
        },
        {
          contactName: partnerContactName,
          phone: partnerPhone,
          email: partnerEmail,
        }
      );
    }
  };

  // Initializare automata a sablonului dedicat pentru tenant
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current || !templates || templates.length === 0) return;

    let defaultId = templates[0].id;
    const isTradeInvest =
      tenant?.id === 1 ||
      (tenant?.cui || "").includes("42322117") ||
      (tenant?.name || "").includes("TRADE INVEST");
    const isWoodGlass =
      tenant?.id === 4 ||
      (tenant?.cui || "").includes("28396216") ||
      (tenant?.name || "").includes("WOOD GLASS");

    if (typeParam === "act_aditional") {
      defaultId = "act-aditional-modificare";
    } else if (isTradeInvest) {
      // Prioritate maxima pentru Trade Invest: GetApp Smart QR
      defaultId = "contract-saas-smart-qr";
    } else if (isWoodGlass) {
      defaultId = "contract-vanzare-cumparare";
    }

    setSelectedTemplateId(defaultId);
    handleApplyTemplate(defaultId);
    initializedRef.current = true;
  }, [templates, tenant, typeParam]);

  // Cand utilizatorul alege un partener din SAGA, actualizam sablonul cu datele partenerului
  const handleSelectPartner = (id: number | null, pOverride?: any) => {
    setSelectedPartnerId(id);
    const p = pOverride || partners.find((item: any) => item.id === id);
    const repName = p?.contactPerson || p?.delegat || "";
    const phoneVal = p?.phone || p?.clientPhone || "";
    const emailVal = p?.email || p?.clientEmail || "";

    setPartnerContactName(repName);
    setPartnerPhone(phoneVal);
    setPartnerEmail(emailVal);

    if (selectedTemplateId) {
      handleApplyTemplate(
        selectedTemplateId,
        p || null,
        {
          basePrice,
          hasTrial,
          trialMonths,
          hasPromo,
          promoPrice,
          promoMonths,
          totalDurationMonths,
          autoRenewalMonths,
        },
        {
          contactName: repName,
          phone: phoneVal,
          email: emailVal,
        }
      );
    }
  };

  // Modificare manuala in timp real a datelor de contact client (reprezentant, telefon, email)
  const handleContactChange = (field: "contactName" | "phone" | "email", value: string) => {
    let nextContact = partnerContactName;
    let nextPhone = partnerPhone;
    let nextEmail = partnerEmail;

    if (field === "contactName") {
      setPartnerContactName(value);
      nextContact = value;
    } else if (field === "phone") {
      setPartnerPhone(value);
      nextPhone = value;
    } else if (field === "email") {
      setPartnerEmail(value);
      nextEmail = value;
    }

    if (selectedTemplateId) {
      handleApplyTemplate(
        selectedTemplateId,
        selectedPartner,
        {
          basePrice,
          hasTrial,
          trialMonths,
          hasPromo,
          promoPrice,
          promoMonths,
          totalDurationMonths,
          autoRenewalMonths,
        },
        {
          contactName: nextContact,
          phone: nextPhone,
          email: nextEmail,
        }
      );
    }
  };

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

        if (f.detectedNumber && (!docNumber || docNumber.startsWith("CTR-"))) {
          setDocNumber(f.detectedNumber);
        }

        if (f.detectedCui && !selectedPartnerId) {
          const cleanSearch = f.detectedCui.replace(/^ro/i, "").trim();
          const match = partners.find((p: any) => {
            const pCui = String(p.cui || "").replace(/^ro/i, "").trim();
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

  const createMutation = trpc.contracts.create.useMutation({
    onSuccess: (res) => {
      toast.success("Contractul a fost salvat cu succes în bibliotecă");
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
      language: docLanguage,
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
          : "Contract redactat și agreat"),
    });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "0 KB";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="w-full max-w-full p-2.5 sm:p-4 space-y-3 pb-12">
      {/* 1. Header Compact: Titlu, Mod de lucru & Butoane Salvare (FARA spatiu pierdut) */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="h-8 w-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Link href="/contracte">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>

          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <FileSignature className="h-4 w-4 text-slate-700 dark:text-slate-300" />
              Redactare & Semnare Contract
            </h1>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {activeTenantName}
            </span>
          </div>
        </div>

        {/* Butoane comutare mod & Salvare in coltul din dreapta */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveMode("editor")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                activeMode === "editor"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Editor & Semnături</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMode("upload")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                activeMode === "upload"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Încarcă PDF Semnat</span>
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            asChild
            className="h-8 rounded-lg text-xs border-slate-300 dark:border-slate-700"
          >
            <Link href="/contracte">Anulează</Link>
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={createMutation.isPending || isUploading}
            className="h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {createMutation.isPending ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Se salvează...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Save className="h-3.5 w-3.5" />
                Salvează Contractul
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Mesaj de eroare inline */}
      {errorMsg && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-2.5 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 2. Panou Principal de Configurare (Curat, Modern, Aerisit) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
        {/* Rândul 1: Cele 2 alegeri primare - Model Contract & Client */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {/* Col 1: Model Contract / Șablon */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" />
                Model Contract (Șablon)
              </label>
              {/* Comutator Rapid Limbă: RO | EN | Bilingv */}
              <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => handleLanguageChange("ro")}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors ${
                    docLanguage === "ro"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                  title="Contract în limba Română"
                >
                  RO
                </button>
                <button
                  type="button"
                  onClick={() => handleLanguageChange("en")}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors ${
                    docLanguage === "en"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                  title="Agreement in English"
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => handleLanguageChange("ro_en")}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors ${
                    docLanguage === "ro_en"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                  title="Contract Bilingv: 2 coloane paralele Română și Engleză"
                >
                  RO + EN (Bilingv)
                </button>
              </div>
            </div>

            <Select
              value={selectedTemplateId}
              onValueChange={(val) => handleApplyTemplate(val)}
            >
              <SelectTrigger className="h-9 rounded-xl text-xs font-semibold border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 overflow-hidden text-left">
                <span className="truncate block font-semibold text-slate-900 dark:text-white">
                  {templates.find((t) => t.id === selectedTemplateId)?.name ||
                    (selectedTemplateId === "empty"
                      ? "Document Liber (Pagină albă / Ciornă)"
                      : "Alege model de contract...")}
                </span>
              </SelectTrigger>
              <SelectContent className="rounded-xl text-xs max-w-[500px]">
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-xs py-2 cursor-pointer">
                    <div className="font-semibold text-slate-900 dark:text-white">{t.name}</div>
                    {t.description && (
                      <div className="text-[11px] text-slate-500 whitespace-normal mt-0.5 leading-snug">
                        {t.description}
                      </div>
                    )}
                  </SelectItem>
                ))}
                <SelectItem value="empty" className="text-xs py-2 text-slate-500 cursor-pointer">
                  Document Liber (Pagină albă / Ciornă)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Col 2: Partener Contractual SAGA */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                Partener (SAGA)
              </label>
              {selectedPartner ? (
                <span className="text-[11px] text-slate-500 font-mono">
                  CUI: {selectedPartner.cui || "-"} {selectedPartner.city ? `• ${selectedPartner.city}` : ""}
                </span>
              ) : (
                <span className="text-[10px] text-slate-400">{partners.length} parteneri disponibili</span>
              )}
            </div>

            <PartnerCombobox
              value={selectedPartnerId}
              onChange={(id, p) => handleSelectPartner(id, p)}
              partners={partners as any[]}
              placeholder="Caută client sau furnizor după nume, CUI sau cod SAGA..."
            />

            {/* Date Contact Client - Apar ordonat și discret DOAR dacă partenerul este ales */}
            {selectedPartner && (
              <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                    Reprezentant:
                  </label>
                  <Input
                    value={partnerContactName}
                    onChange={(e) => handleContactChange("contactName", e.target.value)}
                    placeholder="ex: Ion Popescu"
                    className="h-7 text-xs px-2 rounded-lg bg-slate-50/70 dark:bg-slate-800/60"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                    Telefon:
                  </label>
                  <Input
                    value={partnerPhone}
                    onChange={(e) => handleContactChange("phone", e.target.value)}
                    placeholder="ex: 0722..."
                    className="h-7 text-xs px-2 rounded-lg font-mono bg-slate-50/70 dark:bg-slate-800/60"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                    Email:
                  </label>
                  <Input
                    value={partnerEmail}
                    onChange={(e) => handleContactChange("email", e.target.value)}
                    placeholder="ex: client@..."
                    className="h-7 text-xs px-2 rounded-lg bg-slate-50/70 dark:bg-slate-800/60"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Rândul 2: Bară Compactă Rezumat Document & Buton Personalizare */}
        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Rezumat Rapid: Nr. Contract, Dată, Valabilitate, Tarife */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
              Nr. {docNumber}
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
              Data: {docDate}
            </span>
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
              {hasTrial ? `Probă ${trialMonths}m • ` : ""}
              {hasPromo
                ? `Promo €${promoPrice} (${promoMonths}m) + Bază €${basePrice} (${Math.max(1, totalDurationMonths - promoMonths)}m)`
                : `Tarif €${basePrice} (${totalDurationMonths}m)`}
            </span>
          </div>

          {/* Butoane Acțiune: Reîncarcă Șablon & Toggle Personalizare */}
          <div className="flex items-center gap-2">
            {selectedTemplateId && (
              <button
                type="button"
                onClick={() => handleApplyTemplate(selectedTemplateId)}
                className="text-[11px] text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-medium"
                title="Reîncarcă șablonul original în editor"
              >
                <RefreshCw className="h-3 w-3" /> Reîncarcă
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              className={`text-xs font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all ${
                showAdvancedSettings
                  ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 shadow-xs"
                  : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Personalizează Clauze & Detalii</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvancedSettings ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>

        {/* Panou Extensibil de Setări & Parametri (Se deschide DOAR când este solicitat de utilizator) */}
        {showAdvancedSettings && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 mt-2 space-y-3 bg-slate-50/70 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
            {/* Secțiunea A: Parametri Comerciali & Tarife */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                Clauze Comerciale, Tarife & Durată:
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Preț Bază */}
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase">Preț Bază:</span>
                  <Input
                    type="text"
                    value={basePrice}
                    onChange={(e) => handleCommercialChange({ basePrice: e.target.value })}
                    className="h-6 w-14 rounded text-xs font-mono text-center px-1"
                  />
                  <span className="text-[10px] text-slate-500 font-medium">{docCurrency} / lună</span>
                </div>

                {/* Probă Gratuită */}
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors ${
                    hasTrial
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={hasTrial}
                      onChange={(e) => handleCommercialChange({ hasTrial: e.target.checked })}
                      className="rounded border-slate-300 dark:border-slate-600 text-slate-900 focus:ring-0 h-3.5 w-3.5"
                    />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Probă Gratuită</span>
                  </label>
                  {hasTrial && (
                    <div className="flex items-center gap-1 ml-1 pl-1.5 border-l border-emerald-200 dark:border-emerald-800">
                      <Input
                        type="number"
                        min="1"
                        max="12"
                        value={trialMonths}
                        onChange={(e) => handleCommercialChange({ trialMonths: parseInt(e.target.value) || 1 })}
                        className="h-6 w-11 rounded text-xs font-mono text-center px-1"
                      />
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">luni</span>
                    </div>
                  )}
                </div>

                {/* Tarif Promo */}
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors ${
                    hasPromo
                      ? "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={hasPromo}
                      onChange={(e) => handleCommercialChange({ hasPromo: e.target.checked })}
                      className="rounded border-slate-300 dark:border-slate-600 text-slate-900 focus:ring-0 h-3.5 w-3.5"
                    />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Tarif Promo</span>
                  </label>
                  {hasPromo && (
                    <div className="flex items-center gap-1 ml-1 pl-1.5 border-l border-blue-200 dark:border-blue-800">
                      <Input
                        type="text"
                        value={promoPrice}
                        onChange={(e) => handleCommercialChange({ promoPrice: e.target.value })}
                        className="h-6 w-14 rounded text-xs font-mono text-center px-1"
                      />
                      <span className="text-[10px] text-blue-700 dark:text-blue-400 font-medium">{docCurrency} primele</span>
                      <Input
                        type="number"
                        min="1"
                        max="12"
                        value={promoMonths}
                        onChange={(e) => handleCommercialChange({ promoMonths: parseInt(e.target.value) || 1 })}
                        className="h-6 w-11 rounded text-xs font-mono text-center px-1"
                      />
                      <span className="text-[10px] text-blue-700 dark:text-blue-400 font-medium">luni</span>
                    </div>
                  )}
                </div>

                {/* Durată & Prelungire */}
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase">Durată:</span>
                  <Input
                    type="number"
                    min="1"
                    max="60"
                    value={totalDurationMonths}
                    onChange={(e) => handleCommercialChange({ totalDurationMonths: parseInt(e.target.value) || 12 })}
                    className="h-6 w-12 rounded text-xs font-mono text-center px-1"
                  />
                  <span className="text-[10px] text-slate-500 font-medium">luni</span>
                  <span className="text-slate-300 dark:text-slate-600">|</span>
                  <span className="text-[10px] text-slate-500 font-medium">Prelungire:</span>
                  <Input
                    type="number"
                    min="1"
                    max="36"
                    value={autoRenewalMonths}
                    onChange={(e) => handleCommercialChange({ autoRenewalMonths: parseInt(e.target.value) || 12 })}
                    className="h-6 w-12 rounded text-xs font-mono text-center px-1"
                  />
                  <span className="text-[10px] text-slate-500 font-medium">luni</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleCommercialChange({})}
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 border border-slate-300 dark:border-slate-700 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-50 transition-colors ml-auto shadow-xs"
                  title="Sincronizează clauzele din contract cu noile valori"
                >
                  <RefreshCw className="h-3 w-3" /> Sincronizează Clauze
                </button>
              </div>
            </div>

            {/* Secțiunea B: Detalii Trasabilitate & Document */}
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
              <div>
                <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">Tip Document:</label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger className="h-8 rounded-lg text-xs bg-white dark:bg-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl text-xs">
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="act_aditional">Act Adițional</SelectItem>
                    <SelectItem value="pv_receptie">Proces Verbal</SelectItem>
                    <SelectItem value="anexa">Anexă</SelectItem>
                    <SelectItem value="acord">Acord / NDA</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">Număr Document:</label>
                <Input
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  className="h-8 rounded-lg text-xs font-mono px-2 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">Dată Încheiere:</label>
                <Input
                  type="date"
                  value={docDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDocDate(val);
                    if (val && totalDurationMonths) {
                      const calculated = computeValidUntilDate(val, totalDurationMonths, hasTrial ? trialMonths : 0);
                      if (calculated) setValidUntil(calculated);
                    }
                  }}
                  className="h-8 rounded-lg text-xs px-2 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">Valabil Până La:</label>
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="h-8 rounded-lg text-xs px-2 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">Termen Plată:</label>
                <div className="flex items-center gap-1">
                  <Input
                    type="text"
                    value={paymentTermDays}
                    onChange={(e) => setPaymentTermDays(e.target.value)}
                    className="h-8 rounded-lg text-xs font-mono px-2 text-center bg-white dark:bg-slate-800"
                  />
                  <span className="text-[11px] text-slate-500 font-medium">zile</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">Status:</label>
                <Select value={docStatus} onValueChange={(v) => setDocStatus(v as any)}>
                  <SelectTrigger className="h-8 rounded-lg text-xs bg-white dark:bg-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl text-xs">
                    <SelectItem value="activ">Activ</SelectItem>
                    <SelectItem value="draft">Ciornă</SelectItem>
                    <SelectItem value="expirat">Expirat</SelectItem>
                    <SelectItem value="reziliat">Reziliat</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 sm:col-span-3 md:col-span-6">
                <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">Notă / Explicație în Jurnal:</label>
                <Input
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  className="h-8 rounded-lg text-xs px-2 bg-white dark:bg-slate-800"
                  placeholder="Ex: Contract SaaS agreat conform Art. 119..."
                />
              </div>
            </div>
          </div>
        )}

        {/* Rând adițional doar dacă este Act Adițional (Legați de Contractul Principal) */}
        {docType === "act_aditional" && (
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-400 shrink-0">
              Contract Principal de Bază:
            </span>
            <Select
              value={parentContractId ? String(parentContractId) : ""}
              onValueChange={(val) => setParentContractId(val ? parseInt(val) : null)}
            >
              <SelectTrigger className="h-7 rounded-lg text-xs max-w-md">
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
      </div>

      {/* 3. Conținut principal în funcție de mod */}
      {activeMode === "editor" ? (
        /* Modul 1: Editor Vizual Contract & Semnături (Imediat sub bara de comandă, fără spațiu pierdut) */
        <div className="space-y-3">
          <ContractVisualEditor
            key={selectedTemplateId}
            value={contentHtml}
            onChange={(html) => setContentHtml(html)}
            tenantName={activeTenantName}
            tenantCui={activeTenantCui}
            tenantIban={activeTenantIban}
            tenantBank={activeTenantBank}
            partnerName={selectedPartner?.name || selectedPartner?.clientName || ""}
            partnerCui={selectedPartner?.cui || selectedPartner?.clientCUI || ""}
            partnerContactName={partnerContactName}
            partnerPhone={partnerPhone}
            partnerEmail={partnerEmail}
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

          {/* Notă Înregistrare Jurnal de Audit */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 shadow-xs flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 shrink-0">
              Notă Audit:
            </span>
            <Input
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Ex: Contract agreat și semnat cu specificații complete..."
              className="h-7 rounded-lg text-xs"
            />
          </div>
        </div>
      ) : (
        /* Modul 2: Încarcă PDF Semnat Fizic */
        <div className="space-y-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`rounded-xl border-2 border-dashed transition-all p-6 text-center ${
              isDragging
                ? "border-slate-900 bg-slate-50 dark:bg-slate-800"
                : uploadedFile
                ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50/20"
                : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-400"
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
              <div className="flex items-center justify-center gap-3 py-4 text-center">
                <Loader2 className="h-5 w-5 animate-spin text-slate-700 dark:text-slate-300 shrink-0" />
                <div className="text-left">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Se încarcă și se analizează contractul PDF...
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Detectare automată număr, dată și CUI partener
                  </p>
                </div>
              </div>
            ) : uploadedFile ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-3 min-w-0 text-left">
                  <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
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
                        Document atașat și validat
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg text-xs"
                >
                  Înlocuiește fișier
                </Button>
              </div>
            ) : (
              <div className="py-6 space-y-2">
                <Upload className="h-8 w-8 mx-auto text-slate-400" />
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  Trageți fișierul PDF al contractului semnat aici sau faceți click pentru a selecta
                </h4>
                <p className="text-[11px] text-slate-500">
                  Acceptat: PDF scanat sau document digital semnat (max 25 MB)
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg text-xs bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 mt-2"
                >
                  Selectează Fișier PDF
                </Button>
              </div>
            )}
          </div>

          {/* Notă Înregistrare Jurnal de Audit */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 shadow-xs flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 shrink-0">
              Notă Arhivare:
            </span>
            <Input
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Ex: Contract semnat fizic, scanat și arhivat..."
              className="h-7 rounded-lg text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}
