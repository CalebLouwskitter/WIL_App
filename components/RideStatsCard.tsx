import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { Colors } from '@/constants/colors';

export default function RideStatsCard({
  distance,
  elevation,
  durationMs,
  title,
  speedKmh,
  isMetric = true,
}: {
  distance: number;
  elevation: number;
  durationMs: number;
  title?: string;
  speedKmh?: number;
  isMetric?: boolean;
}) {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const styles = useMemo(() => createStyles(palette), [palette]);
  const distanceValue = isMetric ? distance / 1000 : distance / 1609.34;
  const distanceUnit = isMetric ? 'km' : 'mi';
  const mins = durationMs / 1000 / 60;
  const hasSpeed = typeof speedKmh === 'number' && isFinite(speedKmh as number);
  const speedValue = hasSpeed ? (isMetric ? (speedKmh as number) : (speedKmh as number) * 0.621371) : 0;
  const speedUnit = isMetric ? 'km/h' : 'mph';

  return (
    <View style={styles.card}>
      {title ? <Text style={[styles.title, { color: palette.onSurface }]}>{title}</Text> : null}
      <View style={styles.row}>
        {hasSpeed && (
          <View style={styles.metric}>
            <Text style={[styles.value, { color: palette.onSurface }]}>{speedValue.toFixed(1)}</Text>
            <Text style={styles.label}>{speedUnit}</Text>
          </View>
        )}
        <View style={styles.metric}>
          <Text style={[styles.value, { color: palette.onSurface }]}>{distanceValue.toFixed(2)}</Text>
          <Text style={styles.label}>{distanceUnit}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.value, { color: palette.onSurface }]}>{elevation.toFixed(0)}</Text>
          <Text style={styles.label}>m gain</Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.value, { color: palette.onSurface }]}>{mins.toFixed(1)}</Text>
          <Text style={styles.label}>min</Text>
        </View>
      </View>
    </View>
  );
}

const createStyles = (palette: typeof Colors.light) =>
  StyleSheet.create({
    card: { backgroundColor: palette.cardElevated, borderRadius: 12, padding: 12, marginVertical: 8 },
    title: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    metric: { alignItems: 'center', flex: 1 },
    value: { fontSize: 18, fontWeight: '700' },
    label: { fontSize: 12, color: palette.onSurfaceVariant },
  });
