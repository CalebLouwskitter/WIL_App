import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RideData } from '../hooks/useRideTracker';
import { FIREBASE_ENABLED, auth } from './firebase';
import { saveRideAndUpdateAggregates, newRide, ridePointToDTO, ridePointFromDTO, listDocs, Converters, COLLECTIONS, type RideDTO } from './Data';

const STORAGE_KEY = 'rides';

export const saveRide = async (ride: RideData) => {
  const existingRaw = await AsyncStorage.getItem(STORAGE_KEY);
  const existing: RideData[] = existingRaw ? JSON.parse(existingRaw) : [];
  existing.push(ride);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(existing));

  // Also persist to Firestore (auto-creates collection) when enabled and signed in
  try {
    if (FIREBASE_ENABLED && auth?.currentUser?.uid) {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const dto = newRide({
        id,
        userId: auth.currentUser.uid,
        startTime: ride.startTime,
        endTime: ride.startTime + (ride.duration || 0),
        totalDistance: ride.totalDistance,
        elevationGain: ride.elevationGain,
        duration: ride.duration,
        path: (ride.path || []).map(ridePointToDTO),
        routeDistances: ride.routeDistances,
        horseId: ride.horseId ?? null,
        horseName: ride.horseName ?? null,
      });
      await saveRideAndUpdateAggregates(dto);
    }
  } catch (e) {
    // Non-fatal: keep local storage even if cloud write fails
    console.warn('Failed to save ride to Firestore:', e);
  }
};

export const getRides = async (): Promise<RideData[]> => {
  const uid = FIREBASE_ENABLED ? auth?.currentUser?.uid : undefined;
  if (FIREBASE_ENABLED && uid) {
    try {
      const docs = await listDocs<RideDTO>(COLLECTIONS.rides, {
        where: ['userId', '==', uid],
        orderBy: ['startTime', 'desc'],
        converter: Converters?.ride as any,
      });
      const mapped: RideData[] = docs.map((r) => ({
        startTime: r.startTime,
        path: (r.path || []).map(ridePointFromDTO),
        totalDistance: r.totalDistance,
        elevationGain: r.elevationGain,
        duration: r.duration,
        routeDistances: r.routeDistances,
        horseId: r.horseId ?? undefined,
        horseName: r.horseName ?? undefined,
      }));
      return mapped;
    } catch (e) {
      console.warn('Failed to load rides from Firestore, falling back to local:', e);
    }
  }
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as RideData[]) : [];
};
