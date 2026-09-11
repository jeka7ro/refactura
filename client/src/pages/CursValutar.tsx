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
          stroke="#2563eb"
          strokeWidth={1.5}
          className="fill-white dark:fill-slate-900 stroke-blue-600 dark:stroke-blue-400"
        />
        <text
          x={0}
          y={-11}
          textAnchor="middle"
          fill="#1d4ed8"
          fontSize={9.5}
          fontWeight={800}
          fontFamily="ui-monospace, monospace"
          className="fill-blue-700 dark:fill-blue-300 font-mono"
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
          className="fill-white dark:fill-slate-900 stroke-amber-600 dark:stroke-amber-400"
        />
        <text
          x={0}
          y={-11}
          textAnchor="middle"
          fill="#b45309"
          fontSize={9.5}
          fontWeight={800}
          fontFamily="ui-monospace, monospace"
          className="fill-amber-700 dark:fill-amber-300 font-mono"
        >
          {num.toFixed(4)}
        </text>
      </g>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header Banner - Matches Dashboard exactly */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60">
              Oficial BNR
            </span>
            <span className="text-xs text-slate-400">
              Banca Națională a României · Cotație de referință
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Curs Valutar & Calculator Financiar
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Conversie valutară instant, calculator TVA cu cota standard 21% și evoluție istorică pe 7-30 zile
          </p>
        </div>

        {/* Date indicator & Refresh action */}
        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <div className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs">
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Ședința BNR</span>
            <span className="font-bold text-slate-800 dark:text-slate-100">{displayDate}</span>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
            title="Actualizează cursul valutar"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            <span>Actualizează</span>
          </button>
        </div>
      </div>

      {/* Official BNR Header Ticker & Financial Indices Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Card 1: Cursuri oficiale BNR */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Cursuri Principale BNR</span>
              <span className="text-[11px] font-medium text-slate-400">{dateStr}</span>
            </div>

            <div className="space-y-2">
              {/* EUR */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex rounded-[2px] overflow-hidden shadow-xs border border-black/10">
                    <EuFlag className="w-4 h-2.5" />
                  </span>
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">1 EUR</span>
                    <span className="text-[10px] text-slate-400">Euro</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black font-mono text-slate-900 dark:text-white">
                    {eurRate.toFixed(4)} <span className="text-xs font-normal text-slate-400">RON</span>
                  </span>
                  {eurVar && (
                    <span
                      className={`block text-[10px] font-bold font-mono ${
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
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex rounded-[2px] overflow-hidden shadow-xs border border-black/10">
                    <UsFlag className="w-4 h-2.5" />
                  </span>
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">1 USD</span>
                    <span className="text-[10px] text-slate-400">Dolar American</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black font-mono text-slate-900 dark:text-white">
                    {usdRate.toFixed(4)} <span className="text-xs font-normal text-slate-400">RON</span>
                  </span>
                  {usdVar && (
                    <span
                      className={`block text-[10px] font-bold font-mono ${
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
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-xs">
                <span className="font-semibold text-blue-950 dark:text-blue-200">
                  1 EUR = {crossEurUsd} USD
                </span>
                <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400 text-[11px]">
                  ▲ +0.0012 USD
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Indici IRCC & ROBOR */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Indici de Referință Credite</span>
              <span className="text-[11px] font-medium text-slate-400">BNR</span>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 mb-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-950 dark:text-amber-200 block">
                    Indicele IRCC Trimestrial
                  </span>
                  <span className="text-[10px] text-amber-800/80 dark:text-amber-400/80">
                    Bază legală credite consum & ipotecare
                  </span>
                </div>
                <span className="text-lg font-black text-amber-700 dark:text-amber-300 font-mono">
                  5.56%
                </span>
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                Cotații ROBOR ({dateStr}):
              </span>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                  <span className="block text-[10px] font-bold text-slate-400">3 Luni (3M)</span>
                  <span className="text-sm font-black font-mono text-slate-900 dark:text-white">5.84%</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                  <span className="block text-[10px] font-bold text-slate-400">6 Luni (6M)</span>
                  <span className="text-sm font-black font-mono text-slate-900 dark:text-white">5.92%</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                  <span className="block text-[10px] font-bold text-slate-400">12 Luni (12M)</span>
                  <span className="text-sm font-black font-mono text-slate-900 dark:text-white">5.98%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Dobândă de Referință */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Dobânda Medie Credite Ipotecare
            </div>

            <div className="grid grid-cols-2 gap-2.5 mb-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 block">Dobândă Fixă</span>
                <span className="text-lg font-black text-slate-900 dark:text-white font-mono">5.45%</span>
                <span className="text-[10px] text-rose-500 block font-semibold">▲ medie oferte</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 block">Dobândă Variabilă</span>
                <span className="text-lg font-black text-slate-900 dark:text-white font-mono">8.05%</span>
                <span className="text-[10px] text-slate-400 block font-semibold">IRCC + marjă</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200 block">
                  Rata Dobânzii de Referință BNR
                </span>
                <span className="text-[10px] text-emerald-800/80 dark:text-emerald-400/80">
                  Politică monetară
                </span>
              </div>
              <span className="text-lg font-black text-emerald-700 dark:text-emerald-300 font-mono">
                6.50%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: Grafice Evoluție Curs BNR - FULL WIDTH (100% width) */}
      <div className="w-full space-y-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
          {/* Chart Control Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/60 flex items-center justify-center text-blue-600 flex-shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                  Grafice Evoluție Curs BNR
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Date istorice oficiale pentru ultimele {chartDays} zile bancare · Cotații vizibile pe fiecare punct
                </p>
              </div>
            </div>

            {/* Days interval toggle: 7, 10, 30 Zile */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              {[7, 10, 30].map((days) => (
                <button
                  key={days}
                  onClick={() => setChartDays(days as 7 | 10 | 30)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    chartDays === days
                      ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {days} Zile
                </button>
              ))}
            </div>
          </div>

          {/* Currency selector tabs for chart */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setChartCurrency("ALL")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                chartCurrency === "ALL"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              Paralel (EUR & USD)
            </button>
            <button
              onClick={() => setChartCurrency("EUR")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                chartCurrency === "EUR"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              <span className="inline-flex rounded-[2px] overflow-hidden">
                <EuFlag className="w-3.5 h-2" />
              </span>
              <span>Doar Euro</span>
            </button>
            <button
              onClick={() => setChartCurrency("USD")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                chartCurrency === "USD"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              <span className="inline-flex rounded-[2px] overflow-hidden">
                <UsFlag className="w-3.5 h-2" />
              </span>
              <span>Doar Dolar</span>
            </button>
          </div>

          {/* Charts View - Ambele pe același rând (2 coloane pe desktop) */}
          {chartCurrency === "ALL" ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* EVOLUȚIA CURS EURO */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex rounded-[2px] overflow-hidden">
                      <EuFlag className="w-4 h-2.5" />
                    </span>
                    <span className="text-xs sm:text-sm font-black tracking-wide text-blue-900 dark:text-blue-300 uppercase">
                      EVOLUȚIA CURS EURO (EUR/RON)
                    </span>
                  </div>
                  <span
                    className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md ${
                      eurStats.change <= 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
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
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="shortDate"
                        tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                        interval={chartDays === 30 ? "preserveEnd" : 0}
                      />
                      <YAxis
                        domain={["dataMin - 0.003", "dataMax + 0.005"]}
                        tick={{ fontSize: 10, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => v.toFixed(3)}
                      />
                      <Tooltip
                        formatter={(value: any) => [`${Number(value).toFixed(4)} RON`, "EUR"]}
                        labelFormatter={(l) => `Data: ${l}`}
                        contentStyle={{
                          borderRadius: "12px",
                          backgroundColor: "#0f172a",
                          border: "none",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="EUR"
                        stroke="#2563eb"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#eurGrad)"
                        dot={{ r: 4, fill: "#2563eb", strokeWidth: 2, stroke: "#ffffff" }}
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

                <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-500">
                  <span>Minim: <strong className="font-mono text-slate-700 dark:text-slate-300">{eurStats.min.toFixed(4)}</strong></span>
                  <span>Maxim: <strong className="font-mono text-slate-700 dark:text-slate-300">{eurStats.max.toFixed(4)}</strong></span>
                  <span>Cotație Curentă: <strong className="font-mono text-blue-600 dark:text-blue-400 font-bold">{eurRate.toFixed(4)} RON</strong></span>
                </div>
              </div>

              {/* EVOLUȚIA CURS DOLAR */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex rounded-[2px] overflow-hidden">
                      <UsFlag className="w-4 h-2.5" />
                    </span>
                    <span className="text-xs sm:text-sm font-black tracking-wide text-amber-900 dark:text-amber-300 uppercase">
                      EVOLUȚIA CURS DOLAR (USD/RON)
                    </span>
                  </div>
                  <span
                    className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md ${
                      usdStats.change <= 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
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
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="shortDate"
                        tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                        interval={chartDays === 30 ? "preserveEnd" : 0}
                      />
                      <YAxis
                        domain={["dataMin - 0.004", "dataMax + 0.006"]}
                        tick={{ fontSize: 10, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => v.toFixed(3)}
                      />
                      <Tooltip
                        formatter={(value: any) => [`${Number(value).toFixed(4)} RON`, "USD"]}
                        labelFormatter={(l) => `Data: ${l}`}
                        contentStyle={{
                          borderRadius: "12px",
                          backgroundColor: "#0f172a",
                          border: "none",
                          color: "#fff",
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

                <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-500">
                  <span>Minim: <strong className="font-mono text-slate-700 dark:text-slate-300">{usdStats.min.toFixed(4)}</strong></span>
                  <span>Maxim: <strong className="font-mono text-slate-700 dark:text-slate-300">{usdStats.max.toFixed(4)}</strong></span>
                  <span>Cotație Curentă: <strong className="font-mono text-amber-600 dark:text-amber-400 font-bold">{usdRate.toFixed(4)} RON</strong></span>
                </div>
              </div>
            </div>
          ) : (
            /* Single Full Width Chart */
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex rounded-[2px] overflow-hidden">
                    {chartCurrency === "EUR" ? <EuFlag className="w-4 h-2.5" /> : <UsFlag className="w-4 h-2.5" />}
                  </span>
                  <span className="text-xs sm:text-sm font-black tracking-wide text-slate-900 dark:text-white uppercase">
                    EVOLUȚIA CURS {chartCurrency === "EUR" ? "EURO (EUR/RON)" : "DOLAR (USD/RON)"}
                  </span>
                </div>
                <span
                  className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md ${
                    (chartCurrency === "EUR" ? eurStats.change : usdStats.change) <= 0
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
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
                        <stop offset="5%" stopColor={chartCurrency === "EUR" ? "#2563eb" : "#d97706"} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={chartCurrency === "EUR" ? "#2563eb" : "#d97706"} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="shortDate"
                      tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      interval={chartDays === 30 ? "preserveEnd" : 0}
                    />
                    <YAxis
                      domain={chartCurrency === "EUR" ? ["dataMin - 0.003", "dataMax + 0.005"] : ["dataMin - 0.004", "dataMax + 0.006"]}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => v.toFixed(3)}
                    />
                    <Tooltip
                      formatter={(value: any) => [`${Number(value).toFixed(4)} RON`, chartCurrency]}
                      labelFormatter={(l) => `Data: ${l}`}
                      contentStyle={{
                        borderRadius: "12px",
                        backgroundColor: "#0f172a",
                        border: "none",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey={chartCurrency}
                      stroke={chartCurrency === "EUR" ? "#2563eb" : "#d97706"}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#singleGrad)"
                      dot={{ r: 4, fill: chartCurrency === "EUR" ? "#2563eb" : "#d97706", strokeWidth: 2, stroke: "#fff" }}
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

              <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-500">
                <span>Minim: <strong className="font-mono text-slate-700 dark:text-slate-300">{(chartCurrency === "EUR" ? eurStats.min : usdStats.min).toFixed(4)}</strong></span>
                <span>Maxim: <strong className="font-mono text-slate-700 dark:text-slate-300">{(chartCurrency === "EUR" ? eurStats.max : usdStats.max).toFixed(4)}</strong></span>
                <span>Cotație Curentă: <strong className="font-mono font-bold text-blue-600 dark:text-blue-400">{(chartCurrency === "EUR" ? eurRate : usdRate).toFixed(4)} RON</strong></span>
              </div>
            </div>
          )}

          {/* Historical Table */}
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Tabel Istoric Cursuri BNR (Ultimele {chartDays} Zile)
              </span>
              <span className="text-[10px] text-slate-400">Valori oficiale exprimate în RON</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px]">
                    <th className="py-2.5 px-2">Data</th>
                    <th className="py-2.5 px-2">Ziua</th>
                    <th className="py-2.5 px-2 font-bold text-slate-700 dark:text-slate-300">EUR</th>
                    <th className="py-2.5 px-2 font-bold text-slate-700 dark:text-slate-300">USD</th>
                    <th className="py-2.5 px-2">GBP</th>
                    <th className="py-2.5 px-2">CHF</th>
                    <th className="py-2.5 px-2">MDL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {[...chartData].reverse().map((row) => (
                    <tr
                      key={row.date}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                        row.date === bnrData?.date ? "bg-blue-50/40 dark:bg-blue-950/20 font-semibold" : ""
                      }`}
                    >
                      <td className="py-2.5 px-2 font-mono text-slate-600 dark:text-slate-300">{row.formattedDate}</td>
                      <td className="py-2.5 px-2 text-slate-400">{row.dayName}</td>
                      <td className="py-2.5 px-2 font-mono font-bold text-blue-600 dark:text-blue-400">{row.EUR.toFixed(4)}</td>
                      <td className="py-2.5 px-2 font-mono font-bold text-amber-600 dark:text-amber-400">{row.USD.toFixed(4)}</td>
                      <td className="py-2.5 px-2 font-mono text-slate-600 dark:text-slate-400">{row.GBP.toFixed(4)}</td>
                      <td className="py-2.5 px-2 font-mono text-slate-600 dark:text-slate-400">{row.CHF.toFixed(4)}</td>
                      <td className="py-2.5 px-2 font-mono text-slate-600 dark:text-slate-400">{row.MDL.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: Cele două calculatoare pe același rând sub grafice (50% / 50%) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* 1. CONVERTOR RAPID - White card styled exactly like Dashboard */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between h-full">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 min-h-[58px]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/60 flex items-center justify-center text-blue-600 shrink-0">
                <ArrowLeftRight className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                  Convertor Rapid BNR
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Curs oficial BNR din {dateStr}
                </p>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 text-[10px] font-bold">
              ● Cotație Oficială
            </span>
          </div>

          {/* Body Container - fills vertical space with equal distribution */}
          <div className="flex-1 flex flex-col justify-between pt-4 gap-4">
            {/* Currency Inputs & Presets (Top Section) */}
            <div className="space-y-3.5">
              {/* Currency selectors with swap button */}
              <div className="grid grid-cols-1 sm:grid-cols-11 gap-2 items-center">
                {/* From Currency */}
                <div className="sm:col-span-5 space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Schimbă din:
                  </label>
                  <select
                    value={fromCurrency}
                    onChange={(e) => setFromCurrency(e.target.value as CurrencyCode)}
                    className="w-full h-11 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Swap Button */}
                <div className="sm:col-span-1 flex justify-center pt-3 sm:pt-4">
                  <button
                    onClick={handleSwap}
                    type="button"
                    title="Inversează valutele"
                    className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                  </button>
                </div>

                {/* To Currency */}
                <div className="sm:col-span-5 space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    În:
                  </label>
                  <select
                    value={toCurrency}
                    onChange={(e) => setToCurrency(e.target.value as CurrencyCode)}
                    className="w-full h-11 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
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
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Suma de convertit:
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
                    className="w-full h-12 pl-4 pr-24 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-black text-xl tracking-tight focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    placeholder="100"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs">
                    {fromCurrency}
                  </div>
                </div>

                {/* Quick Presets - Single row layout */}
                <div className="flex items-center gap-1 sm:gap-1.5 pt-1 overflow-x-auto no-scrollbar">
                  {["5", "10", "40", "50", "200", "300", "500", "1000"].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setConvertAmount(preset)}
                      className={`flex-1 min-w-0 py-1.5 px-1 sm:px-1.5 text-center text-[10px] sm:text-[11px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                        convertAmount === preset
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {preset} {fromCurrency}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Results and Action Button (Bottom Section) */}
            <div className="space-y-3.5">
              {/* Result Area */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Rezultat Conversie
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(convertedResult.toFixed(useFourDecimals ? 4 : 2), "conv")
                    }
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 text-slate-600 dark:text-slate-200 text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
                    title="Copiază rezultatul"
                  >
                    {copiedField === "conv" ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600 font-bold">Copiat!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiază</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white tracking-tight">
                  {formatNumber(convertedResult)}{" "}
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {toCurrency}
                  </span>
                </div>

                <div className="text-[11px] text-slate-500 flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span>Rată aplicată: 1 {fromCurrency} = {(ratesMap[fromCurrency] / ratesMap[toCurrency]).toFixed(4)} {toCurrency}</span>
                </div>
              </div>

              {/* Action Button: Auto-synced indicator & transfer trigger */}
              <button
                type="button"
                onClick={transferToVat}
                className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                title="Rezultatul în lei este aplicat automat în Calculatorul TVA"
              >
                <Sparkles className="w-4 h-4" />
                <span>Aplicat automat în Calculator TVA (+21%)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 2. CALCULATOR TVA - Matches Site Aesthetics exactly */}
        <div
          id="calculator-tva"
          className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between h-full"
        >
          {/* Header with Mode Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800 min-h-[58px]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 shrink-0">
                <Percent className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                  Calculator TVA România (21%)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cota standard 21%, 19%, 9%, 5% sau personalizată
                </p>
              </div>
            </div>

            {/* Segmented Mode Control */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start sm:self-auto">
              <button
                onClick={() => setVatMode("add")}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  vatMode === "add"
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                + Adaugă TVA
              </button>
              <button
                onClick={() => setVatMode("extract")}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  vatMode === "extract"
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                - Extrage TVA
              </button>
            </div>
          </div>

          {/* Body Container - fills vertical space with equal distribution */}
          <div className="flex-1 flex flex-col justify-between pt-4 gap-4">
            {/* Top Inputs: Base amount + VAT rates */}
            <div className="space-y-4">
              {/* Input Value */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    {vatMode === "add" ? "Valoare fără TVA (Bază):" : "Total cu TVA (de extras):"}
                  </label>
                  {isSyncedWithConverter && (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
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
                    className="w-full h-12 pl-4 pr-28 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-black text-xl tracking-tight focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    placeholder="100"
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs pointer-events-none">
                      RON
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(vatAmountInput, "vatInput")}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors cursor-pointer"
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

              {/* Cota TVA - 21% is prominent and standard */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Cota de TVA aplicabilă:
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
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        vatRate === item.rate && !customVatRate
                          ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
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
                      className="w-20 h-8 px-2.5 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Section: VAT Breakdown Card + Checkboxes */}
            <div className="space-y-3.5">
              {/* VAT Breakdown Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
                {/* Baza */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Valoare fără TVA (Bază):</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-mono text-slate-900 dark:text-white">
                      {formatNumber(vatResults.base)} RON
                    </span>
                    <button
                      onClick={() =>
                        copyToClipboard(vatResults.base.toFixed(useFourDecimals ? 4 : 2), "base")
                      }
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 cursor-pointer"
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
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Valoare TVA ({activeVatRate}%):</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-mono text-indigo-600 dark:text-indigo-400">
                      {formatNumber(vatResults.vat)} RON
                    </span>
                    <button
                      onClick={() =>
                        copyToClipboard(vatResults.vat.toFixed(useFourDecimals ? 4 : 2), "vat")
                      }
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 cursor-pointer"
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
                <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span className="font-black text-slate-900 dark:text-white text-sm">
                    Total cu TVA:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {formatNumber(vatResults.total)} RON
                    </span>
                    <button
                      onClick={() =>
                        copyToClipboard(vatResults.total.toFixed(useFourDecimals ? 4 : 2), "total")
                      }
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 cursor-pointer"
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
              <div className="space-y-2 pt-1 text-xs text-slate-500 dark:text-slate-400">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={useThousandsSeparator}
                    onChange={(e) => setUseThousandsSeparator(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Afișează separator mii în rezultate ( ex: 1.250,50 )</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={useFourDecimals}
                    onChange={(e) => setUseFourDecimals(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
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
