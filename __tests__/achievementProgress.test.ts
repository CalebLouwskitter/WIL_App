import {
  achievementDataNote,
  buildAchievementPreview,
  computeAchievements,
  loadAchievementSnapshot,
  type AchievementLoaderDeps,
  type RideLike,
} from '../utils/achievements';

const midMorningRide: RideLike = {
  startTime: new Date(2026, 5, 1, 9, 0).getTime(),
  totalDistance: 42_500,
  duration: 3_600_000,
};
const earlyLongRide: RideLike = {
  startTime: new Date(2026, 5, 1, 5, 0).getTime(),
  totalDistance: 120_000,
  duration: 4 * 3_600_000,
};

const depsFor = (overrides: Partial<AchievementLoaderDeps> = {}): AchievementLoaderDeps => ({
  firebaseEnabled: true,
  uid: 'u1',
  listAwards: jest.fn().mockResolvedValue([]),
  getRides: jest.fn().mockResolvedValue([]),
  getHorses: jest.fn().mockResolvedValue([]),
  ...overrides,
});

describe('loadAchievementSnapshot', () => {
  it('reports awards as unavailable without a signed-in user and never asks the server', async () => {
    const listAwards = jest.fn();
    const snapshot = await loadAchievementSnapshot(
      depsFor({ firebaseEnabled: false, uid: null, listAwards, getRides: jest.fn().mockResolvedValue([midMorningRide]) })
    );
    expect(listAwards).not.toHaveBeenCalled();
    expect(snapshot.awardsSource).toBe('unavailable');
    expect(snapshot.rides).toEqual([midMorningRide]);
  });

  it('keeps local rides and horses when the award read fails, and reports it as an error', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const snapshot = await loadAchievementSnapshot(
      depsFor({
        listAwards: jest.fn().mockRejectedValue(new Error('offline')),
        getRides: jest.fn().mockResolvedValue([midMorningRide]),
        getHorses: jest.fn().mockResolvedValue([{}, {}]),
      })
    );
    warn.mockRestore();
    expect(snapshot).toMatchObject({ awardsSource: 'error', horseCount: 2 });
    expect(snapshot.awardIds.size).toBe(0);
    expect(snapshot.rides).toEqual([midMorningRide]);
  });

  it('maps uid-prefixed server awards and counts stored horses', async () => {
    const snapshot = await loadAchievementSnapshot(
      depsFor({
        listAwards: jest.fn().mockResolvedValue([{ id: 'u1_early-bird' }, { achievementId: 'first-ride' }]),
        getHorses: jest.fn().mockResolvedValue([{}, {}, {}]),
      })
    );
    expect(snapshot.awardsSource).toBe('ok');
    expect([...snapshot.awardIds].sort()).toEqual(['early-bird', 'first-ride']);
    expect(snapshot.horseCount).toBe(3);
  });

  it('treats an unreadable horse list as unknown rather than zero', async () => {
    const snapshot = await loadAchievementSnapshot(
      depsFor({ getHorses: jest.fn().mockRejectedValue(new Error('storage')) })
    );
    expect(snapshot.horseCount).toBeNull();
  });
});

describe('buildAchievementPreview', () => {
  const preview = (snapshot: { awardIds: ReadonlySet<string>; rides: RideLike[]; horseCount: number | null }) =>
    buildAchievementPreview(computeAchievements(snapshot));

  it('zero data: nothing is earned and progress is shown, never past-tense completion', () => {
    const rows = preview({ awardIds: new Set(), rides: [], horseCount: 0 });
    expect(rows.map((r) => r.id)).toEqual(['first-ride', 'distance-100', 'early-bird']);
    expect(rows.every((r) => !r.earned)).toBe(true);
    expect(rows.map((r) => r.progressLabel)).toEqual(['0/1', '0/100 km', '0/1']);
    expect(rows[0].description).toBe('Complete your first ride');
  });

  it('partial data: only the milestone reached is earned, the rest show progress', () => {
    const rows = preview({ awardIds: new Set(), rides: [midMorningRide], horseCount: 0 });
    expect(rows.map((r) => r.earned)).toEqual([true, false, false]);
    expect(rows.map((r) => r.progressLabel)).toEqual([null, '42.5/100 km', '0/1']);
  });

  it('legitimately earned data: every row is earned and carries no progress label', () => {
    const rows = preview({ awardIds: new Set(), rides: [earlyLongRide], horseCount: 0 });
    expect(rows.map((r) => r.earned)).toEqual([true, true, true]);
    expect(rows.map((r) => r.progressLabel)).toEqual([null, null, null]);
  });

  it('a server award earns its row even with no local rides', () => {
    const rows = preview({ awardIds: new Set(['early-bird']), rides: [], horseCount: null });
    expect(rows.map((r) => r.earned)).toEqual([false, false, true]);
    expect(rows.map((r) => r.progressLabel)).toEqual(['0/1', '0/100 km', null]);
  });

  it('agrees with the Achievements statuses built from the same snapshot', () => {
    const snapshot = { awardIds: new Set(['early-bird']), rides: [midMorningRide], horseCount: 1 };
    const statuses = computeAchievements(snapshot);
    for (const row of buildAchievementPreview(statuses)) {
      const status = statuses.find((s) => s.id === row.id)!;
      expect(row).toMatchObject({ title: status.title, earned: status.unlocked });
    }
  });
});

describe('achievementDataNote', () => {
  it('explains unavailable and failed award reads, and is silent when awards loaded', () => {
    expect(achievementDataNote('unavailable')).toMatch(/Not connected/);
    expect(achievementDataNote('error')).toMatch(/Couldn't load your awards/);
    expect(achievementDataNote('ok')).toBeNull();
    expect(achievementDataNote('loading')).toBeNull();
  });
});
