import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember, requireWorkspaceRole } from "@/lib/guards";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string; tradeId: string }> };

// POST /api/workspaces/:id/trades/:tradeId/comments
// Mentor/owner only — comment on a member's trade
export async function POST(req: NextRequest, { params }: Params) {
  const { id: workspaceId, tradeId } = await params;
  const gate = await requireWorkspaceRole(workspaceId, ["owner", "mentor"], "canCommentOnMemberTrade");
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;

  // Verify the trade belongs to a workspace member
  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade) return NextResponse.json({ error: "Trade not found" }, { status: 404 });

  const tradeMember = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: trade.userId } },
  });
  if (!tradeMember) {
    return NextResponse.json({ error: "Trade does not belong to a workspace member" }, { status: 403 });
  }

  const body = await req.json();
  const bodyText = (body.body ?? "").trim();
  if (!bodyText || bodyText.length > 2000) {
    return NextResponse.json({ error: "Comment body required (max 2000 chars)" }, { status: 400 });
  }

  const comment = await prisma.tradeComment.create({
    data: { tradeId, workspaceId, authorUserId: userId, body: bodyText },
  });

  return NextResponse.json({
    id: comment.id,
    tradeId: comment.tradeId,
    authorUserId: comment.authorUserId,
    authorName: gate.session.user.name ?? gate.session.user.email?.split("@")[0] ?? "Mentor",
    body: comment.body,
    createdAt: comment.createdAt,
  }, { status: 201 });
}

// GET /api/workspaces/:id/trades/:tradeId/comments
// All members can view comments on trades within their workspace
export async function GET(_req: NextRequest, { params }: Params) {
  const { id: workspaceId, tradeId } = await params;
  const gate = await requireWorkspaceMember(workspaceId, "canViewTeamFeed");
  if (!gate.ok) return gate.response;

  const comments = await prisma.tradeComment.findMany({
    where: { tradeId, workspaceId },
    orderBy: { createdAt: "asc" },
  });

  const authorIds = [...new Set(comments.map((c) => c.authorUserId))];
  const authors = await prisma.user.findMany({
    where: { id: { in: authorIds } },
    select: { id: true, name: true, email: true },
  });
  const authorMap = Object.fromEntries(authors.map((a) => [a.id, a]));

  return NextResponse.json(
    comments.map((c) => {
      const a = authorMap[c.authorUserId];
      return {
        id: c.id,
        authorUserId: c.authorUserId,
        authorName: a?.name ?? a?.email?.split("@")[0] ?? "Mentor",
        body: c.body,
        createdAt: c.createdAt,
      };
    })
  );
}
