import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { listTemplates, seedTemplates } from "@/lib/push-admin";
import { logAuditEvent } from "@/lib/audit";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

async function seedAction() {
  "use server";
  try {
    const result = await seedTemplates();
    await logAuditEvent("notification.seed_templates", null, result);
    revalidatePath("/admin/notifications");
    redirect(`/admin/notifications?seeded=${result.created.length}`);
  } catch (err: any) {
    redirect(
      `/admin/notifications?error=${encodeURIComponent(err?.message ?? "seed_failed")}`
    );
  }
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ seeded?: string; error?: string }>;
}) {
  const params = await searchParams;
  const templates = await listTemplates();

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
            href="/admin/notifications/broadcast"
            className="px-3 py-2 text-sm bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-lg"
          >
            Compose broadcast
          </Link>
          <Link
            href="/admin/notifications/history"
            className="px-3 py-2 text-sm border border-gray-300 hover:border-gray-400 rounded-lg text-gray-700"
          >
            History
          </Link>
        </div>
      </header>

      {params?.seeded != null && (
        <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg">
          Seeded {params.seeded} template{params.seeded === "1" ? "" : "s"}.
        </div>
      )}
      {params?.error && (
        <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg">
          {params.error.replace(/_/g, " ")}
        </div>
      )}

      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Triggered notification templates
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {templates.filter((t) => t.enabled).length} of {templates.length}{" "}
              enabled
            </p>
          </div>
          <form action={seedAction}>
            <button
              type="submit"
              className="text-xs px-3 py-1.5 border border-gray-300 hover:border-gray-400 rounded-lg text-gray-700"
              title="Create any missing template docs in Firestore. Idempotent — never overwrites edits you've made."
            >
              Seed missing templates
            </button>
          </form>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3 text-left font-medium">Trigger</th>
              <th className="px-4 py-3 text-left font-medium">Title preview</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.key} className="border-t border-gray-100 align-top">
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
              </tr>
            ))}
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
