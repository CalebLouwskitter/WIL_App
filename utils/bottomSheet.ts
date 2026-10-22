// Pure gesture logic for the Map tab's ride-controls sheet. The animated value
// runs from 0 (collapsed, only the handle shows) to SHEET_TRAVEL (expanded).

export const SHEET_TRAVEL = 300;
/** A drag longer than this (in dp) toggles the sheet. */
export const SHEET_TOGGLE_THRESHOLD = 50;
/** Movement up to this (in dp) counts as a tap on the handle. */
export const SHEET_TAP_SLOP = 5;

const clampTravel = (value: number) => Math.min(SHEET_TRAVEL, Math.max(0, value));

/**
 * Animated value to show while the finger moves, or null to leave the sheet
 * where it is (dragging further in the direction it is already open/closed).
 */
export function sheetDragValue(expanded: boolean, dy: number): number | null {
  if (expanded && dy > 0) return clampTravel(SHEET_TRAVEL - dy);
  if (!expanded && dy < 0) return clampTravel(-dy);
  return null;
}

/** Whether the sheet should end up expanded once the finger lifts. */
export function sheetExpandedAfterRelease(expanded: boolean, dx: number, dy: number): boolean {
  // A tap on the handle toggles, so the controls are reachable without a drag
  if (Math.abs(dx) <= SHEET_TAP_SLOP && Math.abs(dy) <= SHEET_TAP_SLOP) return !expanded;
  if (Math.abs(dy) > SHEET_TOGGLE_THRESHOLD) {
    if (dy > 0 && expanded) return false;
    if (dy < 0 && !expanded) return true;
  }
  return expanded;
}
