import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hasEmailProvider, sendPasswordResetEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

const GENERIC_OK = {
  ok: true,
  message: "If this account can reset a password, an email has been sent.",
};

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { key: "auth:request-password-reset", limit: 3, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { email, locale } = await req.json();
    const normalizedEmail = typeof email === "string" ? email.toLowerCase().trim() : "";

    if (!normalizedEmail) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    if (!hasEmailProvider()) {
      return NextResponse.json({ error: "Email provider is not configured" }, { status: 503 });
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || user.provider !== "credentials" || !user.password) {
      return NextResponse.json(GENERIC_OK);
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.$transaction([
      prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      prisma.passwordResetToken.create({
        data: { userId: user.id, token, expiresAt },
      }),
    ]);

    await sendPasswordResetEmail(normalizedEmail, token, locale === "ru" ? "ru" : "en");

    return NextResponse.json(GENERIC_OK);
  } catch (err) {
    console.error("Password reset request error:", err);
    return NextResponse.json({ error: "Could not send password reset email" }, { status: 502 });
  }
}
