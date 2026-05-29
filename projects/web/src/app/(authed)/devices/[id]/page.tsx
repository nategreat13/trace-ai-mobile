import Link from "next/link";
import { notFound } from "next/navigation";
import { getDeviceEvents, type DeviceEvent } from "@/lib/analytics-queries";
import { getAdminEnv } from "@/lib/env";
import { colRef } from "@/lib/firebase-admin";
import { formatDate, formatMonthDayTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Pretty-print event props one level deep. Skips the boilerplate fields
 * (platform / app_version / device_id / session_id / locale / country)
 * that are already shown in the header — surfaces just the per-event
 * payload (e.g. previous_screen, screen_name, method for signup, etc.).
 */
const BOILERPLATE_PROPS = new Set([
  "platform",
  "app_version",
  "os_version",
  "device_id",
  "session_id",
  "country",
  "locale",
  "experiments",
]);

function NotableProps({ props }: { props: Record<string, unknown> }) {
  const entries = Object.entries(props).filter(([k]) => !BOILERPLATE_PROPS.has(k));
  if (entries.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-600 font-mono">
      {entries.map(([k, v]) => (
        <span key={k}>
          <span className="text-gray-400">{k}=</span>
          <span>
            {typeof v === "string" || typeof v === "number" || typeof v === "boolean"
              ? String(v)
              : JSON.stringify(v)}
          </span>
        </span>
      ))}
    </div>
  );
}

function EventRow({ ev }: { ev: DeviceEvent }) {
  // Color-code by event family — makes the timeline scannable at a glance.
  let dotClass: string;
  if (ev.name === "signup_completed" || ev.name === "onboarding_completed") {
    dotClass = "bg-green-500";
  } else if (ev.name.startsWith("paywall") || ev.name.includes("purchase")) {
    dotClass = "bg-rose-500";
  } else if (ev.name === "screen_view") {
    dotClass = "bg-gray-300";
  } else {
    dotClass = "bg-blue-500";
  }

  return (
    <li className="flex gap-4 py-2 border-b border-gray-100 last:border-0">
      <div className="flex flex-col items-center pt-1.5">
        <span className={`w-2 h-2 rounded-full ${dotClass}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-mono text-sm font-medium text-gray-900">
            {ev.name}
          </div>
          <div className="text-[11px] text-gray-500 whitespace-nowrap tabular-nums">
            {formatMonthDayTime(ev.timestamp)}
          </div>
        </div>
        <div className="text-[11px] text-gray-500 mt-0.5">
          UID:{" "}
          <span className="font-mono">
            {ev.userId === "guest" ? (
              <span className="text-gray-400 italic">guest</span>
            ) : (
              ev.userId ?? "(none)"
            )}
          </span>
        </div>
        <NotableProps props={ev.props} />
      </div>
    </li>
  );
}

export default async function DeviceDetailPage({ params }: PageProps) {
  const { id: deviceIdRaw } = await params;
  const deviceId = decodeURIComponent(deviceIdRaw);
  const env = await getAdminEnv();
  const events = await getDeviceEvents(env, deviceId);
  if (events.length === 0) {
    notFound();
  }

  // Derive device meta from the latest event (most recent platform/version
  // signal). UIDs are derived from across the whole timeline.
  const last = events[events.length - 1];
  const platform = (last.props.platform as string | undefined) ?? "—";
  const appVersion = (last.props.app_version as string | undefined) ?? "—";
  const osVersion = (last.props.os_version as string | undefined) ?? "—";
  const country = (last.props.country as string | undefined) ?? "—";
  const locale = (last.props.locale as string | undefined) ?? "—";

  const distinctUids = new Set<string>();
  for (const e of events) {
    if (e.userId) distinctUids.add(e.userId);
  }
  const distinctSessions = new Set<string>();
  for (const e of events) {
    const sid = e.props.session_id as string | undefined;
    if (sid) distinctSessions.add(sid);
  }
  const lastNonGuestUid = [...events]
    .reverse()
    .find((e) => e.userId && e.userId !== "guest")?.userId;

  // Profile lookup for the latest UID.
  let profile: { email: string | null; onboardingComplete: boolean; createdAt: Date | null } | null = null;
  if (lastNonGuestUid) {
    const snap = await colRef(env, "userProfiles")
      .where("userId", "==", lastNonGuestUid)
      .limit(1)
      .get();
    if (!snap.empty) {
      const data = snap.docs[0].data();
      profile = {
        email: ((data.email as string | undefined) ?? null) || null,
        onboardingComplete: Boolean(data.onboardingComplete),
        createdAt:
          (data.createdAt as FirebaseFirestore.Timestamp | undefined)?.toDate?.() ?? null,
      };
    }
  }

  const firstSeen = events[0].timestamp;
  const lastSeen = last.timestamp;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-4">
        <Link
          href="/devices"
          className="text-sm text-rose-500 hover:text-rose-600"
        >
          ← Back to installs
        </Link>
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 break-all font-mono">
          {deviceId}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          One install. {events.length} event{events.length === 1 ? "" : "s"} ·{" "}
          {distinctSessions.size} session
          {distinctSessions.size === 1 ? "" : "s"} ·{" "}
          {distinctUids.size} distinct UID{distinctUids.size === 1 ? "" : "s"}{" "}
          (incl. guest).
        </p>
      </header>

      {/* Meta grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <MetaCell label="Platform" value={platform} mono />
        <MetaCell label="App version" value={`v${appVersion}`} mono />
        <MetaCell label="OS" value={osVersion} mono />
        <MetaCell label="Country" value={country} />
        <MetaCell label="Locale" value={locale} mono />
        <MetaCell label="First seen" value={formatDate(firstSeen, true)} />
        <MetaCell label="Last seen" value={formatDate(lastSeen, true)} />
        <MetaCell
          label="Latest UID"
          value={lastNonGuestUid ?? "guest only"}
          mono
        />
      </section>

      {/* Profile status */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-2">
          Profile status
        </h2>
        {profile ? (
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">
                  Email
                </div>
                <div className="text-gray-900">{profile.email ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">
                  Onboarding complete
                </div>
                <div
                  className={
                    profile.onboardingComplete
                      ? "text-green-700 font-medium"
                      : "text-rose-700 font-medium"
                  }
                >
                  {profile.onboardingComplete ? "Yes" : "No — abandoned"}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">
                  Profile created
                </div>
                <div className="text-gray-900">
                  {formatDate(profile.createdAt, true)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">
                  View user
                </div>
                <Link
                  href={`/users/${encodeURIComponent(lastNonGuestUid!)}`}
                  className="text-rose-500 hover:text-rose-600"
                >
                  Open user detail →
                </Link>
              </div>
            </div>
          </div>
        ) : lastNonGuestUid ? (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm">
            <div className="font-medium text-rose-900">
              No userProfile doc exists for this device&apos;s UID.
            </div>
            <div className="text-rose-700 mt-1">
              This means the user completed Firebase Auth (the{" "}
              <code className="font-mono text-[12px]">signup_completed</code>{" "}
              event fired) but bailed before finishing the onboarding flow —
              no <code className="font-mono text-[12px]">createUserProfile</code>{" "}
              call was made. Most likely abandonment point: the new required
              first/last name step.
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
            This device has only fired guest events — it never authenticated
            with Firebase Auth.
          </div>
        )}
      </section>

      {/* Event timeline */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Event timeline</h2>
        <p className="text-xs text-gray-500 mb-3">
          Chronological. Boilerplate props (platform/version/locale/device_id)
          are hidden — they&apos;re in the header above. Color: green = success
          milestone, rose = paywall/purchase, blue = action, gray = screen
          view.
        </p>
        <ol className="bg-white rounded-xl border border-gray-200 px-4">
          {events.map((ev) => (
            <EventRow key={ev.id} ev={ev} />
          ))}
        </ol>
      </section>
    </div>
  );
}

function MetaCell({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
        {label}
      </div>
      <div
        className={
          "text-sm text-gray-900 mt-1 break-all " + (mono ? "font-mono" : "")
        }
      >
        {value}
      </div>
    </div>
  );
}
