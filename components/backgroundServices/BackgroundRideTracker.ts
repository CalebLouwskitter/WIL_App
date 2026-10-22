/**
 * Background Ride Tracker
 * Enhanced ride tracker that supports background mode
 * Integrates with BackgroundLocationService and RideStateManager
 *
 * This is the recommended tracker for production use.
 * It needs both foreground and background location permission; there is no
 * foreground-only mode, so starting fails if either is denied.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { BackgroundLocationService } from './BackgroundLocationService';
import { RideStateManager, type DraftRideData, type RecoveryKind } from './RideStateManager';
import { archiveEndedDraft } from '../../services/RideArchive';
import { AppState, AppStateStatus } from 'react-native';

export const PERSIST_WARNING = 'Recording may not be saved: this device could not store the latest GPS points.';

export type BackgroundRideStatus =
  | 'idle'
  | 'starting'
  | 'active_foreground'
  | 'active_background'
  | 'stopping'
  | 'error';

export type StartRideResult = { ok: true } | { ok: false; error: string };

export interface UseBackgroundRideTrackerResult {
  rideData: DraftRideData | null;
  status: BackgroundRideStatus;
  currentSpeed: number;
  startRide: (horseId: string | null, horseName: string | null) => Promise<StartRideResult>;
  /** Ends the ride and returns it; the ended draft is kept until archived. */
  stopRide: () => Promise<DraftRideData | null>;
  isBackgroundEnabled: boolean;
  error: string | null;
  /** Set while the latest GPS points could not be written to the device. */
  persistWarning: string | null;
}

/**
 * Custom hook for background-capable ride tracking
 */
export function useBackgroundRideTracker(): UseBackgroundRideTrackerResult {
  const [rideData, setRideData] = useState<DraftRideData | null>(null);
  const [status, setStatus] = useState<BackgroundRideStatus>('idle');
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [isBackgroundEnabled, setIsBackgroundEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [persistWarning, setPersistWarning] = useState<string | null>(null);

  const refreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateUnsubscribe = useRef<(() => void) | null>(null);
  const appStateSubscription = useRef<any>(null);
  const healthCheckInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check for background permission on mount
  useEffect(() => {
    checkBackgroundPermission();
  }, []);

  // Initialize from persisted active ride on mount (e.g., after resume).
  // A stale draft is left for the recovery prompt instead of resumed silently.
  useEffect(() => {
    (async () => {
      try {
        const { kind, ride } = await RideStateManager.recoverFromCrash();
        if (kind === 'active' && ride) {
          setRideData(RideStateManager.draftToRideData(ride));
          // Set appropriate status based on app foreground/background
          const appState = AppState.currentState;
          setStatus(appState === 'active' ? 'active_foreground' : 'active_background');

          // Make sure background tracking is running
          const running = await BackgroundLocationService.isTaskRunning();
          if (!running && !(await BackgroundLocationService.start())) {
            setError('Background tracking could not be restarted. Stop the ride to save what was recorded.');
          }
        }
      } catch (e) {
        // noop: keep defaults
      }
    })();
  }, []);

  // Subscribe to ride state changes
  useEffect(() => {
    const unsubscribe = RideStateManager.subscribe((state) => {
      const health = RideStateManager.getPersistHealth();
      setPersistWarning(state?.isActive && health.degraded ? PERSIST_WARNING : null);
      if (state && state.isActive) {
        setRideData(RideStateManager.draftToRideData(state));
        setCurrentSpeed(state.currentSpeed * 3.6); // m/s to km/h
        // Ensure status reflects an active ride
        setStatus(AppState.currentState === 'active' ? 'active_foreground' : 'active_background');
      } else {
        // No active ride
        setRideData(null);
        setCurrentSpeed(0);
        setStatus((prev) => (prev === 'error' || prev === 'starting' ? prev : 'idle'));
      }
    });

    stateUnsubscribe.current = unsubscribe;

    return () => {
      if (stateUnsubscribe.current) {
        stateUnsubscribe.current();
        stateUnsubscribe.current = null;
      }
    };
  }, []);

  // Monitor app state transitions (foreground <-> background)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    appStateSubscription.current = subscription;

    return () => {
      if (appStateSubscription.current) {
        appStateSubscription.current.remove();
      }
    };
  }, []);

  // Health check to ensure background tracking stays alive
  useEffect(() => {
    if (status === 'active_foreground' || status === 'active_background') {
      // Check every 10 seconds that background service is still running
      healthCheckInterval.current = setInterval(async () => {
        const isRunning = await BackgroundLocationService.isTaskRunning();
        if (!isRunning) {
          console.warn('[BackgroundRideTracker] Health check failed - restarting background service');
          const restarted = await BackgroundLocationService.start();
          if (!restarted) {
            console.error('[BackgroundRideTracker] Failed to restart background service');
            setError('Background tracking stopped unexpectedly');
          }
        }
      }, 10000); // Check every 10 seconds
    } else {
      if (healthCheckInterval.current) {
        clearInterval(healthCheckInterval.current);
        healthCheckInterval.current = null;
      }
    }

    return () => {
      if (healthCheckInterval.current) {
        clearInterval(healthCheckInterval.current);
        healthCheckInterval.current = null;
      }
    };
  }, [status]);

  // Periodic refresh when ride is active (for UI updates)
  useEffect(() => {
    if (status === 'active_foreground' || status === 'active_background') {
      refreshInterval.current = setInterval(async () => {
        const data = await RideStateManager.toRideData();
        if (data && data.endedAt === null) {
          setRideData(data);
        }
      }, 1000); // Update UI every second
    } else {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
        refreshInterval.current = null;
      }
    }

    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
        refreshInterval.current = null;
      }
    };
  }, [status]);

  // Check if background location is available
  const checkBackgroundPermission = async () => {
    const hasPerms = await BackgroundLocationService.hasPermissions();
    setIsBackgroundEnabled(hasPerms);
  };

  // Handle app state changes. The listener is installed once, so status is
  // read through functional updates rather than a captured value.
  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    const hasActive = await RideStateManager.hasActiveRide();

    if (!hasActive) return;

    if (nextAppState === 'background' || nextAppState === 'inactive') {
      // App going to background
      setStatus((prev) => (prev === 'active_foreground' ? 'active_background' : prev));
    } else if (nextAppState === 'active') {
      // App coming to foreground
      setStatus((prev) => (prev === 'active_background' ? 'active_foreground' : prev));

      // Refresh ride data
      const data = await RideStateManager.toRideData();
      if (data && data.endedAt === null) {
        setRideData(data);
      }
    }
  };

  /**
   * Start tracking a ride
   */
  const startRide = useCallback(async (
    horseId: string | null,
    horseName: string | null
  ): Promise<StartRideResult> => {
    const fail = (message: string, nextStatus: BackgroundRideStatus = 'error'): StartRideResult => {
      setError(message);
      setStatus(nextStatus);
      return { ok: false, error: message };
    };

    try {
      setStatus('starting');
      setError(null);

      // A previous recording must be saved before a new one can start
      const existing = await RideStateManager.recoverFromCrash();
      if (existing.kind === 'active' || existing.kind === 'stale') {
        console.warn('[BackgroundRideTracker] Active ride already exists');
        return fail('A ride is already in progress. Resume or save it before starting another.', 'idle');
      }
      if (existing.kind === 'ended') {
        try {
          await archiveEndedDraft();
        } catch (e) {
          console.error('[BackgroundRideTracker] Could not archive previous ride:', e);
          return fail('Your previous ride could not be saved to Ride History yet, so a new ride was not started. Please try again.');
        }
      }

      // Request permissions
      const hasPerms = await BackgroundLocationService.hasPermissions();
      if (!hasPerms) {
        const granted = await BackgroundLocationService.requestPermissions();
        if (!granted) {
          return fail('Location permissions are required');
        }
        setIsBackgroundEnabled(true);
      }

      // Initialize ride state; nothing is recorded unless this is on disk
      let draft;
      try {
        draft = await RideStateManager.startRide(horseId, horseName);
      } catch (e) {
        console.error('[BackgroundRideTracker] Could not persist new ride:', e);
        return fail('This device could not store ride data, so the ride was not started. Free some storage and try again.');
      }

      // Start background location service
      const started = await BackgroundLocationService.start();
      if (!started) {
        // Nothing was recorded yet, so this empty draft can go
        await RideStateManager.clearRideState(draft.rideId).catch((e) =>
          console.warn('[BackgroundRideTracker] Could not clear unstarted ride:', e)
        );
        return fail('Failed to start background location service');
      }

      setPersistWarning(null);
      setStatus('active_foreground');
      console.log('[BackgroundRideTracker] Ride started successfully');
      return { ok: true };
    } catch (err) {
      console.error('[BackgroundRideTracker] Failed to start ride:', err);
      return fail(err instanceof Error ? err.message : 'Failed to start ride');
    }
  }, []);

  /**
   * Stop tracking and return final ride data
   */
  const stopRide = useCallback(async (): Promise<DraftRideData | null> => {
    try {
      setStatus('stopping');
      setError(null);

      // Stop background location service
      await BackgroundLocationService.stop();

      // End the ride. The ended draft stays stored until it is archived.
      const finalState = await RideStateManager.endRide('user');
      if (!finalState) {
        console.warn('[BackgroundRideTracker] No active ride to stop');
        setStatus('idle');
        return null;
      }

      setRideData(null);
      setCurrentSpeed(0);
      setPersistWarning(null);
      setStatus('idle');

      console.log('[BackgroundRideTracker] Ride stopped successfully');
      return RideStateManager.draftToRideData(finalState);
    } catch (err) {
      console.error('[BackgroundRideTracker] Failed to stop ride:', err);
      setError(err instanceof Error ? err.message : 'Failed to stop ride');
      setStatus('error');
      return null;
    }
  }, []);

  return {
    rideData,
    status,
    currentSpeed,
    startRide,
    stopRide,
    isBackgroundEnabled,
    error,
    persistWarning,
  };
}

export interface RecoverActiveRideResult {
  kind: RecoveryKind;
  hasActiveRide: boolean;
  rideData: DraftRideData | null;
  /** True only if background tracking is actually running again. */
  resumed: boolean;
}

/**
 * Resume recording an interrupted (active or stale) ride. `resumed` reports
 * whether the location service really restarted; on false the draft is kept
 * untouched so it can still be saved.
 */
export async function recoverActiveRide(): Promise<RecoverActiveRideResult> {
  try {
    const { kind, ride } = await RideStateManager.recoverFromCrash();

    if ((kind === 'active' || kind === 'stale') && ride) {
      // Resume background tracking if ride was active
      const resumed = await BackgroundLocationService.start();
      if (!resumed) {
        console.warn('[BackgroundRideTracker] Failed to resume background tracking');
      } else {
        // Refresh the keepalive so the draft is no longer considered stale
        // and subscribers see it as active again.
        await RideStateManager.updateKeepalive().catch((e) =>
          console.warn('[BackgroundRideTracker] Could not refresh keepalive:', e)
        );
      }

      return {
        kind,
        hasActiveRide: true,
        rideData: RideStateManager.draftToRideData(ride),
        resumed,
      };
    }

    return { kind, hasActiveRide: false, rideData: null, resumed: false };
  } catch (error) {
    console.error('[BackgroundRideTracker] Failed to recover active ride:', error);
    return { kind: 'none', hasActiveRide: false, rideData: null, resumed: false };
  }
}
