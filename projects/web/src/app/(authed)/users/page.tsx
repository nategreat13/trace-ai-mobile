import Link from "next/link";
import { listUsers } from "@/lib/users-queries";
import { getExcludedSets } from "@/lib/exclusions";
import { getAdminEnv } from "@/lib/env";
import { formatDateShort, relativeFromNow } from "@/lib/format";

export const dynamic = "force-dynamic";

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

function platformLabel(p: string | null): string {
  switch ((p ?? "").toLowerCase()) {
    case "ios":
      return "iOS";
    case "android":
      return "Android";
    case "web":
      return "Web";
    default:
      return "—";
  }
}

function platformClass(p: string | null): string {
  switch ((p ?? "").toLowerCase()) {
    case "ios":
      return "bg-slate-100 text-slate-700";
    case "android":
      return "bg-emerald-50 text-emerald-700";
    case "web":
      return "bg-indigo-50 text-indigo-700";
    default:
      return "bg-gray-50 text-gray-400";
  }
}

const PLATFORM_FILTERS: Array<{ key: string; label: string }> = [
  { key: "", label: "All" },
  { key: "ios", label: "iOS" },
  { key: "android", label: "Android" },
  { key: "web", label: "Web" },
];

const STATUS_FILTERS: Array<{ key: string; label: string }> = [
  { key: "", label: "All" },
  { key: "free", label: "Free" },
  { key: "trial", label: "Trial" },
  { key: "premium", label: "Premium" },
  { key: "business", label: "Business" },
];

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    platform?: string;
    status?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;
  const search = params?.q?.trim() ?? "";
  const platform = params?.platform?.trim().toLowerCase() ?? "";
  const status = params?.status?.trim().toLowerCase() ?? "";
  const sort = params?.sort === "oldest" ? "oldest" : "newest";
  const env = await getAdminEnv();

  const [excluded, { rows, total }] = await Promise.all([
    getExcludedSets(env).catch(() => ({
      userIds: new Set<string>(),
      emails: new Set<string>(),
    })),
    listUsers(env, {
      search,
      platform: platform || undefined,
      status: status || undefined,
      sort,
      limit: 200,
    }),
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
        <form action="/users" method="GET" className="flex items-center gap-2">
          <input
            type="text"
            name="q"
            defaultValue={search}
            placeholder="Search email, name, UID…"
            className="w-64 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm"
          />
          {platform && (
            <input type="hidden" name="platform" value={platform} />
          )}
          {status && <input type="hidden" name="status" value={status} />}
          {sort === "oldest" && (
            <input type="hidden" name="sort" value="oldest" />
          )}
          <button
            type="submit"
            className="px-3 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium rounded-lg"
          >
            Search
          </button>
          {(search || platform || status || sort === "oldest") && (
            <Link
              href="/users"
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg"
            >
              Clear
            </Link>
          )}
        </form>
      </header>

      <div className="mb-3 flex items-center gap-2 text-xs">
        <span className="text-gray-500 mr-1">Platform:</span>
        {PLATFORM_FILTERS.map((f) => {
          const isActive = (platform || "") === f.key;
          const qs = new URLSearchParams();
          if (search) qs.set("q", search);
          if (f.key) qs.set("platform", f.key);
          if (status) qs.set("status", status);
          if (sort === "oldest") qs.set("sort", "oldest");
          const href = qs.toString() ? `/users?${qs.toString()}` : "/users";
          return (
            <Link
              key={f.key || "all"}
              href={href}
              className={
                "px-2.5 py-1 rounded-full border " +
                (isActive
                  ? "bg-rose-500 text-white border-rose-500"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50")
              }
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <div className="mb-3 flex items-center gap-2 text-xs">
        <span className="text-gray-500 mr-1">Status:</span>
        {STATUS_FILTERS.map((f) => {
          const isActive = (status || "") === f.key;
          const qs = new URLSearchParams();
          if (search) qs.set("q", search);
          if (platform) qs.set("platform", platform);
          if (f.key) qs.set("status", f.key);
          if (sort === "oldest") qs.set("sort", "oldest");
          const href = qs.toString() ? `/users?${qs.toString()}` : "/users";
          return (
            <Link
              key={f.key || "all"}
              href={href}
              className={
                "px-2.5 py-1 rounded-full border " +
                (isActive
                  ? "bg-rose-500 text-white border-rose-500"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50")
              }
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <div className="mb-4 flex items-center gap-2 text-xs">
        <span className="text-gray-500 mr-1">Sort:</span>
        {(["newest", "oldest"] as const).map((s) => {
          const isActive = sort === s;
          const qs = new URLSearchParams();
          if (search) qs.set("q", search);
          if (platform) qs.set("platform", platform);
          if (status) qs.set("status", status);
          if (s === "oldest") qs.set("sort", "oldest");
          const href = qs.toString() ? `/users?${qs.toString()}` : "/users";
          return (
            <Link
              key={s}
              href={href}
              className={
                "px-2.5 py-1 rounded-full border capitalize " +
                (isActive
                  ? "bg-rose-500 text-white border-rose-500"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50")
              }
            >
              {s}
            </Link>
          );
        })}
      </div>

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
                <th className="px-4 py-3 text-left font-medium">Platform</th>
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
                  <td className="px-4 py-3">
                    <span
                      className={
                        "inline-block px-2 py-0.5 rounded text-xs font-semibold " +
                        platformClass(row.firstPlatform)
                      }
                    >
                      {platformLabel(row.firstPlatform)}
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
                      {formatDateShort(row.createdAt)}
                    </div>
                    <div>{relativeFromNow(row.createdAt)}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 text-xs">
                    {row.lastSeenAt ? (
                      <>
                        <div className="font-medium text-gray-700">
                          {formatDateShort(row.lastSeenAt)}
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
