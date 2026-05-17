import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { key: "auth:reset-password", limit: 5, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { token, password } = await req.json();
    const resetToken = typeof token === "string" ? token.trim() : "";
    const nextPassword = typeof password === "string" ? password : "";

    if (!resetToken) {
      return NextResponse.json({ error: "Reset token required" }, { status: 400 });
    }

    if (nextPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const record = await prisma.passwordResetToken.findUnique({
      where: { token: resetToken },
      include: { user: { select: { id: true, provider: true } } },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return NextResponse.json({ error: "Reset link is invalid or expired" }, { status: 400 });
    }

    if (record.user.provider !== "credentials") {
      return NextResponse.json({ error: "This account uses another sign-in method" }, { status: 400 });
    }

    const hash = await bcrypt.hash(nextPassword, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.user.id },
        data: {
          password: hash,
          provider: "credentials",
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.passwordResetToken.update({
        where: { token: resetToken },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Password reset error:", err);
    return NextResponse.json({ error: "Could not reset password" }, { status: 500 });
  }
}
