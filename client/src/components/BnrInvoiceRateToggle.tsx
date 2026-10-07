import React, { useState, useEffect, useMemo } from "react";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { RotateCcw, Check, Copy } from "lucide-react";
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
  const [isCopied, setIsCopied] = useState(false);

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

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(generatedText);
      setIsCopied(true);
      toast.success("Textul cursului valutar a fost copiat");
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error("Eroare la copiere");
    }
  };

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs transition-colors ${className}`}
    >
      {/* Partea stângă: Toggle compact + parametri inline vizibili clar */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <Switch
            checked={isEnabled}
            onCheckedChange={handleToggle}
          />
          <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs whitespace-nowrap">
            Curs BNR pe factură
          </span>
        </label>

        {isEnabled ? (
          <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 pl-3 border-l border-slate-200 dark:border-slate-700">
            <span className="font-medium text-slate-600 dark:text-slate-400">1</span>
            
            {/* Dropdown monedă - înălțime h-8 pentru lizibilitate completă */}
            <select
              value={refCurrency}
              onChange={(e) => {
                setRefCurrency(e.target.value);
                setCustomRate("");
              }}
              className="h-8 min-w-[70px] px-2.5 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs"
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="CHF">CHF</option>
            </select>

            <span className="font-medium text-slate-600 dark:text-slate-400">=</span>

            {/* Input curs valutar */}
            <input
              type="number"
              step="0.0001"
              placeholder={bnrRateInfo?.rateStr || "5.3527"}
              value={customRate || bnrRateInfo?.rateStr || ""}
              onChange={(e) => setCustomRate(e.target.value)}
              className="w-24 h-8 px-2.5 text-xs font-mono font-bold rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
            />
            
            <span className="font-semibold text-slate-700 dark:text-slate-300">RON</span>

            {customRate && (
              <button
                type="button"
                onClick={() => setCustomRate("")}
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 ml-1"
                title="Revino la cursul oficial BNR"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            )}

            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 ml-1">
              ({formattedInvoiceDate || bnrRateInfo?.dateStr})
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-slate-400 dark:text-slate-500 pl-2.5 border-l border-slate-200 dark:border-slate-700">
            (1 {refCurrency} = {activeRateStr} RON &bull; {formattedInvoiceDate})
          </span>
        )}
      </div>

      {/* Partea dreaptă: Previzualizare text curat pe o singură linie */}
      {isEnabled && (
        <div className="flex items-center gap-2 max-w-full sm:max-w-md ml-auto">
          <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate font-mono bg-slate-50 dark:bg-slate-800/60 px-2 py-1 rounded border border-slate-200/60 dark:border-slate-700/60">
            {generatedText}
          </span>
          <button
            type="button"
            onClick={handleCopyText}
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shrink-0"
            title="Copiază textul"
          >
            {isCopied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default BnrInvoiceRateToggle;
