"use client";
import React from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Target, BarChart3, Activity, AlertTriangle } from "lucide-react";
import { useStats } from "@/hooks/use-trades";
import { useT } from "@/lib/useT";

function fmt(n: number, prefix = "$") {
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n >= 0 ? `+${prefix}${abs}` : `-${prefix}${abs}`;
}

export function StatsCards() {
  const { stats, loading } = useStats();
  const t = useT();

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-stroke bg-card p-4 animate-pulse">
            <div className="h-4 w-4 rounded bg-tinted mb-3" />
            <div className="h-6 w-20 rounded bg-tinted mb-2" />
            <div className="h-3 w-16 rounded bg-tinted" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: t("dash_stat_total_pl"),
      value: stats ? fmt(stats.totalPnl) : "—",
      positive: (stats?.totalPnl ?? 0) >= 0,
      icon: (stats?.totalPnl ?? 0) >= 0 ? TrendingUp : TrendingDown,
    },
    {
      label: t("dash_stat_win_rate"),
      value: stats ? `${stats.winRate}%` : "—",
      positive: (stats?.winRate ?? 0) >= 50,
      icon: Target,
    },
    {
      label: t("dash_total_trades"),
      value: stats ? String(stats.totalTrades) : "—",
      positive: true,
      icon: BarChart3,
    },
    {
      label: t("dash_stat_profit_factor"),
      value: stats ? (!isFinite(stats.profitFactor ?? NaN) ? "∞" : stats.profitFactor!.toFixed(2)) : "—",
      positive: (stats?.profitFactor ?? 0) >= 1,
      icon: Activity,
    },
    {
      label: t("dash_avg_r"),
      value: stats ? `${stats.avgRMultiple.toFixed(2)}R` : "—",
      positive: (stats?.avgRMultiple ?? 0) >= 1,
      icon: TrendingUp,
    },
    {
      label: t("dash_stat_max_dd"),
      value: stats ? `-$${stats.maxDrawdown.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—",
      positive: false,
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl border border-stroke bg-card p-4 hover:border-brand/30 transition-colors min-w-0 overflow-hidden"
        >
          <div className="flex items-center justify-between mb-3">
            <stat.icon className={cn("h-4 w-4", stat.positive ? "text-emerald-400" : "text-red-400")} />
          </div>
          <p className="text-xl font-bold text-ink truncate">{stat.value}</p>
          <p className="text-xs text-ink-4 mt-1">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
