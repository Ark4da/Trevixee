import { NextResponse } from "next/server";
import { getEntitlements } from "@/lib/entitlements";
import { requireAuth } from "@/lib/guards";

export async function GET() {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;

  const entitlements = await getEntitlements(gate.session.user.id);

  return NextResponse.json(entitlements, {
    headers: {
      "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
    },
  });
}
