import React, { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Calculator,
  ArrowLeftRight,
  Copy,
  Check,
  ArrowDown,
  X,
  RotateCcw,
} from "lucide-react";
import {
  EuFlag,
  UsFlag,
  RoFlag,
  GbFlag,
  ChFlag,
  MdFlag,
} from "@/components/CurrencyFlags";
import { cn } from "@/lib/utils";

export type SupportedCurrency = "EUR" | "RON" | "USD" | "GBP" | "CHF" | "MDL";

export interface CurrencyOption {
  code: SupportedCurrency;
  name: string;
  symbol: string;
  FlagComponent: React.ComponentType<{ className?: string }>;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: "EUR", name: "Euro", symbol: "€", FlagComponent: EuFlag },
  { code: "RON", name: "Leu Românesc", symbol: "lei", FlagComponent: RoFlag },
  { code: "USD", name: "Dolar American", symbol: "$", FlagComponent: UsFlag },
  { code: "GBP", name: "Liră Sterlină", symbol: "£", FlagComponent: GbFlag },
  { code: "CHF", name: "Franc Elvețian", symbol: "CHF", FlagComponent: ChFlag },
  { code: "MDL", name: "Leu Moldovenesc", symbol: "MDL", FlagComponent: MdFlag },
];

export const PRESETS = [50, 100, 200, 300, 500, 1000];

export interface InvoiceCurrencyCalculatorProps {
  currentCurrency?: string;
  activeExchangeRate?: number;
  issueDate?: string;
  onApplyPrice?: (price: number, lineId?: string) => void;
  onSelectCurrency?: (curr: string) => void;
  activeLineIndex?: number;
  lines?: Array<{ id: string; description: string; unitPrice?: number | string }>;
  invoiceTotal?: number;
  trigger?: React.ReactNode;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  initialAmount?: string;
  initialFromCurrency?: SupportedCurrency;
  initialToCurrency?: SupportedCurrency;
}

export function InvoiceCurrencyCalculator({
  currentCurrency = "RON",
  activeExchangeRate,
  issueDate,
  onApplyPrice,
  onSelectCurrency,
  activeLineIndex = 0,
  lines,
  invoiceTotal,
  trigger,
  isOpen,
  onOpenChange,
  className,
  initialAmount = "300",
  initialFromCurrency = "EUR",
  initialToCurrency = "RON",
}: InvoiceCurrencyCalculatorProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const [amount, setAmount] = useState<string>(initialAmount);
  const [fromCurrency, setFromCurrency] = useState<SupportedCurrency>(initialFromCurrency);
  const [toCurrency, setToCurrency] = useState<SupportedCurrency>(initialToCurrency);
  const [copied, setCopied] = useState(false);
  const [customRate, setCustomRate] = useState<string>("");
  const [useCustomRate, setUseCustomRate] = useState(false);
  const [selectedLineId, setSelectedLineId] = useState<string>("");

  // Sincronizare selectedLineId cu liniile curente (fallback automat pe linia 1 dacă linia selectată nu mai există)
  useEffect(() => {
    if (lines && lines.length > 0) {
      const exists = lines.some(l => l.id === selectedLineId);
      if (!exists) {
        const activeLine = lines[activeLineIndex] || lines[0];
        if (activeLine) {
          setSelectedLineId(activeLine.id);
        }
      }
    } else if (selectedLineId) {
      setSelectedLineId("");
    }
  }, [lines, activeLineIndex, selectedLineId]);

  const { data: bnrData } = trpc.system.getBnrRates.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
  });

  const bnrDate = bnrData?.formattedDate || new Date().toLocaleDateString("ro-RO");

  // Preluare curs istoric dacă data emiterii este furnizată
  const historicalRate = useMemo(() => {
    if (!bnrData || !issueDate || !Array.isArray(bnrData.history) || bnrData.history.length === 0) {
      return null;
    }
    let matched = bnrData.history.find((h: any) => h.date === issueDate);
    if (!matched) {
      const sortedPrior = [...bnrData.history]
        .filter((h: any) => h.date <= issueDate)
        .sort((a: any, b: any) => b.date.localeCompare(a.date));
      if (sortedPrior.length > 0) {
        matched = sortedPrior[0];
      }
    }
    return matched || null;
  }, [bnrData, issueDate]);

  const ratesMap: Record<SupportedCurrency, number> = useMemo(() => {
    const liveRates = bnrData?.rates || {};
    const hist: any = historicalRate || {};

    // Prioritate maximă: cursul activ setat pe factură (ex: 5.3370)
    const resolvedEur =
      activeExchangeRate && activeExchangeRate > 0
        ? activeExchangeRate
        : hist.EUR || liveRates.EUR || 5.3370;

    const resolvedUsd = hist.USD || liveRates.USD || 4.7571;
    const resolvedGbp = hist.GBP || liveRates.GBP || 6.3104;
    const resolvedChf = hist.CHF || liveRates.CHF || 5.7356;
    const resolvedMdl = hist.MDL || liveRates.MDL || 0.2656;

    return {
      RON: 1,
      EUR: resolvedEur,
      USD: resolvedUsd,
      GBP: resolvedGbp,
      CHF: resolvedChf,
      MDL: resolvedMdl,
    };
  }, [bnrData, historicalRate, activeExchangeRate]);

  // Rata oficială BNR dintre fromCurrency și toCurrency
  const officialPairRate = useMemo(() => {
    const fromRateInRon = ratesMap[fromCurrency] || 1;
    const toRateInRon = ratesMap[toCurrency] || 1;
    if (toRateInRon === 0) return 1;
    return fromRateInRon / toRateInRon;
  }, [fromCurrency, toCurrency, ratesMap]);

  const effectiveRate = useMemo(() => {
    if (useCustomRate && customRate) {
      const parsed = parseFloat(customRate.replace(",", "."));
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return officialPairRate;
  }, [useCustomRate, customRate, officialPairRate]);

  // Conversie calculată
  const parsedAmount = useMemo(() => {
    const clean = amount.replace(/\s/g, "").replace(",", ".");
    const num = parseFloat(clean);
    return isNaN(num) || num < 0 ? 0 : num;
  }, [amount]);

  const convertedResult = useMemo(() => {
    return parsedAmount * effectiveRate;
  }, [parsedAmount, effectiveRate]);

  const handleSwap = () => {
    const temp = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(temp);
    setUseCustomRate(false);
    setCustomRate("");
  };

  const handleCopy = (val: number) => {
    const formatted = val.toFixed(2);
    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentPairDisplay = useMemo(() => {
    return `1 ${fromCurrency} = ${effectiveRate.toFixed(4)} ${toCurrency}`;
  }, [fromCurrency, effectiveRate, toCurrency]);

  const currentLineIndexDisplay = useMemo(() => {
    if (!lines || lines.length === 0) return 1;
    const foundIdx = lines.findIndex(l => l.id === selectedLineId);
    return foundIdx >= 0 ? foundIdx + 1 : activeLineIndex + 1;
  }, [lines, selectedLineId, activeLineIndex]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <button
            type="button"
            className={cn(
              "p-1 rounded text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer inline-flex items-center justify-center",
              className
            )}
            title="Calculator Valutar BNR"
          >
            <Calculator className="w-3.5 h-3.5" />
          </button>
        )}
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="end"
        sideOffset={6}
        avoidCollisions={true}
        collisionPadding={10}
        style={{
          maxHeight: "min(385px, var(--radix-popper-available-height, 385px))",
        }}
        className="w-[340px] sm:w-[380px] overflow-hidden flex flex-col p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 animate-in fade-in-50 zoom-in-95"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
              <Calculator className="w-3 h-3" />
            </div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                Calculator Valutar BNR
              </h4>
              <span className="text-[10px] text-slate-400 font-mono">
                ({bnrDate})
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scrollable Body for middle content */}
        <div
          className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1 py-1 -mr-1 overscroll-contain"
          style={{
            scrollbarWidth: "thin",
          }}
        >
          {/* Butoane rapide de comutare direcție: EUR ➔ RON vs RON ➔ EUR */}
          <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 dark:bg-slate-800/80 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setFromCurrency("EUR");
                setToCurrency("RON");
                setUseCustomRate(false);
                setCustomRate("");
              }}
              className={cn(
                "flex items-center justify-center gap-1.5 py-1 px-2 rounded-md text-[11px] font-bold transition-all cursor-pointer",
                fromCurrency === "EUR" && toCurrency === "RON"
                  ? "bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              <EuFlag className="w-3.5 h-2.5" />
              <span>EUR ➔ RON</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFromCurrency("RON");
                setToCurrency("EUR");
                setUseCustomRate(false);
                setCustomRate("");
              }}
              className={cn(
                "flex items-center justify-center gap-1.5 py-1 px-2 rounded-md text-[11px] font-bold transition-all cursor-pointer",
                fromCurrency === "RON" && toCurrency === "EUR"
                  ? "bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              <RoFlag className="w-3.5 h-2.5" />
              <span>RON ➔ EUR</span>
            </button>
          </div>

          {/* Input sumă & valută sursă / destinație */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Sumă de convertit
              </label>
              <span className="text-[10px] font-mono text-slate-400">
                {fromCurrency} ➔ {toCurrency}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="ex: 300"
                  className="w-full h-7 px-2 text-xs font-bold rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Select From */}
              <select
                value={fromCurrency}
                onChange={e => setFromCurrency(e.target.value as SupportedCurrency)}
                className="h-7 px-1.5 text-xs font-bold rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none cursor-pointer"
              >
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>

              {/* Swap Button */}
              <button
                type="button"
                onClick={handleSwap}
                className="h-7 w-7 flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors shrink-0 cursor-pointer"
                title="Inversează direcția de conversie"
              >
                <ArrowLeftRight className="w-3 h-3" />
              </button>

              {/* Select To */}
              <select
                value={toCurrency}
                onChange={e => setToCurrency(e.target.value as SupportedCurrency)}
                className="h-7 px-1.5 text-xs font-bold rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none cursor-pointer"
              >
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Amount Presets */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] text-slate-400 font-semibold mr-0.5">Preset:</span>
            {PRESETS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(String(p))}
                className={cn(
                  "px-1.5 py-0.5 text-[10px] font-mono font-medium rounded border transition-colors cursor-pointer",
                  amount === String(p)
                    ? "bg-emerald-600 text-white border-emerald-600 font-bold"
                    : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                )}
              >
                {p} {fromCurrency}
              </button>
            ))}

            {invoiceTotal !== undefined && invoiceTotal > 0 && (
              <button
                type="button"
                onClick={() => {
                  setAmount(invoiceTotal.toFixed(2));
                  if (currentCurrency === "RON" && fromCurrency !== "RON") {
                    setFromCurrency("RON");
                    setToCurrency("EUR");
                  } else if (currentCurrency === "EUR" && fromCurrency !== "EUR") {
                    setFromCurrency("EUR");
                    setToCurrency("RON");
                  }
                }}
                className="px-1.5 py-0.5 text-[10px] font-medium rounded border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-colors cursor-pointer"
                title="Folosește totalul actual al facturii"
              >
                Total: {invoiceTotal.toFixed(2)}
              </button>
            )}
          </div>

          {/* Rezultat conversie card */}
          <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-50 via-teal-50/70 to-emerald-100/50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-emerald-900/30 border border-emerald-200 dark:border-emerald-800/70 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400 font-medium text-[10px]">
                Echivalent la cursul BNR:
              </span>
              <span className="font-mono font-bold text-emerald-800 dark:text-emerald-300 text-[10px] bg-emerald-100/80 dark:bg-emerald-900/60 px-1.5 py-0.2 rounded">
                {currentPairDisplay}
              </span>
            </div>

            <div className="flex items-baseline justify-between gap-2">
              <div className="text-lg font-black text-slate-900 dark:text-white tracking-tight tabular-nums">
                {convertedResult.toLocaleString("ro-RO", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  {toCurrency}
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleCopy(convertedResult)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-semibold rounded bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-slate-700 transition-colors shadow-2xs shrink-0 cursor-pointer"
                title="Copiază suma calculată"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-600 font-bold text-[10px]">Copiat!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span className="text-[10px]">Copiază</span>
                  </>
                )}
              </button>
            </div>

            <div className="text-[9px] text-slate-500 dark:text-slate-400 pt-0.5 border-t border-emerald-200/60 dark:border-emerald-800/50 flex items-center justify-between">
              <span>
                {parsedAmount.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} {fromCurrency} × {effectiveRate.toFixed(4)}
              </span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                = {convertedResult.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {toCurrency}
              </span>
            </div>
          </div>

          {/* Custom Rate Toggle (opțional pt contracte cu curs fix) */}
          <div className="pt-0.5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setUseCustomRate(!useCustomRate)}
              className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              {useCustomRate ? "Folosește cursul oficial BNR" : "Ai un curs negociat / diferit?"}
            </button>
            {useCustomRate && (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.0001"
                  placeholder={officialPairRate.toFixed(4)}
                  value={customRate}
                  onChange={e => setCustomRate(e.target.value)}
                  className="w-20 h-5 px-1.5 text-xs font-mono rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-right"
                />
                <button
                  type="button"
                  onClick={() => {
                    setCustomRate("");
                    setUseCustomRate(false);
                  }}
                  className="p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Resetează la BNR"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Butoane Acțiuni Directe în Factură (Footer Vizibil Permanent) */}
        <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-1 shrink-0 bg-white dark:bg-slate-900">
          {lines && lines.length > 1 && onApplyPrice && (
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 shrink-0">
                Aplică pe linia:
              </label>
              <select
                value={selectedLineId || lines[0]?.id}
                onChange={e => setSelectedLineId(e.target.value)}
                className="h-6 text-xs px-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex-1 truncate"
              >
                {lines.map((l, i) => (
                  <option key={l.id} value={l.id}>
                    Linia {i + 1}: {l.description ? (l.description.length > 22 ? l.description.slice(0, 22) + "..." : l.description) : "Produs/Serviciu"} ({l.unitPrice || 0} {currentCurrency})
                  </option>
                ))}
              </select>
            </div>
          )}

          {onApplyPrice && (
            <button
              type="button"
              onClick={() => {
                const validTargetId =
                  lines && lines.some(l => l.id === selectedLineId)
                    ? selectedLineId
                    : (lines && lines[0]?.id) || "";
                onApplyPrice(parseFloat(convertedResult.toFixed(2)), validTargetId);
                setOpen(false);
              }}
              className="w-full flex items-center justify-center gap-1.5 h-7.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span>
                Aplică {convertedResult.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {toCurrency} pe linia {currentLineIndexDisplay}
              </span>
            </button>
          )}

          {onSelectCurrency && toCurrency !== currentCurrency && (
            <button
              type="button"
              onClick={() => {
                onSelectCurrency(toCurrency);
              }}
              className="w-full flex items-center justify-center gap-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition-colors cursor-pointer"
            >
              <ArrowLeftRight className="w-3 h-3" />
              <span>Schimbă moneda facturii în <strong>{toCurrency}</strong></span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
