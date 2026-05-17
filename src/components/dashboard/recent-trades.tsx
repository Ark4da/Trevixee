"use client";
import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useT } from "@/lib/useT";

type Trade = {
  id: string;
  entryDate: string;
  symbol: string;
  side: string;
  entryPrice: number;
  exitPrice: number | null;
  pnl: number;
  rMultiple: number;
};

export function RecentTrades() {
  const tt = useT();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trades?limit=10&status=closed&sort=entryDate&dir=desc")
      .then((r) => r.json())
      .then((data) => setTrades(data.trades ?? []))
      .catch(() => setTrades([]))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="rounded-xl border border-stroke bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-ink">{tt("dash_recent_trades")}</h3>
        <Link href="/journal" className="text-sm text-brand hover:text-brand-hover transition-colors">{tt("dash_view_all")}</Link>
      </div>
      <div className="overflow-x-auto">
        {loading ? (
          <div className="space-y-3 py-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 rounded-md bg-tinted animate-pulse" />
            ))}
          </div>
        ) : trades.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-4">{tt("common_no_data")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stroke">
                <th className="pb-3 text-left text-xs font-medium text-ink-4 uppercase">Date</th>
                <th className="pb-3 text-left text-xs font-medium text-ink-4 uppercase">{tt("common_symbol")}</th>
                <th className="pb-3 text-left text-xs font-medium text-ink-4 uppercase">Side</th>
                <th className="pb-3 text-right text-xs font-medium text-ink-4 uppercase">Entry</th>
                <th className="pb-3 text-right text-xs font-medium text-ink-4 uppercase">Exit</th>
                <th className="pb-3 text-right text-xs font-medium text-ink-4 uppercase">P/L</th>
                <th className="pb-3 text-right text-xs font-medium text-ink-4 uppercase">R</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id} className="border-b border-stroke/50 hover:bg-tinted transition-colors cursor-pointer">
                  <td className="py-3 text-ink-3">{formatDate(t.entryDate)}</td>
                  <td className="py-3 font-medium text-ink">{t.symbol}</td>
                  <td className="py-3">
                    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
                      t.side === "long" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                    )}>
                      {t.side.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 text-right text-ink-2">{t.entryPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                  <td className="py-3 text-right text-ink-2">
                    {t.exitPrice != null ? t.exitPrice.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—"}
                  </td>
                  <td className={cn("py-3 text-right font-medium", t.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {t.pnl >= 0 ? "+" : ""}${Math.abs(t.pnl).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td className={cn("py-3 text-right font-medium", t.rMultiple >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {t.rMultiple >= 0 ? "+" : ""}{t.rMultiple.toFixed(1)}R
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
