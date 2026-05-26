import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ADMIN_ENV_COOKIE } from "@/lib/env";
import type { TraceEnv } from "@trace/shared";

/**
 * POST /admin/api/set-env
 * Body: { env: "prod" | "staging" }
 *
 * Sets the admin env cookie that every authed admin server component
 * reads via `getAdminEnv()`. After updating the cookie, revalidates the
 * admin layout so every page re-renders against the new env.
 *
 * Auth: this lives inside the admin tree, so middleware has already
 * verified the admin password cookie before we get here.
 */
export async function POST(req: NextRequest) {
  let body: { env?: string } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const next: TraceEnv | null =
    body.env === "staging" ? "staging" : body.env === "prod" ? "prod" : null;
  if (!next) {
    return NextResponse.json(
      { error: "env must be 'prod' or 'staging'" },
      { status: 400 }
    );
  }

  const res = NextResponse.json({ ok: true, env: next });
  // 90-day cookie — long enough that an admin doesn't have to reset on
  // every session, short enough that a stale cookie eventually clears
  // itself if forgotten.
  res.cookies.set(ADMIN_ENV_COOKIE, next, {
    httpOnly: false, // readable from client components if we ever need it
    sameSite: "lax",
    path: "/",
    maxAge: 90 * 24 * 60 * 60,
  });

  // Bust the cache so the next request re-fetches data against the new env.
  revalidatePath("/", "layout");

  return res;
}
