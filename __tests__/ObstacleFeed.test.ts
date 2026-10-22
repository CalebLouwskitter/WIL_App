import type { ObstacleFeedStatus } from '../services/ObstacleService';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const mockFirebase: { FIREBASE_ENABLED: boolean; app: object | undefined; auth: object | undefined } = {
  FIREBASE_ENABLED: true,
  app: {},
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

jest.mock('../services/Data', () => ({
  COLLECTIONS: { obstacles: 'obstacles', users: 'users' },
  Converters: { obstacle: {} },
  newObstacle: (o: object) => o,
  userProfileConverter: {},
}));

const mockOnSnapshot = jest.fn();
const mockGetDocs = jest.fn();
jest.mock('firebase/firestore', () => {
  const q = { withConverter: () => q };
  return {
    getFirestore: () => ({}),
    collection: () => q,
    doc: () => q,
    query: () => q,
    orderBy: () => ({}),
    where: () => ({}),
    limit: () => ({}),
    GeoPoint: class {},
    arrayUnion: () => ({}),
    setDoc: jest.fn(),
    getDoc: jest.fn(),
    updateDoc: jest.fn(),
    deleteDoc: jest.fn(),
    onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
    getDocs: (...args: unknown[]) => mockGetDocs(...args),
  };
});

import { fetchObstacles, subscribeToObstacles } from '../services/ObstacleService';
import { describeObstacleFeed } from '../utils/obstacleFeed';

const dto = (id: string) => ({
  id,
  userId: 'u1',
  type: 'tree',
  severity: 'high',
  status: 'active',
  title: 'Fallen tree',
  location: { latitude: -34, longitude: 25 },
  reportedAt: 1,
  createdAt: 1,
  updatedAt: 1,
});
const snapshot = (fromCache: boolean, ids: string[] = []) => ({
  metadata: { fromCache },
  docs: ids.map((id) => ({ data: () => dto(id) })),
});

beforeEach(() => {
  mockOnSnapshot.mockReset();
  mockGetDocs.mockReset();
  mockFirebase.FIREBASE_ENABLED = true;
  mockFirebase.app = {};
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('subscribeToObstacles status mapping', () => {
  const run = () => {
    const statuses: ObstacleFeedStatus[] = [];
    const callback = jest.fn();
    subscribeToObstacles(callback, { status: 'active' }, (s) => statuses.push(s));
    const [, , next, onError] = mockOnSnapshot.mock.calls[0];
    return { statuses, callback, next, onError };
  };

  it('reports unavailable and never subscribes when Firebase is off', () => {
    mockFirebase.FIREBASE_ENABLED = false;
    mockFirebase.app = undefined;
    const statuses: ObstacleFeedStatus[] = [];
    const callback = jest.fn();
    subscribeToObstacles(callback, undefined, (s) => statuses.push(s));
    expect(statuses).toEqual(['unavailable']);
    expect(mockOnSnapshot).not.toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
  });

  it('does not log a warning or error for the expected Firebase-off disconnection', () => {
    mockFirebase.FIREBASE_ENABLED = false;
    mockFirebase.app = undefined;
    subscribeToObstacles(jest.fn(), undefined, jest.fn());
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('still warns, with the original error, when a configured listener fails', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    const { onError } = run();
    const failure = new Error('permission-denied');
    onError(failure);
    await new Promise((r) => setImmediate(r));
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('subscription error'), failure);
  });

  it('starts as connecting and is not live until a server snapshot arrives', () => {
    const { statuses, callback } = run();
    expect(statuses).toEqual(['connecting']);
    expect(callback).not.toHaveBeenCalled();
  });

  it('maps a cache snapshot to cached and a server snapshot to live', () => {
    const { statuses, callback, next } = run();
    next(snapshot(true, ['a']));
    next(snapshot(false, ['a', 'b']));
    expect(statuses).toEqual(['connecting', 'cached', 'live']);
    expect(callback).toHaveBeenLastCalledWith(expect.arrayContaining([expect.objectContaining({ id: 'b' })]));
  });

  it('reports error and still runs the fetch fallback when the listener fails', async () => {
    mockGetDocs.mockRejectedValue(new Error('offline'));
    const { statuses, callback, onError } = run();
    onError(new Error('permission-denied'));
    await new Promise((r) => setImmediate(r));
    expect(statuses).toEqual(['connecting', 'error']);
    expect(callback).toHaveBeenCalledWith([]); // local fallback result, not presented as live
  });
});

describe('fetchObstacles status', () => {
  it('is unavailable when Firebase is off', async () => {
    mockFirebase.FIREBASE_ENABLED = false;
    mockFirebase.app = undefined;
    expect((await fetchObstacles()).status).toBe('unavailable');
  });

  it('is live for a server read, cached for a cache read, error when the read fails', async () => {
    mockGetDocs.mockResolvedValueOnce(snapshot(false, ['a']));
    expect(await fetchObstacles()).toMatchObject({ status: 'live', obstacles: [expect.objectContaining({ id: 'a' })] });
    mockGetDocs.mockResolvedValueOnce(snapshot(true));
    expect((await fetchObstacles()).status).toBe('cached');
    mockGetDocs.mockRejectedValueOnce(new Error('boom'));
    expect((await fetchObstacles()).status).toBe('error');
  });
});

describe('describeObstacleFeed wording', () => {
  it('only shows Live for a live feed', () => {
    const statuses: ObstacleFeedStatus[] = ['unavailable', 'connecting', 'live', 'cached', 'error'];
    const live = statuses.filter((s) => describeObstacleFeed(s, 0, 1).indicator.isLive);
    expect(live).toEqual(['live']);
  });

  it('never says all clear and adds no safety guarantee on a successful empty read', () => {
    const view = describeObstacleFeed('live', 0, Date.now());
    expect(view.kind).toBe('empty');
    expect(view.title).toBe('No active reports');
    expect(view.body).toContain('Last updated');
    expect(view.body).toContain("This doesn't guarantee the trail is clear");
  });

  it('replaces the empty list with unavailable / error states', () => {
    expect(describeObstacleFeed('unavailable', 0).kind).toBe('unavailable');
    expect(describeObstacleFeed('error', 0).kind).toBe('error');
    for (const s of ['unavailable', 'error', 'connecting'] as const) {
      const text = JSON.stringify(describeObstacleFeed(s, 0));
      expect(text).not.toMatch(/all clear|No active reports/i);
    }
  });

  it('keeps showing reports but flags them when offline or after an error', () => {
    expect(describeObstacleFeed('cached', 2).caveat).toBeTruthy();
    expect(describeObstacleFeed('error', 2)).toMatchObject({ kind: 'list' });
    expect(describeObstacleFeed('error', 2).caveat).toBeTruthy();
  });
});
