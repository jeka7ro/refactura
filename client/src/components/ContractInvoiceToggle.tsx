import React, { useState, useEffect, useMemo } from "react";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { FileText, Calendar, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface ContractInvoiceToggleProps {
  clientId?: number;
  clientName?: string;
  notes: string;
  onNotesChange: (updatedNotes: string) => void;
  contractNumber?: string;
  onContractNumberChange?: (val: string) => void;
  contractDate?: string;
  onContractDateChange?: (val: string) => void;
  className?: string;
}

const CONTRACT_LINE_REGEX = /^(?:Conform\s+)?Contract(?:ului)?(?:\s+(?:nr\.?|număr|numar))?[^\n]*\n?/mi;

function formatDateRo(d: string): string {
  if (!d) return "";
  if (d.includes("-")) {
    const parts = d.split("-");
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return d;
}

export function ContractInvoiceToggle({
  clientId,
  clientName,
  notes,
  onNotesChange,
  contractNumber = "",
  onContractNumberChange,
  contractDate = "",
  onContractDateChange,
  className = "",
}: ContractInvoiceToggleProps) {
  // Verifică dacă există deja o mențiune de contract în textul facturii
  const hasExistingContractInNotes = useMemo(() => {
    return CONTRACT_LINE_REGEX.test(notes || "");
  }, [notes]);

  const [isEnabled, setIsEnabled] = useState(
    hasExistingContractInNotes || Boolean(contractNumber.trim())
  );
  const [internalNumber, setInternalNumber] = useState(contractNumber || "");
  const [internalDate, setInternalDate] = useState(contractDate || "");

  // Interoghează contractele existente ale clientului din baza de date
  const { data: clientContracts = [] } = trpc.contracts.list.useQuery(
    { partnerId: clientId },
    { enabled: Boolean(clientId && clientId > 0), staleTime: 60 * 1000 }
  );

  // Sincronizare externă dacă părintele modifică contractNumber sau contractDate
  useEffect(() => {
    if (contractNumber !== undefined && contractNumber !== internalNumber) {
      setInternalNumber(contractNumber);
      if (contractNumber.trim() && !isEnabled) {
        setIsEnabled(true);
      }
    }
  }, [contractNumber]);

  useEffect(() => {
    if (contractDate !== undefined && contractDate !== internalDate) {
      setInternalDate(contractDate);
    }
  }, [contractDate]);

  // Sincronizare inversă către părinte
  useEffect(() => {
    if (onContractNumberChange && internalNumber !== contractNumber) {
      onContractNumberChange(internalNumber);
    }
  }, [internalNumber, onContractNumberChange]);

  useEffect(() => {
    if (onContractDateChange && internalDate !== contractDate) {
      onContractDateChange(internalDate);
    }
  }, [internalDate, onContractDateChange]);

  // Formatare dată în stil românesc DD.MM.YYYY
  const formattedContractDate = useMemo(() => {
    return formatDateRo(internalDate);
  }, [internalDate]);

  // Generare text oficial pentru factură
  const generatedText = useMemo(() => {
    const num = internalNumber.trim();
    const dt = formattedContractDate.trim();
    if (!num && !dt) return "";
    if (num && dt) {
      return `Conform Contract Nr. ${num} din data de ${dt}.`;
    }
    if (num) {
      return `Conform Contract Nr. ${num}.`;
    }
    return `Conform Contract din data de ${dt}.`;
  }, [internalNumber, formattedContractDate]);

  // Actualizare automată a textului din mențiuni când comutatorul este activ
  useEffect(() => {
    if (!isEnabled) return;
    if (!generatedText) return;

    const currentNotes = notes || "";
    const hasContract = CONTRACT_LINE_REGEX.test(currentNotes);

    if (hasContract) {
      const updated = currentNotes.replace(CONTRACT_LINE_REGEX, `${generatedText}\n`);
      if (updated.trim() !== currentNotes.trim()) {
        onNotesChange(updated.trimEnd());
      }
    } else {
      const updated = currentNotes ? `${generatedText}\n${currentNotes}` : generatedText;
      onNotesChange(updated);
    }
  }, [isEnabled, generatedText]);

  // Comutare toggle
  const handleToggle = (checked: boolean) => {
    setIsEnabled(checked);
    const currentNotes = notes || "";

    if (checked) {
      // Dacă avem un singur contract existent pentru client, îl completăm automat
      if (!internalNumber && clientContracts.length === 1) {
        const first = clientContracts[0];
        setInternalNumber(first.number || "");
        setInternalDate(first.date || "");
        const gen = first.date
          ? `Conform Contract Nr. ${first.number} din data de ${formatDateRo(first.date)}.`
          : `Conform Contract Nr. ${first.number}.`;
        const updated = currentNotes.replace(CONTRACT_LINE_REGEX, "");
        const finalNotes = updated.trim() ? `${gen}\n${updated.trim()}` : gen;
        onNotesChange(finalNotes);
      } else if (generatedText) {
        const updated = currentNotes.replace(CONTRACT_LINE_REGEX, "");
        const finalNotes = updated.trim() ? `${generatedText}\n${updated.trim()}` : generatedText;
        onNotesChange(finalNotes);
      }
      toast.success("Mențiunea de contract a fost adăugată pe factură");
    } else {
      const updated = currentNotes.replace(CONTRACT_LINE_REGEX, "").trim();
      onNotesChange(updated);
      toast.info("Mențiunea de contract a fost eliminată din factură");
    }
  };

  return (
    <div className={`inline-flex items-center gap-2.5 flex-wrap ${className}`}>
      <label className="inline-flex items-center gap-2 cursor-pointer select-none whitespace-nowrap shrink-0">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Contract</span>
        </span>
        <Switch
          checked={isEnabled}
          onCheckedChange={handleToggle}
        />
      </label>

      {isEnabled && (
        <div className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 pl-2.5 border-l border-slate-200 dark:border-slate-700 flex-wrap">
          {/* Selector dacă partenerul are contracte în sistem */}
          {clientContracts.length > 0 && (
            <select
              onChange={(e) => {
                const selected = clientContracts.find((c: any) => String(c.id) === e.target.value);
                if (selected) {
                  setInternalNumber(selected.number || "");
                  setInternalDate(selected.date || "");
                }
              }}
              className="h-8 px-2 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs max-w-[170px] truncate"
              defaultValue=""
            >
              <option value="" disabled>
                Contracte ({clientContracts.length})
              </option>
              {clientContracts.map((c: any) => (
                <option key={c.id} value={c.id}>
                  Nr. {c.number} {c.date ? `(${formatDateRo(c.date)})` : ""} - {c.title}
                </option>
              ))}
            </select>
          )}

          {/* Număr Contract */}
          <div className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md px-2.5 h-8 shadow-2xs">
            <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold">Nr.</span>
            <input
              type="text"
              placeholder="ex: 392"
              value={internalNumber}
              onChange={(e) => setInternalNumber(e.target.value)}
              className="w-24 text-xs font-semibold text-slate-900 dark:text-white bg-transparent outline-none placeholder:text-slate-400 placeholder:font-normal"
            />
          </div>

          {/* Data Contract */}
          <div className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md px-2.5 h-8 shadow-2xs">
            <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold">din data de</span>
            <input
              type="date"
              value={internalDate}
              onChange={(e) => setInternalDate(e.target.value)}
              className="text-xs font-semibold text-slate-900 dark:text-white bg-transparent outline-none cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ContractInvoiceToggle;

