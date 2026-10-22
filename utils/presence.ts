/**
 * utils/presence.ts
 *
 * Pure utilities for rider presence freshness, age filtering, deduplication,
 * and display labels.
 */

export const PRESENCE_WINDOW_MS = 30 * 60 * 1000; // 30 minutes in milliseconds
export const ACTIVE_NOW_THRESHOLD_MS = 2 * 60 * 1000; // Under 2 minutes is "Active now"

/**
 * Determines whether a rider's lastSeen timestamp is considered present.
 *
 * Boundary rule:
 * Inclusive at exactly 30 minutes (now - lastSeen <= PRESENCE_WINDOW_MS).
 * At 30m 00s the rider is still present; at 30m 01s they age out.
 * Future timestamps (clock skew where lastSeen > now) are treated as present.
 * Missing, null, non-numeric or non-finite timestamps return false.
 */
export function isPresent(lastSeen: unknown, now: number): boolean {
  if (typeof lastSeen !== 'number' || !Number.isFinite(lastSeen)) {
    return false;
  }
  if (lastSeen > now) {
    // Clock skew: client clock slightly ahead of server / other device
    return true;
  }
  return now - lastSeen <= PRESENCE_WINDOW_MS;
}

export type PresenceCandidate = {
  uid: string;
  deviceId?: string;
  lastSeen: number;
  [key: string]: any;
};

/**
 * Filters a list of presence records to only include riders currently present,
 * deduping by uid_deviceId and keeping the newest entry.
 *
 * Drops records with invalid/non-finite lastSeen or lastSeen older than 30 minutes.
 */
export function filterPresent<T extends PresenceCandidate>(users: T[], now: number): T[] {
  if (!Array.isArray(users)) {
    return [];
  }

  const byKey = new Map<string, T>();

  for (const user of users) {
    if (!user || typeof user.uid !== 'string') {
      continue;
    }
    if (!isPresent(user.lastSeen, now)) {
      continue;
    }

    const key = `${user.uid}_${user.deviceId || 'unknown'}`;
    const existing = byKey.get(key);

    if (!existing || user.lastSeen > existing.lastSeen) {
      byKey.set(key, user);
    }
  }

  return Array.from(byKey.values());
}

/**
 * Returns a human-readable presence freshness label.
 *
 * Rules:
 * - Under 2 minutes (or future clock skew): "Active now"
 * - 2 minutes or more: "Seen N min ago", rounding down minutes.
 * - Missing or non-finite: fallback to "Offline".
 */
export function presenceLabel(lastSeen: unknown, now: number): string {
  if (typeof lastSeen !== 'number' || !Number.isFinite(lastSeen)) {
    return 'Offline';
  }

  const diff = now - lastSeen;

  if (diff < ACTIVE_NOW_THRESHOLD_MS) {
    return 'Active now';
  }

  const minutes = Math.floor(diff / (60 * 1000));
  return `Seen ${minutes} min ago`;
}
