/**
 * Background Location Service
 * Manages continuous location tracking even when app is backgrounded
 * Compatible with both iOS and Android
 * 
 * References:
 * - Expo Location background tasks: https://docs.expo.dev/versions/latest/sdk/location/
 * - Expo Task Manager: https://docs.expo.dev/versions/latest/sdk/task-manager/
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { RideStateManager } from './RideStateManager';
import haversine from 'haversine';
import type { RidePoint } from '../../hooks/useRideTracker';

// Task name for background location tracking
const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TASK';

// Background location configuration
const BACKGROUND_LOCATION_CONFIG = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 1000, // Update every 1 second
  distanceInterval: 1, // Update every 1 meter
  showsBackgroundLocationIndicator: true, // iOS: show blue bar
  foregroundService: {
    // Android foreground service configuration
    notificationTitle: 'SBHRA - Ride in Progress',
    notificationBody: 'Recording your horse ride',
    notificationColor: '#4A90E2',
  },
  // iOS background mode
  pausesUpdatesAutomatically: false,
  activityType: Location.ActivityType.Fitness,
};

// Noise filter thresholds (same as foreground tracker)
const MIN_STEP_METERS = 1;
const MAX_STEP_METERS = 60;
const MAX_SPEED_MPS = 15;
const SMOOTH_ALPHA = 0.3;

/**
 * Define the background location task
 * This function runs in the background when location updates are received
 */
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('[BackgroundLocation] Task error:', error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    
    // Process each location update
    for (const location of locations) {
      try {
        await processLocationUpdate(location);
      } catch (err) {
        console.error('[BackgroundLocation] Error processing location:', err);
      }
    }
  }
});

/**
 * Process a single location update
 */
async function processLocationUpdate(location: Location.LocationObject) {
  // Get the current ride state
  const rideState = await RideStateManager.getRideState();
  
  if (!rideState || !rideState.isActive) {
    // No active ride, stop background tracking
    await BackgroundLocationService.stop();
    return;
  }

  const point: RidePoint = {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    altitude: location.coords.altitude ?? 0,
    timestamp: Date.now(),
  };

  // Apply noise filtering
  const path = rideState.path || [];
  let usePoint = point;
  let shouldSkip = false;

  if (path.length > 0) {
    const prev = path[path.length - 1];
    const dt = Math.max(1, (point.timestamp - prev.timestamp) / 1000);
    const d = haversine(prev, point, { unit: 'meter' });
    const speed = d / dt;

    // Ignore tiny jitter
    if (d < MIN_STEP_METERS) {
      shouldSkip = true;
    }
    
    // Ignore unrealistic jumps
    if (d > MAX_STEP_METERS || speed > MAX_SPEED_MPS) {
      shouldSkip = true;
    }

    if (!shouldSkip) {
      // Light exponential smoothing for small moves
      if (d < 20) {
        usePoint = {
          ...point,
          latitude: prev.latitude * (1 - SMOOTH_ALPHA) + point.latitude * SMOOTH_ALPHA,
          longitude: prev.longitude * (1 - SMOOTH_ALPHA) + point.longitude * SMOOTH_ALPHA,
          altitude: prev.altitude * (1 - SMOOTH_ALPHA) + (point.altitude ?? 0) * SMOOTH_ALPHA,
        };
      }
      
      // Update ride state with new point
      await RideStateManager.addLocationPoint(usePoint, d, speed);
    }
  } else if (!shouldSkip) {
    // First point
    await RideStateManager.addLocationPoint(usePoint, 0, 0);
  }
}

/**
 * Background Location Service
 * Public API for starting/stopping background location tracking
 */
export class BackgroundLocationService {
  private static isRunning = false;

  /**
   * Check if background location is currently running
   */
  static async isTaskRunning(): Promise<boolean> {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    if (!isRegistered) return false;
    
    const isStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    return isStarted;
  }

  /**
   * Request background location permissions
   * @returns true if permissions granted, false otherwise
   */
  static async requestPermissions(): Promise<boolean> {
    // Request foreground permissions first
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    
    if (foregroundStatus !== 'granted') {
      console.warn('[BackgroundLocation] Foreground permission denied');
      return false;
    }

    // Request background permissions
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    
    if (backgroundStatus !== 'granted') {
      console.warn('[BackgroundLocation] Background permission denied');
      return false;
    }

    console.log('[BackgroundLocation] Permissions granted');
    return true;
  }

  /**
   * Check if permissions are granted
   */
  static async hasPermissions(): Promise<boolean> {
    const foreground = await Location.getForegroundPermissionsAsync();
    const background = await Location.getBackgroundPermissionsAsync();
    
    return foreground.granted && background.granted;
  }

  /**
   * Start background location tracking
   * @returns true if started successfully
   */
  static async start(): Promise<boolean> {
    try {
      // Check if already running
      if (await this.isTaskRunning()) {
        console.log('[BackgroundLocation] Already running');
        return true;
      }

      // Ensure permissions
      const hasPerms = await this.hasPermissions();
      if (!hasPerms) {
        const granted = await this.requestPermissions();
        if (!granted) {
          console.error('[BackgroundLocation] Permissions not granted');
          return false;
        }
      }

      // Start background location updates
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, BACKGROUND_LOCATION_CONFIG);
      
      this.isRunning = true;
      console.log('[BackgroundLocation] Started successfully');
      return true;
    } catch (error) {
      console.error('[BackgroundLocation] Failed to start:', error);
      return false;
    }
  }

  /**
   * Stop background location tracking
   */
  static async stop(): Promise<void> {
    try {
      const isTaskRunning = await this.isTaskRunning();
      
      if (isTaskRunning) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        console.log('[BackgroundLocation] Stopped');
      }
      
      this.isRunning = false;
    } catch (error) {
      console.error('[BackgroundLocation] Failed to stop:', error);
    }
  }

  /**
   * Get the current status
   */
  static getStatus() {
    return {
      isRunning: this.isRunning,
    };
  }
}
