# Staging environment — full reference

This is the deep-dive doc. `CLAUDE.md` has the short summary every Claude session sees; this file has the rest. Read this whenever a session is doing something env-related (toggling envs, debugging cross-env issues, adding a new collection, deploying anything, etc.).

---

## What it is, in one paragraph

Staging is a second logical environment that lives **inside the same Firebase project as production** (`trace-ai-b9cba`). Data is segregated by **collection-name prefix**: prod uses `userProfiles`, staging uses `staging_userProfiles`. Same auth pool, same project ID, same secrets, same Expo project, same APNs/FCM credentials. The mobile app, Cloud Function, and admin web all carry an env value (`"prod"` or `"staging"`) that determines which set of collections every Firestore call resolves to.

The whole point: developers and beta testers can exercise signup, swipes, alerts, push notifications etc. without polluting real production data — and admins can view either side without restarting anything.

---

## Architecture

### Single Firebase project, prefix-based collections

Every top-level Firestore collection has a sibling prefixed with `staging_`:

| Prod | Staging |
|---|---|
| `userProfiles` | `staging_userProfiles` |
| `swipeActions` | `staging_swipeActions` |
| `flightDeals` | `staging_flightDeals` |
| `dealAlerts` | `staging_dealAlerts` |
| `events` | `staging_events` |
| `notificationTemplates` | `staging_notificationTemplates` |
| `notificationLog` | `staging_notificationLog` |
| `promoCodes` | `staging_promoCodes` |
| `promoRedemptions` | `staging_promoRedemptions` |
| `analyticsExclusions` | `staging_analyticsExclusions` |
| `adminAuditLog` | `staging_adminAuditLog` |
| `destinationContent` | `staging_destinationContent` |
| `sharedDeals` | `staging_sharedDeals` |
| `adSpend` | `staging_adSpend` |

`firestore.rules` and `firestore.indexes.json` mirror every prod block/index for the staging twin. If you change one side, change the other side or you'll get a permission denied / missing index error in staging.

### `@trace/shared` — single source of truth

All env routing pivots on `projects/shared/src/collections.ts`:

```ts
export const COLLECTION_NAMES = [/* the 14 names */] as const;
export type CollectionName = typeof COLLECTION_NAMES[number];
export type TraceEnv = "prod" | "staging";

export function col(env: TraceEnv, name: CollectionName): string {
  return env === "staging" ? `staging_${name}` : name;
}
```

The `CollectionName` union is the keystone safety net: if you typo a collection name or add a new collection without registering it here, **TypeScript stops the build**. There's also a CI grep guard at `scripts/check-raw-collection-calls.sh` that fails on any raw `.collection("literal")` call outside `col()`/`colRef()`.

### How each project resolves env

**Mobile app** (`projects/app/src/lib/env.ts`): module-local variable hydrated once at startup from AsyncStorage key `trace.env`. Synchronous read via `getEnv()`. Switching env writes the key + reloads the JS bundle (`Updates.reloadAsync()`) so listeners, API URL, and AsyncStorage prefixes all re-init.

**Server** (`projects/server/src/env.ts`): per-request `AsyncLocalStorage` context. Each Cloud Function entry point wraps its handler in `runWithEnv(env, () => app(req, res))` so concurrent requests don't race on a shared variable. `colRef(name)` reads the current async-store env and resolves the collection.

**Admin web** (`projects/web/src/lib/env.ts`): cookie `trace_admin_env`. Read in every server component via `await getAdminEnv()`. Toggled by POSTing to `/api/set-env`, which calls `revalidatePath("/", "layout")` so every page re-renders with the new env.

---

## Cloud Functions — both URLs

| Env | Function name | URL |
|---|---|---|
| Prod | `api` | `https://api-7l7vojyykq-uc.a.run.app` |
| Staging | `apiStaging` | `https://apistaging-7l7vojyykq-uc.a.run.app` |

Both run the **same code** (one bundled JS file). The only difference is the `runWithEnv("prod", …)` vs `runWithEnv("staging", …)` wrapper. Same secrets bound to both.

Background triggers come in pairs:
- `onUserProfileCreated` (prod) — fires Slack signup notification
- `onStagingUserProfileCreated` (staging) — intentionally **skips Slack** (decision 5: don't make the channel noisy with test signups)
- `dailyNotificationTriggers` (prod) — daily push cron at 14:00 UTC
- `dailyStagingNotificationTriggers` — exports as `null` unless `ENABLE_STAGING_CRON=1` env var is set on the function (decision 6: cron off by default in staging)

---

## How to switch env

### Mobile app

1. Long-press the Trace logo on **LandingScreen** (unauthed) or **ProfileScreen** (authed) for **3 seconds**
2. The Diagnostics screen opens (modal)
3. Tap the env toggle, confirm
4. App signs out + reloads JS bundle automatically

When env=staging, a small orange **STAGING** badge appears under the logo on LandingScreen.

> **Known issue (open as of 2026-05-12):** the diagnostics screen crashes on production OTAs in some cases. Defensive `safe()` wrappers are in place but the crash isn't fully diagnosed yet. If a session needs to debug this, the symptom is "long-press works, modal opens, crashes on render" — start by getting the actual error from `Console.app` (iOS) or `adb logcat` (Android).

### Admin web

1. Sign in to `subscribe.tracetravel.co/login`
2. The header strip in `(authed)/layout.tsx` has a two-button env segment between the tab nav and Sign out
3. Click **STAGING** — the page reloads, every server component re-fetches with `env="staging"`, and an orange **STAGING ENVIRONMENT** banner appears across the top

### Local dev defaults

Both default to staging when running locally — added so daily local dev never pollutes prod data:

| Command | Default env |
|---|---|
| `yarn dev2` (mobile against local server) | **staging** (only when `USE_LOCAL_API=1`, which dev2 sets) |
| `yarn dev:prod` (mobile against deployed prod) | prod |
| `yarn dev:web` (Next dev) | **staging** (when `NODE_ENV === "development"`) |
| `yarn dev1` (local server) | **staging** (override with `TRACE_ENV=prod yarn dev1`) |
| Production binaries | prod |
| Vercel deploys | prod |

If the user has explicitly toggled to prod via diagnostics screen / web toggle, that choice persists in AsyncStorage / cookie and overrides the default.

---

## Design decisions (and why)

These were locked in when staging was designed. Don't change without rediscussion:

1. **Same Firebase Auth pool.** A staging signup creates a real Firebase Auth user that lives alongside prod accounts in the Auth console. Use email prefix `qa+`/`staging+` to identify them. Cron is staging-aware (only reads matching collection), so staging Auth users without a prod userProfile doc don't get notifications meant for real users.
2. **RevenueCat skipped for staging v1.** The mobile IAP flow short-circuits in staging mode (no real purchases). RevenueCat webhook is prod-only.
3. **Push notifications shared keys.** Same Expo project, same APNs/FCM creds. Tokens land in `staging_userProfiles.pushTokens` when env=staging. `apiStaging` sends through the same Expo push endpoint.
4. **No passcode on the diagnostics screen.** The 3-second long-press is the only gate. Beta testers can flip themselves into staging without a code.
5. **Slack signup notifications suppressed in staging.** `onStagingUserProfileCreated` deliberately doesn't post to Slack so the channel isn't noisy.
6. **Staging cron off by default.** `dailyStagingNotificationTriggers` exports `null` unless `ENABLE_STAGING_CRON=1`. Turn on only during specific QA cycles.
7. **No AsyncStorage migration on the mobile app.** Existing prod users on upgrade lose their per-day deck position once and may see the soft push prompt one extra time. Both annoying, neither broken.

---

## Known limitations

### Push send always uses the prod Cloud Function

`projects/web/src/lib/push-admin.ts` hardcodes `DEFAULT_API_BASE = "https://api-7l7vojyykq-uc.a.run.app"`. So when an admin clicks **Send test push**, **Send broadcast**, or **Send template** — even with the env toggle on STAGING — the request hits the prod Cloud Function, which reads from prod `userProfiles` and writes to prod `notificationLog`.

**Implication for Trevor:** if you flip the admin to STAGING and try to send a test broadcast, it goes to real prod users. The admin's env toggle controls **what data you see in tables**, not **where pushes get sent from**. Don't experiment with broadcast copy from a STAGING-mode admin and assume it's safe.

If we ever want true staging push sending, push-admin.ts needs an env-aware base URL switch + the staging notificationTemplates collection needs to be seeded.

### `staging_notificationTemplates` is empty

The notification template editor reads from `notificationTemplates` (prod) or `staging_notificationTemplates` (staging) based on env. Staging starts empty. The cron and per-template send paths fall back to in-code defaults in `projects/server/src/lib/notification-templates.ts` when a doc is missing — so pushes still work — but the admin's "Templates" page in STAGING mode will show empty template content until someone seeds it (e.g. by clicking "Seed templates" in the admin UI while in staging mode).

### Stripe routes are gone

The web project's `/api/{cancel,preview-switch,subscribe,switch-plan,webhook}` route handlers were deleted along with the customer-facing subscribe flow. RevenueCat is the only payments path. The RevenueCat webhook still lives at `projects/server/src/routes/revenuecat-webhook.ts` (untouched) — that's a server endpoint, not a web one. Any session that needs to add payments back: don't recreate Stripe in the web project; do whatever you need on the mobile + Cloud Function side.

---

## URL structure changed

The web admin used to live at `subscribe.tracetravel.co/admin/...`. As of this session it's been moved to root:

| Old URL | New URL |
|---|---|
| `subscribe.tracetravel.co/admin` | `subscribe.tracetravel.co/` (redirects to `/analytics` if authed, `/login` otherwise) |
| `subscribe.tracetravel.co/admin/analytics` | `subscribe.tracetravel.co/analytics` |
| `subscribe.tracetravel.co/admin/users` | `subscribe.tracetravel.co/users` |
| `subscribe.tracetravel.co/admin/login` | `subscribe.tracetravel.co/login` |
| (etc — every `/admin/X` → `/X`) | |

`middleware.ts` 308-redirects all old `/admin/X` URLs to `/X` so existing bookmarks and emails keep working.

Public pages still at the same place: `/privacy`, `/terms`, `/support`, `/delete-account` (linked from the App Store listings + the mobile app's PaywallScreen).

---

## Deploy infrastructure changes

### Server now bundles with esbuild

Old build: `tsc` → multiple JS files → Cloud Functions ran `npm install` and resolved imports at runtime. Worked because nothing imported `@trace/shared` at runtime.

New build: `tsc --noEmit` (typecheck) + `esbuild src/index.ts --bundle …` → single 85kb `dist/index.js`. `@trace/shared` (and other workspace code) is inlined; only true externals like `firebase-admin`, `firebase-functions`, `stripe`, `cors`, `express`, `expo-server-sdk`, `@anthropic-ai/sdk` stay in `package.json`.

Why the change: Cloud Functions ran `npm install` on the upload, but `"@trace/shared": "file:../shared"` couldn't resolve (the upload boundary is `projects/server`, so `../shared` is outside it). Bundling eliminated the runtime dep entirely. `package.json` `main` is now `dist/index.js`.

`yarn deploy:api` still runs end-to-end:
```
yarn workspace @trace/shared build
&& rm -rf projects/server/shared && cp -r projects/shared projects/server/shared
&& yarn workspace @trace/server build  // ← now invokes esbuild
&& firebase deploy --only functions
```

### Web deploys from repo root

Vercel project `trace-travel-ai` was linked to `projects/web/` originally. Once the web project picked up `@trace/shared` as a workspace dep, npm install inside `projects/web/` couldn't resolve it. Fix: link Vercel from the **repo root** so `yarn install` runs at the workspace level.

Files added to support this:
- `vercel.json` (repo root) — `installCommand`, `buildCommand` build the workspace from root, `outputDirectory: projects/web/.next`
- `.vercelignore` (repo root) — excludes `projects/app`, `projects/server`, `node_modules`, `dist`, etc. Without this the upload exceeds Vercel's 15k file limit.
- `.vercel/` lives at repo root (not `projects/web/`) — that's where the project link is now.

Deploy command:
```
vercel --prod --yes --archive=tgz
```
(Run from repo root. The `--archive=tgz` flag is required because of the file-count limit.)

If you ever need to re-link from scratch: `cd /Users/nate/src/trace-ai-mobile && vercel link` and choose the existing `trace-travel-ai` project.

### Firebase Functions URL gotcha

When deploying staging the first time, Cloud Run named the function `apistaging` (lowercase, no hyphen). The friendly URL is `https://apistaging-7l7vojyykq-uc.a.run.app`. Coded into `projects/app/src/lib/constants.ts` as `STAGING_API_URL`.

If a staging deploy ever lands the function in a "container failed health check" state (we hit this once during the bundling debugging), Cloud Run keeps the previous good revision serving traffic — so prod stays up. Rollback for prod: `firebase functions:rollback api --project trace-ai-b9cba`. To delete a function entirely (e.g. fixing an HTTPS-vs-trigger mismatch): `firebase functions:delete <name> --region us-central1 --project trace-ai-b9cba --force`.

---

## Defenses against the partial-env bug

The worst-case bug is "writes from staging mode silently land in prod" — i.e. partial env state. Four layers defend against this:

1. **TypeScript `CollectionName` union.** Every `col(env, name)` requires a name from the union. Typos don't compile.
2. **CI grep guard.** `scripts/check-raw-collection-calls.sh` fails any raw `.collection("literal")` call outside `col()`/`colRef()`.
3. **Runtime assertion in server `colRef`.** If `getEnv()` returns one env but `envFromCollection(resolvedName)` infers a different env, throws loudly (better a 500 than silent wrong-collection write).
4. **Visual indicators.** Persistent orange STAGING badge on mobile LandingScreen + STAGING banner across admin pages whenever staging is active. Defense-in-depth for "wait, which env am I in?"

When adding a new collection: add it to `COLLECTION_NAMES`, add prod + staging rules block, add prod + staging composite indexes if needed. The CI guard + TS union will catch most omissions.

---

## What's in each env right now

**Prod** (after the cleanup nuke in this session):
- 2 reviewer test accounts (Apple + Google Play): `4UI7e32UEXOIv13us7RowSJG0di2`, `tQOhYcLbxbWinHHpaUgiykeYcUt2`
- Their swipes / saved deals / alerts
- 2 promo codes: `TRACEVIP`, `TRACEBIZ`
- `notificationTemplates` and `analyticsExclusions` (config)
- Everything else nuked

**Staging**: empty until someone signs up via the mobile app in staging mode.

---

## Trevor specifically

If a Claude session is with Trevor:
- Flipping the admin env toggle is safe — it just changes what data the page shows. No deploy, no destructive action. Switching to STAGING shows mostly empty tables (staging is empty until people test).
- The orange STAGING banner is your reminder you're not looking at real data.
- **Test pushes / broadcasts always send to prod** (push-admin.ts limitation noted above). Don't experiment with broadcast copy from STAGING mode and assume the recipients are test accounts — they aren't.
- Notification template edits in STAGING write to `staging_notificationTemplates`. Edits in PROD write to `notificationTemplates`. They're isolated.
- Anything that would deploy or push code (server, web, OTA, rules, indexes, secrets, native build) is still Nate's call. Same deployment policy as everything else.
