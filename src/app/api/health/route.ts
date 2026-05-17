import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Health-check endpoint for Railway / load balancers.
// Verifies the app is running and the DB connection is alive.
// Returns 200 OK on success, 503 if DB ping fails.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Health check failed:", err);
    return NextResponse.json(
      {
        status: "error",
        error: "database_unavailable",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
