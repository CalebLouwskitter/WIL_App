import { useRef, useState, useCallback, useEffect } from 'react';
import * as Location from 'expo-location';
import type { LocationObject, LocationSubscription } from 'expo-location';
import haversine from 'haversine';
import { trailData } from '../constants/trails';
import { getActiveHorse } from '../services/HorseStorage';
import { buildTrailsIndex, snapToTrails } from '../utils/routeSnapping';



export type RidePoint = {
  latitude: number;
  longitude: number;
  altitude: number | null;
  timestamp: number;
};

export type TrailProximity = {
  id: string;
  name: string;
  distance: number;
  coordinate: {
    latitude: number;
    longitude: number;
  };
};

export type RideData = {
  startTime: number;
  path: RidePoint[];
  snappedPath?: RidePoint[];
  totalDistance: number; // meters
  elevationGain: number; // meters
  duration: number; // ms
  routeDistances?: Record<string, number>; // meters per predefined route id
  horseId?: string | null;
  horseName?: string | null;
  nearestTrail?: TrailProximity | null;
  snappedCoordinate?: { latitude: number; longitude: number } | null;
  snapDistance?: number | null; // meters to snapped point
  snapRadius?: number | null; // current active stick radius in meters
};

export default function useRideTracker() {
  const [rideData, setRideData] = useState<RideData | null>(null);
  const watchSub = useRef<LocationSubscription | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState(0);

  // Precompute trail index for snapping
  const trailsIndexRef = useRef(buildTrailsIndex(trailData));

  // Sticky snapping state
  const currentTrailIdRef = useRef<string | null>(null);
  const pendingSwitchIdRef = useRef<string | null>(null);
  const pendingCountRef = useRef<number>(0);



  // Noise filter thresholds
  const MIN_STEP_METERS = 1; // Reduced to capture more granular movement
  const MAX_STEP_METERS = 60;
  const MAX_SPEED_MPS = 15;
  const SMOOTH_ALPHA = 0.3;

  const startRide = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') throw new Error('Location permission denied');

    const startTime = Date.now();
    setCurrentSpeed(0);



    // Capture the active horse at the start of the ride
    const activeHorse = await getActiveHorse();
    const path: RidePoint[] = [];
    let totalDistance = 0;
    let elevationGain = 0;

    watchSub.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Highest,
        timeInterval: 1000,
        distanceInterval: 1,
      },
      (loc: LocationObject) => {
        const point: RidePoint = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          altitude: loc.coords.altitude ?? null,
          timestamp: Date.now(),
        };



        // Apply simple noise filtering and smoothing
        let usePoint = point;
        if (path.length > 0) {
          const prev = path[path.length - 1];
          const dt = Math.max(1, (point.timestamp - prev.timestamp) / 1000);
          const d = haversine(prev, point, { unit: 'meter' });
          const speed = d / dt;

          // Ignore tiny jitter
          if (d < MIN_STEP_METERS) {
            return; // skip update
          }
          
          // Ignore unrealistic jumps
          if (d > MAX_STEP_METERS || speed > MAX_SPEED_MPS) {
            return; // likely GPS glitch
          }
          
          // Calculate distance BEFORE smoothing (use raw GPS for accurate distance)
          totalDistance += d;
          setCurrentSpeed(speed * 3.6); // km/h
          
          // Light exponential smoothing for small moves (<20m) - ONLY for display position
          if (d < 20) {
            usePoint = {
              ...point,
              latitude: prev.latitude * (1 - SMOOTH_ALPHA) + point.latitude * SMOOTH_ALPHA,
              longitude: prev.longitude * (1 - SMOOTH_ALPHA) + point.longitude * SMOOTH_ALPHA,
              altitude: point.altitude !== null && prev.altitude !== null
                ? prev.altitude * (1 - SMOOTH_ALPHA) + point.altitude * SMOOTH_ALPHA
                : point.altitude,
            };
          }
          
          // Elevation calculation - only if we have valid altitude data and moved enough distance
          if (point.altitude !== null && prev.altitude !== null && d > 5) {
            const elevationChange = point.altitude - prev.altitude;
            if (elevationChange > 0) elevationGain += elevationChange;
          }
        }
        path.push(usePoint);




        // Compute overlap contribution using snap-to-path for this newest segment
        const segmentDistances: Record<string, number> = {};
        let nearestTrail: TrailProximity | null = null;
        let snappedCoordinate: { latitude: number; longitude: number } | null = null;
        let snapDistance: number | null = null;
        const ENTER_DISTANCE = 12; // meters: enter when very close
        const EXIT_DISTANCE = 18;  // meters: drop when slightly farther to avoid flicker
        const ACTIVE_RADIUS = EXIT_DISTANCE; // what we display
        if (path.length > 1) {
          const segStart = path[path.length - 2];
          const segEnd = usePoint;

          const snapStart = snapToTrails(segStart, trailsIndexRef.current);
          const snapEnd = snapToTrails(segEnd, trailsIndexRef.current);

          snappedCoordinate = snapEnd ? { latitude: snapEnd.snapped.latitude, longitude: snapEnd.snapped.longitude } : null;
          snapDistance = snapEnd ? snapEnd.distanceToTrail : null;

          // Determine nearest trail for UI from current point
          if (snapEnd && snapEnd.distanceToTrail <= EXIT_DISTANCE) {
            nearestTrail = {
              id: snapEnd.trailId,
              name: snapEnd.trailName,
              distance: snapEnd.distanceToTrail,
              coordinate: { latitude: snapEnd.snapped.latitude, longitude: snapEnd.snapped.longitude },
            };
          }

          // Sticky snapping with hysteresis
          const cur = currentTrailIdRef.current;
          if (snapEnd) {
            // Decide candidate trail (nearest)
            const candId = snapEnd.trailId;
            const candNearEnd = snapEnd.distanceToTrail <= ENTER_DISTANCE;
            const startNearCur = snapStart && cur && snapStart.trailId === cur && snapStart.distanceToTrail <= EXIT_DISTANCE;
            const endNearCur = cur && snapEnd.trailId === cur && snapEnd.distanceToTrail <= EXIT_DISTANCE;

            // Maintain or enter current trail
            if (!cur) {
              // No current trail: require both ends close to same candidate to start
              if (
                snapStart && candNearEnd && snapStart.trailId === candId && snapStart.distanceToTrail <= ENTER_DISTANCE
              ) {
                pendingSwitchIdRef.current = candId;
                pendingCountRef.current += 1;
                if (pendingCountRef.current >= 2) {
                  currentTrailIdRef.current = candId;
                  pendingSwitchIdRef.current = null;
                  pendingCountRef.current = 0;
                }
              } else {
                pendingSwitchIdRef.current = null;
                pendingCountRef.current = 0;
              }
            } else {
              // We have a current trail: stick while within EXIT_DISTANCE
              if (endNearCur && startNearCur) {
                // Attribute distance along current trail if both ends snap to it
                if (snapStart && snapStart.trailId === cur) {
                  const alongDelta = Math.abs(snapEnd.along - snapStart.along);
                  if (alongDelta > 0) {
                    segmentDistances[cur] = (segmentDistances[cur] || 0) + alongDelta;
                  }
                }
                // clear pending
                pendingSwitchIdRef.current = null;
                pendingCountRef.current = 0;
              } else {
                // Consider switching if candidate is close enough for a few consecutive samples
                if (candNearEnd) {
                  if (pendingSwitchIdRef.current === candId) {
                    pendingCountRef.current += 1;
                  } else {
                    pendingSwitchIdRef.current = candId;
                    pendingCountRef.current = 1;
                  }
                  if (pendingCountRef.current >= 2) {
                    currentTrailIdRef.current = candId;
                    pendingSwitchIdRef.current = null;
                    pendingCountRef.current = 0;
                  }
                } else {
                  // Too far from any trail; do not attribute and do not switch
                  pendingSwitchIdRef.current = null;
                  pendingCountRef.current = 0;
                  // If far from current beyond EXIT, allow dropping current
                  if (!endNearCur) {
                    currentTrailIdRef.current = null;
                  }
                }
              }
            }
          }
        }

        setRideData((prev) => {
          const merged: Record<string, number> = { ...(prev?.routeDistances || {}) };
          Object.entries(segmentDistances).forEach(([k, v]) => {
            merged[k] = (merged[k] || 0) + v;
          });
          // Build snappedPath: snap to trail when within EXIT_DISTANCE; else keep raw GPS
          let nextSnapped: RidePoint[] = prev?.snappedPath ? [...prev.snappedPath] : [];
          if (path.length > 0) {
            const lastRaw = path[path.length - 1];
            if (snappedCoordinate && snapDistance != null && snapDistance <= ACTIVE_RADIUS) {
              nextSnapped.push({
                latitude: snappedCoordinate.latitude,
                longitude: snappedCoordinate.longitude,
                altitude: lastRaw.altitude,
                timestamp: lastRaw.timestamp,
              });
            } else {
              nextSnapped.push(lastRaw);
            }
          }
          return {
            startTime,
            path: [...path],
            snappedPath: nextSnapped,
            totalDistance,
            elevationGain,
            duration: Date.now() - startTime,
            routeDistances: merged,
            horseId: activeHorse?.id ?? null,
            horseName: activeHorse?.name ?? null,
            nearestTrail,
            snappedCoordinate,
            snapDistance,
            snapRadius: ACTIVE_RADIUS,
          };
        });
      }
    );
  }, []);

  const stopRide = useCallback(() => {
    if (watchSub.current) {
      watchSub.current.remove();
      watchSub.current = null;
    }
    return rideData;
  }, [rideData]);

  // Ensure the location subscription is removed if the component using this hook unmounts
  useEffect(() => {
    return () => {
      if (watchSub.current) {
        watchSub.current.remove();
        watchSub.current = null;
      }
    };
  }, []);

  return { rideData, startRide, stopRide, currentSpeed };
}
