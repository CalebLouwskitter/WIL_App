import { useState, useEffect, useCallback } from 'react';
import { getUserAnalytics, type UserAnalyticsData } from '../services/UserAnalyticsService';

interface UseAnalyticsReturn {
  stats: UserAnalyticsData;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useAnalytics = (): UseAnalyticsReturn => {
  const [stats, setStats] = useState<UserAnalyticsData>({
    totalRides: 0,
    totalDistance: 0,
    totalDuration: 0,
    totalElevationGain: 0,
    averageSpeed: 0,
    averageDistance: 0,
    longestRide: 0,
    totalPoints: 0,
    rides: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getUserAnalytics();
      setStats(result.data);
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const refresh = useCallback(async () => {
    await loadStats();
  }, [loadStats]);

  return { stats, loading, error, refresh };
};