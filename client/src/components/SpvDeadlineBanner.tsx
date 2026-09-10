import React, { useMemo } from "react";
import { getSpvDeadlineInfo } from "@/lib/spvDeadline";
import { isExternal } from "./SpvDeadlineBadge";
import { AlertTriangle, ShieldAlert, ArrowRight, Clock } from "lucide-react";

interface SpvDeadlineBannerProps {
  invoices: any[];
  onFilterUrgent?: () => void;
}

export default function SpvDeadlineBanner({ invoices, onFilterUrgent }: SpvDeadlineBannerProps) {
  const stats = useMemo(() => {
    let overdueCount = 0;
    let urgentCount = 0;

    for (const inv of invoices || []) {
      // Excludem cele validate, arhivate, anulate sau externe
      if (inv.spvStatus === "validat" || inv.status === "cancelled" || inv._source === "archive") continue;
      if (isExternal(inv.clientCountry, inv.clientCUI, inv.spvStatus)) continue;

      const dateToUse = inv.issueDate || inv.createdAt;
      const info = getSpvDeadlineInfo(dateToUse);
      if (!info) continue;

      if (info.isExpired) {
        overdueCount++;
      } else if (info.isUrgent) {
        urgentCount++;
      }
    }

    return { overdueCount, urgentCount, totalNeedsAttention: overdueCount + urgentCount };
  }, [invoices]);

  if (stats.totalNeedsAttention === 0) return null;

  return (
    <div className={`p-4 rounded-xl border transition-all duration-200 ${
      stats.overdueCount > 0
        ? "bg-rose-50/90 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/80 text-rose-900 dark:text-rose-200"
        : "bg-amber-50/90 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-200"
    }`}>
      <div className="flex items-start md:items-center justify-between gap-3 flex-col md:flex-row">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg shrink-0 ${
            stats.overdueCount > 0
              ? "bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300"
              : "bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-300"
          }`}>
            {stats.overdueCount > 0 ? (
              <ShieldAlert className="w-5 h-5 animate-bounce" />
            ) : (
              <Clock className="w-5 h-5" />
            )}
          </div>
          <div>
            <h4 className="text-sm font-bold flex items-center gap-2">
              Termen legal transmitere RO e-Factura (5 zile lucrătoare)
            </h4>
            <p className="text-xs opacity-90 mt-0.5 leading-relaxed">
              {stats.overdueCount > 0 ? (
                <>
                  Aveți <span className="font-bold underline">{stats.overdueCount} {stats.overdueCount === 1 ? "factură cu termen depășit" : "facturi cu termen depășit"}</span>
                  {stats.urgentCount > 0 && ` și ${stats.urgentCount} facturi ce expiră în 1-2 zile`}.
                  Conform OUG 120/2021, depășirea termenului atrage risc de sancțiuni ANAF.
                </>
              ) : (
                <>
                  Aveți <span className="font-bold underline">{stats.urgentCount} {stats.urgentCount === 1 ? "factură" : "facturi"}</span> ce se apropie de termenul-limită (1-2 zile lucrătoare rămase). Vă recomandăm transmiterea în SPV.
                </>
              )}
            </p>
          </div>
        </div>

        {onFilterUrgent && (
          <button
            onClick={onFilterUrgent}
            className={`self-end md:self-auto px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0 ${
              stats.overdueCount > 0
                ? "bg-rose-600 hover:bg-rose-700 text-white"
                : "bg-amber-600 hover:bg-amber-700 text-white"
            }`}
          >
            Vezi facturile urgente
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
