import React, { Component, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { mapEnvironment, useMapStatus, type MapStatusHandle } from '../hooks/useMapStatus';
import { describeMapStatus, mapFailureHint } from '../utils/mapStatus';

class MapErrorBoundary extends Component<{ onError: (error: unknown) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

type Props = {
  status: MapStatusHandle;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Smaller failure card for short previews. */
  compact?: boolean;
  /** Distance of the loading pill from the top, to clear headers drawn over the map. */
  pillTop?: number;
};

/**
 * Wraps one MapView so it is never a silent blank box: shows a loading pill
 * until tiles load, and a "Map couldn't load" card with a likely cause and a
 * Retry that remounts the map. The MapView itself must spread status.mapProps.
 */
export default function MapStatusFrame({ status, children, style, compact = false, pillTop = 8 }: Props) {
  const { state, mapKey, retry, reportError } = status;

  return (
    <View style={[styles.frame, style]}>
      <MapErrorBoundary key={mapKey} onError={reportError}>
        {children}
      </MapErrorBoundary>

      {(state.phase === 'starting' || state.phase === 'ready') && (
        <View style={[styles.pill, { top: pillTop }]} pointerEvents="none">
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.pillText}>{state.phase === 'starting' ? 'Starting map…' : 'Loading map tiles…'}</Text>
        </View>
      )}

      {state.phase === 'failed' && state.failure && (
        <View style={styles.failedCover} accessibilityRole="alert">
          <View style={[styles.card, compact && styles.cardCompact]}>
            <View style={styles.titleRow}>
              <Feather name="map" size={compact ? 16 : 20} color="#B45309" />
              <Text style={[styles.title, compact && styles.titleCompact]}>Map couldn't load</Text>
            </View>
            <Text style={[styles.hint, compact && styles.hintCompact]} numberOfLines={compact ? 3 : undefined}>
              {mapFailureHint(state.failure, mapEnvironment)}
              {state.failure === 'error' && state.errorMessage && !compact ? ` (${state.errorMessage})` : ''}
            </Text>
            <Text style={styles.details} numberOfLines={1}>
              {describeMapStatus(state)} · {mapEnvironment.isExpoGo ? 'Expo Go' : 'app build'}
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={retry}
              accessibilityRole="button"
              accessibilityLabel="Retry loading the map"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="refresh-cw" size={14} color="#FFFFFF" />
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

type MapWithStatusProps = Omit<Props, 'status' | 'children'> & {
  /** Short name used in dev logs, e.g. 'report'. */
  label: string;
  children: (mapProps: MapStatusHandle['mapProps']) => ReactNode;
};

/**
 * Same as MapStatusFrame, but owns the status hook so its timers start when the
 * map mounts. Use it for maps that are rendered conditionally (tabs, sections).
 */
export function MapWithStatus({ label, children, ...frameProps }: MapWithStatusProps) {
  const status = useMapStatus(label);
  return (
    <MapStatusFrame status={status} {...frameProps}>
      {children(status.mapProps)}
    </MapStatusFrame>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
  },
  pill: {
    position: 'absolute',
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(17, 24, 39, 0.75)',
  },
  pillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  failedCover: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: 'rgba(243, 244, 246, 0.94)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCD34D',
    gap: 8,
  },
  cardCompact: {
    padding: 10,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  titleCompact: {
    fontSize: 14,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    color: '#374151',
  },
  hintCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  details: {
    fontSize: 11,
    color: '#6B7280',
  },
  retryButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#2563EB',
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
