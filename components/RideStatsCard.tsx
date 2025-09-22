import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function RideStatsCard({
  distance,
  elevation,
  durationMs,
  title,
}: {
  distance: number;
  elevation: number;
  durationMs: number;
  title?: string;
}) {
  const km = distance / 1000;
  const mins = durationMs / 1000 / 60;

  return (
    <View style={styles.card}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={styles.row}>
        <View style={styles.metric}>
          <Text style={styles.value}>{km.toFixed(2)}</Text>
          <Text style={styles.label}>km</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.value}>{elevation.toFixed(0)}</Text>
          <Text style={styles.label}>m gain</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.value}>{mins.toFixed(1)}</Text>
          <Text style={styles.label}>min</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginVertical: 8 },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  metric: { alignItems: 'center', flex: 1 },
  value: { fontSize: 18, fontWeight: '700' },
  label: { fontSize: 12, color: '#6B7280' },
});
