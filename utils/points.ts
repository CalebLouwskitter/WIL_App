/**
 * Canonical points formula for SBHRA rides.
 * Authorities: services/Data.ts (saveRideAndUpdateAggregates) and firestore.rules (addsOneRide).
 * Rule: 10 points per ride + 1 point per km (rounded to the nearest kilometre).
 */
export const ridePoints = (totalRides: number, totalDistanceMetres: number): number =>
  totalRides * 10 + Math.round(totalDistanceMetres / 1000);
