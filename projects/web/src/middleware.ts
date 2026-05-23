import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_COOKIE = "trace_analytics_auth";

/**
 * Admin portal access gate.
 *
 * Every path is admin-authed EXCEPT:
 *   - /login, /logout — the auth endpoints themselves
 *   - Public legal pages — /privacy, /terms, /support, /delete-account.
 *     Required by App Store / Play Store listings + the mobile app's
 *     PaywallScreen links here. Must stay reachable without login.
 *   - /api/* — handled per-route; some are auth-gated server-side
 *     (e.g. /api/set-env is inside the authed flow but middleware
 *     would create a redirect loop on POST, so we let it through —
 *     the route still requires the same cookie inline).
 *
 * Anything else (/, /analytics, /users, etc.) redirects to /login
 * when the auth cookie is missing.
 *
 * Backward-compat redirects (old `/admin/...` and `/analytics/<tab>`
 * shapes) are preserved at the top so bookmarks/emails keep working
 * through the move.
 */

const PUBLIC_EXACT = new Set(["/login", "/logout"]);
const PUBLIC_PREFIXES = ["/privacy", "/terms", "/support", "/delete-account", "/share"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Backward-compat: /admin/X → /X (old bookmarks).
  if (pathname === "/admin") {
    return NextResponse.redirect(new URL("/analytics" + search, req.url), 308);
  }
  if (pathname.startsWith("/admin/")) {
    return NextResponse.redirect(
      new URL(pathname.slice("/admin".length) + search, req.url),
      308
    );
  }

  // Backward-compat: /analytics/<tab> (the even older URL shape) for
  // tabs that aren't the dashboard itself.
  if (pathname.startsWith("/analytics/")) {
    const tail = pathname.slice("/analytics/".length);
    if (
      ["spend", "exclusions", "users", "audit", "subscriptions",
       "promo-codes", "notifications", "login"].some(
        (t) => tail === t || tail.startsWith(t + "/")
      )
    ) {
      return NextResponse.redirect(
        new URL(`/${tail}${search}`, req.url),
        308
      );
    }
  }

  if (isPublic(pathname)) return NextResponse.next();

  // /api routes: per-route auth. Most read the same admin cookie inline.
  if (pathname.startsWith("/api/")) return NextResponse.next();

  // Everything else needs the admin cookie.
  const password = process.env.ANALYTICS_PASSWORD;
  if (!password) {
    if (pathname !== "/login") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  }

  const cookie = req.cookies.get(ADMIN_COOKIE)?.value;
  if (cookie === password) {
    // Authed user landing on root → send to dashboard.
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/analytics", req.url));
    }
    return NextResponse.next();
  }

  // Not authed.
  const loginUrl = new URL("/login", req.url);
  if (pathname !== "/") {
    loginUrl.searchParams.set("next", pathname);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)).*)"],
};
