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

// Global guard to prevent duplicate task definition during Fast Refresh
const BG_TASK_DEFINED_KEY = '__sbhra_bg_location_task_defined__';

/**
 * Define the background location task
 * This function runs in the background when location updates are received
 */
{
  const g: any = globalThis as any;
  if (!g[BG_TASK_DEFINED_KEY]) {
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
    g[BG_TASK_DEFINED_KEY] = true;
  }
}

// Track if we're already stopping to prevent race conditions
let isStopping = false;

/**
 * Process a single location update
 */
async function processLocationUpdate(location: Location.LocationObject) {
  // Get the current ride state
  const rideState = await RideStateManager.getRideState();
  
  if (!rideState || !rideState.isActive) {
    // No active ride, stop background tracking (with race condition guard)
    if (!isStopping) {
      isStopping = true;
      await BackgroundLocationService.stop();
      isStopping = false;
    }
    return;
  }

  const point: RidePoint = {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    altitude: location.coords.altitude ?? null,
    timestamp: Date.now(),
  };

  // Apply noise filtering
  const path = rideState.path || [];

  if (path.length > 0) {
    const prev = path[path.length - 1];
    const dt = Math.max(1, (point.timestamp - prev.timestamp) / 1000);
    const d = haversine(prev, point, { unit: 'meter' });
    const speed = d / dt;

    // Check filtering thresholds
    let shouldSkip = false;
    let skipReason = '';

    // Ignore tiny jitter
    if (d < MIN_STEP_METERS) {
      shouldSkip = true;
      skipReason = `distance too small (${d.toFixed(2)}m < ${MIN_STEP_METERS}m)`;
    }
    
    // Ignore unrealistic jumps
    if (d > MAX_STEP_METERS) {
      shouldSkip = true;
      skipReason = `distance too large (${d.toFixed(2)}m > ${MAX_STEP_METERS}m)`;
    }
    
    if (speed > MAX_SPEED_MPS) {
      shouldSkip = true;
      skipReason = `speed too high (${speed.toFixed(2)}m/s > ${MAX_SPEED_MPS}m/s)`;
    }

    if (shouldSkip) {
      console.log(`[BackgroundLocation] Skipped point - ${skipReason}`);
      return;
    }

    // Light exponential smoothing for small moves
    let usePoint = point;
    if (d < 20) {
      usePoint = {
        latitude: prev.latitude * (1 - SMOOTH_ALPHA) + point.latitude * SMOOTH_ALPHA,
        longitude: prev.longitude * (1 - SMOOTH_ALPHA) + point.longitude * SMOOTH_ALPHA,
        altitude: point.altitude !== null && prev.altitude !== null
          ? prev.altitude * (1 - SMOOTH_ALPHA) + point.altitude * SMOOTH_ALPHA
          : point.altitude,
        timestamp: point.timestamp,
      };
    }
    
    // Update ride state with new point
    await RideStateManager.addLocationPoint(usePoint, d, speed);
  } else {
    // First point - always add without filtering
    console.log('[BackgroundLocation] Adding first GPS point');
    await RideStateManager.addLocationPoint(point, 0, 0);
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

      // Check that device location services are enabled (system toggle)
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        console.error('[BackgroundLocation] Location services are disabled at the system level');
        return false;
      }

      // Check that background location is available on this device/platform
      if (typeof (Location as any).isBackgroundLocationAvailableAsync === 'function') {
        const bgAvailable = await (Location as any).isBackgroundLocationAvailableAsync();
        if (!bgAvailable) {
          console.error('[BackgroundLocation] Background location is not available on this device');
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

  /**
   * Get accurate runtime status by querying TaskManager/Location
   */
  static async getStatusAsync() {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    const hasStarted = isRegistered
      ? await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)
      : false;
    const hasPerms = await this.hasPermissions();
    return { isRegistered, hasStarted, hasPermissions: hasPerms };
  }
}
