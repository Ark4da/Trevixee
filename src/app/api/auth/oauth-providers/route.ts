import { NextResponse } from "next/server";

export async function GET() {
  const providers: string[] = [];
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) providers.push("google");
  if (process.env.APPLE_ID && process.env.APPLE_CLIENT_SECRET) providers.push("apple");
  return NextResponse.json({ providers });
}
