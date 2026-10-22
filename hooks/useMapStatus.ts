import { useCallback, useEffect, useReducer, useRef } from 'react';
import { Platform, type LayoutChangeEvent } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import {
  MAP_READY_TIMEOUT_MS,
  MAP_TILES_TIMEOUT_MS,
  describeMapStatus,
  initialMapStatus,
  mapStatusReducer,
  type MapEnvironment,
  type MapStatusState,
} from '../utils/mapStatus';

export const mapEnvironment: MapEnvironment = {
  isExpoGo: Constants.executionEnvironment === ExecutionEnvironment.StoreClient,
  platform: Platform.OS,
};

export type MapStatusHandle = {
  state: MapStatusState;
  /** Use as the MapView key so Retry remounts the native view. */
  mapKey: string;
  /** Spread onto the MapView. */
  mapProps: {
    onMapReady: () => void;
    onMapLoaded: () => void;
    onLayout: (e: LayoutChangeEvent) => void;
  };
  retry: () => void;
  reportError: (error: unknown) => void;
};

/**
 * Tracks one map instance: onMapReady, onMapLoaded, layout size and timeouts.
 * Logs concise transitions in development only, never coordinates.
 */
export function useMapStatus(label: string): MapStatusHandle {
  const [state, dispatch] = useReducer(mapStatusReducer, initialMapStatus);
  const mountedAt = useRef(Date.now());

  // Start a timer for whichever callback we are waiting on; a later phase cancels it
  useEffect(() => {
    if (state.phase !== 'starting' && state.phase !== 'ready') return;
    const ms = state.phase === 'starting' ? MAP_READY_TIMEOUT_MS : MAP_TILES_TIMEOUT_MS;
    const timer = setTimeout(() => dispatch({ type: 'timeout' }), ms);
    return () => clearTimeout(timer);
  }, [state.phase, state.attempt]);

  useEffect(() => {
    if (!__DEV__) return;
    const env = mapEnvironment.isExpoGo ? 'expo-go' : 'build';
    console.log(`[map:${label}] ${describeMapStatus(state)} +${Date.now() - mountedAt.current}ms ${mapEnvironment.platform}/${env}`);
  }, [label, state]);

  const onMapReady = useCallback(() => dispatch({ type: 'ready' }), []);
  const onMapLoaded = useCallback(() => dispatch({ type: 'loaded' }), []);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    dispatch({ type: 'layout', width, height });
  }, []);
  const retry = useCallback(() => {
    mountedAt.current = Date.now();
    dispatch({ type: 'retry' });
  }, []);
  const reportError = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    dispatch({ type: 'error', message });
  }, []);

  return {
    state,
    mapKey: `map-attempt-${state.attempt}`,
    mapProps: { onMapReady, onMapLoaded, onLayout },
    retry,
    reportError,
  };
}
