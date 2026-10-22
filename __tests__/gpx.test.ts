import { gpxFileName, rideToGpx } from '../utils/gpx';
import type { RideData } from '../hooks/useRideTracker';

const start = Date.UTC(2025, 9, 18, 6, 30, 0);
const ride: RideData = {
  startTime: start,
  path: [
    { latitude: -34.0301, longitude: 25.5012, altitude: 12.34, timestamp: start },
    { latitude: -34.0305, longitude: 25.5019, altitude: null, timestamp: start + 5000 },
    { latitude: NaN, longitude: 25.5, altitude: 0, timestamp: start + 10000 },
  ],
  totalDistance: 80,
  elevationGain: 0,
  duration: 10000,
  horseName: 'Storm & <Co>',
};

describe('rideToGpx', () => {
  const gpx = rideToGpx(ride);

  it('writes a GPX 1.1 document with one track point per valid fix', () => {
    expect(gpx.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(gpx).toContain('xmlns="http://www.topografix.com/GPX/1/1"');
    expect(gpx.match(/<trkpt /g)).toHaveLength(2);
  });

  it('includes elevation and time when known', () => {
    expect(gpx).toContain(
      '<trkpt lat="-34.0301000" lon="25.5012000"><ele>12.3</ele><time>2025-10-18T06:30:00.000Z</time></trkpt>'
    );
    expect(gpx).toContain('<trkpt lat="-34.0305000" lon="25.5019000"><time>2025-10-18T06:30:05.000Z</time></trkpt>');
  });

  it('escapes XML in names', () => {
    expect(gpx).toContain('<name>Ride on 2025-10-18 with Storm &amp; &lt;Co&gt;</name>');
  });

  it('names the file after the start time and suffix', () => {
    // Old exact-name assertion was 'ride-2025-10-18-06-30.gpx';
    // now uses seconds suffix when no id is present.
    expect(gpxFileName(ride)).toBe('ride-2025-10-18-06-30-00.gpx');
  });

  it('gives different filenames to two rides starting in the same minute with different ids', () => {
    const ride1: RideData = { ...ride, id: '1729584000000_ab12cd34' };
    const ride2: RideData = { ...ride, id: '1729584000000_ef56gh78' };
    expect(gpxFileName(ride1)).toBe('ride-2025-10-18-06-30-ab12cd34.gpx');
    expect(gpxFileName(ride2)).toBe('ride-2025-10-18-06-30-ef56gh78.gpx');
    expect(gpxFileName(ride1)).not.toBe(gpxFileName(ride2));
  });

  it('falls back to start time seconds when ride has no id', () => {
    const rideAt30Sec: RideData = { ...ride, startTime: Date.UTC(2025, 9, 18, 6, 30, 30) };
    expect(gpxFileName(rideAt30Sec)).toBe('ride-2025-10-18-06-30-30.gpx');
  });

  it('ensures the filename contains only safe characters [A-Za-z0-9._-]', () => {
    const rideWithWeirdId: RideData = { ...ride, id: 'id#123@special!' };
    const name = gpxFileName(rideWithWeirdId);
    expect(name).toBe('ride-2025-10-18-06-30-3special.gpx');
    expect(/^[A-Za-z0-9._-]+$/.test(name)).toBe(true);
  });
});
