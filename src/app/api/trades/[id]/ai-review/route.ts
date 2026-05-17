import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { NextRequest, NextResponse } from "next/server";
import { chat, extractJson, isOpenRouterEnabled, OpenRouterRequestError } from "@/lib/openrouter";
import { rateLimit } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

function sentence(parts: string[]): string {
  return parts.filter(Boolean).join(" ");
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const gate = await requireCapability("canUseAiTradeReview");
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;
  const limited = rateLimit(_req, { key: `ai:trade-review:${userId}`, limit: 40, windowMs: 60 * 60_000 });
  if (limited) return limited;
  const { id } = await params;

  const trade = await prisma.trade.findFirst({ where: { id, userId } });
  if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [maeMfe, violations, playbookRules] = await Promise.all([
    prisma.tradeMaeMfe.findUnique({ where: { tradeId: trade.id } }),
    prisma.ruleViolation.findMany({ where: { tradeId: trade.id, userId } }),
    trade.playbookId
      ? prisma.playbookRule.findMany({ where: { playbookId: trade.playbookId }, orderBy: { sortOrder: "asc" } })
      : Promise.resolve([]),
  ]);

  const isClosed = trade.status === "closed" || trade.exitPrice !== null;
  const isWin = trade.netPnl > 0;
  const hasRisk = Boolean(trade.stopLoss && trade.stopLoss > 0);
  const ruleCoverage = playbookRules.length > 0
    ? Math.max(0, 1 - violations.length / playbookRules.length)
    : 1;

  let score = 55;
  if (isClosed && isWin) score += 15;
  if (trade.rMultiple >= 1) score += 12;
  if (trade.rMultiple < 0) score -= 10;
  if (hasRisk) score += 10;
  if (trade.rating && trade.rating >= 4) score += 8;
  if (violations.length > 0) score -= Math.min(25, violations.length * 8);
  if (maeMfe && trade.netPnl > 0 && maeMfe.mfe > trade.netPnl * 2) score -= 5;
  score = Math.max(0, Math.min(100, score));

  const heuristicSummary = sentence([
    `${trade.symbol} ${trade.side.toUpperCase()} was a ${isClosed ? "closed" : "open"} ${trade.market} trade.`,
    isClosed ? `Net P/L was ${trade.netPnl >= 0 ? "+" : ""}${trade.netPnl.toFixed(2)} with ${trade.rMultiple.toFixed(2)}R.` : "",
    `Rule discipline score contribution: ${Math.round(ruleCoverage * 100)}%.`,
  ]);

  const heuristicStrengths = [
    hasRisk ? "Risk was defined with a stop loss before or during execution." : "",
    trade.setup ? `The setup was labeled as ${trade.setup}, which keeps review data searchable.` : "",
    isWin ? "The trade closed green after fees." : "",
    violations.length === 0 && playbookRules.length > 0 ? "No playbook rule violations were marked." : "",
  ].filter(Boolean);

  const heuristicRisks = [
    !hasRisk ? "No stop loss is stored, so initial risk and R quality are harder to verify." : "",
    violations.length > 0 ? `${violations.length} playbook rule violation${violations.length === 1 ? "" : "s"} were marked.` : "",
    !trade.notes ? "No trade notes are saved, which limits post-trade learning." : "",
    maeMfe && trade.netPnl > 0 && maeMfe.mfe > trade.netPnl * 2
      ? "MFE was much larger than captured P/L, suggesting exit timing deserves review."
      : "",
  ].filter(Boolean);

  const heuristicActions = [
    !hasRisk ? "Add the intended stop loss and compare planned risk with actual result." : "",
    violations.length > 0 ? "Review the violated playbook rules before taking the same setup again." : "",
    trade.rating && trade.rating <= 2 ? "Write one sentence on what would make this a higher-quality execution." : "",
    maeMfe ? "Compare MAE/MFE against entry and exit to decide whether management rules need tightening." : "",
  ].filter(Boolean);

  let summary = heuristicSummary;
  let strengths = heuristicStrengths;
  let risks = heuristicRisks;
  let actions = heuristicActions;
  let aiPowered = false;

  if (isOpenRouterEnabled()) {
    try {
      const tradeJson = {
        symbol: trade.symbol,
        side: trade.side,
        market: trade.market,
        status: trade.status,
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice,
        quantity: trade.quantity,
        stopLoss: trade.stopLoss,
        takeProfit: trade.takeProfit,
        netPnl: trade.netPnl,
        rMultiple: trade.rMultiple,
        setup: trade.setup,
        notes: trade.notes?.slice(0, 800) ?? null,
        tags: trade.tags,
        rating: trade.rating,
        emotionalState: trade.emotionalState,
        mae: maeMfe?.mae ?? null,
        mfe: maeMfe?.mfe ?? null,
        playbookRulesCount: playbookRules.length,
        violationsCount: violations.length,
      };

      const raw = await chat({
        json: true,
        temperature: 0.3,
        maxTokens: 600,
        messages: [
          {
            role: "system",
            content:
              "You are a senior trading coach. Review one trade and reply ONLY with strict JSON: " +
              `{"summary": string, "strengths": string[], "risks": string[], "actions": string[]}. ` +
              "Each array has 2-4 short items (under 22 words each). Be specific, no fluff, no markdown.",
          },
          {
            role: "user",
            content: `Trade JSON:\n${JSON.stringify(tradeJson)}`,
          },
        ],
      });

      const parsed = extractJson<{
        summary?: string;
        strengths?: string[];
        risks?: string[];
        actions?: string[];
      }>(raw);

      if (parsed && typeof parsed.summary === "string") {
        summary = parsed.summary.trim() || summary;
        if (Array.isArray(parsed.strengths) && parsed.strengths.length) strengths = parsed.strengths.slice(0, 5);
        if (Array.isArray(parsed.risks) && parsed.risks.length) risks = parsed.risks.slice(0, 5);
        if (Array.isArray(parsed.actions) && parsed.actions.length) actions = parsed.actions.slice(0, 5);
        aiPowered = true;
      }
    } catch (err) {
      if (err instanceof OpenRouterRequestError && err.isTransient) {
        console.warn(`[ai-review] OpenRouter temporarily unavailable (${err.status}); using heuristic fallback.`);
      } else {
        console.error("[ai-review] OpenRouter error", err);
      }
    }
  }

  return NextResponse.json({
    score,
    summary,
    strengths: strengths.length ? strengths : ["The trade has enough core fields to support structured review."],
    risks: risks.length ? risks : ["No major review risks were detected from the saved data."],
    actions: actions.length ? actions : ["Keep tagging this setup consistently so the pattern can be measured later."],
    aiPowered,
    context: {
      mae: maeMfe?.mae ?? null,
      mfe: maeMfe?.mfe ?? null,
      ruleViolations: violations.length,
      playbookRules: playbookRules.length,
    },
  });
}
