import { formatDistance, formatSpeedKmh, mpsToKmh } from '../utils/units';

describe('utils/units', () => {
  describe('formatDistance', () => {
    it('formats 1609.344 m as 1.0 mi in imperial mode with 1 decimal', () => {
      const res = formatDistance(1609.344, 'imperial', 1);
      expect(res).toEqual({ value: '1.0', unit: 'mi' });
    });

    it('formats 1500 m as 1.5 km in metric mode with 1 decimal', () => {
      const res = formatDistance(1500, 'metric', 1);
      expect(res).toEqual({ value: '1.5', unit: 'km' });
    });

    it('formats 0 m correctly in both units', () => {
      expect(formatDistance(0, 'metric', 1)).toEqual({ value: '0.0', unit: 'km' });
      expect(formatDistance(0, 'imperial', 1)).toEqual({ value: '0.0', unit: 'mi' });
      expect(formatDistance(0, 'metric', 2)).toEqual({ value: '0.00', unit: 'km' });
    });

    it('returns dash for NaN, Infinity, null, and undefined', () => {
      expect(formatDistance(NaN, 'metric', 1)).toEqual({ value: '—', unit: 'km' });
      expect(formatDistance(Infinity, 'imperial', 1)).toEqual({ value: '—', unit: 'mi' });
      expect(formatDistance(-Infinity, 'metric', 1)).toEqual({ value: '—', unit: 'km' });
      expect(formatDistance(null, 'metric', 1)).toEqual({ value: '—', unit: 'km' });
      expect(formatDistance(undefined, 'imperial', 1)).toEqual({ value: '—', unit: 'mi' });
    });

    it('supports 2 decimal places for details', () => {
      const res = formatDistance(1234, 'metric', 2);
      expect(res).toEqual({ value: '1.23', unit: 'km' });
    });
  });

  describe('formatSpeedKmh', () => {
    it('formats 36 km/h as 22.4 mph in imperial mode with 1 decimal', () => {
      const res = formatSpeedKmh(36, 'imperial', 1);
      expect(res).toEqual({ value: '22.4', unit: 'mph' });
    });

    it('formats 36 km/h as 36.0 km/h in metric mode with 1 decimal', () => {
      const res = formatSpeedKmh(36, 'metric', 1);
      expect(res).toEqual({ value: '36.0', unit: 'km/h' });
    });

    it('formats 0 km/h correctly', () => {
      expect(formatSpeedKmh(0, 'metric', 1)).toEqual({ value: '0.0', unit: 'km/h' });
      expect(formatSpeedKmh(0, 'imperial', 1)).toEqual({ value: '0.0', unit: 'mph' });
    });

    it('returns dash for non-finite values', () => {
      expect(formatSpeedKmh(NaN, 'metric', 1)).toEqual({ value: '—', unit: 'km/h' });
      expect(formatSpeedKmh(Infinity, 'imperial', 1)).toEqual({ value: '—', unit: 'mph' });
      expect(formatSpeedKmh(null, 'metric', 1)).toEqual({ value: '—', unit: 'km/h' });
      expect(formatSpeedKmh(undefined, 'imperial', 1)).toEqual({ value: '—', unit: 'mph' });
    });
  });

  describe('mpsToKmh', () => {
    it('converts m/s to km/h correctly', () => {
      expect(mpsToKmh(10)).toBeCloseTo(36, 5);
      expect(mpsToKmh(0)).toBe(0);
    });

    it('returns 0 for non-finite inputs', () => {
      expect(mpsToKmh(NaN)).toBe(0);
      expect(mpsToKmh(Infinity)).toBe(0);
      expect(mpsToKmh(null)).toBe(0);
      expect(mpsToKmh(undefined)).toBe(0);
    });
  });
});
