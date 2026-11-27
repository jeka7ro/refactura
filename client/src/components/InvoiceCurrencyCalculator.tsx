import React, { useState, useMemo, useEffect, useRef } from "react";
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
  const wasOpenRef = useRef<boolean>(false);
  const prevLinesCountRef = useRef<number>(lines?.length || 0);

  // Sincronizare inteligentă selectedLineId:
  // 1) Dacă s-a adăugat un rând nou (ex: Rândul 3), îl selectează automat
  // 2) La deschiderea calculatorului, selectează automat linia activă fără preț sau primul rând cu preț 0 (ex: Rândul 3)
  useEffect(() => {
    if (!lines || lines.length === 0) {
      if (selectedLineId) setSelectedLineId("");
      prevLinesCountRef.current = 0;
      return;
    }

    const prevCount = prevLinesCountRef.current;
    prevLinesCountRef.current = lines.length;

    if (lines.length > prevCount && prevCount > 0) {
      const newestLine = lines[lines.length - 1];
      if (newestLine) {
        setSelectedLineId(newestLine.id);
        return;
      }
    }

    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;

    if (justOpened && selectedLineId !== "__ALL__") {
      const activeCandidate = lines[activeLineIndex];
      const isZeroPrice = (l?: { unitPrice?: number | string }) =>
        !l || !l.unitPrice || parseFloat(String(l.unitPrice)) === 0;

      if (activeCandidate && isZeroPrice(activeCandidate)) {
        setSelectedLineId(activeCandidate.id);
        return;
      }
      const firstUnpriced = lines.find(l => isZeroPrice(l));
      if (firstUnpriced) {
        setSelectedLineId(firstUnpriced.id);
        return;
      }
      if (activeCandidate) {
        setSelectedLineId(activeCandidate.id);
        return;
      }
    }

    if (selectedLineId === "__ALL__") {
      if (lines.length <= 1) setSelectedLineId(lines[0].id);
      return;
    }

    const exists = lines.some(l => String(l.id) === String(selectedLineId));
    if (!exists) {
      const activeLine = lines[activeLineIndex] || lines[0];
      if (activeLine) {
        setSelectedLineId(activeLine.id);
      }
    }
  }, [lines, activeLineIndex, selectedLineId, open]);

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
    const liveRates: Record<string, number> = (bnrData?.rates as unknown as Record<string, number>) || {};
    const hist: Record<string, number> = (historicalRate as unknown as Record<string, number>) || {};

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
    if (selectedLineId === "__ALL__") return -1;
    const foundIdx = lines.findIndex(l => String(l.id) === String(selectedLineId));
    return foundIdx >= 0 ? foundIdx + 1 : Math.min(lines.length, Math.max(1, activeLineIndex + 1));
  }, [lines, selectedLineId, activeLineIndex]);

  const formatLineShortLabel = (desc?: string, idx = 0) => {
    const clean = (desc || "").trim();
    if (!clean) return `Produs/Serviciu`;
    if (clean.length <= 28) return clean;
    return `${clean.slice(0, 15).trimEnd()}…${clean.slice(-13).trimStart()}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <button
            type="button"
            className={cn(
              "p-1 rounded-lg text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer inline-flex items-center justify-center",
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
        collisionPadding={12}
        onFocusOutside={e => {
          const target = e.target as HTMLElement | null;
          if (target && target.tagName === "SELECT") {
            e.preventDefault();
          }
        }}
        style={{
          maxHeight: "min(540px, var(--radix-popper-available-height, 540px))",
        }}
        className="w-[348px] sm:w-[396px] overflow-hidden flex flex-col p-3.5 !bg-white dark:!bg-[#1c1c1e] !backdrop-blur-none rounded-[22px] border border-black/[0.08] dark:border-white/[0.12] shadow-2xl z-50 animate-in fade-in-50 zoom-in-95"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] pb-1.5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-emerald-500/12 dark:bg-emerald-500/18 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
              <Calculator className="w-3 h-3" />
            </div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
                Calculator valutar BNR
              </h4>
              <span className="text-[10.5px] text-[#6e6e73] dark:text-[#98989d] tabular-nums">
                ({bnrDate})
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1 rounded-full text-[#8e8e93] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scrollable Body for middle content */}
        <div
          className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 py-1.5 -mr-1 overscroll-contain"
          style={{
            scrollbarWidth: "thin",
          }}
        >
          {/* Butoane rapide de comutare direcție: EUR RON vs RON EUR */}
          <div className="apple-segmented w-full grid grid-cols-2">
            <button
              type="button"
              data-active={fromCurrency === "EUR" && toCurrency === "RON"}
              onClick={() => {
                setFromCurrency("EUR");
                setToCurrency("RON");
                setUseCustomRate(false);
                setCustomRate("");
              }}
              className="apple-segmented-item w-full"
            >
              <EuFlag className="w-3.5 h-2.5" />
              <span>EUR → RON</span>
            </button>
            <button
              type="button"
              data-active={fromCurrency === "RON" && toCurrency === "EUR"}
              onClick={() => {
                setFromCurrency("RON");
                setToCurrency("EUR");
                setUseCustomRate(false);
                setCustomRate("");
              }}
              className="apple-segmented-item w-full"
            >
              <RoFlag className="w-3.5 h-2.5" />
              <span>RON → EUR</span>
            </button>
          </div>

          {/* Input sumă & valută sursă / destinație */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] block">
                Sumă de convertit
              </label>
              <span className="text-[10.5px] tabular-nums text-[#8e8e93]">
                {fromCurrency} → {toCurrency}
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
                  className="w-full h-8 px-2.5 text-xs font-bold tabular-nums rounded-lg border border-black/[0.08] dark:border-white/[0.10] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none focus:bg-white dark:focus:bg-[#2c2c2e] focus:ring-2 focus:ring-primary/25"
                />
              </div>

              {/* Select From */}
              <select
                value={fromCurrency}
                onChange={e => setFromCurrency(e.target.value as SupportedCurrency)}
                className="h-8 py-0 px-2.5 text-xs font-semibold leading-normal rounded-lg border border-black/[0.08] dark:border-white/[0.10] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none cursor-pointer"
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
                className="apple-btn-glass h-8 w-8 flex items-center justify-center text-[#1d1d1f] dark:text-[#f5f5f7] shrink-0 cursor-pointer"
                title="Inversează direcția de conversie"
              >
                <ArrowLeftRight className="w-3 h-3" />
              </button>

              {/* Select To */}
              <select
                value={toCurrency}
                onChange={e => setToCurrency(e.target.value as SupportedCurrency)}
                className="h-8 py-0 px-2.5 text-xs font-semibold leading-normal rounded-lg border border-black/[0.08] dark:border-white/[0.10] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none cursor-pointer"
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
            <span className="text-[10.5px] text-[#6e6e73] dark:text-[#98989d] font-medium mr-0.5">Preset:</span>
            {PRESETS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(String(p))}
                className={cn(
                  "px-2 py-0.5 text-[10.5px] tabular-nums font-medium rounded-full border transition-colors cursor-pointer",
                  amount === String(p)
                    ? "bg-primary text-white border-transparent font-semibold"
                    : "bg-[#f2f2f7] dark:bg-[#2c2c2e] border-black/[0.06] dark:border-white/[0.08] text-[#1d1d1f] dark:text-[#ebebf5] hover:bg-black/[0.08] dark:hover:bg-white/[0.14]"
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
                className="px-2 py-0.5 text-[10.5px] tabular-nums font-medium rounded-full border border-[#0071e3]/20 bg-[#0071e3]/10 dark:bg-[#0a84ff]/18 text-[#0071e3] dark:text-[#64d2ff] hover:bg-[#0071e3]/16 transition-colors cursor-pointer"
                title="Folosește totalul actual al facturii"
              >
                Total: {invoiceTotal.toFixed(2)}
              </button>
            )}
          </div>

          {/* Rezultat conversie card */}
          <div className="p-2.5 rounded-xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.08] space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#6e6e73] dark:text-[#98989d] font-medium text-[11px]">
                Echivalent la cursul BNR:
              </span>
              <span className="tabular-nums font-semibold text-emerald-700 dark:text-emerald-300 text-[10.5px] bg-emerald-500/12 dark:bg-emerald-500/18 px-2 py-0.5 rounded-full">
                {currentPairDisplay}
              </span>
            </div>

            <div className="flex items-baseline justify-between gap-2">
              <div className="text-lg font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight tabular-nums">
                {convertedResult.toLocaleString("ro-RO", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                <span className="text-xs font-semibold text-[#6e6e73] dark:text-[#98989d]">
                  {toCurrency}
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleCopy(convertedResult)}
                className="apple-btn-glass inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] shrink-0 cursor-pointer"
                title="Copiază suma calculată"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[10.5px]">Copiat!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span className="text-[10.5px]">Copiază</span>
                  </>
                )}
              </button>
            </div>

            <div className="text-[10.5px] tabular-nums text-[#6e6e73] dark:text-[#98989d] pt-1 border-t border-black/[0.05] dark:border-white/[0.07] flex items-center justify-between">
              <span>
                {parsedAmount.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} {fromCurrency} × {effectiveRate.toFixed(4)}
              </span>
              <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                = {convertedResult.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {toCurrency}
              </span>
            </div>
          </div>

          {/* Custom Rate Toggle (opțional pt contracte cu curs fix) */}
          <div className="pt-0.5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setUseCustomRate(!useCustomRate)}
              className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] transition-colors cursor-pointer"
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
                  className="w-20 h-6 px-1.5 text-xs tabular-nums rounded-md border border-black/[0.08] dark:border-white/[0.10] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] text-right"
                />
                <button
                  type="button"
                  onClick={() => {
                    setCustomRate("");
                    setUseCustomRate(false);
                  }}
                  className="p-0.5 text-[#8e8e93] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] cursor-pointer"
                  title="Resetează la BNR"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Butoane Acțiuni Directe în Factură (Footer Vizibil Permanent) */}
        <div className="pt-2.5 border-t border-black/[0.06] dark:border-white/[0.08] flex flex-col gap-2 shrink-0 bg-white dark:bg-[#1c1c1e]">
          {lines && lines.length > 1 && onApplyPrice && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] shrink-0">
                  Aplică pe linia:
                </label>
                {lines.length <= 6 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {lines.map((l, i) => {
                      const isSel = String(selectedLineId || lines[0]?.id) === String(l.id);
                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => setSelectedLineId(String(l.id))}
                          className={cn(
                            "h-6 px-2 text-[11px] font-semibold tabular-nums rounded-full border transition-colors cursor-pointer",
                            isSel
                              ? "bg-primary text-white border-transparent"
                              : "bg-[#f2f2f7] dark:bg-[#2c2c2e] border-black/[0.06] dark:border-white/[0.08] text-[#1d1d1f] dark:text-[#ebebf5] hover:bg-black/[0.08] dark:hover:bg-white/[0.14]"
                          )}
                          title={`Linia ${i + 1}: ${l.description || "Produs/Serviciu"}`}
                        >
                          L{i + 1}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setSelectedLineId("__ALL__")}
                      className={cn(
                        "h-6 px-2.5 text-[11px] font-semibold rounded-full border transition-colors cursor-pointer",
                        selectedLineId === "__ALL__"
                          ? "bg-primary text-white border-transparent"
                          : "bg-[#f2f2f7] dark:bg-[#2c2c2e] border-black/[0.06] dark:border-white/[0.08] text-[#1d1d1f] dark:text-[#ebebf5] hover:bg-black/[0.08] dark:hover:bg-white/[0.14]"
                      )}
                      title="Aplică prețul pe toate liniile facturii"
                    >
                      Toate
                    </button>
                  </div>
                )}
              </div>

              <select
                value={
                  selectedLineId === "__ALL__"
                    ? "__ALL__"
                    : (lines.some(l => String(l.id) === String(selectedLineId))
                        ? selectedLineId
                        : String(lines[0]?.id || ""))
                }
                onChange={e => setSelectedLineId(e.target.value)}
                className="w-full h-9 py-0 px-3 text-[12.5px] font-medium leading-normal rounded-xl border border-black/[0.08] dark:border-white/[0.12] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none cursor-pointer"
              >
                {lines.map((l, i) => (
                  <option key={l.id} value={String(l.id)}>
                    Linia {i + 1}: {formatLineShortLabel(l.description, i)} ({Number(l.unitPrice || 0).toLocaleString("ro-RO", { maximumFractionDigits: 2 })} {currentCurrency})
                  </option>
                ))}
                <option value="__ALL__">
                  Toate liniile ({lines.length} rânduri)
                </option>
              </select>
            </div>
          )}

          {onApplyPrice && (
            <button
              type="button"
              onClick={() => {
                const validTargetId =
                  selectedLineId === "__ALL__"
                    ? "__ALL__"
                    : lines && lines.some(l => String(l.id) === String(selectedLineId))
                      ? selectedLineId
                      : String((lines && (lines[activeLineIndex]?.id || lines[0]?.id)) || "");
                onApplyPrice(parseFloat(convertedResult.toFixed(2)), validTargetId);
                setOpen(false);
              }}
              className="apple-btn-prominent w-full flex items-center justify-center gap-1.5 h-9 px-3 text-white text-[12.5px] font-semibold cursor-pointer"
            >
              <ArrowDown className="w-3.5 h-3.5 shrink-0" />
              <span className="tabular-nums truncate">
                {selectedLineId === "__ALL__" && lines && lines.length > 1
                  ? `Aplică ${convertedResult.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${toCurrency} pe toate cele ${lines.length} linii`
                  : `Aplică ${convertedResult.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${toCurrency} pe linia ${currentLineIndexDisplay}`}
              </span>
            </button>
          )}

          {onSelectCurrency && toCurrency !== currentCurrency && (
            <button
              type="button"
              onClick={() => {
                onSelectCurrency(toCurrency);
              }}
              className="w-full flex items-center justify-center gap-1.5 py-1 text-[11px] font-semibold text-[#0071e3] dark:text-[#64d2ff] hover:bg-[#0071e3]/10 dark:hover:bg-[#0a84ff]/15 rounded-full transition-colors cursor-pointer"
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
