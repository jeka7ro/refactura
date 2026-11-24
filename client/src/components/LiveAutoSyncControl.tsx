import React, { useState, useEffect, useRef } from "react";

interface LiveAutoSyncControlProps {
  onRefresh: () => void | Promise<unknown>;
  isRefreshing?: boolean;
  intervalSec?: number;
  storageKey?: string;
  compact?: boolean;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

const formatClock = (d: Date) =>
  `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

export function LiveAutoSyncControl({
  onRefresh,
  isRefreshing = false,
  intervalSec = 300,
  storageKey = "smart_invoice_auto_sync",
  compact = false,
}: LiveAutoSyncControlProps) {
  const [autoEnabled, setAutoEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved === null ? true : saved === "1";
    } catch {
      return true;
    }
  });
  const [secondsLeft, setSecondsLeft] = useState<number>(intervalSec);
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());
  const onRefreshRef = useRef(onRefresh);
  const prevRefreshingRef = useRef(isRefreshing);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (prevRefreshingRef.current && !isRefreshing) {
      setLastUpdated(new Date());
      setSecondsLeft(intervalSec);
    }
    prevRefreshingRef.current = isRefreshing;
  }, [isRefreshing, intervalSec]);

  useEffect(() => {
    if (!autoEnabled) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (!prevRefreshingRef.current) {
            Promise.resolve(onRefreshRef.current()).finally(() => {
              setLastUpdated(new Date());
            });
          }
          return intervalSec;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [autoEnabled, intervalSec]);

  const toggleAuto = () => {
    setAutoEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {}
      if (next) setSecondsLeft(intervalSec);
      return next;
    });
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const intervalLabel = `${Math.round(intervalSec / 60)}m`;

  return (
    <div className="inline-flex items-center gap-2 shrink-0 select-none">
      {!compact && (
        <span className="hidden xl:inline-flex items-center gap-1 text-[11.5px] text-[#6e6e73] dark:text-[#98989d] tabular-nums whitespace-nowrap">
          <span>Actualizat:</span>
          <strong className="font-semibold text-[#3a3a3c] dark:text-[#ebebf5]">
            {formatClock(lastUpdated)}
          </strong>
        </span>
      )}

      <button
        type="button"
        onClick={toggleAuto}
        title={
          autoEnabled
            ? `Actualizare automată activă la ${intervalLabel} (click pentru pauză)`
            : `Actualizare automată oprită (click pentru activare la ${intervalLabel})`
        }
        className={`h-8 px-2.5 rounded-full text-[11.5px] font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer tabular-nums whitespace-nowrap border ${
          autoEnabled
            ? "bg-emerald-500/10 hover:bg-emerald-500/16 text-emerald-700 dark:text-emerald-300 border-emerald-500/22"
            : "bg-black/[0.04] hover:bg-black/[0.07] dark:bg-white/[0.06] text-[#6e6e73] dark:text-[#98989d] border-black/[0.07] dark:border-white/[0.1]"
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            autoEnabled ? "bg-emerald-500 animate-pulse" : "bg-[#8e8e93]"
          }`}
        />
        <span>Auto ({intervalLabel})</span>
        {autoEnabled && (
          <span className="opacity-85 font-medium">
            {mins}:{pad2(secs)}
          </span>
        )}
      </button>
    </div>
  );
}

export default LiveAutoSyncControl;
