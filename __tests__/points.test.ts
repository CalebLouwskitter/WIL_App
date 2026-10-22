import { ridePoints } from '../utils/points';

describe('ridePoints', () => {
  it('calculates 12 points for 1 ride of 1600 m', () => {
    expect(ridePoints(1, 1600)).toBe(12);
  });

  it('calculates 0 points for 0 rides and 0 m', () => {
    expect(ridePoints(0, 0)).toBe(0);
  });

  it('calculates 22 points for 2 rides of 2499 m total', () => {
    expect(ridePoints(2, 2499)).toBe(22);
  });

  it('rounds distance to the nearest kilometre using Math.round', () => {
    // 1 ride + 1499m rounds to 1km -> 10 + 1 = 11
    expect(ridePoints(1, 1499)).toBe(11);
    // 1 ride + 1500m rounds to 2km -> 10 + 2 = 12
    expect(ridePoints(1, 1500)).toBe(12);
    // 3 rides + 5000m -> 30 + 5 = 35
    expect(ridePoints(3, 5000)).toBe(35);
  });
});
