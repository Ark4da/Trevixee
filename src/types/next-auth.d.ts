import "next-auth";
import "next-auth/jwt";
import type { EntitlementSnapshot } from "@/lib/entitlements";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      plan?: string;
      entitlements?: EntitlementSnapshot;
    };
  }
  interface User {
    id: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    name?: string;
    plan?: string;
    entitlements?: EntitlementSnapshot;
    entitlementsSyncedAt?: number;
  }
}
