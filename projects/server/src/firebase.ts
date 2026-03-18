import * as admin from "firebase-admin";

function getApp() {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  return admin.app();
}

export function getAuth() {
  return getApp().auth();
}

export function getDb() {
  return getApp().firestore();
}
