// Centralized Firestore initialization (optional)
// If Firebase isn't enabled (missing env vars) the exported "firestore" will be undefined.
// This also attempts a React Native friendly fallback with long polling.

import { FIREBASE_ENABLED, app } from './firebase';
import type { Firestore } from 'firebase/firestore';
import { initializeFirestore } from 'firebase/firestore';

let db: Firestore | undefined;

try {
  if (FIREBASE_ENABLED && app) {
    // For Expo Go on SDK 53, long polling is the most reliable path
    db = initializeFirestore(app as any, {
      experimentalForceLongPolling: true,
      useFetchStreams: false,
    } as any);
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[Firebase] Firestore initialized with long polling');
    }
  }
} catch (e) {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn('[Firebase] Firestore initialization failed:', e);
  }
  db = undefined;
}

export const firestore = db;
