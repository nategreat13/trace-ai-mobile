import { initializeApp } from "firebase/app";
import { initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// @ts-ignore – react-native persistence
import { getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyBAJ72VgZaZGm6QDsTDn_6bpg3umhDAIqU",
  authDomain: "trace-ai-b9cba.firebaseapp.com",
  projectId: "trace-ai-b9cba",
  storageBucket: "trace-ai-b9cba.firebasestorage.app",
  messagingSenderId: "722122110487",
  appId: "1:722122110487:web:b1fd26b156c5e588664e52",
  measurementId: "G-0WJNNY2HZ9",
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
