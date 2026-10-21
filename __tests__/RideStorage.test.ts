import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RideData } from '../hooks/useRideTracker';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js')
);

const mockAuth: { currentUser: { uid: string } | null } = { currentUser: { uid: 'user-1' } };
jest.mock('../services/firebase', () => ({
  FIREBASE_ENABLED: true,
  get auth() {
    return mockAuth;
  },
}));

const mockSaveRemote = jest.fn();
const mockListDocs = jest.fn();
jest.mock('../services/Data', () => ({
  saveRideAndUpdateAggregates: (...args: unknown[]) => mockSaveRemote(...args),
  listDocs: (...args: unknown[]) => mockListDocs(...args),
  newRide: (partial: object) => ({ ...partial }),
  ridePointToDTO: (p: object) => p,
  ridePointFromDTO: (p: object) => p,
  Converters: { ride: {} },
  COLLECTIONS: { rides: 'rides' },
}));

import { getPendingRideCount, getRides, saveRide, syncPendingRides } from '../services/RideStorage';

const ride = (startTime: number): RideData => ({
  startTime,
  path: [{ latitude: -34.03, longitude: 25.5, altitude: 10, timestamp: startTime }],
  totalDistance: 1200,
  elevationGain: 5,
  duration: 600_000,
});

const offline = () => mockSaveRemote.mockRejectedValue(new Error('unavailable'));
const online = () => mockSaveRemote.mockImplementation(async (dto) => dto);

// saveRide kicks off a background sync; wait for it to settle
const flush = () => syncPendingRides();

beforeEach(async () => {
  await AsyncStorage.clear();
  mockSaveRemote.mockReset();
  mockListDocs.mockReset();
  mockAuth.currentUser = { uid: 'user-1' };
});

describe('RideStorage offline sync', () => {
  it('keeps a ride saved while offline and uploads it later', async () => {
    offline();
    const saved = await saveRide(ride(1000));
    await flush();
    expect(saved.syncState).toBe('pending');
    expect(await getPendingRideCount()).toBe(1);

    online();
    const result = await syncPendingRides();
    expect(result).toEqual({ synced: 1, failed: 0 });
    expect(await getPendingRideCount()).toBe(0);
    expect(mockSaveRemote).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: saved.id, userId: 'user-1', startTime: 1000, endTime: 601_000 })
    );
  });

  it('uploads each ride with the same id on every retry', async () => {
    offline();
    const saved = await saveRide(ride(2000));
    await flush();
    await syncPendingRides();
    const ids = mockSaveRemote.mock.calls.map(([dto]) => dto.id);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(new Set(ids)).toEqual(new Set([saved.id]));
  });

  it('does not upload another user\'s pending rides', async () => {
    offline();
    await saveRide(ride(3000));
    await flush();

    online();
    mockAuth.currentUser = { uid: 'user-2' };
    expect(await syncPendingRides()).toEqual({ synced: 0, failed: 0 });
  });

  it('does not lose a ride saved while a sync is running', async () => {
    let release!: () => void;
    const uploadStarted = new Promise<void>((started) => {
      mockSaveRemote.mockImplementationOnce(() => {
        started();
        return new Promise<void>((r) => (release = r));
      });
    });
    online();
    await saveRide(ride(4000));
    await uploadStarted; // first upload is now in flight
    await saveRide(ride(5000));
    release();
    await flush();
    await flush();
    const stored = JSON.parse((await AsyncStorage.getItem('rides')) as string);
    expect(stored.map((r: RideData) => r.startTime).sort()).toEqual([4000, 5000]);
  });

  it('merges unsynced rides into the history, newest first', async () => {
    offline();
    const pending = await saveRide(ride(9000));
    await flush();
    mockListDocs.mockResolvedValue([{ ...ride(5000), id: 'remote-1', userId: 'user-1' }]);

    const rides = await getRides();
    expect(rides.map((r) => [r.id, r.pendingSync ?? false])).toEqual([
      [pending.id, true],
      ['remote-1', false],
    ]);
  });

  it('shows device rides when Firestore cannot be reached', async () => {
    offline();
    await saveRide(ride(7000));
    await flush();
    mockListDocs.mockRejectedValue(new Error('offline'));
    expect((await getRides()).map((r) => r.startTime)).toEqual([7000]);
  });

  it('never uploads rides stored before the queue existed', async () => {
    await AsyncStorage.setItem('rides', JSON.stringify([ride(100)]));
    online();
    expect(await syncPendingRides()).toEqual({ synced: 0, failed: 0 });
    expect(mockSaveRemote).not.toHaveBeenCalled();
  });
});
