"use client";
import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useT } from "@/lib/useT";

type DailyRow = { date: string; pnl: number };

const formatDateLabel = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: DailyRow }> }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const val = row.pnl;
  return (
    <div className="rounded-lg border border-stroke-2 bg-card p-3 shadow-xl">
      <p className="text-xs text-ink-3">{formatDateLabel(row.date)}</p>
      <p className={cn("text-sm font-bold", val >= 0 ? "text-emerald-400" : "text-red-400")}>
        {val >= 0 ? "+" : ""}${val.toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
};

export function DailyPnlChart() {
  const t = useT();
  const [data, setData] = useState<DailyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trades/stats")
      .then((r) => r.json())
      .then((d) => setData(d.dailyPnl ?? []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  const displayData = data.map((row) => ({ ...row, label: formatDateLabel(row.date) }));

  return (
    <div className="rounded-xl border border-stroke bg-card p-6">
      <h3 className="text-lg font-semibold text-ink mb-4">{t("dash_daily_pl")}</h3>
      {loading ? (
        <div className="h-[250px] rounded-md bg-tinted animate-pulse" />
      ) : displayData.length === 0 ? (
        <div className="h-[250px] flex items-center justify-center">
          <p className="text-sm text-ink-4">{t("common_no_data")}</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={displayData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
            <XAxis dataKey="label" stroke="#4a4a6a" tick={{ fontSize: 10 }} />
            <YAxis stroke="#4a4a6a" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(139, 92, 246, 0.1)" }} />
            <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
              {displayData.map((entry, i) => (
                <Cell key={i} fill={entry.pnl >= 0 ? "#10B981" : "#EF4444"} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
