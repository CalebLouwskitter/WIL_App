import { ref, get } from 'firebase/database';
import { auth, database } from './FirebaseConfig';
import type { RideData } from '../hooks/useRideTracker';

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
 * Fetch all rides from all users in Firebase Realtime Database
 */
export const getAllUserRides = async (): Promise<RideData[]> => {
  try {
    // Check if user is authenticated
    if (!auth?.currentUser) {
      console.warn('[GlobalAnalytics] User not authenticated');
      return [];
    }

    // Check if database is initialized
    if (!database) {
      console.error('[GlobalAnalytics] Firebase Realtime Database not initialized');
      return [];
    }

    const ridesRef = ref(database, 'rides');
    const snapshot = await get(ridesRef);

    if (!snapshot.exists()) {
      console.log('[GlobalAnalytics] No rides data found in database');
      return [];
    }

    const allRides: RideData[] = [];
    const ridesData = snapshot.val();

    // Iterate through all users
    Object.keys(ridesData).forEach(userId => {
      const userRides = ridesData[userId];
      
      // Iterate through each user's rides
      Object.values(userRides).forEach((ride: any) => {
        if (ride && typeof ride === 'object') {
          allRides.push({
            ...ride,
            userId, // Add userId to track which user
          });
        }
      });
    });

    console.log(`[GlobalAnalytics] Fetched ${allRides.length} rides from ${Object.keys(ridesData).length} users`);
    return allRides;
  } catch (error) {
    console.error('[GlobalAnalytics] Error fetching all rides:', error);
    return [];
  }
};

/**
 * Get global statistics across all users
 */
export const getGlobalRideStats = async (): Promise<GlobalRideStats> => {
  const rides = await getAllUserRides();
  
  const uniqueUserIds = new Set(rides.map(r => (r as any).userId));
  
  return {
    totalRides: rides.length,
    totalDistance: rides.reduce((sum, r) => sum + (r.totalDistance || 0), 0),
    totalDuration: rides.reduce((sum, r) => sum + (r.duration || 0), 0),
    totalElevation: rides.reduce((sum, r) => sum + (r.elevationGain || 0), 0),
    uniqueUsers: uniqueUserIds.size,
    rides,
  };
};

/**
 * Get per-user statistics
 */
export const getUserRideStats = async (): Promise<UserRideStats[]> => {
  const rides = await getAllUserRides();
  
  const userMap = new Map<string, UserRideStats>();
  
  rides.forEach(ride => {
    const userId = (ride as any).userId || 'unknown';
    
    if (!userMap.has(userId)) {
      userMap.set(userId, {
        userId,
        userName: (ride as any).userName || undefined,
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
  
  // Calculate averages
  userMap.forEach(stats => {
    stats.averageDistance = stats.rideCount > 0 
      ? stats.totalDistance / stats.rideCount 
      : 0;
  });
  
  return Array.from(userMap.values()).sort((a, b) => b.totalDistance - a.totalDistance);
};

/**
 * Get global trail usage across all users
 */
export const getGlobalTrailUsage = async (): Promise<GlobalTrailUsage[]> => {
  const rides = await getAllUserRides();
  
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
  
  return Array.from(trailMap.entries())
    .map(([trailId, data]) => ({
      trailId,
      trailName: data.name,
      totalDistance: data.distance,
      rideCount: data.rideCount,
      uniqueUsers: data.users.size,
      averageDistance: data.rideCount > 0 ? data.distance / data.rideCount : 0,
    }))
    .sort((a, b) => b.totalDistance - a.totalDistance);
};

/**
 * Get recent activity (last N rides across all users)
 */
export const getRecentGlobalActivity = async (limit: number = 10): Promise<RideData[]> => {
  const rides = await getAllUserRides();
  
  return rides
    .sort((a, b) => (b.startTime || 0) - (a.startTime || 0))
    .slice(0, limit);
};