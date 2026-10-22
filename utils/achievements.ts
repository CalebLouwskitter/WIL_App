export type AchievementDef = {
  id: string;
  title: string;
  description: string;
  icon: string;
  target: number;
  unit?: string;
  gradientColors: readonly [string, string];
};

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { id: 'first-ride', title: 'First Ride', description: 'Complete your first ride', icon: 'award', target: 1, gradientColors: ['#FF6B9D', '#FF8E53'] },
  { id: 'distance-100', title: '100km Club', description: 'Ride 100 km in total', icon: 'map', target: 100, unit: 'km', gradientColors: ['#A8E6CF', '#7FD8BE'] },
  { id: 'early-bird', title: 'Early Bird', description: 'Start a ride before 6 am', icon: 'sunrise', target: 1, gradientColors: ['#FFD93D', '#F6A623'] },
  { id: 'trail-marathon', title: 'Trail Marathon', description: 'Ride for 4 hours continuously', icon: 'clock', target: 1, gradientColors: ['#FFA07A', '#FF6B9D'] },
  { id: 'stable-keeper', title: 'Stable Keeper', description: 'Register three horses', icon: 'heart', target: 3, gradientColors: ['#C9D6FF', '#A1C4FD'] },
  { id: 'speed-demon', title: 'Speed Demon', description: 'Reach 30 km/h', icon: 'zap', target: 1, gradientColors: ['#F093FB', '#F5576C'] },
];

export type AchievementStatus = AchievementDef & {
  /** null when nothing records this achievement yet; it is shown as "not tracked", never as 0. */
  progress: number | null;
  unlocked: boolean;
};

export type RideLike = { startTime: number; totalDistance: number; duration: number };

/** Where the server-side awards came from. Local rides and horses are always read from this device. */
export type AwardsSource = 'loading' | 'ok' | 'unavailable' | 'error';

export type AchievementSnapshot = {
  awardsSource: AwardsSource;
  awardIds: ReadonlySet<string>;
  rides: RideLike[];
  horseCount: number | null;
};

export const LOADING_ACHIEVEMENT_SNAPSHOT: AchievementSnapshot = {
  awardsSource: 'loading',
  awardIds: new Set<string>(),
  rides: [],
  horseCount: null,
};

/**
 * Award documents are stored as `${uid}_${achievementId}`; the converter exposes either the
 * achievement id or that document id. Accept both, and tolerate an `achievementId` field.
 */
export function normalizeAchievementId(raw: unknown, uid?: string | null): string | null {
  const a = raw as { id?: unknown; achievementId?: unknown } | null;
  const id = typeof a?.achievementId === 'string' ? a.achievementId : typeof a?.id === 'string' ? a.id : null;
  if (!id) return null;
  return uid && id.startsWith(`${uid}_`) ? id.slice(uid.length + 1) : id;
}

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

/**
 * Combines real server awards with totals derived from the rides and horses we can actually
 * see. Anything without a data source stays "not tracked" instead of showing invented progress.
 */
export function computeAchievements(input: {
  awardIds: ReadonlySet<string>;
  rides: RideLike[];
  horseCount: number | null;
}): AchievementStatus[] {
  const { awardIds, rides, horseCount } = input;
  const km = rides.reduce((sum, r) => sum + (r.totalDistance || 0), 0) / 1000;
  const earlyRides = rides.filter((r) => new Date(r.startTime).getHours() < 6).length;
  const marathons = rides.filter((r) => r.duration >= FOUR_HOURS_MS).length;

  const derived: Record<string, number | null> = {
    'first-ride': rides.length,
    'distance-100': Math.round(km * 10) / 10,
    'early-bird': earlyRides,
    'trail-marathon': marathons,
    'stable-keeper': horseCount,
    'speed-demon': null,
  };

  return ACHIEVEMENT_DEFS.map((def) => {
    const awarded = awardIds.has(def.id);
    const raw = derived[def.id];
    const progress = awarded ? def.target : raw;
    const unlocked = awarded || (raw != null && raw >= def.target);
    return { ...def, progress: progress == null ? null : Math.min(progress, def.target), unlocked };
  });
}

export type AchievementLoaderDeps = {
  firebaseEnabled: boolean;
  uid: string | null;
  listAwards: (uid: string) => Promise<readonly unknown[]>;
  getRides: () => Promise<RideLike[]>;
  getHorses: () => Promise<readonly unknown[] | null>;
};

/**
 * Gathers everything achievement progress is computed from. A failed award read is reported through
 * `awardsSource` instead of being turned into zero progress. Dependencies are injected so the rules
 * can be tested without Firebase or device storage.
 */
export async function loadAchievementSnapshot(deps: AchievementLoaderDeps): Promise<AchievementSnapshot> {
  const { firebaseEnabled, uid, listAwards, getRides, getHorses } = deps;

  let awardsSource: AwardsSource = 'ok';
  let awardIds = new Set<string>();
  if (!firebaseEnabled || !uid) {
    awardsSource = 'unavailable';
  } else {
    try {
      const awards = await listAwards(uid);
      awardIds = new Set(awards.map((a) => normalizeAchievementId(a, uid)).filter((id): id is string => !!id));
    } catch (error) {
      console.warn('[Achievements] Could not load awards:', error);
      awardsSource = 'error';
    }
  }

  const [rides, horses] = await Promise.all([getRides().catch(() => []), getHorses().catch(() => null)]);
  return { awardsSource, awardIds, rides, horseCount: horses ? horses.length : null };
}

/** The data note shown on every surface that displays achievement progress. */
export function achievementDataNote(source: AwardsSource): string | null {
  if (source === 'unavailable') {
    return 'Not connected to SBHRA servers. Progress is calculated from rides and horses stored on this device.';
  }
  if (source === 'error') {
    return "Couldn't load your awards from SBHRA. Progress is calculated from rides and horses on this device.";
  }
  return null;
}

/** Achievements shown in the Profile preview, in display order. */
export const PROFILE_PREVIEW_IDS = ['first-ride', 'distance-100', 'early-bird'] as const;

export type AchievementPreviewItem = {
  id: string;
  title: string;
  description: string;
  icon: string;
  gradientColors: readonly [string, string];
  earned: boolean;
  /** Progress such as "0/1" or "52.5/100 km"; null when nothing records the achievement yet. */
  progressLabel: string | null;
};

/** Profile preview rows built from the same statuses the Achievements screen shows. */
export function buildAchievementPreview(statuses: readonly AchievementStatus[]): AchievementPreviewItem[] {
  return PROFILE_PREVIEW_IDS.flatMap((id) => {
    const status = statuses.find((s) => s.id === id);
    if (!status) return [];
    const progressLabel =
      status.unlocked || status.progress === null
        ? null
        : `${status.progress}/${status.target}${status.unit ? ` ${status.unit}` : ''}`;
    return [
      {
        id: status.id,
        title: status.title,
        description: status.description,
        icon: status.icon,
        gradientColors: status.gradientColors,
        earned: status.unlocked,
        progressLabel,
      },
    ];
  });
}
