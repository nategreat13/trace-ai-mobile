import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getUserDetail,
  getUserEvents,
  getUserCollectionCounts,
} from "@/lib/users-queries";
import { getExcludedSets, addExclusionByUserId, removeExclusion } from "@/lib/exclusions";
import { logAuditEvent } from "@/lib/audit";
import { formatDate, formatMonthDayTime, relativeFromNow } from "@/lib/format";

export const dynamic = "force-dynamic";

function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function tierClass(status: string): string {
  switch (status) {
    case "premium":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "business":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "trial":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "deleted":
      return "bg-red-50 text-red-700 border-red-200";
    case "free":
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

async function excludeUser(formData: FormData) {
  "use server";
  const uid = formData.get("uid") as string;
  const note = (formData.get("note") as string) || "From user detail page";
  if (!uid) return;
  await addExclusionByUserId(uid, note);
  await logAuditEvent("exclusion.add_user_id", uid, { source: "user_detail", note });
  revalidatePath(`/admin/users/${uid}`);
  revalidatePath("/admin/analytics");
  revalidatePath("/admin/exclusions");
}

async function unexcludeUser(formData: FormData) {
  "use server";
  const docIds = formData.getAll("docId") as string[];
  const uid = formData.get("uid") as string;
  for (const id of docIds) {
    if (id) {
      await removeExclusion(id);
      await logAuditEvent("exclusion.remove", id, { source: "user_detail", uid });
    }
  }
  revalidatePath(`/admin/users/${uid}`);
  revalidatePath("/admin/analytics");
  revalidatePath("/admin/exclusions");
}

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;
  const userId = decodeURIComponent(uid);

  const [user, events, counts, excluded] = await Promise.all([
    getUserDetail(userId),
    getUserEvents(userId, 100),
    getUserCollectionCounts(userId),
    getExcludedSets().catch(() => ({
      userIds: new Set<string>(),
      emails: new Set<string>(),
    })),
  ]);

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto">
        <p className="text-gray-500">No user found.</p>
        <Link href="/admin/users" className="text-rose-500 hover:text-rose-600">
          ← Back to users
        </Link>
      </div>
    );
  }

  const isExcluded =
    excluded.userIds.has(user.userId) ||
    (user.email && excluded.emails.has(user.email.toLowerCase()));

  // Find the doc IDs corresponding to this user in the exclusion list
  // (need them for the unexclude form).
  const { listExclusions } = await import("@/lib/exclusions");
  const exclusionDocs = isExcluded
    ? (await listExclusions()).filter(
        (e) =>
          e.userIds.includes(user.userId) ||
          (user.email && e.email?.toLowerCase() === user.email.toLowerCase())
      )
    : [];

  let personality: { title?: string; emoji?: string; description?: string } = {};
  try {
    if (user.travelPersonality) personality = JSON.parse(user.travelPersonality);
  } catch {
    /* ignore */
  }

  return (
    <div className="max-w-5xl mx-auto">
      <Link
        href="/admin/users"
        className="text-sm text-rose-500 hover:text-rose-600"
      >
        ← Back to users
      </Link>

      {/* Header */}
      <div className="mt-2 mb-6 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-gray-900 break-all">
            {user.email || (
              <span className="text-gray-400 italic">no email</span>
            )}
          </h1>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span
              className={
                "inline-block px-2.5 py-1 rounded border text-xs font-semibold capitalize " +
                tierClass(user.subscriptionStatus)
              }
            >
              {user.subscriptionStatus}
            </span>
            {user.subscriptionSource === "promo" && (
              <span className="inline-block px-2.5 py-1 rounded border border-amber-200 bg-amber-50 text-amber-700 text-xs font-semibold uppercase tracking-wider">
                🎁 promo
              </span>
            )}
            {user.subscriptionSource === "store" && (user.subscriptionStatus === "premium" || user.subscriptionStatus === "business") && (
              <span className="text-xs text-gray-500">paid subscriber</span>
            )}
            {!user.exists && (
              <span className="text-xs text-red-600 font-medium">
                (userProfile no longer exists)
              </span>
            )}
            {isExcluded && (
              <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-amber-100 text-amber-700 rounded">
                excluded from analytics
              </span>
            )}
          </div>
          {user.displayName && (
            <p className="text-sm text-gray-600 mt-2">{user.displayName}</p>
          )}
          <p className="font-mono text-xs text-gray-400 mt-2 break-all">
            {user.userId}
          </p>
        </div>
        <div className="shrink-0 flex flex-col gap-2">
          {isExcluded ? (
            <form action={unexcludeUser}>
              <input type="hidden" name="uid" value={user.userId} />
              {exclusionDocs.map((d) => (
                <input key={d.id} type="hidden" name="docId" value={d.id} />
              ))}
              <button
                type="submit"
                className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
              >
                Re-include in analytics
              </button>
            </form>
          ) : (
            <form action={excludeUser}>
              <input type="hidden" name="uid" value={user.userId} />
              <button
                type="submit"
                className="px-3 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg"
              >
                Exclude from analytics
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Lifetime revenue" value={dollars(user.lifetimeRevenueCents)} />
        <Stat
          label="Created"
          value={formatDate(user.createdAt)}
          sub={relativeFromNow(user.createdAt)}
        />
        <Stat
          label="Last seen"
          value={user.lastSeenAt ? formatDate(user.lastSeenAt) : "never"}
          sub={user.lastSeenAt ? relativeFromNow(user.lastSeenAt) : undefined}
        />
        <Stat
          label="Events (recent)"
          value={events.length.toString()}
          sub={`up to ${events.length === 100 ? "100 (capped)" : events.length}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Subscription */}
        <Card title="Subscription">
          <Row label="Status" value={user.subscriptionStatus} />
          <Row
            label="Source"
            value={
              user.subscriptionSource === "promo"
                ? "🎁 Promo grant"
                : user.subscriptionSource === "store"
                  ? "App Store / Play Store"
                  : "—"
            }
          />
          <Row label="First purchase" value={formatDate(user.firstPurchaseAt, true)} />
          <Row label="Last purchase" value={formatDate(user.lastPurchaseAt, true)} />
          <Row label="Lifetime revenue" value={dollars(user.lifetimeRevenueCents)} />
          <Row
            label="Used free trial"
            value={user.everUsedFreeTrial ? "yes" : "no"}
          />
          <Row label="Trial ends" value={formatDate(user.trialEndDate, true)} />
        </Card>

        {/* Cohort metadata */}
        <Card title="Cohort">
          <Row label="First seen" value={formatDate(user.firstSeenAt, true)} />
          <Row label="First platform" value={user.firstPlatform ?? "—"} />
          <Row label="First app version" value={user.firstAppVersion ?? "—"} />
          <Row label="Country" value={user.country ?? "—"} />
          <Row label="Home airport" value={user.homeAirport ?? "—"} />
          <Row
            label="Destination preference"
            value={user.destinationPreference ?? "—"}
          />
        </Card>

        {/* Activity */}
        <Card title="Activity">
          <Row label="Swipe count" value={user.swipeCount.toLocaleString()} />
          <Row label="Streak (days)" value={user.streakDays.toString()} />
          <Row label="Hunter level" value={user.dealHunterLevel.toString()} />
          <Row label="Saved deals" value={counts.savedDeals.toString()} />
          <Row label="Active alerts" value={counts.alerts.toString()} />
          <Row label="Badges" value={user.badges.length.toString()} />
        </Card>

        {/* Travel personality */}
        <Card title="Personality + preferences">
          <Row
            label="Personality"
            value={
              personality.title
                ? `${personality.emoji ?? ""} ${personality.title}`
                : "—"
            }
            sub={personality.description ?? undefined}
          />
          <Row
            label="Deal types"
            value={user.dealTypes.length ? user.dealTypes.join(", ") : "—"}
          />
          <Row
            label="Travel timeframes"
            value={
              user.travelTimeframe.length ? user.travelTimeframe.join(", ") : "—"
            }
          />
        </Card>
      </div>

      {/* Recent events */}
      <Card title={`Recent events (last ${events.length})`}>
        {events.length === 0 ? (
          <p className="text-sm text-gray-500">No events for this user.</p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead className="text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-2 text-left font-medium">Time</th>
                  <th className="px-5 py-2 text-left font-medium">Event</th>
                  <th className="px-5 py-2 text-left font-medium">Source</th>
                  <th className="px-5 py-2 text-left font-medium">Props</th>
                </tr>
              </thead>
              <tbody>
                {events.map((evt) => (
                  <tr key={evt.id} className="border-t border-gray-100 align-top">
                    <td className="px-5 py-2 text-gray-500 text-xs whitespace-nowrap">
                      {formatMonthDayTime(evt.timestamp)}
                    </td>
                    <td className="px-5 py-2 font-medium text-gray-900 whitespace-nowrap">
                      {evt.name}
                    </td>
                    <td className="px-5 py-2 text-xs text-gray-500 whitespace-nowrap">
                      {evt.source ?? "client"}
                    </td>
                    <td className="px-5 py-2 text-xs text-gray-600 font-mono break-all max-w-md">
                      {Object.keys(evt.props).length === 0
                        ? "—"
                        : JSON.stringify(evt.props)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
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
      <div className="text-xl font-bold text-gray-900 mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex justify-between items-baseline py-1.5 text-sm border-b border-gray-50 last:border-b-0">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 text-right">
        {value}
        {sub && <div className="text-xs text-gray-400">{sub}</div>}
      </span>
    </div>
  );
}
