import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  listWhitelist,
  addWhitelistEmail,
  removeWhitelistEmail,
} from "@/lib/sandbox-whitelist";
import { logAuditEvent } from "@/lib/audit";
import { getAdminEnv } from "@/lib/env";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

async function addEmail(formData: FormData) {
  "use server";
  const env = await getAdminEnv();
  // The whitelist only gates staging sends — prod sends to everyone, so a
  // prod whitelist is meaningless. Refuse to add to it regardless of UI state.
  if (env === "prod") {
    redirect("/email-whitelist?error=whitelist_is_staging_only");
  }
  const email = (formData.get("email") as string | null)?.trim() ?? "";
  const note = (formData.get("note") as string | null)?.trim() ?? undefined;
  if (!email) {
    redirect("/email-whitelist?error=email_required");
  }
  try {
    await addWhitelistEmail(env, email, note);
    await logAuditEvent(env, "sandbox_whitelist.add", email, { note });
  } catch (err: any) {
    redirect(`/email-whitelist?error=${encodeURIComponent(err?.message ?? "add_failed")}`);
  }
  revalidatePath("/email-whitelist");
  redirect("/email-whitelist?added=1");
}

async function remove(formData: FormData) {
  "use server";
  const env = await getAdminEnv();
  const id = formData.get("id") as string | null;
  if (!id) return;
  await removeWhitelistEmail(env, id);
  await logAuditEvent(env, "sandbox_whitelist.remove", id);
  revalidatePath("/email-whitelist");
}

export default async function EmailWhitelistPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string; error?: string }>;
}) {
  const params = await searchParams;
  const env = await getAdminEnv();
  const rows = await listWhitelist(env);

  return (
    <div className="max-w-3xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Sandbox email whitelist</h1>
        <p className="text-sm text-gray-500 mt-1">
          While the server runs in <span className="font-medium">staging</span>,
          Klaviyo email is only sent to addresses on this list — everyone else
          is skipped. This lets Trevor test email flows without any chance of
          mailing a real user. In production this list is ignored (everyone can
          receive email).
        </p>
      </header>

      {/* Env context — the whitelist only matters for staging */}
      {env === "prod" ? (
        <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg">
          You&apos;re viewing the <span className="font-semibold">prod</span> copy
          of this list, which is never consulted (prod sends to everyone). Switch
          the env toggle to <span className="font-semibold">Staging</span> to
          manage the list that actually gates test sends.
        </div>
      ) : (
        <div className="mb-4 px-4 py-2 bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-lg">
          Editing the <span className="font-semibold">staging</span> whitelist —
          these addresses can receive email in staging.
        </div>
      )}

      {params?.added === "1" && (
        <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg">
          Added to whitelist.
        </div>
      )}
      {params?.error && (
        <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg">
          {params.error.replace(/_/g, " ")}
        </div>
      )}

      {/* Add email — staging only; the prod whitelist is never used */}
      {env !== "prod" && (
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Add an email</h2>
        <p className="text-xs text-gray-500 mb-4">
          The address that should be allowed to receive email in staging (e.g.
          a tester&apos;s inbox).
        </p>
        <form action={addEmail} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="email"
            name="email"
            required
            placeholder="trevor@tracetravel.co"
            className="md:col-span-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
          />
          <input
            type="text"
            name="note"
            placeholder="Note (optional, e.g. Trevor)"
            className="md:col-span-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-lg"
          >
            Add to whitelist
          </button>
        </form>
      </section>
      )}

      {/* Current list */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Whitelisted addresses ({rows.length})
          </h2>
        </div>
        {rows.length === 0 ? (
          <div className="px-6 py-10 text-center text-gray-500 text-sm">
            No addresses yet. In staging, no email will send until you add one.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Email</th>
                <th className="px-6 py-3 text-left font-medium">Note</th>
                <th className="px-6 py-3 text-left font-medium">Added</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100">
                  <td className="px-6 py-3 font-medium text-gray-900">{row.email}</td>
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
