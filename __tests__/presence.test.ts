import {
  PRESENCE_WINDOW_MS,
  ACTIVE_NOW_THRESHOLD_MS,
  isPresent,
  filterPresent,
  presenceLabel,
} from '../utils/presence';

describe('utils/presence', () => {
  const baseNow = Date.UTC(2026, 9, 22, 12, 0, 0); // 12:00:00 UTC

  describe('isPresent', () => {
    it('returns true for lastSeen equal to now', () => {
      expect(isPresent(baseNow, baseNow)).toBe(true);
    });

    it('returns true for lastSeen within the 30 minute window (29m 59s ago)', () => {
      const lastSeen = baseNow - (29 * 60 + 59) * 1000;
      expect(isPresent(lastSeen, baseNow)).toBe(true);
    });

    it('is inclusive at exactly 30 minutes', () => {
      const lastSeen = baseNow - PRESENCE_WINDOW_MS;
      expect(isPresent(lastSeen, baseNow)).toBe(true);
    });

    it('returns false for lastSeen past 30 minutes (30m 01s ago)', () => {
      const lastSeen = baseNow - (30 * 60 + 1) * 1000;
      expect(isPresent(lastSeen, baseNow)).toBe(false);
    });

    it('treats future lastSeen as present (clock skew)', () => {
      const futureLastSeen = baseNow + 60 * 1000; // 1 minute in the future
      expect(isPresent(futureLastSeen, baseNow)).toBe(true);
    });

    it('returns false for NaN, null, undefined, and non-finite values', () => {
      expect(isPresent(NaN, baseNow)).toBe(false);
      expect(isPresent(null, baseNow)).toBe(false);
      expect(isPresent(undefined, baseNow)).toBe(false);
      expect(isPresent('12345' as any, baseNow)).toBe(false);
      expect(isPresent(Infinity, baseNow)).toBe(false);
      expect(isPresent(-Infinity, baseNow)).toBe(false);
    });
  });

  describe('filterPresent', () => {
    it('filters out expired riders and keeps present ones', () => {
      const users = [
        { uid: 'u1', deviceId: 'd1', lastSeen: baseNow - 5 * 60 * 1000 }, // 5 min ago (present)
        { uid: 'u2', deviceId: 'd1', lastSeen: baseNow - 35 * 60 * 1000 }, // 35 min ago (expired)
        { uid: 'u3', deviceId: 'd1', lastSeen: NaN }, // invalid
      ];

      const result = filterPresent(users, baseNow);
      expect(result).toHaveLength(1);
      expect(result[0].uid).toBe('u1');
    });

    it('dedupes by uid_deviceId and keeps the newest lastSeen', () => {
      const users = [
        { uid: 'u1', deviceId: 'd1', lastSeen: baseNow - 10 * 60 * 1000, marker: 'older' },
        { uid: 'u1', deviceId: 'd1', lastSeen: baseNow - 2 * 60 * 1000, marker: 'newer' },
        { uid: 'u1', deviceId: 'd2', lastSeen: baseNow - 4 * 60 * 1000, marker: 'different-device' },
      ];

      const result = filterPresent(users, baseNow);
      expect(result).toHaveLength(2);

      const d1User = result.find((u) => u.uid === 'u1' && u.deviceId === 'd1');
      expect(d1User?.marker).toBe('newer');

      const d2User = result.find((u) => u.uid === 'u1' && u.deviceId === 'd2');
      expect(d2User?.marker).toBe('different-device');
    });

    it('handles default unknown deviceId when deviceId is omitted', () => {
      const users = [
        { uid: 'u1', lastSeen: baseNow - 15 * 60 * 1000, marker: 'first' },
        { uid: 'u1', lastSeen: baseNow - 3 * 60 * 1000, marker: 'second' },
      ];

      const result = filterPresent(users, baseNow);
      expect(result).toHaveLength(1);
      expect(result[0].marker).toBe('second');
    });

    it('returns empty array when input is empty or invalid', () => {
      expect(filterPresent([], baseNow)).toEqual([]);
      expect(filterPresent(null as any, baseNow)).toEqual([]);
    });
  });

  describe('presenceLabel', () => {
    it('returns "Active now" for timestamps under 2 minutes ago', () => {
      expect(presenceLabel(baseNow, baseNow)).toBe('Active now');
      expect(presenceLabel(baseNow - 30 * 1000, baseNow)).toBe('Active now');
      expect(presenceLabel(baseNow - 119 * 1000, baseNow)).toBe('Active now');
    });

    it('returns "Active now" for future timestamps (clock skew)', () => {
      expect(presenceLabel(baseNow + 45 * 1000, baseNow)).toBe('Active now');
    });

    it('returns "Seen N min ago" rounding down minutes for diff >= 2 minutes', () => {
      expect(presenceLabel(baseNow - 2 * 60 * 1000, baseNow)).toBe('Seen 2 min ago');
      expect(presenceLabel(baseNow - (2 * 60 + 59) * 1000, baseNow)).toBe('Seen 2 min ago');
      expect(presenceLabel(baseNow - (5 * 60 + 30) * 1000, baseNow)).toBe('Seen 5 min ago');
      expect(presenceLabel(baseNow - 29 * 60 * 1000, baseNow)).toBe('Seen 29 min ago');
      expect(presenceLabel(baseNow - 30 * 60 * 1000, baseNow)).toBe('Seen 30 min ago');
    });

    it('returns "Offline" for non-finite or invalid timestamps', () => {
      expect(presenceLabel(NaN, baseNow)).toBe('Offline');
      expect(presenceLabel(null, baseNow)).toBe('Offline');
      expect(presenceLabel(undefined, baseNow)).toBe('Offline');
    });
  });
});
