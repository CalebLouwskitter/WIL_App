/**
 * Background Services Index
 * Central export for all background processing services
 */

export { BackgroundLocationService } from './BackgroundLocationService';
export { RideStateManager } from './RideStateManager';
export { 
  useBackgroundRideTracker, 
  recoverActiveRide,
  type BackgroundRideStatus,
  type UseBackgroundRideTrackerResult 
} from './BackgroundRideTracker';
export type { PersistedRideState } from './RideStateManager';
