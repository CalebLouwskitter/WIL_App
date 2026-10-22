import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { FIREBASE_ENABLED, auth } from '../services/firebase';
import { listUserAchievements } from '../services/Data';
import { getRides } from '../services/RideStorage';
import { getHorses } from '../services/HorseStorage';
import {
  computeAchievements,
  loadAchievementSnapshot,
  LOADING_ACHIEVEMENT_SNAPSHOT,
  type AchievementSnapshot,
  type AchievementStatus,
} from '../utils/achievements';

/**
 * Achievement progress for the signed-in user, refreshed whenever the screen gains focus.
 * Every achievement surface (Profile preview, Achievements screen) reads from this one hook.
 */
export function useAchievementProgress(): { awardsSource: AchievementSnapshot['awardsSource']; statuses: AchievementStatus[] } {
  const [snapshot, setSnapshot] = useState<AchievementSnapshot>(LOADING_ACHIEVEMENT_SNAPSHOT);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadAchievementSnapshot({
        firebaseEnabled: !!FIREBASE_ENABLED,
        uid: auth?.currentUser?.uid ?? null,
        listAwards: listUserAchievements,
        getRides,
        getHorses,
      }).then((next) => {
        if (!cancelled) setSnapshot(next);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const statuses = useMemo(() => computeAchievements(snapshot), [snapshot]);
  return { awardsSource: snapshot.awardsSource, statuses };
}
