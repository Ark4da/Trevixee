import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import AppleProvider from "next-auth/providers/apple";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { getEntitlements, toEntitlementSnapshot } from "@/lib/entitlements";

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "credentials",
    credentials: {
      email:    { label: "Email",    type: "email"    },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;

      const user = await prisma.user.findUnique({
        where: { email: credentials.email.toLowerCase().trim() },
      });

      if (!user || !user.password) return null; // OAuth-only user — no password

      if (user.provider === "credentials" && !user.emailVerifiedAt) {
        throw new Error("email_not_verified");
      }

      const valid = await bcrypt.compare(credentials.password, user.password);
      if (!valid) return null;

      return { id: user.id, email: user.email, name: user.name ?? "Trader" };
    },
  }),
];

// Add Google provider only if credentials are configured
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

// Add Apple provider only if credentials are configured (requires HTTPS + Apple Dev account)
// APPLE_CLIENT_SECRET is a pre-generated JWT signed with your Apple private key.
// See: https://next-auth.js.org/providers/apple#generating-a-client-secret
if (process.env.APPLE_ID && process.env.APPLE_CLIENT_SECRET) {
  providers.push(
    AppleProvider({
      clientId:     process.env.APPLE_ID,
      clientSecret: process.env.APPLE_CLIENT_SECRET,
    })
  );
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/login",
    error:  "/auth/login",
  },
  providers,
  callbacks: {
    // Called on every sign-in — auto-create DB user for OAuth providers
    async signIn({ user, account }) {
      if (account?.provider !== "credentials") {
        if (!user.email) return false;
        try {
          const existing = await prisma.user.findUnique({
            where: { email: user.email },
          });
          if (!existing) {
            await prisma.user.create({
              data: {
                email:    user.email,
                name:     user.name || "Trader",
                password: null,
                provider: account?.provider ?? "oauth",
              },
            });
          }
        } catch {
          return false;
        }
      }
      return true;
    },

    // Put our DB user id (not OAuth provider id) into the JWT
    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === "credentials") {
          token.userId = user.id;
          token.name   = user.name ?? undefined;
        } else if (user.email) {
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email },
          });
          if (dbUser) {
            token.userId = dbUser.id;
            token.name   = dbUser.name ?? "Trader";
          }
        }
      }

      // Refresh entitlements from DB: on first issue and every 5 minutes after.
      const now = Date.now();
      const lastEntitlementSync = token.entitlementsSyncedAt;
      if (token.userId && (!lastEntitlementSync || now - lastEntitlementSync > 5 * 60 * 1000)) {
        try {
          const entitlements = await getEntitlements(token.userId);
          const snapshot = toEntitlementSnapshot(entitlements);
          token.plan = snapshot.plan;
          token.entitlements = snapshot;
          token.entitlementsSyncedAt = now;
        } catch (err) {
          console.error("Entitlement refresh failed:", err);
          token.plan = token.plan ?? token.entitlements?.plan ?? "free";
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id   = token.userId as string;
        session.user.name = token.name as string;
        session.user.plan = token.plan ?? "free";
        session.user.entitlements = token.entitlements;
      }
      return session;
    },
  },
};

// Export active provider names so UI can show/hide buttons
export function getActiveOAuthProviders() {
  const result: string[] = [];
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) result.push("google");
  if (process.env.APPLE_ID && process.env.APPLE_CLIENT_SECRET) result.push("apple");
  return result;
}
