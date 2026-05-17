"use client";
import { useState, useEffect, useCallback } from "react";

export interface TradeData {
  id: string;
  symbol: string;
  side: string;
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  entryDate: string;
  exitDate: string | null;
  pnl: number;
  fees: number;
  netPnl: number;
  rMultiple: number;
  stopLoss: number | null;
  takeProfit: number | null;
  setup: string | null;
  strategy: string | null;
  market: string;
  timeframe: string | null;
  notes: string | null;
  tags: string | null;
  rating: number | null;
  emotionalState: string | null;
  mistakes: string | null;
  status: string;
  accountId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StatsData {
  totalTrades: number;
  totalAnyTrades?: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  totalFees: number;
  netPnl: number;
  avgWin: number;
  avgLoss: number;
  biggestWin: number;
  biggestLoss: number;
  profitFactor: number;
  expectancy: number;
  avgRMultiple: number;
  maxDrawdown: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  avgDuration: number;
  dailyPnl: { date: string; pnl: number }[];
  cumulativePnl: { date: string; pnl: number }[];
  tradesBySetup: { name: string; trades: number; pnl: number; winRate: number; avgR: number }[];
  tradesBySymbol: { name: string; trades: number; pnl: number; winRate: number; avgR: number }[];
  tradesByDay: { day: string; trades: number; pnl: number; winRate: number }[];
  tradesBySide: { long: number; short: number };
  calendarData: { date: string; pnl: number; trades: number }[];
  tradesByHour: { hour: number; trades: number; pnl: number; winRate: number }[];
  tradePnls: number[];
  currentWinStreak: number;
  currentLossStreak: number;
  avgWinDuration: number;
  avgLossDuration: number;
  tradesSeries?: { label: string; n: number; pnl: number; cumPnl: number }[];
  byEmotionalState: { state: string; trades: number; winRate: number; pnl: number }[];
  byRating: { rating: number; trades: number; winRate: number; pnl: number }[];
  rMultipleHistogram: { label: string; count: number; isWin: boolean; pnl?: number; avgR?: number; share?: number }[];
  rollingWinRate: { n: number; wr: number }[];
}

export function useTrades(filters?: Record<string, string>) {
  const [trades, setTrades] = useState<TradeData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchTrades = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(filters || {});
      const res = await fetch(`/api/trades?${params}`);
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setTrades(data.trades);
      setTotal(data.total);
    } catch {
      // silently keep empty state; caller can show error if needed
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);

  return { trades, total, loading, refetch: fetchTrades };
}

export function useStats(from?: string, to?: string) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      params.set("tzOffset", String(new Date().getTimezoneOffset()));
      const res = await fetch(`/api/trades/stats?${params}`);
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      // Guarantee all array fields are present even if API returns an old shape
      setStats({
        dailyPnl: [],
        cumulativePnl: [],
        tradesBySetup: [],
        tradesBySymbol: [],
        tradesByDay: [],
        calendarData: [],
        tradesByHour: [],
        tradePnls: [],
        byEmotionalState: [],
        byRating: [],
        rMultipleHistogram: [],
        rollingWinRate: [],
        tradesBySide: { long: 0, short: 0 },
        ...data,
      });
    } catch {
      // silently keep null stats; page shows empty state
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
}

export async function createTrade(data: Record<string, unknown>) {
  const res = await fetch("/api/trades", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateTrade(id: string, data: Record<string, unknown>) {
  const res = await fetch(`/api/trades/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteTrade(id: string) {
  await fetch(`/api/trades/${id}`, { method: "DELETE" });
}
