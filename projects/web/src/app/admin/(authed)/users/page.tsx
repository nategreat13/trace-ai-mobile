import Link from "next/link";
import { listUsers } from "@/lib/users-queries";
import { getExcludedSets } from "@/lib/exclusions";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function relativeFromNow(d: Date | null): string {
  if (!d) return "—";
  const ms = Date.now() - d.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days < 0) return "future";
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function dollars(cents: number): string {
  if (!cents) return "—";
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function tierClass(status: string): string {
  switch (status) {
    case "premium":
      return "bg-rose-50 text-rose-700";
    case "business":
      return "bg-amber-50 text-amber-700";
    case "trial":
      return "bg-blue-50 text-blue-700";
    case "free":
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const search = params?.q?.trim() ?? "";

  const [excluded, { rows, total }] = await Promise.all([
    getExcludedSets().catch(() => ({
      userIds: new Set<string>(),
      emails: new Set<string>(),
    })),
    listUsers({ search, limit: 200 }),
  ]);

  // Annotate excluded flag (listUsers received excluded but we recompute
  // here in case it was missing in the call above — defensive).
  for (const row of rows) {
    if (
      excluded.userIds.has(row.userId) ||
      (row.email && excluded.emails.has(row.email.toLowerCase()))
    ) {
      row.excluded = true;
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total.toLocaleString()} {total === 1 ? "user" : "users"} match
            {search ? ` "${search}"` : ""}
            {rows.length < total && ` — showing first ${rows.length}`}.
          </p>
        </div>
        <form action="/admin/users" method="GET" className="flex items-center gap-2">
          <input
            type="text"
            name="q"
            defaultValue={search}
            placeholder="Search email, name, UID…"
            className="w-64 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm"
          />
          <button
            type="submit"
            className="px-3 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium rounded-lg"
          >
            Search
          </button>
          {search && (
            <Link
              href="/admin/users"
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg"
            >
              Clear
            </Link>
          )}
        </form>
      </header>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-6 py-16 text-center text-gray-500 text-sm">
            No users match.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-6 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">Tier</th>
                <th className="px-4 py-3 text-left font-medium">Home</th>
                <th className="px-4 py-3 text-right font-medium">LTV</th>
                <th className="px-4 py-3 text-right font-medium">Created</th>
                <th className="px-4 py-3 text-right font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id || row.userId}
                  className="border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-6 py-3">
                    <Link
                      href={`/admin/users/${encodeURIComponent(row.userId)}`}
                      className="block"
                    >
                      <div className="font-medium text-gray-900 break-all">
                        {row.email || (
                          <span className="text-gray-400 italic">no email</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {row.displayName ?? "—"}{" "}
                        {row.excluded && (
                          <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-700 rounded">
                            excluded
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[10px] text-gray-400 mt-0.5 break-all">
                        {row.userId}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        "inline-block px-2 py-0.5 rounded text-xs font-semibold capitalize " +
                        tierClass(row.subscriptionStatus)
                      }
                    >
                      {row.subscriptionStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-mono text-xs">
                    {row.homeAirport ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                    {dollars(row.lifetimeRevenueCents)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 text-xs">
                    <div className="font-medium text-gray-700">
                      {formatDate(row.createdAt)}
                    </div>
                    <div>{relativeFromNow(row.createdAt)}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 text-xs">
                    {row.lastSeenAt ? (
                      <>
                        <div className="font-medium text-gray-700">
                          {formatDate(row.lastSeenAt)}
                        </div>
                        <div>{relativeFromNow(row.lastSeenAt)}</div>
                      </>
                    ) : (
                      <span className="text-gray-300">never</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
