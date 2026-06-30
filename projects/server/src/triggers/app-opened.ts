import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { colRef } from "../firebase";
import { runWithEnv } from "../env";
import { trackKlaviyoEvent } from "../lib/klaviyo";

const klaviyoPrivateApiKey = defineSecret("KLAVIYO_PRIVATE_API_KEY");
const klaviyoListId = defineSecret("KLAVIYO_LIST_ID");

/**
 * Fires on every `events/{id}` doc the client writes via logEvent() in
 * projects/app/src/lib/analytics.ts. We only care about `app_open` here —
 * it's the signal Klaviyo's "time since last event" Flows (Day 2 / Day 7
 * re-engagement) key off of. Everything else is ignored.
 *
 * `userId` is "guest" for signed-out events (pre-auth screens) — those
 * can't be matched to a Klaviyo profile, so we skip them.
 */
async function handleAppOpened(event: {
  data?: { data: () => any } | undefined;
}) {
  const data = event.data?.data();
  if (!data || data.name !== "app_open") return;

  const userId: string = data.userId ?? "guest";
  if (userId === "guest") return;

  let email: string | null = null;
  let firstName: string | null = null;
  let lastName: string | null = null;
  try {
    const snap = await colRef("userProfiles").doc(userId).get();
    const profile = snap.data();
    email = profile?.email ?? null;
    firstName = profile?.firstName ?? null;
    lastName = profile?.lastName ?? null;
  } catch (err) {
    console.warn("[app-opened] Failed to read userProfile:", err);
  }
  if (!email) return;

  await trackKlaviyoEvent(
    "App Opened",
    { externalId: userId, email, firstName, lastName },
    { source: data.props?.source ?? null }
  );
}

/** Prod: fires on `events/{id}`. */
export const onAppOpened = onDocumentCreated(
  {
    document: "events/{id}",
    secrets: [klaviyoPrivateApiKey, klaviyoListId],
  },
  (event) => runWithEnv("prod", () => handleAppOpened(event))
);

/** Staging: fires on `staging_events/{id}`, gated by the sandbox whitelist
 * inside trackKlaviyoEvent (via lib/klaviyo.ts's gate()). */
export const onStagingAppOpened = onDocumentCreated(
  {
    document: "staging_events/{id}",
    secrets: [klaviyoPrivateApiKey, klaviyoListId],
  },
  (event) => runWithEnv("staging", () => handleAppOpened(event))
);
