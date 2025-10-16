import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, useColorScheme } from 'react-native';
import MapView, { Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { primaryPreviewRoutes } from '../constants/trails';
import { Colors } from '@/constants/colors';

const CARD_HEIGHT = 100;
const CARD_WIDTH = 140;

function TrailCard({ name, color, routeWaypoints, palette, styles }: any) {
  const first = routeWaypoints[0];
  return (
    <View
      style={[styles.card, { backgroundColor: palette.cardElevated, borderColor: palette.borderMuted, shadowColor: palette.shadowStrong }]}
    >
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        pointerEvents="none"
        initialRegion={{
          latitude: first.latitude,
          longitude: first.longitude,
          latitudeDelta: 0.0015,
          longitudeDelta: 0.0015,
        }}
      >
        <Polyline
          coordinates={routeWaypoints.map((p: any) => ({ latitude: p.latitude, longitude: p.longitude }))}
          strokeWidth={3}
          strokeColor={color || '#ffffff'}
        />
      </MapView>
      <View style={[styles.labelWrap, { backgroundColor: palette.mapOverlay }]}
      >
        <Text style={[styles.label, { color: palette.textOnDark }]}>{name}</Text>
      </View>
    </View>
  );
}

export default function TrailPreviews() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      {primaryPreviewRoutes.map((r) => (
        <TrailCard key={r.id} {...r} palette={palette} styles={styles} />
      ))}
    </ScrollView>
  );
}

const createStyles = (palette: typeof Colors.light) =>
  StyleSheet.create({
    scroll: {
      paddingHorizontal: 16,
    },
    card: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      borderRadius: 14,
      overflow: 'hidden',
      marginRight: 16,
      borderWidth: 1,
      shadowOpacity: 0.2,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 10,
      elevation: 5,
    },
    map: { flex: 1 },
    labelWrap: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingVertical: 6,
      alignItems: 'center',
    },
    label: { fontWeight: '600', fontSize: 12 },
  });
