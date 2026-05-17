"use client";
import React from "react";
import { cn } from "@/lib/utils";

const stats = [
  { label: "Total Trades", value: "156" },
  { label: "Win Rate", value: "64.1%", color: "text-emerald-400" },
  { label: "Total P/L", value: "+$12,847", color: "text-emerald-400" },
  { label: "Avg Win", value: "+$485", color: "text-emerald-400" },
  { label: "Avg Loss", value: "-$312", color: "text-red-400" },
  { label: "Best Trade", value: "+$2,450", color: "text-emerald-400" },
  { label: "Worst Trade", value: "-$1,180", color: "text-red-400" },
];

export function TradeStatsBar() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {stats.map((s) => (
        <div key={s.label} className="flex-shrink-0 rounded-lg border border-stroke bg-card px-4 py-2.5 min-w-[120px]">
          <p className={cn("text-sm font-bold", s.color || "text-ink")}>{s.value}</p>
          <p className="text-xs text-ink-4 mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
