import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_COOKIE = "trace_analytics_auth";

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Backward-compat: /analytics → /admin/...
  // The old admin lived at /analytics; preserve any bookmarks.
  if (pathname === "/analytics") {
    return NextResponse.redirect(new URL("/admin/analytics" + search, req.url), 308);
  }
  if (pathname.startsWith("/analytics/")) {
    const tail = pathname.slice("/analytics/".length); // e.g. "spend" or "exclusions"
    // /analytics/login → /admin/login (not /admin/analytics/login)
    // /analytics/spend → /admin/spend
    // /analytics/exclusions → /admin/exclusions
    return NextResponse.redirect(
      new URL(`/admin/${tail}${search}`, req.url),
      308
    );
  }

  if (!pathname.startsWith("/admin")) return NextResponse.next();

  // Login + logout endpoints bypass the cookie check
  if (pathname === "/admin/login" || pathname === "/admin/logout") {
    return NextResponse.next();
  }

  const password = process.env.ANALYTICS_PASSWORD;
  if (!password) {
    // No password configured — fail closed.
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  const cookie = req.cookies.get(ADMIN_COOKIE)?.value;
  if (cookie === password) return NextResponse.next();

  const loginUrl = new URL("/admin/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/analytics", "/analytics/:path*"],
};
