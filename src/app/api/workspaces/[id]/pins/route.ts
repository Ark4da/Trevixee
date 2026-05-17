import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWorkspaceMember, requireWorkspaceRole } from "@/lib/guards";

type Params = { params: Promise<{ id: string }> };
type PinKind = "trade" | "note" | "playbook" | "article";

const PIN_KINDS = new Set<PinKind>(["trade", "note", "playbook", "article"]);

// GET /api/workspaces/:id/pins
// Returns mentor-pinned workspace content. Trade pins are enriched for feed display.
export async function GET(_req: NextRequest, { params }: Params) {
  const { id: workspaceId } = await params;
  const gate = await requireWorkspaceMember(workspaceId, "canViewTeamFeed");
  if (!gate.ok) return gate.response;
  const visibleUserIds = await getVisibleMemberUserIds(workspaceId);

  const pins = await prisma.pinnedTeamContent.findMany({
    where: { workspaceId },
    orderBy: { pinnedAt: "desc" },
    take: 20,
  });

  const tradeIds = pins.filter((p) => p.kind === "trade").map((p) => p.refId);
  const noteIds = pins.filter((p) => p.kind === "note").map((p) => p.refId);

  const [trades, notes] = await Promise.all([
    tradeIds.length
      ? prisma.trade.findMany({
          where: { id: { in: tradeIds }, userId: { in: visibleUserIds } },
          select: {
            id: true, userId: true, symbol: true, side: true, netPnl: true,
            rMultiple: true, entryDate: true, exitDate: true, setup: true, createdAt: true,
          },
        })
      : Promise.resolve([]),
    noteIds.length
      ? prisma.note.findMany({
          where: { id: { in: noteIds }, userId: { in: visibleUserIds } },
          select: { id: true, userId: true, title: true, content: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);

  const userIds = [...new Set([
    ...trades.map((t) => t.userId),
    ...notes.map((n) => n.userId),
    ...pins.map((p) => p.pinnedByUserId),
  ])];
  const [users, userSettings] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }),
    prisma.userSettings.findMany({ where: { userId: { in: userIds } }, select: { userId: true, hideAmountsInTeam: true } }),
  ]);

  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  const settingsMap = Object.fromEntries(userSettings.map((s) => [s.userId, s]));
  const tradeMap = Object.fromEntries(trades.map((t) => [t.id, t]));
  const noteMap = Object.fromEntries(notes.map((n) => [n.id, n]));

  return NextResponse.json({
    pins: pins.flatMap((pin) => {
      const trade = pin.kind === "trade" ? tradeMap[pin.refId] : null;
      const note = pin.kind === "note" ? noteMap[pin.refId] : null;
      if ((pin.kind === "trade" && !trade) || (pin.kind === "note" && !note)) {
        return [];
      }
      const trader = trade ? userMap[trade.userId] : null;
      const pinnedBy = userMap[pin.pinnedByUserId];
      const hideAmounts = trade ? settingsMap[trade.userId]?.hideAmountsInTeam ?? false : false;

      return [{
        id: pin.id,
        kind: pin.kind,
        refId: pin.refId,
        pinnedAt: pin.pinnedAt,
        pinnedByUserId: pin.pinnedByUserId,
        pinnedByName: pinnedBy?.name ?? pinnedBy?.email?.split("@")[0] ?? "Mentor",
        item: trade
          ? {
              kind: "trade" as const,
              id: trade.id, userId: trade.userId,
              userName: trader?.name ?? trader?.email?.split("@")[0] ?? "Trader",
              symbol: trade.symbol, side: trade.side,
              netPnl: hideAmounts ? null : trade.netPnl,
              rMultiple: trade.rMultiple, entryDate: trade.entryDate,
              exitDate: trade.exitDate, setup: trade.setup, notes: null,
              createdAt: trade.createdAt,
            }
          : null,
        noteContent: note ? { title: note.title, body: note.content, createdAt: note.createdAt } : null,
      }];
    }),
  });
}

// POST /api/workspaces/:id/pins { kind, refId }
// Mentor/owner pins content into the workspace feed.
export async function POST(req: NextRequest, { params }: Params) {
  const { id: workspaceId } = await params;
  const gate = await requireWorkspaceRole(workspaceId, ["owner", "mentor"], "canPinTeamContent");
  if (!gate.ok) return gate.response;

  const body = await req.json();
  const kind = body.kind as PinKind;
  let refId = String(body.refId ?? "");

  if (!PIN_KINDS.has(kind)) {
    return NextResponse.json({ error: "Invalid pin target" }, { status: 400 });
  }

  // Special case: mentor creates a new text note on the fly
  if (kind === "note" && !refId && body.text) {
    const title = String(body.title ?? "Mentor note").slice(0, 120);
    const content = String(body.text).slice(0, 2000);
    const newNote = await prisma.note.create({
      data: { userId: gate.session.user.id, title, content, category: "general" },
    });
    refId = newNote.id;
  }

  if (!refId) {
    return NextResponse.json({ error: "Invalid pin target" }, { status: 400 });
  }

  const belongs = await contentBelongsToWorkspace(workspaceId, kind, refId);
  if (!belongs) {
    return NextResponse.json({ error: "Target not found" }, { status: 404 });
  }

  const existing = await prisma.pinnedTeamContent.findFirst({
    where: { workspaceId, kind, refId },
  });
  if (existing) return NextResponse.json(existing);

  const pin = await prisma.pinnedTeamContent.create({
    data: { workspaceId, kind, refId, pinnedByUserId: gate.session.user.id },
  });

  return NextResponse.json(pin, { status: 201 });
}

async function contentBelongsToWorkspace(workspaceId: string, kind: PinKind, refId: string) {
  if (kind === "article") return true;

  const memberUserIds = await getVisibleMemberUserIds(workspaceId);

  if (kind === "trade") {
    return Boolean(
      await prisma.trade.findFirst({
        where: { id: refId, userId: { in: memberUserIds } },
        select: { id: true },
      })
    );
  }
  if (kind === "note") {
    return Boolean(
      await prisma.note.findFirst({
        where: { id: refId, userId: { in: memberUserIds } },
        select: { id: true },
      })
    );
  }
  return Boolean(
    await prisma.playbook.findFirst({
      where: { id: refId, userId: { in: memberUserIds } },
      select: { id: true },
    })
  );
}

async function getVisibleMemberUserIds(workspaceId: string) {
  return (
    await prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        OR: [
          { privacyPeriodUntil: null },
          { privacyPeriodUntil: { lt: new Date() } },
        ],
      },
      select: { userId: true },
    })
  ).map((m) => m.userId);
}
