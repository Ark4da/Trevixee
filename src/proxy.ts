import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Impersonation (P2-48): ENV-gated ?impersonate=userId support.
 * Only active when IMPERSONATION_SECRET is set.
 * Usage: /dashboard?impersonate=<userId>&impersonate_secret=<secret>
 * Stop:  /dashboard?impersonate=stop
 */
export default withAuth(
  function proxy(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const impersonateId = searchParams.get("impersonate");
    const secret = searchParams.get("impersonate_secret");
    const envSecret = process.env.IMPERSONATION_SECRET;

    if (impersonateId === "stop") {
      const res = NextResponse.next();
      res.cookies.delete("impersonate_user");
      return res;
    }

    if (impersonateId && envSecret && secret === envSecret) {
      const res = NextResponse.next();
      res.cookies.set("impersonate_user", impersonateId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 120, // 2 hours
        path: "/",
        sameSite: "lax",
      });
      return res;
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/auth/login",
    },
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/trades/:path*",
    "/journal/:path*",
    "/notebook/:path*",
    "/playbooks/:path*",
    "/analytics/:path*",
    "/progress/:path*",
    "/reports/:path*",
    "/backtesting/:path*",
    "/education/:path*",
    "/settings/:path*",
    "/learn/:path*",
  ],
};
