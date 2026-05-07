import Link from "next/link";
import AdminTabs from "./tabs";

export const metadata = {
  title: "Trace Admin",
};

/**
 * Shared admin chrome — tabs at the top, sign out on the right, page
 * content below. Authentication is handled by middleware (see
 * `src/middleware.ts`); by the time this renders, the user is already
 * authenticated for any /admin/* path that isn't /admin/login.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between gap-4">
          <Link
            href="/admin/analytics"
            className="text-base font-bold text-gray-900 py-4 whitespace-nowrap"
          >
            Trace Admin
          </Link>
          <AdminTabs />
          <form action="/admin/logout" method="POST" className="shrink-0">
            <button
              type="submit"
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:border-gray-400"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="py-10 px-6">{children}</main>
    </div>
  );
}
