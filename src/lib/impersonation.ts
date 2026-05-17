/**
 * Impersonation helper (P2-48)
 * Reads the impersonation cookie set by middleware and returns the impersonated
 * userId if IMPERSONATION_SECRET is configured in env.
 *
 * Usage in route handlers:
 *   import { getImpersonatedUserId } from "@/lib/impersonation";
 *   const overrideId = await getImpersonatedUserId();
 *   const userId = overrideId ?? session.user.id;
 */
import { cookies } from "next/headers";

export async function getImpersonatedUserId(): Promise<string | null> {
  if (!process.env.IMPERSONATION_SECRET) return null;

  try {
    const cookieStore = await cookies();
    const val = cookieStore.get("impersonate_user")?.value;
    return val || null;
  } catch {
    return null;
  }
}
