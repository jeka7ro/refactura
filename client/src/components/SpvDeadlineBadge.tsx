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
  spvIndex?: string | null;
  spvSentAt?: string | Date | null;
}

export function isExternal(country?: string | null, cui?: string | null, status?: string | null): boolean {
  if (status === "extern") return true;
  const c = (country || "").trim().toUpperCase();
  if (c && c !== "RO") return true;
  const rawCui = (cui || "").trim().toUpperCase();
  if (rawCui && /^[A-Z]{2}/.test(rawCui) && !rawCui.startsWith("RO")) return true;
  return false;
}

/**
 * Verifică dacă factura a fost deja transmisă în SPV
 * (are status in_procesare, trimisă, validată sau are deja index ANAF / dată de transmitere).
 * În aceste cazuri, termenul legal de transmitere de 5 zile a fost deja îndeplinit.
 */
export function isSpvTransmitted(
  spvStatus?: string | null,
  spvIndex?: string | null,
  spvSentAt?: string | Date | null
): boolean {
  if (spvIndex && String(spvIndex).trim() !== "") return true;
  if (spvSentAt) return true;
  const s = (spvStatus || "").trim().toLowerCase();
  return (
    s === "validat" ||
    s === "validata" ||
    s === "in_procesare" ||
    s === "trimis" ||
    s === "trimisa" ||
    s === "descarcat" ||
    s === "ok"
  );
}

export default function SpvDeadlineBadge({
  issueDate,
  spvStatus,
  clientCountry,
  clientCUI,
  className = "",
  showIcon = true,
  detailed = false,
  spvIndex,
  spvSentAt,
}: SpvDeadlineBadgeProps) {
  // Facturile deja transmise în SPV (in_procesare/Trimisă, validată, sau cu index/dată)
  // nu mai au un termen de transmitere rămas — obligația legală a fost îndeplinită!
  if (isSpvTransmitted(spvStatus, spvIndex, spvSentAt)) return null;
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
