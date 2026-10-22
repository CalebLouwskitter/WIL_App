import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence, connectAuthEmulator, type Auth } from "firebase/auth";   
import { initializeFirestore, getFirestore, connectFirestoreEmulator, type Firestore } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
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

// Local emulator mode (see docs/firebase/EMULATOR.md). Dev builds only, and
// only when explicitly turned on. It always uses the demo-sbhra project, which
// the emulator never connects to a real Firebase project.
const USE_EMULATOR = __DEV__ && extra.FIREBASE_USE_EMULATOR === 'true';
const EMULATOR_HOST =
  typeof extra.FIREBASE_EMULATOR_HOST === 'string' && extra.FIREBASE_EMULATOR_HOST.length > 0
    ? extra.FIREBASE_EMULATOR_HOST
    : '127.0.0.1';
const EMULATOR_PROJECT_ID = 'demo-sbhra';
// Ports match firebase.json
const EMULATOR_PORTS = { auth: 9099, firestore: 8080, storage: 9199 };

const firebaseConfig = USE_EMULATOR
  ? {
      apiKey: 'demo-api-key', // placeholder; the emulator does not check it
      authDomain: `${EMULATOR_PROJECT_ID}.firebaseapp.com`,
      projectId: EMULATOR_PROJECT_ID,
      storageBucket: `${EMULATOR_PROJECT_ID}.appspot.com`,
      messagingSenderId: '000000000000',
      appId: '1:000000000000:web:demo',
    }
  : {
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

const hasAllEnv = USE_EMULATOR || missingKeys.length === 0;

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
    
    // Firestore must be initialised here, before anything calls getFirestore(),
    // or the React Native long-polling settings are silently ignored.
    try {
      firestoreInstance = initializeFirestore(appInstance, {
        experimentalForceLongPolling: true,
      });
    } catch {
      // Already initialised (fast refresh)
      firestoreInstance = getFirestore(appInstance);
    }

    if (USE_EMULATOR && authInstance) {
      // connect* throws if called twice on one instance (fast refresh); the
      // first connection is still in place then.
      try {
        connectAuthEmulator(authInstance, `http://${EMULATOR_HOST}:${EMULATOR_PORTS.auth}`, { disableWarnings: true });
      } catch {}
      try {
        connectFirestoreEmulator(firestoreInstance, EMULATOR_HOST, EMULATOR_PORTS.firestore);
      } catch {}
      try {
        connectStorageEmulator(getStorage(appInstance), EMULATOR_HOST, EMULATOR_PORTS.storage);
      } catch {}
      console.log('[Firebase] Using local emulators at', EMULATOR_HOST, 'project', EMULATOR_PROJECT_ID);
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
export const FIREBASE_EMULATOR = USE_EMULATOR && !!appInstance;
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
