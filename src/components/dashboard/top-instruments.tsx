"use client";
import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/useT";

type SymbolStat = { name: string; trades: number; pnl: number; winRate: number };

export function TopInstruments() {
  const t = useT();
  const [instruments, setInstruments] = useState<SymbolStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trades/stats")
      .then((r) => r.json())
      .then((data) => setInstruments((data.tradesBySymbol ?? []).slice(0, 5)))
      .catch(() => setInstruments([]))
      .finally(() => setLoading(false));
  }, []);

  const maxTrades = instruments.length > 0 ? Math.max(...instruments.map((i) => i.trades)) : 1;

  return (
    <div className="rounded-xl border border-stroke bg-card p-6">
      <h3 className="text-lg font-semibold text-ink mb-4">{t("dash_top_instruments")}</h3>
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 rounded-md bg-tinted animate-pulse" />
          ))}
        </div>
      ) : instruments.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-4">{t("common_no_data")}</p>
      ) : (
        <div className="space-y-4">
          {instruments.map((inst) => (
            <div key={inst.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-ink w-16">{inst.name}</span>
                  <span className="text-xs text-ink-4">{inst.trades} trades</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-ink-3">{inst.winRate}% WR</span>
                  <span className={cn("text-sm font-medium min-w-[80px] text-right", inst.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {inst.pnl >= 0 ? "+" : ""}${Math.abs(inst.pnl).toLocaleString("en-US")}
                  </span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-tinted overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", inst.pnl >= 0 ? "bg-brand" : "bg-red-500")}
                  style={{ width: `${(inst.trades / maxTrades) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
