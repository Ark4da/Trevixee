import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/auth/verify-email?token=<token>
// Smoke test: valid token → redirect /auth/login?verified=1
//             expired/invalid → redirect /auth/login?error=invalid_token
//             already used   → redirect /auth/login?error=token_used
//             already verified → redirect /auth/login?verified=already

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return redirectToLogin(req, "error=invalid_token");
  }

  const record = await prisma.emailVerificationToken.findUnique({
    where: { token },
    include: { user: { select: { emailVerifiedAt: true } } },
  });

  if (!record) {
    return redirectToLogin(req, "error=invalid_token");
  }

  if (record.usedAt) {
    if (record.user.emailVerifiedAt) {
      return redirectToLogin(req, "verified=already");
    }
    return redirectToLogin(req, "error=token_used");
  }

  if (record.expiresAt < new Date()) {
    if (record.user.emailVerifiedAt) {
      return redirectToLogin(req, "verified=already");
    }
    return redirectToLogin(req, "error=token_expired");
  }

  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { token },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    }),
  ]);

  return redirectToLogin(req, "verified=1");
}

function redirectToLogin(req: NextRequest, query: string) {
  const appUrl = (process.env.NEXTAUTH_URL ?? req.nextUrl.origin).replace(/\/$/, "");
  return NextResponse.redirect(`${appUrl}/auth/login?${query}`);
}
