/**
 * Ride State Manager
 * Manages persistent state for ongoing rides
 * Ensures ride data survives app crashes, restarts, and background mode
 * 
 * Uses AsyncStorage for persistence across app sessions
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RidePoint, RideData } from '../../hooks/useRideTracker';

const RIDE_STATE_KEY = '@sbhra_active_ride_state';

export interface PersistedRideState {
  isActive: boolean;
  startTime: number;
  path: RidePoint[];
  totalDistance: number;
  elevationGain: number;
  horseId: string | null;
  horseName: string | null;
  lastUpdateTime: number;
  currentSpeed: number;
}

/**
 * Ride State Manager
 * Manages persistent state for active rides
 */
export class RideStateManager {
  private static currentState: PersistedRideState | null = null;
  private static listeners: Array<(state: PersistedRideState | null) => void> = [];

  /**
   * Initialize a new ride
   */
  static async startRide(horseId: string | null, horseName: string | null): Promise<void> {
    const state: PersistedRideState = {
      isActive: true,
      startTime: Date.now(),
      path: [],
      totalDistance: 0,
      elevationGain: 0,
      horseId,
      horseName,
      lastUpdateTime: Date.now(),
      currentSpeed: 0,
    };

    this.currentState = state;
    await this.saveState(state);
    this.notifyListeners();
    console.log('[RideStateManager] Ride started');
  }

  /**
   * Add a location point to the current ride
   */
  static async addLocationPoint(
    point: RidePoint,
    distanceDelta: number,
    speed: number
  ): Promise<void> {
    const state = await this.getRideState();
    
    if (!state || !state.isActive) {
      console.warn('[RideStateManager] No active ride to add point to');
      return;
    }

    // Add point to path
    state.path.push(point);
    
    // Update distance
    state.totalDistance += distanceDelta;
    
    // Update elevation gain
    if (state.path.length > 1) {
      const prevPoint = state.path[state.path.length - 2];
      const elevationChange = point.altitude - prevPoint.altitude;
      if (elevationChange > 0) {
        state.elevationGain += elevationChange;
      }
    }
    
    // Update speed and time
    state.currentSpeed = speed;
    state.lastUpdateTime = Date.now();

    this.currentState = state;
    await this.saveState(state);
    this.notifyListeners();
  }

  /**
   * Update ride metadata (e.g., route distances, snapping info)
   */
  static async updateRideMetadata(updates: Partial<PersistedRideState>): Promise<void> {
    const state = await this.getRideState();
    
    if (!state || !state.isActive) {
      console.warn('[RideStateManager] No active ride to update');
      return;
    }

    const updatedState = { ...state, ...updates };
    this.currentState = updatedState;
    await this.saveState(updatedState);
    this.notifyListeners();
  }

  /**
   * End the current ride
   */
  static async endRide(): Promise<PersistedRideState | null> {
    const state = await this.getRideState();
    
    if (!state) {
      console.warn('[RideStateManager] No active ride to end');
      return null;
    }

    // Mark as inactive but keep data
    state.isActive = false;
    state.lastUpdateTime = Date.now();

    await this.saveState(state);
    this.notifyListeners();
    
    console.log('[RideStateManager] Ride ended');
    return state;
  }

  /**
   * Clear the ride state (after saving to permanent storage)
   */
  static async clearRideState(): Promise<void> {
    this.currentState = null;
    await AsyncStorage.removeItem(RIDE_STATE_KEY);
    this.notifyListeners();
    console.log('[RideStateManager] Ride state cleared');
  }

  /**
   * Get the current ride state
   */
  static async getRideState(): Promise<PersistedRideState | null> {
    // Return cached state if available
    if (this.currentState !== null) {
      return this.currentState;
    }

    // Load from storage
    try {
      const json = await AsyncStorage.getItem(RIDE_STATE_KEY);
      if (json) {
        this.currentState = JSON.parse(json);
        return this.currentState;
      }
    } catch (error) {
      console.error('[RideStateManager] Failed to load state:', error);
    }

    return null;
  }

  /**
   * Check if there's an active ride
   */
  static async hasActiveRide(): Promise<boolean> {
    const state = await this.getRideState();
    return state !== null && state.isActive;
  }

  /**
   * Convert persisted state to RideData format
   */
  static async toRideData(): Promise<RideData | null> {
    const state = await this.getRideState();
    
    if (!state) return null;

    const duration = Date.now() - state.startTime;

    return {
      startTime: state.startTime,
      path: state.path,
      totalDistance: state.totalDistance,
      elevationGain: state.elevationGain,
      duration,
      horseId: state.horseId,
      horseName: state.horseName,
    };
  }

  /**
   * Save state to AsyncStorage
   */
  private static async saveState(state: PersistedRideState): Promise<void> {
    try {
      const json = JSON.stringify(state);
      await AsyncStorage.setItem(RIDE_STATE_KEY, json);
    } catch (error) {
      console.error('[RideStateManager] Failed to save state:', error);
    }
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

    const duration = (Date.now() - state.startTime) / 1000; // seconds
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
   * Recover from a crash - check for stale rides
   * Call this on app startup
   */
  static async recoverFromCrash(): Promise<boolean> {
    const state = await this.getRideState();
    
    if (!state || !state.isActive) {
      return false;
    }

    // Check if the ride is stale (no updates for > 1 hour)
    const timeSinceLastUpdate = Date.now() - state.lastUpdateTime;
    const ONE_HOUR = 60 * 60 * 1000;

    if (timeSinceLastUpdate > ONE_HOUR) {
      console.warn('[RideStateManager] Detected stale ride, clearing...');
      await this.clearRideState();
      return false;
    }

    console.log('[RideStateManager] Recovered active ride from crash');
    return true;
  }
}
