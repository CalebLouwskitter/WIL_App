import { SHEET_TRAVEL, sheetDragValue, sheetExpandedAfterRelease } from '../utils/bottomSheet';

describe('sheetExpandedAfterRelease', () => {
  it('a long upward drag expands a collapsed sheet', () => {
    expect(sheetExpandedAfterRelease(false, 0, -120)).toBe(true);
  });

  it('a long downward drag collapses an expanded sheet', () => {
    expect(sheetExpandedAfterRelease(true, 0, 120)).toBe(false);
  });

  it('uses the current state, not the state when the gesture handler was created', () => {
    // The old handler always behaved as if the sheet were collapsed; once expanded,
    // a downward drag must collapse it and an upward drag must leave it open.
    expect(sheetExpandedAfterRelease(true, 0, 80)).toBe(false);
    expect(sheetExpandedAfterRelease(true, 0, -80)).toBe(true);
  });

  it('a short drag snaps back to the current state', () => {
    expect(sheetExpandedAfterRelease(false, 0, -30)).toBe(false);
    expect(sheetExpandedAfterRelease(true, 0, 30)).toBe(true);
  });

  it('a long drag in the direction it is already open or closed changes nothing', () => {
    expect(sheetExpandedAfterRelease(false, 0, 120)).toBe(false);
    expect(sheetExpandedAfterRelease(true, 0, -120)).toBe(true);
  });

  it('a tap on the handle toggles the sheet', () => {
    expect(sheetExpandedAfterRelease(false, 0, 0)).toBe(true);
    expect(sheetExpandedAfterRelease(true, 2, -3)).toBe(false);
  });
});

describe('sheetDragValue', () => {
  it('follows the finger up from collapsed', () => {
    expect(sheetDragValue(false, -100)).toBe(100);
  });

  it('follows the finger down from expanded', () => {
    expect(sheetDragValue(true, 100)).toBe(SHEET_TRAVEL - 100);
  });

  it('stays within the sheet travel', () => {
    expect(sheetDragValue(false, -1000)).toBe(SHEET_TRAVEL);
    expect(sheetDragValue(true, 1000)).toBe(0);
  });

  it('ignores drags past the end the sheet is already at', () => {
    expect(sheetDragValue(false, 40)).toBeNull();
    expect(sheetDragValue(true, -40)).toBeNull();
  });
});
