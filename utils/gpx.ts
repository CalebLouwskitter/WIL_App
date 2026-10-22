import type { RideData } from '../hooks/useRideTracker';

// GPX 1.1 export so rides can be opened in Strava, Garmin Connect, Google
// Earth, QGIS and similar tools. https://www.topografix.com/GPX/1/1/

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const isValidCoordinate = (lat: number, lon: number) =>
  Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

export const rideTrackName = (ride: RideData) => {
  const date = new Date(ride.startTime).toISOString().slice(0, 10);
  return ride.horseName ? `Ride on ${date} with ${ride.horseName}` : `Ride on ${date}`;
};

export const gpxFileName = (ride: RideData) => {
  const date = new Date(ride.startTime);
  const stamp = date.toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const cleanedId = ride.id ? ride.id.replace(/[^A-Za-z0-9]/g, '').slice(-8) : '';
  const suffix = cleanedId || date.toISOString().slice(17, 19);
  return `ride-${stamp}-${suffix}.gpx`;
};

/** Serialise a ride's recorded path (not the trail-snapped one) as GPX 1.1. */
export function rideToGpx(ride: RideData, creator = 'SBHRA App'): string {
  const name = escapeXml(rideTrackName(ride));
  const points = (ride.path || [])
    .filter((p) => isValidCoordinate(p.latitude, p.longitude))
    .map((p) => {
      const ele = typeof p.altitude === 'number' && Number.isFinite(p.altitude) ? `<ele>${p.altitude.toFixed(1)}</ele>` : '';
      const time = Number.isFinite(p.timestamp) ? `<time>${new Date(p.timestamp).toISOString()}</time>` : '';
      return `      <trkpt lat="${p.latitude.toFixed(7)}" lon="${p.longitude.toFixed(7)}">${ele}${time}</trkpt>`;
    });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<gpx version="1.1" creator="${escapeXml(creator)}" xmlns="http://www.topografix.com/GPX/1/1">`,
    '  <metadata>',
    `    <name>${name}</name>`,
    `    <time>${new Date(ride.startTime).toISOString()}</time>`,
    '  </metadata>',
    '  <trk>',
    `    <name>${name}</name>`,
    '    <type>horse_riding</type>',
    '    <trkseg>',
    ...points,
    '    </trkseg>',
    '  </trk>',
    '</gpx>',
    '',
  ].join('\n');
}
