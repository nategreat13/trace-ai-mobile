"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

/**
 * Trace's Firebase web config (public by design; same project as the mobile
 * app). Points only uses Firebase Auth to email sign-in links and prove
 * someone owns an address; the session itself is Points' own cookie.
 */
const config = {
  apiKey: "AIzaSyBAJ72VgZaZGm6QDsTDn_6bpg3umhDAIqU",
  authDomain: "trace-ai-b9cba.firebaseapp.com",
  projectId: "trace-ai-b9cba",
  appId: "1:722122110487:web:b1fd26b156c5e588664e52",
};

export const firebaseAuth = () => getAuth(getApps().length ? getApp() : initializeApp(config));
