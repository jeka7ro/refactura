import React from "react";
import { getSpvDeadlineInfo } from "@/lib/spvDeadline";
import { Clock, AlertTriangle, AlertCircle, Calendar } from "lucide-react";
import { formatDate } from "@/lib/store";

interface SpvDeadlineBadgeProps {
  issueDate: string | Date;
  spvStatus?: string | null;
  clientCountry?: string | null;
  clientCUI?: string | null;
  className?: string;
  showIcon?: boolean;
  detailed?: boolean;
}

export function isExternal(country?: string | null, cui?: string | null, status?: string | null): boolean {
  if (status === "extern") return true;
  const c = (country || "").trim().toUpperCase();
  if (c && c !== "RO") return true;
  const rawCui = (cui || "").trim().toUpperCase();
  if (rawCui && /^[A-Z]{2}/.test(rawCui) && !rawCui.startsWith("RO")) return true;
  return false;
}

export default function SpvDeadlineBadge({
  issueDate,
  spvStatus,
  clientCountry,
  clientCUI,
  className = "",
  showIcon = true,
  detailed = false,
}: SpvDeadlineBadgeProps) {
  // Facturile validate sau externe nu au termen SPV de afișat
  if (spvStatus === "validat") return null;
  if (isExternal(clientCountry, clientCUI, spvStatus)) return null;

  const info = getSpvDeadlineInfo(issueDate);
  if (!info) return null;

  const formattedDeadline = formatDate(info.deadline);

  const icon = info.isExpired ? (
    <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
  ) : info.expiresToday || info.isUrgent ? (
    <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
  ) : (
    <Clock className="w-3 h-3 text-sky-600 shrink-0" />
  );

  if (detailed) {
    return (
      <div
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${info.badgeClass} ${className}`}
        title={`Termen legal conform OUG 120/2021: 5 zile lucrătoare (fără weekend/sărbători). Dată limită: ${formattedDeadline}`}
      >
        {showIcon && icon}
        <div className="flex flex-col">
          <span className="font-bold">{info.label}</span>
          <span className="text-[10px] opacity-80">
            Dată limită SPV: {formattedDeadline}
          </span>
        </div>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] border tracking-tight ${info.badgeClass} ${className}`}
      title={`Termen legal SPV: 5 zile lucrătoare. Dată limită: ${formattedDeadline}`}
    >
      {showIcon && icon}
      <span>{info.label}</span>
    </span>
  );
}
