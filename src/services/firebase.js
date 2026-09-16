import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDyyXLuVJGAML75LdkIX_YHXtb2LFyPQ4I",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "uchat-15232.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "uchat-15232",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "uchat-15232.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "700394185202",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:700394185202:web:3ecb452860c0138168cb6b"
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.apiKey !== 'your-api-key-here' &&
  !firebaseConfig.apiKey.includes('your-')
);

let app = null;
let auth = null;
let db = null;
let storage = null;

if (isFirebaseConfigured) {
  try {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
}

export { app, auth, db, storage, firebaseConfig };
