// Map readiness is tracked separately from location. A map can have a GPS fix
// and still show no tiles, so the UI must never treat one as proof of the other.

export type MapPhase = 'starting' | 'ready' | 'loaded' | 'failed';

/**
 * Why a map is in the failed phase. Each one points at a different kind of cause:
 * - not-ready: the native map view never reported onMapReady (native module/SDK problem)
 * - tiles-timeout: onMapReady fired but onMapLoaded never did (network, API key or provider)
 * - no-size: the map has zero width or height (layout problem)
 * - error: rendering the map threw
 */
export type MapFailure = 'not-ready' | 'tiles-timeout' | 'no-size' | 'error';

export type MapSize = { width: number; height: number };

export type MapStatusState = {
  phase: MapPhase;
  failure: MapFailure | null;
  /** Last size reported by onLayout for this attempt, or null before the first layout. */
  size: MapSize | null;
  /** Increments on every retry; use it as the MapView key to force a remount. */
  attempt: number;
  errorMessage: string | null;
};

export type MapStatusAction =
  | { type: 'layout'; width: number; height: number }
  | { type: 'ready' }
  | { type: 'loaded' }
  | { type: 'timeout' }
  | { type: 'error'; message?: string }
  | { type: 'retry' };

/** Wait this long for onMapReady after mount. */
export const MAP_READY_TIMEOUT_MS = 15000;
/** Wait this long for onMapLoaded (tiles drawn) after onMapReady. */
export const MAP_TILES_TIMEOUT_MS = 10000;

export const initialMapStatus: MapStatusState = {
  phase: 'starting',
  failure: null,
  size: null,
  attempt: 1,
  errorMessage: null,
};

export const hasNoSize = (size: MapSize | null): boolean =>
  !!size && (size.width < 1 || size.height < 1);

export function mapStatusReducer(state: MapStatusState, action: MapStatusAction): MapStatusState {
  switch (action.type) {
    case 'layout':
      if (state.size && state.size.width === action.width && state.size.height === action.height) return state;
      return { ...state, size: { width: action.width, height: action.height } };
    case 'ready':
      // A late onMapReady still counts: drop a not-ready/no-size failure and wait for tiles
      if (state.phase === 'loaded' || state.failure === 'error') return state;
      if (state.phase === 'failed' && state.failure === 'tiles-timeout') return state;
      return { ...state, phase: 'ready', failure: null };
    case 'loaded':
      // Tiles that arrive after the timeout recover the map
      if (state.failure === 'error') return state;
      return { ...state, phase: 'loaded', failure: null };
    case 'timeout': {
      if (state.phase === 'loaded' || state.phase === 'failed') return state;
      // A zero-size map can never draw tiles, so report the layout cause first
      if (hasNoSize(state.size)) return { ...state, phase: 'failed', failure: 'no-size' };
      return { ...state, phase: 'failed', failure: state.phase === 'starting' ? 'not-ready' : 'tiles-timeout' };
    }
    case 'error':
      return { ...state, phase: 'failed', failure: 'error', errorMessage: action.message ?? null };
    case 'retry':
      return { ...initialMapStatus, attempt: state.attempt + 1 };
  }
}

export type MapEnvironment = {
  /** True when running inside Expo Go rather than a development or store build. */
  isExpoGo: boolean;
  platform: string;
};

/**
 * A short, honest hint about what usually causes this failure. It names likely
 * causes; it is not a diagnosis.
 */
export function mapFailureHint(failure: MapFailure, env: MapEnvironment): string {
  switch (failure) {
    case 'no-size':
      return 'The map has no space on screen (zero width or height). This is a layout problem, not the network or a key.';
    case 'not-ready':
      return env.isExpoGo
        ? 'The map view never started. Expo Go may not support this map setup on this phone. Try a development build.'
        : 'The map view never started. The native maps module may be missing or failing in this build.';
    case 'tiles-timeout':
      if (env.isExpoGo) {
        return 'The map started but no map tiles arrived. Check the internet connection first. Expo Go does not use this app\'s Maps key.';
      }
      return env.platform === 'android'
        ? 'The map started but no map tiles arrived. Likely causes: no internet connection, or the Google Maps API key is missing or not authorised for this build.'
        : 'The map started but no map tiles arrived. Check the internet connection, or the maps API key if this build uses Google Maps.';
    case 'error':
      return 'The map stopped with an error while drawing.';
  }
}

/** One-line status for dev logs and the diagnostics line. Never includes coordinates. */
export function describeMapStatus(state: MapStatusState): string {
  const size = state.size ? `${Math.round(state.size.width)}x${Math.round(state.size.height)}` : 'no layout yet';
  const what = state.phase === 'failed' ? `failed:${state.failure}` : state.phase;
  return `${what} size=${size} attempt=${state.attempt}`;
}
