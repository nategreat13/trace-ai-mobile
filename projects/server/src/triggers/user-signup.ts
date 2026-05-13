import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { colRef } from "../firebase";
import { runWithEnv } from "../env";

/**
 * Slack incoming webhook URL — bound at deploy via Secret Manager.
 * Set with: `firebase functions:secrets:set SLACK_SIGNUP_WEBHOOK_URL`
 */
const slackSignupWebhookUrl = defineSecret("SLACK_SIGNUP_WEBHOOK_URL");

/**
 * Fires whenever a new userProfiles document is created. The userProfile
 * doc is the canonical "user finished signup + onboarding" moment in this
 * codebase (createUserProfile is called from the onboarding flow), so it
 * doubles as our signup notification trigger.
 *
 * Posts a brief signup announcement to the configured Slack channel:
 *   - email
 *   - home airport
 *   - timestamp (rendered in each viewer's local timezone via Slack's
 *     <!date^...> formatter)
 *   - "user #N" — total userProfiles after this signup
 */
async function handleUserSignup(event: {
  data?: { data: () => any } | undefined;
}) {
    const data = event.data?.data();
    if (!data) {
      console.warn("[Slack signup] Trigger fired with no doc data");
      return;
    }

    const email: string = data.email ?? "(no email)";
    const homeAirport: string = data.homeAirport ?? "(unknown)";
    const createdAtRaw: any = data.createdAt;
    const createdAt: Date =
      createdAtRaw?.toDate?.() ??
      (createdAtRaw instanceof Date ? createdAtRaw : new Date());
    const unixSeconds = Math.floor(createdAt.getTime() / 1000);

    // The new doc is already in the database when this trigger fires,
    // so count() reflects it as "user #N".
    let totalUsers = 0;
    try {
      const snap = await colRef("userProfiles").count().get();
      totalUsers = snap.data().count;
    } catch (err) {
      console.warn("[Slack signup] Failed to read user count:", err);
    }

    const webhookUrl = slackSignupWebhookUrl.value();
    if (!webhookUrl) {
      console.warn(
        "[Slack signup] SLACK_SIGNUP_WEBHOOK_URL is not set; skipping notification"
      );
      return;
    }

    // Slack's <!date^TIMESTAMP^FORMAT|FALLBACK> renders the timestamp in
    // each viewer's local timezone. Fallback shown if Slack can't parse it.
    const timeMrkdwn = `<!date^${unixSeconds}^{date_short_pretty} at {time}|${createdAt.toISOString()}>`;
    const userOrdinal = `#${totalUsers.toLocaleString()}`;

    const payload = {
      text: `New signup ${userOrdinal} — ${email}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:tada: *New signup ${userOrdinal}*`,
          },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Email*\n\`${email}\`` },
            { type: "mrkdwn", text: `*Home airport*\n${homeAirport}` },
            { type: "mrkdwn", text: `*Time*\n${timeMrkdwn}` },
            {
              type: "mrkdwn",
              text: `*Total users*\n${totalUsers.toLocaleString()}`,
            },
          ],
        },
      ],
    };

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "(unreadable body)");
        console.error(
          "[Slack signup] Webhook returned non-OK:",
          res.status,
          body
        );
      } else {
        console.log("[Slack signup] Notified for", email, userOrdinal);
      }
    } catch (err) {
      console.error("[Slack signup] Webhook POST failed:", err);
    }
  }

/**
 * Prod signup trigger. Fires on `userProfiles/{id}` (the unprefixed
 * collection), so it only sees real-user signups.
 */
export const onUserProfileCreated = onDocumentCreated(
  {
    document: "userProfiles/{id}",
    secrets: [slackSignupWebhookUrl],
  },
  (event) => runWithEnv("prod", () => handleUserSignup(event))
);

/**
 * Staging signup trigger. Fires on `staging_userProfiles/{id}`.
 * Per the staging design (decision 5: "Suppress Slack notifications"),
 * we deliberately skip the Slack post so the channel isn't noisy with
 * test accounts. The trigger still exists so any future per-signup
 * server-side bootstrap logic stays parallel between the two envs.
 */
export const onStagingUserProfileCreated = onDocumentCreated(
  {
    document: "staging_userProfiles/{id}",
    secrets: [slackSignupWebhookUrl],
  },
  (event) =>
    runWithEnv("staging", async () => {
      const data = event.data?.data();
      if (!data) return;
      console.log(
        "[staging signup] new staging userProfile",
        data.email ?? "(no email)"
      );
      // Intentionally no Slack post — see comment above.
    })
);
