import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireCapability } from "@/lib/guards";
import { prisma } from "@/lib/db";
// Smoke test:
// GET /api/workspaces → array of workspaces user is a member of
// POST /api/workspaces { name } → creates workspace (requires canCreateWorkspace)

export async function GET() {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: { workspace: true },
    orderBy: { joinedAt: "asc" },
  });

  return NextResponse.json(
    memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
      joinedAt: m.joinedAt,
    }))
  );
}

export async function POST(req: NextRequest) {
  const gate = await requireCapability("canCreateWorkspace");
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;

  const body = await req.json();
  const name = (body.name ?? "").trim();
  if (!name || name.length > 60) {
    return NextResponse.json({ error: "Name required (max 60 chars)" }, { status: 400 });
  }

  // Generate unique slug
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const suffix = crypto.randomUUID().slice(0, 6);
  const slug = `${base}-${suffix}`;

  const workspace = await prisma.workspace.create({
    data: {
      name,
      slug,
      ownerUserId: userId,
      members: {
        create: { userId, role: "owner" },
      },
    },
  });

  return NextResponse.json({ id: workspace.id, name: workspace.name, slug: workspace.slug, role: "owner" }, { status: 201 });
}
