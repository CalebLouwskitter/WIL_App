// Centralized Firestore initialization (optional)
// If Firebase isn't enabled (missing env vars) the exported "firestore" will be undefined.
// This also attempts a React Native friendly fallback with long polling.

import { FIREBASE_ENABLED, app } from './firebase';
import type { Firestore } from 'firebase/firestore';
import { initializeFirestore, getFirestore } from 'firebase/firestore';

let db: Firestore | undefined;

try {
  if (!FIREBASE_ENABLED || !app) {
    if (__DEV__) console.warn('[Firebase] Firestore disabled: Firebase not enabled or app missing');
    db = undefined;
  } else {
    try {
      // Prefer RN-friendly long polling in Expo
      db = initializeFirestore(app as any, {
        experimentalForceLongPolling: true,
        useFetchStreams: false,
      } as any);
      if (__DEV__) console.log('[Firebase] Firestore initialized (long polling)');
    } catch (e) {
      if (__DEV__) console.warn('[Firebase] initializeFirestore failed, falling back to getFirestore:', e);
      db = getFirestore(app as any);
      if (__DEV__) console.log('[Firebase] Firestore initialized (fallback getFirestore)');
    }
  }
} catch (e) {
  if (__DEV__) console.warn('[Firebase] Firestore initialization error:', e);
  db = undefined;
}

export const firestore = db;
