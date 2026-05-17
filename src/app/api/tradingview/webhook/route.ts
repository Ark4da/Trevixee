import { prisma } from "@/lib/db";
import { getEntitlements } from "@/lib/entitlements";
import { requireCapability } from "@/lib/guards";
import { rateLimit } from "@/lib/rate-limit";
import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function secret(): string | null {
  return process.env.TRADINGVIEW_WEBHOOK_SECRET || process.env.NEXTAUTH_SECRET || null;
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

function encodeToken(userId: string, key: string): string {
  const payload = Buffer.from(JSON.stringify({ userId }), "utf8").toString("base64url");
  return `${payload}.${sign(payload, key)}`;
}

function decodeToken(token: string, key: string): string | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload, key);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId?: string };
    return typeof parsed.userId === "string" ? parsed.userId : null;
  } catch {
    return null;
  }
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(req: NextRequest) {
  const gate = await requireCapability("canUseTradingViewWebhook");
  if (!gate.ok) return gate.response;
  const key = secret();
  if (!key) return NextResponse.json({ error: "TradingView webhook secret is not configured" }, { status: 500 });

  const token = encodeToken(gate.session.user.id, key);
  const webhookUrl = new URL("/api/tradingview/webhook", req.nextUrl.origin);
  webhookUrl.searchParams.set("token", token);

  return NextResponse.json({
    webhookUrl: webhookUrl.toString(),
    examplePayload: {
      symbol: "{{ticker}}",
      side: "long",
      price: "{{close}}",
      quantity: 1,
      action: "open",
      market: "futures",
      notes: "TradingView alert",
    },
  });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { key: "tradingview-webhook", limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const key = secret();
  if (!key) return NextResponse.json({ error: "TradingView webhook secret is not configured" }, { status: 500 });

  const token = req.nextUrl.searchParams.get("token") || req.headers.get("x-trevixe-webhook-token") || "";
  const userId = decodeToken(token, key);
  if (!userId) return NextResponse.json({ error: "Invalid webhook token" }, { status: 401 });

  const entitlements = await getEntitlements(userId);
  if (!entitlements.capabilities.canUseTradingViewWebhook) {
    return NextResponse.json({ error: "Forbidden", code: "requires_pro" }, { status: 403 });
  }

  const body = await req.json();
  const symbol = String(body.symbol ?? body.ticker ?? "").toUpperCase().trim();
  const side = String(body.side ?? body.direction ?? "long").toLowerCase().includes("short") ? "short" : "long";
  const action = String(body.action ?? "open").toLowerCase();
  const price = numberValue(body.price ?? body.entryPrice ?? body.close);
  const quantity = numberValue(body.quantity ?? body.qty, 1);
  if (!symbol || price <= 0) {
    return NextResponse.json({ error: "symbol and price are required" }, { status: 400 });
  }

  if (action === "close") {
    const openTrade = await prisma.trade.findFirst({
      where: { userId, symbol, side, status: "open" },
      orderBy: { entryDate: "desc" },
    });
    if (!openTrade) return NextResponse.json({ error: "No open trade found" }, { status: 404 });

    const pnl = side === "long"
      ? (price - openTrade.entryPrice) * openTrade.quantity
      : (openTrade.entryPrice - price) * openTrade.quantity;
    const updated = await prisma.trade.update({
      where: { id: openTrade.id },
      data: {
        exitPrice: price,
        exitDate: new Date(),
        pnl: Math.round(pnl * 100) / 100,
        netPnl: Math.round((pnl - openTrade.fees) * 100) / 100,
        status: "closed",
        notes: [openTrade.notes, body.notes || "Closed by TradingView webhook"].filter(Boolean).join("\n"),
      },
    });
    return NextResponse.json({ action: "closed", trade: updated });
  }

  const created = await prisma.trade.create({
    data: {
      userId,
      symbol,
      side,
      entryPrice: price,
      quantity,
      entryDate: new Date(),
      market: String(body.market ?? "futures"),
      stopLoss: body.stopLoss ? numberValue(body.stopLoss) : null,
      takeProfit: body.takeProfit ? numberValue(body.takeProfit) : null,
      setup: body.setup ? String(body.setup) : "TradingView",
      notes: body.notes ? String(body.notes) : "Opened by TradingView webhook",
      status: "open",
    },
  });

  return NextResponse.json({ action: "opened", trade: created });
}
