import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { hasEmailProvider, sendVerificationEmail } from "@/lib/email";
import { captureEvent } from "@/lib/posthog-server";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { key: "auth:register", limit: 5, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { email, password, name, locale } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const hash = await bcrypt.hash(password, 10);

    // If no email provider is configured, auto-verify so users can log in immediately.
    const autoVerify = !hasEmailProvider();

    let user;
    try {
      const trialEndsAt = new Date(Date.now() + 14 * 86_400_000);
      const trialId = `local_trial_${randomBytes(12).toString("hex")}`;
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: name?.trim() || "Trader",
          password: hash,
          provider: "credentials",
          plan: "pro",
          ...(autoVerify ? { emailVerifiedAt: new Date() } : {}),
        },
      });
      await prisma.subscription.create({
        data: {
          userId: user.id,
          stripeSubscriptionId: trialId,
          planCode: "pro_trial",
          status: "trialing",
          currentPeriodEnd: trialEndsAt,
          trialEndsAt,
        },
      });
    } catch (err: unknown) {
      // P2002 = unique constraint violation (email already in use)
      if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
        return NextResponse.json({ error: "Email already in use" }, { status: 409 });
      }
      throw err;
    }

    // Track signup in PostHog
    captureEvent(user.id, "signup", { provider: "credentials" }).catch(() => {});

    let emailSent = false;

    // Send verification email only if email provider is configured.
    if (!autoVerify) {
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await prisma.emailVerificationToken.create({
        data: { userId: user.id, token, expiresAt },
      });

      const userLocale = locale === "ru" ? "ru" : "en";
      try {
        await sendVerificationEmail(normalizedEmail, token, userLocale);
        emailSent = true;
      } catch (err) {
        console.error("Verification email send failed:", err);
      }
    }

    return NextResponse.json(
      { id: user.id, email: user.email, name: user.name, emailVerified: autoVerify, emailSent },
      { status: 201 }
    );
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
