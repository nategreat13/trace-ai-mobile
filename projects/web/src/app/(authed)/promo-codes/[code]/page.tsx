import Link from "next/link";
import {
  listPromoCodes,
  listRedemptionsForCode,
} from "@/lib/promo-codes";
import { getAdminEnv } from "@/lib/env";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

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

export default async function PromoCodeDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = await params;
  const code = decodeURIComponent(rawCode).toUpperCase();
  const env = await getAdminEnv();
  const [allCodes, redemptions] = await Promise.all([
    listPromoCodes(env),
    listRedemptionsForCode(env, code),
  ]);
  const meta = allCodes.find((c) => c.code === code);

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href="/promo-codes"
        className="text-sm text-rose-500 hover:text-rose-600"
      >
        ← Back to promo codes
      </Link>

      <header className="mt-2 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 font-mono break-all">
          {code}
        </h1>
        {meta && (
          <div className="mt-2 flex items-center gap-3 flex-wrap text-sm text-gray-600">
            <span
              className={
                "px-2 py-0.5 rounded text-xs font-semibold capitalize " +
                tierClass(meta.tier)
              }
            >
              {meta.tier}
            </span>
            <span>{meta.durationDays} day grant</span>
            <span>·</span>
            <span>
              {meta.redemptionCount}
              {meta.maxRedemptions == null
                ? " / ∞ redemptions"
                : ` / ${meta.maxRedemptions} redemptions`}
            </span>
            <span>·</span>
            {meta.active ? (
              <span className="text-green-700 font-semibold">active</span>
            ) : (
              <span className="text-gray-400 font-semibold">disabled</span>
            )}
            {meta.note && (
              <>
                <span>·</span>
                <span className="text-gray-500 italic">{meta.note}</span>
              </>
            )}
          </div>
        )}
      </header>

      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Redemption history ({redemptions.length})
          </h2>
        </div>
        {redemptions.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500 text-sm">
            Nobody has redeemed this code yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">Tier</th>
                <th className="px-4 py-3 text-right font-medium">Duration</th>
                <th className="px-4 py-3 text-right font-medium">Redeemed</th>
                <th className="px-4 py-3 text-right font-medium">Grant ends</th>
              </tr>
            </thead>
            <tbody>
              {redemptions.map((r) => (
                <tr key={r.id} className="border-t border-gray-100 align-top">
                  <td className="px-6 py-3">
                    <Link
                      href={`/admin/users/${encodeURIComponent(r.userId)}`}
                      className="block"
                    >
                      <div className="font-medium text-gray-900 break-all">
                        {r.email ?? (
                          <span className="text-gray-400 italic">
                            no email
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[10px] text-gray-400 mt-0.5 break-all">
                        {r.userId}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        "px-2 py-0.5 rounded text-xs font-semibold capitalize " +
                        tierClass(r.tier)
                      }
                    >
                      {r.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                    {r.durationDays} days
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 text-xs">
                    {formatDate(r.redeemedAt, true)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 text-xs">
                    {r.grantExpiresAt ? (
                      <span
                        className={
                          r.grantExpiresAt.getTime() < Date.now()
                            ? "text-red-500"
                            : ""
                        }
                      >
                        {formatDate(r.grantExpiresAt, true)}
                      </span>
                    ) : (
                      "—"
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
