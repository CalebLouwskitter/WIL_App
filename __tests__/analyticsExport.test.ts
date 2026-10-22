jest.mock('../services/GlobalAnalyticsService', () => ({
  getGlobalRideStats: jest.fn(),
  getUserRideStats: jest.fn(),
  getGlobalTrailUsage: jest.fn(),
}));
jest.mock('expo-file-system', () => ({
  Paths: { document: '/mock-doc-path' },
  File: jest.fn().mockImplementation((path, filename) => ({
    uri: `${path}/${filename}`,
    write: jest.fn(),
  })),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

import {
  buildGlobalAnalyticsCsv,
  buildEngagementRows,
  buildCommunityInsightsRows,
  buildGlobalAnalyticsWorkbook,
  type GlobalAnalyticsExport,
} from '../services/AnalyticsDownloadService';

/**
 * Standard RFC 4180 CSV multi-line parser for verifying export structure and round-tripping.
 */
function parseCsv(csvText: string): string[][] {
  const lines: string[][] = [];
  let i = 0;
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  while (i < csvText.length) {
    const ch = csvText[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < csvText.length && csvText[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += ch;
        i++;
        continue;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (ch === ',') {
        currentRow.push(currentField);
        currentField = '';
        i++;
        continue;
      } else if (ch === '\n') {
        currentRow.push(currentField);
        currentField = '';
        lines.push(currentRow);
        currentRow = [];
        i++;
        continue;
      } else if (ch === '\r') {
        if (i + 1 < csvText.length && csvText[i + 1] === '\n') {
          i++;
        }
        currentRow.push(currentField);
        currentField = '';
        lines.push(currentRow);
        currentRow = [];
        i++;
        continue;
      } else {
        currentField += ch;
        i++;
        continue;
      }
    }
  }
  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField);
    lines.push(currentRow);
  }
  return lines;
}

const sampleFixture: GlobalAnalyticsExport = {
  exportDate: '2026-10-22T12:00:00.000Z',
  exportTimestamp: 1729598400000,
  globalStats: {
    totalRides: 15,
    totalDistance: 75000,
    totalDuration: 18000000,
    totalElevation: 450,
    uniqueUsers: 2,
    rides: [],
  },
  userStats: [
    {
      userId: 'user-1',
      userName: 'Smith, "Ace"',
      rideCount: 10,
      totalDistance: 50000,
      totalDuration: 12000000,
      averageDistance: 5000,
    },
    {
      userId: 'user-2',
      userName: 'Normal Rider',
      rideCount: 5,
      totalDistance: 25000,
      totalDuration: 6000000,
      averageDistance: 5000,
    },
  ],
  trailUsage: [
    {
      trailId: 'trail-1',
      trailName: 'Forest Loop\nUpper Path',
      totalDistance: 40000,
      rideCount: 8,
      uniqueUsers: 2,
      averageDistance: 5000,
    },
    {
      trailId: 'trail-2',
      trailName: 'Beach Trail, South',
      totalDistance: 35000,
      rideCount: 7,
      uniqueUsers: 1,
      averageDistance: 5000,
    },
  ],
  summary: {
    totalUsers: 2,
    totalRides: 15,
    totalDistanceKm: 75,
    totalDurationHours: 5,
    totalElevationM: 450,
    totalTrails: 2,
    averageRideDistanceKm: 5,
    averageRideDurationMinutes: 20,
  },
};

const zeroUserFixture: GlobalAnalyticsExport = {
  exportDate: '2026-10-22T12:00:00.000Z',
  exportTimestamp: 1729598400000,
  globalStats: {
    totalRides: 0,
    totalDistance: 0,
    totalDuration: 0,
    totalElevation: 0,
    uniqueUsers: 0,
    rides: [],
  },
  userStats: [],
  trailUsage: [],
  summary: {
    totalUsers: 0,
    totalRides: 0,
    totalDistanceKm: 0,
    totalDurationHours: 0,
    totalElevationM: 0,
    totalTrails: 0,
    averageRideDistanceKm: 0,
    averageRideDurationMinutes: 0,
  },
};

describe('buildGlobalAnalyticsCsv', () => {
  it('generates well-formed CSV that round-trips awkward user and trail names', () => {
    const csv = buildGlobalAnalyticsCsv(sampleFixture);
    expect(csv.endsWith('\n')).toBe(true);

    const rows = parseCsv(csv);

    // Find user statistics header index
    const userHeaderIdx = rows.findIndex(
      (r) => r.length === 7 && r[0] === 'Rank' && r[1] === 'User ID'
    );
    expect(userHeaderIdx).toBeGreaterThan(0);

    const user1Row = rows[userHeaderIdx + 1];
    const user2Row = rows[userHeaderIdx + 2];

    expect(user1Row).toHaveLength(7);
    expect(user1Row[0]).toBe('1');
    expect(user1Row[1]).toBe('user-1');
    expect(user1Row[2]).toBe('Smith, "Ace"');
    expect(user1Row[3]).toBe('10');
    expect(user1Row[4]).toBe('50.00');
    expect(user1Row[5]).toBe('3.33');
    expect(user1Row[6]).toBe('5.00');

    expect(user2Row).toHaveLength(7);
    expect(user2Row[2]).toBe('Normal Rider');

    // Find trail usage header index
    const trailHeaderIdx = rows.findIndex(
      (r) => r.length === 7 && r[0] === 'Rank' && r[1] === 'Trail ID'
    );
    expect(trailHeaderIdx).toBeGreaterThan(userHeaderIdx);

    const trail1Row = rows[trailHeaderIdx + 1];
    const trail2Row = rows[trailHeaderIdx + 2];

    expect(trail1Row).toHaveLength(7);
    expect(trail1Row[0]).toBe('1');
    expect(trail1Row[1]).toBe('trail-1');
    expect(trail1Row[2]).toBe('Forest Loop\nUpper Path');
    expect(trail1Row[3]).toBe('40.00');
    expect(trail1Row[4]).toBe('8');
    expect(trail1Row[5]).toBe('2');
    expect(trail1Row[6]).toBe('5.00');

    expect(trail2Row).toHaveLength(7);
    expect(trail2Row[2]).toBe('Beach Trail, South');
  });

  it('escapes user/trail IDs and fallback rider names correctly', () => {
    const customFixture: GlobalAnalyticsExport = {
      ...sampleFixture,
      userStats: [
        {
          userId: 'user-3-commas,quotes"',
          userName: '', // should fallback to Rider user-3-c
          rideCount: 1,
          totalDistance: 1000,
          totalDuration: 360000,
          averageDistance: 1000,
        },
      ],
      trailUsage: [],
    };

    const csv = buildGlobalAnalyticsCsv(customFixture);
    const rows = parseCsv(csv);
    const userHeaderIdx = rows.findIndex(
      (r) => r.length === 7 && r[0] === 'Rank' && r[1] === 'User ID'
    );
    const row = rows[userHeaderIdx + 1];
    expect(row).toHaveLength(7);
    expect(row[1]).toBe('user-3-commas,quotes"');
    expect(row[2]).toBe('Rider user-3-c');
  });
});

describe('Excel export and engagement rows', () => {
  it('guards engagement percentages with 0 users and uses 0.0%', () => {
    const rows = buildEngagementRows(zeroUserFixture);
    expect(rows).toEqual([
      ['Category', 'Count', 'Percentage'],
      ['Highly Active Users (10+ rides)', 0, '0.0%'],
      ['Moderate Users (5-9 rides)', 0, '0.0%'],
      ['Casual Users (1-4 rides)', 0, '0.0%'],
    ]);
  });

  it('calculates correct engagement percentages with non-zero users', () => {
    const rows = buildEngagementRows(sampleFixture);
    expect(rows).toEqual([
      ['Category', 'Count', 'Percentage'],
      ['Highly Active Users (10+ rides)', 1, '50.0%'],
      ['Moderate Users (5-9 rides)', 1, '50.0%'],
      ['Casual Users (1-4 rides)', 0, '0.0%'],
    ]);
  });

  it('relabels "Longest Trail Distance" to "Most distance ridden on one trail"', () => {
    const rowsWithData = buildCommunityInsightsRows(sampleFixture);
    const longestTrailRow = rowsWithData.find((r) => r[0] === 'Most distance ridden on one trail');
    expect(longestTrailRow).toBeDefined();
    expect(longestTrailRow?.[1]).toBe('40.00 km');
    expect(longestTrailRow?.[2]).toBe('Forest Loop\nUpper Path');

    // Make sure old misleading label is gone
    expect(rowsWithData.some((r) => r[0] === 'Longest Trail Distance')).toBe(false);

    // With zero users / empty trails
    const rowsEmpty = buildCommunityInsightsRows(zeroUserFixture);
    const emptyRow = rowsEmpty.find((r) => r[0] === 'Most distance ridden on one trail');
    expect(emptyRow).toBeDefined();
    expect(emptyRow?.[1]).toBe('N/A');
    expect(emptyRow?.[2]).toBe('N/A');
  });

  it('removes invented Rides/Day column from Top 10 Details sheet', () => {
    const wb = buildGlobalAnalyticsWorkbook(sampleFixture);
    const sheet = wb.Sheets['Top 10 Details'];
    expect(sheet).toBeDefined();

    // Row 3 (A3:F3) has headers
    const headers = [sheet['A3']?.v, sheet['B3']?.v, sheet['C3']?.v, sheet['D3']?.v, sheet['E3']?.v, sheet['F3']?.v, sheet['G3']?.v];
    expect(headers).toEqual(['Rank', 'User Name', 'Rides', 'Distance (km)', 'Duration (hrs)', 'Avg Distance (km)', undefined]);
  });

  it('contains no NaN, Infinity, or undefined cells in zero-user workbook', () => {
    const wb = buildGlobalAnalyticsWorkbook(zeroUserFixture);

    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      for (const [cellRef, cellObj] of Object.entries(sheet)) {
        if (cellRef.startsWith('!')) continue; // Skip sheet metadata
        const val = (cellObj as { v?: unknown }).v;

        // Check for NaN
        expect(Number.isNaN(val)).toBe(false);
        // Check for Infinity
        expect(val === Infinity || val === -Infinity).toBe(false);
        // Check for stringified NaN or Infinity
        if (typeof val === 'string') {
          expect(val.includes('NaN')).toBe(false);
          expect(val.includes('Infinity')).toBe(false);
        }
      }
    }
  });
});
