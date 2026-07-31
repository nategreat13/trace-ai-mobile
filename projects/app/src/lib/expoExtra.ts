import Constants from "expo-constants";

/**
 * Safe reader for `expo.extra` values that are "a string, or absent".
 *
 * Why this exists: `app.config.js` sets several extra fields to `null` when
 * the corresponding env var isn't present (`process.env.X ?? null`). Expo does
 * NOT preserve that null — by the time the config reaches the app it has been
 * serialized into an **empty object `{}`**, which is *truthy* in JavaScript.
 *
 * So the natural-looking guard is silently wrong:
 *
 *     const token = extra?.mapboxPublicToken ?? null;  // {} — ?? does not fire
 *     if (!token) return <Placeholder />;              // never taken
 *     Mapbox.setAccessToken(token);                    // sets {} → 401s
 *
 * That exact bug shipped in DealsMap: with no MAPBOX_PUBLIC_TOKEN in the
 * environment the map rendered anyway and failed with "401 Not Authorized -
 * Invalid Token" instead of showing the intended explanatory placeholder.
 * DiagnosticsScreen had independently discovered the same `{}` behavior for
 * `devApiUrl` and string-gated around it locally; this centralizes that
 * knowledge so the next reader doesn't have to rediscover it a third time.
 *
 * Returns the value only when it is a genuine non-empty string; `null` for
 * `{}`, `null`, `undefined`, or `""`.
 */
export function extraString(key: string): string | null {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const v = extra?.[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}
