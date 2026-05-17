import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { NextRequest, NextResponse } from "next/server";
import { chat, extractJson, isOpenRouterEnabled, OpenRouterRequestError } from "@/lib/openrouter";
import { rateLimit } from "@/lib/rate-limit";
import { endOfLocalDay, startOfLocalDay } from "@/lib/date";

export async function POST(req: NextRequest) {
  const gate = await requireCapability("canUseAiTradeReview");
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;

  const limited = rateLimit(req, { key: `ai:journal-draft:${userId}`, limit: 20, windowMs: 60 * 60_000 });
  if (limited) return limited;

  if (!isOpenRouterEnabled()) {
    return NextResponse.json({ error: "AI is not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const dateStr = typeof body?.date === "string" ? body.date : "";
  const from = startOfLocalDay(dateStr);
  const to = endOfLocalDay(dateStr);
  if (!from || !to) {
    return NextResponse.json({ error: "date is required (YYYY-MM-DD)" }, { status: 400 });
  }

  const [trades, existingEntry] = await Promise.all([
    prisma.trade.findMany({
      where: { userId, entryDate: { gte: from, lte: to } },
      orderBy: { entryDate: "asc" },
      take: 50,
    }),
    prisma.journalEntry.findUnique({ where: { userId_date: { userId, date: from } } }).catch(() => null),
  ]);

  if (trades.length === 0) {
    return NextResponse.json({ error: "No trades for this day" }, { status: 400 });
  }

  const wins = trades.filter((t) => t.netPnl > 0);
  const losses = trades.filter((t) => t.netPnl < 0);
  const flat = trades.filter((t) => t.netPnl === 0);
  const totalNet = trades.reduce((s, t) => s + t.netPnl, 0);
  const avgR = trades.reduce((s, t) => s + t.rMultiple, 0) / trades.length;
  const setups = Array.from(new Set(trades.map((t) => t.setup).filter(Boolean)));
  const symbols = Array.from(new Set(trades.map((t) => t.symbol)));
  const mistakes = Array.from(new Set(
    trades.flatMap((t) => (t.mistakes ?? "").split(",").map((m) => m.trim()).filter(Boolean))
  ));
  const best = [...trades].sort((a, b) => b.netPnl - a.netPnl)[0] ?? null;
  const worst = [...trades].sort((a, b) => a.netPnl - b.netPnl)[0] ?? null;

  const dayJson = {
    date: dateStr,
    totalNetPnl: Number(totalNet.toFixed(2)),
    tradeCount: trades.length,
    wins: wins.length,
    losses: losses.length,
    breakEven: flat.length,
    winRate: trades.length ? Math.round((wins.length / trades.length) * 100) : 0,
    avgR: Number(avgR.toFixed(2)),
    symbols,
    setups,
    mistakes,
    bestTrade: best ? { symbol: best.symbol, side: best.side, netPnl: Number(best.netPnl.toFixed(2)), setup: best.setup ?? null } : null,
    worstTrade: worst ? { symbol: worst.symbol, side: worst.side, netPnl: Number(worst.netPnl.toFixed(2)), setup: worst.setup ?? null } : null,
    emotionsLogged: Array.from(new Set(trades.map((t) => t.emotionalState).filter(Boolean))),
    existingPreMarketNotes: existingEntry?.preMarketNotes ?? null,
    existingPostMarketNotes: existingEntry?.postMarketNotes ?? null,
  };

  try {
    const raw = await chat({
      json: true,
      temperature: 0.4,
      maxTokens: 700,
      messages: [
        {
          role: "system",
          content:
            "You are a senior trading coach helping a trader fill the daily journal for one day. " +
            "Reply ONLY with strict JSON: " +
            '{"postMarketNotes": string, "lessonsLearned": string, "notes": string}. ' +
            "postMarketNotes: 3-6 short factual sentences summarizing the session (P/L, instruments, setups, best/worst, what worked). " +
            "lessonsLearned: 1-3 concrete lessons drawn from the actual trades (not generic advice). " +
            "notes: 1-2 short observations on emotions, mistakes, or process. " +
            "Match the language of any existing notes. Be specific, no fluff, no markdown, no JSON keys in prose.",
        },
        {
          role: "user",
          content: `Day data:\n${JSON.stringify(dayJson)}`,
        },
      ],
    });

    const parsed = extractJson<{ postMarketNotes?: string; lessonsLearned?: string; notes?: string }>(raw);
    if (!parsed) {
      return NextResponse.json({ error: "AI returned no usable draft" }, { status: 502 });
    }

    return NextResponse.json({
      postMarketNotes: typeof parsed.postMarketNotes === "string" ? parsed.postMarketNotes.trim() : "",
      lessonsLearned: typeof parsed.lessonsLearned === "string" ? parsed.lessonsLearned.trim() : "",
      notes: typeof parsed.notes === "string" ? parsed.notes.trim() : "",
      aiPowered: true,
    });
  } catch (err) {
    if (err instanceof OpenRouterRequestError && err.isTransient) {
      return NextResponse.json({ error: "AI temporarily unavailable" }, { status: 503 });
    }
    console.error("[ai-journal-draft] OpenRouter error", err);
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }
}
