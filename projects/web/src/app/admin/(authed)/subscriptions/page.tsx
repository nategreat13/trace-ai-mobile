import Link from "next/link";
import { getDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

interface SubRow {
  userId: string;
  email: string;
  displayName: string | null;
  subscriptionStatus: string;
  trialEndDate: Date | null;
  createdAt: Date | null;
  firstPurchaseAt: Date | null;
  lastPurchaseAt: Date | null;
  lifetimeRevenueCents: number;
  homeAirport: string | null;
  country: string | null;
}

async function getActiveSubscribers(): Promise<SubRow[]> {
  const db = getDb();
  // Pull all userProfiles whose subscription is anything other than free.
  // At small scale the in-memory filter is fine; at >10k subscribers,
  // index on subscriptionStatus and query directly.
  const snap = await db
    .collection("userProfiles")
    .where("subscriptionStatus", "in", ["premium", "business", "trial"])
    .select(
      "userId",
      "email",
      "displayName",
      "subscriptionStatus",
      "trialEndDate",
      "createdAt",
      "firstPurchaseAt",
      "lastPurchaseAt",
      "lifetimeRevenueCents",
      "homeAirport",
      "country"
    )
    .get();

  const rows: SubRow[] = [];
  snap.forEach((doc) => {
    const d = doc.data();
    rows.push({
      userId: (d.userId as string | undefined) ?? "",
      email: (d.email as string | undefined) ?? "",
      displayName: (d.displayName as string | undefined) ?? null,
      subscriptionStatus: (d.subscriptionStatus as string | undefined) ?? "free",
      trialEndDate: (d.trialEndDate as any)?.toDate?.() ?? null,
      createdAt: (d.createdAt as any)?.toDate?.() ?? null,
      firstPurchaseAt: (d.firstPurchaseAt as any)?.toDate?.() ?? null,
      lastPurchaseAt: (d.lastPurchaseAt as any)?.toDate?.() ?? null,
      lifetimeRevenueCents: (d.lifetimeRevenueCents as number | undefined) ?? 0,
      homeAirport: (d.homeAirport as string | undefined) ?? null,
      country: (d.country as string | undefined) ?? null,
    });
  });

  // Most recent first by purchase, falling back to createdAt
  rows.sort((a, b) => {
    const ta = (a.lastPurchaseAt ?? a.firstPurchaseAt ?? a.createdAt)?.getTime() ?? 0;
    const tb = (b.lastPurchaseAt ?? b.firstPurchaseAt ?? b.createdAt)?.getTime() ?? 0;
    return tb - ta;
  });

  return rows;
}

function dollars(cents: number): string {
  if (!cents) return "—";
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function tierClass(status: string): string {
  switch (status) {
    case "premium":
      return "bg-rose-50 text-rose-700";
    case "business":
      return "bg-amber-50 text-amber-700";
    case "trial":
      return "bg-blue-50 text-blue-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export default async function SubscriptionsPage() {
  const rows = await getActiveSubscribers();

  // Buckets
  const byTier: Record<string, number> = {};
  let totalLtv = 0;
  for (const r of rows) {
    byTier[r.subscriptionStatus] = (byTier[r.subscriptionStatus] ?? 0) + 1;
    totalLtv += r.lifetimeRevenueCents;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Subscriptions</h1>
        <p className="text-sm text-gray-500 mt-1">
          Every user with an active subscription, sorted by most recent
          activity. Sourced from <code className="font-mono text-xs">userProfiles.subscriptionStatus</code>,
          which the RevenueCat webhook keeps in sync.
        </p>
      </header>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Active total" value={rows.length.toString()} />
        <Stat label="Premium" value={(byTier.premium ?? 0).toString()} />
        <Stat label="Business" value={(byTier.business ?? 0).toString()} />
        <Stat
          label="On trial"
          value={(byTier.trial ?? 0).toString()}
          sub="active free-trial period"
        />
      </div>

      {/* Aggregate revenue */}
      <div className="mb-6 px-5 py-3 bg-white border border-gray-200 rounded-xl flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-gray-500">
            Aggregate lifetime revenue (active subs)
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-0.5">
            {dollars(totalLtv)}
          </div>
        </div>
        <p className="text-xs text-gray-400 max-w-xs text-right">
          From userProfiles.lifetimeRevenueCents (mirrored by the webhook).
          MRR / ARR live on the Dashboard tab and pull from RevenueCat.
        </p>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-6 py-16 text-center text-gray-500 text-sm">
            No active subscribers yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">Tier</th>
                <th className="px-4 py-3 text-left font-medium">Home</th>
                <th className="px-4 py-3 text-right font-medium">LTV</th>
                <th className="px-4 py-3 text-right font-medium">First purchase</th>
                <th className="px-4 py-3 text-right font-medium">Last purchase</th>
                <th className="px-4 py-3 text-right font-medium">Trial ends</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.userId}
                  className="border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-6 py-3">
                    <Link
                      href={`/admin/users/${encodeURIComponent(r.userId)}`}
                      className="block"
                    >
                      <div className="font-medium text-gray-900 break-all">
                        {r.email || (
                          <span className="text-gray-400 italic">no email</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {r.displayName ?? "—"}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        "inline-block px-2 py-0.5 rounded text-xs font-semibold capitalize " +
                        tierClass(r.subscriptionStatus)
                      }
                    >
                      {r.subscriptionStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-mono text-xs">
                    {r.homeAirport ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                    {dollars(r.lifetimeRevenueCents)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 text-xs">
                    {formatDate(r.firstPurchaseAt)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 text-xs">
                    {formatDate(r.lastPurchaseAt)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 text-xs">
                    {r.trialEndDate ? (
                      <span
                        className={
                          r.trialEndDate.getTime() < Date.now()
                            ? "text-red-500"
                            : ""
                        }
                      >
                        {formatDate(r.trialEndDate)}
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
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
        {label}
      </div>
      <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}
