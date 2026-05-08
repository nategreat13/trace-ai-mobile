import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import {
  KNOWN_TEMPLATE_KEYS,
  getTemplate,
  upsertTemplate,
} from "@/lib/push-admin";
import { logAuditEvent } from "@/lib/audit";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

async function saveAction(formData: FormData) {
  "use server";
  const key = formData.get("key") as string;
  const title = (formData.get("title") as string | null)?.trim() ?? "";
  const body = (formData.get("body") as string | null)?.trim() ?? "";
  const deepLinkRaw = (formData.get("deepLink") as string | null)?.trim() ?? "";
  const deepLink = deepLinkRaw === "" ? null : deepLinkRaw;
  const enabled = formData.get("enabled") === "on";

  if (!KNOWN_TEMPLATE_KEYS.includes(key as (typeof KNOWN_TEMPLATE_KEYS)[number])) {
    redirect(`/admin/notifications?error=unknown_template`);
  }
  if (!title || !body) {
    redirect(
      `/admin/notifications/templates/${encodeURIComponent(key)}?error=title_and_body_required`
    );
  }

  await upsertTemplate(key, { title, body, deepLink, enabled });
  await logAuditEvent("notification.template_save", key, {
    enabled,
    deepLink,
    titleLength: title.length,
    bodyLength: body.length,
  });
  revalidatePath("/admin/notifications");
  revalidatePath(`/admin/notifications/templates/${key}`);
  redirect(
    `/admin/notifications/templates/${encodeURIComponent(key)}?saved=1`
  );
}

export default async function TemplateEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { key: rawKey } = await params;
  const key = decodeURIComponent(rawKey);
  const sp = await searchParams;

  if (!KNOWN_TEMPLATE_KEYS.includes(key as (typeof KNOWN_TEMPLATE_KEYS)[number])) {
    notFound();
  }

  const template = await getTemplate(key);

  // If the doc isn't seeded yet, render an empty form so Trevor can
  // create it by saving — same flow as editing an existing one.
  const initial = template ?? {
    key,
    title: "",
    body: "",
    deepLink: null,
    enabled: false,
    description: "",
    variables: [],
    updatedAt: null,
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/admin/notifications"
        className="text-sm text-rose-500 hover:text-rose-600"
      >
        ← Back to notifications
      </Link>

      <header className="mt-2 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 font-mono break-all">
          {key}
        </h1>
        {initial.description && (
          <p className="text-sm text-gray-500 mt-2">{initial.description}</p>
        )}
        {initial.updatedAt && (
          <p className="text-xs text-gray-400 mt-1">
            Last edited {formatDate(initial.updatedAt, true)}
          </p>
        )}
      </header>

      {sp?.saved && (
        <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg">
          Saved.
        </div>
      )}
      {sp?.error && (
        <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg">
          {sp.error.replace(/_/g, " ")}
        </div>
      )}

      <form
        action={saveAction}
        className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"
      >
        <input type="hidden" name="key" value={key} />

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Title
          </label>
          <input
            type="text"
            name="title"
            defaultValue={initial.title}
            required
            placeholder="Your trial ends tomorrow"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Body
          </label>
          <textarea
            name="body"
            defaultValue={initial.body}
            required
            rows={3}
            placeholder="Subscribe to keep unlimited swipes."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
          />
          {initial.variables.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Available variables:{" "}
              {initial.variables.map((v) => (
                <code key={v} className="font-mono mx-0.5 px-1 bg-gray-100 rounded">
                  {`{{${v}}}`}
                </code>
              ))}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Deep link (where to open when tapped)
          </label>
          <select
            name="deepLink"
            defaultValue={initial.deepLink ?? ""}
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

        <div>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={initial.enabled}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-900 font-medium">
              Enabled — fire this trigger
            </span>
          </label>
          <p className="text-xs text-gray-500 mt-1 ml-6">
            When unchecked, the underlying trigger still runs on schedule but
            no notification is sent.
          </p>
        </div>

        <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
          <Link
            href="/admin/notifications"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-lg"
          >
            Save
          </button>
        </div>
      </form>

      <p className="text-xs text-gray-400 mt-4">
        Tip: To preview how this looks on a real device, edit & save here,
        then go to a user's detail page and use the "Send test push"
        button — it'll render this template against that user.
      </p>
    </div>
  );
}
