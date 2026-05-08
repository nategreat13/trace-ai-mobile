# Trace — Claude session ground rules

This is a published mobile app on the iOS App Store and Google Play with **real users**. Default to caution on anything that touches production.

## Deployment policy (most important — read first)

**Never publish OTAs or production deploys without explicit approval from the user in this session.**

For every action below, propose what you'll do and wait for an explicit go-ahead ("ship it" / "go" / "yes deploy"). Don't infer approval from earlier conversation context.

| Action | Asks approval? | Examples |
|--------|----------------|----------|
| OTA push | **Yes** | `eas update --branch production` |
| OTA republish (rollback) | **Yes** | `eas update:republish --group ...` |
| Cloud Function deploy | **Yes** | `firebase deploy --only functions:...` |
| Firestore rules deploy | **Yes** | `firebase deploy --only firestore:rules` |
| Firestore indexes deploy | **Yes** | `firebase deploy --only firestore:indexes` |
| Storage rules deploy | **Yes** | `firebase deploy --only storage` |
| Web app deploy | **Yes** | `vercel --prod` |
| App binary build | **Yes** | `eas build --profile production` |
| App Store / Play submission | **Yes** | `eas submit`, `eas build --auto-submit` |
| Secret changes in production | **Yes** | `firebase functions:secrets:set` (live), Vercel env edits |
| Code commit + `git push` to `main` | **No** | Pushing code doesn't auto-deploy anywhere |
| Reading logs / Firestore queries / state | **No** | `gcloud run logs read`, `firebase functions:list`, curl probes |
| Local-only changes (Edit / Write tools) | **No** | Editing files in the repo |
| Documentation / planning | **No** | This file, `*.md`, discussion |

When in doubt, ASK. The cost of a confirmation prompt is much lower than the cost of an unwanted production change.

## Native deps require a runtimeVersion bump

Adding a new native dependency to `projects/app/package.json` (anything that has a native iOS/Android module — `expo-*`, `react-native-*` modules with native code, etc.) **must come with a `runtimeVersion` bump in `app.json`** in the same commit.

Why: existing app binaries on real devices don't have the new native module. Subsequent OTAs against the same `runtimeVersion` would push JS that imports the missing module, crashing the app on launch. Bumping `runtimeVersion` ensures future OTAs only reach the new binary (once it's built and approved by Apple/Google).

Past incident: native deps added without a bump caused crash-loop OTAs to ship to production users (commit `e9ffc1a` → `76595c0` → recovered via republish at `005bf4c`). Don't repeat this.

When you add a native dep:
1. Bump `expo.runtimeVersion` in `app.json` (e.g., `"1.1.0"` → `"1.2.0"`)
2. Bump `expo.version` to match (App Store requires unique version numbers per build)
3. Tell the user that a new binary is required before any OTA can ship the new code
4. Don't run `eas update` until the new binary is approved + live

## Project layout

```
projects/
├── app/        Expo / React Native mobile app (iOS + Android)
├── server/     Firebase Cloud Functions (Express.js, deployed via firebase CLI)
├── web/        Next.js admin portal at subscribe.tracetravel.co (Vercel)
└── shared/     TypeScript types shared between projects/* (UserProfile, etc.)
```

Key infrastructure:
- **Firebase project**: `trace-ai-b9cba` (pinned in `.firebaserc`)
- **Cloud Function URL**: `https://api-7l7vojyykq-uc.a.run.app`
- **Web admin**: `https://subscribe.tracetravel.co/admin` (auth via `ANALYTICS_PASSWORD` env)
- **Vercel project**: `trace-travel-ai` (org `gyginathan-5364s-projects`)
- **EAS project**: `trace-ai-mobile` (owner `nategreat13`)
- **iOS bundle**: `co.tracetravel.aiapp`
- **Android package**: `co.tracetravel.aiapp`
- **RevenueCat project ID**: `proj6610ca19`

Secrets stored in Firebase Secret Manager (use `firebase functions:secrets:access <name>`):
- `REVENUECAT_WEBHOOK_SECRET` — RC → /revenuecat-webhook auth
- `REVENUECAT_REST_API_KEY` — server → RC v2 API auth
- `ADMIN_API_TOKEN` — admin web → admin push endpoints auth
- `SLACK_SIGNUP_WEBHOOK_URL` — onUserProfileCreated → Slack

## People in this codebase

- **Nate** — technical, owns infrastructure / build / submit / Apple Developer / Vercel admin / Firebase admin. Default user in this session.
- **Trevor** — product, non-technical but uses Claude. Owns notification copy, broadcast sends, admin portal day-to-day. See `TREVOR_PUSH_NOTIFICATIONS.md` for what he can do without escalating to Nate.

If you're in a session with Trevor:
- He probably has the ability to read code, run safe diagnostics, and write product changes (copy edits, etc.)
- Anything that needs Apple Developer / Vercel admin / Firebase Secret Manager access — defer to Nate
- Same deployment policy applies — ask before running any production deploy

## Other useful files

- `TREVOR_PUSH_NOTIFICATIONS.md` — Trevor's hand-written guide for the notifications system, written in non-technical terms. Read first if a session with Trevor is about notifications.
- `firestore.rules` — locked-down per-collection security rules
- `firestore.indexes.json` — composite index declarations (changes here require deploy approval)
- `storage.rules` — Firebase Storage rules
- `firebase.json` — wires rules/indexes/functions deploy targets
- `MAC_SETUP.md` — local dev setup

## Conventions

- **Commits**: Single `git push` to `main` per logical change. Detailed commit messages (the why, not just the what). Co-author trailer for Claude sessions: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`. Prefer creating new commits over amending.
- **Secrets**: Never paste secret values into chat. Use `firebase functions:secrets:set <name>` (interactive prompt) or `printf 'value' | firebase functions:secrets:set <name> --data-file=-` (non-interactive, no shell history leak).
- **Mobile date formatting**: Admin web uses Mountain Time (`America/Denver`) via `projects/web/src/lib/format.ts`. Don't use `toLocaleString()` directly in admin pages — use the helpers.
- **Firestore writes from clients**: Most collections are deny-all to clients via rules. Server-only collections include `analyticsExclusions`, `adminAuditLog`, `promoCodes`, `promoRedemptions`, `notificationTemplates`, `notificationLog`. The `events` collection has narrow client-write rules (own userId or "guest", no `source` field).

## Common diagnostic commands (safe to run without asking)

```bash
# Recent Cloud Function logs
gcloud run services logs read api --region us-central1 --project trace-ai-b9cba --limit 50

# Firestore document state via REST (one-shot reads)
TOKEN=$(gcloud auth print-access-token)
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://firestore.googleapis.com/v1/projects/trace-ai-b9cba/databases/(default)/documents/userProfiles/<docId>"

# List currently-deployed functions
firebase functions:list --project trace-ai-b9cba

# List EAS update branches and recent groups
eas update:list --branch production
```

For anything else, ask.
