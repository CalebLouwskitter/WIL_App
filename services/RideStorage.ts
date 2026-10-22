import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import type { RideData, RidePoint } from '../hooks/useRideTracker';
import { FIREBASE_ENABLED, auth } from './firebase';
import { saveRideAndUpdateAggregates, newRide, ridePointToDTO, ridePointFromDTO, listDocs, Converters, COLLECTIONS, type RideDTO } from './Data';

// Rides are always written to the device first, then uploaded by a sync queue.
// The trails often have poor signal, so the upload can't be part of saving.

const STORAGE_KEY = 'rides';
const MAX_SYNCED_KEPT = 50; // synced rides kept on the device for offline viewing
const UPLOAD_TIMEOUT_MS = 30_000;

/**
 * pending: waiting to be uploaded for userId
 * synced:  uploaded; Firestore is the source of truth
 * local:   never uploaded (Firebase disabled, or saved before the queue existed)
 */
export type SyncState = 'pending' | 'synced' | 'local';

/** Why a recording ended: the rider stopped it, it left the riding area, or it was saved after an interruption. */
export type RideEndReason = 'user' | 'boundary' | 'stale';

export type StoredRide = RideData & {
  id: string;
  userId: string | null;
  syncState: SyncState;
  endReason?: RideEndReason | null;
  attempts?: number;
  lastError?: string;
};

/**
 * A ride being saved. ownerUid, when present, is the account the ride was
 * recorded under (null = recorded signed out) and wins over whoever is signed
 * in now.
 */
export type RideToSave = RideData & {
  ownerUid?: string | null;
  endReason?: RideEndReason | null;
};

export type SyncResult = { synced: number; failed: number };

export const currentUid = (): string | null => (FIREBASE_ENABLED ? auth?.currentUser?.uid ?? null : null);

export const makeRideId = (startTime: number) =>
  `${startTime}_${Math.random().toString(36).slice(2, 10)}`;

// All read-modify-write cycles go through this chain so a sync finishing in the
// background can't overwrite a ride that was saved while it was uploading.
let storageLock: Promise<unknown> = Promise.resolve();

const withStorageLock = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = storageLock.then(fn, fn);
  storageLock = run.catch(() => undefined);
  return run;
};

const readStored = async (): Promise<StoredRide[]> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  const parsed: (RideData & Partial<StoredRide>)[] = raw ? JSON.parse(raw) : [];
  // Rides saved before the queue existed have no id; their upload status is
  // unknown, so keep them on the device without uploading (avoids duplicates).
  return parsed.map((r) =>
    r.id && r.syncState
      ? (r as StoredRide)
      : { ...r, id: r.id ?? `legacy_${r.startTime}`, userId: r.userId ?? null, syncState: 'local' as const }
  );
};

const mutateStored = (fn: (rides: StoredRide[]) => StoredRide[]) =>
  withStorageLock(async () => {
    const next = fn(await readStored());
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  });

const pruneSynced = (rides: StoredRide[]) => {
  const synced = rides
    .filter((r) => r.syncState === 'synced')
    .sort((a, b) => b.startTime - a.startTime);
  const drop = new Set(synced.slice(MAX_SYNCED_KEPT).map((r) => r.id));
  return rides.filter((r) => !drop.has(r.id));
};

const toPointDTO = (point: RidePoint) =>
  ridePointToDTO({
    latitude: point.latitude,
    longitude: point.longitude,
    altitude: point.altitude ?? 0,
    timestamp: point.timestamp,
  });

export const toRideDTO = (ride: StoredRide, userId: string): RideDTO =>
  newRide({
    id: ride.id,
    userId,
    startTime: ride.startTime,
    endTime: ride.startTime + (ride.duration || 0),
    totalDistance: ride.totalDistance,
    elevationGain: ride.elevationGain,
    duration: ride.duration,
    path: (ride.path || []).map(toPointDTO),
    snappedPath: ride.snappedPath ? ride.snappedPath.map(toPointDTO) : undefined,
    routeDistances: ride.routeDistances,
    horseId: ride.horseId ?? null,
    horseName: ride.horseName ?? null,
  });

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

let inFlightSync: Promise<SyncResult> | null = null;
// Set when a sync is requested while one is running; that run then makes
// another pass so a ride saved mid-upload doesn't wait for the next trigger.
let syncDirty = false;

/** Upload every pending ride that belongs to the signed-in user. */
export const syncPendingRides = (): Promise<SyncResult> => {
  if (inFlightSync) {
    syncDirty = true;
    return inFlightSync;
  }
  inFlightSync = (async () => {
    const total: SyncResult = { synced: 0, failed: 0 };
    do {
      syncDirty = false;
      const pass = await runSync();
      total.synced += pass.synced;
      total.failed += pass.failed;
    } while (syncDirty);
    return total;
  })().finally(() => {
    inFlightSync = null;
  });
  return inFlightSync;
};

/** Resolves once no sync is running. Does not start one. */
export const whenRideSyncIdle = async (): Promise<void> => {
  while (inFlightSync) {
    await inFlightSync.catch(() => undefined);
  }
};

const runSync = async (): Promise<SyncResult> => {
  const result: SyncResult = { synced: 0, failed: 0 };
  const uid = currentUid();
  if (!uid) return result;

  const pending = (await readStored()).filter((r) => r.syncState === 'pending' && r.userId === uid);
  for (const ride of pending) {
    try {
      await withTimeout(saveRideAndUpdateAggregates(toRideDTO(ride, uid)), UPLOAD_TIMEOUT_MS);
      result.synced += 1;
      await mutateStored((rides) =>
        pruneSynced(
          rides.map((r) => (r.id === ride.id ? { ...r, syncState: 'synced', lastError: undefined } : r))
        )
      );
    } catch (e) {
      result.failed += 1;
      const message = e instanceof Error ? e.message : String(e);
      await mutateStored((rides) =>
        rides.map((r) => (r.id === ride.id ? { ...r, attempts: (r.attempts ?? 0) + 1, lastError: message } : r))
      );
    }
  }
  return result;
};

/**
 * Save a finished ride. Resolves as soon as it is on the device; the upload
 * runs in the background and is retried by startRideSync when back online.
 * Saving an id that is already stored returns the stored row unchanged.
 */
export const saveRide = async ({ ownerUid, ...ride }: RideToSave): Promise<StoredRide> => {
  const owner = ownerUid !== undefined ? ownerUid : currentUid();
  const candidate: StoredRide = {
    ...ride,
    id: ride.id ?? makeRideId(ride.startTime),
    userId: owner,
    syncState: owner ? 'pending' : 'local',
    pendingSync: undefined,
  };
  let stored = candidate;
  await mutateStored((rides) => {
    const existing = rides.find((r) => r.id === candidate.id);
    if (existing) {
      stored = existing;
      return rides;
    }
    return [...rides, candidate];
  });
  if (stored.syncState === 'pending') {
    syncPendingRides().catch((e) => console.warn('Ride sync failed:', e));
  }
  return stored;
};

const toRideData = ({ userId, syncState, attempts, lastError, ...ride }: StoredRide): RideData => ({
  ...ride,
  pendingSync: syncState === 'pending',
});

/**
 * The signed-in user's rides, newest first: everything in Firestore plus any
 * ride on this device that hasn't been uploaded yet.
 */
export const getRides = async (): Promise<RideData[]> => {
  const uid = currentUid();
  const local = await readStored();
  const byNewest = (a: RideData, b: RideData) => b.startTime - a.startTime;

  if (uid) {
    const mine = local.filter((r) => r.userId === uid);
    try {
      const docs = await listDocs<RideDTO>(COLLECTIONS.rides, {
        where: ['userId', '==', uid],
        orderBy: ['startTime', 'desc'],
        converter: Converters?.ride as any,
      });
      const remote: RideData[] = docs.map((r) => ({
        id: r.id,
        startTime: r.startTime,
        path: (r.path || []).map(ridePointFromDTO),
        snappedPath: r.snappedPath ? (r.snappedPath || []).map(ridePointFromDTO) : undefined,
        totalDistance: r.totalDistance,
        elevationGain: r.elevationGain,
        duration: r.duration,
        routeDistances: r.routeDistances,
        horseId: r.horseId ?? undefined,
        horseName: r.horseName ?? undefined,
      }));
      const remoteIds = new Set(remote.map((r) => r.id));
      const notUploaded = mine.filter((r) => r.syncState === 'pending' && !remoteIds.has(r.id)).map(toRideData);
      return [...remote, ...notUploaded].sort(byNewest);
    } catch (e) {
      console.warn('Failed to load rides from Firestore, falling back to local:', e);
      return local
        .filter((r) => r.userId === uid || r.userId === null)
        .map(toRideData)
        .sort(byNewest);
    }
  }
  return local.map(toRideData).sort(byNewest);
};

/** Number of rides on this device still waiting to be uploaded. */
export const getPendingRideCount = async (): Promise<number> => {
  const uid = currentUid();
  return (await readStored()).filter((r) => r.syncState === 'pending' && (!uid || r.userId === uid)).length;
};

/**
 * Retry pending uploads now, whenever the device comes back online, and when
 * the app returns to the foreground. Returns an unsubscribe function.
 */
export const startRideSync = (): (() => void) => {
  const trySync = () => {
    syncPendingRides().catch((e) => console.warn('Ride sync failed:', e));
  };
  trySync();
  const unsubscribeNet = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) trySync();
  });
  const appStateSub = AppState.addEventListener('change', (state) => {
    if (state === 'active') trySync();
  });
  return () => {
    unsubscribeNet();
    appStateSub.remove();
  };
};
