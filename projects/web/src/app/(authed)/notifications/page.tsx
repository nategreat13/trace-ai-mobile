import Link from "next/link";
import { listTemplates } from "@/lib/push-admin";
import { getAdminEnv } from "@/lib/env";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

// Seeding removed from the UI on 2026-05-12 after an accidental click
// duplicated in-code defaults into Firestore. getTemplate() in
// notification-templates.ts already falls back to TEMPLATE_DEFAULTS when
// the Firestore doc doesn't exist, so the seeding flow was never required
// for triggers to fire — it just meant "have a doc you can edit". The
// edit page upserts the doc on first save, which covers the same need
// without an explicit seed action.
//
// The /admin/seed-templates server endpoint and seedTemplates() client
// helper are still defined, so a future admin who wants to bulk-create
// docs (e.g., for bulk copy review) can call them directly. They're
// just no longer surfaced in the UI.

export default async function NotificationsPage() {
  const env = await getAdminEnv();
  const templates = await listTemplates(env);

  return (
    <div className="max-w-5xl mx-auto">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-1">
            Triggered notifications fire automatically based on user state
            (signups, trial expirations, inactivity, billing issues). Each is
            individually toggleable, with copy you can edit live without a
            deploy.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/notifications/broadcast"
            className="px-3 py-2 text-sm bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-lg"
          >
            Compose broadcast
          </Link>
          <Link
            href="/notifications/history"
            className="px-3 py-2 text-sm border border-gray-300 hover:border-gray-400 rounded-lg text-gray-700"
          >
            History
          </Link>
        </div>
      </header>

      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Triggered notification templates
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {templates.filter((t) => t.enabled).length} of {templates.length}{" "}
            enabled
          </p>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3 text-left font-medium">Trigger</th>
              <th className="px-4 py-3 text-left font-medium">Title preview</th>
              <th className="px-4 py-3 text-left font-medium">Kind</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Updated</th>
              <th className="px-4 py-3 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => {
              const isDynamic = t.variables.length > 0;
              return (
                <tr key={t.key} className="border-t border-gray-100 align-top hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <Link
                      href={`/admin/notifications/templates/${encodeURIComponent(t.key)}`}
                      className="block"
                    >
                      <div className="font-mono text-xs font-semibold text-rose-600 hover:text-rose-700">
                        {t.key}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 max-w-md">
                        {t.description}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-sm">
                    {t.title || (
                      <span className="text-gray-300 italic">— no title yet —</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isDynamic ? (
                      <span
                        className="inline-block px-2 py-0.5 text-[11px] font-medium border rounded bg-amber-50 text-amber-800 border-amber-200"
                        title={`Uses runtime variables: ${t.variables.map((v) => `{{${v}}}`).join(", ")}. Title/body are locked in the admin to avoid breaking substitution.`}
                      >
                        dynamic
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 text-[11px] font-medium border rounded bg-gray-50 text-gray-700 border-gray-200">
                        static
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {t.enabled ? (
                      <span className="text-xs font-semibold text-green-700">
                        enabled
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-gray-400">
                        disabled
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 text-xs">
                    {formatDate(t.updatedAt, true)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/notifications/templates/${encodeURIComponent(t.key)}`}
                      className="text-xs text-rose-600 hover:text-rose-700 font-medium"
                    >
                      Edit →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <p className="text-xs text-gray-400 mt-4">
        Adding a new trigger (e.g. "deal alert match") requires a code change —
        the trigger logic runs on the server. Once added, its template will
        appear here automatically for editing. If you need a new trigger, ping
        Nate.
      </p>
    </div>
  );
}
