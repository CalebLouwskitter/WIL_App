import { getBoundaryCenter, isPointInPolygon, isWithinAuthorizedArea } from '../utils/geofencing';

describe('geofencing', () => {
  const square = [
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 1 },
    { latitude: 1, longitude: 1 },
    { latitude: 1, longitude: 0 },
  ];

  it('detects points inside and outside a polygon', () => {
    expect(isPointInPolygon({ latitude: 0.5, longitude: 0.5 }, square)).toBe(true);
    expect(isPointInPolygon({ latitude: 1.5, longitude: 0.5 }, square)).toBe(false);
  });

  it('treats the boundary centre as inside the riding area', () => {
    expect(isWithinAuthorizedArea(getBoundaryCenter())).toBe(true);
  });

  it('rejects a point far from Sardinia Bay', () => {
    expect(isWithinAuthorizedArea({ latitude: -33.9249, longitude: 18.4241 })).toBe(false);
  });
});
