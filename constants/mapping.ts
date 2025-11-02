/**
 * Constants for mapping-related components
 */

// Map Configuration
export const MAP_CONSTANTS = {
  // Region deltas for zoom levels
  REGION_DELTA_TIGHT: 0.002,
  REGION_DELTA_NORMAL: 0.008,
  REGION_DELTA_WIDE: 0.0015,
  REGION_DELTA_WORLD: 60,
  
  // Obstacle loading
  OBSTACLE_LOAD_RADIUS_KM: 10,
  OBSTACLE_LOAD_DEBOUNCE_MS: 1000,
  SIGNIFICANT_DISTANCE_KM: 1,
  
  // User staleness
  USER_STALE_THRESHOLD_MS: 5 * 60 * 1000, // 5 minutes
  
  // Map animation delays
  MAP_ANIMATION_DELAY_SHORT_MS: 300,
  MAP_ANIMATION_DELAY_MEDIUM_MS: 500,
  MAP_ANIMATION_DELAY_LONG_MS: 800,
  MAP_ANIMATION_DURATION_MS: 1000,
  
  // Trail rendering
  TRAIL_STROKE_WIDTH_MIN: 3,
  TRAIL_STROKE_WIDTH_RANGE: 6,
  TRAIL_OPACITY_MIN: 0.35,
  TRAIL_OPACITY_RANGE: 0.65,
  
  // Avatar/marker sizes
  AVATAR_SIZE: 36,
  USER_BADGE_SIZE: 16,
  OBSTACLE_ICON_SIZE: 20,
  
  // Location tracking
  LOCATION_TIMEOUT_MS: 20000,
  LOCATION_MAX_AGE_MS: 1000,
  WATCH_TIMEOUT_MS: 5000,
  WATCH_MAX_AGE_MS: 2000,
} as const;

// Enable debug logging in development
export const __DEV_LOGGING__ = __DEV__;
