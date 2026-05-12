import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendBroadcast } from "@/lib/push-admin";
import { logAuditEvent } from "@/lib/audit";

export const dynamic = "force-dynamic";

async function broadcastAction(formData: FormData) {
  "use server";

  const title = (formData.get("title") as string | null)?.trim() ?? "";
  const body = (formData.get("body") as string | null)?.trim() ?? "";
  const deepLinkRaw = (formData.get("deepLink") as string | null)?.trim() ?? "";
  const deepLink = deepLinkRaw === "" ? null : deepLinkRaw;

  // Audience: tier checkboxes + platform select
  const tierFree = formData.get("tier_free") === "on";
  const tierTrial = formData.get("tier_trial") === "on";
  const tierPremium = formData.get("tier_premium") === "on";
  const tierBusiness = formData.get("tier_business") === "on";
  const tiers: Array<"free" | "trial" | "premium" | "business"> = [];
  if (tierFree) tiers.push("free");
  if (tierTrial) tiers.push("trial");
  if (tierPremium) tiers.push("premium");
  if (tierBusiness) tiers.push("business");

  const platform = (formData.get("platform") as string | null) ?? "";

  if (!title || !body) {
    redirect("/admin/notifications/broadcast?error=title_and_body_required");
  }
  if (tiers.length === 0) {
    redirect("/admin/notifications/broadcast?error=select_at_least_one_tier");
  }

  const audience: { tiers: typeof tiers; platform?: "ios" | "android" } = {
    tiers,
  };
  if (platform === "ios" || platform === "android") audience.platform = platform;

  try {
    const data = deepLink ? { deepLink } : undefined;
    const result = await sendBroadcast({
      audience,
      title,
      body,
      data,
    });
    await logAuditEvent("notification.broadcast", null, {
      audience,
      title,
      bodyLength: body.length,
      deepLink,
      attempted: result.attempted,
      ok: result.ok,
      matchedUsers: result.matchedUsers,
    });
    revalidatePath("/admin/notifications/history");
    redirect(
      `/admin/notifications/broadcast?sent=${result.ok}&matched=${result.matchedUsers}`
    );
  } catch (err: any) {
    // redirect() above throws a NEXT_REDIRECT marker that Next catches
    // at the framework boundary. Don't swallow it here — re-throw so
    // Next can do the actual HTTP redirect.
    if (err?.digest?.startsWith?.("NEXT_REDIRECT")) throw err;
    redirect(
      `/admin/notifications/broadcast?error=${encodeURIComponent(err?.message ?? "send_failed")}`
    );
  }
}

export default async function BroadcastPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; matched?: string; error?: string }>;
}) {
  const sp = await searchParams;

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/admin/notifications"
        className="text-sm text-rose-500 hover:text-rose-600"
      >
        ← Back to notifications
      </Link>

      <header className="mt-2 mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Compose broadcast</h1>
        <p className="text-sm text-gray-500 mt-1">
          Send a one-off push notification to a filtered audience. Only users
          who've enabled notifications and have a registered device will get
          it.
        </p>
      </header>

      {sp?.sent != null && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg">
          Sent! {sp.sent} delivery{sp.sent === "1" ? "" : "s"} accepted by Expo
          across {sp.matched} matched user{sp.matched === "1" ? "" : "s"}.
        </div>
      )}
      {sp?.error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg">
          {sp.error.replace(/_/g, " ")}
        </div>
      )}

      <form
        action={broadcastAction}
        className="bg-white rounded-xl border border-gray-200 p-6 space-y-5"
      >
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="title"
            required
            maxLength={64}
            placeholder="New feature: business class deals ✈️"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
          />
          <p className="text-xs text-gray-400 mt-1">
            Keep under 30-40 chars to avoid truncation on most devices.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Body <span className="text-red-500">*</span>
          </label>
          <textarea
            name="body"
            required
            rows={3}
            maxLength={240}
            placeholder="Tap to see lie-flat seats from your home airport, up to 65% off."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
          />
          <p className="text-xs text-gray-400 mt-1">
            ~120 chars is a safe target. Anything past 240 will get cut off
            on most lock screens.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">
            Audience: tier
          </label>
          <div className="flex flex-wrap gap-3">
            {[
              { name: "tier_free", label: "Free" },
              { name: "tier_trial", label: "Trial" },
              { name: "tier_premium", label: "Premium" },
              { name: "tier_business", label: "Business" },
            ].map((t) => (
              <label key={t.name} className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name={t.name}
                  defaultChecked
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-900">{t.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Audience: platform
          </label>
          <select
            name="platform"
            defaultValue=""
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
          >
            <option value="">All platforms</option>
            <option value="ios">iOS only</option>
            <option value="android">Android only</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Deep link (where to open when tapped)
          </label>
          <select
            name="deepLink"
            defaultValue=""
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
          >
            <option value="">— No deep link (just opens the app) —</option>
            <option value="/swipe">Swipe deck</option>
            <option value="/explore">Explore</option>
            <option value="/dashboard">Dashboard (saved)</option>
            <option value="/dashboard?tab=alerts">Dashboard (alerts)</option>
            <option value="/profile">Profile</option>
            <option value="/paywall">Paywall</option>
          </select>
        </div>

        <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-400 max-w-xs">
            Sent immediately when you click Send. There's no scheduled-send
            yet — let Nate know if you need it.
          </p>
          <button
            type="submit"
            className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-lg"
          >
            Send broadcast
          </button>
        </div>
      </form>
    </div>
  );
}
