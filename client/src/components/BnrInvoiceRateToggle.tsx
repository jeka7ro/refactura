import React, { useState, useEffect, useMemo } from "react";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Coins, Calendar, RotateCcw, Check, Copy, TrendingUp, Info } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, type Currency } from "@/lib/store";

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
  const { data: bnrData, isLoading } = trpc.system.getBnrRates.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  // Dacă moneda facturii se schimbă și este EUR/USD, adaptăm moneda de referință
  useEffect(() => {
    if (currency && currency !== "RON") {
      setRefCurrency(currency);
    }
  }, [currency]);

  // Căutăm cursul BNR din data emiterii (sau din ultima zi bancară anterioară dacă e weekend/sărbătoare conform Codului Fiscal)
  const bnrRateInfo = useMemo(() => {
    if (!bnrData) return null;

    let targetRate = bnrData.rates?.[refCurrency] || (refCurrency === "EUR" ? 5.3527 : 4.7616);
    let rateDate = bnrData.formattedDate || "";

    if (issueDate && Array.isArray(bnrData.history) && bnrData.history.length > 0) {
      // 1. Căutare exactă după data emiterii
      let matched = bnrData.history.find((h: any) => h.date === issueDate);

      // 2. Dacă nu e zi bancară (weekend/sărbătoare), căutăm cea mai recentă zi lucrătoare anterioară
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
        rateDate = matched.formattedDate || matched.date;
      }
    }

    if (!rateDate && issueDate) {
      const parts = issueDate.split("-");
      if (parts.length === 3) rateDate = `${parts[2]}.${parts[1]}.${parts[0]}`;
    }

    return {
      rate: targetRate,
      rateStr: targetRate.toFixed(4),
      dateStr: rateDate || bnrData.formattedDate || "din acea zi",
    };
  }, [bnrData, refCurrency, issueDate]);

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
    const dateText = bnrRateInfo?.dateStr ? ` la data de ${bnrRateInfo.dateStr}` : "";
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
  }, [refCurrency, activeRateStr, bnrRateInfo, currency, total, totalVAT, activeRate]);

  // Actualizare automată a textului din mențiuni când toggle-ul este activ
  useEffect(() => {
    if (!isEnabled) return;

    const currentNotes = notes || "";
    const hasBnr = BNR_LINE_REGEX.test(currentNotes);

    if (hasBnr) {
      // Înlocuim doar linia de curs cu cea nouă actualizată
      const updated = currentNotes.replace(BNR_LINE_REGEX, `${generatedText}\n`);
      if (updated.trim() !== currentNotes.trim()) {
        onNotesChange(updated.trimEnd());
      }
    } else {
      // Adăugăm la începutul mențiunilor
      const updated = currentNotes ? `${generatedText}\n${currentNotes}` : generatedText;
      onNotesChange(updated);
    }
  }, [isEnabled, generatedText]);

  // Comutare toggle
  const handleToggle = (checked: boolean) => {
    setIsEnabled(checked);
    const currentNotes = notes || "";

    if (checked) {
      // Adăugare
      const updated = currentNotes.replace(BNR_LINE_REGEX, "");
      const finalNotes = updated.trim() ? `${generatedText}\n${updated.trim()}` : generatedText;
      onNotesChange(finalNotes);
      toast.success("Cursul valutar BNR a fost inclus pe factură");
    } else {
      // Eliminare
      const updated = currentNotes.replace(BNR_LINE_REGEX, "").trim();
      onNotesChange(updated);
      toast.info("Cursul valutar a fost eliminat din mențiuni");
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
      className={`rounded-xl border transition-all duration-200 ${
        isEnabled
          ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/80 shadow-xs"
          : "bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 hover:border-slate-300"
      } ${className}`}
    >
      {/* Header bar with toggle */}
      <div className="flex items-center justify-between p-3 sm:px-4">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              isEnabled
                ? "bg-amber-500 text-white shadow-xs"
                : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
            }`}
          >
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                Curs Valutar BNR din data emiterii
              </span>
              {bnrRateInfo && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-semibold shadow-2xs">
                  1 {refCurrency} = {activeRateStr} RON
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Include automat cursul de schimb oficial pe factură (Art. 319 Cod Fiscal)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Switch checked={isEnabled} onCheckedChange={handleToggle} />
        </div>
      </div>

      {/* Expanded panel when enabled */}
      {isEnabled && (
        <div className="px-3 pb-3 sm:px-4 sm:pb-4 pt-1 border-t border-amber-200/80 dark:border-amber-900/60 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1.5">
            {/* Currency selector */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Monedă Referință
              </label>
              <select
                value={refCurrency}
                onChange={(e) => {
                  setRefCurrency(e.target.value);
                  setCustomRate("");
                }}
                className="w-full h-8 px-2.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="EUR">EUR (Euro)</option>
                <option value="USD">USD (Dolar SUA)</option>
                <option value="GBP">GBP (Liră Sterlină)</option>
                <option value="CHF">CHF (Franc Elvețian)</option>
              </select>
            </div>

            {/* Rate Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Curs (1 {refCurrency} = RON)
                </label>
                {customRate && (
                  <button
                    type="button"
                    onClick={() => setCustomRate("")}
                    className="text-[10px] text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-0.5"
                    title="Revino la cursul BNR oficial"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    Reset
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="0.0001"
                  placeholder={bnrRateInfo?.rateStr || "5.3527"}
                  value={customRate || bnrRateInfo?.rateStr || ""}
                  onChange={(e) => setCustomRate(e.target.value)}
                  className="w-full h-8 px-2.5 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Date info */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Data Cursului BNR
              </label>
              <div className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800/80 flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-medium">{bnrRateInfo?.dateStr || issueDate || "Data emiterii"}</span>
              </div>
            </div>
          </div>

          {/* Generated Text Box */}
          <div className="p-2.5 rounded-lg bg-white/90 dark:bg-slate-900/90 border border-amber-200/80 dark:border-amber-800/50 flex items-start justify-between gap-2 shadow-2xs">
            <div className="flex items-start gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/80 px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                Pe factură
              </span>
              <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-mono">
                {generatedText}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyText}
              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              title="Copiază textul"
            >
              {isCopied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default BnrInvoiceRateToggle;
