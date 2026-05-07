import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  listPromoCodes,
  createPromoCode,
  setPromoCodeActive,
  deletePromoCode,
} from "@/lib/promo-codes";
import { logAuditEvent } from "@/lib/audit";

export const dynamic = "force-dynamic";

async function generateAction(formData: FormData) {
  "use server";

  const tier = formData.get("tier") as "premium" | "business";
  const durationDays = Number(formData.get("durationDays") ?? 0);
  const maxRedemptionsRaw = formData.get("maxRedemptions") as string | null;
  const maxRedemptions =
    !maxRedemptionsRaw || maxRedemptionsRaw === "" || maxRedemptionsRaw === "0"
      ? null
      : Number(maxRedemptionsRaw);
  const code = (formData.get("code") as string | null)?.trim() || undefined;
  const note = (formData.get("note") as string | null)?.trim() || undefined;
  const expiresAt =
    (formData.get("expiresAt") as string | null)?.trim() || undefined;

  try {
    const created = await createPromoCode({
      code,
      tier,
      durationDays,
      maxRedemptions,
      note,
      expiresAt,
    });
    await logAuditEvent("promo.create", created, {
      tier,
      durationDays,
      maxRedemptions,
      expiresAt: expiresAt ?? null,
    });
    revalidatePath("/admin/promo-codes");
    redirect(`/admin/promo-codes?created=${encodeURIComponent(created)}`);
  } catch (err: any) {
    redirect(
      `/admin/promo-codes?error=${encodeURIComponent(err?.message ?? "create_failed")}`
    );
  }
}

async function disableAction(formData: FormData) {
  "use server";
  const code = formData.get("code") as string;
  if (!code) return;
  await setPromoCodeActive(code, false);
  await logAuditEvent("promo.disable", code);
  revalidatePath("/admin/promo-codes");
}

async function enableAction(formData: FormData) {
  "use server";
  const code = formData.get("code") as string;
  if (!code) return;
  await setPromoCodeActive(code, true);
  await logAuditEvent("promo.enable", code);
  revalidatePath("/admin/promo-codes");
}

async function deleteAction(formData: FormData) {
  "use server";
  const code = formData.get("code") as string;
  if (!code) return;
  await deletePromoCode(code);
  await logAuditEvent("promo.delete", code);
  revalidatePath("/admin/promo-codes");
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function tierClass(tier: string): string {
  switch (tier) {
    case "premium":
      return "bg-rose-50 text-rose-700";
    case "business":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export default async function PromoCodesPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const params = await searchParams;
  const codes = await listPromoCodes();

  return (
    <div className="max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Promo codes</h1>
        <p className="text-sm text-gray-500 mt-1">
          Generate codes that grant Premium or Business access for free. Codes
          are redeemed in-app on the Profile screen and granted via
          RevenueCat&apos;s promotional entitlement API.
        </p>
      </header>

      {params?.created && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg flex items-center justify-between">
          <span>
            Code created:{" "}
            <code className="font-mono font-semibold">
              {params.created.toUpperCase()}
            </code>
          </span>
          <span className="text-xs text-green-700">
            Copy it now — give it to whoever needs it.
          </span>
        </div>
      )}
      {params?.error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg">
          {params.error.replace(/_/g, " ")}
        </div>
      )}

      {/* Generate form */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Generate code</h2>
        <form action={generateAction} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Tier
            </label>
            <select
              name="tier"
              defaultValue="premium"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            >
              <option value="premium">Premium</option>
              <option value="business">Business</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Duration (days)
            </label>
            <input
              type="number"
              name="durationDays"
              required
              min={1}
              defaultValue={365}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Max redemptions
            </label>
            <input
              type="number"
              name="maxRedemptions"
              min={0}
              placeholder="empty = unlimited"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Custom code (optional)
            </label>
            <input
              type="text"
              name="code"
              placeholder="auto-generated if blank"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-mono uppercase"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Code expiry (optional)
            </label>
            <input
              type="datetime-local"
              name="expiresAt"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Note (optional)
            </label>
            <input
              type="text"
              name="note"
              placeholder="e.g. Press, Beta cohort"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            />
          </div>
          <div className="md:col-span-3">
            <button
              type="submit"
              className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-lg"
            >
              Generate
            </button>
          </div>
        </form>
      </section>

      {/* List */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Existing codes ({codes.length})
          </h2>
        </div>
        {codes.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500 text-sm">
            No codes yet. Generate one above.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Code</th>
                <th className="px-4 py-3 text-left font-medium">Tier</th>
                <th className="px-4 py-3 text-right font-medium">Duration</th>
                <th className="px-4 py-3 text-right font-medium">Redeemed</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Note</th>
                <th className="px-4 py-3 text-right font-medium">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr
                  key={c.code}
                  className={
                    "border-t border-gray-100 align-top " +
                    (c.active ? "" : "bg-gray-50/50")
                  }
                >
                  <td className="px-6 py-3">
                    <Link
                      href={`/admin/promo-codes/${encodeURIComponent(c.code)}`}
                      className="font-mono text-xs font-semibold text-rose-600 hover:text-rose-700 break-all"
                    >
                      {c.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        "px-2 py-0.5 rounded text-xs font-semibold capitalize " +
                        tierClass(c.tier)
                      }
                    >
                      {c.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                    {c.durationDays} days
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className="font-semibold text-gray-900">
                      {c.redemptionCount}
                    </span>
                    <span className="text-gray-400">
                      {c.maxRedemptions == null
                        ? " / ∞"
                        : ` / ${c.maxRedemptions}`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.active ? (
                      <span className="text-xs font-semibold text-green-700">
                        active
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-gray-400">
                        disabled
                      </span>
                    )}
                    {c.expiresAt && (
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {c.expiresAt.getTime() < Date.now() ? (
                          <span className="text-red-500">expired</span>
                        ) : (
                          <>expires {formatDate(c.expiresAt)}</>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px]">
                    {c.note ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 text-xs">
                    {formatDate(c.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {c.active ? (
                      <form action={disableAction} className="inline">
                        <input type="hidden" name="code" value={c.code} />
                        <button
                          type="submit"
                          className="text-xs text-amber-600 hover:text-amber-700 mr-3"
                        >
                          Disable
                        </button>
                      </form>
                    ) : (
                      <form action={enableAction} className="inline">
                        <input type="hidden" name="code" value={c.code} />
                        <button
                          type="submit"
                          className="text-xs text-green-600 hover:text-green-700 mr-3"
                        >
                          Enable
                        </button>
                      </form>
                    )}
                    {c.redemptionCount === 0 && (
                      <form action={deleteAction} className="inline">
                        <input type="hidden" name="code" value={c.code} />
                        <button
                          type="submit"
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="text-xs text-gray-400 mt-4">
        Codes can only be deleted while their redemption count is 0 — once
        someone has used a code, it stays in the audit trail. Use Disable
        instead to stop accepting new redemptions.
      </p>
    </div>
  );
}
