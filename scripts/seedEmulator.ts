/**
 * Seeds the local Firestore emulator with synthetic user profiles, optionally
 * promotes one emulator user to admin, then runs seedUsersRbac to fill missing
 * role/status defaults (a missing status becomes 'pending').
 *
 * Emulator only: refuses to run unless FIRESTORE_EMULATOR_HOST is set, and
 * always targets the demo-sbhra project. See docs/firebase/EMULATOR.md.
 *
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run seed:emulator
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 SEED_ADMIN_UID=<uid> npm run seed:emulator
 */
import { doc, getDoc, setDoc, updateDoc, type Firestore } from 'firebase/firestore';

export const SEED_PROJECT_ID = 'demo-sbhra';

type Env = Record<string, string | undefined>;
type SeedUsers = (db: Firestore) => Promise<unknown>;

export function assertEmulator(env: Env = process.env) {
  if (!env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('Refusing to seed: FIRESTORE_EMULATOR_HOST is not set. This script only runs against the local emulator.');
  }
}

// Synthetic profiles with no Auth accounts behind them.
const fixtures: Record<string, Record<string, unknown>> = {
  'seed-admin': { displayName: 'Seed Admin', email: 'admin@sbhra.test', role: 'admin', status: 'approved' },
  'seed-member': { displayName: 'Seed Member', email: 'member@sbhra.test', role: 'member', status: 'approved' },
  'seed-pending': { displayName: 'Seed Pending', email: 'pending@sbhra.test', role: 'member', status: 'pending' },
  // Legacy shape with no role/status, for seedUsersRbac to normalize.
  'seed-legacy': { displayName: 'Seed Legacy', email: 'Legacy@sbhra.test' },
};

/** db must bypass the rules (rules-unit-testing withSecurityRulesDisabled). */
export async function seedEmulator(db: Firestore, seedUsers: SeedUsers, env: Env = process.env) {
  assertEmulator(env);
  const now = Date.now();
  for (const [uid, data] of Object.entries(fixtures)) {
    await setDoc(doc(db, 'users', uid), {
      createdAt: now,
      updatedAt: now,
      totalRides: 0,
      totalDistanceM: 0,
      totalDurationMs: 0,
      points: 0,
      ...data,
    });
  }

  // First-admin bootstrap for a user who signed up in the app against the emulator.
  const adminUid = env.SEED_ADMIN_UID;
  if (adminUid) {
    const ref = doc(db, 'users', adminUid);
    if (!(await getDoc(ref)).exists()) {
      throw new Error(`SEED_ADMIN_UID ${adminUid} has no users/{uid} profile; sign up in the app first.`);
    }
    await updateDoc(ref, { role: 'admin', status: 'approved', updatedAt: now });
  }

  await seedUsers(db);
}

async function main() {
  assertEmulator();
  // The app's firebase module needs Expo/React Native. The seed passes its own
  // emulator Firestore, so stand in an empty module before loading the service.
  const firebaseModule = require.resolve('../services/firebase');
  require.cache[firebaseModule] = {
    id: firebaseModule,
    filename: firebaseModule,
    loaded: true,
    exports: { app: undefined, auth: undefined, firestore: undefined, FIREBASE_ENABLED: false },
  } as unknown as NodeJS.Module;
  const { seedUsersRbac } = require('../services/FirebaseUserService') as typeof import('../services/FirebaseUserService');
  const { initializeTestEnvironment } = require('@firebase/rules-unit-testing') as typeof import('@firebase/rules-unit-testing');

  const testEnv = await initializeTestEnvironment({ projectId: SEED_PROJECT_ID });
  try {
    await testEnv.withSecurityRulesDisabled((ctx) =>
      seedEmulator(ctx.firestore() as unknown as Firestore, (db) => seedUsersRbac(db))
    );
    console.log(`Seeded ${Object.keys(fixtures).length} users in ${SEED_PROJECT_ID} at ${process.env.FIRESTORE_EMULATOR_HOST}`);
  } finally {
    await testEnv.cleanup();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
