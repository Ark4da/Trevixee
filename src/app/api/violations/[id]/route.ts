import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// DELETE /api/violations/:id
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const violation = await prisma.ruleViolation.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!violation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.ruleViolation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
