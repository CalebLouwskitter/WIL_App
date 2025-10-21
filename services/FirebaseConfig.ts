import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence, type Auth } from "firebase/auth";   
import { getFirestore, type Firestore } from "firebase/firestore";
import { getDatabase, type Database } from "firebase/database";
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Access Firebase config from expo-constants (set in app.config.ts)
const extra = Constants.expoConfig?.extra ?? {};

const FIREBASE_API_KEY = extra.FIREBASE_API_KEY;
const FIREBASE_AUTH_DOMAIN = extra.FIREBASE_AUTH_DOMAIN;
const FIREBASE_PROJECT_ID = extra.FIREBASE_PROJECT_ID;
const FIREBASE_STORAGE_BUCKET = extra.FIREBASE_STORAGE_BUCKET;
const FIREBASE_MESSAGING_SENDER_ID = extra.FIREBASE_MESSAGING_SENDER_ID;
const FIREBASE_APP_ID = extra.FIREBASE_APP_ID;
const FIREBASE_DATABASE_URL = extra.FIREBASE_DATABASE_URL || 'https://sardinabay-default-rtdb.europe-west1.firebasedatabase.app';

const firebaseConfig = {
  apiKey: FIREBASE_API_KEY,
  authDomain: FIREBASE_AUTH_DOMAIN,
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: FIREBASE_STORAGE_BUCKET,
  messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
  appId: FIREBASE_APP_ID,
  databaseURL: FIREBASE_DATABASE_URL, // Add this for Realtime Database
};

const envMap: Record<string, any> = {
  FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID,
};

const missingKeys = Object.entries(envMap)
  .filter(([, v]) => !(typeof v === 'string' && v.length > 0))
  .map(([k]) => k);

const hasAllEnv = missingKeys.length === 0;

let appInstance: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let firestoreInstance: Firestore | undefined;
let databaseInstance: Database | undefined;

try {
  if (hasAllEnv) {
    // Avoid double init during fast refresh / re-renders
    appInstance = getApps().length ? getApp() : initializeApp(firebaseConfig);
    
    // Initialize Auth with React Native persistence
    try {
      authInstance = initializeAuth(appInstance, {
        persistence: getReactNativePersistence(AsyncStorage as any)
      });
    } catch (authError: any) {
      // Auth may already be initialized
      if (authError.code === 'auth/already-initialized') {
        const { getAuth } = require('firebase/auth');
        authInstance = getAuth(appInstance);
      } else {
        throw authError;
      }
    }
    
    // Initialize Firestore
    firestoreInstance = getFirestore(appInstance);
    
    // Initialize Realtime Database with correct URL
    databaseInstance = getDatabase(appInstance, FIREBASE_DATABASE_URL);
    
  } else if (__DEV__) {
    // Only spam in dev
    console.warn('[Firebase] Missing Firebase config -> Firebase disabled. Missing:', missingKeys.join(', '));
  }
} catch (e) {
  console.warn('[Firebase] Initialization failed, Firebase disabled.', e);
  appInstance = undefined;
  authInstance = undefined;
  firestoreInstance = undefined;
  databaseInstance = undefined;
}

export const app = appInstance;
export const FIREBASE_ENABLED = !!appInstance;
export const auth = authInstance as Auth | undefined;
export const firestore = firestoreInstance as Firestore | undefined;
export const database = databaseInstance as Database | undefined;

// Small helper to aid debugging at runtime (can be tree-shaken in prod)
if (__DEV__) {
  // Delay log a tick so metro logs stay readable
  setTimeout(() => {
    // eslint-disable-next-line no-console
    console.log('[Firebase] Enabled:', FIREBASE_ENABLED, 'AppInitialized:', !!appInstance);
    console.log('[Firebase] Database URL:', FIREBASE_DATABASE_URL);
  }, 0);
}