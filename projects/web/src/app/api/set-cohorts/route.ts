import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ADMIN_COHORTS_COOKIE } from "@/lib/env";

/**
 * POST /api/set-cohorts
 * Body: { cohorts: string[] | null }
 *
 * Persists the analytics dashboard's selected signup-version cohorts in a
 * cookie (read by `getAdminCohorts()`), so the choice survives navigation and
 * sessions like the env switch. `null` / empty = all cohorts (clears the
 * cookie). After updating, revalidates the layout so the dashboard re-renders
 * against the new selection.
 *
 * Auth: lives inside the admin tree — middleware has already verified the
 * admin password cookie before we get here.
 */
export async function POST(req: NextRequest) {
  let body: { cohorts?: unknown } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const keys = Array.isArray(body.cohorts)
    ? body.cohorts
        .filter((k): k is string => typeof k === "string")
        .map((k) => k.trim())
        .filter(Boolean)
    : [];

  const res = NextResponse.json({ ok: true, cohorts: keys });
  if (keys.length === 0) {
    // "All" — clear the cookie so we fall back to the default.
    res.cookies.set(ADMIN_COHORTS_COOKIE, "", { path: "/", maxAge: 0 });
  } else {
    res.cookies.set(ADMIN_COHORTS_COOKIE, keys.join(","), {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 90 * 24 * 60 * 60,
    });
  }

  revalidatePath("/", "layout");
  return res;
}
