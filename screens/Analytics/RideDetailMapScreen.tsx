import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import MapView, { Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getRides } from '../../services/RideStorage';
import type { RideData } from '../../hooks/useRideTracker';

interface RouteParams { startTime: number }

const RideDetailMapScreen = () => {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { startTime } = (route.params || {}) as RouteParams;
  const [ride, setRide] = useState<RideData | null>(null);
  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    (async () => {
      const rides = await getRides();
      const r = rides.find(x => x.startTime === startTime) || null;
      setRide(r);
    })();
  }, [startTime]);

  const coords = useMemo(() => ride?.path?.map(p => ({ latitude: p.latitude, longitude: p.longitude })) || [], [ride]);

  if (!ride) {
    return (
      <View style={styles.center}><Text>Ride not found.</Text></View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: coords[0]?.latitude || -33.0,
          longitude: coords[0]?.longitude || 18.0,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        onLayout={() => {
          if (coords.length > 1) {
            mapRef.current?.fitToCoordinates(coords, { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: false });
          }
        }}
      >
        {coords.length > 0 && (
          <Polyline coordinates={coords} strokeWidth={4} strokeColor="#1E88E5" />
        )}
      </MapView>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>
          Ride on {new Date(ride.startTime).toLocaleString()}
          {ride.horseName ? ` • ${ride.horseName}` : ''}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  map: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { position: 'absolute', top: 40, left: 16, right: 16, alignItems: 'center' },
  backBtn: { position: 'absolute', left: 0, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  title: { color: '#fff', fontWeight: '600' },
});

export default RideDetailMapScreen;
