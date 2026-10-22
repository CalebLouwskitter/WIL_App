/**
 * Ride State Manager
 * Manages the persisted draft of the ride being recorded.
 *
 * The draft is the only copy of a recording until the ride is archived into
 * RideStorage, so it is never deleted implicitly: it is cleared by id only
 * after the archive has been acknowledged, or after an explicit discard.
 *
 * Uses AsyncStorage for persistence across app sessions.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RidePoint, RideData, TrailProximity } from '../../hooks/useRideTracker';
import { currentUid, makeRideId, type RideEndReason } from '../../services/RideStorage';

const RIDE_STATE_KEY = '@sbhra_active_ride_state';
const CORRUPT_KEY_PREFIX = '@sbhra_active_ride_state_corrupt_';

export const RIDE_DRAFT_SCHEMA_VERSION = 2;

// A draft with no update for this long is offered as an interrupted ride
// instead of being resumed silently. It is never deleted for being old.
export const STALE_AFTER_MS = 60 * 60 * 1000;

export type { RideEndReason };

export interface PersistedRideState {
  schemaVersion: typeof RIDE_DRAFT_SCHEMA_VERSION;
  rideId: string;
  ownerUid: string | null; // signed-in user when the ride started
  isActive: boolean;
  startTime: number;
  endedAt: number | null; // frozen on the first endRide
  endReason: RideEndReason | null;
  path: RidePoint[];
  totalDistance: number;
  elevationGain: number;
  horseId: string | null;
  horseName: string | null;
  lastUpdateTime: number;
  currentSpeed: number;
  routeDistances?: Record<string, number>;
  snappedPath?: RidePoint[];
  nearestTrail?: TrailProximity | null;
  snappedCoordinate?: { latitude: number; longitude: number } | null;
  snapDistance?: number | null;
  snapRadius?: number | null;
  currentTrailId?: string | null;
  pendingSwitchId?: string | null;
  pendingCount?: number;
  farCount?: number;
}

/** RideData for a draft, carrying the identity it will be archived under. */
export type DraftRideData = RideData & {
  id: string;
  ownerUid: string | null;
  endedAt: number | null;
  endReason: RideEndReason | null;
  lastUpdateTime: number;
};

export type RecoveryKind = 'none' | 'active' | 'stale' | 'ended';

export type RecoveryResult =
  | { kind: 'none'; ride: null }
  | { kind: Exclude<RecoveryKind, 'none'>; ride: PersistedRideState };

export interface PersistHealth {
  failedWrites: number; // point/keepalive writes that failed during this ride
  lastError: string | null;
  degraded: boolean; // the most recent point/keepalive write failed
}

type V1State = Omit<PersistedRideState, 'schemaVersion' | 'rideId' | 'ownerUid' | 'endedAt' | 'endReason'> &
  Partial<PersistedRideState>;

/** Bring a stored draft to the current schema without losing any of it. */
const upgradeDraft = (raw: V1State): PersistedRideState => {
  if (raw.schemaVersion === RIDE_DRAFT_SCHEMA_VERSION && raw.rideId) {
    return raw as PersistedRideState;
  }
  // v1 drafts had no id, owner or end time. The id is derived from the start
  // time so repeated upgrades (e.g. if this write fails) agree with each other.
  return {
    ...raw,
    schemaVersion: RIDE_DRAFT_SCHEMA_VERSION,
    rideId: raw.rideId ?? `legacy_active_${raw.startTime}`,
    ownerUid: raw.ownerUid ?? null,
    endedAt: raw.endedAt ?? (raw.isActive ? null : raw.lastUpdateTime),
    endReason: raw.endReason ?? null,
  };
};

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Ride State Manager
 * Manages persistent state for active rides
 */
export class RideStateManager {
  private static currentState: PersistedRideState | null = null;
  private static listeners: Array<(state: PersistedRideState | null) => void> = [];
  private static health: PersistHealth = { failedWrites: 0, lastError: null, degraded: false };

  // Every write goes through this chain, so a late location sample can't
  // interleave with endRide/clearRideState and resurrect an ended ride.
  private static writeLock: Promise<unknown> = Promise.resolve();

  private static withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.writeLock.then(fn, fn);
    this.writeLock = run.catch(() => undefined);
    return run;
  }

  /**
   * Initialize a new ride. Throws if the draft could not be persisted, or if
   * a draft (active or ended) already exists: it must be archived or
   * discarded first so it is never overwritten.
   */
  static async startRide(
    horseId: string | null,
    horseName: string | null,
    ownerUid: string | null = currentUid()
  ): Promise<PersistedRideState> {
    return this.withWriteLock(async () => {
      const existing = await this.loadState();
      if (existing) {
        throw new Error('A previous ride has not been saved yet');
      }

      const now = Date.now();
      const state: PersistedRideState = {
        schemaVersion: RIDE_DRAFT_SCHEMA_VERSION,
        rideId: makeRideId(now),
        ownerUid,
        isActive: true,
        startTime: now,
        endedAt: null,
        endReason: null,
        path: [],
        totalDistance: 0,
        elevationGain: 0,
        horseId,
        horseName,
        lastUpdateTime: now,
        currentSpeed: 0,
        routeDistances: {},
        snappedPath: [],
        nearestTrail: null,
        snappedCoordinate: null,
        snapDistance: null,
        snapRadius: null,
        currentTrailId: null,
        pendingSwitchId: null,
        pendingCount: 0,
        farCount: 0,
      };

      // Only becomes the current ride once it is on disk.
      await this.saveState(state);
      this.currentState = state;
      this.health = { failedWrites: 0, lastError: null, degraded: false };
      this.notifyListeners();
      console.log('[RideStateManager] Ride started');
      return state;
    });
  }

  /**
   * Add a location point to the current ride, optionally with the snapping
   * metadata computed for it, as a single write.
   */
  static async addLocationPoint(
    point: RidePoint,
    distanceDelta: number,
    speed: number,
    metadata?: Partial<PersistedRideState>
  ): Promise<void> {
    await this.updateActive((state) => {
      const path = [...state.path, point];
      let elevationGain = state.elevationGain;

      // Update elevation gain - only if we have valid altitude and moved enough distance
      if (path.length > 1 && distanceDelta > 5) {
        const prevPoint = path[path.length - 2];
        if (point.altitude !== null && prevPoint.altitude !== null) {
          const elevationChange = point.altitude - prevPoint.altitude;
          if (elevationChange > 0) {
            elevationGain += elevationChange;
          }
        }
      }

      return {
        ...state,
        ...metadata,
        path,
        totalDistance: state.totalDistance + distanceDelta,
        elevationGain,
        currentSpeed: speed,
        lastUpdateTime: Date.now(),
      };
    });
  }

  /**
   * Update ride metadata (e.g., route distances, snapping info)
   */
  static async updateRideMetadata(updates: Partial<PersistedRideState>): Promise<void> {
    await this.updateActive((state) => ({ ...state, ...updates }));
  }

  /**
   * Update keepalive timestamp to prevent stale ride detection
   * Called periodically by background location service
   */
  static async updateKeepalive(): Promise<void> {
    await this.updateActive((state) => ({ ...state, lastUpdateTime: Date.now() }));
  }

  /**
   * End the current ride. Idempotent: a second call returns the already
   * ended draft unchanged, so the end time and reason are frozen by the first.
   * Throws if the ended draft could not be persisted.
   */
  static async endRide(reason: RideEndReason, endedAt?: number): Promise<PersistedRideState | null> {
    return this.withWriteLock(async () => {
      const state = await this.loadState();

      if (!state) {
        console.warn('[RideStateManager] No ride to end');
        return null;
      }
      if (!state.isActive) {
        return state;
      }

      const ended: PersistedRideState = {
        ...state,
        isActive: false,
        endedAt: Math.max(state.startTime, endedAt ?? Date.now()),
        endReason: reason,
        currentSpeed: 0,
      };

      await this.saveState(ended);
      this.currentState = ended;
      this.notifyListeners();

      console.log(`[RideStateManager] Ride ended (${reason})`);
      return ended;
    });
  }

  /**
   * Clear the draft, but only if it is still the ride the caller archived or
   * chose to discard. Returns false when a different (or no) draft is stored.
   */
  static async clearRideState(expectedRideId: string): Promise<boolean> {
    return this.withWriteLock(async () => {
      const state = await this.loadState();
      if (!state || state.rideId !== expectedRideId) {
        return false;
      }
      await AsyncStorage.removeItem(RIDE_STATE_KEY);
      this.currentState = null;
      this.notifyListeners();
      console.log('[RideStateManager] Ride state cleared');
      return true;
    });
  }

  /**
   * Get the current ride draft, or null if there is none or it can't be read.
   */
  static async getRideState(): Promise<PersistedRideState | null> {
    try {
      return await this.loadState();
    } catch (error) {
      console.error('[RideStateManager] Failed to load state:', error);
      return null;
    }
  }

  /**
   * Check if there's an active ride
   */
  static async hasActiveRide(): Promise<boolean> {
    const state = await this.getRideState();
    return state !== null && state.isActive;
  }

  /** Convert a draft to RideData. Duration stops at endedAt once ended. */
  static draftToRideData(state: PersistedRideState): DraftRideData {
    return {
      id: state.rideId,
      ownerUid: state.ownerUid,
      endedAt: state.endedAt,
      endReason: state.endReason,
      lastUpdateTime: state.lastUpdateTime,
      startTime: state.startTime,
      path: state.path,
      snappedPath: state.snappedPath,
      totalDistance: state.totalDistance,
      elevationGain: state.elevationGain,
      duration: Math.max(0, (state.endedAt ?? Date.now()) - state.startTime),
      horseId: state.horseId,
      horseName: state.horseName,
      routeDistances: state.routeDistances,
      nearestTrail: state.nearestTrail,
      snappedCoordinate: state.snappedCoordinate,
      snapDistance: state.snapDistance,
      snapRadius: state.snapRadius,
    };
  }

  /**
   * Convert persisted state to RideData format
   */
  static async toRideData(): Promise<DraftRideData | null> {
    const state = await this.getRideState();
    return state ? this.draftToRideData(state) : null;
  }

  /** How point/keepalive persistence is doing for the current ride. */
  static getPersistHealth(): PersistHealth {
    return { ...this.health };
  }

  /**
   * Subscribe to state changes
   */
  static subscribe(listener: (state: PersistedRideState | null) => void): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get ride statistics
   */
  static async getRideStats(): Promise<{
    duration: number;
    distance: number;
    elevationGain: number;
    avgSpeed: number;
    pointCount: number;
  } | null> {
    const state = await this.getRideState();

    if (!state) return null;

    const duration = this.draftToRideData(state).duration / 1000; // seconds
    const avgSpeed = duration > 0 ? state.totalDistance / duration : 0;

    return {
      duration: duration * 1000, // back to ms
      distance: state.totalDistance,
      elevationGain: state.elevationGain,
      avgSpeed,
      pointCount: state.path.length,
    };
  }

  /**
   * Classify the stored draft on app startup. Never deletes anything: age
   * only changes what the user is offered.
   */
  static async recoverFromCrash(now: number = Date.now()): Promise<RecoveryResult> {
    const state = await this.getRideState();

    if (!state) {
      return { kind: 'none', ride: null };
    }
    if (!state.isActive) {
      return { kind: 'ended', ride: state };
    }
    if (now - state.lastUpdateTime > STALE_AFTER_MS) {
      console.warn('[RideStateManager] Found an interrupted ride with no recent updates');
      return { kind: 'stale', ride: state };
    }

    console.log('[RideStateManager] Recovered active ride from crash');
    return { kind: 'active', ride: state };
  }

  // ---- internals ----

  /**
   * Read the draft (cached after the first read). Throws if storage can't be
   * read. A v1 draft is upgraded and written back; an unparseable draft is
   * moved aside rather than discarded.
   */
  private static async loadState(): Promise<PersistedRideState | null> {
    if (this.currentState !== null) {
      return this.currentState;
    }

    const json = await AsyncStorage.getItem(RIDE_STATE_KEY);
    if (!json) return null;

    let parsed: V1State;
    try {
      parsed = JSON.parse(json);
    } catch (error) {
      console.error('[RideStateManager] Stored ride draft is unreadable; keeping a copy', error);
      await AsyncStorage.setItem(`${CORRUPT_KEY_PREFIX}${Date.now()}`, json);
      await AsyncStorage.removeItem(RIDE_STATE_KEY);
      return null;
    }

    const state = upgradeDraft(parsed);
    if (state !== parsed) {
      try {
        await this.saveState(state);
        console.log('[RideStateManager] Upgraded ride draft to schema v2');
      } catch (error) {
        // Still usable in memory; the upgrade is deterministic and retried next load.
        console.warn('[RideStateManager] Could not persist upgraded draft:', error);
      }
    }
    this.currentState = state;
    return state;
  }

  /**
   * Apply an update to the active draft. On a failed write the update is kept
   * in memory (the next successful write persists it) and counted, then the
   * error is rethrown for the caller.
   */
  private static updateActive(
    update: (state: PersistedRideState) => PersistedRideState
  ): Promise<void> {
    return this.withWriteLock(async () => {
      const state = await this.loadState();
      if (!state || !state.isActive) {
        return;
      }

      const next = update(state);
      this.currentState = next;
      try {
        await this.saveState(next);
        this.health = { ...this.health, degraded: false };
      } catch (error) {
        this.health = {
          failedWrites: this.health.failedWrites + 1,
          lastError: errorMessage(error),
          degraded: true,
        };
        throw error;
      } finally {
        this.notifyListeners();
      }
    });
  }

  /**
   * Save state to AsyncStorage. Rethrows so callers know the draft is not durable.
   */
  private static async saveState(state: PersistedRideState): Promise<void> {
    try {
      await AsyncStorage.setItem(RIDE_STATE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('[RideStateManager] Failed to save state:', error);
      throw error;
    }
  }

  /**
   * Notify all listeners of state changes
   */
  private static notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.currentState);
      } catch (error) {
        console.error('[RideStateManager] Listener error:', error);
      }
    });
  }
}
