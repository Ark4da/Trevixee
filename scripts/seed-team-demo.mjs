process.env.DATABASE_URL ??= "postgresql://trascend:trascend@127.0.0.1:5432/trascend?schema=public";
process.env.DIRECT_URL ??= process.env.DATABASE_URL;

const { PrismaClient } = await import("@prisma/client");

const prisma = new PrismaClient();

const OWNER_EMAIL = process.env.TEAM_DEMO_OWNER_EMAIL ?? "rodionovcharenko2001@gmail.com";
const OWNER_ID = process.env.TEAM_DEMO_OWNER_ID ?? "cmod274al0003ibjdiqovbskx";
const WORKSPACE_SLUG = "alpha-traders-demo";

const demoMembers = [
  { email: "alex.petrov@trascend.local", name: "Alex Petrov", role: "mentor", hide: false, balance: 75000, maxLoss: 1200 },
  { email: "maria.chen@trascend.local", name: "Maria Chen", role: "mentor", hide: false, balance: 64000, maxLoss: 900 },
  { email: "max.kovalev@trascend.local", name: "Max Kovalev", role: "member", hide: false, balance: 42000, maxLoss: 550 },
  { email: "lina.park@trascend.local", name: "Lina Park", role: "member", hide: true, balance: 51000, maxLoss: 700 },
  { email: "sam.torres@trascend.local", name: "Sam Torres", role: "member", hide: false, balance: 38000, maxLoss: 500 },
  { email: "omar.reyes@trascend.local", name: "Omar Reyes", role: "member", hide: false, balance: 46000, maxLoss: 650 },
  { email: "nora.white@trascend.local", name: "Nora White", role: "member", hide: true, balance: 58000, maxLoss: 800 },
];

const symbols = ["NQ", "ES", "MNQ", "CL", "GC", "AAPL", "TSLA", "EURUSD"];
const setups = ["Opening drive", "VWAP reclaim", "Liquidity sweep", "Trend pullback", "Range fade", "News continuation"];
const emotions = ["focused", "calm", "rushed", "patient", "tilted"];

function dayOffset(days, hour = 15, minute = 30) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function displayName(user) {
  return user.name ?? user.email.split("@")[0];
}

async function upsertUser(member) {
  const user = await prisma.user.upsert({
    where: { email: member.email },
    update: {
      name: member.name,
      plan: "team",
      provider: "credentials",
    },
    create: {
      email: member.email,
      name: member.name,
      plan: "team",
      provider: "credentials",
    },
  });

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: {
      userName: member.name,
      hideAmountsInTeam: member.hide,
      accountBalance: member.balance,
      maxDailyLoss: member.maxLoss,
      timezone: "America/New_York",
    },
    create: {
      userId: user.id,
      userName: member.name,
      hideAmountsInTeam: member.hide,
      accountBalance: member.balance,
      maxDailyLoss: member.maxLoss,
      timezone: "America/New_York",
    },
  });

  return user;
}

async function main() {
  let owner = await prisma.user.findUnique({ where: { id: OWNER_ID } });
  const ownerByEmail = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
  const archivedOwnerIds = [];

  if (ownerByEmail && ownerByEmail.id !== OWNER_ID) {
    archivedOwnerIds.push(ownerByEmail.id);
    await prisma.user.update({
      where: { id: ownerByEmail.id },
      data: { email: `archived-${ownerByEmail.id}-${OWNER_EMAIL}` },
    });
  }

  if (!owner) {
    owner = await prisma.user.create({
      data: {
        id: OWNER_ID,
        email: OWNER_EMAIL,
        name: "Radahn",
        provider: "credentials",
        plan: "team",
      },
    });
  } else {
    owner = await prisma.user.update({
      where: { id: owner.id },
      data: { plan: "team", name: owner.name ?? "Radahn" },
    });
  }

  await prisma.userSettings.upsert({
    where: { userId: owner.id },
    update: {
      userName: displayName(owner),
      hideAmountsInTeam: false,
      accountBalance: 50000,
      maxDailyLoss: 800,
    },
    create: {
      userId: owner.id,
      userName: displayName(owner),
      hideAmountsInTeam: false,
      accountBalance: 50000,
      maxDailyLoss: 800,
    },
  });

  const realUsers = await prisma.user.findMany({
    where: {
      AND: [
        { email: { not: { endsWith: "@trascend.local" } } },
        { email: { not: { startsWith: "archived-" } } },
      ],
    },
    select: { id: true, email: true, name: true },
  });
  for (const user of realUsers) {
    await prisma.user.update({ where: { id: user.id }, data: { plan: "team" } });
  }

  const demoUsers = [];
  for (const member of demoMembers) demoUsers.push(await upsertUser(member));
  const allWorkspaceUsers = [...realUsers, ...demoUsers];

  const workspace = await prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    update: {
      name: "Alpha Traders",
      ownerUserId: owner.id,
    },
    create: {
      name: "Alpha Traders",
      slug: WORKSPACE_SLUG,
      ownerUserId: owner.id,
    },
  });

  if (archivedOwnerIds.length > 0) {
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: workspace.id, userId: { in: archivedOwnerIds } },
    });
  }

  const archivedUsers = await prisma.user.findMany({
    where: { email: { startsWith: "archived-" } },
    select: { id: true },
  });
  if (archivedUsers.length > 0) {
    await prisma.workspaceMember.deleteMany({
      where: {
        workspaceId: workspace.id,
        userId: { in: archivedUsers.map((user) => user.id) },
      },
    });
  }

  for (const user of allWorkspaceUsers) {
    const fallback = demoMembers.find((m) => m.email === user.email);
    const role = user.id === owner.id ? "owner" : fallback?.role ?? "mentor";
    await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
      update: { role, privacyPeriodUntil: null },
      create: { workspaceId: workspace.id, userId: user.id, role },
    });
  }

  const demoUserIds = demoUsers.map((u) => u.id);
  const oldDemoTrades = await prisma.trade.findMany({
    where: { userId: { in: demoUserIds } },
    select: { id: true },
  });
  const oldDemoTradeIds = oldDemoTrades.map((trade) => trade.id);

  await prisma.tradeComment.deleteMany({
    where: {
      workspaceId: workspace.id,
      OR: [
        { authorUserId: { in: demoUserIds } },
        oldDemoTradeIds.length ? { tradeId: { in: oldDemoTradeIds } } : { id: "__never__" },
      ],
    },
  });
  await prisma.pinnedTeamContent.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.ruleViolation.deleteMany({ where: { userId: { in: demoUserIds } } });
  await prisma.journalEntry.deleteMany({ where: { userId: { in: demoUserIds } } });
  await prisma.trade.deleteMany({ where: { userId: { in: demoUserIds } } });

  const createdTrades = [];
  for (let userIndex = 0; userIndex < demoUsers.length; userIndex += 1) {
    const user = demoUsers[userIndex];
    const totalTrades = 12 + (userIndex % 4) * 3;
    for (let tradeIndex = 0; tradeIndex < totalTrades; tradeIndex += 1) {
      const daysAgo = (tradeIndex * 2 + userIndex) % 30;
      const winner = (tradeIndex + userIndex) % 5 !== 2;
      const rMultiple = winner
        ? round2(0.45 + ((tradeIndex + userIndex) % 5) * 0.32)
        : round2(-0.35 - ((tradeIndex + userIndex) % 4) * 0.22);
      const netPnl = round2(rMultiple * (165 + userIndex * 35) - 4.5);
      const entryDate = dayOffset(daysAgo, 9 + (tradeIndex % 5), 35);
      const exitDate = dayOffset(daysAgo, 10 + (tradeIndex % 6), 15);
      const side = (tradeIndex + userIndex) % 2 === 0 ? "long" : "short";
      const symbol = symbols[(tradeIndex + userIndex) % symbols.length];
      const entryPrice = 100 + tradeIndex * 2 + userIndex * 3;
      const exitPrice = side === "long"
        ? entryPrice + rMultiple * 1.7
        : entryPrice - rMultiple * 1.7;

      const trade = await prisma.trade.create({
        data: {
          userId: user.id,
          symbol,
          side,
          entryPrice: round2(entryPrice),
          exitPrice: round2(exitPrice),
          quantity: 2 + (tradeIndex % 3),
          entryDate,
          exitDate,
          pnl: netPnl + 4.5,
          fees: 4.5,
          netPnl,
          rMultiple,
          stopLoss: round2(side === "long" ? entryPrice - 2.2 : entryPrice + 2.2),
          takeProfit: round2(side === "long" ? entryPrice + 4.5 : entryPrice - 4.5),
          setup: setups[(tradeIndex + userIndex) % setups.length],
          strategy: "Team playbook",
          market: symbol.includes("USD") ? "forex" : symbol.length <= 3 ? "futures" : "stocks",
          timeframe: tradeIndex % 2 === 0 ? "15m" : "1h",
          notes: winner ? "Clean execution, followed the planned exit." : "Late entry and reduced follow-through.",
          tags: winner ? "discipline,reviewed" : "review,risk",
          rating: winner ? 4 + (tradeIndex % 2) : 2 + (tradeIndex % 2),
          emotionalState: emotions[(tradeIndex + userIndex) % emotions.length],
          mistakes: winner ? null : "late entry,oversized",
          status: "closed",
          createdAt: exitDate,
        },
      });
      createdTrades.push(trade);
    }

    if (userIndex < 5) {
      const entryPrice = 180 + userIndex * 12;
      await prisma.trade.create({
        data: {
          userId: user.id,
          symbol: symbols[(userIndex + 2) % symbols.length],
          side: userIndex % 2 === 0 ? "long" : "short",
          entryPrice,
          quantity: 1 + userIndex,
          entryDate: dayOffset(0, 11 + userIndex, 20),
          pnl: 0,
          fees: 0,
          netPnl: 0,
          rMultiple: 0,
          stopLoss: userIndex % 2 === 0 ? entryPrice - 4 : entryPrice + 4,
          setup: setups[(userIndex + 1) % setups.length],
          strategy: "Team playbook",
          market: "futures",
          timeframe: "15m",
          notes: "Open demo risk for team dashboard.",
          status: "open",
          createdAt: dayOffset(0, 11 + userIndex, 22),
        },
      });
    }

    for (let day = 0; day < 21; day += 1) {
      if ((day + userIndex) % 4 === 0) continue;
      const journalDate = dayOffset(day, 7, 0);
      await prisma.journalEntry.create({
        data: {
          userId: user.id,
          date: journalDate,
          preMarketNotes: "Focus on A+ setups and wait for confirmation.",
          postMarketNotes: (day + userIndex) % 6 === 0
            ? "Broke one rule after the second trade. Logged review item."
            : "Executed plan and wrote screenshots into the journal.",
          marketCondition: day % 3 === 0 ? "trend day" : "balanced auction",
          emotionalState: emotions[(day + userIndex) % emotions.length],
          rulesFollowed: (day + userIndex) % 6 !== 0,
          lessonsLearned: "Size only after confirmation; no chasing into the close.",
          dailyGoal: "Three quality decisions before three trades.",
          goalMet: (day + userIndex) % 5 !== 0,
          rating: 3 + ((day + userIndex) % 3),
          notes: "Demo team journal entry.",
          createdAt: journalDate,
          updatedAt: dayOffset(day, 17, 5),
        },
      });
    }
  }

  const pinTrades = createdTrades
    .filter((trade) => trade.rMultiple > 1 || trade.rMultiple < -0.7)
    .slice(0, 4);
  for (const trade of pinTrades) {
    await prisma.pinnedTeamContent.create({
      data: {
        workspaceId: workspace.id,
        kind: "trade",
        refId: trade.id,
        pinnedByUserId: owner.id,
        pinnedAt: dayOffset(Math.max(0, Math.floor(Math.random() * 4)), 16, 30),
      },
    });
    await prisma.tradeComment.create({
      data: {
        workspaceId: workspace.id,
        tradeId: trade.id,
        authorUserId: owner.id,
        body: trade.rMultiple > 0
          ? "Good example for the team: entry waited for confirmation and risk stayed fixed."
          : "Review this one together: the thesis changed, but the trade stayed open too long.",
        createdAt: dayOffset(0, 18, 10),
      },
    });
  }

  const violationTrades = createdTrades.filter((trade) => trade.rMultiple < -0.55).slice(0, 6);
  for (const trade of violationTrades) {
    await prisma.ruleViolation.create({
      data: {
        userId: trade.userId,
        tradeId: trade.id,
        playbookId: "demo-playbook",
        ruleId: "demo-risk-rule",
        note: trade.rMultiple < -0.75 ? "Exceeded planned stop distance" : "Entered before confirmation",
        detectedAt: trade.exitDate ?? new Date(),
      },
    });
  }

  console.log(`Seeded Team demo workspace "${workspace.name}" with ${demoUsers.length} demo members and ${createdTrades.length} closed trades.`);
  console.log(`Workspace ID: ${workspace.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
