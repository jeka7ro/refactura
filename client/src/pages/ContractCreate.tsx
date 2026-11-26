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
import PartnerCombobox, { inferClientType } from "@/components/PartnerCombobox";
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

  const isTradeInvestTenant = !!(
    tenant?.id === 1 ||
    String(tenant?.cui || "").includes("42322117") ||
    tenant?.name?.toLowerCase().includes("trade invest")
  );
  const isWoodGlassTenant = !!(
    tenant?.id === 4 ||
    String(tenant?.cui || "").includes("28396216") ||
    tenant?.name?.toLowerCase().includes("wood glass")
  );
  const activeTenantName = tenant?.name || "Compania Ta";
  const activeTenantCui =
    tenant?.cui ||
    parsedTenantSettings?.cui ||
    parsedTenantSettings?.fiscalCode ||
    (isTradeInvestTenant ? "RO42322117" : isWoodGlassTenant ? "RO28396216" : "-");
  const activeTenantRegCom =
    parsedTenantSettings?.regCom ||
    (isTradeInvestTenant ? "J2020002825409" : isWoodGlassTenant ? "J2011000729084" : "") ||
    "-";
  const activeTenantCity =
    parsedTenantSettings?.city ||
    (isWoodGlassTenant ? "Brașov" : isTradeInvestTenant ? "București" : "");
  const activeTenantAddress =
    tenant?.address ||
    parsedTenantSettings?.address ||
    (isWoodGlassTenant ? "Str. Zizinului nr. 625" : "");
  const activeTenantIban =
    parsedTenantSettings?.iban ||
    (isTradeInvestTenant
      ? "RO31BACX0000001999343001"
      : isWoodGlassTenant
      ? "RO43INGB0000999915654676"
      : "-");
  const activeTenantBank =
    parsedTenantSettings?.bank ||
    (isTradeInvestTenant ? "Unicredit Bank" : isWoodGlassTenant ? "ING Brașov" : "-");
  const activeTenantRepresentative =
    parsedTenantSettings?.delegat ||
    parsedTenantSettings?.representative ||
    (isWoodGlassTenant ? "Șaran Vitalie" : isTradeInvestTenant ? "Elena Cazmal" : "Administrator");

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
  const [contractObject, setContractObject] = useState<string>("");
  const [paymentTermDays, setPaymentTermDays] = useState<string>("7");
  const [deliveryDays, setDeliveryDays] = useState<string>("60");
  const [warrantyMonths, setWarrantyMonths] = useState<string>("36");

  // Parametri specifici Wood Glass (Model Oficial 364 — Contract Tip)
  const [woodEssence, setWoodEssence] = useState<string>("Tâmplărie lemn stratificat, esență meranti, 68 mm");
  const [wgCarpentryCategory, setWgCarpentryCategory] = useState<"lemn" | "aluminiu" | "pvc">("lemn");
  const [wgWoodOption, setWgWoodOption] = useState<string>("meranti_68");
  const [wgCustomCarpentryText, setWgCustomCarpentryText] = useState<string>("");
  const [wgTransportIncluded, setWgTransportIncluded] = useState<"da" | "nu">("da");
  const [wgMarketType, setWgMarketType] = useState<"intern" | "extern">("extern");
  const [wgBeneficiaryType, setWgBeneficiaryType] = useState<"pf" | "pj">("pj");
  const [offerNumber, setOfferNumber] = useState<string>("4089");
  const [offerDate, setOfferDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [warrantyYears, setWarrantyYears] = useState<string>("3");
  const [paymentTranches, setPaymentTranches] = useState<"50-40-10" | "50-50">("50-50");

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
    detectedDate?: string | null;
    detectedValue?: string | null;
    detectedCurrency?: string | null;
    detectedPartnerName?: string | null;
    detectedOfferNumber?: string | null;
    detectedOfferDate?: string | null;
    detectedWoodEssence?: string | null;
    extractedHtml?: string | null;
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

  const [partnerEnrichment, setPartnerEnrichment] = useState<{ id: number | string; regCom?: string } | null>(null);

  // Selected Partner Details cu fallback și auto-îmbogățire Reg. Com.
  const selectedPartner: any = useMemo(() => {
    const p: any = partners.find((item: any) => item.id === selectedPartnerId);
    if (!p) return null;
    let regCom = p.regCom || p.clientRegCom || "";
    if (!regCom && partnerEnrichment && partnerEnrichment.id === p.id && partnerEnrichment.regCom) {
      regCom = partnerEnrichment.regCom;
    }
    if (!regCom && p.cui) {
      const cleanCui = String(p.cui).replace(/^RO/i, "").trim();
      const sibling: any = partners.find(
        (item: any) =>
          item.id !== p.id &&
          String(item.cui || "").replace(/^RO/i, "").trim() === cleanCui &&
          !!(item.regCom || item.clientRegCom)
      );
      if (sibling?.regCom || sibling?.clientRegCom) {
        regCom = sibling.regCom || sibling.clientRegCom;
      }
    }
    if (regCom && (!p.regCom || p.regCom !== regCom)) {
      return { ...p, regCom };
    }
    return p;
  }, [partners, selectedPartnerId, partnerEnrichment]);

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

  // Auto-enrichment ANAF pentru Reg. Com. dacă partenerul nu are încă J în baza de date locală
  useEffect(() => {
    if (!selectedPartner || selectedPartner.regCom || !selectedPartner.cui) return;
    const cleanCui = String(selectedPartner.cui).replace(/^RO/i, "").trim();
    if (!cleanCui || !/^\d{2,10}$/.test(cleanCui)) return;

    let isMounted = true;
    fetch(`/api/anaf/${cleanCui}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted) return;
        if (data?.nrRegCom) {
          setPartnerEnrichment({ id: selectedPartner.id, regCom: data.nrRegCom });
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [selectedPartner?.id, selectedPartner?.cui, selectedPartner?.regCom]);

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
      // Wood Glass overrides
      woodEssence?: string;
      offerNumber?: string;
      offerDate?: string;
      warrantyYears?: string;
      paymentTranches?: "50-40-10" | "50-50";
      wgTransportIncluded?: "da" | "nu";
      wgMarketType?: "intern" | "extern";
      wgBeneficiaryType?: "pf" | "pj";
      deliveryDays?: string;
      docValue?: string;
      docCurrency?: string;
      docNumber?: string;
      docDate?: string;
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

    const curDocNumber = commercialOverride?.docNumber !== undefined ? commercialOverride.docNumber : docNumber;
    const curDocDate = commercialOverride?.docDate !== undefined ? commercialOverride.docDate : docDate;

    if (tmplId === "empty") {
      setContentHtml(`
        <h2 style="text-align: center; color: #0f172a; font-size: 16px; margin-bottom: 4px; text-transform: uppercase;">
          CONTRACT COMERCIAL
        </h2>
        <p style="text-align: center; color: #64748b; font-size: 11px;">Nr. ${curDocNumber} din data de ${curDocDate}</p>
        <p>Introduceți clauzele contractuale aici...</p>
      `);
      return;
    }

    const tmpl = activeTemplates.find((t: any) => t.id === tmplId);
    if (!tmpl) return;

    const currentPartner = partnerOverride !== undefined ? partnerOverride : selectedPartner;

    let targetCurrency = commercialOverride?.docCurrency !== undefined ? commercialOverride.docCurrency : docCurrency;
    let targetValue = commercialOverride?.docValue !== undefined ? commercialOverride.docValue : docValue;
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

    let curWoodEssence = commercialOverride?.woodEssence !== undefined ? commercialOverride.woodEssence : woodEssence;
    let curOfferNumber = commercialOverride?.offerNumber !== undefined ? commercialOverride.offerNumber : offerNumber;
    let curOfferDate = commercialOverride?.offerDate !== undefined ? commercialOverride.offerDate : offerDate;
    let curWarrantyYears = commercialOverride?.warrantyYears !== undefined ? commercialOverride.warrantyYears : warrantyYears;
    let curPaymentTranches = commercialOverride?.paymentTranches !== undefined ? commercialOverride.paymentTranches : paymentTranches;
    let curWgTransport = commercialOverride?.wgTransportIncluded !== undefined ? commercialOverride.wgTransportIncluded : wgTransportIncluded;
    let curWgMarket = commercialOverride?.wgMarketType !== undefined ? commercialOverride.wgMarketType : wgMarketType;
    let curWgBeneficiary = commercialOverride?.wgBeneficiaryType !== undefined ? commercialOverride.wgBeneficiaryType : wgBeneficiaryType;
    let curDeliveryDays = commercialOverride?.deliveryDays !== undefined ? commercialOverride.deliveryDays : deliveryDays;

    const curContactName = contactOverride?.contactName !== undefined ? contactOverride.contactName : partnerContactName;
    const curPhone = contactOverride?.phone !== undefined ? contactOverride.phone : partnerPhone;
    const curEmail = contactOverride?.email !== undefined ? contactOverride.email : partnerEmail;

    if (!commercialOverride) {
      if (tmplId === "contract-woodglass-tip" || tmplId === "contract-woodglass-intern" || tmplId === "contract-woodglass-extern") {
        curDeliveryDays = "60";
        curWarrantyYears = "3";
        targetObj = curWoodEssence;
        targetExplanation = "Contract Tip Vânzare-Cumpărare Tâmplărie — S.C. WOOD GLASS S.R.L. (Model 364)";
        setDeliveryDays(curDeliveryDays);
        setWarrantyYears(curWarrantyYears);
        setDocType("contract");
        setContractObject(targetObj);
        setExplanation(targetExplanation);
      } else if (tmplId === "contract-saas-smart-qr") {
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
      targetExplanation = isWoodGlassTenant
        ? "Modificare ofertă tehnică / dimensiuni tâmplărie / valoare contract"
        : "Modificare termeni contractuali / tarife";
      setDocType("act_aditional");
      setExplanation(targetExplanation);
    } else if (tmplId === "pv-receptie-lucrari") {
      setDocType("pv_receptie");
    } else if (tmplId === "contract-vanzare-cumparare" || tmplId === "contract-cadru-general") {
      setDocType("contract");
    }

    if (curDocDate && curTotM && !isWoodGlassTenant) {
      const calculated = computeValidUntilDate(curDocDate, curTotM, curTrial ? curTrialM : 0);
      if (calculated) setValidUntil(calculated);
    }

    const compiled = compileContractTemplate({
      rawHtml: tmpl.contentHtml || "",
      tenant,
      tenantSettings: {
        ...parsedTenantSettings,
        cui: activeTenantCui,
        regCom: activeTenantRegCom,
        iban: activeTenantIban,
        bank: activeTenantBank,
        delegat: activeTenantRepresentative,
      },
      partner: currentPartner,
      partnerContactName: curContactName,
      partnerPhone: curPhone,
      partnerEmail: curEmail,
      docNumber: curDocNumber,
      docDate: curDocDate,
      docValue: targetValue,
      docCurrency: targetCurrency,
      paymentTermDays: targetTerm,
      deliveryDays: curDeliveryDays,
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
      woodEssence: curWoodEssence,
      offerNumber: curOfferNumber,
      offerDate: curOfferDate,
      warrantyYears: curWarrantyYears,
      paymentTranches: curPaymentTranches,
      wgTransportIncluded: curWgTransport,
      wgMarketType: curWgMarket,
      wgBeneficiaryType: curWgBeneficiary,
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
            woodEssence,
            offerNumber,
            offerDate,
            warrantyYears,
            paymentTranches,
            wgTransportIncluded,
            wgMarketType,
            wgBeneficiaryType,
            deliveryDays,
            docValue,
            docCurrency,
            docNumber,
            docDate,
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
    woodEssence?: string;
    offerNumber?: string;
    offerDate?: string;
    warrantyYears?: string;
    paymentTranches?: "50-40-10" | "50-50";
    wgTransportIncluded?: "da" | "nu";
    wgMarketType?: "intern" | "extern";
    wgBeneficiaryType?: "pf" | "pj";
    deliveryDays?: string;
    docValue?: string;
    docCurrency?: string;
    docNumber?: string;
    docDate?: string;
  }) => {
    const newBase = updates.basePrice !== undefined ? updates.basePrice : basePrice;
    const newHasTrial = updates.hasTrial !== undefined ? updates.hasTrial : hasTrial;
    const newTrialMonths = updates.trialMonths !== undefined ? updates.trialMonths : trialMonths;
    const newHasPromo = updates.hasPromo !== undefined ? updates.hasPromo : hasPromo;
    const newPromoPrice = updates.promoPrice !== undefined ? updates.promoPrice : promoPrice;
    const newPromoMonths = updates.promoMonths !== undefined ? updates.promoMonths : promoMonths;
    const newDuration = updates.totalDurationMonths !== undefined ? updates.totalDurationMonths : totalDurationMonths;
    const newRenewal = updates.autoRenewalMonths !== undefined ? updates.autoRenewalMonths : autoRenewalMonths;

    const newWoodEssence = updates.woodEssence !== undefined ? updates.woodEssence : woodEssence;
    const newOfferNumber = updates.offerNumber !== undefined ? updates.offerNumber : offerNumber;
    const newOfferDate = updates.offerDate !== undefined ? updates.offerDate : offerDate;
    const newWarrantyYears = updates.warrantyYears !== undefined ? updates.warrantyYears : warrantyYears;
    const newPaymentTranches = updates.paymentTranches !== undefined ? updates.paymentTranches : paymentTranches;
    const newWgTransport = updates.wgTransportIncluded !== undefined ? updates.wgTransportIncluded : wgTransportIncluded;
    const newWgMarket = updates.wgMarketType !== undefined ? updates.wgMarketType : wgMarketType;
    const newWgBeneficiary = updates.wgBeneficiaryType !== undefined ? updates.wgBeneficiaryType : wgBeneficiaryType;
    const newDeliveryDays = updates.deliveryDays !== undefined ? updates.deliveryDays : deliveryDays;
    const newDocValue = updates.docValue !== undefined ? updates.docValue : docValue;
    const newDocCurrency = updates.docCurrency !== undefined ? updates.docCurrency : docCurrency;
    const newDocNumber = updates.docNumber !== undefined ? updates.docNumber : docNumber;
    const newDocDate = updates.docDate !== undefined ? updates.docDate : docDate;

    if (updates.basePrice !== undefined) setBasePrice(newBase);
    if (updates.hasTrial !== undefined) setHasTrial(newHasTrial);
    if (updates.trialMonths !== undefined) setTrialMonths(newTrialMonths);
    if (updates.hasPromo !== undefined) setHasPromo(newHasPromo);
    if (updates.promoPrice !== undefined) setPromoPrice(newPromoPrice);
    if (updates.promoMonths !== undefined) setPromoMonths(newPromoMonths);
    if (updates.totalDurationMonths !== undefined) setTotalDurationMonths(newDuration);
    if (updates.autoRenewalMonths !== undefined) setAutoRenewalMonths(newRenewal);

    if (updates.woodEssence !== undefined) {
      setWoodEssence(newWoodEssence);
      setContractObject(newWoodEssence);
    }
    if (updates.offerNumber !== undefined) setOfferNumber(newOfferNumber);
    if (updates.offerDate !== undefined) setOfferDate(newOfferDate);
    if (updates.warrantyYears !== undefined) setWarrantyYears(newWarrantyYears);
    if (updates.paymentTranches !== undefined) setPaymentTranches(newPaymentTranches);
    if (updates.wgTransportIncluded !== undefined) setWgTransportIncluded(newWgTransport);
    if (updates.wgMarketType !== undefined) setWgMarketType(newWgMarket);
    if (updates.wgBeneficiaryType !== undefined) setWgBeneficiaryType(newWgBeneficiary);
    if (updates.deliveryDays !== undefined) setDeliveryDays(newDeliveryDays);
    if (updates.docValue !== undefined) setDocValue(newDocValue);
    if (updates.docCurrency !== undefined) setDocCurrency(newDocCurrency);
    if (updates.docNumber !== undefined) setDocNumber(newDocNumber);
    if (updates.docDate !== undefined) setDocDate(newDocDate);

    if (newDocDate && newDuration && !isWoodGlassTenant) {
      const calculatedUntil = computeValidUntilDate(newDocDate, newDuration, newHasTrial ? newTrialMonths : 0);
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
          woodEssence: newWoodEssence,
          offerNumber: newOfferNumber,
          offerDate: newOfferDate,
          warrantyYears: newWarrantyYears,
          paymentTranches: newPaymentTranches,
          wgTransportIncluded: newWgTransport,
          wgMarketType: newWgMarket,
          wgBeneficiaryType: newWgBeneficiary,
          deliveryDays: newDeliveryDays,
          docValue: newDocValue,
          docCurrency: newDocCurrency,
          docNumber: newDocNumber,
          docDate: newDocDate,
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
    if (initializedRef.current || !templates || templates.length === 0 || !tenant) return;

    let defaultId = templates[0].id;
    const isTradeInvest =
      tenant?.id === 1 ||
      (tenant?.cui || "").includes("42322117") ||
      (tenant?.name || "").includes("TRADE INVEST");
    const isWoodGlass =
      tenant?.id === 4 ||
      (tenant?.cui || "").includes("28396216") ||
      (tenant?.name || "").includes("WOOD GLASS");

    let initialDocNumber = docNumber;
    if (isWoodGlass && docNumber.startsWith("CTR-")) {
      const maxNum = allContracts.reduce((acc: number, c: any) => {
        const n = parseInt(String(c.number || "").replace(/\D/g, ""), 10);
        return !isNaN(n) && n < 10000 && n > acc ? n : acc;
      }, 393);
      initialDocNumber = String(maxNum + 1);
      setDocNumber(initialDocNumber);
      setValidUntil("");
    }

    if (typeParam === "act_aditional") {
      defaultId = "act-aditional-modificare";
    } else if (isWoodGlass) {
      defaultId = "contract-woodglass-tip";
    } else if (isTradeInvest) {
      // Prioritate maxima pentru Trade Invest: GetApp Smart QR
      defaultId = "contract-saas-smart-qr";
    }

    setSelectedTemplateId(defaultId);
    handleApplyTemplate(defaultId, undefined, isWoodGlass ? { docNumber: initialDocNumber } : undefined);
    initializedRef.current = true;
  }, [templates, tenant, typeParam, allContracts]);

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

    // Wood Glass: tipul beneficiarului (PF / PJ) se stabilește automat din datele clientului
    const inferredType = p ? inferClientType(p) : wgBeneficiaryType;
    if (isWoodGlassTenant && p) setWgBeneficiaryType(inferredType);

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
          woodEssence,
          offerNumber,
          offerDate,
          warrantyYears,
          paymentTranches,
          wgTransportIncluded,
          wgMarketType,
          wgBeneficiaryType: inferredType,
          deliveryDays,
          docValue,
          docCurrency,
          docNumber,
          docDate,
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
          woodEssence,
          offerNumber,
          offerDate,
          warrantyYears,
          paymentTranches,
          wgTransportIncluded,
          wgMarketType,
          wgBeneficiaryType,
          deliveryDays,
          docValue,
          docCurrency,
          docNumber,
          docDate,
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
    if (!/\.(pdf|docx|doc)$/i.test(file.name)) {
      setErrorMsg("Sunt acceptate doar fișiere în format PDF sau Word (.docx / .doc).");
      return;
    }

    setIsUploading(true);
    setErrorMsg("");

    const formData = new FormData();
    formData.append("files", file);

    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch("/api/upload-contract", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        throw new Error(`Eroare server (${res.status}) la încărcarea documentului`);
      }

      if (!res.ok) {
        throw new Error(data.error || "Eroare la încărcarea fișierului");
      }

      if (data.files && data.files.length > 0) {
        const f = data.files[0];
        setUploadedFile(f);

        if (f.detectedNumber) {
          setDocNumber(f.detectedNumber);
        }
        if (f.detectedDate) {
          setDocDate(f.detectedDate);
          setValidFrom(f.detectedDate);
        }
        if (f.detectedValue) {
          setDocValue(f.detectedValue);
        }
        if (f.detectedCurrency) {
          setDocCurrency(f.detectedCurrency);
        }
        if (f.detectedOfferNumber) {
          setOfferNumber(f.detectedOfferNumber);
        }
        if (f.detectedOfferDate) {
          setOfferDate(f.detectedOfferDate);
        }
        if (f.detectedWoodEssence) {
          setWoodEssence(f.detectedWoodEssence);
        }
        if (f.extractedHtml) {
          setContentHtml(f.extractedHtml);
        }

        let matchedPartner: any = null;
        if (f.detectedCui) {
          const cleanSearch = f.detectedCui.replace(/^ro/i, "").trim().toUpperCase();
          matchedPartner = partners.find((p: any) => {
            const pCui = String(p.cui || "").replace(/^ro/i, "").trim().toUpperCase();
            return pCui && pCui === cleanSearch;
          });
        }
        if (!matchedPartner && f.detectedPartnerName) {
          const normName = f.detectedPartnerName.toLowerCase().trim();
          matchedPartner = partners.find(
            (p: any) =>
              p.name &&
              (p.name.toLowerCase().includes(normName) || normName.includes(p.name.toLowerCase()))
          );
        }
        if (matchedPartner) {
          setSelectedPartnerId(matchedPartner.id);
        }

        toast.success(
          `Documentul „${f.fileName}” a fost analizat: Nr. ${f.detectedNumber || docNumber}${
            f.detectedPartnerName ? ` • ${f.detectedPartnerName}` : ""
          }${f.detectedValue ? ` • ${f.detectedValue} ${f.detectedCurrency || docCurrency}` : ""}`
        );
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Eroare la upload document.");
      toast.error(err.message || "Eroare la upload document.");
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
      setErrorMsg("Vă rugăm să selectați și să încărcați fișierul PDF sau Word al contractului.");
      return;
    }

    setErrorMsg("");

    const resolvedPartnerLabel =
      selectedPartner?.name || uploadedFile?.detectedPartnerName || activeTenantName;

    const title =
      docType === "act_aditional"
        ? `Act Adițional ${docNumber} la Contract ${parentContract?.number || ""}`
        : `${docType === "pv_receptie" ? "Proces Verbal" : "Contract"} Nr. ${docNumber} — ${resolvedPartnerLabel}`;

    createMutation.mutate({
      partnerId: selectedPartnerId,
      partnerName: uploadedFile?.detectedPartnerName || null,
      partnerCui: uploadedFile?.detectedCui || null,
      parentContractId: parentContractId,
      type: docType,
      title,
      number: docNumber,
      date: docDate,
      validFrom,
      validUntil: isWoodGlassTenant ? null : validUntil || null,
      value: docValue,
      currency: docCurrency,
      language: docLanguage,
      status: docStatus,
      contentHtml: uploadedFile?.extractedHtml || contentHtml || null,
      fileUrl: uploadedFile ? uploadedFile.fileUrl : null,
      fileName: uploadedFile ? uploadedFile.fileName : null,
      fileSize: uploadedFile ? uploadedFile.fileSize : null,
      supplierSignature,
      clientSignature,
      signatureType: signatureType !== "none" ? signatureType : undefined,
      digitalSignatureMetadata: digitalSignatureMetadata ? JSON.stringify(digitalSignatureMetadata) : undefined,
      signedAt,
      explanation:
        explanation ||
        (activeMode === "upload"
          ? "Contract existent importat și arhivat în bibliotecă"
          : "Contract redactat și agreat"),
    });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "0 KB";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden p-3 sm:p-5 space-y-4 pb-12">
      {/* 1. Header — Apple macOS Window Title, Mode Switcher & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-0.5">
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
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
                Redactare & Semnare Contract
              </h1>
              <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#3a3a3c] dark:text-[#ebebf5] truncate max-w-full">
                {activeTenantName}
              </span>
            </div>
            <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
              Configurare șablon, clauze comerciale și semnătură electronică sau arhivare PDF
            </p>
          </div>
        </div>

        {/* Butoane comutare mod & Salvare */}
        <div className="flex items-center gap-2 flex-wrap max-w-full">
          <div className="apple-segmented flex-wrap sm:flex-nowrap !rounded-2xl sm:!rounded-full max-w-full">
            <button
              type="button"
              data-active={activeMode === "editor"}
              onClick={() => setActiveMode("editor")}
              className="apple-segmented-item px-2.5 sm:px-3"
            >
              <Edit3 className="h-3.5 w-3.5 shrink-0" />
              <span>Editor & Semnături</span>
            </button>

            <button
              type="button"
              data-active={activeMode === "upload"}
              onClick={() => setActiveMode("upload")}
              className="apple-segmented-item px-2.5 sm:px-3"
            >
              <Upload className="h-3.5 w-3.5 shrink-0" />
              <span>Încarcă PDF Semnat</span>
            </button>
          </div>

          <Link
            href="/contracte"
            className="apple-btn-glass flex items-center justify-center h-9 px-3.5 rounded-full text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
          >
            Anulează
          </Link>

          <button
            type="button"
            onClick={handleSave}
            disabled={createMutation.isPending || isUploading}
            className="apple-btn-prominent flex items-center justify-center gap-1.5 h-9 px-4 rounded-full text-white font-semibold text-[12.5px] disabled:opacity-50 cursor-pointer"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                <span>Se salvează...</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5 shrink-0" />
                <span>Salvează Contractul</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mesaj de eroare inline */}
      {errorMsg && (
        <div className="bg-[#ff3b30]/10 border border-[#ff3b30]/25 p-3 rounded-2xl text-xs text-[#ff3b30] dark:text-[#ff6961] font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 2. Panou Principal de Configurare */}
      <div className="apple-surface p-4 sm:p-5 space-y-3.5">
        {/* Rândul 1: Cele 2 alegeri primare - Model Contract & Client */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start [&>div]:min-w-0">
          {/* Col 1: Model Contract / Șablon */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
              <label className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-[#6e6e73] dark:text-[#98989d]" />
                Model contract (șablon)
              </label>
              {/* Comutator Rapid Limbă: RO | EN | Bilingv */}
              <div className="apple-segmented">
                <button
                  type="button"
                  data-active={docLanguage === "ro"}
                  onClick={() => handleLanguageChange("ro")}
                  className="apple-segmented-item !h-6 px-2.5 !text-[11px]"
                  title="Contract în limba Română"
                >
                  RO
                </button>
                <button
                  type="button"
                  data-active={docLanguage === "en"}
                  onClick={() => handleLanguageChange("en")}
                  className="apple-segmented-item !h-6 px-2.5 !text-[11px]"
                  title="Agreement in English"
                >
                  EN
                </button>
                <button
                  type="button"
                  data-active={docLanguage === "ro_en"}
                  onClick={() => handleLanguageChange("ro_en")}
                  className="apple-segmented-item !h-6 px-2.5 !text-[11px]"
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
              <SelectTrigger className="apple-input w-full min-w-0 max-w-full h-10 px-3 text-[13px] font-medium overflow-hidden text-left">
                <span className="truncate block min-w-0 flex-1 font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                  {templates.find((t) => t.id === selectedTemplateId)?.name ||
                    (selectedTemplateId === "empty"
                      ? "Document Liber (Pagină albă / Ciornă)"
                      : "Alege model de contract...")}
                </span>
              </SelectTrigger>
              <SelectContent className="rounded-2xl text-xs max-w-[500px]">
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-xs py-2 cursor-pointer">
                    <div className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{t.name}</div>
                    {t.description && (
                      <div className="text-[11px] text-[#6e6e73] dark:text-[#98989d] whitespace-normal mt-0.5 leading-snug">
                        {t.description}
                      </div>
                    )}
                  </SelectItem>
                ))}
                <SelectItem value="empty" className="text-xs py-2 text-[#6e6e73] dark:text-[#98989d] cursor-pointer">
                  Document Liber (Pagină albă / Ciornă)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Col 2: Partener Contractual SAGA */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-[#6e6e73] dark:text-[#98989d]" />
                Partener (SAGA)
              </label>
              {selectedPartner ? (
                <span className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] tabular-nums truncate max-w-[260px]">
                  CUI: {selectedPartner.cui || "-"}
                  {selectedPartner.regCom ? ` · ${selectedPartner.regCom}` : ""}
                  {selectedPartner.city ? ` · ${selectedPartner.city}` : ""}
                </span>
              ) : (
                <span className="text-[11.5px] text-[#8e8e93] tabular-nums">
                  {partners.length} parteneri disponibili
                </span>
              )}
            </div>

            <PartnerCombobox
              value={selectedPartnerId}
              onChange={(id, p) => handleSelectPartner(id, p)}
              partners={partners as any[]}
              filterType="client"
              showClientType
              placeholder="Caută client sau furnizor după nume, CUI sau cod SAGA..."
            />

            {/* Date Contact Client */}
            {selectedPartner && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2.5 pt-2.5 border-t border-black/[0.05] dark:border-white/[0.07]">
                <div>
                  <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                    Reprezentant
                  </label>
                  <input
                    value={partnerContactName}
                    onChange={(e) => handleContactChange("contactName", e.target.value)}
                    placeholder="ex: Ion Popescu"
                    className="apple-input w-full h-8 text-xs px-2.5 text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                    Telefon
                  </label>
                  <input
                    value={partnerPhone}
                    onChange={(e) => handleContactChange("phone", e.target.value)}
                    placeholder="ex: 0722..."
                    className="apple-input w-full h-8 text-xs px-2.5 tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                    Email
                  </label>
                  <input
                    value={partnerEmail}
                    onChange={(e) => handleContactChange("email", e.target.value)}
                    placeholder="ex: client@..."
                    className="apple-input w-full h-8 text-xs px-2.5 text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Rândul 2: Bară de Opțiuni (Dedicată Wood Glass vs Rezumat Standard) */}
        {isWoodGlassTenant ? (
          <div className="pt-3 border-t border-black/[0.05] dark:border-white/[0.07] space-y-2.5 text-xs">
            {/* Linia 1 Wood Glass */}
            <div className="flex flex-wrap items-center gap-2 bg-[#f2f2f7] dark:bg-[#2c2c2e] p-2.5 rounded-2xl">
              {/* Număr contract crescător */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-[#1c1c1e] px-2.5 py-1 rounded-full border border-black/[0.06] dark:border-white/[0.08]">
                <span className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                  Nr. contract:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const n = parseInt(String(docNumber).replace(/\D/g, ""), 10);
                    const prev = !isNaN(n) && n > 1 ? String(n - 1) : docNumber;
                    handleCommercialChange({ docNumber: prev });
                  }}
                  className="apple-btn-glass h-6 w-6 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] font-bold text-xs flex items-center justify-center cursor-pointer"
                  title="Scade numărul contractului"
                >
                  -
                </button>
                <input
                  type="text"
                  value={docNumber}
                  onChange={(e) => handleCommercialChange({ docNumber: e.target.value })}
                  className="apple-input h-6 w-16 text-xs tabular-nums font-semibold text-center px-1.5 text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const n = parseInt(String(docNumber).replace(/\D/g, ""), 10);
                    const next = !isNaN(n) ? String(n + 1) : "365";
                    handleCommercialChange({ docNumber: next });
                  }}
                  className="apple-btn-glass h-6 w-6 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] font-bold text-xs flex items-center justify-center cursor-pointer"
                  title="Crește numărul contractului (+1)"
                >
                  +
                </button>
              </div>

              {/* Data contractului */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-[#1c1c1e] px-2.5 py-1 rounded-full border border-black/[0.06] dark:border-white/[0.08]">
                <span className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                  Dată:
                </span>
                <input
                  type="date"
                  value={docDate}
                  onChange={(e) => handleCommercialChange({ docDate: e.target.value })}
                  className="h-6 w-32 text-xs tabular-nums px-1 bg-transparent text-[#1d1d1f] dark:text-[#f5f5f7] font-medium outline-none"
                />
              </div>

              {/* Suma & Valuta EUR / LEI */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-[#1c1c1e] px-2.5 py-1 rounded-full border border-black/[0.06] dark:border-white/[0.08]">
                <span className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                  Sumă:
                </span>
                <input
                  type="text"
                  value={docValue}
                  onChange={(e) => handleCommercialChange({ docValue: e.target.value })}
                  placeholder="ex: 28.305,71"
                  className="apple-input h-6 w-28 text-xs tabular-nums font-semibold text-right px-2 text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                />
                <div className="apple-segmented">
                  <button
                    type="button"
                    data-active={docCurrency === "EUR"}
                    onClick={() => handleCommercialChange({ docCurrency: "EUR" })}
                    className="apple-segmented-item !h-6 px-2.5 !text-[10.5px]"
                  >
                    EUR
                  </button>
                  <button
                    type="button"
                    data-active={docCurrency === "LEI" || docCurrency === "RON"}
                    onClick={() => handleCommercialChange({ docCurrency: "LEI" })}
                    className="apple-segmented-item !h-6 px-2.5 !text-[10.5px]"
                  >
                    LEI
                  </button>
                </div>
              </div>

              {/* Transport inclus: Da / Nu */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-[#1c1c1e] px-2.5 py-1 rounded-full border border-black/[0.06] dark:border-white/[0.08]">
                <span className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                  Transport inclus:
                </span>
                <div className="apple-segmented">
                  <button
                    type="button"
                    data-active={wgTransportIncluded === "da"}
                    onClick={() => handleCommercialChange({ wgTransportIncluded: "da" })}
                    className="apple-segmented-item !h-6 px-2.5 !text-[10.5px]"
                  >
                    DA
                  </button>
                  <button
                    type="button"
                    data-active={wgTransportIncluded === "nu"}
                    onClick={() => handleCommercialChange({ wgTransportIncluded: "nu" })}
                    className="apple-segmented-item !h-6 px-2.5 !text-[10.5px]"
                  >
                    NU
                  </button>
                </div>
              </div>

              {/* Ofertă de preț nr. / dată */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-[#1c1c1e] px-2.5 py-1 rounded-full border border-black/[0.06] dark:border-white/[0.08]">
                <span className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                  Oferta (OFR):
                </span>
                <input
                  type="text"
                  value={offerNumber}
                  onChange={(e) => handleCommercialChange({ offerNumber: e.target.value })}
                  placeholder="4089"
                  className="apple-input h-6 w-16 text-xs tabular-nums px-1.5 text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                />
                <span className="text-[#8e8e93]">/</span>
                <input
                  type="date"
                  value={offerDate}
                  onChange={(e) => handleCommercialChange({ offerDate: e.target.value })}
                  className="h-6 w-30 text-xs tabular-nums px-1 bg-transparent text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                />
              </div>
            </div>

            {/* Linia 2 Wood Glass */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[#f2f2f7] dark:bg-[#2c2c2e] p-2.5 rounded-2xl">
              {/* Tip Tâmplărie */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] mr-0.5">
                  Tip tâmplărie:
                </span>

                <div className="apple-segmented flex-wrap sm:flex-nowrap !rounded-2xl sm:!rounded-full">
                  <button
                    type="button"
                    data-active={wgCarpentryCategory === "lemn"}
                    onClick={() => {
                      setWgCarpentryCategory("lemn");
                      const mapPreset: Record<string, string> = {
                        meranti_68: "Tâmplărie lemn stratificat, esență meranti, 68 mm",
                        meranti_92: "Tâmplărie lemn stratificat, esență meranti, 92 mm",
                        stejar_68: "Tâmplărie lemn stratificat, esență stejar, 68 mm",
                        stejar_92: "Tâmplărie lemn stratificat, esență stejar, 92 mm",
                        pin_68: "Tâmplărie lemn stratificat, esență pin, 68 mm",
                        pin_92: "Tâmplărie lemn stratificat, esență pin, 92 mm",
                      };
                      const nextEssence =
                        wgWoodOption === "custom"
                          ? wgCustomCarpentryText.trim() || "Tâmplărie lemn stratificat"
                          : mapPreset[wgWoodOption] || "Tâmplărie lemn stratificat, esență meranti, 68 mm";
                      handleCommercialChange({ woodEssence: nextEssence });
                    }}
                    className="apple-segmented-item !h-7 px-3 !text-[11px]"
                  >
                    Lemn
                  </button>
                  <button
                    type="button"
                    data-active={wgCarpentryCategory === "aluminiu"}
                    onClick={() => {
                      setWgCarpentryCategory("aluminiu");
                      const nextEssence = wgCustomCarpentryText.trim()
                        ? wgCustomCarpentryText.trim().toLowerCase().startsWith("tâmplărie") ||
                          wgCustomCarpentryText.trim().toLowerCase().startsWith("tamplarie")
                          ? wgCustomCarpentryText.trim()
                          : `Tâmplărie aluminiu ${wgCustomCarpentryText.trim()}`
                        : "Tâmplărie aluminiu";
                      handleCommercialChange({ woodEssence: nextEssence });
                    }}
                    className="apple-segmented-item !h-7 px-3 !text-[11px]"
                  >
                    Aluminiu
                  </button>
                  <button
                    type="button"
                    data-active={wgCarpentryCategory === "pvc"}
                    onClick={() => {
                      setWgCarpentryCategory("pvc");
                      const nextEssence = wgCustomCarpentryText.trim()
                        ? `Tâmplărie PVC cu geam termoizolant (${wgCustomCarpentryText.trim()})`
                        : "Tâmplărie PVC cu geam termoizolant";
                      handleCommercialChange({ woodEssence: nextEssence });
                    }}
                    className="apple-segmented-item !h-7 px-3 !text-[11px]"
                  >
                    PVC cu geam termoizolant
                  </button>
                </div>

                {wgCarpentryCategory === "lemn" && (
                  <select
                    value={wgWoodOption}
                    onChange={(e) => {
                      const val = e.target.value;
                      setWgWoodOption(val);
                      const mapPreset: Record<string, string> = {
                        meranti_68: "Tâmplărie lemn stratificat, esență meranti, 68 mm",
                        meranti_92: "Tâmplărie lemn stratificat, esență meranti, 92 mm",
                        stejar_68: "Tâmplărie lemn stratificat, esență stejar, 68 mm",
                        stejar_92: "Tâmplărie lemn stratificat, esență stejar, 92 mm",
                        pin_68: "Tâmplărie lemn stratificat, esență pin, 68 mm",
                        pin_92: "Tâmplărie lemn stratificat, esență pin, 92 mm",
                      };
                      if (val !== "custom" && mapPreset[val]) {
                        handleCommercialChange({ woodEssence: mapPreset[val] });
                      } else if (val === "custom") {
                        const customVal = wgCustomCarpentryText.trim() || woodEssence;
                        setWgCustomCarpentryText(customVal);
                        handleCommercialChange({ woodEssence: customVal });
                      }
                    }}
                    className="apple-input h-8 text-xs font-medium px-2.5 bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                  >
                    <optgroup label="A. Meranti">
                      <option value="meranti_68">A. Meranti 68</option>
                      <option value="meranti_92">A. Meranti 92</option>
                    </optgroup>
                    <optgroup label="B. Stejar">
                      <option value="stejar_68">B. Stejar 68</option>
                      <option value="stejar_92">B. Stejar 92</option>
                    </optgroup>
                    <optgroup label="C. Pin">
                      <option value="pin_68">C. Pin 68</option>
                      <option value="pin_92">C. Pin 92</option>
                    </optgroup>
                    <optgroup label="D. Opțiune de text">
                      <option value="custom">D. Opțiune de text</option>
                    </optgroup>
                  </select>
                )}

                {(wgCarpentryCategory === "aluminiu" ||
                  wgCarpentryCategory === "pvc" ||
                  (wgCarpentryCategory === "lemn" && wgWoodOption === "custom")) && (
                  <input
                    type="text"
                    value={wgCustomCarpentryText}
                    onChange={(e) => {
                      const txt = e.target.value;
                      setWgCustomCarpentryText(txt);
                      if (wgCarpentryCategory === "lemn") {
                        handleCommercialChange({ woodEssence: txt || "Tâmplărie lemn stratificat" });
                      } else if (wgCarpentryCategory === "aluminiu") {
                        const formatted = txt.trim()
                          ? txt.trim().toLowerCase().startsWith("tâmplărie") ||
                            txt.trim().toLowerCase().startsWith("tamplarie")
                            ? txt.trim()
                            : `Tâmplărie aluminiu ${txt.trim()}`
                          : "Tâmplărie aluminiu";
                        handleCommercialChange({ woodEssence: formatted });
                      } else {
                        const formatted = txt.trim()
                          ? `Tâmplărie PVC cu geam termoizolant (${txt.trim()})`
                          : "Tâmplărie PVC cu geam termoizolant";
                        handleCommercialChange({ woodEssence: formatted });
                      }
                    }}
                    placeholder={
                      wgCarpentryCategory === "aluminiu"
                        ? "Detalii aluminiu (ex: cu geam termoizolant, profil Schüco / Reynaers...)"
                        : wgCarpentryCategory === "pvc"
                          ? "Detalii opționale PVC..."
                          : "Introduceți textul pentru tâmplărie lemn..."
                    }
                    className="apple-input h-8 w-64 text-xs px-2.5 bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                  />
                )}
              </div>

              {/* Intern / Extern + PF / PJ */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-white dark:bg-[#1c1c1e] px-2.5 py-1 rounded-full border border-black/[0.06] dark:border-white/[0.08]">
                  <span className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                    Tip:
                  </span>
                  <div className="apple-segmented">
                    <button
                      type="button"
                      data-active={wgMarketType === "intern"}
                      onClick={() => handleCommercialChange({ wgMarketType: "intern", paymentTranches: "50-40-10" })}
                      className="apple-segmented-item !h-6 px-2.5 !text-[10.5px]"
                      title="Contract Intern (Model 393) — Recepția lucrării prin Proces-Verbal de predare-primire, inclusiv TVA"
                    >
                      Intern (PV)
                    </button>
                    <button
                      type="button"
                      data-active={wgMarketType === "extern"}
                      onClick={() => handleCommercialChange({ wgMarketType: "extern", paymentTranches: "50-50" })}
                      className="apple-segmented-item !h-6 px-2.5 !text-[10.5px]"
                      title="Contract Extern (Model 324 PF / 392 PJ) — Recepția lucrării prin CMR"
                    >
                      Extern (CMR)
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 bg-white dark:bg-[#1c1c1e] px-2.5 py-1 rounded-full border border-black/[0.06] dark:border-white/[0.08]">
                  <span className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                    Beneficiar:
                  </span>
                  <div className="apple-segmented">
                    <button
                      type="button"
                      data-active={wgBeneficiaryType === "pf"}
                      onClick={() => handleCommercialChange({ wgBeneficiaryType: "pf" })}
                      className="apple-segmented-item !h-6 px-2.5 !text-[10.5px]"
                    >
                      Pers. Fizică (PF)
                    </button>
                    <button
                      type="button"
                      data-active={wgBeneficiaryType === "pj"}
                      onClick={() => handleCommercialChange({ wgBeneficiaryType: "pj" })}
                      className="apple-segmented-item !h-6 px-2.5 !text-[10.5px]"
                    >
                      Pers. Juridică (PJ)
                    </button>
                  </div>
                </div>

                <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-white dark:bg-[#1c1c1e] text-[#3a3a3c] dark:text-[#ebebf5] border border-black/[0.06] dark:border-white/[0.08]">
                  {wgMarketType === "intern"
                    ? "Recepție: PV Predare-Primire · + TVA"
                    : wgBeneficiaryType === "pf"
                      ? "Recepție: CMR · + TVA (PF)"
                      : "Recepție: CMR · Fără TVA (PJ Extern)"}
                </span>

                <button
                  type="button"
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  className="apple-btn-glass text-[11.5px] font-semibold flex items-center gap-1.5 px-3 h-8 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                >
                  <SlidersHorizontal className="h-3 w-3" />
                  <span>Tranșe & Livrare</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${showAdvancedSettings ? "rotate-180" : ""}`} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="pt-3 border-t border-black/[0.05] dark:border-white/[0.07] flex flex-wrap items-center justify-between gap-2 text-xs">
            {/* Rezumat Rapid pentru ceilalți tenanți */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="tabular-nums text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] bg-[#f2f2f7] dark:bg-[#2c2c2e] px-3 py-1 rounded-full">
                Nr. {docNumber}
              </span>
              <span className="tabular-nums text-[12px] text-[#6e6e73] dark:text-[#98989d] bg-[#f2f2f7] dark:bg-[#2c2c2e] px-3 py-1 rounded-full">
                Data: {docDate}
              </span>

              {!selectedTemplateId.includes("saas") ? (
                <div className="flex items-center gap-1.5 bg-[#f2f2f7] dark:bg-[#2c2c2e] px-2.5 py-0.5 rounded-full">
                  <span className="text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                    Valoare:
                  </span>
                  <input
                    type="text"
                    value={docValue}
                    onChange={(e) => handleCommercialChange({ docValue: e.target.value })}
                    placeholder="ex: 2.864,65"
                    className="apple-input h-6 w-24 text-xs tabular-nums font-semibold text-right px-2 bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                  />
                  <select
                    value={docCurrency}
                    onChange={(e) => handleCommercialChange({ docCurrency: e.target.value })}
                    className="h-6 rounded-full text-[11px] font-semibold px-2 bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                  >
                    <option value="EUR">EUR</option>
                    <option value="RON">RON</option>
                  </select>
                </div>
              ) : (
                <span className="tabular-nums text-[12px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 dark:bg-emerald-500/18 px-3 py-1 rounded-full">
                  {hasTrial ? `Probă ${trialMonths}m · ` : ""}
                  {hasPromo
                    ? `Promo €${promoPrice} (${promoMonths}m) + Bază €${basePrice} (${Math.max(1, totalDurationMonths - promoMonths)}m)`
                    : `Tarif €${basePrice} (${totalDurationMonths}m)`}
                </span>
              )}
            </div>

            {/* Butoane Acțiune: Reîncarcă Șablon & Toggle Personalizare */}
            <div className="flex items-center gap-2">
              {selectedTemplateId && (
                <button
                  type="button"
                  onClick={() => handleApplyTemplate(selectedTemplateId)}
                  className="apple-btn-glass text-[12px] text-[#6e6e73] hover:text-[#1d1d1f] dark:text-[#98989d] dark:hover:text-[#f5f5f7] flex items-center gap-1.5 px-3 h-8 rounded-full font-semibold cursor-pointer"
                  title="Reîncarcă șablonul original în editor"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Reîncarcă</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="apple-btn-glass text-[12px] font-semibold flex items-center gap-1.5 px-3.5 h-8 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Personalizează Clauze & Detalii</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvancedSettings ? "rotate-180" : ""}`} />
              </button>
            </div>
          </div>
        )}

        {/* Panou Extensibil de Setări & Parametri */}
        {showAdvancedSettings && (
          <div className="pt-3 border-t border-black/[0.05] dark:border-white/[0.07] mt-2 space-y-3 bg-[#f2f2f7] dark:bg-[#2c2c2e] p-4 rounded-2xl">
            {isWoodGlassTenant || !selectedTemplateId.includes("saas") ? (
              <div>
                <div className="text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-2.5">
                  {isWoodGlassTenant
                    ? "Clauze comerciale și tehnice Wood Glass (Tâmplărie Lemn Stratificat)"
                    : "Parametri comerciali contract"}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {isWoodGlassTenant && (
                    <>
                      <div className="sm:col-span-2">
                        <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                          Produs / Esență tâmplărie (Cap. A — Obiectul contractului)
                        </label>
                        <div className="flex items-center gap-1.5">
                          <select
                            value={
                              [
                                "Tâmplărie Lemn Stratificat, esență Pin 68 mm",
                                "Tâmplărie din lemn stratificat, esență Stejar 68 mm",
                                "Tâmplărie Lemn Stratificat, esență Molid 68 mm",
                                "Tâmplărie Lemn Stratificat, esență Meranti 68 mm",
                              ].includes(woodEssence)
                                ? woodEssence
                                : "custom"
                            }
                            onChange={(e) => {
                              if (e.target.value !== "custom") {
                                handleCommercialChange({ woodEssence: e.target.value });
                              }
                            }}
                            className="apple-input h-8 text-xs px-2.5 bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] font-medium shrink-0 outline-none"
                          >
                            <option value="Tâmplărie Lemn Stratificat, esență Pin 68 mm">Pin 68 mm (Standard 387)</option>
                            <option value="Tâmplărie din lemn stratificat, esență Stejar 68 mm">Stejar 68 mm (Standard 388)</option>
                            <option value="Tâmplărie Lemn Stratificat, esență Molid 68 mm">Molid 68 mm</option>
                            <option value="Tâmplărie Lemn Stratificat, esență Meranti 68 mm">Meranti 68 mm</option>
                            <option value="custom">Personalizat...</option>
                          </select>
                          <input
                            value={woodEssence}
                            onChange={(e) => handleCommercialChange({ woodEssence: e.target.value })}
                            className="apple-input w-full h-8 text-xs px-2.5 bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                            placeholder="Ex: Tâmplărie Lemn Stratificat, esență Pin 68 mm"
                          />
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                          Modalități de plată / tranșe (Cap. D)
                        </label>
                        <select
                          value={paymentTranches}
                          onChange={(e) =>
                            handleCommercialChange({ paymentTranches: e.target.value as "50-40-10" | "50-50" })
                          }
                          className="apple-input w-full h-8 text-xs px-2.5 bg-white dark:bg-[#1c1c1e] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                        >
                          <option value="50-40-10">
                            3 Tranșe: 50% la semnare • 40% cu 5 zile înainte de livrare • 10% la recepție (Model 387)
                          </option>
                          <option value="50-50">
                            2 Tranșe: 50% la semnare • 50% cu 5 zile înainte de livrare (Model 388)
                          </option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                          Nr. ofertă de preț (Anexă)
                        </label>
                        <input
                          value={offerNumber}
                          onChange={(e) => handleCommercialChange({ offerNumber: e.target.value })}
                          placeholder="Ex: 4650 sau OFR 4761"
                          className="apple-input w-full h-8 text-xs tabular-nums px-2.5 bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                          Data ofertei de preț
                        </label>
                        <input
                          type="date"
                          value={offerDate}
                          onChange={(e) => handleCommercialChange({ offerDate: e.target.value })}
                          className="apple-input w-full h-8 text-xs px-2.5 bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                          Termen livrare (Cap. E)
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={deliveryDays}
                            onChange={(e) => handleCommercialChange({ deliveryDays: e.target.value })}
                            className="apple-input w-full h-8 text-xs tabular-nums text-center px-2 bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                          />
                          <span className="text-[11px] text-[#6e6e73] dark:text-[#98989d] font-medium shrink-0">
                            zile cal.
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                          Garanție oferită (Cap. B)
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={warrantyYears}
                            onChange={(e) => handleCommercialChange({ warrantyYears: e.target.value })}
                            className="apple-input w-full h-8 text-xs tabular-nums text-center px-2 bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                          />
                          <span className="text-[11px] text-[#6e6e73] dark:text-[#98989d] font-medium shrink-0">
                            ani
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div className="text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-2.5">
                  Clauze comerciale, tarife și durată
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Preț Bază */}
                  <div className="flex items-center gap-1.5 bg-white dark:bg-[#1c1c1e] px-3 py-1 rounded-full border border-black/[0.06] dark:border-white/[0.08]">
                    <span className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                      Preț bază:
                    </span>
                    <input
                      type="text"
                      value={basePrice}
                      onChange={(e) => handleCommercialChange({ basePrice: e.target.value })}
                      className="apple-input h-6 w-14 text-xs tabular-nums text-center px-1 text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                    />
                    <span className="text-[11px] text-[#6e6e73] dark:text-[#98989d] font-medium">
                      {docCurrency} / lună
                    </span>
                  </div>

                  {/* Probă Gratuită */}
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1c1c1e]">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={hasTrial}
                        onChange={(e) => handleCommercialChange({ hasTrial: e.target.checked })}
                        className="rounded border-black/20 dark:border-white/20 text-primary h-3.5 w-3.5"
                      />
                      <span className="text-xs font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                        Probă gratuită
                      </span>
                    </label>
                    {hasTrial && (
                      <div className="flex items-center gap-1 ml-1 pl-1.5 border-l border-black/[0.08] dark:border-white/[0.1]">
                        <input
                          type="number"
                          min="1"
                          max="12"
                          value={trialMonths}
                          onChange={(e) => handleCommercialChange({ trialMonths: parseInt(e.target.value) || 1 })}
                          className="apple-input h-6 w-11 text-xs tabular-nums text-center px-1 text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                        />
                        <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                          luni
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Tarif Promo */}
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1c1c1e]">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={hasPromo}
                        onChange={(e) => handleCommercialChange({ hasPromo: e.target.checked })}
                        className="rounded border-black/20 dark:border-white/20 text-primary h-3.5 w-3.5"
                      />
                      <span className="text-xs font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                        Tarif promo
                      </span>
                    </label>
                    {hasPromo && (
                      <div className="flex items-center gap-1 ml-1 pl-1.5 border-l border-black/[0.08] dark:border-white/[0.1]">
                        <input
                          type="text"
                          value={promoPrice}
                          onChange={(e) => handleCommercialChange({ promoPrice: e.target.value })}
                          className="apple-input h-6 w-14 text-xs tabular-nums text-center px-1 text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                        />
                        <span className="text-[11px] text-[#6e6e73] dark:text-[#98989d] font-medium">
                          {docCurrency} primele
                        </span>
                        <input
                          type="number"
                          min="1"
                          max="12"
                          value={promoMonths}
                          onChange={(e) => handleCommercialChange({ promoMonths: parseInt(e.target.value) || 1 })}
                          className="apple-input h-6 w-11 text-xs tabular-nums text-center px-1 text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                        />
                        <span className="text-[11px] text-[#6e6e73] dark:text-[#98989d] font-medium">
                          luni
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Durată & Prelungire */}
                  <div className="flex items-center gap-1.5 bg-white dark:bg-[#1c1c1e] px-3 py-1 rounded-full border border-black/[0.06] dark:border-white/[0.08]">
                    <span className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                      Durată:
                    </span>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={totalDurationMonths}
                      onChange={(e) => handleCommercialChange({ totalDurationMonths: parseInt(e.target.value) || 12 })}
                      className="apple-input h-6 w-12 text-xs tabular-nums text-center px-1 text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                    />
                    <span className="text-[11px] text-[#6e6e73] dark:text-[#98989d] font-medium">
                      luni
                    </span>
                    <span className="text-[#8e8e93]">|</span>
                    <span className="text-[11px] text-[#6e6e73] dark:text-[#98989d] font-medium">
                      Prelungire:
                    </span>
                    <input
                      type="number"
                      min="1"
                      max="36"
                      value={autoRenewalMonths}
                      onChange={(e) => handleCommercialChange({ autoRenewalMonths: parseInt(e.target.value) || 12 })}
                      className="apple-input h-6 w-12 text-xs tabular-nums text-center px-1 text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                    />
                    <span className="text-[11px] text-[#6e6e73] dark:text-[#98989d] font-medium">
                      luni
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCommercialChange({})}
                    className="apple-btn-glass text-xs font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-1.5 px-3 h-8 rounded-full ml-auto cursor-pointer"
                    title="Sincronizează clauzele din contract cu noile valori"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Sincronizează Clauze</span>
                  </button>
                </div>
              </div>
            )}

            {/* Secțiunea B: Detalii Trasabilitate & Document */}
            <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.08] grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
              <div>
                <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                  Tip document
                </label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger className="apple-input h-8 text-xs bg-white dark:bg-[#1c1c1e]">
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
                <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                  Număr document
                </label>
                <input
                  value={docNumber}
                  onChange={(e) => handleCommercialChange({ docNumber: e.target.value })}
                  className="apple-input w-full h-8 text-xs tabular-nums px-2.5 bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                  Dată încheiere
                </label>
                <input
                  type="date"
                  value={docDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    handleCommercialChange({ docDate: val });
                  }}
                  className="apple-input w-full h-8 text-xs px-2.5 bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums outline-none"
                />
              </div>

              {!isWoodGlassTenant && (
                <div>
                  <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                    Valabil până la
                  </label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="apple-input w-full h-8 text-xs px-2.5 bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums outline-none"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                  Termen plată factură
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={paymentTermDays}
                    onChange={(e) => setPaymentTermDays(e.target.value)}
                    className="apple-input w-full h-8 text-xs tabular-nums px-2 text-center bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                  />
                  <span className="text-[11px] text-[#6e6e73] dark:text-[#98989d] font-medium">
                    zile
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                  Status
                </label>
                <Select value={docStatus} onValueChange={(v) => setDocStatus(v as any)}>
                  <SelectTrigger className="apple-input h-8 text-xs bg-white dark:bg-[#1c1c1e]">
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
                <label className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1">
                  Notă / Explicație în jurnal
                </label>
                <input
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  className="apple-input w-full h-8 text-xs px-2.5 bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                  placeholder={
                    isWoodGlassTenant
                      ? "Ex: Contract Vânzare-Cumpărare Tâmplărie Lemn Stratificat..."
                      : "Ex: Contract comercial agreat..."
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* Rând adițional doar dacă este Act Adițional */}
        {docType === "act_aditional" && (
          <div className="mt-2 pt-2.5 border-t border-black/[0.05] dark:border-white/[0.07] flex items-center gap-2 text-xs flex-wrap">
            <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] shrink-0">
              Contract principal de bază:
            </span>
            <Select
              value={parentContractId ? String(parentContractId) : ""}
              onValueChange={(val) => setParentContractId(val ? parseInt(val) : null)}
            >
              <SelectTrigger className="apple-input h-8 text-xs max-w-md">
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
        <div className="space-y-3">
          <ContractVisualEditor
            key={selectedTemplateId}
            value={contentHtml}
            onChange={(html) => setContentHtml(html)}
            tenantName={activeTenantName}
            tenantCui={activeTenantCui}
            tenantRegCom={activeTenantRegCom}
            tenantIban={activeTenantIban}
            tenantBank={activeTenantBank}
            tenantRepresentative={activeTenantRepresentative}
            partnerName={selectedPartner?.name || selectedPartner?.clientName || ""}
            partnerCui={selectedPartner?.cui || selectedPartner?.clientCUI || ""}
            partnerRegCom={selectedPartner?.regCom || selectedPartner?.clientRegCom || ""}
            partnerContactName={partnerContactName}
            partnerPhone={partnerPhone}
            partnerEmail={partnerEmail}
            docNumber={docNumber}
            docDate={docDate}
            docValue={docValue}
            docCurrency={docCurrency}
            onSetDocValue={(val) => handleCommercialChange({ docValue: val })}
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
          <div className="apple-surface p-3.5 flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <span className="text-[12px] font-semibold text-[#6e6e73] dark:text-[#98989d] shrink-0">
              Notă audit:
            </span>
            <input
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Ex: Contract agreat și semnat cu specificații complete..."
              className="apple-input w-full h-8 px-3 text-xs text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
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
            className={`apple-surface border-2 border-dashed transition-all p-6 text-center ${
              isDragging
                ? "border-primary bg-primary/5"
                : uploadedFile
                  ? "border-emerald-500/40"
                  : "border-black/[0.12] dark:border-white/[0.14]"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleUploadFile(e.target.files[0]);
                }
              }}
              className="hidden"
            />

            {isUploading ? (
              <div className="flex items-center justify-center gap-3 py-4 text-center">
                <Loader2 className="h-5 w-5 animate-spin text-[#6e6e73] shrink-0" />
                <div className="text-left">
                  <h4 className="text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    Se încarcă și se analizează contractul...
                  </h4>
                  <p className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d]">
                    Detectare automată număr, dată, valoare, monedă și partener
                  </p>
                </div>
              </div>
            ) : uploadedFile ? (
              <div className="space-y-3 text-left">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#f2f2f7] dark:bg-[#2c2c2e]">
                  <div className="flex items-center gap-3 min-w-0 text-left">
                    <div className="h-9 w-9 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                      <FileCheck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
                        {uploadedFile.fileName}
                      </div>
                      <div className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] flex flex-wrap items-center gap-2 mt-0.5 tabular-nums">
                        <span>Dimensiune: {formatFileSize(uploadedFile.fileSize)}</span>
                        {uploadedFile.detectedPartnerName && (
                          <span className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
                            · Partener: {uploadedFile.detectedPartnerName}
                          </span>
                        )}
                        {uploadedFile.detectedValue && (
                          <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
                            · Valoare: {uploadedFile.detectedValue} {uploadedFile.detectedCurrency || docCurrency}
                          </span>
                        )}
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Date extrase din document
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="apple-btn-glass px-3.5 h-8 rounded-full text-xs font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                    >
                      Înlocuiește fișier
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={createMutation.isPending}
                      className="apple-btn-prominent flex items-center gap-1.5 px-4 h-8 rounded-full text-xs text-white font-semibold disabled:opacity-50 cursor-pointer"
                    >
                      <Save className="h-3.5 w-3.5" />
                      <span>Salvează Contractul Importat</span>
                    </button>
                  </div>
                </div>

                {uploadedFile.fileUrl && /\.pdf$/i.test(uploadedFile.fileName || "") && (
                  <div className="apple-doc-stage p-2 sm:p-3 rounded-2xl overflow-hidden">
                    <iframe
                      src={`${uploadedFile.fileUrl}#view=FitH`}
                      className="w-full h-[650px] border-0 bg-white rounded-xl"
                      title={uploadedFile.fileName}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 space-y-2.5">
                <Upload className="h-8 w-8 mx-auto text-[#8e8e93]" />
                <h4 className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Trageți fișierul PDF sau Word (.docx) al contractului aici sau faceți click pentru a selecta
                </h4>
                <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d]">
                  Acceptat: PDF sau Word (.docx) — extragere automată număr, dată, valoare și partener (max 25 MB)
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="apple-btn-prominent inline-flex items-center justify-center rounded-full text-[12.5px] font-semibold text-white px-4 h-9 mt-2 cursor-pointer"
                >
                  Selectează Fișier PDF / Word
                </button>
              </div>
            )}
          </div>

          {/* Notă Înregistrare Jurnal de Audit */}
          <div className="apple-surface p-3.5 flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <span className="text-[12px] font-semibold text-[#6e6e73] dark:text-[#98989d] shrink-0">
              Notă arhivare:
            </span>
            <input
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Ex: Contract semnat fizic, scanat și arhivat..."
              className="apple-input w-full h-8 px-3 text-xs text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
