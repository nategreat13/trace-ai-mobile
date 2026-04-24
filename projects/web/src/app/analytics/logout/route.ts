import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const ANALYTICS_COOKIE = "trace_analytics_auth";

export async function POST(req: Request) {
  const jar = await cookies();
  jar.delete(ANALYTICS_COOKIE);
  const url = new URL("/analytics/login", req.url);
  return NextResponse.redirect(url, { status: 303 });
}
