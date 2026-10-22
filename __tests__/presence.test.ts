import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PRESENCE_WINDOW_MS,
  ACTIVE_NOW_THRESHOLD_MS,
  isPresent,
  filterPresent,
  presenceLabel,
} from '../utils/presence';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const mockFirebase: {
  FIREBASE_ENABLED: boolean;
  app: object | undefined;
  auth: { currentUser: object | null } | undefined;
} = {
  FIREBASE_ENABLED: false,
  app: undefined,
  auth: undefined,
};

jest.mock('../services/firebase', () => ({
  get FIREBASE_ENABLED() {
    return mockFirebase.FIREBASE_ENABLED;
  },
  get app() {
    return mockFirebase.app;
  },
  get auth() {
    return mockFirebase.auth;
  },
}));

const mockGetDocs = jest.fn();
const mockOnSnapshot = jest.fn();

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn(() => ({})),
  doc: jest.fn(() => ({})),
  setDoc: jest.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: jest.fn(() => ({})),
  where: jest.fn(() => ({})),
  orderBy: jest.fn(() => ({})),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  Timestamp: { now: () => ({}) },
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

jest.mock('../utils/geofencing', () => ({
  isWithinAuthorizedArea: jest.fn(() => true),
}));

import {
  getOnlineUsers,
  getOnlineUsersWithSource,
  subscribeToOnlineUsers,
  type OnlineUser,
} from '../services/OnlineUserService';

describe('utils/presence', () => {
  const baseNow = Date.UTC(2026, 9, 22, 12, 0, 0); // 12:00:00 UTC

  describe('isPresent', () => {
    it('returns true for lastSeen equal to now', () => {
      expect(isPresent(baseNow, baseNow)).toBe(true);
    });

    it('returns true for lastSeen within the 30 minute window (29m 59s ago)', () => {
      const lastSeen = baseNow - (29 * 60 + 59) * 1000;
      expect(isPresent(lastSeen, baseNow)).toBe(true);
    });

    it('is inclusive at exactly 30 minutes', () => {
      const lastSeen = baseNow - PRESENCE_WINDOW_MS;
      expect(isPresent(lastSeen, baseNow)).toBe(true);
    });

    it('returns false for lastSeen past 30 minutes (30m 01s ago)', () => {
      const lastSeen = baseNow - (30 * 60 + 1) * 1000;
      expect(isPresent(lastSeen, baseNow)).toBe(false);
    });

    it('treats future lastSeen as present (clock skew)', () => {
      const futureLastSeen = baseNow + 60 * 1000; // 1 minute in the future
      expect(isPresent(futureLastSeen, baseNow)).toBe(true);
    });

    it('returns false for NaN, null, undefined, and non-finite values', () => {
      expect(isPresent(NaN, baseNow)).toBe(false);
      expect(isPresent(null, baseNow)).toBe(false);
      expect(isPresent(undefined, baseNow)).toBe(false);
      expect(isPresent('12345' as any, baseNow)).toBe(false);
      expect(isPresent(Infinity, baseNow)).toBe(false);
      expect(isPresent(-Infinity, baseNow)).toBe(false);
    });
  });

  describe('filterPresent', () => {
    it('filters out expired riders and keeps present ones', () => {
      const users = [
        { uid: 'u1', deviceId: 'd1', lastSeen: baseNow - 5 * 60 * 1000 }, // 5 min ago (present)
        { uid: 'u2', deviceId: 'd1', lastSeen: baseNow - 35 * 60 * 1000 }, // 35 min ago (expired)
        { uid: 'u3', deviceId: 'd1', lastSeen: NaN }, // invalid
      ];

      const result = filterPresent(users, baseNow);
      expect(result).toHaveLength(1);
      expect(result[0].uid).toBe('u1');
    });

    it('dedupes by uid_deviceId and keeps the newest lastSeen', () => {
      const users = [
        { uid: 'u1', deviceId: 'd1', lastSeen: baseNow - 10 * 60 * 1000, marker: 'older' },
        { uid: 'u1', deviceId: 'd1', lastSeen: baseNow - 2 * 60 * 1000, marker: 'newer' },
        { uid: 'u1', deviceId: 'd2', lastSeen: baseNow - 4 * 60 * 1000, marker: 'different-device' },
      ];

      const result = filterPresent(users, baseNow);
      expect(result).toHaveLength(2);

      const d1User = result.find((u) => u.uid === 'u1' && u.deviceId === 'd1');
      expect(d1User?.marker).toBe('newer');

      const d2User = result.find((u) => u.uid === 'u1' && u.deviceId === 'd2');
      expect(d2User?.marker).toBe('different-device');
    });

    it('handles default unknown deviceId when deviceId is omitted', () => {
      const users = [
        { uid: 'u1', lastSeen: baseNow - 15 * 60 * 1000, marker: 'first' },
        { uid: 'u1', lastSeen: baseNow - 3 * 60 * 1000, marker: 'second' },
      ];

      const result = filterPresent(users, baseNow);
      expect(result).toHaveLength(1);
      expect(result[0].marker).toBe('second');
    });

    it('returns empty array when input is empty or invalid', () => {
      expect(filterPresent([], baseNow)).toEqual([]);
      expect(filterPresent(null as any, baseNow)).toEqual([]);
    });
  });

  describe('presenceLabel', () => {
    it('returns "Active now" for timestamps under 2 minutes ago', () => {
      expect(presenceLabel(baseNow, baseNow)).toBe('Active now');
      expect(presenceLabel(baseNow - 30 * 1000, baseNow)).toBe('Active now');
      expect(presenceLabel(baseNow - 119 * 1000, baseNow)).toBe('Active now');
    });

    it('returns "Active now" for future timestamps (clock skew)', () => {
      expect(presenceLabel(baseNow + 45 * 1000, baseNow)).toBe('Active now');
    });

    it('returns "Seen N min ago" rounding down minutes for diff >= 2 minutes', () => {
      expect(presenceLabel(baseNow - 2 * 60 * 1000, baseNow)).toBe('Seen 2 min ago');
      expect(presenceLabel(baseNow - (2 * 60 + 59) * 1000, baseNow)).toBe('Seen 2 min ago');
      expect(presenceLabel(baseNow - (5 * 60 + 30) * 1000, baseNow)).toBe('Seen 5 min ago');
      expect(presenceLabel(baseNow - 29 * 60 * 1000, baseNow)).toBe('Seen 29 min ago');
      expect(presenceLabel(baseNow - 30 * 60 * 1000, baseNow)).toBe('Seen 30 min ago');
    });

    it('returns "Offline" for non-finite or invalid timestamps', () => {
      expect(presenceLabel(NaN, baseNow)).toBe('Offline');
      expect(presenceLabel(null, baseNow)).toBe('Offline');
      expect(presenceLabel(undefined, baseNow)).toBe('Offline');
    });
  });
});

describe('OnlineUserService presence read and subscribe', () => {
  const baseNow = Date.UTC(2026, 9, 22, 14, 0, 0);

  beforeEach(async () => {
    await AsyncStorage.clear();
    mockFirebase.FIREBASE_ENABLED = false;
    mockFirebase.app = undefined;
    mockFirebase.auth = undefined;
    mockGetDocs.mockReset();
    mockOnSnapshot.mockReset();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(Date, 'now').mockReturnValue(baseNow);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getOnlineUsersWithSource and getOnlineUsers', () => {
    it('returns source "unavailable" when Firebase is off and there is no cache', async () => {
      const result = await getOnlineUsersWithSource();
      expect(result).toEqual({ users: [], source: 'unavailable' });

      const direct = await getOnlineUsers();
      expect(direct).toEqual([]);
    });

    it('returns source "cached" with age-filtered users when Firebase is off and cache exists', async () => {
      const cachedUsers: OnlineUser[] = [
        {
          uid: 'u_fresh',
          deviceId: 'd1',
          displayName: 'Fresh Rider',
          location: { latitude: -34.0, longitude: 25.0 },
          lastSeen: baseNow - 10 * 60 * 1000, // 10 min ago (fresh)
        },
        {
          uid: 'u_stale',
          deviceId: 'd1',
          displayName: 'Stale Rider',
          location: { latitude: -34.0, longitude: 25.0 },
          lastSeen: baseNow - 40 * 60 * 1000, // 40 min ago (expired)
        },
      ];
      await AsyncStorage.setItem('ONLINE_USERS_LOCAL', JSON.stringify(cachedUsers));

      const result = await getOnlineUsersWithSource();
      expect(result.source).toBe('cached');
      expect(result.users).toHaveLength(1);
      expect(result.users[0].uid).toBe('u_fresh');

      const direct = await getOnlineUsers();
      expect(direct).toHaveLength(1);
      expect(direct[0].uid).toBe('u_fresh');
    });

    it('returns source "live" on successful Firestore query and caches filtered users', async () => {
      mockFirebase.FIREBASE_ENABLED = true;
      mockFirebase.app = {};
      mockFirebase.auth = { currentUser: { uid: 'u_me' } };

      const docs = [
        {
          data: () => ({
            uid: 'u_remote_1',
            deviceId: 'd1',
            displayName: 'Remote Rider 1',
            location: { latitude: -34.1, longitude: 25.1 },
            lastSeen: baseNow - 5 * 60 * 1000,
            isRiding: true,
          }),
        },
        {
          data: () => ({
            uid: 'u_remote_2',
            deviceId: 'd1',
            displayName: 'Remote Rider 2 (Old)',
            location: { latitude: -34.2, longitude: 25.2 },
            lastSeen: baseNow - 35 * 60 * 1000, // past threshold
            isRiding: false,
          }),
        },
      ];

      mockGetDocs.mockResolvedValueOnce({
        size: docs.length,
        forEach: (cb: (doc: any) => void) => docs.forEach(cb),
      });

      const result = await getOnlineUsersWithSource();
      expect(result.source).toBe('live');
      expect(result.users).toHaveLength(1);
      expect(result.users[0].uid).toBe('u_remote_1');

      // Verify written to AsyncStorage
      const stored = await AsyncStorage.getItem('ONLINE_USERS_LOCAL');
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].uid).toBe('u_remote_1');
    });

    it('falls back to cache when Firestore query fails', async () => {
      mockFirebase.FIREBASE_ENABLED = true;
      mockFirebase.app = {};

      const cachedUsers: OnlineUser[] = [
        {
          uid: 'u_fallback',
          deviceId: 'd1',
          displayName: 'Fallback Rider',
          location: { latitude: -34.0, longitude: 25.0 },
          lastSeen: baseNow - 8 * 60 * 1000,
        },
      ];
      await AsyncStorage.setItem('ONLINE_USERS_LOCAL', JSON.stringify(cachedUsers));

      mockGetDocs.mockRejectedValueOnce(new Error('Network error'));

      const result = await getOnlineUsersWithSource();
      expect(result.source).toBe('cached');
      expect(result.users).toHaveLength(1);
      expect(result.users[0].uid).toBe('u_fallback');
    });

    it('returns "unavailable" on query error when no cache exists', async () => {
      mockFirebase.FIREBASE_ENABLED = true;
      mockFirebase.app = {};
      mockGetDocs.mockRejectedValueOnce(new Error('Network error'));

      const result = await getOnlineUsersWithSource();
      expect(result.source).toBe('unavailable');
      expect(result.users).toEqual([]);
    });
  });

  describe('subscribeToOnlineUsers', () => {
    it('is a no-op when Firebase is off', () => {
      const cb = jest.fn();
      const onError = jest.fn();
      const unsub = subscribeToOnlineUsers(cb, onError);

      expect(typeof unsub).toBe('function');
      expect(mockOnSnapshot).not.toHaveBeenCalled();
    });

    it('filters snapshot records by age and calls callback', () => {
      mockFirebase.FIREBASE_ENABLED = true;
      mockFirebase.app = {};

      let snapshotCallback: ((snap: any) => void) | undefined;
      let errorCallback: ((err: any) => void) | undefined;

      mockOnSnapshot.mockImplementation((_q: any, onSnap: any, onErr: any) => {
        snapshotCallback = onSnap;
        errorCallback = onErr;
        return () => {};
      });

      const cb = jest.fn();
      const onError = jest.fn();
      subscribeToOnlineUsers(cb, onError);

      expect(mockOnSnapshot).toHaveBeenCalled();

      // Trigger snapshot
      const docs = [
        {
          data: () => ({
            uid: 'r1',
            deviceId: 'd1',
            lastSeen: baseNow - 2 * 60 * 1000,
          }),
        },
        {
          data: () => ({
            uid: 'r2',
            deviceId: 'd1',
            lastSeen: baseNow - 32 * 60 * 1000, // expired
          }),
        },
      ];

      snapshotCallback!({
        size: docs.length,
        forEach: (fn: (d: any) => void) => docs.forEach(fn),
      });

      expect(cb).toHaveBeenCalledTimes(1);
      const passedUsers = cb.mock.calls[0][0];
      expect(passedUsers).toHaveLength(1);
      expect(passedUsers[0].uid).toBe('r1');

      // Trigger error
      const testError = new Error('subscription failed');
      errorCallback!(testError);
      expect(onError).toHaveBeenCalledWith(testError);
    });
  });
});
