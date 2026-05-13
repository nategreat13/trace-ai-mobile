import Link from "next/link";
import AdminTabs from "./tabs";
import EnvSwitch from "./env-switch";
import { getAdminEnv } from "@/lib/env";

export const metadata = {
  title: "Trace Admin",
};

/**
 * Shared admin chrome — tabs at the top, sign out on the right, page
 * content below. Authentication is handled by middleware (see
 * `src/middleware.ts`); by the time this renders, the user is already
 * authenticated for any /admin/* path that isn't /admin/login.
 *
 * The env switch in the header lets an admin flip between viewing prod
 * and staging Firestore data. When staging is active, a banner runs
 * across the top of every page (defense-in-depth so you can't mistake
 * which env you're looking at).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const env = await getAdminEnv();
  return (
    <div className="min-h-screen bg-gray-50">
      {env === "staging" && (
        <div className="bg-amber-500 text-white text-center text-xs font-bold py-1.5 tracking-wide">
          STAGING ENVIRONMENT — data below is NOT production
        </div>
      )}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between gap-4">
          <Link
            href="/analytics"
            className="text-base font-bold text-gray-900 py-4 whitespace-nowrap"
          >
            Trace Admin
          </Link>
          <AdminTabs />
          <div className="flex items-center gap-3 shrink-0">
            <EnvSwitch env={env} />
            <form action="/logout" method="POST">
              <button
                type="submit"
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:border-gray-400"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="py-10 px-6">{children}</main>
    </div>
  );
}
