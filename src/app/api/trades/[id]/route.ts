import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { parseClientDateTime } from "@/lib/date";
import { requireAuth } from "@/lib/guards";

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;
  const { id } = await params;
  const trade = await prisma.trade.findFirst({
    where: { id, userId },
  });
  if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(trade);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;
  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.trade.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const entryPrice = body.entryPrice ? parseFloat(body.entryPrice) : 0;
  const exitPrice = body.exitPrice ? parseFloat(body.exitPrice) : null;
  const quantity = body.quantity ? parseFloat(body.quantity) : 0;
  const fees = parseFloat(body.fees || "0");
  const stopLoss = body.stopLoss ? parseFloat(body.stopLoss) : null;

  const manualPnl = body.manualPnl !== undefined && body.manualPnl !== "" && body.manualPnl !== null
    ? parseFloat(body.manualPnl)
    : null;
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
  const accountGate = await resolveAccountId(userId, body.accountId, existing.accountId);
  if (!accountGate.ok) return accountGate.response;

  let pnl = 0;
  let netPnl = 0;
  let rMultiple = 0;

  const isClosed = manualPnl !== null || exitPrice !== null;

  if (manualPnl !== null) {
    pnl = manualPnl;
    netPnl = manualPnl - fees;
  } else if (exitPrice !== null && entryPrice > 0 && quantity > 0) {
    pnl = body.side === "long"
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

  const trade = await prisma.trade.update({
    where: { id, userId },
    data: {
      symbol: body.symbol.toUpperCase(),
      side: body.side,
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
      takeProfit: body.takeProfit ? parseFloat(body.takeProfit) : null,
      setup: body.setup || null,
      strategy: body.strategy || null,
      market: body.market || "futures",
      timeframe: body.timeframe || null,
      notes: body.notes || null,
      tags: body.tags || null,
      rating: body.rating ? parseInt(body.rating) : null,
      emotionalState: body.emotionalState || null,
      mistakes: body.mistakes || null,
      status: isClosed ? "closed" : "open",
      accountId: accountGate.accountId,
    },
  });

  return NextResponse.json(trade);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;
  const { id } = await params;
  const existing = await prisma.trade.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.trade.deleteMany({ where: { id, userId } });
  return NextResponse.json({ ok: true });
}
