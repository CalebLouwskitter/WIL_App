const mockConfig: { FIREBASE_ENABLED: boolean; firestore: object | null; auth: { currentUser: { uid: string } | null } | null } = {
  FIREBASE_ENABLED: false,
  firestore: null,
  auth: null,
};
jest.mock('../services/FirebaseConfig', () => ({
  get FIREBASE_ENABLED() {
    return mockConfig.FIREBASE_ENABLED;
  },
  get firestore() {
    return mockConfig.firestore;
  },
  get auth() {
    return mockConfig.auth;
  },
}));

const mockGetDocs = jest.fn();
jest.mock('firebase/firestore', () => ({
  collection: () => ({ withConverter: () => ({}) }),
  query: (...a: unknown[]) => a,
  where: (...a: unknown[]) => a,
  orderBy: (...a: unknown[]) => a,
  doc: jest.fn(),
  getDoc: jest.fn(async () => ({ exists: () => false })),
  getDocs: (...a: unknown[]) => mockGetDocs(...a),
}));

jest.mock('../services/Data', () => ({
  Converters: { ride: {} },
  COLLECTIONS: { rides: 'rides', users: 'users' },
  ridePointFromDTO: (p: unknown) => p,
}));

import {
  getAllUserRides,
  getGlobalRideStats,
  getGlobalTrailUsage,
  getUserRideStats,
} from '../services/GlobalAnalyticsService';
import { getCurrentUserRides, getUserAnalytics } from '../services/UserAnalyticsService';

const ride = (userId: string, totalDistance: number) => ({
  startTime: 1000,
  path: [],
  totalDistance,
  elevationGain: 0,
  duration: 60_000,
  userId,
});

const snapshotOf = (rides: object[]) => ({
  empty: rides.length === 0,
  docs: rides.map((r) => ({ data: () => r })),
});

let errorSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;

beforeEach(() => {
  mockConfig.FIREBASE_ENABLED = false;
  mockConfig.firestore = null;
  mockConfig.auth = null;
  mockGetDocs.mockReset();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('analytics availability: Firebase off (demo mode)', () => {
  it('reports unavailable without logging an error or warning', async () => {
    const results = await Promise.all([
      getAllUserRides(),
      getGlobalRideStats(),
      getUserRideStats(),
      getGlobalTrailUsage(),
      getCurrentUserRides(),
      getUserAnalytics(),
    ]);

    results.forEach((r) => {
      expect(r.status).toBe('unavailable');
      expect(r).toMatchObject({ reason: 'firebase-off' });
    });
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('still hands back zeroed data so a caller can render it, but never as ok', async () => {
    const stats = await getGlobalRideStats();
    expect(stats.status).not.toBe('ok');
    expect(stats.data).toMatchObject({ totalRides: 0, totalDistance: 0, uniqueUsers: 0, rides: [] });
  });
});

describe('analytics availability: Firebase on but nobody signed in', () => {
  it('is unavailable (signed-out) and quiet', async () => {
    mockConfig.FIREBASE_ENABLED = true;
    mockConfig.firestore = {};
    mockConfig.auth = { currentUser: null };

    const result = await getCurrentUserRides();
    expect(result).toMatchObject({ status: 'unavailable', reason: 'signed-out', data: [] });
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('analytics availability: Firebase configured', () => {
  beforeEach(() => {
    mockConfig.FIREBASE_ENABLED = true;
    mockConfig.firestore = {};
    mockConfig.auth = { currentUser: { uid: 'u1' } };
  });

  it('a failing query is an error and is logged with its detail', async () => {
    const boom = new Error('permission-denied');
    mockGetDocs.mockRejectedValue(boom);

    const global = await getAllUserRides();
    expect(global).toMatchObject({ status: 'error', error: boom, data: [] });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[GlobalAnalytics]'), boom);

    warnSpy.mockClear();
    const user = await getCurrentUserRides();
    expect(user).toMatchObject({ status: 'error', error: boom, data: [] });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[UserAnalytics]'), boom);

    // the aggregates carry the failure through instead of presenting zeros as real
    expect((await getGlobalRideStats()).status).toBe('error');
    expect((await getUserAnalytics()).status).toBe('error');
  });

  it('a successful query with no rides is ok with real zeros', async () => {
    mockGetDocs.mockResolvedValue(snapshotOf([]));

    const stats = await getGlobalRideStats();
    expect(stats.status).toBe('ok');
    expect(stats.data.totalRides).toBe(0);
    expect((await getUserAnalytics()).status).toBe('ok');
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('a successful query aggregates the rides it got', async () => {
    mockGetDocs.mockResolvedValue(snapshotOf([ride('a', 1000), ride('b', 3000)]));

    const stats = await getGlobalRideStats();
    expect(stats.status).toBe('ok');
    expect(stats.data).toMatchObject({ totalRides: 2, totalDistance: 4000, uniqueUsers: 2 });
  });
});
