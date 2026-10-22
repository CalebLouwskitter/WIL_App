import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
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

export interface GlobalRideStats {
  totalRides: number;
  totalDistance: number;
  totalDuration: number;
  totalElevation: number;
  uniqueUsers: number;
  rides: RideData[];
}

export interface UserRideStats {
  userId: string;
  userName?: string;
  rideCount: number;
  totalDistance: number;
  totalDuration: number;
  averageDistance: number;
}

export interface GlobalTrailUsage {
  trailId: string;
  trailName: string;
  totalDistance: number;
  rideCount: number;
  uniqueUsers: number;
  averageDistance: number;
}

/**
 * Fetch all rides from all users in Firebase Firestore.
 * 'unavailable' (Firebase off, or signed out) is an expected state and is not logged;
 * 'error' means a configured query failed and is logged with its detail.
 */
export const getAllUserRides = async (): Promise<AnalyticsResult<RideData[]>> => {
  try {
    if (!FIREBASE_ENABLED || !firestore) {
      return analyticsUnavailable('firebase-off', []);
    }

    if (!auth?.currentUser) {
      return analyticsUnavailable('signed-out', []);
    }

    const ridesRef = collection(firestore, COLLECTIONS.rides).withConverter(Converters.ride);
    const snapshot = await getDocs(ridesRef);

    if (snapshot.empty) {
      console.log('[GlobalAnalytics] No rides data found in Firestore');
      return analyticsOk([]);
    }

    const allRides: RideData[] = snapshot.docs.reduce((acc: RideData[], docSnap) => {
      const ride = docSnap.data() as RideDTO;
      acc.push({
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
        userId: ride.userId,
      } as RideData & { userId: string });
      return acc;
    }, []);

    console.log(`[GlobalAnalytics] Fetched ${allRides.length} rides from Firestore`);
    return analyticsOk(allRides);
  } catch (error) {
    console.warn('[GlobalAnalytics] Error fetching all rides:', error);
    return analyticsError(error, []);
  }
};

/**
 * Get global statistics across all users
 */
export const getGlobalRideStats = async (): Promise<AnalyticsResult<GlobalRideStats>> =>
  mapAnalytics(await getAllUserRides(), (rides) => {
    const uniqueUserIds = new Set(rides.map(r => (r as any).userId));

    return {
      totalRides: rides.length,
      totalDistance: rides.reduce((sum, r) => sum + (r.totalDistance || 0), 0),
      totalDuration: rides.reduce((sum, r) => sum + (r.duration || 0), 0),
      totalElevation: rides.reduce((sum, r) => sum + (r.elevationGain || 0), 0),
      uniqueUsers: uniqueUserIds.size,
      rides,
    };
  });

/**
 * Get per-user statistics
 */
export const getUserRideStats = async (): Promise<AnalyticsResult<UserRideStats[]>> => {
  const ridesResult = await getAllUserRides();
  const rides = ridesResult.data;

  const userMap = new Map<string, UserRideStats>();
  
  rides.forEach(ride => {
    const userId = (ride as any).userId || 'unknown';
    
    if (!userMap.has(userId)) {
      userMap.set(userId, {
        userId,
        userName: undefined,
        rideCount: 0,
        totalDistance: 0,
        totalDuration: 0,
        averageDistance: 0,
      });
    }
    
    const stats = userMap.get(userId)!;
    stats.rideCount++;
    stats.totalDistance += ride.totalDistance || 0;
    stats.totalDuration += ride.duration || 0;
  });
  
  if (ridesResult.status === 'ok' && FIREBASE_ENABLED && firestore) {
    const firestoreInstance = firestore; 
    const userIds = Array.from(userMap.keys());
    await Promise.all(
      userIds.map(async (userId) => {
        try {
          const userDocRef = doc(firestoreInstance, COLLECTIONS.users, userId);
          const userSnap = await getDoc(userDocRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            const displayName = userData?.displayName || userData?.name || userData?.email?.split('@')[0];
            if (displayName && typeof displayName === 'string' && displayName.trim()) {
              const stats = userMap.get(userId);
              if (stats) {
                stats.userName = displayName.trim();
              }
            } else {
              console.log(`[GlobalAnalytics] No valid displayName for user ${userId}, available fields:`, Object.keys(userData || {}));
            }
          } else {
            console.log(`[GlobalAnalytics] User document does not exist for userId: ${userId}`);
          }
        } catch (error) {
          console.warn(`[GlobalAnalytics] Failed to fetch displayName for user ${userId}:`, error);
        }
      })
    );
  }

  // Calculate averages
  userMap.forEach(stats => {
    stats.averageDistance = stats.rideCount > 0 
      ? stats.totalDistance / stats.rideCount 
      : 0;
  });
  
  return mapAnalytics(ridesResult, () =>
    Array.from(userMap.values()).sort((a, b) => b.totalDistance - a.totalDistance),
  );
};

/**
 * Get global trail usage across all users
 */
export const getGlobalTrailUsage = async (): Promise<AnalyticsResult<GlobalTrailUsage[]>> => {
  const ridesResult = await getAllUserRides();
  const rides = ridesResult.data;

  const trailMap = new Map<string, {
    name: string;
    distance: number;
    users: Set<string>;
    rideCount: number;
  }>();
  
  rides.forEach(ride => {
    const routeDistances = (ride as any).routeDistances || {};
    const userId = (ride as any).userId || 'unknown';
    
    Object.entries(routeDistances).forEach(([trailId, distance]) => {
      if (typeof distance === 'number' && distance > 0) {
        if (!trailMap.has(trailId)) {
          trailMap.set(trailId, {
            name: trailId, // Default to ID, can be enhanced with trail name lookup
            distance: 0,
            users: new Set(),
            rideCount: 0,
          });
        }
        
        const trail = trailMap.get(trailId)!;
        trail.distance += distance;
        trail.users.add(userId);
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
        uniqueUsers: data.users.size,
        averageDistance: data.rideCount > 0 ? data.distance / data.rideCount : 0,
      }))
      .sort((a, b) => b.totalDistance - a.totalDistance),
  );
};

/**
 * Get recent activity (last N rides across all users)
 */
export const getRecentGlobalActivity = async (limit: number = 10): Promise<AnalyticsResult<RideData[]>> =>
  mapAnalytics(await getAllUserRides(), (rides) =>
    [...rides].sort((a, b) => (b.startTime || 0) - (a.startTime || 0)).slice(0, limit),
  );