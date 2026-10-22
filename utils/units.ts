export type UnitSystem = 'metric' | 'imperial';

/**
 * Format distance in metres into km or mi according to the selected unit system.
 * 1 mi = 1609.344 m. Non-finite values return '—'.
 */
export function formatDistance(
  metres: number | null | undefined,
  units: UnitSystem,
  decimals: number = 1
): { value: string; unit: 'km' | 'mi' } {
  const unit: 'km' | 'mi' = units === 'imperial' ? 'mi' : 'km';
  if (metres == null || !Number.isFinite(metres)) {
    return { value: '—', unit };
  }
  const numeric = units === 'imperial' ? metres / 1609.344 : metres / 1000;
  return { value: numeric.toFixed(decimals), unit };
}

/**
 * Format speed in km/h into km/h or mph according to the selected unit system.
 * 1 mi = 1609.344 m => 1.609344 km/h per mph. Non-finite values return '—'.
 */
export function formatSpeedKmh(
  kmh: number | null | undefined,
  units: UnitSystem,
  decimals: number = 1
): { value: string; unit: 'km/h' | 'mph' } {
  const unit: 'km/h' | 'mph' = units === 'imperial' ? 'mph' : 'km/h';
  if (kmh == null || !Number.isFinite(kmh)) {
    return { value: '—', unit };
  }
  const numeric = units === 'imperial' ? kmh / 1.609344 : kmh;
  return { value: numeric.toFixed(decimals), unit };
}

/**
 * Convert metres per second to kilometres per hour.
 */
export function mpsToKmh(mps: number | null | undefined): number {
  if (mps == null || !Number.isFinite(mps)) {
    return 0;
  }
  return mps * 3.6;
}
