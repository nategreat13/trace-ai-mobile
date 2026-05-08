import { Router } from "express";
import { adminAuth } from "../middleware/admin-auth";
import { sendToUser, sendBroadcast } from "../lib/push";
import {
  getTemplate,
  renderString,
  seedTemplatesIfMissing,
  KNOWN_TEMPLATE_KEYS,
} from "../lib/notification-templates";

export const adminPushRoutes = Router();

/**
 * Send a one-off push to a specific user. Used by the admin "Send test
 * push" button on the user-detail page. `force: true` bypasses the
 * user's notificationsEnabled flag so testing copy works even on opted-
 * out test accounts.
 *
 * Body: { userId: string, title: string, body: string, data?: object, force?: boolean }
 */
adminPushRoutes.post("/admin/send-test-push", adminAuth, async (req, res) => {
  const { userId, title, body, data, force } = req.body ?? {};
  if (!userId || !title || !body) {
    res.status(400).json({ error: "userId, title, body are required" });
    return;
  }
  try {
    const result = await sendToUser(
      userId,
      { title, body, data },
      { force: force === true }
    );
    res.json(result);
  } catch (err: any) {
    console.error("[admin-push] send-test-push failed:", err);
    res.status(500).json({ error: err?.message ?? "send failed" });
  }
});

/**
 * Broadcast a notification to a filtered audience.
 * Body: {
 *   audience: { tiers?: string[], platform?: "ios" | "android" }
 *   title: string
 *   body: string
 *   data?: object
 *   templateKey?: string
 * }
 */
adminPushRoutes.post("/admin/send-broadcast", adminAuth, async (req, res) => {
  const { audience, title, body, data, templateKey } = req.body ?? {};
  if (!title || !body) {
    res.status(400).json({ error: "title, body are required" });
    return;
  }
  try {
    const result = await sendBroadcast(
      audience ?? {},
      { title, body, data },
      { templateKey }
    );
    res.json(result);
  } catch (err: any) {
    console.error("[admin-push] send-broadcast failed:", err);
    res.status(500).json({ error: err?.message ?? "send failed" });
  }
});

/**
 * Send a notification using a saved template, with variables substituted.
 * Body: {
 *   userId?: string                 // either userId for per-user OR audience for broadcast
 *   audience?: { tiers, platform }
 *   templateKey: string
 *   vars?: Record<string,string|number>
 * }
 */
adminPushRoutes.post("/admin/send-template", adminAuth, async (req, res) => {
  const { userId, audience, templateKey, vars } = req.body ?? {};
  if (!templateKey) {
    res.status(400).json({ error: "templateKey is required" });
    return;
  }
  const template = await getTemplate(templateKey);
  if (!template) {
    res.status(404).json({ error: `template not found: ${templateKey}` });
    return;
  }
  const title = renderString(template.title, vars ?? {});
  const body = renderString(template.body, vars ?? {});
  const data = template.deepLink ? { deepLink: template.deepLink, templateKey } : { templateKey };
  try {
    if (userId) {
      const result = await sendToUser(
        userId,
        { title, body, data },
        { templateKey, force: true }
      );
      res.json(result);
    } else {
      const result = await sendBroadcast(
        audience ?? {},
        { title, body, data },
        { templateKey }
      );
      res.json(result);
    }
  } catch (err: any) {
    console.error("[admin-push] send-template failed:", err);
    res.status(500).json({ error: err?.message ?? "send failed" });
  }
});

/**
 * Seed any missing template docs in Firestore. Safe to call repeatedly;
 * never overwrites existing docs. Used on first deploy and when new
 * trigger keys are added in code.
 */
adminPushRoutes.post("/admin/seed-templates", adminAuth, async (_req, res) => {
  try {
    const result = await seedTemplatesIfMissing();
    res.json({ ...result, knownKeys: KNOWN_TEMPLATE_KEYS });
  } catch (err: any) {
    console.error("[admin-push] seed-templates failed:", err);
    res.status(500).json({ error: err?.message ?? "seed failed" });
  }
});
