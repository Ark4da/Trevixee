import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import {
  endOfLocalDay,
  endOfOffsetDay,
  parseClientDateTime,
  startOfLocalDay,
  startOfOffsetDay,
} from "@/lib/date";
import { getEntitlements } from "@/lib/entitlements";
import { requireAuth } from "@/lib/guards";

const ALLOWED_SORT_FIELDS = ["entryDate", "exitDate", "symbol", "pnl", "netPnl", "rMultiple", "quantity", "entryPrice"] as const;
type SortField = typeof ALLOWED_SORT_FIELDS[number];

export async function GET(req: NextRequest) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const symbol = url.searchParams.get("symbol");
  const side = url.searchParams.get("side");
  const market = url.searchParams.get("market");
  const setup = url.searchParams.get("setup");
  const status = url.searchParams.get("status");
  const accountId = url.searchParams.get("accountId");
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 2000);
  const sortParam = url.searchParams.get("sort") || "entryDate";
  const dirParam = url.searchParams.get("dir") || "desc";
  const tzOffsetRaw = Number(url.searchParams.get("tzOffset"));
  const tzOffset = Number.isFinite(tzOffsetRaw) ? tzOffsetRaw : null;

  const sortField: SortField = (ALLOWED_SORT_FIELDS as readonly string[]).includes(sortParam)
    ? (sortParam as SortField)
    : "entryDate";
  const sortDir = dirParam === "asc" ? "asc" : "desc";

  const ents = await getEntitlements(userId);
  const historyFloor = ents.maxHistoryDays > 0
    ? new Date(Date.now() - ents.maxHistoryDays * 86_400_000)
    : null;

  const where: Record<string, unknown> = { userId };
  {
    const dateFilter: Record<string, unknown> = {};
    if (historyFloor) dateFilter.gte = historyFloor;
    if (from) {
      const start = tzOffset === null ? startOfLocalDay(from) : startOfOffsetDay(from, tzOffset);
      if (start) {
        // clamp: never let Free user see beyond their floor
        dateFilter.gte = historyFloor
          ? new Date(Math.max(historyFloor.getTime(), start.getTime()))
          : start;
      }
    }
    if (to) {
      const end = tzOffset === null ? endOfLocalDay(to) : endOfOffsetDay(to, tzOffset);
      if (end) dateFilter.lte = end;
    }
    if (Object.keys(dateFilter).length) where.entryDate = dateFilter;
  }
  const tag = url.searchParams.get("tag");

  if (symbol) where.symbol = { contains: symbol.toUpperCase() };
  if (side && side !== "all") where.side = side;
  if (market && market !== "all") where.market = market;
  if (setup && setup !== "all") where.setup = setup;
  if (status && status !== "all") where.status = status;
  if (tag) where.tags = { contains: tag };
  if (accountId && accountId !== "all") {
    if (accountId === "unassigned") {
      where.accountId = null;
    } else {
      const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
      if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });
      where.accountId = accountId;
    }
  }

  const closedWhere = { ...where, status: "closed" };

  const [trades, total, agg, filterWins] = await Promise.all([
    prisma.trade.findMany({
      where,
      orderBy: { [sortField]: sortDir },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.trade.count({ where }),
    prisma.trade.aggregate({
      where: closedWhere,
      _sum: { pnl: true, netPnl: true },
      _count: { _all: true },
    }),
    prisma.trade.count({ where: { ...closedWhere, pnl: { gt: 0 } } }),
  ]);

  const filterTrades = agg._count._all;
  const filterPnl = Math.round((agg._sum.pnl ?? 0) * 100) / 100;
  const filterNetPnl = Math.round((agg._sum.netPnl ?? 0) * 100) / 100;

  return NextResponse.json({ trades, total, page, limit, filterPnl, filterNetPnl, filterTrades, filterWins });
}

async function resolveAccountId(
  userId: string,
  raw: unknown,
  fallback?: string | null
): Promise<{ ok: true; accountId: string | null } | { ok: false; response: NextResponse }> {
  if (raw === undefined) return { ok: true, accountId: fallback ?? null };
  const accountId = typeof raw === "string" ? raw.trim() : "";
  if (!accountId) return { ok: true, accountId: null };

  const account = await prisma.account.findFirst({
    where: { id: accountId, userId },
    select: { id: true },
  });
  if (!account) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Account not found" }, { status: 400 }),
    };
  }
  return { ok: true, accountId: account.id };
}

function calcPnlFields(body: Record<string, unknown>) {
  const entryPrice = body.entryPrice ? parseFloat(body.entryPrice as string) : 0;
  const exitPrice = body.exitPrice ? parseFloat(body.exitPrice as string) : null;
  const quantity = body.quantity ? parseFloat(body.quantity as string) : 0;
  const fees = parseFloat((body.fees as string) || "0");
  const stopLoss = body.stopLoss ? parseFloat(body.stopLoss as string) : null;

  const manualPnl = body.manualPnl !== undefined && body.manualPnl !== "" && body.manualPnl !== null
    ? parseFloat(body.manualPnl as string)
    : null;

  let pnl = 0;
  let netPnl = 0;
  let rMultiple = 0;

  const isClosed = manualPnl !== null || exitPrice !== null;

  if (manualPnl !== null) {
    pnl = manualPnl;
    netPnl = manualPnl - fees;
  } else if (exitPrice !== null && entryPrice > 0 && quantity > 0) {
    pnl = (body.side as string) === "long"
      ? (exitPrice - entryPrice) * quantity
      : (entryPrice - exitPrice) * quantity;
    netPnl = pnl - fees;
  } else {
    netPnl = -fees;
  }

  if (stopLoss && stopLoss > 0 && entryPrice > 0 && quantity > 0) {
    const risk = Math.abs(entryPrice - stopLoss) * quantity;
    rMultiple = risk > 0 ? pnl / risk : 0;
  }

  return { entryPrice, exitPrice, quantity, fees, stopLoss, pnl, netPnl, rMultiple, isClosed };
}

export async function POST(req: NextRequest) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;

  const body = await req.json();

  if (!body.symbol?.trim()) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
  }
  if (!body.entryDate) {
    return NextResponse.json({ error: "Entry date is required" }, { status: 400 });
  }

  const { entryPrice, exitPrice, quantity, fees, stopLoss, pnl, netPnl, rMultiple, isClosed } = calcPnlFields(body);
  const clientTimezoneOffset = Number(body.clientTimezoneOffset);
  const normalizedOffset = Number.isFinite(clientTimezoneOffset) ? clientTimezoneOffset : undefined;
  const parsedEntryDate = parseClientDateTime(body.entryDate, normalizedOffset);
  const parsedExitDate = body.exitDate ? parseClientDateTime(body.exitDate, normalizedOffset) : null;

  if (!parsedEntryDate) {
    return NextResponse.json({ error: "Invalid entry date" }, { status: 400 });
  }
  if (body.exitDate && !parsedExitDate) {
    return NextResponse.json({ error: "Invalid exit date" }, { status: 400 });
  }
  const accountGate = await resolveAccountId(userId, body.accountId);
  if (!accountGate.ok) return accountGate.response;

  const trade = await prisma.trade.create({
    data: {
      userId,
      symbol: (body.symbol as string).toUpperCase(),
      side: body.side as string,
      entryPrice,
      exitPrice,
      quantity,
      entryDate: parsedEntryDate,
      exitDate: parsedExitDate,
      pnl: Math.round(pnl * 100) / 100,
      fees: Math.round(fees * 100) / 100,
      netPnl: Math.round(netPnl * 100) / 100,
      rMultiple: Math.round(rMultiple * 100) / 100,
      stopLoss,
      takeProfit: body.takeProfit ? parseFloat(body.takeProfit as string) : null,
      setup: (body.setup as string) || null,
      strategy: (body.strategy as string) || null,
      market: (body.market as string) || "futures",
      timeframe: (body.timeframe as string) || null,
      notes: (body.notes as string) || null,
      tags: (body.tags as string) || null,
      rating: body.rating ? parseInt(body.rating as string) : null,
      emotionalState: (body.emotionalState as string) || null,
      mistakes: (body.mistakes as string) || null,
      status: isClosed ? "closed" : "open",
      accountId: accountGate.accountId,
      playbookId: (body.playbookId as string) || null,
    },
  });

  return NextResponse.json(trade, { status: 201 });
}
