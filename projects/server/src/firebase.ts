import * as admin from "firebase-admin";

// Pinned to match `.firebaserc`. Passing it explicitly avoids the
// "Unable to detect a Project Id in the current environment" error
// that bites every new local-dev setup, where the developer has ADC
// from `gcloud auth application-default login` but no
// GOOGLE_CLOUD_PROJECT env var. In production (Cloud Run) the
// runtime sets GOOGLE_CLOUD_PROJECT automatically and would resolve
// to the same value — passing it here is a no-op there.
const FIREBASE_PROJECT_ID = "trace-ai-b9cba";

function getApp() {
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: FIREBASE_PROJECT_ID,
    });
  }
  return admin.app();
}

export function getAuth() {
  return getApp().auth();
}

export function getDb() {
  return getApp().firestore();
}
