/**
 * Geofencing Utility
 * Manages geographic boundary constraints for ride tracking
 * Implements point-in-polygon algorithm to restrict location broadcasting
 * and automatically stop rides when users exit the designated area
 */

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/**
 * Authorized riding area boundary polygon
 * Coordinates define the perimeter of the approved trail system
 * Length: 7.42 km (4.611 mi)
 */
export const AUTHORIZED_BOUNDARY: GeoPoint[] = [
  { latitude: -34.0272328, longitude: 25.4867792 },
  { latitude: -34.0386846, longitude: 25.4861355 },
  { latitude: -34.0425697, longitude: 25.5338788 },
  { latitude: -34.0392714, longitude: 25.5339432 },
  { latitude: -34.0397693, longitude: 25.5426550 },
  { latitude: -34.0347905, longitude: 25.5427194 },
];

/**
 * Check if a point is inside a polygon using ray-casting algorithm
 * Based on the Jordan curve theorem
 * 
 * @param point - The point to test
 * @param polygon - Array of points defining the polygon boundary
 * @returns true if point is inside polygon, false otherwise
 */
export function isPointInPolygon(point: GeoPoint, polygon: GeoPoint[]): boolean {
  const { latitude: x, longitude: y } = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].latitude;
    const yi = polygon[i].longitude;
    const xj = polygon[j].latitude;
    const yj = polygon[j].longitude;

    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Check if a location is within the authorized riding area
 * 
 * @param location - Location to check
 * @returns true if within authorized boundary, false otherwise
 */
export function isWithinAuthorizedArea(location: GeoPoint): boolean {
  return isPointInPolygon(location, AUTHORIZED_BOUNDARY);
}

/**
 * Get the boundary polygon for display purposes
 * 
 * @returns Array of GeoPoints defining the authorized boundary
 */
export function getAuthorizedBoundary(): GeoPoint[] {
  return [...AUTHORIZED_BOUNDARY];
}

/**
 * Calculate the center point of the authorized area
 * Useful for map centering
 * 
 * @returns Center point of the boundary polygon
 */
export function getBoundaryCenter(): GeoPoint {
  const sumLat = AUTHORIZED_BOUNDARY.reduce((sum, p) => sum + p.latitude, 0);
  const sumLng = AUTHORIZED_BOUNDARY.reduce((sum, p) => sum + p.longitude, 0);
  
  return {
    latitude: sumLat / AUTHORIZED_BOUNDARY.length,
    longitude: sumLng / AUTHORIZED_BOUNDARY.length,
  };
}
