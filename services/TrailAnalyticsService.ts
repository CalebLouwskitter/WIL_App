import { getRides } from './RideStorage';
import { trailData } from '../constants/trails';

export type TrailUsageStats = {
  rideCount: number;
  totalDistance: number;
};

export type TrailUsageSummary = TrailUsageStats & {
  trailId: string;
  trailName: string;
  averageDistance: number;
};

export async function getTrailUsageStats(): Promise<Record<string, TrailUsageStats>> {
  const rides = await getRides();
  const usage: Record<string, TrailUsageStats> = {};

  rides.forEach((ride) => {
    const distances = ride.routeDistances;
    if (!distances) return;

    Object.entries(distances).forEach(([trailId, meters]) => {
      if (!meters || meters <= 0) return;

      if (!usage[trailId]) {
        usage[trailId] = { rideCount: 0, totalDistance: 0 };
      }

      usage[trailId].rideCount += 1;
      usage[trailId].totalDistance += meters;
    });
  });

  return usage;
}

export async function getTrailUsageSummaries(): Promise<TrailUsageSummary[]> {
  const usage = await getTrailUsageStats();

  const summaries = Object.entries(usage).map(([trailId, stats]) => {
    const trail = trailData.find((t) => t.id === trailId);
    return {
      trailId,
      trailName: trail?.name ?? trailId,
      rideCount: stats.rideCount,
      totalDistance: stats.totalDistance,
      averageDistance: stats.rideCount > 0 ? stats.totalDistance / stats.rideCount : 0,
    };
  });

  return summaries.sort((a, b) => b.totalDistance - a.totalDistance);
}
