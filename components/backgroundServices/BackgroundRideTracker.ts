/**
 * Background Ride Tracker
 * Enhanced ride tracker that supports background mode
 * Integrates with BackgroundLocationService and RideStateManager
 * 
 * This is the recommended tracker for production use.
 * Falls back gracefully to foreground-only tracking if background permissions are denied.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import { BackgroundLocationService } from './BackgroundLocationService';
import { RideStateManager } from './RideStateManager';
import type { RideData } from '../../hooks/useRideTracker';
import { AppState, AppStateStatus } from 'react-native';

export type BackgroundRideStatus = 
  | 'idle' 
  | 'starting' 
  | 'active_foreground' 
  | 'active_background' 
  | 'stopping' 
  | 'error';

export interface UseBackgroundRideTrackerResult {
  rideData: RideData | null;
  status: BackgroundRideStatus;
  currentSpeed: number;
  startRide: (horseId: string | null, horseName: string | null) => Promise<boolean>;
  stopRide: () => Promise<RideData | null>;
  isBackgroundEnabled: boolean;
  error: string | null;
}

/**
 * Custom hook for background-capable ride tracking
 */
export function useBackgroundRideTracker(): UseBackgroundRideTrackerResult {
  const [rideData, setRideData] = useState<RideData | null>(null);
  const [status, setStatus] = useState<BackgroundRideStatus>('idle');
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [isBackgroundEnabled, setIsBackgroundEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const refreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateUnsubscribe = useRef<(() => void) | null>(null);
  const appStateSubscription = useRef<any>(null);
  const healthCheckInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check for background permission on mount
  useEffect(() => {
    checkBackgroundPermission();
  }, []);

  // Initialize from persisted active ride on mount (e.g., after resume)
  useEffect(() => {
    (async () => {
      try {
        const hasActive = await RideStateManager.hasActiveRide();
        if (hasActive) {
          const data = await RideStateManager.toRideData();
          if (data) {
            setRideData(data);
          }
          // Set appropriate status based on app foreground/background
          const appState = AppState.currentState;
          setStatus(appState === 'active' ? 'active_foreground' : 'active_background');

          // Make sure background tracking is running
          const running = await BackgroundLocationService.isTaskRunning();
          if (!running) {
            await BackgroundLocationService.start();
          }
        }
      } catch (e) {
        // noop: keep defaults
      }
    })();
  }, []);

  // Subscribe to ride state changes
  useEffect(() => {
    const unsubscribe = RideStateManager.subscribe(async (state) => {
      if (state && state.isActive) {
        const rideData = await RideStateManager.toRideData();
        setRideData(rideData);
        setCurrentSpeed(state.currentSpeed * 3.6); // m/s to km/h
        // Ensure status reflects an active ride
        setStatus(AppState.currentState === 'active' ? 'active_foreground' : 'active_background');
      } else {
        // No active ride
        setRideData(null);
        setCurrentSpeed(0);
        setStatus('idle');
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
        if (data) {
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

  // Handle app state changes
  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    const hasActive = await RideStateManager.hasActiveRide();
    
    if (!hasActive) return;

    if (nextAppState === 'background' || nextAppState === 'inactive') {
      // App going to background
      if (status === 'active_foreground') {
        setStatus('active_background');
        console.log('[BackgroundRideTracker] App backgrounded, ride continues');
      }
    } else if (nextAppState === 'active') {
      // App coming to foreground
      if (status === 'active_background') {
        setStatus('active_foreground');
        console.log('[BackgroundRideTracker] App foregrounded, ride continues');
        
        // Refresh ride data
        const data = await RideStateManager.toRideData();
        if (data) {
          setRideData(data);
        }
      }
    }
  };

  /**
   * Start tracking a ride
   */
  const startRide = useCallback(async (
    horseId: string | null, 
    horseName: string | null
  ): Promise<boolean> => {
    try {
      setStatus('starting');
      setError(null);

      // Check for active ride
      const hasActive = await RideStateManager.hasActiveRide();
      if (hasActive) {
        console.warn('[BackgroundRideTracker] Active ride already exists');
        setError('A ride is already in progress');
        setStatus('idle');
        return false;
      }

      // Request permissions
      const hasPerms = await BackgroundLocationService.hasPermissions();
      if (!hasPerms) {
        const granted = await BackgroundLocationService.requestPermissions();
        if (!granted) {
          setError('Location permissions are required');
          setStatus('error');
          return false;
        }
        setIsBackgroundEnabled(true);
      }

      // Initialize ride state
      await RideStateManager.startRide(horseId, horseName);

      // Start background location service
      const started = await BackgroundLocationService.start();
      if (!started) {
        setError('Failed to start background location service');
        setStatus('error');
        await RideStateManager.clearRideState();
        return false;
      }

      setStatus('active_foreground');
      console.log('[BackgroundRideTracker] Ride started successfully');
      return true;
    } catch (err) {
      console.error('[BackgroundRideTracker] Failed to start ride:', err);
      setError(err instanceof Error ? err.message : 'Failed to start ride');
      setStatus('error');
      return false;
    }
  }, []);

  /**
   * Stop tracking and return final ride data
   */
  const stopRide = useCallback(async (): Promise<RideData | null> => {
    try {
      setStatus('stopping');
      setError(null);

      // Stop background location service
      await BackgroundLocationService.stop();

      // End the ride
      const finalState = await RideStateManager.endRide();
      if (!finalState) {
        console.warn('[BackgroundRideTracker] No active ride to stop');
        setStatus('idle');
        return null;
      }

      // Convert to RideData format
      const finalRideData = await RideStateManager.toRideData();

      // Clear the ride state
      await RideStateManager.clearRideState();

      setRideData(null);
      setCurrentSpeed(0);
      setStatus('idle');
      
      console.log('[BackgroundRideTracker] Ride stopped successfully');
      return finalRideData;
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
  };
}

/**
 * Utility function to recover from app crash
 * Call this during app initialization
 */
export async function recoverActiveRide(): Promise<{
  hasActiveRide: boolean;
  rideData: RideData | null;
}> {
  try {
    const hasRecovered = await RideStateManager.recoverFromCrash();
    
    if (hasRecovered) {
      const rideData = await RideStateManager.toRideData();
      
      // Resume background tracking if ride was active
      const started = await BackgroundLocationService.start();
      if (!started) {
        console.warn('[BackgroundRideTracker] Failed to resume background tracking');
      }
      
      return {
        hasActiveRide: true,
        rideData,
      };
    }
    
    return {
      hasActiveRide: false,
      rideData: null,
    };
  } catch (error) {
    console.error('[BackgroundRideTracker] Failed to recover active ride:', error);
    return {
      hasActiveRide: false,
      rideData: null,
    };
  }
}
