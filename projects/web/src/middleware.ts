import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ANALYTICS_COOKIE = "trace_analytics_auth";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/analytics")) return NextResponse.next();
  if (pathname === "/analytics/login") return NextResponse.next();

  const password = process.env.ANALYTICS_PASSWORD;
  if (!password) {
    // No password configured — fail closed.
    return NextResponse.redirect(new URL("/analytics/login", req.url));
  }

  const cookie = req.cookies.get(ANALYTICS_COOKIE)?.value;
  if (cookie === password) return NextResponse.next();

  const loginUrl = new URL("/analytics/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: "/analytics/:path*",
};
