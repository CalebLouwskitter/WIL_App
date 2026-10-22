import {
  describeMapStatus,
  initialMapStatus,
  mapFailureHint,
  mapStatusReducer,
  type MapStatusAction,
  type MapStatusState,
} from '../utils/mapStatus';

const run = (...actions: MapStatusAction[]): MapStatusState =>
  actions.reduce(mapStatusReducer, initialMapStatus);

const sized = { type: 'layout', width: 360, height: 200 } as const;

describe('mapStatusReducer', () => {
  it('starts in the starting phase with no failure', () => {
    expect(initialMapStatus).toMatchObject({ phase: 'starting', failure: null, size: null, attempt: 1 });
  });

  it('goes starting -> ready -> loaded', () => {
    expect(run(sized, { type: 'ready' }).phase).toBe('ready');
    expect(run(sized, { type: 'ready' }, { type: 'loaded' })).toMatchObject({ phase: 'loaded', failure: null });
  });

  it('a timeout before onMapReady is a not-ready failure', () => {
    expect(run(sized, { type: 'timeout' })).toMatchObject({ phase: 'failed', failure: 'not-ready' });
  });

  it('a timeout after onMapReady without onMapLoaded is a tiles failure', () => {
    expect(run(sized, { type: 'ready' }, { type: 'timeout' })).toMatchObject({ phase: 'failed', failure: 'tiles-timeout' });
  });

  it('reports no-size instead when the map was laid out at zero height', () => {
    const zero = { type: 'layout', width: 360, height: 0 } as const;
    expect(run(zero, { type: 'timeout' }).failure).toBe('no-size');
    expect(run(zero, { type: 'ready' }, { type: 'timeout' }).failure).toBe('no-size');
  });

  it('a timeout after tiles loaded changes nothing', () => {
    const loaded = run(sized, { type: 'ready' }, { type: 'loaded' });
    expect(mapStatusReducer(loaded, { type: 'timeout' })).toBe(loaded);
  });

  it('tiles that arrive after the timeout recover the map', () => {
    expect(run(sized, { type: 'ready' }, { type: 'timeout' }, { type: 'loaded' })).toMatchObject({ phase: 'loaded', failure: null });
  });

  it('a late onMapReady clears a not-ready failure and waits for tiles', () => {
    expect(run(sized, { type: 'timeout' }, { type: 'ready' })).toMatchObject({ phase: 'ready', failure: null });
  });

  it('an error fails the map and is not undone by later events', () => {
    const failed = run(sized, { type: 'ready' }, { type: 'error', message: 'boom' });
    expect(failed).toMatchObject({ phase: 'failed', failure: 'error', errorMessage: 'boom' });
    expect(mapStatusReducer(failed, { type: 'loaded' })).toBe(failed);
    expect(mapStatusReducer(failed, { type: 'ready' })).toBe(failed);
  });

  it('retry resets the attempt so the map remounts from scratch', () => {
    const failed = run(sized, { type: 'ready' }, { type: 'timeout' });
    const retried = mapStatusReducer(failed, { type: 'retry' });
    expect(retried).toEqual({ ...initialMapStatus, attempt: 2 });
    expect(mapStatusReducer(retried, { type: 'retry' }).attempt).toBe(3);
  });
});

describe('mapFailureHint', () => {
  const devBuild = { isExpoGo: false, platform: 'android' };
  const expoGo = { isExpoGo: true, platform: 'android' };

  it('points a zero-size map at layout, not the network or key', () => {
    expect(mapFailureHint('no-size', devBuild)).toMatch(/layout/);
  });

  it('mentions the API key for missing tiles in an Android build', () => {
    expect(mapFailureHint('tiles-timeout', devBuild)).toMatch(/API key/);
  });

  it('does not blame this build\'s key in Expo Go', () => {
    expect(mapFailureHint('tiles-timeout', expoGo)).toMatch(/Expo Go uses its own Maps key/);
  });

  it('suggests a development build when Expo Go never starts the map', () => {
    expect(mapFailureHint('not-ready', expoGo)).toMatch(/development build/);
  });
});

describe('describeMapStatus', () => {
  it('summarises phase, size and attempt without coordinates', () => {
    expect(describeMapStatus(run(sized, { type: 'ready' }, { type: 'timeout' }))).toBe(
      'failed:tiles-timeout size=360x200 attempt=1'
    );
    expect(describeMapStatus(initialMapStatus)).toBe('starting size=no layout yet attempt=1');
  });
});
