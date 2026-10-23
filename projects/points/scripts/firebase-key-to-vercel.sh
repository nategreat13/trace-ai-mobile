#!/usr/bin/env bash
# Creates the Trace Points server key and stores it in Vercel (trace-points,
# Preview + Production) without printing it. Run it yourself from the repo:
#   bash projects/points/scripts/firebase-key-to-vercel.sh
# Needs: gcloud signed in as a project Owner, Vercel CLI signed in to Trace
# Travel via ~/.vercel-trace. Safe to re-run: it reuses the account and adds a
# fresh key (Vercel keeps the newest value; old keys can be deleted in IAM).
set -euo pipefail

PROJECT=trace-ai-b9cba
SA=trace-points-web
EMAIL="$SA@$PROJECT.iam.gserviceaccount.com"
VERCEL=(npx --yes vercel --scope trace-travel --global-config "$HOME/.vercel-trace")

echo "1/4 Service account $EMAIL"
gcloud iam service-accounts describe "$EMAIL" --project "$PROJECT" >/dev/null 2>&1 ||
  gcloud iam service-accounts create "$SA" --project "$PROJECT" --display-name "Trace Points web"

echo "2/4 Firestore access only (roles/datastore.user)"
gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$EMAIL" --role roles/datastore.user --condition=None >/dev/null

echo "3/4 New key (temporary file, deleted at the end)"
KEYFILE="$(mktemp -t trace-points-key).json"
trap 'rm -f "$KEYFILE"' EXIT
gcloud iam service-accounts keys create "$KEYFILE" --iam-account "$EMAIL" --project "$PROJECT" >/dev/null 2>&1

echo "4/4 Saving to Vercel (Preview + Production)"
cd "$(dirname "$0")/.."
for ENVIRONMENT in preview production; do
  for NAME in FIREBASE_CLIENT_EMAIL FIREBASE_PRIVATE_KEY FIREBASE_PROJECT_ID; do
    "${VERCEL[@]}" env rm "$NAME" "$ENVIRONMENT" --yes >/dev/null 2>&1 || true
  done
  printf '%s' "$EMAIL" | "${VERCEL[@]}" env add FIREBASE_CLIENT_EMAIL "$ENVIRONMENT" >/dev/null
  printf '%s' "$PROJECT" | "${VERCEL[@]}" env add FIREBASE_PROJECT_ID "$ENVIRONMENT" >/dev/null
  python3 -c 'import json,sys; sys.stdout.write(json.load(open(sys.argv[1]))["private_key"])' "$KEYFILE" |
    "${VERCEL[@]}" env add FIREBASE_PRIVATE_KEY "$ENVIRONMENT" --sensitive >/dev/null
  echo "   $ENVIRONMENT: done"
done

echo "All set. The key file has been deleted."
