import haversine from 'haversine';
import type { Trail, TrailWaypoint } from '@/constants/trails';

export type Vec2 = { latitude: number; longitude: number };

export type TrailSegment = {
  start: Vec2;
  end: Vec2;
  length: number; // meters
  cumStart: number; // meters from trail start to segment start
};

export type TrailIndex = {
  id: string;
  name: string;
  segments: TrailSegment[];
  length: number; // meters
};

export type TrailsIndex = Record<string, TrailIndex>;

export type SnapResult = {
  trailId: string;
  trailName: string;
  snapped: Vec2;
  distanceToTrail: number; // meters
  along: number; // meters along trail from start
};

const toMetersProjection = (lat0: number) => {
  const cosLat = Math.cos((lat0 * Math.PI) / 180);
  const mPerDegLat = 110540; // approximate
  const mPerDegLon = 111320 * cosLat; // approximate
  return { mPerDegLat, mPerDegLon };
};

export function buildTrailsIndex(trails: Trail[]): TrailsIndex {
  const index: TrailsIndex = {};
  trails.forEach((t) => {
    let cum = 0;
    const segments: TrailSegment[] = [];
    for (let i = 0; i < t.routeWaypoints.length - 1; i++) {
      const a = t.routeWaypoints[i];
      const b = t.routeWaypoints[i + 1];
      const length = haversine(a as any, b as any, { unit: 'meter' });
      segments.push({ start: a, end: b, length, cumStart: cum });
      cum += length;
    }
    index[t.id] = {
      id: t.id,
      name: t.name,
      segments,
      length: cum,
    };
  });
  return index;
}

function projectPointToSegmentMeters(p: Vec2, a: Vec2, b: Vec2) {
  const proj = toMetersProjection(a.latitude);
  const ax = 0;
  const ay = 0;
  const bx = (b.longitude - a.longitude) * proj.mPerDegLon;
  const by = (b.latitude - a.latitude) * proj.mPerDegLat;
  const px = (p.longitude - a.longitude) * proj.mPerDegLon;
  const py = (p.latitude - a.latitude) * proj.mPerDegLat;

  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const ab2 = abx * abx + aby * aby || 1e-9;
  let t = (apx * abx + apy * aby) / ab2;
  t = Math.max(0, Math.min(1, t));

  const sx = ax + t * abx;
  const sy = ay + t * aby;
  const snapped: Vec2 = {
    latitude: a.latitude + (sy / proj.mPerDegLat),
    longitude: a.longitude + (sx / proj.mPerDegLon),
  };
  const dist = Math.hypot(px - sx, py - sy); // meters
  return { t, snapped, dist };
}

export function snapToTrails(point: Vec2, trailsIndex: TrailsIndex): SnapResult | null {
  let best: SnapResult | null = null;
  for (const trailId in trailsIndex) {
    const t = trailsIndex[trailId];
    for (const seg of t.segments) {
      const { t: segT, snapped, dist } = projectPointToSegmentMeters(point, seg.start, seg.end);
      const along = seg.cumStart + segT * seg.length;
      if (!best || dist < best.distanceToTrail) {
        best = { trailId: t.id, trailName: t.name, snapped, distanceToTrail: dist, along };
      }
    }
  }
  return best;
}
