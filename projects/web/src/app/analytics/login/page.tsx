import { redirect } from "next/navigation";
import { cookies } from "next/headers";

const ANALYTICS_COOKIE = "trace_analytics_auth";

async function login(formData: FormData) {
  "use server";

  const password = formData.get("password");
  const next = (formData.get("next") as string) || "/analytics";

  if (typeof password !== "string") {
    redirect("/analytics/login?error=1");
  }

  if (password !== process.env.ANALYTICS_PASSWORD) {
    redirect(`/analytics/login?error=1${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  }

  const jar = await cookies();
  jar.set(ANALYTICS_COOKIE, password, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  redirect(next || "/analytics");
}

export default async function AnalyticsLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const error = params?.error === "1";
  const next = params?.next || "/analytics";

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Trace Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Password required to continue</p>
        </div>

        <form action={login} className="space-y-3">
          <input type="hidden" name="next" value={next} />
          <input
            type="password"
            name="password"
            placeholder="Password"
            autoFocus
            required
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-gray-900"
          />
          {error && (
            <p className="text-sm text-red-600">Incorrect password. Try again.</p>
          )}
          <button
            type="submit"
            className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-lg transition-colors"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
