/**
 * Firebase Connection Verification Utility
 * 
 * This utility provides comprehensive checks for Firebase connectivity
 * and helps diagnose connection issues.
 */

import { FIREBASE_ENABLED, auth, firestore, app } from './firebase';

export interface FirebaseConnectionStatus {
  isConfigured: boolean;
  isAppInitialized: boolean;
  isAuthAvailable: boolean;
  isFirestoreAvailable: boolean;
  currentUser: {
    uid: string | null;
    email: string | null;
    displayName: string | null;
    isAuthenticated: boolean;
  } | null;
  errors: string[];
  warnings: string[];
}

/**
 * Performs a comprehensive check of Firebase connections
 * @returns FirebaseConnectionStatus object with detailed information
 */
export async function checkFirebaseConnection(): Promise<FirebaseConnectionStatus> {
  const status: FirebaseConnectionStatus = {
    isConfigured: FIREBASE_ENABLED,
    isAppInitialized: !!app,
    isAuthAvailable: !!auth,
    isFirestoreAvailable: !!firestore,
    currentUser: null,
    errors: [],
    warnings: [],
  };

  // Check configuration
  if (!FIREBASE_ENABLED) {
    status.errors.push('Firebase is not enabled. Check your .env file for missing configuration.');
    return status;
  }

  // Check app initialization
  if (!app) {
    status.errors.push('Firebase app failed to initialize. Check your Firebase config values.');
    return status;
  }

  // Check auth availability
  if (!auth) {
    status.warnings.push('Firebase Auth is not available. Authentication features will not work.');
  } else {
    // Get current user info
    const user = auth.currentUser;
    if (user) {
      status.currentUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        isAuthenticated: true,
      };
    } else {
      status.currentUser = {
        uid: null,
        email: null,
        displayName: null,
        isAuthenticated: false,
      };
    }
  }

  // Check Firestore availability
  if (!firestore) {
    status.warnings.push('Firestore is not available. Database features will not work.');
  } else {
    // Test Firestore connectivity
    try {
      const { getDoc, doc } = await import('firebase/firestore');
      // Try to read a test document (this will fail gracefully if it doesn't exist)
      const testRef = doc(firestore, '_connection_test', 'test');
      await getDoc(testRef);
      // If we get here, Firestore is working
    } catch (error: any) {
      if (error.code === 'permission-denied' || error.code === 'not-found') {
        // These are expected errors - means Firestore is connected
      } else {
        status.warnings.push(`Firestore connectivity issue: ${error.message}`);
      }
    }
  }

  return status;
}

/**
 * Logs Firebase connection status to console (dev only)
 */
export async function logFirebaseStatus() {
  if (!__DEV__) return;

  const status = await checkFirebaseConnection();
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔥 FIREBASE CONNECTION STATUS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✓ Configured: ${status.isConfigured ? '✅' : '❌'}`);
  console.log(`✓ App Initialized: ${status.isAppInitialized ? '✅' : '❌'}`);
  console.log(`✓ Auth Available: ${status.isAuthAvailable ? '✅' : '❌'}`);
  console.log(`✓ Firestore Available: ${status.isFirestoreAvailable ? '✅' : '❌'}`);
  
  if (status.currentUser) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 CURRENT USER');
    console.log(`  Authenticated: ${status.currentUser.isAuthenticated ? '✅' : '❌'}`);
    if (status.currentUser.isAuthenticated) {
      console.log(`  UID: ${status.currentUser.uid}`);
      console.log(`  Email: ${status.currentUser.email || 'N/A'}`);
      console.log(`  Display Name: ${status.currentUser.displayName || 'N/A'}`);
    }
  }

  if (status.errors.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('❌ ERRORS');
    status.errors.forEach(err => console.log(`  • ${err}`));
  }

  if (status.warnings.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  WARNINGS');
    status.warnings.forEach(warn => console.log(`  • ${warn}`));
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  return status;
}

/**
 * Gets environment configuration status
 */
export function getEnvStatus() {
  const envVars = [
    'FIREBASE_API_KEY',
    'FIREBASE_AUTH_DOMAIN',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_STORAGE_BUCKET',
    'FIREBASE_MESSAGING_SENDER_ID',
    'FIREBASE_APP_ID',
  ];

  const status: Record<string, boolean> = {};
  
  // We can't directly access env vars here due to bundling,
  // but we can check if Firebase is enabled as a proxy
  return {
    allConfigured: FIREBASE_ENABLED,
    requiredVars: envVars,
    message: FIREBASE_ENABLED 
      ? 'All Firebase environment variables are configured'
      : 'Some Firebase environment variables are missing. Check your .env file.',
  };
}
