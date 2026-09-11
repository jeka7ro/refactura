import React, { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RefreshCcw, ExternalLink, ArrowRight } from "lucide-react";
import {
  EuFlag,
  UsFlag,
  GbFlag,
  ChFlag,
  MdFlag,
} from "./CurrencyFlags";

export function BnrExchangeRateHeader() {
  const [isOpen, setIsOpen] = useState(false);

  // Poll every 15 minutes, stale after 5 minutes
  const { data, isFetching, refetch } = trpc.system.getBnrRates.useQuery(
    undefined,
    {
      refetchInterval: 15 * 60 * 1000,
      staleTime: 5 * 60 * 1000,
    }
  );

  const eurRate = data?.rates?.EUR ? data.rates.EUR.toFixed(4) : "5.2537";
  const usdRate = data?.rates?.USD ? data.rates.USD.toFixed(4) : "4.5164";
  const gbpRate = data?.rates?.GBP ? data.rates.GBP.toFixed(4) : "6.1178";
  const chfRate = data?.rates?.CHF ? data.rates.CHF.toFixed(4) : "5.5707";
  const mdlRate = data?.rates?.MDL ? data.rates.MDL.toFixed(4) : "0.2620";

  const dateStr = data?.formattedDate || "10.09.2026";
  const prevDateStr = data?.prevFormattedDate || "09.09.2026";

  const getDayOfWeek = (dStr: string) => {
    try {
      const parts = dStr.split(".");
      if (parts.length === 3) {
        const d = new Date(
          parseInt(parts[2], 10),
          parseInt(parts[1], 10) - 1,
          parseInt(parts[0], 10)
        );
        return ["D", "L", "M", "M", "J", "V", "S"][d.getDay()];
      }
    } catch {}
    return "J";
  };

  const dayLetter = getDayOfWeek(dateStr);

  const eurVar = data?.variations?.EUR;
  const usdVar = data?.variations?.USD;
  const gbpVar = data?.variations?.GBP;
  const chfVar = data?.variations?.CHF;
  const mdlVar = data?.variations?.MDL;

  const currencies = [
    {
      code: "EUR",
      FlagComponent: EuFlag,
      rate: eurRate,
      info: eurVar,
    },
    {
      code: "USD",
      FlagComponent: UsFlag,
      rate: usdRate,
      info: usdVar,
    },
    {
      code: "GBP",
      FlagComponent: GbFlag,
      rate: gbpRate,
      info: gbpVar,
    },
    {
      code: "CHF",
      FlagComponent: ChFlag,
      rate: chfRate,
      info: chfVar,
    },
    {
      code: "MDL",
      FlagComponent: MdFlag,
      rate: mdlRate,
      info: mdlVar,
    },
  ];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer select-none text-left"
          title={`Curs BNR ${dateStr} (${dayLetter}) · Click pentru detalii`}
        >
          {/* Header Pill */}
          <div className="flex items-center gap-2 text-xs leading-none">
            {/* EUR */}
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200 leading-none">
              <span className="inline-flex items-center justify-center rounded-[2px] overflow-hidden shadow-2xs border border-black/10 flex-shrink-0">
                <EuFlag className="w-3.5 h-2.5 block" />
              </span>
              <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500">
                EUR
              </span>
              <span className="tabular-nums font-semibold text-slate-900 dark:text-white">
                {eurRate}
              </span>
              <span
                className={`text-[9px] font-bold leading-none ${
                  eurVar?.trend === "down"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : eurVar?.trend === "up"
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-slate-400"
                }`}
              >
                {eurVar?.trend === "down" ? "▼" : eurVar?.trend === "up" ? "▲" : "="}
              </span>
            </span>

            {/* Separator */}
            <span className="hidden md:inline-flex items-center text-slate-300 dark:text-slate-600 font-bold leading-none select-none">
              ·
            </span>

            {/* USD */}
            <span className="hidden md:inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200 leading-none">
              <span className="inline-flex items-center justify-center rounded-[2px] overflow-hidden shadow-2xs border border-black/10 flex-shrink-0">
                <UsFlag className="w-3.5 h-2.5 block" />
              </span>
              <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500">
                USD
              </span>
              <span className="tabular-nums font-semibold text-slate-900 dark:text-white">
                {usdRate}
              </span>
              <span
                className={`text-[9px] font-bold leading-none ${
                  usdVar?.trend === "down"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : usdVar?.trend === "up"
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-slate-400"
                }`}
              >
                {usdVar?.trend === "down" ? "▼" : usdVar?.trend === "up" ? "▲" : "="}
              </span>
            </span>

            {/* Separator */}
            <span className="inline-flex items-center text-slate-300 dark:text-slate-600 font-bold leading-none select-none">
              ·
            </span>

            {/* Date Tag */}
            <span className="inline-flex items-center text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-none whitespace-nowrap">
              BNR {dateStr} ({dayLetter})
            </span>
          </div>
        </button>
      </PopoverTrigger>

      {/* Ultra-compact Popover — NO useless cards, NO wasted space, REAL LOGOS */}
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-72 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 animate-in fade-in-50 zoom-in-95"
      >
        {/* Header: Date included directly in Curs Valutar Oficial BNR */}
        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 dark:border-slate-800">
          <span className="text-[11px] font-bold text-slate-900 dark:text-white tracking-tight">
            Curs Valutar Oficial BNR · {dateStr} ({dayLetter})
          </span>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
            title="Reîmprospătează"
          >
            <RefreshCcw
              className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        {/* Currency List: 1 single clean row per currency */}
        <div className="space-y-0.5">
          {currencies.map(({ code, FlagComponent, rate, info }) => {
            const isDown = info?.trend === "down";
            const isUp = info?.trend === "up";

            return (
              <div
                key={code}
                className="flex items-center justify-between py-1 px-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded transition-colors text-xs"
              >
                {/* Logo + Code */}
                <div className="flex items-center gap-2">
                  <span className="inline-flex rounded-[2px] overflow-hidden shadow-xs border border-black/10 flex-shrink-0">
                    <FlagComponent className="w-4 h-2.5" />
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                    {code}
                  </span>
                </div>

                {/* Rate + Variation */}
                <div className="flex items-center gap-2">
                  <span className="font-semibold font-mono text-slate-900 dark:text-white text-xs">
                    {rate}
                  </span>
                  {info && info.diff !== undefined ? (
                    <span
                      className={`font-mono text-[10px] font-medium min-w-[50px] text-right ${
                        isDown
                          ? "text-emerald-600 dark:text-emerald-400"
                          : isUp
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-slate-400"
                      }`}
                    >
                      {isDown ? "▼" : isUp ? "▲" : "="} {info.diffFormatted}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* Link to dedicated Curs Valutar page */}
        <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800">
          <Link
            href="/curs-valutar"
            onClick={() => setIsOpen(false)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold text-[11px] transition-colors cursor-pointer"
          >
            <span>Calculator & Grafice 30 Zile</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Ultra-compact Footer */}
        <div className="mt-1 pt-1 flex items-center justify-between text-[10px] text-slate-400">
          <span>vs {prevDateStr}</span>
          <a
            href="https://www.bnr.ro/Cursul-de-schimb-524.aspx"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-0.5 hover:text-slate-600 dark:hover:text-slate-300"
          >
            bnr.ro
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default BnrExchangeRateHeader;
