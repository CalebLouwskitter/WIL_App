/**
 * The real Data.ts / FirebaseUserService paths against the emulator, as a
 * signed-in client subject to firestore.rules. Run with `npm run test:emulator`.
 */
import * as fs from 'fs';
import * as path from 'path';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { createUserWithEmailAndPassword, signOut, type Auth } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  setLogLevel,
  where,
  type Firestore,
} from 'firebase/firestore';

// Fail the next N achievement writes (simulates a crash/denial after the ride commit).
const mockAwardFailures = { remaining: 0 };
jest.mock('firebase/firestore', () => {
  const actual = jest.requireActual('firebase/firestore');
  return {
    ...actual,
    setDoc: (ref: { path: string }, ...rest: unknown[]) => {
      if (mockAwardFailures.remaining > 0 && ref.path.startsWith('achievements/')) {
        mockAwardFailures.remaining -= 1;
        return Promise.reject(new Error('injected award failure'));
      }
      return actual.setDoc(ref, ...rest);
    },
  };
});

// The app's firebase module, connected to the emulators instead of Expo config.
jest.mock('../services/firebase', () => {
  const { initializeApp } = require('firebase/app');
  const { getAuth, connectAuthEmulator } = require('firebase/auth');
  const { getFirestore, connectFirestoreEmulator } = require('firebase/firestore');
  const app = initializeApp({ projectId: 'demo-sbhra', apiKey: 'demo-api-key' }, 'data-test');
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  const [host, port] = String(process.env.FIRESTORE_EMULATOR_HOST).split(':');
  const firestore = getFirestore(app);
  connectFirestoreEmulator(firestore, host, Number(port));
  return { app, auth, firestore, FIREBASE_ENABLED: true };
});

import { auth as appAuth } from '../services/firebase';
import {
  getOrCreateUserProfile,
  listUserAchievements,
  newRide,
  recalcUserAggregates,
  saveRideAndUpdateAggregates,
} from '../services/Data';
import { getUser, seedUsersRbac } from '../services/FirebaseUserService';
import { seedEmulator } from '../scripts/seedEmulator';

const auth = appAuth as Auth;
let testEnv: RulesTestEnvironment;

const asAdminDb = <T>(fn: (db: Firestore) => Promise<T>) => {
  let result: T;
  return testEnv
    .withSecurityRulesDisabled(async (ctx) => {
      result = await fn(ctx.firestore() as unknown as Firestore);
    })
    .then(() => result);
};
const readUser = (uid: string) => asAdminDb(async (db) => (await getDoc(doc(db, 'users', uid))).data());

// A fresh signed-in emulator account; the password is random and never reused.
const signUp = async (label: string) => {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@sbhra.test`;
  const cred = await createUserWithEmailAndPassword(auth, email, `pw-${Math.random().toString(36).slice(2)}`);
  return cred.user;
};

const ride = (id: string, userId: string, over: object = {}) =>
  newRide({
    id,
    userId,
    startTime: new Date(2026, 0, 10, 10, 0).getTime(), // 10:00 local, not early-bird
    endTime: new Date(2026, 0, 10, 10, 10).getTime(),
    totalDistance: 1600,
    duration: 600_000,
    ...over,
  });

// The stored shape of a ride (the document id is not a field).
const rideDoc = (id: string, userId: string, over: object = {}) => {
  const { id: _id, ...data } = ride(id, userId, over);
  return data;
};

beforeAll(async () => {
  setLogLevel('error');
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-sbhra',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8') },
  });
});

afterAll(async () => {
  await signOut(auth);
  await testEnv?.cleanup();
});

beforeEach(async () => {
  mockAwardFailures.remaining = 0;
  await testEnv.clearFirestore();
});

describe('recalcUserAggregates (DATA-02)', () => {
  it('keeps a populated admin\'s identity, role, status and createdAt', async () => {
    const user = await signUp('admin');
    const original = {
      displayName: 'Populated Admin',
      email: user.email,
      emailLower: user.email,
      photoURL: 'https://example.test/a.jpg',
      role: 'admin',
      status: 'approved',
      createdAt: 1_234_567,
      updatedAt: 1_234_567,
      expoPushToken: 'ExponentPushToken[test]',
      totalRides: 0,
      totalDistanceM: 0,
      totalDurationMs: 0,
      points: 0,
    };
    await asAdminDb(async (db) => {
      await setDoc(doc(db, 'users', user.uid), original);
      await setDoc(doc(db, 'rides', 'a1'), rideDoc('a1', user.uid, { totalDistance: 2500 }));
      await setDoc(doc(db, 'rides', 'a2'), rideDoc('a2', user.uid, { totalDistance: 1000 }));
    });

    await recalcUserAggregates(user.uid);

    const after = await readUser(user.uid);
    for (const key of ['displayName', 'email', 'emailLower', 'photoURL', 'role', 'status', 'createdAt', 'expoPushToken'] as const) {
      expect({ key, value: after?.[key] }).toEqual({ key, value: original[key] });
    }
    expect(after).toMatchObject({ totalRides: 2, totalDistanceM: 3500, totalDurationMs: 1_200_000, points: 24 });
  });

  it('is denied to a member', async () => {
    const user = await signUp('member');
    await asAdminDb((db) => setDoc(doc(db, 'users', user.uid), { role: 'member', status: 'approved', createdAt: 1, updatedAt: 1, totalRides: 3, totalDistanceM: 0, totalDurationMs: 0, points: 30 }));
    await expect(recalcUserAggregates(user.uid)).rejects.toThrow();
    expect(await readUser(user.uid)).toMatchObject({ totalRides: 3 });
  });
});

describe('saveRideAndUpdateAggregates (DATA-03)', () => {
  it('gives one ride, one increment and eventually one award when the first award write fails', async () => {
    const user = await signUp('rider');
    await asAdminDb((db) =>
      setDoc(doc(db, 'users', user.uid), { displayName: 'Rider', role: 'member', status: 'approved', createdAt: 1, updatedAt: 1, totalRides: 0, totalDistanceM: 0, totalDurationMs: 0, points: 0 })
    );
    const r = ride('ride-1', user.uid);

    mockAwardFailures.remaining = 1;
    await expect(saveRideAndUpdateAggregates(r)).rejects.toThrow('injected award failure');
    expect(await readUser(user.uid)).toMatchObject({ totalRides: 1, lastRideId: 'ride-1' });
    expect(await listUserAchievements(user.uid)).toEqual([]);

    // RideStorage keeps the ride pending and retries it; the retry takes the
    // already-saved path and fills in the missing award.
    await saveRideAndUpdateAggregates(r);
    await saveRideAndUpdateAggregates(r);

    const rides = await asAdminDb((db) => getDocs(query(collection(db, 'rides'), where('userId', '==', user.uid))));
    expect(rides.size).toBe(1);
    expect(await readUser(user.uid)).toMatchObject({
      totalRides: 1,
      totalDistanceM: 1600,
      totalDurationMs: 600_000,
      points: 12,
      role: 'member',
      status: 'approved',
      createdAt: 1,
    });
    const awards = await listUserAchievements(user.uid);
    expect(awards.map((a) => a.id)).toEqual(['first-ride']);
    expect(awards[0]).toMatchObject({ userId: user.uid, meta: { rideId: 'ride-1' } });
  });

  it('creates a missing profile as a pending member with the first ride', async () => {
    const user = await signUp('noprofile');
    await saveRideAndUpdateAggregates(ride('ride-2', user.uid));
    expect(await readUser(user.uid)).toMatchObject({ role: 'member', status: 'pending', totalRides: 1, points: 12, lastRideId: 'ride-2' });
  });
});

describe('profile reads (F09 / DATA-02)', () => {
  it('does not patch an existing profile that has no role or status', async () => {
    const user = await signUp('legacy');
    const legacy = { displayName: 'Legacy', email: user.email, createdAt: 1, updatedAt: 1 };
    await asAdminDb((db) => setDoc(doc(db, 'users', user.uid), legacy));

    const profile = await getOrCreateUserProfile(user);
    expect(profile).toMatchObject({ role: 'member', status: 'pending' });
    const viaGetUser = await getUser(user.uid);
    expect(viaGetUser).toMatchObject({ role: 'member', status: 'pending' });

    expect(await readUser(user.uid)).toEqual(legacy);
  });

  it('creates a new profile as a pending member', async () => {
    const user = await signUp('newbie');
    await getOrCreateUserProfile(user);
    expect(await readUser(user.uid)).toMatchObject({ role: 'member', status: 'pending', totalRides: 0 });
  });
});

describe('scripts/seedEmulator', () => {
  it('refuses to run without FIRESTORE_EMULATOR_HOST', async () => {
    const seedUsers = jest.fn();
    await expect(asAdminDb((db) => seedEmulator(db, seedUsers, {}))).rejects.toThrow(/FIRESTORE_EMULATOR_HOST/);
    expect(seedUsers).not.toHaveBeenCalled();
  });

  it('defaults a missing status to pending and can bootstrap one admin', async () => {
    await asAdminDb((db) => setDoc(doc(db, 'users', 'signed-up'), { role: 'member', status: 'pending', createdAt: 1, updatedAt: 1 }));
    await asAdminDb((db) =>
      seedEmulator(db, (d) => seedUsersRbac(d), { FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST, SEED_ADMIN_UID: 'signed-up' })
    );
    expect(await readUser('seed-legacy')).toMatchObject({ role: 'member', status: 'pending', emailLower: 'legacy@sbhra.test' });
    expect(await readUser('signed-up')).toMatchObject({ role: 'admin', status: 'approved' });
    expect(await readUser('seed-pending')).toMatchObject({ status: 'pending' });
  });
});
