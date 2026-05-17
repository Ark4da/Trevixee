"use client";
import React, { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useT } from "@/lib/useT";

const COLORS = ["#10B981", "#EF4444"];

export function WinLossChart() {
  const t = useT();
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [winRate, setWinRate] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trades/stats")
      .then((r) => r.json())
      .then((d) => {
        setWins(d.wins ?? 0);
        setLosses(d.losses ?? 0);
        setWinRate(d.winRate ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const data = [
    { name: "Wins", value: wins },
    { name: "Losses", value: losses },
  ];
  const total = wins + losses;

  return (
    <div className="rounded-xl border border-stroke bg-card p-6">
      <h3 className="text-lg font-semibold text-ink mb-4">{t("dash_win_loss_ratio")}</h3>
      {loading ? (
        <div className="h-[200px] rounded-md bg-tinted animate-pulse" />
      ) : total === 0 ? (
        <div className="h-[200px] flex items-center justify-center">
          <p className="text-sm text-ink-4">{t("common_no_data")}</p>
        </div>
      ) : (
        <>
          <div className="relative">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value">
                  {data.map((_, i) => (
                    <Cell key={`cell-${i}`} fill={COLORS[i]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-2xl font-bold text-ink">{winRate.toFixed(1)}%</p>
                <p className="text-xs text-ink-4">{t("common_win_rate")}</p>
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
              <span className="text-sm text-ink-3">Wins ({wins})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              <span className="text-sm text-ink-3">Losses ({losses})</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
