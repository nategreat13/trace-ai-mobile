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
  const titleRaw = (formData.get("title") as string | null)?.trim() ?? "";
  const bodyRaw = (formData.get("body") as string | null)?.trim() ?? "";
  const deepLinkRaw = (formData.get("deepLink") as string | null)?.trim() ?? "";
  const deepLink = deepLinkRaw === "" ? null : deepLinkRaw;
  const enabled = formData.get("enabled") === "on";

  if (!KNOWN_TEMPLATE_KEYS.includes(key as (typeof KNOWN_TEMPLATE_KEYS)[number])) {
    redirect(`/admin/notifications?error=unknown_template`);
  }

  // For dynamic templates (those with variables), title + body are
  // read-only in the UI to prevent accidental removal of {{var}}
  // placeholders. We refuse to write title/body from the request and
  // only persist deepLink + enabled. Server-side check so a crafted
  // request can't bypass the UI lock.
  const existing = await getTemplate(key);
  const isDynamic = (existing?.variables?.length ?? 0) > 0;
  if (isDynamic) {
    await upsertTemplate(key, { deepLink, enabled });
    await logAuditEvent("notification.template_save", key, {
      enabled,
      deepLink,
      dynamic: true,
    });
  } else {
    if (!titleRaw || !bodyRaw) {
      redirect(
        `/admin/notifications/templates/${encodeURIComponent(key)}?error=title_and_body_required`
      );
    }
    await upsertTemplate(key, {
      title: titleRaw,
      body: bodyRaw,
      deepLink,
      enabled,
    });
    await logAuditEvent("notification.template_save", key, {
      enabled,
      deepLink,
      titleLength: titleRaw.length,
      bodyLength: bodyRaw.length,
    });
  }

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

  // Dynamic templates use {{var}} substitution at send time. We lock
  // title/body in the UI so the placeholders can't be accidentally
  // edited out (which would produce notifications referencing nothing
  // — e.g., "Hot deal to !" with an empty destination).
  const isDynamic = initial.variables.length > 0;

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/admin/notifications"
        className="text-sm text-rose-500 hover:text-rose-600"
      >
        ← Back to notifications
      </Link>

      <header className="mt-2 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-3xl font-bold text-gray-900 font-mono break-all">
            {key}
          </h1>
          {isDynamic ? (
            <span className="inline-block px-2 py-0.5 text-xs font-medium border rounded bg-amber-50 text-amber-800 border-amber-200">
              Dynamic — copy locked
            </span>
          ) : (
            <span className="inline-block px-2 py-0.5 text-xs font-medium border rounded bg-gray-50 text-gray-700 border-gray-200">
              Static — fully editable
            </span>
          )}
        </div>
        {initial.description && (
          <p className="text-sm text-gray-500 mt-2">{initial.description}</p>
        )}
        {initial.updatedAt && (
          <p className="text-xs text-gray-400 mt-1">
            Last edited {formatDate(initial.updatedAt, true)}
          </p>
        )}
      </header>

      {isDynamic && (
        <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-lg">
          <p className="font-medium mb-1">
            Title and body are locked for this template.
          </p>
          <p className="text-xs leading-relaxed">
            The copy uses runtime variables (
            {initial.variables.map((v, i) => (
              <span key={v}>
                {i > 0 && ", "}
                <code className="font-mono px-1 bg-amber-100 rounded">{`{{${v}}}`}</code>
              </span>
            ))}
            ) that are filled in by the cron/webhook trigger at send time. Editing them in the
            admin would risk removing those placeholders, producing notifications like
            &ldquo;Hot deal to !&rdquo; with empty references. To change the copy, edit
            <code className="font-mono mx-1 px-1 bg-amber-100 rounded">TEMPLATE_DEFAULTS</code>
            in <code className="font-mono px-1 bg-amber-100 rounded">notification-templates.ts</code> and redeploy.
            <br />
            <strong>Deep link</strong> and <strong>enabled</strong> below remain editable so you can still toggle the trigger or change where the tap goes.
          </p>
        </div>
      )}

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
            Title {isDynamic && <span className="text-amber-700">(locked)</span>}
          </label>
          <input
            type="text"
            name="title"
            defaultValue={initial.title}
            required={!isDynamic}
            readOnly={isDynamic}
            placeholder="Your trial ends tomorrow"
            className={
              isDynamic
                ? "w-full px-3 py-2 border border-amber-200 bg-amber-50 rounded-lg text-gray-700 font-mono text-sm"
                : "w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            }
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Body {isDynamic && <span className="text-amber-700">(locked)</span>}
          </label>
          <textarea
            name="body"
            defaultValue={initial.body}
            required={!isDynamic}
            readOnly={isDynamic}
            rows={3}
            placeholder="Subscribe to keep unlimited swipes."
            className={
              isDynamic
                ? "w-full px-3 py-2 border border-amber-200 bg-amber-50 rounded-lg text-gray-700 font-mono text-sm"
                : "w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            }
          />
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
