jest.mock('expo-file-system', () => ({
  Paths: { document: '/mock-doc-path' },
  File: jest.fn().mockImplementation((path, filename) => ({
    uri: `${path}/${filename}`,
    write: jest.fn(),
    exists: true,
    info: () => ({ size: 1024 }),
  })),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-media-library/legacy', () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  createAssetAsync: jest.fn().mockResolvedValue({ id: 'asset-1' }),
  getAlbumAsync: jest.fn().mockResolvedValue(null),
  createAlbumAsync: jest.fn().mockResolvedValue(undefined),
  addAssetsToAlbumAsync: jest.fn().mockResolvedValue(undefined),
}));

import {
  buildPersonalReportRows,
  buildPersonalReportWorkbook,
  buildDistanceDataRows,
  generateTextSummary,
  ReportDownload,
  type ReportData,
} from '../services/AnalyticsService';

const zeroRideFixture: ReportData = {
  timeSlot: 'month',
  userStats: {
    totalRides: 0,
    totalDistance: 0,
    favoriteTrail: '-',
    hoursRidden: 0,
    trailsCompleted: 0,
    avgSpeed: 0,
    lastRide: '-',
  },
  chartData: {
    rideFrequency: [],
    trailPopularity: [],
    weeklyDistance: [],
  },
  generatedDate: '2026-10-22T12:00:00.000Z',
};

const sampleReportFixture: ReportData = {
  timeSlot: 'month',
  userStats: {
    totalRides: 4,
    totalDistance: 25.5,
    favoriteTrail: 'Coastal Path',
    hoursRidden: 3.5,
    trailsCompleted: 2,
    avgSpeed: 7.3,
    lastRide: 'Today',
  },
  chartData: {
    rideFrequency: [
      { label: 'Week 1', value: 2, frontColor: '#3B82F6' },
      { label: 'Week 2', value: 2, frontColor: '#3B82F6' },
    ],
    trailPopularity: [
      { label: 'Coastal Path', value: 75, color: '#3B82F6' },
      { label: 'Forest Loop', value: 25, color: '#10B981' },
    ],
    weeklyDistance: [
      { value: 3.456, dataPointText: '3.5km' },
      { value: 12.789, dataPointText: '12.8km' },
      { value: 9.2, dataPointText: '9.2km' },
    ],
  },
  generatedDate: '2026-10-22T12:00:00.000Z',
};

describe('personalReport builder functions', () => {
  it('guards zero-ride fixture so no NaN or Infinity appears in any sheet row', () => {
    const reportRows = buildPersonalReportRows(zeroRideFixture);

    for (const [sheetKey, rows] of Object.entries(reportRows)) {
      for (const row of rows) {
        for (const cell of row) {
          expect(Number.isNaN(cell)).toBe(false);
          expect(cell === Infinity || cell === -Infinity).toBe(false);
          if (typeof cell === 'string') {
            expect(cell.includes('NaN')).toBe(false);
            expect(cell.includes('Infinity')).toBe(false);
          }
        }
      }
    }

    // Verify per-ride metrics are 'N/A' when rides are 0
    const distancePerRideRow = reportRows.analysis.find((r) => r[0] === 'Distance per Ride');
    expect(distancePerRideRow?.[1]).toBe('N/A');

    const timePerRideRow = reportRows.analysis.find((r) => r[0] === 'Time per Ride');
    expect(timePerRideRow?.[1]).toBe('N/A');
  });

  it('guards zero-ride fixture in text summary without NaN or Infinity', () => {
    const summary = generateTextSummary(zeroRideFixture);
    expect(summary.includes('NaN')).toBe(false);
    expect(summary.includes('Infinity')).toBe(false);
    expect(summary).toContain('- Distance per Ride: N/A');
    expect(summary).toContain('- Rides per Day: 0.0');

    // Also check ReportDownload.generateTextSummary delegates properly
    expect(ReportDownload.generateTextSummary(zeroRideFixture)).toBe(summary);
  });

  it('formats distance data as numbers rounded to 2 decimals with Point column header', () => {
    const distanceRows = buildDistanceDataRows(sampleReportFixture.chartData);

    // Header check
    expect(distanceRows[0]).toEqual(['Point', 'Distance (km)']);

    // Point 1: 3.456 -> 3.46 (number)
    expect(distanceRows[1]).toEqual([1, 3.46]);
    expect(typeof distanceRows[1][0]).toBe('number');
    expect(typeof distanceRows[1][1]).toBe('number');

    // Point 2: 12.789 -> 12.79 (number)
    expect(distanceRows[2]).toEqual([2, 12.79]);
    expect(typeof distanceRows[2][1]).toBe('number');

    // Point 3: 9.2 -> 9.2 (number)
    expect(distanceRows[3]).toEqual([3, 9.2]);
    expect(typeof distanceRows[3][1]).toBe('number');
  });

  it('removes invented Goals & Achievements rows from Detailed Analysis', () => {
    const reportRows = buildPersonalReportRows(sampleReportFixture);
    const analysisRows = reportRows.analysis;

    // Verify "Goals & Achievements" section is removed
    expect(analysisRows.some((r) => r[0] === 'Goals & Achievements')).toBe(false);
    expect(analysisRows.some((r) => r[0] === 'Total Distance Goal')).toBe(false);
    expect(analysisRows.some((r) => r[0] === 'Trails Goal')).toBe(false);
  });

  it('builds valid workbook with all 5 sheets and no NaN or Infinity', () => {
    const wb = buildPersonalReportWorkbook(zeroRideFixture);
    expect(wb.SheetNames).toEqual([
      'Summary',
      'Ride Frequency',
      'Trail Popularity',
      'Distance Data',
      'Analysis',
    ]);

    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      for (const [cellRef, cellObj] of Object.entries(sheet)) {
        if (cellRef.startsWith('!')) continue;
        const val = (cellObj as { v?: unknown }).v;
        expect(Number.isNaN(val)).toBe(false);
        expect(val === Infinity || val === -Infinity).toBe(false);
        if (typeof val === 'string') {
          expect(val.includes('NaN')).toBe(false);
          expect(val.includes('Infinity')).toBe(false);
        }
      }
    }
  });
});
