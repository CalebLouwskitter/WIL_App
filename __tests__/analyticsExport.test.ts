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

describe('buildGlobalAnalyticsCsv', () => {
  const fixture: GlobalAnalyticsExport = {
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

  it('generates well-formed CSV that round-trips awkward user and trail names', () => {
    const csv = buildGlobalAnalyticsCsv(fixture);
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
      ...fixture,
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
