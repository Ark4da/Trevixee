import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { NextResponse } from "next/server";

export async function GET() {
  const gate = await requireCapability("canUseAdvancedAlerts");
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [settings, trades] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId } }),
    prisma.trade.findMany({
      where: { userId, entryDate: { gte: since } },
      orderBy: { entryDate: "desc" },
      take: 200,
    }),
  ]);

  const closed = trades.filter((trade) => trade.status === "closed");
  const wins = closed.filter((trade) => trade.netPnl > 0).length;
  const losses = closed.filter((trade) => trade.netPnl < 0).length;
  const netPnl = closed.reduce((sum, trade) => sum + trade.netPnl, 0);
  const avgR = closed.length ? closed.reduce((sum, trade) => sum + trade.rMultiple, 0) / closed.length : 0;
  const today = new Date().toISOString().slice(0, 10);
  const todayTrades = trades.filter((trade) => trade.entryDate.toISOString().slice(0, 10) === today);
  const todayNet = todayTrades.reduce((sum, trade) => sum + trade.netPnl, 0);
  const maxDailyLoss = settings?.maxDailyLoss ?? 0;
  const maxDailyTrades = settings?.maxDailyTrades ?? 0;

  const alerts: Array<{ id: string; level: "info" | "warning" | "critical"; title: string; body: string }> = [];
  if (maxDailyLoss > 0 && todayNet <= -Math.abs(maxDailyLoss)) {
    alerts.push({
      id: "daily-loss",
      level: "critical",
      title: "Daily loss limit reached",
      body: `Today's net P/L is ${todayNet.toFixed(2)}, which is at or beyond the configured ${maxDailyLoss.toFixed(2)} limit.`,
    });
  }
  if (maxDailyTrades > 0 && todayTrades.length >= maxDailyTrades) {
    alerts.push({
      id: "daily-trades",
      level: "warning",
      title: "Daily trade count limit reached",
      body: `You logged ${todayTrades.length} trades today against a limit of ${maxDailyTrades}.`,
    });
  }
  if (closed.length >= 10 && wins / closed.length < 0.4) {
    alerts.push({
      id: "win-rate",
      level: "warning",
      title: "Win rate below 40%",
      body: `Last 30 days: ${wins} wins and ${losses} losses across ${closed.length} closed trades.`,
    });
  }
  if (closed.length >= 5 && avgR < 0) {
    alerts.push({
      id: "negative-r",
      level: "warning",
      title: "Average R is negative",
      body: `Average R over the last 30 days is ${avgR.toFixed(2)}R. Review sizing, stops, and exit discipline.`,
    });
  }
  if (alerts.length === 0) {
    alerts.push({
      id: "clear",
      level: "info",
      title: "No advanced alerts right now",
      body: `Last 30 days net P/L is ${netPnl.toFixed(2)} across ${closed.length} closed trades.`,
    });
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    metrics: { closedTrades: closed.length, wins, losses, netPnl, avgR, todayTrades: todayTrades.length, todayNet },
    alerts,
  });
}
