import React, { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  EuFlag,
  UsFlag,
  RoFlag,
  GbFlag,
  ChFlag,
  MdFlag,
} from "@/components/CurrencyFlags";
import {
  ArrowLeftRight,
  Calculator,
  Percent,
  TrendingUp,
  RefreshCcw,
  Copy,
  Check,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LabelList,
} from "recharts";

type CurrencyCode = "EUR" | "USD" | "RON" | "GBP" | "CHF" | "MDL";

interface CurrencyOption {
  code: CurrencyCode;
  name: string;
  FlagComponent: React.ComponentType<{ className?: string }>;
  symbol: string;
}

const CURRENCIES: CurrencyOption[] = [
  { code: "EUR", name: "Euro", FlagComponent: EuFlag, symbol: "€" },
  { code: "USD", name: "Dolar American", FlagComponent: UsFlag, symbol: "$" },
  { code: "RON", name: "Leu Românesc", FlagComponent: RoFlag, symbol: "lei" },
  { code: "GBP", name: "Liră Sterlină", FlagComponent: GbFlag, symbol: "£" },
  { code: "CHF", name: "Franc Elvețian", FlagComponent: ChFlag, symbol: "CHF" },
  { code: "MDL", name: "Leu Moldovenesc", FlagComponent: MdFlag, symbol: "MDL" },
];

const VAT_RATES = [
  { rate: 21, label: "21% (Standard România)", short: "21%" },
  { rate: 19, label: "19% (Tranzitorie)", short: "19%" },
  { rate: 9, label: "9% (HORECA / Alimente)", short: "9%" },
  { rate: 5, label: "5% (Cărți / Eco)", short: "5%" },
  { rate: 0, label: "0% (Scutit)", short: "0%" },
];

export default function CursValutar() {
  const { data: bnrData, isFetching, refetch } =
    trpc.system.getBnrRates.useQuery(undefined, {
      staleTime: 5 * 60 * 1000,
      refetchInterval: 15 * 60 * 1000,
    });

  // Rates fallback map
  const ratesMap = useMemo(() => {
    return {
      RON: 1,
      EUR: bnrData?.rates?.EUR || 5.2537,
      USD: bnrData?.rates?.USD || 4.5164,
      GBP: bnrData?.rates?.GBP || 6.1178,
      CHF: bnrData?.rates?.CHF || 5.5707,
      MDL: bnrData?.rates?.MDL || 0.262,
    };
  }, [bnrData]);

  // Converter state
  const [fromCurrency, setFromCurrency] = useState<CurrencyCode>("EUR");
  const [toCurrency, setToCurrency] = useState<CurrencyCode>("RON");
  const [convertAmount, setConvertAmount] = useState<string>("100");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // VAT calculator state - DEFAULT 21%
  const [vatMode, setVatMode] = useState<"add" | "extract">("add");
  const [vatAmountInput, setVatAmountInput] = useState<string>("100");
  const [vatRate, setVatRate] = useState<number>(21);
  const [customVatRate, setCustomVatRate] = useState<string>("");
  const [useThousandsSeparator, setUseThousandsSeparator] = useState(true);
  const [useFourDecimals, setUseFourDecimals] = useState(false);

  // Chart range & currency (7, 10, 30 zile)
  const [chartDays, setChartDays] = useState<7 | 10 | 30>(7);
  const [chartCurrency, setChartCurrency] = useState<"EUR" | "USD" | "ALL">(
    "ALL"
  );

  // Copy helper
  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 1800);
  };

  // Convert calculation
  const convertedResult = useMemo(() => {
    const num = parseFloat(convertAmount.replace(/,/g, "."));
    if (isNaN(num) || num < 0) return 0;
    const fromRon = ratesMap[fromCurrency];
    const toRon = ratesMap[toCurrency];
    if (!fromRon || !toRon) return 0;
    const ronValue = num * fromRon;
    return ronValue / toRon;
  }, [convertAmount, fromCurrency, toCurrency, ratesMap]);

  // Swap currencies
  const handleSwap = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  // Result value in LEI (RON)
  const resultInRon = useMemo(() => {
    const num = parseFloat(convertAmount.replace(/,/g, "."));
    if (isNaN(num) || num <= 0) return 0;
    if (toCurrency === "RON") return convertedResult;
    if (fromCurrency === "RON") return num;
    return num * (ratesMap[fromCurrency] || 1);
  }, [convertAmount, fromCurrency, toCurrency, convertedResult, ratesMap]);

  // AUTOMATIC SYNC: whatever is introduced in Convertor is applied to Calculator TVA in real-time
  useEffect(() => {
    if (!convertAmount || convertAmount.trim() === "") {
      setVatAmountInput("");
    } else {
      const num = parseFloat(convertAmount.replace(/,/g, "."));
      if (isNaN(num) || num <= 0) {
        setVatAmountInput("");
      } else {
        const decimals = useFourDecimals ? 4 : 2;
        const formatted = resultInRon > 0 ? resultInRon.toFixed(decimals) : "";
        setVatAmountInput(formatted);
        setVatMode("add");
      }
    }
  }, [resultInRon, convertAmount, useFourDecimals]);

  // Check if VAT input currently matches converter result
  const isSyncedWithConverter = useMemo(() => {
    if (!vatAmountInput || resultInRon <= 0) return false;
    const currentVatVal = parseFloat(vatAmountInput.replace(/,/g, "."));
    const currentRonVal = parseFloat(resultInRon.toFixed(useFourDecimals ? 4 : 2));
    return Math.abs(currentVatVal - currentRonVal) < 0.0001;
  }, [vatAmountInput, resultInRon, useFourDecimals]);

  // Transfer converter result to VAT (also scrolls smoothly)
  const transferToVat = () => {
    const decimals = useFourDecimals ? 4 : 2;
    const formatted = resultInRon > 0 ? resultInRon.toFixed(decimals) : "";
    setVatAmountInput(formatted);
    setVatMode("add");
    const el = document.getElementById("calculator-tva");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  // Active VAT rate
  const activeVatRate = customVatRate ? parseFloat(customVatRate) || 0 : vatRate;

  // VAT calculation
  const vatResults = useMemo(() => {
    const inputVal = parseFloat(vatAmountInput.replace(/,/g, ".")) || 0;
    const r = activeVatRate / 100;

    if (vatMode === "add") {
      const base = inputVal;
      const vat = base * r;
      const total = base + vat;
      return { base, vat, total };
    } else {
      const total = inputVal;
      const base = total / (1 + r);
      const vat = total - base;
      return { base, vat, total };
    }
  }, [vatAmountInput, activeVatRate, vatMode]);

  // Number format helper
  const formatNumber = (val: number, forceDecimals?: number) => {
    const decimals = forceDecimals !== undefined ? forceDecimals : useFourDecimals ? 4 : 2;
    if (!useThousandsSeparator) return val.toFixed(decimals);
    return new Intl.NumberFormat("ro-RO", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(val);
  };

  // Chart data filter (7, 10, 30 zile)
  const chartData = useMemo(() => {
    if (!bnrData?.history || !bnrData.history.length) return [];
    const count = chartDays === 7 ? 7 : chartDays === 10 ? 10 : 30;
    return bnrData.history.slice(-count);
  }, [bnrData?.history, chartDays]);

  // Current date info
  const dateStr = bnrData?.formattedDate || "10.09.2026";
  const displayDate = bnrData?.displayDate || "10 Septembrie 2026";
  const eurRate = bnrData?.rates?.EUR || 5.2537;
  const usdRate = bnrData?.rates?.USD || 4.5164;
  const gbpRate = bnrData?.rates?.GBP || 6.1178;
  const chfRate = bnrData?.rates?.CHF || 5.5707;
  const mdlRate = bnrData?.rates?.MDL || 0.262;

  const eurVar = bnrData?.variations?.EUR;
  const usdVar = bnrData?.variations?.USD;
  const crossEurUsd = bnrData?.crossRates?.EUR_USD || parseFloat((eurRate / usdRate).toFixed(4));

  // Range statistics
  const eurStats = useMemo(() => {
    if (!chartData.length) return { min: 5.25, max: 5.26, change: 0 };
    const vals = chartData.map(d => d.EUR);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const first = vals[0];
    const last = vals[vals.length - 1];
    const change = parseFloat((((last - first) / first) * 100).toFixed(2));
    return { min, max, change };
  }, [chartData]);

  const usdStats = useMemo(() => {
    if (!chartData.length) return { min: 4.51, max: 4.54, change: 0 };
    const vals = chartData.map(d => d.USD);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const first = vals[0];
    const last = vals[vals.length - 1];
    const change = parseFloat((((last - first) / first) * 100).toFixed(2));
    return { min, max, change };
  }, [chartData]);

  // Custom high-contrast label renderer for EUR points
  const renderEurLabel = (props: any) => {
    const { x, y, value, index } = props;
    if (value === undefined || value === null) return null;
    const num = Number(value);
    if (isNaN(num)) return null;

    if (chartDays === 30 && index % 2 !== 0 && index !== chartData.length - 1) {
      return null;
    }

    return (
      <g transform={`translate(${x},${y})`}>
        <rect
          x={-22}
          y={-22}
          width={44}
          height={16}
          rx={4}
          fill="#ffffff"
          stroke="#0071e3"
          strokeWidth={1.5}
          className="fill-white dark:fill-[#1c1c1e] stroke-[#0071e3] dark:stroke-[#0a84ff]"
        />
        <text
          x={0}
          y={-11}
          textAnchor="middle"
          fill="#0071e3"
          fontSize={9.5}
          fontWeight={700}
          fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif"
          className="fill-[#0071e3] dark:fill-[#64d2ff] tabular-nums"
        >
          {num.toFixed(4)}
        </text>
      </g>
    );
  };

  // Custom high-contrast label renderer for USD points
  const renderUsdLabel = (props: any) => {
    const { x, y, value, index } = props;
    if (value === undefined || value === null) return null;
    const num = Number(value);
    if (isNaN(num)) return null;

    if (chartDays === 30 && index % 2 !== 0 && index !== chartData.length - 1) {
      return null;
    }

    return (
      <g transform={`translate(${x},${y})`}>
        <rect
          x={-22}
          y={-22}
          width={44}
          height={16}
          rx={4}
          fill="#ffffff"
          stroke="#d97706"
          strokeWidth={1.5}
          className="fill-white dark:fill-[#1c1c1e] stroke-amber-600 dark:stroke-amber-400"
        />
        <text
          x={0}
          y={-11}
          textAnchor="middle"
          fill="#b45309"
          fontSize={9.5}
          fontWeight={700}
          fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif"
          className="fill-amber-700 dark:fill-amber-300 tabular-nums"
        >
          {num.toFixed(4)}
        </text>
      </g>
    );
  };

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-4 pb-12 overflow-x-hidden">
      {/* Window Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
            Curs Valutar & Calculator Financiar
          </h1>
          <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
            Cotație oficială BNR ({displayDate}) · conversie instant, calculator TVA 21% și evoluție istorică
          </p>
        </div>

        {/* Date indicator & Refresh action */}
        <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
          <div className="apple-pill-control px-3.5 h-9 inline-flex items-center gap-1.5 text-[12px] text-[#6e6e73] dark:text-[#98989d] tabular-nums">
            <span>Ședința BNR:</span>
            <strong className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
              {displayDate}
            </strong>
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="apple-btn-prominent inline-flex items-center gap-1.5 px-4 h-9 text-[13px] font-semibold cursor-pointer disabled:opacity-60"
            title="Actualizează cursul valutar"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            <span>Actualizează</span>
          </button>
        </div>
      </div>

      {/* Official BNR Header Ticker & Financial Indices Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Card 1: Cursuri oficiale BNR */}
        <div className="apple-surface p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-3 flex items-center justify-between">
              <span>Cursuri principale BNR</span>
              <span className="text-[11.5px] tabular-nums text-[#8e8e93]">{dateStr}</span>
            </div>

            <div className="space-y-2">
              {/* EUR */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.04] dark:border-white/[0.06]">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex rounded-[2px] overflow-hidden shadow-xs border border-black/10">
                    <EuFlag className="w-4 h-2.5" />
                  </span>
                  <div>
                    <span className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] block">
                      1 EUR
                    </span>
                    <span className="text-[11px] text-[#6e6e73] dark:text-[#98989d]">Euro</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[14px] font-bold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {eurRate.toFixed(4)}{" "}
                    <span className="text-[11.5px] font-normal text-[#6e6e73] dark:text-[#98989d]">
                      RON
                    </span>
                  </span>
                  {eurVar && (
                    <span
                      className={`block text-[11px] font-semibold tabular-nums ${
                        eurVar.trend === "down"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {eurVar.diff > 0 ? "▲ +" : "▼ "}{eurVar.diff.toFixed(4)}
                    </span>
                  )}
                </div>
              </div>

              {/* USD */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.04] dark:border-white/[0.06]">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex rounded-[2px] overflow-hidden shadow-xs border border-black/10">
                    <UsFlag className="w-4 h-2.5" />
                  </span>
                  <div>
                    <span className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] block">
                      1 USD
                    </span>
                    <span className="text-[11px] text-[#6e6e73] dark:text-[#98989d]">
                      Dolar American
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[14px] font-bold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {usdRate.toFixed(4)}{" "}
                    <span className="text-[11.5px] font-normal text-[#6e6e73] dark:text-[#98989d]">
                      RON
                    </span>
                  </span>
                  {usdVar && (
                    <span
                      className={`block text-[11px] font-semibold tabular-nums ${
                        usdVar.trend === "down"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {usdVar.diff > 0 ? "▲ +" : "▼ "}{usdVar.diff.toFixed(4)}
                    </span>
                  )}
                </div>
              </div>

              {/* Cross Rate */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.04] dark:border-white/[0.06] text-[12.5px]">
                <span className="font-semibold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">
                  1 EUR = {crossEurUsd} USD
                </span>
                <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 text-[11.5px]">
                  ▲ +0.0012 USD
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Indici IRCC & ROBOR */}
        <div className="apple-surface p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-3 flex items-center justify-between">
              <span>Indici de referință credite</span>
              <span className="text-[11.5px] text-[#8e8e93]">BNR</span>
            </div>

            <div className="p-3 rounded-xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.04] dark:border-white/[0.06] mb-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] block">
                    Indicele IRCC trimestrial
                  </span>
                  <span className="text-[11px] text-[#6e6e73] dark:text-[#98989d]">
                    Bază legală credite consum & ipotecare
                  </span>
                </div>
                <span className="text-[20px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums">
                  5.56%
                </span>
              </div>
            </div>

            <div>
              <span className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1.5 tabular-nums">
                Cotații ROBOR ({dateStr}):
              </span>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.04] dark:border-white/[0.06]">
                  <span className="block text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                    3 Luni (3M)
                  </span>
                  <span className="text-[14px] font-bold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">
                    5.84%
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.04] dark:border-white/[0.06]">
                  <span className="block text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                    6 Luni (6M)
                  </span>
                  <span className="text-[14px] font-bold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">
                    5.92%
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.04] dark:border-white/[0.06]">
                  <span className="block text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                    12 Luni (12M)
                  </span>
                  <span className="text-[14px] font-bold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">
                    5.98%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Dobândă de Referință */}
        <div className="apple-surface p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-3">
              Dobânda medie credite ipotecare
            </div>

            <div className="grid grid-cols-2 gap-2.5 mb-3">
              <div className="p-3 rounded-xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.04] dark:border-white/[0.06]">
                <span className="text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] block">
                  Dobândă fixă
                </span>
                <span className="text-[20px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums">
                  5.45%
                </span>
                <span className="text-[11px] text-rose-600 dark:text-rose-400 block font-medium">
                  ▲ medie oferte
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.04] dark:border-white/[0.06]">
                <span className="text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] block">
                  Dobândă variabilă
                </span>
                <span className="text-[20px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums">
                  8.05%
                </span>
                <span className="text-[11px] text-[#6e6e73] dark:text-[#98989d] block font-medium">
                  IRCC + marjă
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#eefbf3] dark:bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-between">
              <div>
                <span className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] block">
                  Rata dobânzii de referință BNR
                </span>
                <span className="text-[11px] text-[#6e6e73] dark:text-[#98989d]">
                  Politică monetară
                </span>
              </div>
              <span className="text-[20px] font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                6.50%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: Grafice Evoluție Curs BNR */}
      <div className="w-full space-y-4">
        <div className="apple-surface p-5 sm:p-6 space-y-5">
          {/* Chart Control Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-black/[0.05] dark:border-white/[0.07]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[10px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center text-[#0071e3] dark:text-[#0a84ff] shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
                  Grafice evoluție curs BNR
                </h3>
                <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d]">
                  Date istorice oficiale pentru ultimele {chartDays} zile bancare · Cotații vizibile pe fiecare punct
                </p>
              </div>
            </div>

            {/* Days interval toggle: 7, 10, 30 Zile */}
            <div className="apple-segmented self-start lg:self-auto">
              {[7, 10, 30].map((days) => (
                <button
                  key={days}
                  type="button"
                  data-active={chartDays === days}
                  onClick={() => setChartDays(days as 7 | 10 | 30)}
                  className="apple-segmented-item px-3.5 tabular-nums"
                >
                  {days} Zile
                </button>
              ))}
            </div>
          </div>

          {/* Currency selector tabs for chart */}
          <div className="apple-segmented max-w-full overflow-x-auto no-scrollbar">
            <button
              type="button"
              data-active={chartCurrency === "ALL"}
              onClick={() => setChartCurrency("ALL")}
              className="apple-segmented-item px-3.5 shrink-0"
            >
              Paralel (EUR & USD)
            </button>
            <button
              type="button"
              data-active={chartCurrency === "EUR"}
              onClick={() => setChartCurrency("EUR")}
              className="apple-segmented-item px-3.5 flex items-center gap-1.5 shrink-0"
            >
              <span className="inline-flex rounded-[2px] overflow-hidden">
                <EuFlag className="w-3.5 h-2" />
              </span>
              <span>Doar Euro</span>
            </button>
            <button
              type="button"
              data-active={chartCurrency === "USD"}
              onClick={() => setChartCurrency("USD")}
              className="apple-segmented-item px-3.5 flex items-center gap-1.5 shrink-0"
            >
              <span className="inline-flex rounded-[2px] overflow-hidden">
                <UsFlag className="w-3.5 h-2" />
              </span>
              <span>Doar Dolar</span>
            </button>
          </div>

          {/* Charts View - Ambele pe același rând (2 coloane pe desktop) */}
          {chartCurrency === "ALL" ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* EVOLUȚIA CURS EURO */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#f5f5f7]/70 dark:bg-[#2c2c2e]/55 border border-black/[0.05] dark:border-white/[0.07]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex rounded-[2px] overflow-hidden">
                      <EuFlag className="w-4 h-2.5" />
                    </span>
                    <span className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                      Evoluția curs Euro (EUR/RON)
                    </span>
                  </div>
                  <span
                    className={`text-[11.5px] font-semibold tabular-nums px-2 py-0.5 rounded-full ${
                      eurStats.change <= 0
                        ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300"
                        : "bg-rose-500/10 text-rose-700 dark:bg-rose-500/18 dark:text-rose-300"
                    }`}
                  >
                    {eurStats.change > 0 ? "+" : ""}{eurStats.change}%
                  </span>
                </div>

                <div className="h-64 sm:h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 32, right: 24, left: -10, bottom: 4 }}>
                      <defs>
                        <linearGradient id="eurGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0071e3" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#0071e3" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(142,142,147,0.2)" vertical={false} />
                      <XAxis
                        dataKey="shortDate"
                        tick={{ fontSize: 11, fill: "#8e8e93", fontWeight: 500 }}
                        axisLine={false}
                        tickLine={false}
                        interval={chartDays === 30 ? "preserveEnd" : 0}
                      />
                      <YAxis
                        domain={["dataMin - 0.003", "dataMax + 0.005"]}
                        tick={{ fontSize: 10, fill: "#8e8e93" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => v.toFixed(3)}
                      />
                      <Tooltip
                        formatter={(value: any) => [`${Number(value).toFixed(4)} RON`, "EUR"]}
                        labelFormatter={(l) => `Data: ${l}`}
                        contentStyle={{
                          borderRadius: "12px",
                          backgroundColor: "#1c1c1e",
                          border: "1px solid rgba(255,255,255,0.10)",
                          color: "#f5f5f7",
                          fontSize: "12px",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="EUR"
                        stroke="#0071e3"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#eurGrad)"
                        dot={{ r: 4, fill: "#0071e3", strokeWidth: 2, stroke: "#ffffff" }}
                        activeDot={{ r: 6 }}
                      >
                        <LabelList
                          dataKey="EUR"
                          content={renderEurLabel}
                        />
                      </Area>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-3 pt-2.5 border-t border-black/[0.05] dark:border-white/[0.07] flex items-center justify-between text-[12px] text-[#6e6e73] dark:text-[#98989d] flex-wrap gap-2">
                  <span>
                    Minim:{" "}
                    <strong className="tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">
                      {eurStats.min.toFixed(4)}
                    </strong>
                  </span>
                  <span>
                    Maxim:{" "}
                    <strong className="tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">
                      {eurStats.max.toFixed(4)}
                    </strong>
                  </span>
                  <span>
                    Cotație curentă:{" "}
                    <strong className="tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] font-bold">
                      {eurRate.toFixed(4)} RON
                    </strong>
                  </span>
                </div>
              </div>

              {/* EVOLUȚIA CURS DOLAR */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#f5f5f7]/70 dark:bg-[#2c2c2e]/55 border border-black/[0.05] dark:border-white/[0.07]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex rounded-[2px] overflow-hidden">
                      <UsFlag className="w-4 h-2.5" />
                    </span>
                    <span className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                      Evoluția curs Dolar (USD/RON)
                    </span>
                  </div>
                  <span
                    className={`text-[11.5px] font-semibold tabular-nums px-2 py-0.5 rounded-full ${
                      usdStats.change <= 0
                        ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300"
                        : "bg-rose-500/10 text-rose-700 dark:bg-rose-500/18 dark:text-rose-300"
                    }`}
                  >
                    {usdStats.change > 0 ? "+" : ""}{usdStats.change}%
                  </span>
                </div>

                <div className="h-64 sm:h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 32, right: 24, left: -10, bottom: 4 }}>
                      <defs>
                        <linearGradient id="usdGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#d97706" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#d97706" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(142,142,147,0.2)" vertical={false} />
                      <XAxis
                        dataKey="shortDate"
                        tick={{ fontSize: 11, fill: "#8e8e93", fontWeight: 500 }}
                        axisLine={false}
                        tickLine={false}
                        interval={chartDays === 30 ? "preserveEnd" : 0}
                      />
                      <YAxis
                        domain={["dataMin - 0.004", "dataMax + 0.006"]}
                        tick={{ fontSize: 10, fill: "#8e8e93" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => v.toFixed(3)}
                      />
                      <Tooltip
                        formatter={(value: any) => [`${Number(value).toFixed(4)} RON`, "USD"]}
                        labelFormatter={(l) => `Data: ${l}`}
                        contentStyle={{
                          borderRadius: "12px",
                          backgroundColor: "#1c1c1e",
                          border: "1px solid rgba(255,255,255,0.10)",
                          color: "#f5f5f7",
                          fontSize: "12px",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="USD"
                        stroke="#d97706"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#usdGrad)"
                        dot={{ r: 4, fill: "#d97706", strokeWidth: 2, stroke: "#ffffff" }}
                        activeDot={{ r: 6 }}
                      >
                        <LabelList
                          dataKey="USD"
                          content={renderUsdLabel}
                        />
                      </Area>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-3 pt-2.5 border-t border-black/[0.05] dark:border-white/[0.07] flex items-center justify-between text-[12px] text-[#6e6e73] dark:text-[#98989d] flex-wrap gap-2">
                  <span>
                    Minim:{" "}
                    <strong className="tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">
                      {usdStats.min.toFixed(4)}
                    </strong>
                  </span>
                  <span>
                    Maxim:{" "}
                    <strong className="tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">
                      {usdStats.max.toFixed(4)}
                    </strong>
                  </span>
                  <span>
                    Cotație curentă:{" "}
                    <strong className="tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] font-bold">
                      {usdRate.toFixed(4)} RON
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Single Full Width Chart */
            <div className="p-4 sm:p-5 rounded-2xl bg-[#f5f5f7]/70 dark:bg-[#2c2c2e]/55 border border-black/[0.05] dark:border-white/[0.07]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex rounded-[2px] overflow-hidden">
                    {chartCurrency === "EUR" ? <EuFlag className="w-4 h-2.5" /> : <UsFlag className="w-4 h-2.5" />}
                  </span>
                  <span className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    Evoluția curs {chartCurrency === "EUR" ? "Euro (EUR/RON)" : "Dolar (USD/RON)"}
                  </span>
                </div>
                <span
                  className={`text-[11.5px] font-semibold tabular-nums px-2 py-0.5 rounded-full ${
                    (chartCurrency === "EUR" ? eurStats.change : usdStats.change) <= 0
                      ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300"
                      : "bg-rose-500/10 text-rose-700 dark:bg-rose-500/18 dark:text-rose-300"
                  }`}
                >
                  {(chartCurrency === "EUR" ? eurStats.change : usdStats.change) > 0 ? "+" : ""}
                  {chartCurrency === "EUR" ? eurStats.change : usdStats.change}%
                </span>
              </div>

              <div className="h-72 sm:h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 32, right: 24, left: -10, bottom: 4 }}>
                    <defs>
                      <linearGradient id="singleGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartCurrency === "EUR" ? "#0071e3" : "#d97706"} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={chartCurrency === "EUR" ? "#0071e3" : "#d97706"} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(142,142,147,0.2)" vertical={false} />
                    <XAxis
                      dataKey="shortDate"
                      tick={{ fontSize: 11, fill: "#8e8e93", fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                      interval={chartDays === 30 ? "preserveEnd" : 0}
                    />
                    <YAxis
                      domain={chartCurrency === "EUR" ? ["dataMin - 0.003", "dataMax + 0.005"] : ["dataMin - 0.004", "dataMax + 0.006"]}
                      tick={{ fontSize: 11, fill: "#8e8e93" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => v.toFixed(3)}
                    />
                    <Tooltip
                      formatter={(value: any) => [`${Number(value).toFixed(4)} RON`, chartCurrency]}
                      labelFormatter={(l) => `Data: ${l}`}
                      contentStyle={{
                        borderRadius: "12px",
                        backgroundColor: "#1c1c1e",
                        border: "1px solid rgba(255,255,255,0.10)",
                        color: "#f5f5f7",
                        fontSize: "12px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey={chartCurrency}
                      stroke={chartCurrency === "EUR" ? "#0071e3" : "#d97706"}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#singleGrad)"
                      dot={{ r: 4, fill: chartCurrency === "EUR" ? "#0071e3" : "#d97706", strokeWidth: 2, stroke: "#fff" }}
                      activeDot={{ r: 6 }}
                    >
                      <LabelList
                        dataKey={chartCurrency}
                        content={chartCurrency === "EUR" ? renderEurLabel : renderUsdLabel}
                      />
                    </Area>
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-3 pt-2.5 border-t border-black/[0.05] dark:border-white/[0.07] flex items-center justify-between text-[12px] text-[#6e6e73] dark:text-[#98989d] flex-wrap gap-2">
                <span>
                  Minim:{" "}
                  <strong className="tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {(chartCurrency === "EUR" ? eurStats.min : usdStats.min).toFixed(4)}
                  </strong>
                </span>
                <span>
                  Maxim:{" "}
                  <strong className="tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {(chartCurrency === "EUR" ? eurStats.max : usdStats.max).toFixed(4)}
                  </strong>
                </span>
                <span>
                  Cotație curentă:{" "}
                  <strong className="tabular-nums font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {(chartCurrency === "EUR" ? eurRate : usdRate).toFixed(4)} RON
                  </strong>
                </span>
              </div>
            </div>
          )}

          {/* Historical Table */}
          <div className="mt-5 pt-4 border-t border-black/[0.05] dark:border-white/[0.07]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Tabel istoric cursuri BNR (ultimele {chartDays} zile)
              </span>
              <span className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d]">
                Valori oficiale exprimate în RON
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-black/[0.05] dark:border-white/[0.07]">
              <table className="w-full text-left">
                <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
                  <tr>
                    {["Data", "Ziua", "EUR", "USD", "GBP", "CHF", "MDL"].map((h) => (
                      <th
                        key={h}
                        className="py-2.5 px-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
                  {[...chartData].reverse().map((row) => (
                    <tr
                      key={row.date}
                      className={`hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors ${
                        row.date === bnrData?.date
                          ? "bg-[#0071e3]/[0.04] dark:bg-[#0a84ff]/[0.08]"
                          : ""
                      }`}
                    >
                      <td className="py-2.5 px-3 text-[13px] tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {row.formattedDate}
                      </td>
                      <td className="py-2.5 px-3 text-[12.5px] text-[#6e6e73] dark:text-[#98989d]">
                        {row.dayName}
                      </td>
                      <td className="py-2.5 px-3 text-[13px] tabular-nums font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {row.EUR.toFixed(4)}
                      </td>
                      <td className="py-2.5 px-3 text-[13px] tabular-nums font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {row.USD.toFixed(4)}
                      </td>
                      <td className="py-2.5 px-3 text-[13px] tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                        {row.GBP.toFixed(4)}
                      </td>
                      <td className="py-2.5 px-3 text-[13px] tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                        {row.CHF.toFixed(4)}
                      </td>
                      <td className="py-2.5 px-3 text-[13px] tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                        {row.MDL.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: Cele două calculatoare pe același rând sub grafice (50% / 50%) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        {/* 1. CONVERTOR RAPID */}
        <div className="apple-surface p-5 sm:p-6 flex flex-col justify-between h-full">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-black/[0.05] dark:border-white/[0.07] min-h-[54px]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[10px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center text-[#0071e3] dark:text-[#0a84ff] shrink-0">
                <ArrowLeftRight className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
                  Convertor rapid BNR
                </h3>
                <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d] tabular-nums">
                  Curs oficial BNR din {dateStr}
                </p>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300 text-[11px] font-medium">
              ● Cotație oficială
            </span>
          </div>

          {/* Body Container */}
          <div className="flex-1 flex flex-col justify-between pt-4 gap-4">
            <div className="space-y-3.5">
              {/* Currency selectors with swap button */}
              <div className="grid grid-cols-1 sm:grid-cols-11 gap-2 items-center">
                {/* From Currency */}
                <div className="sm:col-span-5 space-y-1">
                  <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block">
                    Schimbă din
                  </label>
                  <select
                    value={fromCurrency}
                    onChange={(e) => setFromCurrency(e.target.value as CurrencyCode)}
                    className="apple-pill-control w-full !h-10 px-3.5 text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] outline-none cursor-pointer"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Swap Button */}
                <div className="sm:col-span-1 flex justify-center pt-3 sm:pt-5">
                  <button
                    onClick={handleSwap}
                    type="button"
                    title="Inversează valutele"
                    className="apple-btn-glass w-9 h-9 text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center justify-center cursor-pointer"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                  </button>
                </div>

                {/* To Currency */}
                <div className="sm:col-span-5 space-y-1">
                  <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block">
                    În
                  </label>
                  <select
                    value={toCurrency}
                    onChange={(e) => setToCurrency(e.target.value as CurrencyCode)}
                    className="apple-pill-control w-full !h-10 px-3.5 text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] outline-none cursor-pointer"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block">
                  Suma de convertit
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={convertAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^[0-9]*[.,]?[0-9]*$/.test(val) || val === "") {
                        setConvertAmount(val);
                      }
                    }}
                    className="w-full h-12 pl-4 pr-24 rounded-full bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.08] text-[#1d1d1f] dark:text-[#f5f5f7] font-bold tabular-nums text-[19px] tracking-tight outline-none transition-all"
                    placeholder="100"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none px-2.5 py-1 rounded-full bg-white dark:bg-[#3a3a3c] text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold text-[12px]">
                    {fromCurrency}
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1 sm:gap-1.5 pt-1 overflow-x-auto no-scrollbar">
                  {["5", "10", "40", "50", "200", "300", "500", "1000"].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setConvertAmount(preset)}
                      style={
                        convertAmount === preset
                          ? { backgroundColor: "var(--tenant-theme-color, #0071e3)" }
                          : undefined
                      }
                      className={`flex-1 min-w-0 py-1.5 px-1.5 text-center text-[11px] font-semibold tabular-nums rounded-full transition-all cursor-pointer whitespace-nowrap ${
                        convertAmount === preset
                          ? "text-white shadow-xs"
                          : "bg-[#f2f2f7] dark:bg-[#2c2c2e] hover:bg-black/[0.06] dark:hover:bg-white/[0.10] text-[#3a3a3c] dark:text-[#ebebf5]"
                      }`}
                    >
                      {preset} {fromCurrency}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Results and Action Button */}
            <div className="space-y-3.5">
              <div className="p-4 rounded-2xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.05] dark:border-white/[0.07] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                    Rezultat conversie
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(convertedResult.toFixed(useFourDecimals ? 4 : 2), "conv")
                    }
                    className="apple-btn-glass inline-flex items-center gap-1 px-2.5 py-1 text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                    title="Copiază rezultatul"
                  >
                    {copiedField === "conv" ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          Copiat!
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiază</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="text-[26px] sm:text-[30px] font-bold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.028em] leading-none">
                  {formatNumber(convertedResult)}{" "}
                  <span className="text-[16px] font-semibold text-[#6e6e73] dark:text-[#98989d]">
                    {toCurrency}
                  </span>
                </div>

                <div className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] flex items-center justify-between pt-2 border-t border-black/[0.05] dark:border-white/[0.07]">
                  <span className="tabular-nums">
                    Rată aplicată: 1 {fromCurrency} ={" "}
                    {(ratesMap[fromCurrency] / ratesMap[toCurrency]).toFixed(4)} {toCurrency}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={transferToVat}
                className="apple-btn-prominent w-full h-10 text-[12.5px] font-semibold flex items-center justify-center gap-2 cursor-pointer"
                title="Rezultatul în lei este aplicat automat în Calculatorul TVA"
              >
                <Sparkles className="w-4 h-4" />
                <span>Aplicat automat în Calculator TVA (+21%)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 2. CALCULATOR TVA */}
        <div
          id="calculator-tva"
          className="apple-surface p-5 sm:p-6 flex flex-col justify-between h-full"
        >
          {/* Header with Mode Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-black/[0.05] dark:border-white/[0.07] min-h-[54px]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[10px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center text-[#0071e3] dark:text-[#0a84ff] shrink-0">
                <Percent className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
                  Calculator TVA România (21%)
                </h3>
                <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d]">
                  Cota standard 21%, 19%, 9%, 5% sau personalizată
                </p>
              </div>
            </div>

            {/* Segmented Mode Control */}
            <div className="apple-segmented self-start sm:self-auto">
              <button
                type="button"
                data-active={vatMode === "add"}
                onClick={() => setVatMode("add")}
                className="apple-segmented-item px-3"
              >
                + Adaugă TVA
              </button>
              <button
                type="button"
                data-active={vatMode === "extract"}
                onClick={() => setVatMode("extract")}
                className="apple-segmented-item px-3"
              >
                - Extrage TVA
              </button>
            </div>
          </div>

          {/* Body Container */}
          <div className="flex-1 flex flex-col justify-between pt-4 gap-4">
            <div className="space-y-4">
              {/* Input Value */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block">
                    {vatMode === "add" ? "Valoare fără TVA (bază)" : "Total cu TVA (de extras)"}
                  </label>
                  {isSyncedWithConverter && (
                    <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 bg-emerald-500/10 dark:bg-emerald-500/18 px-2.5 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Auto-sincronizat din Convertor
                    </span>
                  )}
                </div>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={vatAmountInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^[0-9]*[.,]?[0-9]*$/.test(val) || val === "") {
                        setVatAmountInput(val);
                      }
                    }}
                    className="w-full h-12 pl-4 pr-28 rounded-full bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.08] text-[#1d1d1f] dark:text-[#f5f5f7] font-bold tabular-nums text-[19px] tracking-tight outline-none transition-all"
                    placeholder="100"
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    <span className="px-2.5 py-0.5 rounded-full bg-white dark:bg-[#3a3a3c] text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold text-[12px] pointer-events-none">
                      RON
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(vatAmountInput, "vatInput")}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                      title="Copiază"
                    >
                      {copiedField === "vatInput" ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Cota TVA */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block">
                  Cota de TVA aplicabilă
                </label>
                <div className="flex flex-wrap gap-2">
                  {VAT_RATES.map((item) => (
                    <button
                      key={item.rate}
                      type="button"
                      onClick={() => {
                        setVatRate(item.rate);
                        setCustomVatRate("");
                      }}
                      style={
                        vatRate === item.rate && !customVatRate
                          ? { backgroundColor: "var(--tenant-theme-color, #0071e3)" }
                          : undefined
                      }
                      className={`px-3.5 py-1.5 text-[12px] font-semibold rounded-full transition-all cursor-pointer ${
                        vatRate === item.rate && !customVatRate
                          ? "text-white shadow-xs"
                          : "bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#ebebf5] hover:bg-black/[0.06] dark:hover:bg-white/[0.10]"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="Altă %"
                      value={customVatRate}
                      onChange={(e) => setCustomVatRate(e.target.value)}
                      className="w-20 h-8 px-2.5 text-[12px] font-semibold tabular-nums rounded-full bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.08] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Section: VAT Breakdown Card + Checkboxes */}
            <div className="space-y-3.5">
              <div className="p-4 rounded-2xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.05] dark:border-white/[0.07] space-y-2.5">
                {/* Baza */}
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-[#6e6e73] dark:text-[#98989d] font-medium">
                    Valoare fără TVA (bază):
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">
                      {formatNumber(vatResults.base)} RON
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(vatResults.base.toFixed(useFourDecimals ? 4 : 2), "base")
                      }
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                      title="Copiază"
                    >
                      {copiedField === "base" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* TVA */}
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-[#6e6e73] dark:text-[#98989d] font-medium tabular-nums">
                    Valoare TVA ({activeVatRate}%):
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">
                      {formatNumber(vatResults.vat)} RON
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(vatResults.vat.toFixed(useFourDecimals ? 4 : 2), "vat")
                      }
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                      title="Copiază"
                    >
                      {copiedField === "vat" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Total cu TVA */}
                <div className="pt-2.5 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
                  <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-[14px]">
                    Total cu TVA:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[20px] font-bold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">
                      {formatNumber(vatResults.total)} RON
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(vatResults.total.toFixed(useFourDecimals ? 4 : 2), "total")
                      }
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                      title="Copiază"
                    >
                      {copiedField === "total" ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Formatting Checkboxes */}
              <div className="space-y-2 pt-1 text-[12px] text-[#6e6e73] dark:text-[#98989d]">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={useThousandsSeparator}
                    onChange={(e) => setUseThousandsSeparator(e.target.checked)}
                    className="rounded text-primary cursor-pointer"
                  />
                  <span>Afișează separator mii în rezultate (ex: 1.250,50)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={useFourDecimals}
                    onChange={(e) => setUseFourDecimals(e.target.checked)}
                    className="rounded text-primary cursor-pointer"
                  />
                  <span>Afișează patru zecimale în rezultat (pentru devize / preț unitar)</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
