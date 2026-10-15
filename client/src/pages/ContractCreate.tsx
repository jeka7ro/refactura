import { useState, useEffect, useMemo } from "react";
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
  RefreshCw,
  CheckCircle2,
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

export default function ContractCreate() {
  const [, setLocation] = useLocation();

  // URL search params
  const searchParams = new URLSearchParams(window.location.search);
  const parentContractIdParam = searchParams.get("parentContractId");
  const typeParam = searchParams.get("type");

  // Queries
  const { data: partners = [] } = trpc.clients.list.useQuery();
  const { data: templates = [] } = trpc.contracts.getTemplates.useQuery();
  const { data: allContracts = [] } = trpc.contracts.list.useQuery();
  const { data: tenant } = trpc.tenants.current.useQuery();

  // Form State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    typeParam === "act_aditional" ? "act-aditional-modificare" : "contract-cadru-woodglass"
  );
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
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
  const [paymentTermDays, setPaymentTermDays] = useState<string>("30");
  const [deliveryDays, setDeliveryDays] = useState<string>("15");
  const [warrantyMonths, setWarrantyMonths] = useState<string>("24");
  const [explanation, setExplanation] = useState<string>("");
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

  // Generate / Replace template variables
  useEffect(() => {
    const tmpl = templates.find((t) => t.id === selectedTemplateId);
    if (!tmpl) return;

    let raw = tmpl.contentHtml || "";

    // Replace Tenant Variables (Wood Glass)
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
      .replace(/{{contract\.explanation}}/g, explanation || "Modificare convenită de comun acord")
      .replace(/{{contract\.notes}}/g, "Lucrările au fost recepționate fără obiecțiuni.");

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
      setErrorMsg("Data este obligatorie.");
      return;
    }

    setErrorMsg("");
    createMutation.mutate({
      partnerId: selectedPartnerId,
      parentContractId: parentContractId,
      type: docType,
      title:
        docType === "act_aditional"
          ? `Act Adițional ${docNumber} la Contract ${parentContract?.number || ""}`
          : `Contract Cadru ${selectedPartner?.name || ""}`,
      number: docNumber,
      date: docDate,
      validFrom,
      validUntil: validUntil || null,
      value: docValue,
      currency: docCurrency,
      status: "activ",
      contentHtml,
      explanation: explanation || "Document creat și aprobat online",
    });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
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
              {docType === "act_aditional" ? "Emite Act Adițional Nou" : "Generează Contract Nou"}
            </h1>
            <p className="text-xs text-slate-500">
              Redactare inteligentă cu completare automată din datele partenerului (fără Word)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            asChild
            className="rounded-xl border-slate-300 dark:border-slate-700"
          >
            <Link href="/contracte">Anulează</Link>
          </Button>

          <Button
            onClick={handleSave}
            disabled={createMutation.isPending}
            className="rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold"
          >
            {createMutation.isPending ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" />
                Se generează...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Save className="h-4 w-4" />
                Salvează & Generează PDF
              </span>
            )}
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 p-3.5 rounded-2xl text-xs text-rose-700 dark:text-rose-300 font-medium">
          {errorMsg}
        </div>
      )}

      {/* Form Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Pas 1: Sablon & Tip */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-4 shadow-sm space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
            1. Șablon & Tip Document
          </h3>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Selectează Șablon:
            </label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger className="rounded-xl text-xs h-9 mt-1">
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

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Tip Document:
            </label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger className="rounded-xl text-xs h-9 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl text-xs">
                <SelectItem value="contract">Contract Cadru</SelectItem>
                <SelectItem value="act_aditional">Act Adițional</SelectItem>
                <SelectItem value="pv_receptie">Proces Verbal Recepție</SelectItem>
                <SelectItem value="anexa">Anexă Tehnică</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {docType === "act_aditional" && (
            <div>
              <label className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                Legați de Contractul-Mamă:
              </label>
              <Select
                value={parentContractId ? String(parentContractId) : ""}
                onValueChange={(val) => setParentContractId(val ? parseInt(val) : null)}
              >
                <SelectTrigger className="rounded-xl text-xs h-9 mt-1 border-purple-200 dark:border-purple-800">
                  <SelectValue placeholder="Alege contractul principal..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl text-xs">
                  {allContracts
                    .filter((c: any) => c.type === "contract")
                    .map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.number} — {c.partnerName || "Fără partener"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Pas 2: Partener */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-4 shadow-sm space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Building2 className="h-4 w-4 text-primary" />
            2. Partener Contractual
          </h3>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Alege Client sau Furnizor:
            </label>
            <Select
              value={selectedPartnerId ? String(selectedPartnerId) : ""}
              onValueChange={(val) => setSelectedPartnerId(val ? parseInt(val) : null)}
            >
              <SelectTrigger className="rounded-xl text-xs h-9 mt-1">
                <SelectValue placeholder="Caută din cei 1853 parteneri..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl text-xs max-h-64">
                {partners.map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name} {p.cui ? `(CUI: ${p.cui})` : ""} {p.isSupplier === 1 ? "• Furnizor" : "• Client"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedPartner && (
            <div className="text-[11px] bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-0.5 text-slate-600 dark:text-slate-300">
              <div className="font-bold text-slate-900 dark:text-white truncate">
                {selectedPartner.name}
              </div>
              <div>CUI: {selectedPartner.cui || "-"} | Reg Com: {selectedPartner.regCom || "-"}</div>
              <div>Sediu: {selectedPartner.city || "-"}, {selectedPartner.address || "-"}</div>
            </div>
          )}
        </div>

        {/* Pas 3: Termene & Clauze Specifice */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-4 shadow-sm space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-primary" />
            3. Parametri Contractuali
          </h3>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Număr:</label>
              <Input
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                className="h-8 rounded-xl text-xs mt-0.5"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Dată Încheiere:</label>
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
              <label className="text-[11px] font-medium text-slate-600">Scadență (zile):</label>
              <Input
                value={paymentTermDays}
                onChange={(e) => setPaymentTermDays(e.target.value)}
                className="h-8 rounded-xl text-xs mt-0.5"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-600">Livrare (zile):</label>
              <Input
                value={deliveryDays}
                onChange={(e) => setDeliveryDays(e.target.value)}
                className="h-8 rounded-xl text-xs mt-0.5"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-600">Garanție (luni):</label>
              <Input
                value={warrantyMonths}
                onChange={(e) => setWarrantyMonths(e.target.value)}
                className="h-8 rounded-xl text-xs mt-0.5"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Justificare obligatorie pentru Jurnal */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-4 shadow-sm">
        <label className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center gap-1.5 mb-1.5">
          Explicație / Notă Decizie (Salvată în Jurnalul de Audit cu Dată & Oră):
        </label>
        <Input
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="Ex: Contract cadru inițiat pe baza acordului comercial din 15.10 / Solicitare de modificare termen..."
          className="rounded-xl text-xs"
        />
      </div>

      {/* Editor Canvas / Live Document Preview */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Pânză de Redactare Document (Textul ce va fi tipărit în PDF)
            </h3>
            <p className="text-xs text-slate-500">
              Poți ajusta orice paragraf sau clauză direct aici înainte de generarea PDF-ului.
            </p>
          </div>
        </div>

        <textarea
          value={contentHtml}
          onChange={(e) => setContentHtml(e.target.value)}
          rows={16}
          className="w-full font-mono text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4 focus:outline-none focus:ring-2 focus:ring-primary leading-relaxed"
        />
      </div>
    </div>
  );
}
