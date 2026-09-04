import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { initializeAuth, getAuth, getReactNativePersistence, type Auth } from "firebase/auth";
import { initializeFirestore, getFirestore, type Firestore } from "firebase/firestore";
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Access Firebase config from expo-constants (set in app.config.ts)
const extraSource =
  (Constants.expoConfig?.extra as Record<string, any> | undefined)
  ?? (Constants.manifest2?.extra as Record<string, any> | undefined)
  ?? (Constants.manifest?.extra as Record<string, any> | undefined)
  ?? {};

const FIREBASE_API_KEY = extraSource.FIREBASE_API_KEY;
const FIREBASE_AUTH_DOMAIN = extraSource.FIREBASE_AUTH_DOMAIN;
const FIREBASE_PROJECT_ID = extraSource.FIREBASE_PROJECT_ID;
const FIREBASE_STORAGE_BUCKET = extraSource.FIREBASE_STORAGE_BUCKET;
const FIREBASE_MESSAGING_SENDER_ID = extraSource.FIREBASE_MESSAGING_SENDER_ID;
const FIREBASE_APP_ID = extraSource.FIREBASE_APP_ID;

const firebaseConfig = {
  apiKey: FIREBASE_API_KEY,
  authDomain: FIREBASE_AUTH_DOMAIN,
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: FIREBASE_STORAGE_BUCKET,
  messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
  appId: FIREBASE_APP_ID,
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

try {
  if (hasAllEnv) {
    // Avoid double init during fast refresh / re-renders
    appInstance = getApps().length ? getApp() : initializeApp(firebaseConfig);
    
    // Initialize Auth with React Native persistence
    try {
      authInstance = initializeAuth(appInstance, {
        persistence: getReactNativePersistence(AsyncStorage)
      });
    } catch (authError: any) {
      // Auth may already be initialized
      if (authError.code === 'auth/already-initialized') {
        authInstance = getAuth(appInstance);
      } else {
        throw authError;
      }
    }
    
    // Initialize Firestore
    // Configure Firestore before any consumer calls getFirestore.
    try {
      firestoreInstance = initializeFirestore(appInstance, {
        experimentalForceLongPolling: true,
      });
    } catch (error: any) {
      if (error.code !== 'failed-precondition') throw error;
      // Fast Refresh can preserve an already initialized SDK instance.
      firestoreInstance = getFirestore(appInstance);
    }
    
  } else if (__DEV__) {
    // Only spam in dev
    console.warn('[Firebase] Missing Firebase config -> Firebase disabled. Missing:', missingKeys.join(', '));
  }
} catch (e) {
  console.warn('[Firebase] Initialization failed, Firebase disabled.', e);
  appInstance = undefined;
  authInstance = undefined;
  firestoreInstance = undefined;
}

export const app = appInstance;
export const FIREBASE_ENABLED = !!appInstance;
export const auth = authInstance as Auth | undefined;
export const firestore = firestoreInstance as Firestore | undefined;

// Small helper to aid debugging at runtime (can be tree-shaken in prod)
if (__DEV__) {
  // Delay log a tick so metro logs stay readable
  setTimeout(() => {
    // eslint-disable-next-line no-console
    console.log('[Firebase] Enabled:', FIREBASE_ENABLED, 'AppInitialized:', !!appInstance);
  }, 0);
}