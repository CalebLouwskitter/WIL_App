import { useState, useEffect, useCallback } from 'react';
import { getRides } from '../services/RideStorage';
import type { RideData } from './useRideTracker';
import { ridePoints } from '../utils/points';

export interface UserStats {
  totalRides: number;
  totalDistance: number; // in meters
  totalDuration: number; // in milliseconds
  totalElevationGain: number; // in meters
  averageDistance: number; // in meters
  averageDuration: number; // in milliseconds
  averageSpeed: number; // in km/h
  longestRide: number; // in meters
  longestDuration: number; // in milliseconds
  totalPoints: number;
  rides: RideData[];
}

export interface WeeklyStats {
  week: string;
  distance: number;
  rides: number;
}

export interface MonthlyStats {
  month: string;
  distance: number;
  rides: number;
  duration: number;
}

export function useAnalytics() {
  const [stats, setStats] = useState<UserStats>({
    totalRides: 0,
    totalDistance: 0,
    totalDuration: 0,
    totalElevationGain: 0,
    averageDistance: 0,
    averageDuration: 0,
    averageSpeed: 0,
    longestRide: 0,
    longestDuration: 0,
    totalPoints: 0,
    rides: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const rides = await getRides();
      
      if (rides.length === 0) {
        setStats({
          totalRides: 0,
          totalDistance: 0,
          totalDuration: 0,
          totalElevationGain: 0,
          averageDistance: 0,
          averageDuration: 0,
          averageSpeed: 0,
          longestRide: 0,
          longestDuration: 0,
          totalPoints: 0,
          rides: [],
        });
        return;
      }

      const totalRides = rides.length;
      const totalDistance = rides.reduce((sum, ride) => sum + (ride.totalDistance || 0), 0);
      const totalDuration = rides.reduce((sum, ride) => sum + (ride.duration || 0), 0);
      const totalElevationGain = rides.reduce((sum, ride) => sum + (ride.elevationGain || 0), 0);
      
      const averageDistance = totalDistance / totalRides;
      const averageDuration = totalDuration / totalRides;
      
      // Average speed in km/h
      const averageSpeed = totalDuration > 0 
        ? (totalDistance / 1000) / (totalDuration / 1000 / 3600) 
        : 0;
      
      const longestRide = Math.max(...rides.map(r => r.totalDistance || 0));
      const longestDuration = Math.max(...rides.map(r => r.duration || 0));
      
      // Points calculation: 10 points per ride + 1 point per km
      const totalPoints = ridePoints(totalRides, totalDistance);

      setStats({
        totalRides,
        totalDistance,
        totalDuration,
        totalElevationGain,
        averageDistance,
        averageDuration,
        averageSpeed,
        longestRide,
        longestDuration,
        totalPoints,
        rides: rides.sort((a, b) => b.startTime - a.startTime),
      });
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const getWeeklyStats = useCallback((): WeeklyStats[] => {
    const weeklyData: Record<string, { distance: number; rides: number }> = {};
    const now = new Date();
    
    // Get last 8 weeks
    for (let i = 7; i >= 0; i--) {
      const weekDate = new Date(now);
      weekDate.setDate(weekDate.getDate() - i * 7);
      const weekKey = `Week ${8 - i}`;
      weeklyData[weekKey] = { distance: 0, rides: 0 };
    }

    stats.rides.forEach(ride => {
      const rideDate = new Date(ride.startTime);
      const diffDays = Math.floor((now.getTime() - rideDate.getTime()) / (1000 * 60 * 60 * 24));
      const weekIndex = Math.floor(diffDays / 7);
      
      if (weekIndex < 8) {
        const weekKey = `Week ${8 - weekIndex}`;
        if (weeklyData[weekKey]) {
          weeklyData[weekKey].distance += ride.totalDistance || 0;
          weeklyData[weekKey].rides += 1;
        }
      }
    });

    return Object.entries(weeklyData).map(([week, data]) => ({
      week,
      ...data,
    }));
  }, [stats.rides]);

  const getMonthlyStats = useCallback((): MonthlyStats[] => {
    const monthlyData: Record<string, { distance: number; rides: number; duration: number }> = {};
    
    stats.rides.forEach(ride => {
      const rideDate = new Date(ride.startTime);
      const monthKey = rideDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { distance: 0, rides: 0, duration: 0 };
      }
      
      monthlyData[monthKey].distance += ride.totalDistance || 0;
      monthlyData[monthKey].rides += 1;
      monthlyData[monthKey].duration += ride.duration || 0;
    });

    return Object.entries(monthlyData)
      .map(([month, data]) => ({
        month,
        ...data,
      }))
      .slice(-6); // Last 6 months
  }, [stats.rides]);

  const refresh = useCallback(() => {
    return loadStats();
  }, [loadStats]);

  return {
    stats,
    loading,
    error,
    refresh,
    getWeeklyStats,
    getMonthlyStats,
  };
}
