"use client";
/**
 * useAlerts (P1.5-34)
 *
 * Fires toast alerts when dangerous trading conditions are met:
 *   1. Daily loss limit reached/exceeded  → red alert
 *   2. 3 consecutive losses               → amber warning
 *
 * Call this hook on the Trades page after every trade refresh.
 * Pass `trades` (today's trades) + toast function.
 *
 * Alerts are shown once per calendar day + trigger via sessionStorage dedup.
 */
import { useEffect, useRef } from "react";

interface TradeLike {
  pnl: number;
  netPnl: number;
  entryDate: string;
}

interface AlertSettings {
  maxDailyLoss: number;   // 0 = disabled
}

function todayKey() {
  return new Date().toISOString().split("T")[0];
}

function alreadyShown(key: string): boolean {
  try { return sessionStorage.getItem(key) === "1"; } catch { return false; }
}

function markShown(key: string) {
  try { sessionStorage.setItem(key, "1"); } catch {}
}

function isToday(dateStr: string): boolean {
  return new Date(dateStr).toISOString().split("T")[0] === todayKey();
}

export function useAlerts(
  trades: TradeLike[],
  settings: AlertSettings | null,
  showToast: (message: string, type: "success" | "error" | "warning") => void
) {
  // Keep a ref so we don't re-fire on every render, only on trades changes
  const prevCountRef = useRef<number>(0);

  useEffect(() => {
    if (!trades || trades.length === 0) return;
    if (trades.length === prevCountRef.current) return;
    prevCountRef.current = trades.length;

    const todayTrades = trades.filter(t => isToday(t.entryDate));
    if (todayTrades.length === 0) return;

    const todayDate = todayKey();

    // ── Alert 1: Daily loss limit ────────────────────────────────────────────
    if (settings && settings.maxDailyLoss > 0) {
      const todayNetPnl = todayTrades.reduce((sum, t) => sum + t.netPnl, 0);
      const lossKey = `alert_daily_loss_${todayDate}`;
      if (todayNetPnl <= -settings.maxDailyLoss && !alreadyShown(lossKey)) {
        markShown(lossKey);
        showToast(
          `Daily loss limit reached: ${todayNetPnl.toFixed(2)}. Stop trading for today.`,
          "error"
        );
      }
    }

    // ── Alert 2: 3 consecutive losses ────────────────────────────────────────
    const streakKey = `alert_loss_streak_${todayDate}`;
    if (!alreadyShown(streakKey) && todayTrades.length >= 3) {
      const last3 = todayTrades.slice(-3);
      if (last3.every(t => t.netPnl < 0)) {
        markShown(streakKey);
        showToast(
          "3 losses in a row. Consider stepping away and reviewing your plan.",
          "warning"
        );
      }
    }
  }, [trades, settings, showToast]);
}
