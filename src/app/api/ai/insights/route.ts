import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { NextRequest, NextResponse } from "next/server";
import { chat, extractJson, isOpenRouterEnabled, OpenRouterDisabledError, OpenRouterRequestError } from "@/lib/openrouter";
import { rateLimit } from "@/lib/rate-limit";

interface InsightItem {
  title: string;
  detail: string;
  metric?: string;
  severity: "good" | "warn" | "bad" | "neutral";
}

interface InsightsResponse {
  generatedAt: string;
  tradesAnalyzed: number;
  windowDays: number;
  insights: InsightItem[];
  aiPowered: boolean;
}

const MAX_TRADES = 80;
const DEFAULT_WINDOW_DAYS = 90;

export async function GET(req: NextRequest) {
  const gate = await requireCapability("canUseAiTradeReview");
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;
  const limited = rateLimit(req, { key: `ai:insights:${userId}`, limit: 20, windowMs: 60 * 60_000 });
  if (limited) return limited;

  const url = new URL(req.url);
  const windowDays = Math.min(365, Math.max(7, Number(url.searchParams.get("days")) || DEFAULT_WINDOW_DAYS));
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  const trades = await prisma.trade.findMany({
    where: { userId, entryDate: { gte: since } },
    orderBy: { entryDate: "desc" },
    take: MAX_TRADES,
    select: {
      symbol: true, side: true, market: true, status: true,
      entryPrice: true, exitPrice: true, quantity: true,
      entryDate: true, exitDate: true,
      netPnl: true, rMultiple: true,
      stopLoss: true, takeProfit: true,
      setup: true, tags: true, rating: true,
      emotionalState: true, notes: true,
    },
  });

  if (trades.length === 0) {
    return NextResponse.json<InsightsResponse>({
      generatedAt: new Date().toISOString(),
      tradesAnalyzed: 0,
      windowDays,
      insights: [{
        title: "Not enough data yet",
        detail: "Log trades for this period to get AI pattern detection.",
        severity: "neutral",
      }],
      aiPowered: false,
    });
  }

  const stats = summarize(trades);

  if (!isOpenRouterEnabled()) {
    return NextResponse.json<InsightsResponse>({
      generatedAt: new Date().toISOString(),
      tradesAnalyzed: trades.length,
      windowDays,
      insights: heuristicInsights(stats),
      aiPowered: false,
    });
  }

  try {
    const raw = await chat({
      json: true,
      temperature: 0.4,
      maxTokens: 800,
      messages: [
        {
          role: "system",
          content:
            "You are a trading performance analyst. Given aggregate stats and a sample of trades, " +
            "find 4-6 concrete behavioral or statistical patterns the trader should know about. " +
            'Reply with strict JSON: {"insights":[{"title":string,"detail":string,"metric":string,"severity":"good"|"warn"|"bad"|"neutral"}]}. ' +
            "Each detail must be one or two short sentences with a specific number. No markdown, no preamble.",
        },
        {
          role: "user",
          content: `Window: last ${windowDays} days. Stats and sample below.\n${JSON.stringify(stats)}`,
        },
      ],
    });

    const parsed = extractJson<{ insights?: InsightItem[] }>(raw);
    const insights = Array.isArray(parsed?.insights) && parsed!.insights!.length
      ? parsed!.insights!.slice(0, 6).map(normalizeInsight)
      : heuristicInsights(stats);

    return NextResponse.json<InsightsResponse>({
      generatedAt: new Date().toISOString(),
      tradesAnalyzed: trades.length,
      windowDays,
      insights,
      aiPowered: true,
    });
  } catch (err) {
    if (err instanceof OpenRouterDisabledError) {
      // shouldn't happen — guard above — but keep safe
    } else if (err instanceof OpenRouterRequestError && err.isTransient) {
      console.warn(`[ai/insights] OpenRouter temporarily unavailable (${err.status}); using heuristic fallback.`);
    } else {
      console.error("[ai/insights] OpenRouter error", err);
    }
    return NextResponse.json<InsightsResponse>({
      generatedAt: new Date().toISOString(),
      tradesAnalyzed: trades.length,
      windowDays,
      insights: heuristicInsights(stats),
      aiPowered: false,
    });
  }
}

function normalizeInsight(i: Partial<InsightItem>): InsightItem {
  const sev = (["good", "warn", "bad", "neutral"] as const).includes(i.severity as never)
    ? (i.severity as InsightItem["severity"])
    : "neutral";
  return {
    title: String(i.title ?? "Pattern").slice(0, 120),
    detail: String(i.detail ?? "").slice(0, 400),
    metric: i.metric ? String(i.metric).slice(0, 60) : undefined,
    severity: sev,
  };
}

type Trade = {
  symbol: string; side: string; market: string; status: string;
  entryPrice: number; exitPrice: number | null; quantity: number;
  entryDate: Date; exitDate: Date | null;
  netPnl: number; rMultiple: number;
  stopLoss: number | null; takeProfit: number | null;
  setup: string | null; tags: string | null; rating: number | null;
  emotionalState: string | null; notes: string | null;
};

function summarize(trades: Trade[]) {
  const closed = trades.filter((t) => t.status === "closed" || t.exitPrice !== null);
  const wins = closed.filter((t) => t.netPnl > 0);
  const losses = closed.filter((t) => t.netPnl < 0);
  const totalPnl = closed.reduce((s, t) => s + t.netPnl, 0);
  const avgR = closed.length ? closed.reduce((s, t) => s + t.rMultiple, 0) / closed.length : 0;

  const byDow = new Array(7).fill(null).map(() => ({ trades: 0, wins: 0, pnl: 0 }));
  const bySetup: Record<string, { trades: number; wins: number; pnl: number }> = {};
  const bySymbol: Record<string, { trades: number; wins: number; pnl: number }> = {};
  const byEmotion: Record<string, { trades: number; wins: number; pnl: number }> = {};

  for (const t of closed) {
    const dow = new Date(t.entryDate).getDay();
    byDow[dow].trades++;
    byDow[dow].pnl += t.netPnl;
    if (t.netPnl > 0) byDow[dow].wins++;

    const setup = t.setup || "untagged";
    bySetup[setup] = bySetup[setup] || { trades: 0, wins: 0, pnl: 0 };
    bySetup[setup].trades++;
    bySetup[setup].pnl += t.netPnl;
    if (t.netPnl > 0) bySetup[setup].wins++;

    bySymbol[t.symbol] = bySymbol[t.symbol] || { trades: 0, wins: 0, pnl: 0 };
    bySymbol[t.symbol].trades++;
    bySymbol[t.symbol].pnl += t.netPnl;
    if (t.netPnl > 0) bySymbol[t.symbol].wins++;

    const emo = t.emotionalState || "unspecified";
    byEmotion[emo] = byEmotion[emo] || { trades: 0, wins: 0, pnl: 0 };
    byEmotion[emo].trades++;
    byEmotion[emo].pnl += t.netPnl;
    if (t.netPnl > 0) byEmotion[emo].wins++;
  }

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return {
    totals: {
      trades: trades.length,
      closed: closed.length,
      open: trades.length - closed.length,
      winRate: closed.length ? +(wins.length / closed.length * 100).toFixed(1) : 0,
      avgRMultiple: +avgR.toFixed(2),
      netPnl: +totalPnl.toFixed(2),
      bestWin: closed.reduce((m, t) => Math.max(m, t.netPnl), 0).toFixed(2),
      worstLoss: closed.reduce((m, t) => Math.min(m, t.netPnl), 0).toFixed(2),
    },
    byDayOfWeek: byDow.map((d, i) => ({
      day: dayNames[i],
      trades: d.trades,
      winRate: d.trades ? +(d.wins / d.trades * 100).toFixed(1) : 0,
      pnl: +d.pnl.toFixed(2),
    })),
    bySetup: rankObject(bySetup, 6),
    bySymbol: rankObject(bySymbol, 6),
    byEmotion: rankObject(byEmotion, 5),
    sample: closed.slice(0, 12).map((t) => ({
      symbol: t.symbol,
      side: t.side,
      pnl: +t.netPnl.toFixed(2),
      r: +t.rMultiple.toFixed(2),
      setup: t.setup,
      tags: t.tags,
      emotion: t.emotionalState,
      day: dayNames[new Date(t.entryDate).getDay()],
      hadStop: Boolean(t.stopLoss),
    })),
  };
}

function rankObject(obj: Record<string, { trades: number; wins: number; pnl: number }>, limit: number) {
  return Object.entries(obj)
    .map(([key, v]) => ({
      key,
      trades: v.trades,
      winRate: v.trades ? +(v.wins / v.trades * 100).toFixed(1) : 0,
      pnl: +v.pnl.toFixed(2),
    }))
    .sort((a, b) => b.trades - a.trades)
    .slice(0, limit);
}

type Stats = ReturnType<typeof summarize>;

function heuristicInsights(stats: Stats): InsightItem[] {
  const out: InsightItem[] = [];
  out.push({
    title: `${stats.totals.winRate}% win rate over ${stats.totals.closed} closed trades`,
    detail: `Average R is ${stats.totals.avgRMultiple}, net P/L ${stats.totals.netPnl}.`,
    metric: `${stats.totals.winRate}%`,
    severity: stats.totals.winRate >= 50 ? "good" : "warn",
  });
  const worstDay = [...stats.byDayOfWeek].filter((d) => d.trades >= 2).sort((a, b) => a.pnl - b.pnl)[0];
  if (worstDay && worstDay.pnl < 0) {
    out.push({
      title: `${worstDay.day} is your weakest day`,
      detail: `Net P/L ${worstDay.pnl} across ${worstDay.trades} trades, win rate ${worstDay.winRate}%.`,
      metric: `${worstDay.day} ${worstDay.pnl}`,
      severity: "bad",
    });
  }
  const worstSetup = stats.bySetup.filter((s) => s.trades >= 2).sort((a, b) => a.pnl - b.pnl)[0];
  if (worstSetup && worstSetup.pnl < 0) {
    out.push({
      title: `Setup "${worstSetup.key}" is bleeding`,
      detail: `${worstSetup.trades} trades, ${worstSetup.winRate}% win rate, P/L ${worstSetup.pnl}.`,
      severity: "bad",
    });
  }
  const bestSetup = stats.bySetup.filter((s) => s.trades >= 2).sort((a, b) => b.pnl - a.pnl)[0];
  if (bestSetup && bestSetup.pnl > 0) {
    out.push({
      title: `"${bestSetup.key}" is your strongest setup`,
      detail: `${bestSetup.trades} trades, ${bestSetup.winRate}% win rate, P/L +${bestSetup.pnl}.`,
      severity: "good",
    });
  }
  return out;
}
