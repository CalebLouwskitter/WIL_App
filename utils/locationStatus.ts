export type LocationStatus = 'locating' | 'ok' | 'denied' | 'services-off' | 'timeout';

export type Coords = { latitude: number; longitude: number };

export type LocationState = {
  status: LocationStatus;
  /** Latest real GPS fix. Never a fallback or guess. */
  coords: Coords | null;
};

export type LocationAction =
  | { type: 'locating' }
  | { type: 'fix'; coords: Coords }
  | { type: 'denied' }
  | { type: 'services-off' }
  | { type: 'timeout' };

export const initialLocationState: LocationState = { status: 'locating', coords: null };

export function locationReducer(state: LocationState, action: LocationAction): LocationState {
  switch (action.type) {
    case 'locating':
      // Keep an earlier fix visible while a retry is running
      return { ...state, status: state.coords ? 'ok' : 'locating' };
    case 'fix':
      return { status: 'ok', coords: action.coords };
    case 'denied':
      return { status: 'denied', coords: null };
    case 'services-off':
      return { status: 'services-off', coords: null };
    case 'timeout':
      // A timeout while we still hold a recent fix does not invalidate that fix
      return state.coords ? state : { status: 'timeout', coords: null };
  }
}

/** Turns a thrown location error into the status the UI should show. */
export function classifyLocationError(error: unknown): 'denied' | 'services-off' | 'timeout' {
  const code = String((error as any)?.code ?? '');
  const message = String((error as any)?.message ?? error ?? '').toLowerCase();
  if (code === 'E_LOCATION_TIMEOUT' || message.includes('timed out') || message.includes('timeout')) return 'timeout';
  if (code === 'E_NO_PERMISSIONS' || message.includes('permission')) return 'denied';
  if (
    code === 'E_LOCATION_SETTINGS_UNSATISFIED' ||
    code === 'E_LOCATION_SERVICES_DISABLED' ||
    message.includes('disabled') ||
    message.includes('settings')
  ) {
    return 'services-off';
  }
  // Anything else means we simply have no fix right now
  return 'timeout';
}

export const locationStatusMessage = (status: LocationStatus): string => {
  switch (status) {
    case 'locating':
      return 'Finding your location…';
    case 'ok':
      return 'Using your current location.';
    case 'denied':
      return 'Location permission is off. Allow location access in Settings, or pick a spot on the map.';
    case 'services-off':
      return 'Location services are turned off. Turn them on, or pick a spot on the map.';
    case 'timeout':
      return "Couldn't get a GPS fix. Move to open sky and retry, or pick a spot on the map.";
  }
};
