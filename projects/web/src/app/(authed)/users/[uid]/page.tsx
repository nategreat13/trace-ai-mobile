import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getUserDetail,
  getUserEvents,
  getUserCollectionCounts,
} from "@/lib/users-queries";
import {
  getExcludedSets,
  addExclusionByUserId,
  removeExclusion,
  listExclusions,
} from "@/lib/exclusions";
import { logAuditEvent } from "@/lib/audit";
import {
  sendTestPush,
  sendTemplate,
  removeUserPushToken,
  KNOWN_TEMPLATE_KEYS,
} from "@/lib/push-admin";
import { getAdminEnv } from "@/lib/env";
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
  const env = await getAdminEnv();
  const uid = formData.get("uid") as string;
  const note = (formData.get("note") as string) || "From user detail page";
  if (!uid) return;
  await addExclusionByUserId(env, uid, note);
  await logAuditEvent(env, "exclusion.add_user_id", uid, { source: "user_detail", note });
  revalidatePath(`/admin/users/${uid}`);
  revalidatePath("/analytics");
  revalidatePath("/exclusions");
}

async function sendTestPushAction(formData: FormData) {
  "use server";
  const env = await getAdminEnv();
  const userId = formData.get("uid") as string;
  const title = (formData.get("title") as string | null)?.trim() ?? "";
  const body = (formData.get("body") as string | null)?.trim() ?? "";
  const deepLinkRaw = (formData.get("deepLink") as string | null)?.trim() ?? "";
  const deepLink = deepLinkRaw === "" ? null : deepLinkRaw;
  if (!userId || !title || !body) {
    redirect(`/admin/users/${encodeURIComponent(userId)}?push_error=missing_fields`);
  }
  try {
    const data = deepLink ? { deepLink } : undefined;
    const result = await sendTestPush({
      userId,
      title,
      body,
      data,
      force: true,
    });
    await logAuditEvent(env, "notification.test_push", userId, {
      title,
      bodyLength: body.length,
      deepLink,
      attempted: result.attempted,
      ok: result.ok,
    });
    revalidatePath(`/admin/users/${userId}`);
    redirect(
      `/admin/users/${encodeURIComponent(userId)}?push_sent=${result.ok}&push_attempted=${result.attempted}`
    );
  } catch (err: any) {
    // redirect() above throws a NEXT_REDIRECT marker that Next catches
    // at the framework boundary. Don't swallow it here — re-throw so
    // Next can do the actual HTTP redirect.
    if (err?.digest?.startsWith?.("NEXT_REDIRECT")) throw err;
    redirect(
      `/admin/users/${encodeURIComponent(userId)}?push_error=${encodeURIComponent(err?.message ?? "send_failed")}`
    );
  }
}

async function unexcludeUser(formData: FormData) {
  "use server";
  const env = await getAdminEnv();
  const docIds = formData.getAll("docId") as string[];
  const uid = formData.get("uid") as string;
  for (const id of docIds) {
    if (id) {
      await removeExclusion(env, id);
      await logAuditEvent(env, "exclusion.remove", id, { source: "user_detail", uid });
    }
  }
  revalidatePath(`/admin/users/${uid}`);
  revalidatePath("/analytics");
  revalidatePath("/exclusions");
}

async function sendTemplateAction(formData: FormData) {
  "use server";
  const env = await getAdminEnv();
  const userId = formData.get("uid") as string;
  const templateKey = formData.get("templateKey") as string;
  if (!userId || !templateKey) {
    redirect(
      `/admin/users/${encodeURIComponent(userId)}?template_error=missing_fields`
    );
  }
  try {
    const result = await sendTemplate({ userId, templateKey });
    await logAuditEvent(env, "notification.send_template", userId, {
      templateKey,
      attempted: result.attempted,
      ok: result.ok,
    });
    revalidatePath(`/admin/users/${userId}`);
    redirect(
      `/admin/users/${encodeURIComponent(userId)}?template_sent=${result.ok}&template_attempted=${result.attempted}&template_key=${encodeURIComponent(templateKey)}`
    );
  } catch (err: any) {
    if (err?.digest?.startsWith?.("NEXT_REDIRECT")) throw err;
    redirect(
      `/admin/users/${encodeURIComponent(userId)}?template_error=${encodeURIComponent(err?.message ?? "send_failed")}`
    );
  }
}

async function removePushTokenAction(formData: FormData) {
  "use server";
  const env = await getAdminEnv();
  const uid = formData.get("uid") as string;
  const token = formData.get("token") as string;
  if (!uid || !token) {
    redirect(`/admin/users/${encodeURIComponent(uid)}?token_error=missing_fields`);
  }
  try {
    const { found, remaining } = await removeUserPushToken(env, uid, token);
    await logAuditEvent(env, "push_token.remove", uid, {
      tokenPrefix: token.slice(0, 30),
      found,
      remaining,
    });
    revalidatePath(`/admin/users/${uid}`);
    redirect(
      `/admin/users/${encodeURIComponent(uid)}?token_removed=${found ? "1" : "0"}&token_remaining=${remaining}`
    );
  } catch (err: any) {
    // redirect() above throws a NEXT_REDIRECT marker that Next catches
    // at the framework boundary. Don't swallow it here — re-throw so
    // Next can do the actual HTTP redirect.
    if (err?.digest?.startsWith?.("NEXT_REDIRECT")) throw err;
    redirect(
      `/admin/users/${encodeURIComponent(uid)}?token_error=${encodeURIComponent(err?.message ?? "remove_failed")}`
    );
  }
}

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ uid: string }>;
  searchParams: Promise<{
    push_sent?: string;
    push_attempted?: string;
    push_error?: string;
    token_removed?: string;
    token_remaining?: string;
    token_error?: string;
    template_sent?: string;
    template_attempted?: string;
    template_key?: string;
    template_error?: string;
  }>;
}) {
  const { uid } = await params;
  const sp = await searchParams;
  const userId = decodeURIComponent(uid);
  const env = await getAdminEnv();

  const [user, events, counts, excluded] = await Promise.all([
    getUserDetail(env, userId),
    getUserEvents(env, userId, 100),
    getUserCollectionCounts(env, userId),
    getExcludedSets(env).catch(() => ({
      userIds: new Set<string>(),
      emails: new Set<string>(),
    })),
  ]);

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto">
        <p className="text-gray-500">No user found.</p>
        <Link href="/users" className="text-rose-500 hover:text-rose-600">
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
  const exclusionDocs = isExcluded
    ? (await listExclusions(env)).filter(
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
        href="/users"
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

      {/* Fire a saved template — uses the same code path as the daily
          cron triggers, so what lands on the device is exactly what
          this user would see when the trigger normally fires.
          The cleanest way to test all 18 templates without manufacturing
          conditions (trial about to end, etc.). */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Fire a template (test any of the {KNOWN_TEMPLATE_KEYS.length} triggers)
        </h2>
        {(((user.raw.pushTokens as Array<unknown> | undefined)?.length ?? 0) === 0) ? (
          <p className="text-sm text-gray-500">
            This user has no registered push tokens — fire-a-template
            won&apos;t reach a device. Grant notification permission in
            the app first.
          </p>
        ) : (
          <>
            {sp?.template_sent != null && (
              <div className="mb-3 px-3 py-2 bg-green-50 border border-green-200 text-green-800 text-xs rounded">
                Fired template <code className="font-mono">{sp.template_key}</code>{" "}
                — {sp.template_sent} of {sp.template_attempted} delivery
                {sp.template_sent === "1" ? "" : "s"} accepted by Expo.
              </div>
            )}
            {sp?.template_error && (
              <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-800 text-xs rounded">
                {sp.template_error.replace(/_/g, " ")}
              </div>
            )}
            <form
              action={sendTemplateAction}
              className="flex flex-wrap items-end gap-3"
            >
              <input type="hidden" name="uid" value={user.userId} />
              <div className="flex-1 min-w-[260px]">
                <label className="block text-[11px] font-medium text-gray-600 mb-1 uppercase tracking-wider">
                  Template
                </label>
                <select
                  name="templateKey"
                  required
                  defaultValue="welcome"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm bg-white"
                >
                  {KNOWN_TEMPLATE_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium rounded-lg"
              >
                Fire template
              </button>
            </form>
            <p className="text-xs text-gray-400 mt-3">
              Uses the same code path as the daily cron triggers. The
              template&rsquo;s current copy in Firestore is what gets
              sent (or the in-code default if not seeded yet). Variables
              like <code className="font-mono">{`{{name}}`}</code> render
              literally here unless populated — fine for verifying copy
              + deepLink. For variable-substituted testing, edit the
              template body to be more obvious or use a broadcast.
            </p>
          </>
        )}
      </section>

      {/* Send test push */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Send test push (free-form)
        </h2>
        {(((user.raw.pushTokens as Array<unknown> | undefined)?.length ?? 0) === 0) ? (
          <p className="text-sm text-gray-500">
            This user has no registered push tokens. They need to grant
            notification permission in the app first (typically after
            onboarding completes).
          </p>
        ) : (
          <>
            {sp?.push_sent != null && (
              <div className="mb-3 px-3 py-2 bg-green-50 border border-green-200 text-green-800 text-xs rounded">
                Sent — {sp.push_sent} delivery
                {sp.push_sent === "1" ? "" : "s"} accepted by Expo.
              </div>
            )}
            {sp?.push_error && (
              <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-800 text-xs rounded">
                {sp.push_error.replace(/_/g, " ")}
              </div>
            )}
            <form
              action={sendTestPushAction}
              className="grid grid-cols-1 md:grid-cols-2 gap-3"
            >
              <input type="hidden" name="uid" value={user.userId} />
              <div className="md:col-span-2">
                <label className="block text-[11px] font-medium text-gray-600 mb-1 uppercase tracking-wider">
                  Title
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  defaultValue="Test push from admin"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-medium text-gray-600 mb-1 uppercase tracking-wider">
                  Body
                </label>
                <textarea
                  name="body"
                  required
                  rows={2}
                  defaultValue="If you got this, push is working end-to-end."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1 uppercase tracking-wider">
                  Deep link (optional)
                </label>
                <select
                  name="deepLink"
                  defaultValue=""
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm"
                >
                  <option value="">(none)</option>
                  <option value="/swipe">Swipe deck</option>
                  <option value="/explore">Explore</option>
                  <option value="/dashboard">Dashboard (saved)</option>
                  <option value="/dashboard?tab=alerts">
                    Dashboard (alerts)
                  </option>
                  <option value="/profile">Profile</option>
                  <option value="/paywall">Paywall</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium rounded-lg"
                >
                  Send to this user
                </button>
              </div>
            </form>
            <p className="text-[11px] text-gray-400 mt-3">
              Bypasses the user's notifications-enabled toggle so testing
              works on any account. Logged in audit + send history.
            </p>
          </>
        )}
      </section>

      {/* Push tokens */}
      {(() => {
        // Tokens are stored on userProfile.pushTokens. Older records
        // have only { token, platform, addedAt }; newer records add
        // osVersion + deviceName (both JS-derived, no native dep).
        // Firestore Timestamps come back from the Admin SDK as
        // objects with .toDate().
        type PushTokenRecord = {
          token?: string;
          platform?: "ios" | "android" | string;
          osVersion?: string;
          deviceName?: string | null;
          addedAt?: { toDate?: () => Date } | null;
        };
        const tokens =
          (user.raw.pushTokens as PushTokenRecord[] | undefined) ?? [];
        if (tokens.length === 0) return null;

        const platformLabel = (p?: string) => {
          if (p === "ios") return "iOS";
          if (p === "android") return "Android";
          return p ?? "Unknown";
        };
        const platformBadgeClass = (p?: string) =>
          p === "ios"
            ? "bg-gray-100 text-gray-800 border-gray-200"
            : p === "android"
              ? "bg-green-50 text-green-800 border-green-200"
              : "bg-gray-50 text-gray-500 border-gray-200";

        return (
          <section className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Push tokens ({tokens.length})
            </h2>
            {sp?.token_removed === "1" && (
              <div className="mb-3 px-3 py-2 bg-green-50 border border-green-200 text-green-800 text-xs rounded">
                Token removed. {sp.token_remaining ?? "?"} token
                {sp.token_remaining === "1" ? "" : "s"} remaining.
              </div>
            )}
            {sp?.token_removed === "0" && (
              <div className="mb-3 px-3 py-2 bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs rounded">
                Token wasn&apos;t on the user&apos;s profile (already gone?). No
                change made.
              </div>
            )}
            {sp?.token_error && (
              <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-800 text-xs rounded">
                {sp.token_error.replace(/_/g, " ")}
              </div>
            )}
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead className="text-gray-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-2 text-left font-medium">Platform</th>
                    <th className="px-5 py-2 text-left font-medium">OS version</th>
                    <th className="px-5 py-2 text-left font-medium">Device name</th>
                    <th className="px-5 py-2 text-left font-medium">Token</th>
                    <th className="px-5 py-2 text-left font-medium">Registered</th>
                    <th className="px-5 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((t, i) => (
                    <tr
                      key={(t.token ?? "") + i}
                      className="border-t border-gray-100 align-top"
                    >
                      <td className="px-5 py-2 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-medium border rounded ${platformBadgeClass(t.platform)}`}
                        >
                          {platformLabel(t.platform)}
                        </span>
                      </td>
                      <td className="px-5 py-2 text-xs text-gray-600 whitespace-nowrap font-mono">
                        {t.osVersion || "—"}
                      </td>
                      <td className="px-5 py-2 text-xs text-gray-600 whitespace-nowrap">
                        {t.deviceName || "—"}
                      </td>
                      <td className="px-5 py-2 font-mono text-xs text-gray-700 break-all max-w-md">
                        {t.token ?? "—"}
                      </td>
                      <td className="px-5 py-2 text-xs text-gray-500 whitespace-nowrap">
                        {formatMonthDayTime(t.addedAt?.toDate?.() ?? null)}
                      </td>
                      <td className="px-5 py-2 text-right whitespace-nowrap">
                        {t.token && (
                          <form action={removePushTokenAction} className="inline">
                            <input type="hidden" name="uid" value={user.userId} />
                            <input type="hidden" name="token" value={t.token} />
                            <button
                              type="submit"
                              className="text-xs text-red-600 hover:text-red-800 hover:underline"
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
            </div>
            <p className="text-xs text-gray-400 mt-3">
              OS version + device name are captured from
              <code className="text-[11px] mx-1">Platform.Version</code>
              and <code className="text-[11px] mx-1">Constants.deviceName</code> at register time.
              Records added before this change show <code className="text-[11px] mx-1">—</code>
              until the user re-registers (next launch + token re-write).
            </p>
          </section>
        );
      })()}

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
