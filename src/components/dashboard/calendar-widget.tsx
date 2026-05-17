"use client";
import React, { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "@/lib/useT";

interface DayData { pnl: number; trades: number }

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export function CalendarWidget() {
  const t = useT();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [dailyPnl, setDailyPnl] = useState<Record<string, DayData>>({});
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async (y: number, m: number) => {
    setLoading(true);
    const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const lastDay = getDaysInMonth(y, m);
    const to = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    try {
      const tz = new Date().getTimezoneOffset();
      const res = await fetch(`/api/trades/stats?from=${from}&to=${to}&tzOffset=${tz}`);
      if (!res.ok) return;
      const data = await res.json();
      const map: Record<string, DayData> = {};
      for (const d of (data.calendarData || [])) {
        map[d.date] = { pnl: d.pnl, trades: d.trades };
      }
      setDailyPnl(map);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(year, month); }, [year, month, fetchData]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const monthName = new Date(year, month).toLocaleDateString("ru-RU", { month: "long", year: "numeric" });

  const dayHeaders = [t("dash_day_sun"), t("dash_day_mon"), t("dash_day_tue"), t("dash_day_wed"), t("dash_day_thu"), t("dash_day_fri"), t("dash_day_sat")];

  return (
    <div className="rounded-xl border border-stroke bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-ink">{t("dash_calendar")}</h3>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="rounded-lg p-1 text-ink-3 hover:text-ink hover:bg-tinted transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-ink-2 min-w-[160px] text-center capitalize">{monthName}</span>
          <button onClick={nextMonth} className="rounded-lg p-1 text-ink-3 hover:text-ink hover:bg-tinted transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayHeaders.map((d) => (
          <div key={d} className="text-center text-xs text-ink-5 py-1">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className={cn("grid grid-cols-7 gap-1", loading && "opacity-50 pointer-events-none")}>
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const data = dailyPnl[dateKey];
          const hasTrade = !!data;
          const pnl = data?.pnl ?? 0;

          return (
            <div
              key={day}
              className={cn(
                "aspect-square rounded-md flex items-center justify-center text-xs cursor-default transition-colors relative group",
                hasTrade && pnl > 500  && "bg-emerald-500/30 text-emerald-300",
                hasTrade && pnl > 0 && pnl <= 500 && "bg-emerald-500/15 text-emerald-400",
                hasTrade && pnl < 0 && pnl >= -500 && "bg-red-500/15 text-red-400",
                hasTrade && pnl < -500 && "bg-red-500/30 text-red-300",
                !hasTrade && "text-ink-5 hover:bg-tinted",
              )}
            >
              {day}
              {hasTrade && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 rounded-md bg-canvas border border-stroke-2 px-2 py-1.5 text-xs whitespace-nowrap shadow-lg">
                  <div className={cn("font-semibold", pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {pnl >= 0 ? "+" : ""}${Math.abs(pnl).toFixed(2)}
                  </div>
                  <div className="text-ink-5 text-[10px]">{data.trades} {t("dash_calendar_trades")}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-stroke">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/30" />
          <span className="text-[11px] text-ink-5">{t("dash_profitable_day")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-red-500/30" />
          <span className="text-[11px] text-ink-5">{t("dash_loss_day")}</span>
        </div>
      </div>
    </div>
  );
}
