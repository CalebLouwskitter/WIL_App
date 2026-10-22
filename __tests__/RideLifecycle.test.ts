// Ride recording -> history lifecycle. Storage, the native location task and
// the backend are mocked; each "cold restart" reloads every module against the
// same simulated disk, as a killed and relaunched app would.

const DRAFT_KEY = '@sbhra_active_ride_state';

const mockDisk = new Map<string, string>();
// Return an Error from one of these to make the next matching call fail.
const mockFaults: {
  setItem?: (key: string) => Error | undefined;
  removeItem?: (key: string) => Error | undefined;
} = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: async (key: string) => mockDisk.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      const fault = mockFaults.setItem?.(key);
      if (fault) throw fault;
      mockDisk.set(key, value);
    },
    removeItem: async (key: string) => {
      const fault = mockFaults.removeItem?.(key);
      if (fault) throw fault;
      mockDisk.delete(key);
    },
  },
}));
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js')
);

const mockAuth: { currentUser: { uid: string } | null } = { currentUser: null };
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

// The background task registered by BackgroundLocationService, so tests can
// deliver native location batches with no screen mounted.
const mockTasks: Record<string, (body: { data?: unknown; error?: unknown }) => Promise<void>> = {};
jest.mock('expo-task-manager', () => ({
  defineTask: (name: string, fn: any) => {
    mockTasks[name] = fn;
  },
  isTaskRegisteredAsync: async (name: string) => name in mockTasks,
}));

const mockLocation = { running: false, servicesEnabled: true };
jest.mock('expo-location', () => ({
  Accuracy: { BestForNavigation: 6, Balanced: 3 },
  ActivityType: { Fitness: 3 },
  hasStartedLocationUpdatesAsync: async () => mockLocation.running,
  startLocationUpdatesAsync: async () => {
    mockLocation.running = true;
  },
  stopLocationUpdatesAsync: async () => {
    mockLocation.running = false;
  },
  getForegroundPermissionsAsync: async () => ({ granted: true }),
  getBackgroundPermissionsAsync: async () => ({ granted: true }),
  requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
  requestBackgroundPermissionsAsync: async () => ({ status: 'granted' }),
  hasServicesEnabledAsync: async () => mockLocation.servicesEnabled,
}));

type Modules = {
  RideStateManager: typeof import('../components/backgroundServices/RideStateManager').RideStateManager;
  BackgroundLocationService: typeof import('../components/backgroundServices/BackgroundLocationService').BackgroundLocationService;
  recoverActiveRide: typeof import('../components/backgroundServices/BackgroundRideTracker').recoverActiveRide;
  archiveEndedDraft: typeof import('../services/RideArchive').archiveEndedDraft;
  storage: typeof import('../services/RideStorage');
};

/** Load the app's ride modules from scratch, keeping only what is on disk. */
const coldStart = (): Modules => {
  jest.resetModules();
  delete (globalThis as any).__sbhra_bg_location_task_defined__;
  for (const name of Object.keys(mockTasks)) delete mockTasks[name];
  mockLocation.running = false;
  return {
    RideStateManager: require('../components/backgroundServices/RideStateManager').RideStateManager,
    BackgroundLocationService: require('../components/backgroundServices/BackgroundLocationService').BackgroundLocationService,
    recoverActiveRide: require('../components/backgroundServices/BackgroundRideTracker').recoverActiveRide,
    archiveEndedDraft: require('../services/RideArchive').archiveEndedDraft,
    storage: require('../services/RideStorage'),
  };
};

let now = 0;
const MIN = 60_000;
const T0 = Date.UTC(2026, 9, 18, 7, 0, 0);

const { getBoundaryCenter } = require('../utils/geofencing');
const inside = getBoundaryCenter();
const outside = { latitude: -33.9249, longitude: 18.4241 };

const fix = (coords: { latitude: number; longitude: number }) => ({
  coords: { ...coords, altitude: 10, accuracy: 5 },
  timestamp: now,
});

const deliver = (locations: object[]) =>
  mockTasks.BACKGROUND_LOCATION_TASK({ data: { locations } });

const draftOnDisk = () => {
  const raw = mockDisk.get(DRAFT_KEY);
  return raw ? JSON.parse(raw) : null;
};
const ridesOnDisk = (): any[] => JSON.parse(mockDisk.get('rides') ?? '[]');

/** Distinct recordings that survive on disk: archived rows plus a leftover draft. */
const recordingsOnDisk = () => {
  const ids = ridesOnDisk().map((r) => r.id);
  const draft = draftOnDisk();
  return { ids: new Set([...ids, ...(draft ? [draft.rideId] : [])]), rows: ids.length, draft };
};

const failOnce = (method: 'setItem' | 'removeItem', key: string) => {
  mockFaults[method] = (k) => {
    if (k !== key) return undefined;
    mockFaults[method] = undefined;
    return new Error(`disk full (${method} ${k})`);
  };
};

/** A ride recorded for ten minutes with two points. */
const recordRide = async (m: Modules) => {
  await m.RideStateManager.startRide('horse-1', 'Bella');
  await m.RideStateManager.addLocationPoint(
    { latitude: inside.latitude, longitude: inside.longitude, altitude: 10, timestamp: now },
    0,
    0
  );
  now += 10 * MIN;
  await m.RideStateManager.addLocationPoint(
    { latitude: inside.latitude + 0.001, longitude: inside.longitude, altitude: 12, timestamp: now },
    111,
    1.5
  );
};

/** What the Stop button does: stop tracking, end the draft, archive it. */
const finalize = async (m: Modules) => {
  await m.BackgroundLocationService.stop();
  await m.RideStateManager.endRide('user');
  return m.archiveEndedDraft();
};

beforeEach(() => {
  mockDisk.clear();
  mockFaults.setItem = undefined;
  mockFaults.removeItem = undefined;
  mockSaveRemote.mockReset().mockRejectedValue(new Error('offline'));
  mockListDocs.mockReset().mockResolvedValue([]);
  mockAuth.currentUser = { uid: 'rider-a' };
  mockLocation.servicesEnabled = true;
  now = T0;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(async () => {
  jest.restoreAllMocks();
});

describe('finalizing a ride', () => {
  const steps: Array<[string, () => void]> = [
    ['ending the draft', () => failOnce('setItem', DRAFT_KEY)],
    ['saving to ride history', () => failOnce('setItem', 'rides')],
    ['clearing the draft', () => failOnce('removeItem', DRAFT_KEY)],
  ];

  it.each(steps)('keeps exactly one ride when %s fails, then completes after a restart', async (_step, inject) => {
    const m = coldStart();
    await recordRide(m);
    const rideId = (await m.RideStateManager.getRideState())!.rideId;

    inject();
    await finalize(m).catch(() => undefined);

    // Process dies here and the app is relaunched
    const after = coldStart();
    const before = recordingsOnDisk();
    expect(before.ids).toEqual(new Set([rideId]));
    expect(before.rows).toBeLessThanOrEqual(1);

    const recovery = await after.RideStateManager.recoverFromCrash();
    expect(recovery.kind).not.toBe('none');

    // Whatever was left, the recovery paths finish it without duplicating it
    if (recovery.kind === 'active' || recovery.kind === 'stale') {
      await after.RideStateManager.endRide('user', recovery.ride.lastUpdateTime);
    }
    const result = await after.archiveEndedDraft();
    expect(result.status).toBe('archived');

    const done = recordingsOnDisk();
    expect(done.draft).toBeNull();
    expect(ridesOnDisk().map((r) => r.id)).toEqual([rideId]);
    expect(ridesOnDisk()[0].path).toHaveLength(2);
  });

  it('creates one ride when finalize runs twice, concurrently or in sequence', async () => {
    const m = coldStart();
    await recordRide(m);

    const [a, b] = await Promise.all([finalize(m), finalize(m)]);
    const c = await finalize(m);
    if (a.status !== 'archived') throw new Error('expected the ride to be archived');
    // Saving the same ride id again (e.g. a retry after a crash) is a no-op
    const again = await m.storage.saveRide({ ...a.ride, totalDistance: 999 });

    expect(b).toEqual(a);
    expect(c.status).toBe('none');
    expect(again.totalDistance).toBe(a.ride.totalDistance);
    expect(ridesOnDisk()).toHaveLength(1);
    expect(draftOnDisk()).toBeNull();
  });

  it('freezes the duration when the ride is stopped', async () => {
    const m = coldStart();
    await recordRide(m); // 10 minutes
    now += 5 * MIN;
    await m.RideStateManager.endRide('user');

    now += 2 * 60 * MIN;
    expect((await m.RideStateManager.toRideData())!.duration).toBe(15 * MIN);
    // A second stop does not move the end time
    await m.RideStateManager.endRide('boundary');
    const draft = (await m.RideStateManager.getRideState())!;
    expect(draft.endedAt).toBe(T0 + 15 * MIN);
    expect(draft.endReason).toBe('user');

    now += 24 * 60 * MIN;
    await m.archiveEndedDraft();
    expect(ridesOnDisk()[0].duration).toBe(15 * MIN);
  });

  it('ignores location samples that arrive after the ride ended', async () => {
    const m = coldStart();
    await recordRide(m);
    await m.RideStateManager.endRide('user');
    await m.RideStateManager.addLocationPoint(
      { latitude: inside.latitude, longitude: inside.longitude, altitude: 10, timestamp: now },
      50,
      1
    );
    const draft = draftOnDisk();
    expect(draft.isActive).toBe(false);
    expect(draft.path).toHaveLength(2);
  });
});

describe('automatic boundary stop', () => {
  it('archives the ride with its reason when no screen is mounted', async () => {
    const m = coldStart();
    await m.RideStateManager.startRide('horse-1', 'Bella');
    expect(await m.BackgroundLocationService.start()).toBe(true);

    await deliver([fix(inside)]);
    now += 30_000;
    await deliver([fix({ latitude: inside.latitude + 0.0005, longitude: inside.longitude })]);
    now += 60_000;
    // The rider has signed out by the time the boundary is crossed
    mockAuth.currentUser = null;
    await deliver([fix(outside), fix(outside)]);
    expect(draftOnDisk().isActive).toBe(true); // two outside samples are tolerated
    await deliver([fix(outside)]);

    expect(mockLocation.running).toBe(false);
    expect(draftOnDisk()).toBeNull();
    const [ride] = ridesOnDisk();
    expect(ride).toMatchObject({ endReason: 'boundary', userId: 'rider-a', syncState: 'pending' });
    expect(ride.path).toHaveLength(2);
    expect(ride.duration).toBe(90_000);
  });

  it('keeps the ended ride for the next launch when archiving fails', async () => {
    const m = coldStart();
    await m.RideStateManager.startRide(null, null);
    await m.BackgroundLocationService.start();
    await deliver([fix(inside)]);

    failOnce('setItem', 'rides');
    await deliver([fix(outside), fix(outside), fix(outside)]);
    expect(draftOnDisk()).toMatchObject({ isActive: false, endReason: 'boundary' });
    expect(ridesOnDisk()).toHaveLength(0);

    now += 24 * 60 * MIN;
    const next = coldStart();
    expect((await next.RideStateManager.recoverFromCrash()).kind).toBe('ended');
    await next.archiveEndedDraft();
    expect(ridesOnDisk()).toEqual([expect.objectContaining({ endReason: 'boundary' })]);
  });
});

describe('startup recovery', () => {
  it.each([
    ['59 minutes', 59 * MIN, 'active'],
    ['61 minutes', 61 * MIN, 'stale'],
    ['the next day', 26 * 60 * MIN, 'stale'],
  ])('deletes nothing after %s without updates', async (_label, idle, kind) => {
    const m = coldStart();
    await recordRide(m);
    const saved = draftOnDisk();

    now += idle;
    const next = coldStart();
    const recovery = await next.RideStateManager.recoverFromCrash();

    expect(recovery.kind).toBe(kind);
    expect(draftOnDisk()).toEqual(saved);
    expect((await next.RideStateManager.toRideData())!.path).toHaveLength(2);
  });

  it('reports a resume only when tracking really restarted', async () => {
    const m = coldStart();
    await recordRide(m);

    mockLocation.servicesEnabled = false;
    const next = coldStart();
    const failed = await next.recoverActiveRide();
    expect(failed).toMatchObject({ hasActiveRide: true, resumed: false });
    expect(draftOnDisk().isActive).toBe(true);

    mockLocation.servicesEnabled = true;
    const ok = await next.recoverActiveRide();
    expect(ok.resumed).toBe(true);
    expect(mockLocation.running).toBe(true);
  });

  it('upgrades a draft from before ride ids without dropping it', async () => {
    const legacy = {
      isActive: true,
      startTime: T0,
      path: [{ latitude: inside.latitude, longitude: inside.longitude, altitude: 10, timestamp: T0 }],
      totalDistance: 0,
      elevationGain: 0,
      horseId: null,
      horseName: null,
      lastUpdateTime: T0,
      currentSpeed: 0,
    };
    mockDisk.set(DRAFT_KEY, JSON.stringify(legacy));

    now += 3 * 60 * MIN;
    const m = coldStart();
    const recovery = await m.RideStateManager.recoverFromCrash();
    expect(recovery.kind).toBe('stale');
    expect(draftOnDisk()).toMatchObject({
      schemaVersion: 2,
      rideId: `legacy_active_${T0}`,
      ownerUid: null,
      path: legacy.path,
    });
  });
});

describe('starting a ride', () => {
  it('leaves no active ride when the draft cannot be persisted', async () => {
    const m = coldStart();
    failOnce('setItem', DRAFT_KEY);
    await expect(m.RideStateManager.startRide('horse-1', 'Bella')).rejects.toThrow('disk full');

    expect(await m.RideStateManager.hasActiveRide()).toBe(false);
    expect(draftOnDisk()).toBeNull();
    expect((await coldStart().RideStateManager.recoverFromCrash()).kind).toBe('none');
  });

  it('never overwrites an unsaved draft', async () => {
    const m = coldStart();
    await recordRide(m);
    await m.RideStateManager.endRide('boundary');
    const draft = draftOnDisk();

    await expect(m.RideStateManager.startRide(null, null)).rejects.toThrow();
    expect(draftOnDisk()).toEqual(draft);
  });

  it('counts failed point writes and keeps the points for the next write', async () => {
    const m = coldStart();
    await m.RideStateManager.startRide(null, null);
    expect(m.RideStateManager.getPersistHealth()).toMatchObject({ failedWrites: 0, degraded: false });

    failOnce('setItem', DRAFT_KEY);
    const point = { latitude: inside.latitude, longitude: inside.longitude, altitude: 10, timestamp: now };
    await expect(m.RideStateManager.addLocationPoint(point, 0, 0)).rejects.toThrow();
    expect(m.RideStateManager.getPersistHealth()).toMatchObject({ failedWrites: 1, degraded: true });

    await m.RideStateManager.updateKeepalive();
    expect(m.RideStateManager.getPersistHealth()).toMatchObject({ failedWrites: 1, degraded: false });
    expect(draftOnDisk().path).toEqual([point]);
  });
});

describe('ride ownership', () => {
  it('keeps a ride started as A with A after B signs in', async () => {
    mockSaveRemote.mockReset().mockImplementation(async (dto) => dto);
    const m = coldStart();
    await recordRide(m);

    mockAuth.currentUser = { uid: 'rider-b' };
    const result = await finalize(m);
    await m.storage.whenRideSyncIdle();

    expect(result.status === 'archived' && result.ride.userId).toBe('rider-a');
    expect(mockSaveRemote).not.toHaveBeenCalled();
    expect(await m.storage.getRides()).toEqual([]);

    // Uploaded once A is back
    mockAuth.currentUser = { uid: 'rider-a' };
    await m.storage.syncPendingRides();
    expect(mockSaveRemote).toHaveBeenCalledTimes(1);
    expect(mockSaveRemote).toHaveBeenCalledWith(expect.objectContaining({ userId: 'rider-a' }));
  });

  it('keeps a ride recorded signed out local', async () => {
    mockSaveRemote.mockReset().mockImplementation(async (dto) => dto);
    mockAuth.currentUser = null;
    const m = coldStart();
    await recordRide(m);

    mockAuth.currentUser = { uid: 'rider-b' };
    await finalize(m);
    await m.storage.syncPendingRides();
    expect(ridesOnDisk()[0]).toMatchObject({ userId: null, syncState: 'local' });
    expect(mockSaveRemote).not.toHaveBeenCalled();
  });
});

describe('upload queue', () => {
  it('uploads a ride saved during another upload with no further trigger', async () => {
    const m = coldStart();
    let releaseFirst!: () => void;
    const firstStarted = new Promise<void>((started) => {
      mockSaveRemote.mockReset().mockImplementationOnce(() => {
        started();
        return new Promise<void>((r) => (releaseFirst = r));
      });
    });
    mockSaveRemote.mockImplementation(async (dto) => dto);

    const a = await m.storage.saveRide({ startTime: 1000, path: [], totalDistance: 1, elevationGain: 0, duration: 1 });
    await firstStarted;
    const b = await m.storage.saveRide({ startTime: 2000, path: [], totalDistance: 1, elevationGain: 0, duration: 1 });
    releaseFirst();
    await m.storage.whenRideSyncIdle();

    expect(mockSaveRemote.mock.calls.map(([dto]) => dto.id)).toEqual([a.id, b.id]);
    expect(ridesOnDisk().map((r) => r.syncState)).toEqual(['synced', 'synced']);
  });
});
