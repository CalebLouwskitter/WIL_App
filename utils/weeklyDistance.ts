export type DayDistance = { dayStart: number; label: string; km: number };

const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const startOfLocalDay = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * Distance ridden per local day for the 7 days ending today (oldest first), in km.
 * Rides outside that window are ignored.
 */
export function weeklyDistanceKm(
  rides: { startTime: number; totalDistance: number }[],
  now: number = Date.now()
): DayDistance[] {
  const today = startOfLocalDay(now);
  const days: DayDistance[] = [];
  for (let i = 6; i >= 0; i--) {
    // Step by calendar day so DST changes don't shift the buckets
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push({ dayStart: d.getTime(), label: WEEKDAY[d.getDay()], km: 0 });
  }
  for (const ride of rides) {
    const dayStart = startOfLocalDay(ride.startTime);
    const bucket = days.find((d) => d.dayStart === dayStart);
    if (bucket) bucket.km += (ride.totalDistance || 0) / 1000;
  }
  return days;
}

export const totalKm = (days: DayDistance[]) => days.reduce((sum, d) => sum + d.km, 0);
