import { useCallback, useEffect, useReducer, useRef } from 'react';
import * as Location from 'expo-location';
import {
  classifyLocationError,
  initialLocationState,
  locationReducer,
  type Coords,
} from '../utils/locationStatus';

const FIX_TIMEOUT_MS = 15_000;

const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error('Location request timed out'), { code: 'E_LOCATION_TIMEOUT' })), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });

/**
 * Foreground location for forms that need a real position: asks permission, takes one
 * fix with a timeout, then watches for updates until unmount. The reported status is
 * always one of locating / ok / denied / services-off / timeout; there is no fallback
 * position. `onFix` runs for every real fix (use a ref inside it for changing state).
 */
export function useForegroundLocation(onFix?: (coords: Coords, isFirst: boolean) => void) {
  const [state, dispatch] = useReducer(locationReducer, initialLocationState);
  const onFixRef = useRef(onFix);
  onFixRef.current = onFix;
  const hadFixRef = useRef(false);
  const attemptRef = useRef(0);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const mountedRef = useRef(true);

  const handleFix = useCallback((position: Location.LocationObject) => {
    if (!mountedRef.current) return;
    const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
    const isFirst = !hadFixRef.current;
    hadFixRef.current = true;
    dispatch({ type: 'fix', coords });
    onFixRef.current?.(coords, isFirst);
  }, []);

  const start = useCallback(async () => {
    const attempt = ++attemptRef.current;
    const stale = () => !mountedRef.current || attempt !== attemptRef.current;
    dispatch({ type: 'locating' });
    watchRef.current?.remove();
    watchRef.current = null;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (stale()) return;
      if (status !== 'granted') {
        dispatch({ type: 'denied' });
        return;
      }

      if (!(await Location.hasServicesEnabledAsync())) {
        if (stale()) return;
        dispatch({ type: 'services-off' });
        return;
      }

      try {
        const first = await withTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
          FIX_TIMEOUT_MS
        );
        if (stale()) return;
        handleFix(first);
      } catch (error) {
        if (stale()) return;
        const kind = classifyLocationError(error);
        dispatch({ type: kind });
        // On a timeout keep watching: a late fix flips the status to ok
        if (kind !== 'timeout') return;
      }

      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 3000 },
        handleFix
      );
      if (stale()) {
        sub.remove();
        return;
      }
      watchRef.current = sub;
    } catch (error) {
      if (stale()) return;
      dispatch({ type: classifyLocationError(error) });
    }
  }, [handleFix]);

  useEffect(() => {
    mountedRef.current = true;
    start();
    return () => {
      mountedRef.current = false;
      attemptRef.current++;
      watchRef.current?.remove();
      watchRef.current = null;
    };
  }, [start]);

  return { state, retry: start };
}
