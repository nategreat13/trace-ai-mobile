#!/usr/bin/env bash
# Fails the build if any code in projects/{app,server,web} calls Firestore
# with a hardcoded collection name string instead of going through the
# env-aware `col(env, name)` / `colRef(env, name)` helpers in @trace/shared.
#
# This is the single most important defense against the worst-case
# staging-env bug: a missed call site that writes a staging account's
# data into the prod `userProfiles` collection. As long as every read
# and write resolves its collection name through `col()`, the typed
# `CollectionName` union prevents that class of bug at compile time.
#
# Allowed exceptions:
#   - `firebase.ts` (server) and `firebase-admin.ts` (web) — they DEFINE
#     the helper, so they call `getDb().collection(resolved)` once each.
#   - `services/firestore.ts` (app) — it defines local `envCollection`
#     and `envDoc` helpers that wrap `collection(db, …)` once each.
#   - Comments and JSDoc — pattern matches code only.
#
# Usage: ./scripts/check-raw-collection-calls.sh
set -euo pipefail

cd "$(dirname "$0")/.."

# Match three offending shapes:
#   .collection("userProfiles")          (admin SDK)
#   collection(db, "userProfiles")       (web SDK)
#   doc(db, "userProfiles", id)          (web SDK doc ref)
PATTERN='\.collection\("[a-zA-Z_]+"\)|collection\(db,\s*"[a-zA-Z_]+"\)|doc\(db,\s*"[a-zA-Z_]+",'

# Files exempt from the check — they DEFINE the helpers.
EXEMPT='projects/server/src/firebase\.ts|projects/web/src/lib/firebase-admin\.ts|projects/app/src/services/firestore\.ts'

if matches=$(grep -rnE "$PATTERN" \
    projects/{app,server,web}/src \
    --include='*.ts' --include='*.tsx' 2>/dev/null \
    | grep -vE "$EXEMPT" \
    | grep -v '^[^:]*:[0-9]*: *//' \
    | grep -v '^[^:]*:[0-9]*: *\*'); then
  echo "❌ Raw Firestore collection literals found. Use col(env, name) / colRef(env, name)" >&2
  echo "   from @trace/shared instead. Offending lines:" >&2
  echo "" >&2
  echo "$matches" >&2
  exit 1
fi

echo "✅ No raw Firestore collection literals — every call goes through col()/colRef()."
