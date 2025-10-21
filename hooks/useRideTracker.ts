import { useRef, useState, useCallback } from 'react';
import * as Location from 'expo-location';
import type { LocationObject, LocationSubscription } from 'expo-location';
import haversine from 'haversine';
import { trailData } from '../constants/trails';
import { getActiveHorse } from '../services/HorseStorage';
import { buildTrailsIndex, snapToTrails } from '../utils/routeSnapping';



export type RidePoint = {
  latitude: number;
  longitude: number;
  altitude: number;
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
  totalDistance: number; // meters
  elevationGain: number; // meters
  duration: number; // ms
  routeDistances?: Record<string, number>; // meters per predefined route id
  horseId?: string | null;
  horseName?: string | null;
  nearestTrail?: TrailProximity | null;
};

export default function useRideTracker() {
  const [rideData, setRideData] = useState<RideData | null>(null);
  const watchSub = useRef<LocationSubscription | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState(0);

  // Precompute trail index for snapping
  const trailsIndexRef = useRef(buildTrailsIndex(trailData));



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
          altitude: loc.coords.altitude ?? 0,
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
              altitude: prev.altitude * (1 - SMOOTH_ALPHA) + (point.altitude ?? 0) * SMOOTH_ALPHA,
            };
          }
          
          // Elevation calculation
          const elevationChange = point.altitude - prev.altitude;
          if (elevationChange > 0) elevationGain += elevationChange;
        }
        path.push(usePoint);




        // Compute overlap contribution using snap-to-path for this newest segment
        const segmentDistances: Record<string, number> = {};
        let nearestTrail: TrailProximity | null = null;
        if (path.length > 1) {
          const segStart = path[path.length - 2];
          const segEnd = usePoint;

          const snapStart = snapToTrails(segStart, trailsIndexRef.current);
          const snapEnd = snapToTrails(segEnd, trailsIndexRef.current);

          const THRESHOLD = 35; // meters from trail to count towards it

          // Determine nearest trail for UI from current point
          if (snapEnd && snapEnd.distanceToTrail <= 60) {
            nearestTrail = {
              id: snapEnd.trailId,
              name: snapEnd.trailName,
              distance: snapEnd.distanceToTrail,
              coordinate: { latitude: snapEnd.snapped.latitude, longitude: snapEnd.snapped.longitude },
            };
          }

          // If both ends snap close to the SAME trail, attribute along-trail delta
          if (
            snapStart && snapEnd &&
            snapStart.trailId === snapEnd.trailId &&
            snapStart.distanceToTrail <= THRESHOLD &&
            snapEnd.distanceToTrail <= THRESHOLD
          ) {
            const alongDelta = Math.abs(snapEnd.along - snapStart.along);
            if (alongDelta > 0) {
              segmentDistances[snapEnd.trailId] = (segmentDistances[snapEnd.trailId] || 0) + alongDelta;
            }
          }
        }

        setRideData((prev) => {
          const merged: Record<string, number> = { ...(prev?.routeDistances || {}) };
          Object.entries(segmentDistances).forEach(([k, v]) => {
            merged[k] = (merged[k] || 0) + v;
          });
          return {
            startTime,
            path: [...path],
            totalDistance,
            elevationGain,
            duration: Date.now() - startTime,
            routeDistances: merged,
            horseId: activeHorse?.id ?? null,
            horseName: activeHorse?.name ?? null,
            nearestTrail,
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

  return { rideData, startRide, stopRide, currentSpeed };
}
