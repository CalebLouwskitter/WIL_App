import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { auth, firestore, FIREBASE_ENABLED } from './FirebaseConfig';
import type { RideData } from '../hooks/useRideTracker';
import { Converters, COLLECTIONS, type RideDTO, ridePointFromDTO } from './Data';
import {
  analyticsError,
  analyticsOk,
  analyticsUnavailable,
  mapAnalytics,
  type AnalyticsResult,
} from './analyticsResult';

export interface UserAnalyticsData {
  totalRides: number;
  totalDistance: number;
  totalDuration: number;
  totalElevationGain: number;
  averageSpeed: number;
  averageDistance: number;
  longestRide: number;
  totalPoints: number;
  rides: RideData[];
}

/**
 * Fetch all rides for the current authenticated user from Firebase.
 * 'unavailable' (Firebase off, or signed out) is an expected state and is not logged;
 * 'error' means a configured query failed and is logged with its detail.
 */
export const getCurrentUserRides = async (): Promise<AnalyticsResult<RideData[]>> => {
  try {
    if (!FIREBASE_ENABLED || !firestore) {
      return analyticsUnavailable('firebase-off', []);
    }

    if (!auth?.currentUser) {
      return analyticsUnavailable('signed-out', []);
    }

    const userId = auth.currentUser.uid;
    
    // Query rides collection filtered by current user
    const ridesRef = collection(firestore, COLLECTIONS.rides).withConverter(Converters.ride);
    const q = query(
      ridesRef, 
      where('userId', '==', userId),
      orderBy('startTime', 'desc')
    );
    
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log('[UserAnalytics] No rides found for current user');
      return analyticsOk([]);
    }

    const userRides: RideData[] = snapshot.docs.map(docSnap => {
      const ride = docSnap.data() as RideDTO;
      return {
        startTime: ride.startTime,
        path: (ride.path || []).map(ridePointFromDTO),
        totalDistance: ride.totalDistance || 0,
        elevationGain: ride.elevationGain || 0,
        duration: ride.duration || 0,
        routeDistances: ride.routeDistances || undefined,
        horseId: ride.horseId ?? undefined,
        horseName: ride.horseName ?? undefined,
        snappedPath: undefined,
        nearestTrail: undefined,
        snappedCoordinate: undefined,
        snapDistance: undefined,
        snapRadius: undefined,
        maxSpeed: (ride as any).maxSpeed ?? undefined,
        endTime: (ride as any).endTime ?? undefined,
      } as RideData;
    });

    console.log(`[UserAnalytics] Fetched ${userRides.length} rides for user ${userId}`);
    return analyticsOk(userRides);
  } catch (error) {
    console.warn('[UserAnalytics] Error fetching user rides:', error);
    return analyticsError(error, []);
  }
};

/**
 * Calculate comprehensive analytics for the current user
 */
export const getUserAnalytics = async (): Promise<AnalyticsResult<UserAnalyticsData>> =>
  mapAnalytics(await getCurrentUserRides(), summarizeRides);

const summarizeRides = (rides: RideData[]): UserAnalyticsData => {
  if (rides.length === 0) {
    return {
      totalRides: 0,
      totalDistance: 0,
      totalDuration: 0,
      totalElevationGain: 0,
      averageSpeed: 0,
      averageDistance: 0,
      longestRide: 0,
      totalPoints: 0,
      rides: [],
    };
  }

  const totalDistance = rides.reduce((sum, r) => sum + (r.totalDistance || 0), 0);
  const totalDuration = rides.reduce((sum, r) => sum + (r.duration || 0), 0);
  const totalElevationGain = rides.reduce((sum, r) => sum + (r.elevationGain || 0), 0);
  
  const averageDistance = totalDistance / rides.length;
  const averageSpeed = totalDuration > 0 
    ? (totalDistance / 1000) / (totalDuration / (1000 * 60 * 60)) 
    : 0;
  
  const longestRide = Math.max(...rides.map(r => r.totalDistance || 0));
  
  // Calculate points (example: 1 point per km + 10 points per ride)
  const totalPoints = Math.round((totalDistance / 1000) + (rides.length * 10));

  return {
    totalRides: rides.length,
    totalDistance,
    totalDuration,
    totalElevationGain,
    averageSpeed,
    averageDistance,
    longestRide,
    totalPoints,
    rides,
  };
};

/**
 * Get user's trail usage from Firebase rides
 */
export interface UserTrailUsage {
  trailId: string;
  trailName: string;
  totalDistance: number;
  rideCount: number;
  averageDistance: number;
}

export const getUserTrailUsage = async (): Promise<AnalyticsResult<UserTrailUsage[]>> => {
  const ridesResult = await getCurrentUserRides();
  const rides = ridesResult.data;

  const trailMap = new Map<string, {
    name: string;
    distance: number;
    rideCount: number;
  }>();
  
  rides.forEach(ride => {
    const routeDistances = ride.routeDistances || {};
    
    Object.entries(routeDistances).forEach(([trailId, distance]) => {
      if (typeof distance === 'number' && distance > 0) {
        if (!trailMap.has(trailId)) {
          trailMap.set(trailId, {
            name: trailId, // Default to ID, will be replaced by actual name
            distance: 0,
            rideCount: 0,
          });
        }
        
        const trail = trailMap.get(trailId)!;
        trail.distance += distance;
        trail.rideCount++;
      }
    });
  });
  
  return mapAnalytics(ridesResult, () =>
    Array.from(trailMap.entries())
      .map(([trailId, data]) => ({
        trailId,
        trailName: data.name,
        totalDistance: data.distance,
        rideCount: data.rideCount,
        averageDistance: data.rideCount > 0 ? data.distance / data.rideCount : 0,
      }))
      .sort((a, b) => b.totalDistance - a.totalDistance),
  );
};

/**
 * Get rides filtered by time period
 */
export const getUserRidesByTimePeriod = async (
  period: 'day' | 'week' | 'month' | '3month' | '6month' | '1year'
): Promise<AnalyticsResult<RideData[]>> => {
  const allRides = await getCurrentUserRides();

  const now = new Date();
  const start = new Date(now);
  
  switch (period) {
    case 'day':
      start.setDate(now.getDate() - 1);
      break;
    case 'week':
      start.setDate(now.getDate() - 7);
      break;
    case 'month':
      start.setMonth(now.getMonth() - 1);
      break;
    case '3month':
      start.setMonth(now.getMonth() - 3);
      break;
    case '6month':
      start.setMonth(now.getMonth() - 6);
      break;
    case '1year':
      start.setFullYear(now.getFullYear() - 1);
      break;
  }
  
  return mapAnalytics(allRides, (rides) => rides.filter(ride => ride.startTime >= start.getTime()));
};