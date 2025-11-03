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
import type { RidePoint, TrailProximity } from '../../hooks/useRideTracker';
import { trailData } from '../../constants/trails';
import { buildTrailsIndex, snapToTrails } from '../../utils/routeSnapping';

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
    // Critical: Keep foreground service persistent
    killServiceOnDestroy: false,
  },
  // iOS background mode
  pausesUpdatesAutomatically: false,
  activityType: Location.ActivityType.Fitness,
  // Defer updates to save battery but ensure continuity
  deferredUpdatesInterval: 1000,
  deferredUpdatesDistance: 1,
};

// Noise filter thresholds (refined)
const MIN_STEP_METERS = 2;
const MAX_STEP_METERS = 200;
const MAX_SPEED_MPS = 12;
const SMOOTH_ALPHA = 0.3;

// Global guard to prevent duplicate task definition during Fast Refresh
const BG_TASK_DEFINED_KEY = '__sbhra_bg_location_task_defined__';

// Trails index for snapping
const TRAILS_INDEX = buildTrailsIndex(trailData);

// Last keepalive update time
let lastKeepaliveUpdate = 0;
const KEEPALIVE_INTERVAL = 5000; // 5 seconds

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number) {
  return (rad * 180) / Math.PI;
}

function bearing(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const φ1 = toRad(a.latitude);
  const φ2 = toRad(b.latitude);
  const Δλ = toRad(b.longitude - a.longitude);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  let brng = (toDeg(θ) + 360) % 360;
  return brng;
}

function angleDiff(a: number, b: number) {
  let d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Define the background location task at module load time
 * This MUST run before any calls to start the task
 * CRITICAL: This needs to be at the top level, not inside a function
 */
function defineBackgroundTask() {
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
    console.log('[BackgroundLocation] Task defined successfully');
  }
}

// Define task immediately at module load
defineBackgroundTask();

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

  // Update keepalive periodically (even if we skip the location point)
  const now = Date.now();
  if (now - lastKeepaliveUpdate > KEEPALIVE_INTERVAL) {
    await RideStateManager.updateKeepalive();
    lastKeepaliveUpdate = now;
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

    // Check filtering thresholds (prefer speed-based gating, keep a generous distance cap)
    if (d < MIN_STEP_METERS || speed > MAX_SPEED_MPS || d > MAX_STEP_METERS) {
      console.log(
        `[BackgroundLocation] Skipped point - d=${d.toFixed(1)}m, v=${speed.toFixed(2)}m/s`
      );
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
    
    // Adaptive thresholds
    const acc = typeof location.coords.accuracy === 'number' ? location.coords.accuracy : 25;
    const scale = 1 + 0.1 * Math.min(speed, 8) / 8;
    let enterDist = clamp(Math.max(25, 0.6 * acc) * scale, 20, 60);
    let exitDist = clamp(Math.max(35, 0.9 * acc) * scale, 30, 60);
    if (exitDist < enterDist) exitDist = enterDist;
    const activeRadius = exitDist;

    // Snapping and sticky hysteresis
    let segmentDistances: Record<string, number> = {};
    let nearestTrail: TrailProximity | null = null;
    let snappedCoordinate: { latitude: number; longitude: number } | null = null;
    let snapDistance: number | null = null;

    const segStart = path[path.length - 1];
    const segEnd = usePoint;
    const snapStart = snapToTrails(segStart, TRAILS_INDEX);
    const snapEnd = snapToTrails(segEnd, TRAILS_INDEX);

    if (snapEnd) {
      snappedCoordinate = { latitude: snapEnd.snapped.latitude, longitude: snapEnd.snapped.longitude };
      snapDistance = snapEnd.distanceToTrail;
      if (snapEnd.distanceToTrail <= exitDist) {
        nearestTrail = {
          id: snapEnd.trailId,
          name: snapEnd.trailName,
          distance: snapEnd.distanceToTrail,
          coordinate: { latitude: snapEnd.snapped.latitude, longitude: snapEnd.snapped.longitude },
        };
      }
    }

    let currentTrailId = rideState.currentTrailId ?? null;
    let pendingSwitchId = rideState.pendingSwitchId ?? null;
    let pendingCount = rideState.pendingCount ?? 0;
    let farCount = rideState.farCount ?? 0;

    const candId = snapEnd?.trailId ?? null;
    const candNearEnd = !!(snapEnd && snapEnd.distanceToTrail <= enterDist);
    const startNearCur = !!(snapStart && currentTrailId && snapStart.trailId === currentTrailId && snapStart.distanceToTrail <= exitDist);
    const endNearCur = !!(snapEnd && currentTrailId && snapEnd.trailId === currentTrailId && snapEnd.distanceToTrail <= exitDist);

    // Heading gating for switching
    let headingOk = true;
    if (snapStart && snapEnd && candId) {
      const moveBrng = bearing(segStart, segEnd);
      const snapBrng = bearing(snapStart.snapped, snapEnd.snapped);
      headingOk = angleDiff(moveBrng, snapBrng) <= 60;
    }

    if (!currentTrailId) {
      if (snapStart && snapEnd && candId && candNearEnd && snapStart.trailId === candId && snapStart.distanceToTrail <= enterDist && headingOk) {
        pendingSwitchId = candId;
        pendingCount = (pendingSwitchId === candId ? pendingCount : 0) + 1;
        if (pendingCount >= 2) {
          currentTrailId = candId;
          pendingSwitchId = null;
          pendingCount = 0;
          farCount = 0;
          console.log(`[Snapping] enter ${currentTrailId}`);
        }
      } else {
        pendingSwitchId = null;
        pendingCount = 0;
        farCount = 0;
      }
    } else {
      if (endNearCur && startNearCur) {
        if (snapStart && snapEnd && snapStart.trailId === currentTrailId) {
          const alongDelta = Math.abs(snapEnd.along - snapStart.along);
          if (alongDelta > 0) segmentDistances[currentTrailId] = (segmentDistances[currentTrailId] || 0) + alongDelta;
        }
        pendingSwitchId = null;
        pendingCount = 0;
        farCount = 0;
      } else {
        const nearAny = !!(snapEnd && snapEnd.distanceToTrail <= exitDist);
        if (!nearAny) {
          farCount += 1;
          if (farCount >= 3) {
            console.log(`[Snapping] exit ${currentTrailId}`);
            currentTrailId = null;
            pendingSwitchId = null;
            pendingCount = 0;
            farCount = 0;
          }
        } else if (candId && candNearEnd && headingOk) {
          if (pendingSwitchId === candId) pendingCount += 1; else { pendingSwitchId = candId; pendingCount = 1; }
          if (pendingCount >= 2) {
            console.log(`[Snapping] switch ${currentTrailId} -> ${candId}`);
            currentTrailId = candId;
            pendingSwitchId = null;
            pendingCount = 0;
            farCount = 0;
          }
        } else {
          pendingSwitchId = null;
          pendingCount = 0;
        }
      }
    }

    // Snapped path update
    const nextSnapped = Array.isArray(rideState.snappedPath) ? [...rideState.snappedPath] : [];
    if (snappedCoordinate && snapDistance != null && snapDistance <= activeRadius) {
      nextSnapped.push({ latitude: snappedCoordinate.latitude, longitude: snappedCoordinate.longitude, altitude: segEnd.altitude, timestamp: segEnd.timestamp });
    } else {
      nextSnapped.push(segEnd);
    }

    // Merge route distances and persist metadata
    const mergedDistances = { ...(rideState.routeDistances || {}) } as Record<string, number>;
    Object.entries(segmentDistances).forEach(([k, v]) => { mergedDistances[k] = (mergedDistances[k] || 0) + v; });

    await RideStateManager.addLocationPoint(usePoint, d, speed);
    await RideStateManager.updateRideMetadata({
      routeDistances: mergedDistances,
      snappedPath: nextSnapped,
      nearestTrail,
      snappedCoordinate,
      snapDistance,
      snapRadius: activeRadius,
      currentTrailId,
      pendingSwitchId,
      pendingCount,
      farCount,
    });
  } else {
    // First point - always add without filtering
    console.log('[BackgroundLocation] Adding first GPS point');
    await RideStateManager.addLocationPoint(point, 0, 0);
    const acc = typeof location.coords.accuracy === 'number' ? location.coords.accuracy : 25;
    const enterDist = clamp(Math.max(25, 0.6 * acc), 20, 60);
    const exitDist = clamp(Math.max(35, 0.9 * acc), 30, 60);
    const activeRadius = Math.max(enterDist, exitDist);
    const state2 = await RideStateManager.getRideState();
    const nextSnapped = Array.isArray(state2?.snappedPath) ? [...(state2?.snappedPath as any)] : [];
    nextSnapped.push(point);
    await RideStateManager.updateRideMetadata({ snappedPath: nextSnapped, snapRadius: activeRadius, nearestTrail: null, snappedCoordinate: null, snapDistance: null, currentTrailId: null, pendingSwitchId: null, pendingCount: 0, farCount: 0 });
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

      // Verify task is registered before starting
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
      if (!isRegistered) {
        console.warn('[BackgroundLocation] Task not registered, attempting to define...');
        defineBackgroundTask();
        // Double-check registration
        const stillNotRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
        if (stillNotRegistered === false) {
          console.error('[BackgroundLocation] Failed to register background task');
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
