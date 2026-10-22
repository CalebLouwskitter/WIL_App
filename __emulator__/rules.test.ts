/**
 * Firestore and Storage rules against the local emulator (demo-sbhra).
 * Run with `npm run test:emulator`.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  setLogLevel,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-sbhra';
const root = path.join(__dirname, '..');

let testEnv: RulesTestEnvironment;

const ADMIN = 'admin-uid';
const MEMBER = 'member-uid';
const OTHER = 'other-uid';
const PENDING = 'pending-uid';

const profile = (over: Record<string, unknown> = {}) => ({
  displayName: 'Test Rider',
  email: 'rider@example.test',
  role: 'member',
  status: 'approved',
  createdAt: 1_000,
  updatedAt: 1_000,
  totalRides: 0,
  totalDistanceM: 0,
  totalDurationMs: 0,
  points: 0,
  ...over,
});

const ride = (userId: string, over: Record<string, unknown> = {}) => ({
  userId,
  startTime: 1_700_000_000_000,
  endTime: 1_700_000_600_000,
  totalDistance: 1600,
  elevationGain: 5,
  duration: 600_000,
  path: [],
  createdAt: 1_700_000_600_000,
  updatedAt: 1_700_000_600_000,
  ...over,
});

const db = (ctx: RulesTestContext) => ctx.firestore() as unknown as Firestore;
const as = (uid: string) => db(testEnv.authenticatedContext(uid));
const anon = () => db(testEnv.unauthenticatedContext());

const seed = (fn: (db: Firestore) => Promise<unknown>) =>
  testEnv.withSecurityRulesDisabled(async (ctx) => {
    await fn(db(ctx));
  });

beforeAll(async () => {
  // Denied writes are expected here; keep the SDK from logging each one.
  setLogLevel('error');
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8') },
    storage: { rules: fs.readFileSync(path.join(root, 'storage.rules'), 'utf8') },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(async (d) => {
    await setDoc(doc(d, 'users', ADMIN), profile({ role: 'admin', status: 'approved' }));
    await setDoc(doc(d, 'users', MEMBER), profile());
    await setDoc(doc(d, 'users', OTHER), profile());
    await setDoc(doc(d, 'users', PENDING), profile({ status: 'pending' }));
  });
});

describe('users/{uid}', () => {
  it('denies unauthenticated reads and writes', async () => {
    await assertFails(getDoc(doc(anon(), 'users', MEMBER)));
    await assertFails(setDoc(doc(anon(), 'users', 'nobody'), profile({ status: 'pending' })));
  });

  it('lets a new user create only a pending member profile with zero totals', async () => {
    const d = as('new-uid');
    const ref = doc(d, 'users', 'new-uid');
    await assertFails(setDoc(ref, profile({ role: 'admin', status: 'pending' })));
    await assertFails(setDoc(ref, profile({ status: 'approved' })));
    await assertFails(setDoc(ref, profile({ status: 'pending', totalRides: 5, points: 50 })));
    await assertFails(setDoc(ref, profile({ status: 'pending', lastRideId: 'nope' })));
    await assertSucceeds(setDoc(ref, profile({ status: 'pending' })));
  });

  it('denies creating a profile for someone else', async () => {
    await assertFails(setDoc(doc(as(MEMBER), 'users', 'someone-else'), profile({ status: 'pending' })));
  });

  it('denies self-promotion and self-approval', async () => {
    await assertFails(updateDoc(doc(as(MEMBER), 'users', MEMBER), { role: 'admin' }));
    await assertFails(updateDoc(doc(as(PENDING), 'users', PENDING), { status: 'approved' }));
    await assertFails(updateDoc(doc(as(MEMBER), 'users', MEMBER), { createdAt: 5 }));
  });

  it('lets the owner edit profile, email and push-token fields', async () => {
    await assertSucceeds(
      updateDoc(doc(as(MEMBER), 'users', MEMBER), {
        displayName: 'New Name',
        emailLower: 'rider@example.test',
        expoPushToken: 'ExponentPushToken[test]',
        expoPushTokenUpdatedAt: serverTimestamp(),
        updatedAt: 2_000,
      })
    );
  });

  it('keeps profiles private between members', async () => {
    await assertFails(getDoc(doc(as(MEMBER), 'users', OTHER)));
    await assertFails(updateDoc(doc(as(MEMBER), 'users', OTHER), { displayName: 'x' }));
  });

  it('lets an admin read, approve and promote', async () => {
    await assertSucceeds(getDocs(collection(as(ADMIN), 'users')));
    await assertSucceeds(updateDoc(doc(as(ADMIN), 'users', PENDING), { status: 'approved' }));
    await assertSucceeds(updateDoc(doc(as(ADMIN), 'users', MEMBER), { role: 'admin' }));
  });

  it('denies members listing all users', async () => {
    await assertFails(getDocs(collection(as(MEMBER), 'users')));
  });
});

describe('ride aggregates contract', () => {
  const increment = (rideId: string, over: Record<string, unknown> = {}) => ({
    totalRides: 1,
    totalDistanceM: 1600,
    totalDurationMs: 600_000,
    points: 1 * 10 + Math.round(1600 / 1000),
    lastRideId: rideId,
    updatedAt: 2_000,
    ...over,
  });

  it('accepts +1 ride with the matching new ride in the same write', async () => {
    const d = as(MEMBER);
    const batch = writeBatch(d);
    batch.set(doc(d, 'rides', 'r1'), ride(MEMBER));
    batch.update(doc(d, 'users', MEMBER), increment('r1'));
    await assertSucceeds(batch.commit());
  });

  it('rejects an increment whose ride is not created by the write', async () => {
    const d = as(MEMBER);
    await assertFails(updateDoc(doc(d, 'users', MEMBER), increment('missing-ride')));
    await seed((s) => setDoc(doc(s, 'rides', 'old-ride'), ride(MEMBER)));
    await assertFails(updateDoc(doc(d, 'users', MEMBER), increment('old-ride')));
  });

  it('rejects inflated totals, points or ride counts', async () => {
    for (const over of [
      { totalRides: 2 },
      { points: 1000 },
      { totalDistanceM: 99_999 },
      { totalDurationMs: 1 },
    ]) {
      const d = as(MEMBER);
      const batch = writeBatch(d);
      batch.set(doc(d, 'rides', 'r-bad'), ride(MEMBER));
      batch.update(doc(d, 'users', MEMBER), increment('r-bad', over));
      await assertFails(batch.commit());
    }
  });

  it('rejects aggregate changes without a ride', async () => {
    await assertFails(updateDoc(doc(as(MEMBER), 'users', MEMBER), { points: 500 }));
  });

  it('rejects crediting a ride owned by someone else', async () => {
    const d = as(MEMBER);
    const batch = writeBatch(d);
    batch.set(doc(d, 'rides', 'r-foreign'), ride(OTHER));
    batch.update(doc(d, 'users', MEMBER), increment('r-foreign'));
    await assertFails(batch.commit());
  });

  it('allows creating a missing profile together with the first ride', async () => {
    const d = as('fresh-uid');
    const batch = writeBatch(d);
    batch.set(doc(d, 'rides', 'r-first'), ride('fresh-uid'));
    batch.set(doc(d, 'users', 'fresh-uid'), {
      ...profile({ status: 'pending' }),
      ...increment('r-first'),
    });
    await assertSucceeds(batch.commit());
  });

  it('lets an admin rewrite aggregates directly', async () => {
    await assertSucceeds(updateDoc(doc(as(ADMIN), 'users', MEMBER), { totalRides: 7, points: 70 }));
  });
});

describe('rides', () => {
  it('denies creating or reassigning a ride for another user', async () => {
    await assertFails(setDoc(doc(as(MEMBER), 'rides', 'r-other'), ride(OTHER)));
    await seed((s) => setDoc(doc(s, 'rides', 'r-mine'), ride(MEMBER)));
    await assertFails(updateDoc(doc(as(MEMBER), 'rides', 'r-mine'), { userId: OTHER }));
    await assertFails(updateDoc(doc(as(MEMBER), 'rides', 'r-mine'), { totalDistance: 99_000 }));
  });

  it('lets the owner query their rides and check for a missing ride', async () => {
    await seed((s) => setDoc(doc(s, 'rides', 'r-mine'), ride(PENDING)));
    await assertSucceeds(getDocs(query(collection(as(PENDING), 'rides'), where('userId', '==', PENDING))));
    await assertSucceeds(getDoc(doc(as(PENDING), 'rides', 'does-not-exist')));
    await assertFails(getDocs(collection(as(PENDING), 'rides')));
    await assertFails(getDocs(collection(anon(), 'rides')));
  });

  it('denies members deleting rides', async () => {
    await seed((s) => setDoc(doc(s, 'rides', 'r-mine'), ride(MEMBER)));
    await assertFails(deleteDoc(doc(as(MEMBER), 'rides', 'r-mine')));
  });
});

describe('horses, sightings and read state', () => {
  const horse = (userId: string) => ({ userId, name: 'Star', createdAt: 1, updatedAt: 1 });

  it('allows owner CRUD on nested horses only', async () => {
    const mine = doc(as(MEMBER), 'users', MEMBER, 'horses', 'h1');
    await assertSucceeds(setDoc(mine, horse(MEMBER)));
    await assertSucceeds(getDoc(mine));
    await assertFails(setDoc(doc(as(MEMBER), 'users', MEMBER, 'horses', 'h2'), horse(OTHER)));
    await assertFails(setDoc(doc(as(MEMBER), 'users', OTHER, 'horses', 'h3'), horse(MEMBER)));
    await assertFails(getDoc(doc(as(OTHER), 'users', MEMBER, 'horses', 'h1')));
    await assertFails(deleteDoc(doc(as(OTHER), 'users', MEMBER, 'horses', 'h1')));
  });

  it('allows owner read of legacy horses but no new legacy writes', async () => {
    await seed((s) => setDoc(doc(s, 'horses', 'legacy-1'), horse(MEMBER)));
    await assertSucceeds(getDocs(query(collection(as(MEMBER), 'horses'), where('userId', '==', MEMBER))));
    await assertFails(getDoc(doc(as(OTHER), 'horses', 'legacy-1')));
    await assertFails(setDoc(doc(as(MEMBER), 'horses', 'legacy-2'), horse(MEMBER)));
    await assertFails(updateDoc(doc(as(MEMBER), 'horses', 'legacy-1'), { name: 'x' }));
    await assertFails(deleteDoc(doc(as(OTHER), 'horses', 'legacy-1')));
  });

  it('keeps sightings and read state owner-only', async () => {
    const sighting = { userId: MEMBER, animalName: 'dog', location: { latitude: 0, longitude: 0 }, timestamp: 'x', createdAt: 1, updatedAt: 1 };
    await assertSucceeds(setDoc(doc(as(MEMBER), 'users', MEMBER, 'sightings', 's1'), sighting));
    await assertFails(getDoc(doc(as(OTHER), 'users', MEMBER, 'sightings', 's1')));
    await assertSucceeds(setDoc(doc(as(MEMBER), 'users', MEMBER, 'readNotifications', 'n1'), { read: true }));
    await assertFails(setDoc(doc(as(OTHER), 'users', MEMBER, 'readNotifications', 'n1'), { read: true }));
  });
});

describe('obstacles', () => {
  const obstacle = (userId: string, over: Record<string, unknown> = {}) => ({
    userId,
    type: 'tree',
    severity: 'high',
    status: 'active',
    title: 'Fallen tree',
    location: { latitude: -34.03, longitude: 25.5 },
    reportedAt: 1,
    verifiedBy: [],
    createdAt: 1,
    updatedAt: 1,
    ...over,
  });

  beforeEach(() => seed((s) => setDoc(doc(s, 'obstacles', 'o1'), obstacle(OTHER, { verifiedBy: [ADMIN] }))));

  it('lets approved users read and pending or anonymous users not', async () => {
    await assertSucceeds(getDoc(doc(as(MEMBER), 'obstacles', 'o1')));
    await assertFails(getDoc(doc(as(PENDING), 'obstacles', 'o1')));
    await assertFails(getDoc(doc(anon(), 'obstacles', 'o1')));
  });

  it('lets the author create an active report with no votes', async () => {
    await assertSucceeds(setDoc(doc(as(MEMBER), 'obstacles', 'o2'), obstacle(MEMBER)));
    await assertFails(setDoc(doc(as(MEMBER), 'obstacles', 'o3'), obstacle(OTHER)));
    await assertFails(setDoc(doc(as(MEMBER), 'obstacles', 'o4'), obstacle(MEMBER, { verifiedBy: [MEMBER] })));
    await assertFails(setDoc(doc(as(MEMBER), 'obstacles', 'o5'), obstacle(MEMBER, { status: 'verified' })));
    await assertFails(setDoc(doc(as(PENDING), 'obstacles', 'o6'), obstacle(PENDING)));
  });

  it('limits verifiedBy to adding the caller', async () => {
    const ref = doc(as(MEMBER), 'obstacles', 'o1');
    await assertSucceeds(updateDoc(ref, { verifiedBy: arrayUnion(MEMBER), updatedAt: 2 }));
    await assertSucceeds(updateDoc(ref, { verifiedBy: arrayUnion(MEMBER), updatedAt: 3 }));
    await assertFails(updateDoc(ref, { verifiedBy: arrayUnion(OTHER), updatedAt: 4 }));
    await assertFails(updateDoc(ref, { verifiedBy: [MEMBER], updatedAt: 5 }));
  });

  it('lets only admins change status or delete', async () => {
    await assertFails(updateDoc(doc(as(MEMBER), 'obstacles', 'o1'), { status: 'resolved' }));
    await assertFails(updateDoc(doc(as(OTHER), 'obstacles', 'o1'), { status: 'resolved' }));
    await assertFails(deleteDoc(doc(as(OTHER), 'obstacles', 'o1')));
    await assertSucceeds(updateDoc(doc(as(ADMIN), 'obstacles', 'o1'), { status: 'resolved', resolvedAt: 9 }));
    await assertSucceeds(deleteDoc(doc(as(ADMIN), 'obstacles', 'o1')));
  });
});

describe('notifications', () => {
  const report = (over: Record<string, unknown> = {}, metadata: Record<string, unknown> = {}) => ({
    type: 'alert',
    title: 'New Trail Obstacle: Fallen tree',
    body: 'A new high severity obstacle has been reported on the trail.',
    audience: 'admins',
    createdBy: MEMBER,
    createdAt: serverTimestamp(),
    sentAt: serverTimestamp(),
    metadata: { obstacleId: 'mine', type: 'tree', severity: 'high', location: { latitude: 1, longitude: 2 }, reportedBy: 'Test Rider', ...metadata },
    ...over,
  });

  beforeEach(() =>
    seed(async (s) => {
      await setDoc(doc(s, 'obstacles', 'mine'), { userId: MEMBER, status: 'active' });
      await setDoc(doc(s, 'obstacles', 'theirs'), { userId: OTHER, status: 'active' });
      await setDoc(doc(s, 'notifications', 'for-users'), { type: 'event', title: 't', body: 'b', audience: 'users', createdBy: ADMIN, createdAt: 1 });
      await setDoc(doc(s, 'notifications', 'for-admins'), { type: 'user_signup', title: 't', body: 'b', audience: 'admins', createdBy: 'system', createdAt: 1 });
    })
  );

  it('lets a member send only the obstacle-report alert for their own obstacle', async () => {
    const col = collection(as(MEMBER), 'notifications');
    await assertSucceeds(setDoc(doc(col, 'ok'), report()));
    const { sentAt: _sentAt, ...queued } = report({ queuedAt: serverTimestamp() });
    await assertSucceeds(setDoc(doc(col, 'ok-queued'), queued));
    await assertFails(setDoc(doc(col, 'broadcast'), report({ audience: 'users' })));
    await assertFails(setDoc(doc(col, 'wrong-type'), report({ type: 'event' })));
    await assertFails(setDoc(doc(col, 'spoofed'), report({ createdBy: ADMIN })));
    await assertFails(setDoc(doc(col, 'not-mine'), report({}, { obstacleId: 'theirs' })));
    await assertFails(setDoc(doc(col, 'no-obstacle'), report({}, { obstacleId: 'missing' })));
    await assertFails(setDoc(doc(col, 'extra'), report({ priority: 'urgent' })));
    await assertFails(setDoc(doc(collection(as(PENDING), 'notifications'), 'pending'), report({ createdBy: PENDING })));
  });

  it('lets the creator mark their notification queued once, with server time only', async () => {
    const { sentAt: _sentAt, ...unqueued } = report();
    const mine = doc(as(MEMBER), 'notifications', 'to-queue');
    await assertSucceeds(setDoc(mine, unqueued));
    await assertFails(updateDoc(mine, { queuedAt: 5 }));
    await assertFails(updateDoc(mine, { queuedAt: serverTimestamp(), title: 'changed' }));
    await assertFails(updateDoc(doc(as(OTHER), 'notifications', 'to-queue'), { queuedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(mine, { queuedAt: serverTimestamp() }));
    await assertFails(updateDoc(mine, { queuedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(as(ADMIN), 'notifications', 'to-queue'), { title: 'edited', updatedAt: serverTimestamp() }));
  });

  it('lets admins author anything and members read by audience', async () => {
    await assertSucceeds(
      setDoc(doc(as(ADMIN), 'notifications', 'news'), { type: 'event', title: 't', body: 'b', audience: 'all', createdBy: ADMIN, createdAt: serverTimestamp() })
    );
    await assertSucceeds(getDoc(doc(as(MEMBER), 'notifications', 'for-users')));
    await assertFails(getDoc(doc(as(MEMBER), 'notifications', 'for-admins')));
    await assertSucceeds(
      getDocs(query(collection(as(MEMBER), 'notifications'), where('audience', 'in', ['users', 'all'])))
    );
    await assertFails(getDoc(doc(as(PENDING), 'notifications', 'for-users')));
  });

  it('denies members deleting or editing shared notifications', async () => {
    await assertFails(deleteDoc(doc(as(MEMBER), 'notifications', 'for-users')));
    await assertFails(updateDoc(doc(as(MEMBER), 'notifications', 'for-users'), { title: 'x' }));
    await assertSucceeds(deleteDoc(doc(as(ADMIN), 'notifications', 'for-users')));
  });
});

describe('pushNotificationRequests', () => {
  const request = (over: Record<string, unknown> = {}) => ({
    title: 't',
    body: 'b',
    audience: 'admins',
    createdAt: serverTimestamp(),
    processed: false,
    ...over,
  });
  const col = (uid: string) => collection(as(uid), 'pushNotificationRequests');

  it('accepts the documented schema', async () => {
    await assertSucceeds(setDoc(doc(col(MEMBER), 'a'), request()));
    await assertSucceeds(
      setDoc(doc(col(MEMBER), 'b'), request({ transport: 'expo', notificationId: 'n1', createdBy: MEMBER }))
    );
    await assertSucceeds(setDoc(doc(col(ADMIN), 'c'), request({ audience: 'all', createdBy: ADMIN })));
  });

  it('rejects anything else', async () => {
    await assertFails(setDoc(doc(col(MEMBER), 'processed'), request({ processed: true })));
    await assertFails(setDoc(doc(col(MEMBER), 'extra'), request({ tokens: ['x'] })));
    await assertFails(setDoc(doc(col(MEMBER), 'spoof'), request({ createdBy: ADMIN })));
    await assertFails(setDoc(doc(col(MEMBER), 'client-time'), request({ createdAt: 5 })));
    await assertFails(setDoc(doc(col(MEMBER), 'broadcast'), request({ audience: 'all' })));
    await assertFails(setDoc(doc(col(PENDING), 'pending'), request()));
    await assertFails(setDoc(doc(collection(anon(), 'pushNotificationRequests'), 'anon'), request()));
  });

  it('allows no client read, update or delete', async () => {
    await seed((s) => setDoc(doc(s, 'pushNotificationRequests', 'q'), { ...request(), createdAt: 1 }));
    await assertFails(getDoc(doc(col(ADMIN), 'q')));
    await assertFails(updateDoc(doc(col(ADMIN), 'q'), { processed: true }));
    await assertFails(deleteDoc(doc(col(ADMIN), 'q')));
  });
});

describe('SOS', () => {
  const sos = (uid: string) => ({
    uid,
    name: 'Test Rider',
    latitude: -34.03,
    longitude: 25.5,
    status: 'active',
    timestamp: serverTimestamp(),
  });

  it('lets the owner raise and clear only their own alert', async () => {
    const d = as(MEMBER);
    await assertSucceeds(setDoc(doc(d, 'sos_active', MEMBER), sos(MEMBER)));
    await assertSucceeds(setDoc(doc(d, 'SosAlerts', MEMBER), sos(MEMBER), { merge: true }));
    await assertFails(setDoc(doc(d, 'sos_active', OTHER), sos(OTHER)));
    await assertFails(setDoc(doc(d, 'sos_active', 'device_abc'), sos('device_abc')));
    await assertSucceeds(deleteDoc(doc(d, 'sos_active', MEMBER)));
    await assertSucceeds(
      setDoc(doc(d, 'SosAlerts', MEMBER), { status: 'cleared', clearedAt: serverTimestamp() }, { merge: true })
    );
    await assertFails(setDoc(doc(anon(), 'sos_active', 'device_abc'), sos('device_abc')));
  });

  it('lets approved users read alerts and admins clear them', async () => {
    await seed((s) => setDoc(doc(s, 'sos_active', OTHER), { ...sos(OTHER), timestamp: 1 }));
    await assertSucceeds(getDoc(doc(as(MEMBER), 'sos_active', OTHER)));
    await assertFails(getDoc(doc(as(PENDING), 'sos_active', OTHER)));
    await assertFails(deleteDoc(doc(as(MEMBER), 'sos_active', OTHER)));
    await assertFails(
      setDoc(doc(as(MEMBER), 'SosAlerts', OTHER), { status: 'cleared', clearedAt: serverTimestamp() }, { merge: true })
    );
    await assertSucceeds(deleteDoc(doc(as(ADMIN), 'sos_active', OTHER)));
    await assertSucceeds(
      setDoc(doc(as(ADMIN), 'SosAlerts', OTHER), { status: 'cleared_by_admin', clearedAt: serverTimestamp() }, { merge: true })
    );
  });
});

describe('onlineUsers, achievements, prefs and reports', () => {
  it('limits presence writes to the caller\'s own device docs', async () => {
    const presence = { uid: MEMBER, deviceId: 'device_1', lastSeen: 1, isRiding: true };
    await assertSucceeds(setDoc(doc(as(MEMBER), 'onlineUsers', `${MEMBER}_device_1`), presence, { merge: true }));
    await assertFails(setDoc(doc(as(MEMBER), 'onlineUsers', `${OTHER}_device_1`), presence));
    await assertFails(setDoc(doc(as(MEMBER), 'onlineUsers', `${MEMBER}_device_2`), { ...presence, uid: OTHER }));
    await assertSucceeds(getDocs(collection(as(OTHER), 'onlineUsers')));
    await assertFails(getDocs(collection(as(PENDING), 'onlineUsers')));
  });

  it('keeps awards write-once and owner scoped', async () => {
    const award = { userId: MEMBER, earnedAt: 1, createdAt: 1, updatedAt: 1, meta: { rideId: 'r1' } };
    await assertSucceeds(getDoc(doc(as(MEMBER), 'achievements', `${MEMBER}_first-ride`)));
    await assertSucceeds(setDoc(doc(as(MEMBER), 'achievements', `${MEMBER}_first-ride`), award));
    await assertFails(setDoc(doc(as(MEMBER), 'achievements', `${MEMBER}_first-ride`), { ...award, earnedAt: 2 }));
    await assertFails(setDoc(doc(as(MEMBER), 'achievements', `${OTHER}_first-ride`), { ...award, userId: OTHER }));
    await assertSucceeds(getDocs(query(collection(as(MEMBER), 'achievements'), where('userId', '==', MEMBER))));
    await assertFails(getDoc(doc(as(OTHER), 'achievements', `${MEMBER}_first-ride`)));
  });

  it('keeps notification prefs and reports owner scoped', async () => {
    await assertSucceeds(setDoc(doc(as(MEMBER), 'notification_prefs', MEMBER), { allowPush: true }));
    await assertFails(getDoc(doc(as(OTHER), 'notification_prefs', MEMBER)));
    await assertSucceeds(setDoc(doc(as(MEMBER), 'reports', 'rep1'), { userId: MEMBER, title: 't' }));
    await assertFails(setDoc(doc(as(MEMBER), 'reports', 'rep2'), { userId: OTHER, title: 't' }));
    await assertFails(getDoc(doc(as(OTHER), 'reports', 'rep1')));
    await assertSucceeds(getDoc(doc(as(ADMIN), 'reports', 'rep1')));
  });

  it('denies unmatched collections', async () => {
    await assertFails(getDoc(doc(as(ADMIN), '_connection_test', 'test')));
    await assertFails(setDoc(doc(as(ADMIN), 'sos_alerts', 'x'), { status: 'open' }));
  });
});

describe('storage users/{uid}/profile.jpg', () => {
  const storageRef = (ctx: RulesTestContext, path: string) => ctx.storage().ref(path);
  const upload = (uid: string, path: string, size: number, contentType: string) =>
    Promise.resolve(storageRef(testEnv.authenticatedContext(uid), path).put(new Uint8Array(size), { contentType }));
  const mine = `users/${MEMBER}/profile.jpg`;

  it('lets the owner upload a small image', async () => {
    await assertSucceeds(upload(MEMBER, mine, 1024, 'image/jpeg'));
    await assertSucceeds(storageRef(testEnv.authenticatedContext(MEMBER), mine).getDownloadURL());
  });

  it('rejects non-images, files of 5 MB or more, and other users', async () => {
    await assertFails(upload(MEMBER, mine, 1024, 'text/plain'));
    await assertFails(upload(MEMBER, mine, 5 * 1024 * 1024, 'image/jpeg'));
    await assertFails(upload(OTHER, mine, 1024, 'image/jpeg'));
    await assertFails(upload(MEMBER, `users/${MEMBER}/other.jpg`, 1024, 'image/jpeg'));
    await assertFails(storageRef(testEnv.unauthenticatedContext(), mine).getDownloadURL());
  });
});
