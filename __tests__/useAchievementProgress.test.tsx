import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { buildAchievementPreview } from '../utils/achievements';

const mockState = { firebaseEnabled: true, uid: 'u1' as string | null };
const mockListAwards = jest.fn();
const mockGetRides = jest.fn();
const mockGetHorses = jest.fn();

jest.mock('@react-navigation/native', () => {
  const { useEffect } = require('react');
  return { useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, []) };
});
jest.mock('../services/firebase', () => ({
  get FIREBASE_ENABLED() {
    return mockState.firebaseEnabled;
  },
  get auth() {
    return { currentUser: mockState.uid ? { uid: mockState.uid } : null };
  },
}));
jest.mock('../services/Data', () => ({ listUserAchievements: (uid: string) => mockListAwards(uid) }));
jest.mock('../services/RideStorage', () => ({ getRides: () => mockGetRides() }));
jest.mock('../services/HorseStorage', () => ({ getHorses: () => mockGetHorses() }));

import { useAchievementProgress } from '../hooks/useAchievementProgress';

type Progress = ReturnType<typeof useAchievementProgress>;

const midMorningRide = { startTime: new Date(2026, 5, 1, 9, 0).getTime(), totalDistance: 42_500, duration: 3_600_000 };
const earlyLongRide = { startTime: new Date(2026, 5, 1, 5, 0).getTime(), totalDistance: 120_000, duration: 4 * 3_600_000 };

// Mounts the hook and returns the progress from its settled render.
async function loadProgress(): Promise<Progress> {
  const renders: Progress[] = [];
  function Probe() {
    renders.push(useAchievementProgress());
    return null;
  }
  await act(async () => {
    TestRenderer.create(<Probe />);
  });
  return renders[renders.length - 1];
}

beforeEach(() => {
  jest.clearAllMocks();
  mockState.firebaseEnabled = true;
  mockState.uid = 'u1';
  mockListAwards.mockResolvedValue([]);
  mockGetRides.mockResolvedValue([]);
  mockGetHorses.mockResolvedValue([]);
});

describe('useAchievementProgress with the Profile preview', () => {
  it('zero data: Achievements and the Profile preview both show nothing earned', async () => {
    const progress = await loadProgress();
    const preview = buildAchievementPreview(progress.statuses);

    expect(progress.awardsSource).toBe('ok');
    expect(progress.statuses.filter((s) => s.unlocked)).toHaveLength(0);
    expect(preview.every((row) => !row.earned)).toBe(true);
    expect(preview.map((row) => row.progressLabel)).toEqual(['0/1', '0/100 km', '0/1']);
  });

  it('partial data: the first ride is earned on both surfaces and the others show progress', async () => {
    mockGetRides.mockResolvedValue([midMorningRide]);
    mockGetHorses.mockResolvedValue([{}]);
    const progress = await loadProgress();
    const preview = buildAchievementPreview(progress.statuses);

    expect(progress.statuses.filter((s) => s.unlocked).map((s) => s.id)).toEqual(['first-ride']);
    expect(preview.map((row) => row.earned)).toEqual([true, false, false]);
    expect(preview.map((row) => row.progressLabel)).toEqual([null, '42.5/100 km', '0/1']);
  });

  it('legitimately earned data and a server award: the preview earns the same rows as Achievements', async () => {
    mockGetRides.mockResolvedValue([earlyLongRide]);
    mockListAwards.mockResolvedValue([{ id: 'u1_early-bird' }]);
    const progress = await loadProgress();
    const preview = buildAchievementPreview(progress.statuses);

    const unlockedOnAchievements = progress.statuses.filter((s) => s.unlocked).map((s) => s.id);
    expect(unlockedOnAchievements).toEqual(expect.arrayContaining(['first-ride', 'distance-100', 'early-bird']));
    expect(preview.filter((row) => row.earned).map((row) => row.id)).toEqual(
      unlockedOnAchievements.filter((id) => ['first-ride', 'distance-100', 'early-bird'].includes(id))
    );
    expect(preview.every((row) => row.progressLabel === null)).toBe(true);
  });

  it('unavailable awards: local progress is still shown and the server is never queried', async () => {
    mockState.firebaseEnabled = false;
    mockGetRides.mockResolvedValue([midMorningRide]);
    const progress = await loadProgress();

    expect(mockListAwards).not.toHaveBeenCalled();
    expect(progress.awardsSource).toBe('unavailable');
    expect(buildAchievementPreview(progress.statuses).map((row) => row.earned)).toEqual([true, false, false]);
  });
});
