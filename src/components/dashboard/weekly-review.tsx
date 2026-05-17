"use client";
import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { X, TrendingUp, TrendingDown, BookOpen, ChevronRight, Calendar } from "lucide-react";
import Link from "next/link";
import { Portal } from "@/components/ui/portal";
import { useT } from "@/lib/useT";

interface WeekStat {
  trades: number; wins: number; losses: number;
  pnl: number; netPnl: number;
  bestDay: string; bestDayPnl: number;
  worstDay: string; worstDayPnl: number;
  bestSetup: string | null;
}

function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  date.setDate(date.getDate() + diff);
  return date;
}

function fmt(n: number) {
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n >= 0 ? "+" : "-") + "$" + abs;
}

export function WeeklyReviewBanner() {
  const t = useT();
  const [show, setShow] = useState(false);
  const [stat, setStat] = useState<WeekStat | null>(null);
  const [prevStat, setPrevStat] = useState<WeekStat | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const today = new Date();
    // Show the weekly review from Monday through Wednesday (give traders time to review)
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ...
    if (dayOfWeek < 1 || dayOfWeek > 3) return;

    const weekKey = `weekly-review-${getMonday(today).toISOString().slice(0, 10)}`;
    if (localStorage.getItem(weekKey) === "dismissed") return;

    // Fetch last week's data
    const lastMon = getMonday(new Date(today.getTime() - 7 * 86400000));
    const lastSun = new Date(lastMon.getTime() + 6 * 86400000);
    const from = lastMon.toISOString().slice(0, 10);
    const to   = lastSun.toISOString().slice(0, 10);

    const prevMon = new Date(lastMon.getTime() - 7 * 86400000);
    const prevSun = new Date(prevMon.getTime() + 6 * 86400000);
    const prevFrom = prevMon.toISOString().slice(0, 10);
    const prevTo   = prevSun.toISOString().slice(0, 10);

    const tz = new Date().getTimezoneOffset();
    Promise.all([
      fetch(`/api/trades/stats?from=${from}&to=${to}&tzOffset=${tz}`).then(r => r.json()),
      fetch(`/api/trades/stats?from=${prevFrom}&to=${prevTo}&tzOffset=${tz}`).then(r => r.json()),
    ]).then(([data, prevData]) => {
      if (!data || data.totalTrades === 0) return;

      // Build WeekStat from stats data
      const calData: { date: string; pnl: number; trades: number }[] = data.calendarData || [];
      let bestDay = "", bestDayPnl = -Infinity, worstDay = "", worstDayPnl = Infinity;
      for (const d of calData) {
        if (d.pnl > bestDayPnl) { bestDayPnl = d.pnl; bestDay = d.date; }
        if (d.pnl < worstDayPnl) { worstDayPnl = d.pnl; worstDay = d.date; }
      }

      const setups: { name: string; pnl: number }[] = data.tradesBySetup || [];
      const bestSetup = setups.length > 0 ? setups.sort((a: { pnl: number }, b: { pnl: number }) => b.pnl - a.pnl)[0].name : null;

      setStat({
        trades: data.totalTrades,
        wins: data.wins,
        losses: data.losses,
        pnl: data.totalPnl,
        netPnl: data.netPnl,
        bestDay,
        bestDayPnl,
        worstDay,
        worstDayPnl: worstDayPnl === Infinity ? 0 : worstDayPnl,
        bestSetup,
      });

      if (prevData && prevData.totalTrades > 0) {
        setPrevStat({
          trades: prevData.totalTrades,
          wins: prevData.wins,
          losses: prevData.losses,
          pnl: prevData.totalPnl,
          netPnl: prevData.netPnl,
          bestDay: "",
          bestDayPnl: 0,
          worstDay: "",
          worstDayPnl: 0,
          bestSetup: null,
        });
      }

      setShow(true);
    }).catch(() => {});
  }, []);

  const dismiss = () => {
    const today = new Date();
    const weekKey = `weekly-review-${getMonday(today).toISOString().slice(0, 10)}`;
    localStorage.setItem(weekKey, "dismissed");
    setDismissed(true);
    setTimeout(() => setShow(false), 300);
  };

  if (!show || !stat) return null;

  const winRate = stat.trades > 0 ? Math.round((stat.wins / stat.trades) * 100) : 0;
  const prevWinRate = prevStat && prevStat.trades > 0 ? Math.round((prevStat.wins / prevStat.trades) * 100) : null;
  const pnlDiff = prevStat ? stat.netPnl - prevStat.netPnl : null;
  const lastMonDate = getMonday(new Date(new Date().getTime() - 7 * 86400000));
  const weekLabel = lastMonDate.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

  return (
    <Portal>
      <div className={cn(
        "fixed bottom-6 right-6 z-[150] w-80 rounded-2xl border border-stroke bg-card shadow-2xl overflow-hidden transition-all duration-300",
        dismissed ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stroke-2 bg-tinted">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-brand" />
            <div>
              <p className="text-xs font-semibold text-ink">Итоги недели</p>
              <p className="text-[10px] text-ink-5">{weekLabel}</p>
            </div>
          </div>
          <button onClick={dismiss} className="text-ink-4 hover:text-ink transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* P/L */}
        <div className="px-5 py-4">
          <div className={cn(
            "rounded-xl p-3 mb-3",
            stat.netPnl >= 0 ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-red-500/10 border border-red-500/20"
          )}>
            <p className="text-[10px] text-ink-5 mb-0.5">Чистый P/L за неделю</p>
            <div className="flex items-baseline justify-between">
              <p className={cn("text-2xl font-bold truncate min-w-0", stat.netPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                {fmt(stat.netPnl)}
              </p>
              {pnlDiff !== null && (
                <div className={cn("flex items-center gap-1 text-xs", pnlDiff >= 0 ? "text-emerald-400" : "text-red-400")}>
                  {pnlDiff >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {fmt(pnlDiff)} vs пред. неделя
                </div>
              )}
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="rounded-lg bg-tinted p-2 text-center">
              <p className="text-base font-bold text-ink">{stat.trades}</p>
              <p className="text-[10px] text-ink-5">Сделок</p>
            </div>
            <div className="rounded-lg bg-tinted p-2 text-center">
              <p className={cn("text-base font-bold", winRate >= 50 ? "text-emerald-400" : "text-red-400")}>{winRate}%</p>
              <p className="text-[10px] text-ink-5">{t("common_win_rate")}</p>
              {prevWinRate !== null && <p className="text-[9px] text-ink-5">{prevWinRate}% пред.</p>}
            </div>
            <div className="rounded-lg bg-tinted p-2 text-center">
              <p className="text-base font-bold text-emerald-400">{stat.wins}</p>
              <p className="text-[10px] text-ink-5">{stat.wins}W / {stat.losses}L</p>
            </div>
          </div>

          {/* Best/worst day */}
          {stat.bestDay && (
            <div className="space-y-1.5 mb-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-5">Лучший день</span>
                <span className="text-emerald-400 font-medium">{new Date(stat.bestDay + "T12:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} · {fmt(stat.bestDayPnl)}</span>
              </div>
              {stat.worstDay && stat.worstDayPnl < 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-5">Худший день</span>
                  <span className="text-red-400 font-medium">{new Date(stat.worstDay + "T12:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} · {fmt(stat.worstDayPnl)}</span>
                </div>
              )}
              {stat.bestSetup && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-5">Лучший сетап</span>
                  <span className="text-brand font-medium">{stat.bestSetup}</span>
                </div>
              )}
            </div>
          )}

          {/* CTA */}
          <Link
            href="/journal"
            onClick={dismiss}
            className="flex items-center justify-center gap-2 w-full rounded-xl py-2.5 text-sm font-medium text-white transition-all"
            style={{ background: "linear-gradient(135deg, #C85A1A, #A04514)" }}
          >
            <BookOpen className="h-4 w-4" />
            Написать разбор недели
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </Portal>
  );
}
