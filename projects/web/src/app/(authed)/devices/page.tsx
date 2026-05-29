import Link from "next/link";
import {
  listDevices,
  type DeviceRow,
} from "@/lib/analytics-queries";
import { getExcludedSets, getValidUserIds } from "@/lib/exclusions";
import { getAdminEnv } from "@/lib/env";
import { colRef } from "@/lib/firebase-admin";
import { formatDateShort, relativeFromNow } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Batch-look up userProfile metadata for each device's lastUserId. We can't
 * `in`-query more than 30 at a time, so chunk. For low traffic this is one
 * round trip; for high traffic it's a small handful.
 */
async function annotateProfiles(env: string, rows: DeviceRow[]): Promise<void> {
  const uidSet = new Set<string>();
  for (const r of rows) if (r.lastUserId) uidSet.add(r.lastUserId);
  if (uidSet.size === 0) return;

  const byUid = new Map<
    string,
    { email: string | null; onboardingComplete: boolean }
  >();
  const uids = Array.from(uidSet);
  for (let i = 0; i < uids.length; i += 30) {
    const chunk = uids.slice(i, i + 30);
    const snap = await colRef(env as Parameters<typeof colRef>[0], "userProfiles")
      .where("userId", "in", chunk)
      .select("userId", "email", "onboardingComplete")
      .get();
    snap.forEach((doc) => {
      const data = doc.data();
      const uid = data.userId as string | undefined;
      if (!uid) return;
      byUid.set(uid, {
        email: ((data.email as string | undefined) ?? null) || null,
        onboardingComplete: Boolean(data.onboardingComplete),
      });
    });
  }

  for (const r of rows) {
    if (!r.lastUserId) continue;
    const hit = byUid.get(r.lastUserId);
    r.hasProfile = !!hit;
    r.email = hit?.email ?? null;
    r.onboardingComplete = hit?.onboardingComplete ?? false;
  }
}

function FunnelBadge({ row }: { row: DeviceRow }) {
  // Highest funnel step reached, derived from the row's flags.
  let label: string;
  let cls: string;
  if (row.hasProfile && row.onboardingComplete) {
    label = "Full user";
    cls = "bg-green-50 text-green-700";
  } else if (row.hasProfile) {
    label = "Profile, no onboarding";
    cls = "bg-amber-50 text-amber-700";
  } else if (row.signedUp) {
    label = "Signed up, no profile";
    cls = "bg-rose-50 text-rose-700";
  } else if (row.lastUserId) {
    label = "Authed, no signup event";
    cls = "bg-blue-50 text-blue-700";
  } else {
    label = "Guest only";
    cls = "bg-gray-100 text-gray-600";
  }
  return (
    <span
      className={
        "inline-block px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap " +
        cls
      }
    >
      {label}
    </span>
  );
}

export default async function DevicesPage() {
  const env = await getAdminEnv();
  const [excluded, validUserIds] = await Promise.all([
    getExcludedSets(env).catch(() => ({
      userIds: new Set<string>(),
      emails: new Set<string>(),
    })),
    getValidUserIds(env).catch(() => new Set<string>()),
  ]);

  const rows = await listDevices(env, excluded, validUserIds);
  await annotateProfiles(env, rows);

  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Installs</h1>
        <p className="text-sm text-gray-500 mt-1">
          {rows.length.toLocaleString()} unique{" "}
          {rows.length === 1 ? "device" : "devices"} have opened the app.
          Excluded internal accounts + devices ever associated with one are
          filtered out — counts match the dashboard&apos;s &quot;Unique
          installs&quot; card. Sorted by most recent activity.
        </p>
      </header>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-6 py-16 text-center text-gray-500 text-sm">
            No non-excluded installs yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Device</th>
                <th className="px-4 py-3 text-left font-medium">Platform</th>
                <th className="px-4 py-3 text-left font-medium">Country</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Events</th>
                <th className="px-4 py-3 text-right font-medium">First seen</th>
                <th className="px-4 py-3 text-right font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.deviceId}
                  className="border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-6 py-3">
                    <Link
                      href={`/devices/${encodeURIComponent(row.deviceId)}`}
                      className="block"
                    >
                      <div className="font-medium text-gray-900">
                        {row.email || (
                          <span className="text-gray-400 italic">
                            No profile yet
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[10px] text-gray-400 mt-0.5 break-all">
                        {row.deviceId}
                      </div>
                      {row.lastUserId && (
                        <div className="font-mono text-[10px] text-gray-400 mt-0.5 break-all">
                          UID: {row.lastUserId}
                        </div>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-700 capitalize">
                      {row.platform ?? "—"}
                    </div>
                    <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                      {row.appVersion ? `v${row.appVersion}` : "—"}
                      {row.osVersion ? ` · OS ${row.osVersion}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <div>{row.country ?? "—"}</div>
                    {row.locale && (
                      <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                        {row.locale}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <FunnelBadge row={row} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                    {row.eventCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 text-xs">
                    <div className="font-medium text-gray-700">
                      {formatDateShort(row.firstSeenAt)}
                    </div>
                    <div>{relativeFromNow(row.firstSeenAt)}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 text-xs">
                    <div className="font-medium text-gray-700">
                      {formatDateShort(row.lastSeenAt)}
                    </div>
                    <div>{relativeFromNow(row.lastSeenAt)}</div>
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
