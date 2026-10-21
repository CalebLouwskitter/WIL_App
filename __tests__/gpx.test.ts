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

  it('names the file after the start time', () => {
    expect(gpxFileName(ride)).toBe('ride-2025-10-18-06-30.gpx');
  });
});
