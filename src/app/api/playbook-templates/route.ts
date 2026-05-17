import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PLAYBOOK_TEMPLATES } from "@/lib/playbook-templates";
import { getEntitlements } from "@/lib/entitlements";

// GET /api/playbook-templates — list all templates
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entitlements = await getEntitlements(session.user.id);
  const isPro = entitlements.plan === "pro" || entitlements.plan === "team";

  return NextResponse.json(
    PLAYBOOK_TEMPLATES.map((t) => ({ ...t, locked: t.proOnly && !isPro }))
  );
}

// POST /api/playbook-templates — clone a template into user's playbooks
// Body: { templateId }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { templateId } = await req.json();
  const template = PLAYBOOK_TEMPLATES.find((t) => t.id === templateId);
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const entitlements = await getEntitlements(session.user.id);
  const isPro = entitlements.plan === "pro" || entitlements.plan === "team";

  // Free users can clone up to 2 templates total
  if (template.proOnly && !isPro) {
    return NextResponse.json({ error: "requires_pro" }, { status: 403 });
  }

  if (!isPro) {
    const existing = await prisma.playbook.count({ where: { userId: session.user.id } });
    if (existing >= 5) {
      return NextResponse.json(
        { error: "Free plan allows up to 5 playbooks. Upgrade for unlimited." },
        { status: 403 }
      );
    }
  }

  // Clone the template
  const playbook = await prisma.playbook.create({
    data: {
      userId: session.user.id,
      name: template.name,
      description: template.description,
      market: template.market,
      timeframe: template.timeframe,
      tags: template.tags,
      isActive: true,
      rules: {
        create: template.rules.map((r, i) => ({
          type: r.type,
          text: r.text,
          sortOrder: i,
        })),
      },
    },
    include: { rules: true },
  });

  return NextResponse.json(playbook, { status: 201 });
}
