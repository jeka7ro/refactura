import React, { useState, useEffect, useMemo } from "react";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface BnrInvoiceRateToggleProps {
  currency: string;
  issueDate: string; // YYYY-MM-DD
  total: number;
  totalVAT?: number;
  notes: string;
  onNotesChange: (updatedNotes: string) => void;
  className?: string;
}

const BNR_LINE_REGEX = /^(?:Curs BNR|Factură (?:emisă|calculată) la cursul BNR)[^\n]*\n?/m;

export function BnrInvoiceRateToggle({
  currency,
  issueDate,
  total,
  totalVAT = 0,
  notes,
  onNotesChange,
  className = "",
}: BnrInvoiceRateToggleProps) {
  // Verificăm dacă există deja o mențiune BNR în textul existent
  const hasExistingBnrInNotes = useMemo(() => {
    return BNR_LINE_REGEX.test(notes || "");
  }, [notes]);

  const [isEnabled, setIsEnabled] = useState(hasExistingBnrInNotes);
  const [refCurrency, setRefCurrency] = useState<string>(
    currency && currency !== "RON" ? currency : "EUR"
  );
  const [customRate, setCustomRate] = useState<string>("");

  // Sincronizare stare toggle dacă factura încărcată are deja mențiune BNR
  useEffect(() => {
    if (hasExistingBnrInNotes && !isEnabled) {
      setIsEnabled(true);
    }
  }, [hasExistingBnrInNotes]);

  // Preluăm cursurile BNR oficiale din sistem
  const { data: bnrData } = trpc.system.getBnrRates.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  // Dacă moneda facturii se schimbă și este EUR/USD, adaptăm moneda de referință
  useEffect(() => {
    if (currency && currency !== "RON") {
      setRefCurrency(currency);
    }
  }, [currency]);

  // Data facturii formatată în stil românesc DD.MM.YYYY (ex: 07.10.2026)
  const formattedInvoiceDate = useMemo(() => {
    if (!issueDate) return "";
    const parts = issueDate.split("-");
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    return issueDate;
  }, [issueDate]);

  // Căutăm cursul BNR valabil pentru data emiterii facturii
  const bnrRateInfo = useMemo(() => {
    if (!bnrData) return null;

    let targetRate = bnrData.rates?.[refCurrency] || (refCurrency === "EUR" ? 5.3527 : 4.7616);

    if (issueDate && Array.isArray(bnrData.history) && bnrData.history.length > 0) {
      // 1. Căutare exactă după data emiterii
      let matched = bnrData.history.find((h: any) => h.date === issueDate);

      // 2. Dacă BNR nu a publicat încă cursul de la ora 13:00 sau e weekend/sărbătoare,
      // cursul legal în vigoare este cel din ultima zi lucrătoare bancară anterioară
      if (!matched) {
        const sortedPrior = [...bnrData.history]
          .filter((h: any) => h.date <= issueDate)
          .sort((a: any, b: any) => b.date.localeCompare(a.date));
        if (sortedPrior.length > 0) {
          matched = sortedPrior[0];
        }
      }

      if (matched && (matched as any)[refCurrency]) {
        targetRate = (matched as any)[refCurrency];
      }
    }

    return {
      rate: targetRate,
      rateStr: targetRate.toFixed(4),
      dateStr: formattedInvoiceDate || bnrData.formattedDate || "din data emiterii",
    };
  }, [bnrData, refCurrency, issueDate, formattedInvoiceDate]);

  // Rata activă: customRate dacă a fost modificată manual, altfel rata oficială din acea zi
  const activeRate = useMemo(() => {
    if (customRate && !isNaN(parseFloat(customRate)) && parseFloat(customRate) > 0) {
      return parseFloat(customRate);
    }
    return bnrRateInfo?.rate || (refCurrency === "EUR" ? 5.3527 : 4.7616);
  }, [customRate, bnrRateInfo, refCurrency]);

  const activeRateStr = activeRate.toFixed(4);

  // Generare text oficial pentru factură
  const generatedText = useMemo(() => {
    const targetDate = formattedInvoiceDate || bnrRateInfo?.dateStr;
    const dateText = targetDate ? ` la data de ${targetDate}` : "";
    const rateText = `1 ${refCurrency} = ${activeRateStr} RON`;

    if (currency === "RON") {
      const equiv =
        total > 0 && activeRate > 0
          ? ` (Echivalent: ${(total / activeRate).toLocaleString("ro-RO", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} ${refCurrency})`
          : "";
      return `Factură emisă la cursul BNR${dateText}: ${rateText}${equiv}.`;
    }

    // Factură în valută (EUR, USD etc.)
    const totalRon = total * activeRate;
    const vatRon = totalVAT * activeRate;
    const formattedTotalRon = totalRon.toLocaleString("ro-RO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const formattedVatRon = vatRon.toLocaleString("ro-RO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const isTotalRelevant = total > 0;
    const totalDetails = isTotalRelevant
      ? ` (Total: ${total.toLocaleString("ro-RO", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} ${currency} = ${formattedTotalRon} RON, TVA: ${formattedVatRon} RON)`
      : "";

    return `Curs BNR${dateText}: ${rateText}${totalDetails}.`;
  }, [refCurrency, activeRateStr, bnrRateInfo, formattedInvoiceDate, currency, total, totalVAT, activeRate]);

  // Actualizare automată a textului din mențiuni când toggle-ul este activ
  useEffect(() => {
    if (!isEnabled) return;

    const currentNotes = notes || "";
    const hasBnr = BNR_LINE_REGEX.test(currentNotes);

    if (hasBnr) {
      const updated = currentNotes.replace(BNR_LINE_REGEX, `${generatedText}\n`);
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
      const updated = currentNotes.replace(BNR_LINE_REGEX, "");
      const finalNotes = updated.trim() ? `${generatedText}\n${updated.trim()}` : generatedText;
      onNotesChange(finalNotes);
      toast.success("Cursul BNR a fost adăugat pe factură");
    } else {
      const updated = currentNotes.replace(BNR_LINE_REGEX, "").trim();
      onNotesChange(updated);
      toast.info("Cursul BNR a fost eliminat din mențiuni");
    }
  };

  return (
    <div
      className={`inline-flex items-center gap-2.5 shrink-0 ${className}`}
      title={isEnabled ? generatedText : "Activează includerea cursului BNR pe factură"}
    >
      <label className="inline-flex items-center gap-2 cursor-pointer select-none whitespace-nowrap shrink-0">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
          Curs BNR
        </span>
        <Switch
          checked={isEnabled}
          onCheckedChange={handleToggle}
        />
      </label>

      {isEnabled && (
        <div className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 pl-2.5 border-l border-slate-200 dark:border-slate-700 shrink-0">
          <span className="text-slate-500 font-medium">1</span>
          
          <select
            value={refCurrency}
            onChange={(e) => {
              setRefCurrency(e.target.value);
              setCustomRate("");
            }}
            className="h-8 min-w-[65px] px-2 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs"
          >
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
            <option value="CHF">CHF</option>
          </select>

          <span className="text-slate-500 font-medium">=</span>

          <input
            type="number"
            step="0.0001"
            placeholder={bnrRateInfo?.rateStr || "5.3527"}
            value={customRate || bnrRateInfo?.rateStr || ""}
            onChange={(e) => setCustomRate(e.target.value)}
            className="w-20 h-8 px-2 text-xs font-mono font-bold rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
          />

          <span className="font-semibold text-slate-700 dark:text-slate-300">RON</span>

          {customRate && (
            <button
              type="button"
              onClick={() => setCustomRate("")}
              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
              title="Revino la cursul oficial BNR"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default BnrInvoiceRateToggle;
