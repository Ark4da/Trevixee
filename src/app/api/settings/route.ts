import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/guards";

export async function GET(req: NextRequest) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;

  const userId = gate.session.user.id;
  const settings = await prisma.userSettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;

  const userId = gate.session.user.id;
  const body = await req.json();

  const settings = await prisma.userSettings.upsert({
    where: { userId },
    update: {
      userName: body.userName,
      defaultMarket: body.defaultMarket,
      defaultCurrency: body.defaultCurrency,
      riskPerTrade: body.riskPerTrade !== undefined ? parseFloat(body.riskPerTrade) : undefined,
      accountBalance: body.accountBalance !== undefined ? parseFloat(body.accountBalance) : undefined,
      maxDailyLoss: body.maxDailyLoss !== undefined ? parseFloat(body.maxDailyLoss) : undefined,
      maxDailyTrades: body.maxDailyTrades !== undefined ? parseInt(body.maxDailyTrades) : undefined,
      timezone: body.timezone,
      hideAmountsInTeam: body.hideAmountsInTeam,
      privacyPeriodDays: body.privacyPeriodDays !== undefined ? parseInt(body.privacyPeriodDays) : undefined,
    },
    create: { userId },
  });
  return NextResponse.json(settings);
}
