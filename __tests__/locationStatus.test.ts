import {
  classifyLocationError,
  initialLocationState,
  locationReducer,
  locationStatusMessage,
} from '../utils/locationStatus';

const fix = { latitude: -34.03, longitude: 25.5 };

describe('locationReducer', () => {
  it('starts locating with no coordinates', () => {
    expect(initialLocationState).toEqual({ status: 'locating', coords: null });
  });

  it('only a real fix produces ok and coordinates', () => {
    expect(locationReducer(initialLocationState, { type: 'fix', coords: fix })).toEqual({ status: 'ok', coords: fix });
  });

  it('denied, services-off and timeout carry no coordinates (no fallback position)', () => {
    for (const type of ['denied', 'services-off', 'timeout'] as const) {
      const next = locationReducer(initialLocationState, { type });
      expect(next).toEqual({ status: type, coords: null });
    }
  });

  it('a late fix recovers from timeout', () => {
    const timedOut = locationReducer(initialLocationState, { type: 'timeout' });
    expect(locationReducer(timedOut, { type: 'fix', coords: fix }).status).toBe('ok');
  });

  it('a timeout does not discard an existing fix, but losing permission does', () => {
    const ok = locationReducer(initialLocationState, { type: 'fix', coords: fix });
    expect(locationReducer(ok, { type: 'timeout' })).toBe(ok);
    expect(locationReducer(ok, { type: 'denied' })).toEqual({ status: 'denied', coords: null });
  });

  it('retrying keeps an existing fix, otherwise goes back to locating', () => {
    const ok = locationReducer(initialLocationState, { type: 'fix', coords: fix });
    expect(locationReducer(ok, { type: 'locating' })).toEqual(ok);
    const denied = locationReducer(initialLocationState, { type: 'denied' });
    expect(locationReducer(denied, { type: 'locating' }).status).toBe('locating');
  });
});

describe('classifyLocationError', () => {
  it('maps expo-location style errors to a status', () => {
    expect(classifyLocationError({ code: 'E_LOCATION_TIMEOUT' })).toBe('timeout');
    expect(classifyLocationError(new Error('Location request timed out'))).toBe('timeout');
    expect(classifyLocationError({ code: 'E_NO_PERMISSIONS' })).toBe('denied');
    expect(classifyLocationError(new Error('Location permission not granted'))).toBe('denied');
    expect(classifyLocationError({ code: 'E_LOCATION_SETTINGS_UNSATISFIED' })).toBe('services-off');
    expect(classifyLocationError(new Error('Location services are disabled'))).toBe('services-off');
    expect(classifyLocationError(new Error('something else'))).toBe('timeout');
  });
});

describe('locationStatusMessage', () => {
  it('has a distinct message for every status', () => {
    const msgs = (['locating', 'ok', 'denied', 'services-off', 'timeout'] as const).map(locationStatusMessage);
    expect(new Set(msgs).size).toBe(5);
  });
});
