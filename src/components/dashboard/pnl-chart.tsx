"use client";
import React, { useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { getNumericMetric, getPayloadPoint, withRunningChartMetrics } from "@/lib/chart-metrics";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useT } from "@/lib/useT";

type CumRow = { date: string; pnl: number };

const formatDateLabel = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const periods = ["1W", "1M", "3M", "6M", "1Y", "ALL"];
const periodDays: Record<string, number> = { "1W": 7, "1M": 30, "3M": 90, "6M": 180, "1Y": 365 };

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { date: string; pnl: number } }> }) => {
  if (!active || !payload?.length) return null;
  const point = getPayloadPoint(payload);
  const row = payload[0].payload;
  const val = row.pnl;
  const high = getNumericMetric(point, ["chartHigh"]);
  const low = getNumericMetric(point, ["chartLow"]);
  const drawdown = getNumericMetric(point, ["chartDrawdown"]);
  return (
    <div className="rounded-lg border border-stroke-2 bg-card p-3 shadow-xl">
      <p className="text-xs text-ink-3">{formatDateLabel(row.date)}</p>
      <p className={cn("text-sm font-bold", val >= 0 ? "text-emerald-400" : "text-red-400")}>
        {val >= 0 ? "+" : ""}${val.toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </p>
      {high !== null && <p className="text-[11px] text-ink-4 mt-1">High: {high >= 0 ? "+" : ""}${high.toFixed(2)}</p>}
      {low !== null && <p className="text-[11px] text-ink-4">Low: {low >= 0 ? "+" : ""}${low.toFixed(2)}</p>}
      {drawdown !== null && drawdown < 0 && <p className="text-[11px] text-red-400">Drawdown: ${drawdown.toFixed(2)}</p>}
    </div>
  );
};

export function PnlChart() {
  const [period, setPeriod] = useState("1M");
  const [rawData, setRawData] = useState<CumRow[]>([]);
  const [loading, setLoading] = useState(true);
  const t = useT();

  useEffect(() => {
    fetch("/api/trades/stats")
      .then((r) => r.json())
      .then((d) => setRawData(d.cumulativePnl ?? []))
      .catch(() => setRawData([]))
      .finally(() => setLoading(false));
  }, []);

  const data = useMemo(() => {
    let filtered = rawData;
    const days = periodDays[period];
    if (days) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffKey = cutoff.toISOString().slice(0, 10);
      filtered = rawData.filter((r) => r.date >= cutoffKey);
    }
    return withRunningChartMetrics(
      filtered.map((r) => ({ ...r, label: formatDateLabel(r.date) })),
      "pnl",
      { baseline: 0 }
    );
  }, [rawData, period]);

  return (
    <div className="rounded-xl border border-stroke bg-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-ink">{t("dash_cumulative_pl")}</h3>
          <p className="text-sm text-ink-3">{t("dash_performance_over_time")}</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-tinted p-1">
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                period === p ? "bg-brand text-white" : "text-ink-3 hover:text-ink"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="h-[300px] rounded-md bg-tinted animate-pulse" />
      ) : data.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center">
          <p className="text-sm text-ink-4">{t("common_no_data")}</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
            <XAxis dataKey="label" stroke="#4a4a6a" tick={{ fontSize: 11 }} />
            <YAxis stroke="#4a4a6a" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#8B5CF6", strokeWidth: 1, strokeDasharray: "3 3" }} wrapperStyle={{ pointerEvents: "none" }} />
            <Area type="monotone" dataKey="pnl" stroke="#8B5CF6" strokeWidth={2} fill="url(#pnlGradient)" activeDot={{ r: 4, stroke: "#8B5CF6", strokeWidth: 2, fill: "#fff" }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
