import { computeAchievements, normalizeAchievementId } from '../utils/achievements';
import { totalKm, weeklyDistanceKm } from '../utils/weeklyDistance';

describe('computeAchievements', () => {
  const byId = (list: ReturnType<typeof computeAchievements>) => Object.fromEntries(list.map((a) => [a.id, a]));

  it('a new user has nothing unlocked and no invented progress', () => {
    const a = byId(computeAchievements({ awardIds: new Set(), rides: [], horseCount: 0 }));
    expect(Object.values(a).some((x) => x.unlocked)).toBe(false);
    expect(a['distance-100'].progress).toBe(0);
    expect(a['stable-keeper'].progress).toBe(0);
    expect(a['speed-demon'].progress).toBeNull(); // not tracked, not 0
  });

  it('derives progress from real rides and horses', () => {
    const rides = [
      { startTime: new Date(2026, 5, 1, 5, 0).getTime(), totalDistance: 42_500, duration: 3_600_000 },
      { startTime: new Date(2026, 5, 2, 9, 0).getTime(), totalDistance: 10_000, duration: 5 * 3_600_000 },
    ];
    const a = byId(computeAchievements({ awardIds: new Set(), rides, horseCount: 2 }));
    expect(a['first-ride'].unlocked).toBe(true);
    expect(a['distance-100']).toMatchObject({ progress: 52.5, unlocked: false });
    expect(a['early-bird'].unlocked).toBe(true);
    expect(a['trail-marathon'].unlocked).toBe(true);
    expect(a['stable-keeper']).toMatchObject({ progress: 2, unlocked: false });
  });

  it('a server award unlocks the achievement', () => {
    const a = byId(computeAchievements({ awardIds: new Set(['distance-100']), rides: [], horseCount: null }));
    expect(a['distance-100']).toMatchObject({ unlocked: true, progress: 100 });
    expect(a['stable-keeper'].progress).toBeNull();
  });
});

describe('normalizeAchievementId', () => {
  it('accepts achievement ids, uid-prefixed document ids and achievementId fields', () => {
    expect(normalizeAchievementId({ id: 'first-ride' }, 'u1')).toBe('first-ride');
    expect(normalizeAchievementId({ id: 'u1_first-ride' }, 'u1')).toBe('first-ride');
    expect(normalizeAchievementId({ achievementId: 'distance-100' }, 'u1')).toBe('distance-100');
    expect(normalizeAchievementId({}, 'u1')).toBeNull();
    expect(normalizeAchievementId(undefined)).toBeNull();
  });
});

describe('weeklyDistanceKm', () => {
  const now = new Date(2026, 5, 10, 15, 0).getTime();
  it('returns 7 days oldest-first in km and ignores rides outside the window', () => {
    const rides = [
      { startTime: new Date(2026, 5, 10, 7, 0).getTime(), totalDistance: 12_000 },
      { startTime: new Date(2026, 5, 10, 17, 0).getTime(), totalDistance: 3_000 },
      { startTime: new Date(2026, 5, 4, 8, 0).getTime(), totalDistance: 5_000 },
      { startTime: new Date(2026, 5, 3, 8, 0).getTime(), totalDistance: 99_000 }, // 8 days ago
    ];
    const days = weeklyDistanceKm(rides, now);
    expect(days).toHaveLength(7);
    expect(days[6].km).toBe(15);
    expect(days[0].km).toBe(5);
    expect(totalKm(days)).toBe(20);
  });

  it('is all zero with no rides', () => {
    expect(totalKm(weeklyDistanceKm([], now))).toBe(0);
  });
});
