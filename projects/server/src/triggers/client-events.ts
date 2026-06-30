import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { colRef } from "../firebase";
import { runWithEnv } from "../env";
import { trackKlaviyoEvent } from "../lib/klaviyo";

const klaviyoPrivateApiKey = defineSecret("KLAVIYO_PRIVATE_API_KEY");
const klaviyoListId = defineSecret("KLAVIYO_LIST_ID");

/**
 * Fires on every `events/{id}` doc the client writes via logEvent() in
 * projects/app/src/lib/analytics.ts. Forwards a small allowlist of client
 * events to Klaviyo as lifecycle metrics; everything else is ignored:
 *   - `daily_limit_hit` → "Hit Swipe Limit" (triggers the swipe-limit email)
 *
 * (We used to also forward `app_open` → "App Opened", but re-engagement now
 * runs off the server-side `lastSeenAt` cron — see notification-cron.ts — so
 * the sparse app_open signal is no longer needed.)
 *
 * `userId` is "guest" for signed-out events (pre-auth screens) — those
 * can't be matched to a Klaviyo profile, so we skip them.
 */
const EVENT_TO_METRIC: Record<string, string> = {
  daily_limit_hit: "Hit Swipe Limit",
};

async function handleClientEvent(event: {
  data?: { data: () => any } | undefined;
}) {
  const data = event.data?.data();
  const metric = data?.name ? EVENT_TO_METRIC[data.name] : undefined;
  if (!metric) return;

  const userId: string = data.userId ?? "guest";
  if (userId === "guest") return;

  let email: string | null = null;
  let firstName: string | null = null;
  let lastName: string | null = null;
  let homeAirport: string | null = null;
  try {
    // Profiles use auto-generated doc IDs; userId is a field, not the doc ID
    // (created via addDoc — see app's services/firestore.ts). Query the field.
    const snap = await colRef("userProfiles")
      .where("userId", "==", userId)
      .limit(1)
      .get();
    const profile = snap.docs[0]?.data();
    email = profile?.email ?? null;
    firstName = profile?.firstName ?? null;
    lastName = profile?.lastName ?? null;
    homeAirport = profile?.homeAirport ?? null;
  } catch (err) {
    console.warn("[client-event] Failed to read userProfile:", err);
  }
  if (!email) return;

  await trackKlaviyoEvent(
    metric,
    {
      externalId: userId,
      email,
      firstName,
      lastName,
      // home_airport as a PROFILE property so the swipe-limit email's
      // `{{ person.home_airport }}` renders.
      properties: homeAirport ? { home_airport: homeAirport } : undefined,
    },
    { source: data.props?.source ?? null }
  );
}

/** Prod: fires on `events/{id}`. */
export const onClientEvent = onDocumentCreated(
  {
    document: "events/{id}",
    secrets: [klaviyoPrivateApiKey, klaviyoListId],
  },
  (event) => runWithEnv("prod", () => handleClientEvent(event))
);

/** Staging: fires on `staging_events/{id}`, gated by the sandbox whitelist
 * inside trackKlaviyoEvent (via lib/klaviyo.ts's gate()). */
export const onStagingClientEvent = onDocumentCreated(
  {
    document: "staging_events/{id}",
    secrets: [klaviyoPrivateApiKey, klaviyoListId],
  },
  (event) => runWithEnv("staging", () => handleClientEvent(event))
);
