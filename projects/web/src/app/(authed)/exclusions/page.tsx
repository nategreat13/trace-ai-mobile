import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  listExclusions,
  addExclusionByEmail,
  addExclusionByUserId,
  removeExclusion,
  refreshAllUserIds,
} from "@/lib/exclusions";
import { logAuditEvent } from "@/lib/audit";
import { getAdminEnv } from "@/lib/env";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

async function addByEmail(formData: FormData) {
  "use server";
  const env = await getAdminEnv();
  const email = (formData.get("email") as string | null)?.trim() ?? "";
  const note = (formData.get("note") as string | null)?.trim() ?? undefined;
  if (!email) {
    redirect("/exclusions?error=email_required");
  }
  try {
    await addExclusionByEmail(env, email, note);
    await logAuditEvent(env, "exclusion.add_email", email, { note });
  } catch (err: any) {
    redirect(`/admin/exclusions?error=${encodeURIComponent(err?.message ?? "add_failed")}`);
  }
  revalidatePath("/analytics");
  revalidatePath("/exclusions");
  redirect("/exclusions?added=email");
}

async function addByUserId(formData: FormData) {
  "use server";
  const env = await getAdminEnv();
  const userId = (formData.get("userId") as string | null)?.trim() ?? "";
  const note = (formData.get("note") as string | null)?.trim() ?? undefined;
  if (!userId) {
    redirect("/exclusions?error=userid_required");
  }
  try {
    await addExclusionByUserId(env, userId, note);
    await logAuditEvent(env, "exclusion.add_user_id", userId, { note });
  } catch (err: any) {
    redirect(`/admin/exclusions?error=${encodeURIComponent(err?.message ?? "add_failed")}`);
  }
  revalidatePath("/analytics");
  revalidatePath("/exclusions");
  redirect("/exclusions?added=userid");
}

async function remove(formData: FormData) {
  "use server";
  const env = await getAdminEnv();
  const id = formData.get("id") as string | null;
  if (!id) return;
  await removeExclusion(env, id);
  await logAuditEvent(env, "exclusion.remove", id);
  revalidatePath("/analytics");
  revalidatePath("/exclusions");
}

async function refresh() {
  "use server";
  const env = await getAdminEnv();
  const { updated } = await refreshAllUserIds(env);
  await logAuditEvent(env, "exclusion.refresh", null, { updated });
  revalidatePath("/analytics");
  revalidatePath("/exclusions");
  redirect(`/admin/exclusions?refreshed=${updated}`);
}

export default async function ExclusionsPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string; error?: string; refreshed?: string }>;
}) {
  const params = await searchParams;
  const env = await getAdminEnv();
  const exclusions = await listExclusions(env);

  return (
    <div className="max-w-3xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Excluded accounts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Internal, test, and employee accounts to keep out of dashboard
            stats. Excluded accounts still produce events in the database —
            they're just filtered out of every chart, funnel, and count.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            <span className="font-medium">Plus:</span> events from accounts
            that have been deleted are also automatically filtered out of
            the dashboard (no entry needed here). Anonymous "guest" events
            from pre-signup interactions are still counted.
          </p>
        </header>

        {/* Status banner */}
        {params?.added === "email" && (
          <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg">
            Added exclusion by email.
          </div>
        )}
        {params?.added === "userid" && (
          <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg">
            Added exclusion by user ID.
          </div>
        )}
        {params?.refreshed != null && (
          <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg">
            Refreshed user IDs. {params.refreshed} entry/entries updated.
          </div>
        )}
        {params?.error && (
          <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg">
            {params.error.replace(/_/g, " ")}
          </div>
        )}

        {/* Add by email */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Add by email</h2>
          <p className="text-xs text-gray-500 mb-4">
            We'll look up matching userProfiles right now and store their
            user IDs. If the email isn't in the system yet, the exclusion
            still works — they'll be filtered out as soon as they sign up
            (and you can hit Refresh below to re-resolve).
          </p>
          <form action={addByEmail} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="email"
              name="email"
              required
              placeholder="alice@trace.co"
              className="md:col-span-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            />
            <input
              type="text"
              name="note"
              placeholder="Note (optional, e.g. founder)"
              className="md:col-span-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-lg"
            >
              Exclude
            </button>
          </form>
        </section>

        {/* Add by user ID */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Add by user ID</h2>
          <p className="text-xs text-gray-500 mb-4">
            Use when you only have the Firebase UID (e.g. from a console log).
          </p>
          <form action={addByUserId} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              name="userId"
              required
              placeholder="firebase UID"
              className="md:col-span-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-mono text-sm"
            />
            <input
              type="text"
              name="note"
              placeholder="Note (optional)"
              className="md:col-span-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-lg"
            >
              Exclude
            </button>
          </form>
        </section>

        {/* Current list */}
        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Current exclusions ({exclusions.length})
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Active immediately — refresh the dashboard to see the effect.
              </p>
            </div>
            <form action={refresh}>
              <button
                type="submit"
                className="text-sm px-3 py-1.5 border border-gray-300 hover:border-gray-400 rounded-lg text-gray-700"
                title="Re-resolve userIds for every email-based exclusion (useful if a user re-signed up)"
              >
                Refresh user IDs
              </button>
            </form>
          </div>
          {exclusions.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-500 text-sm">
              No exclusions yet. Everyone counts.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-6 py-3 text-left font-medium">Email / UID</th>
                  <th className="px-6 py-3 text-left font-medium">Note</th>
                  <th className="px-6 py-3 text-left font-medium">Added</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {exclusions.map((row) => (
                  <tr key={row.id} className="border-t border-gray-100 align-top">
                    <td className="px-6 py-3">
                      {row.email ? (
                        <div>
                          <div className="font-medium text-gray-900">{row.email}</div>
                          {row.userIds.length > 0 ? (
                            <div className="font-mono text-[11px] text-gray-400 mt-1 break-all">
                              {row.userIds.length === 1
                                ? row.userIds[0]
                                : `${row.userIds.length} userIds`}
                            </div>
                          ) : (
                            <div className="text-[11px] text-amber-600 mt-1">
                              No matching user yet — Refresh after signup
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="font-mono text-xs text-gray-700 break-all">
                          {row.userIds[0] ?? "(empty)"}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-3 text-gray-700">
                      {row.note ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-6 py-3 text-gray-500 text-xs">
                      {formatDate(row.addedAt, true)}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <form action={remove} style={{ display: "inline" }}>
                        <input type="hidden" name="id" value={row.id} />
                        <button
                          type="submit"
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </form>
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
