import Link from "next/link";
import { listRecentSends } from "@/lib/push-admin";
import { getAdminEnv } from "@/lib/env";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function NotificationHistoryPage() {
  const env = await getAdminEnv();
  const entries = await listRecentSends(env, 200);

  return (
    <div className="max-w-6xl mx-auto">
      <Link
        href="/notifications"
        className="text-sm text-rose-500 hover:text-rose-600"
      >
        ← Back to notifications
      </Link>

      <header className="mt-2 mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Send history</h1>
        <p className="text-sm text-gray-500 mt-1">
          The last {entries.length} push notifications sent — both per-user
          (test sends, billing-issue alerts) and broadcasts. "Accepted" is
          how many Expo took for delivery; the actual deliver-to-device rate
          is usually slightly lower depending on iOS/Android backpressure.
        </p>
      </header>

      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {entries.length === 0 ? (
          <div className="px-6 py-16 text-center text-gray-500 text-sm">
            No notifications sent yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Time</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Title</th>
                <th className="px-4 py-3 text-right font-medium">Accepted</th>
                <th className="px-4 py-3 text-left font-medium">Audience</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-gray-100 align-top">
                  <td className="px-6 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {formatDate(e.sentAt, true)}
                  </td>
                  <td className="px-4 py-3">
                    {e.templateKey ? (
                      <span className="font-mono text-xs text-rose-600">
                        {e.templateKey}
                      </span>
                    ) : e.audience === "broadcast" ? (
                      <span className="text-xs font-semibold text-amber-600">
                        broadcast
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-gray-500">
                        user
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-md">
                    <div className="font-medium text-gray-900 truncate">
                      {e.title}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {e.body}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-xs">
                    <div className="font-semibold text-gray-900 tabular-nums">
                      {e.ok} / {e.attempted}
                    </div>
                    {e.errors.length > 0 && (
                      <div
                        className="text-red-500 mt-0.5"
                        title={e.errors.join("\n")}
                      >
                        {e.errors.length} error
                        {e.errors.length === 1 ? "" : "s"}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {e.audience === "user" ? (
                      e.userId ? (
                        <Link
                          href={`/admin/users/${encodeURIComponent(e.userId)}`}
                          className="text-rose-500 hover:text-rose-600 font-mono text-[10px]"
                        >
                          {e.userId}
                        </Link>
                      ) : (
                        "—"
                      )
                    ) : (
                      <div>
                        <div>
                          tiers:{" "}
                          {e.audienceFilter?.tiers?.join(", ") ?? "(all)"}
                        </div>
                        {e.audienceFilter?.platform && (
                          <div>platform: {e.audienceFilter.platform}</div>
                        )}
                        {typeof e.matchedUsers === "number" && (
                          <div className="text-gray-400">
                            {e.matchedUsers} user
                            {e.matchedUsers === 1 ? "" : "s"} matched
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
