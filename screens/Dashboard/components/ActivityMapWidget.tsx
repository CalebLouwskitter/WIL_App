import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import MapView, { PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import { getRides } from '../../../services/RideStorage';

type ActivityStats = {
  distance: number;
  duration: number;
  lastRide: number | null;
  mapRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  ridePath?: Array<{ latitude: number; longitude: number }>;
};

export const ActivityMapWidget: React.FC = () => {
  const navigation = useNavigation<any>();
  const [stats, setStats] = useState<ActivityStats>({
    distance: 0,
    duration: 0,
    lastRide: null,
  });

  useEffect(() => {
    loadActivityStats();
  }, []);

  const loadActivityStats = async () => {
    try {
      const rides = await getRides();
      
      if (rides.length === 0) {
        // Try to get current location for default view
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            setStats({
              distance: 0,
              duration: 0,
              lastRide: null,
              mapRegion: {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              },
            });
            return;
          }
        } catch (locError) {
          console.warn('Location permission denied or unavailable');
        }
        
        setStats({ distance: 0, duration: 0, lastRide: null });
        return;
      }

      // Get stats from most recent ride
      const latestRide = rides[0];
      const distanceKm = (latestRide.totalDistance / 1000).toFixed(1);
      const durationMin = Math.round((latestRide.duration || 0) / 60000);

      // Extract path and calculate center
      const ridePath = latestRide.path.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
      }));

      let mapRegion;
      if (ridePath.length > 0) {
        // Calculate center of ride path
        const avgLat = ridePath.reduce((sum, p) => sum + p.latitude, 0) / ridePath.length;
        const avgLng = ridePath.reduce((sum, p) => sum + p.longitude, 0) / ridePath.length;
        mapRegion = {
          latitude: avgLat,
          longitude: avgLng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };
      }

      setStats({
        distance: parseFloat(distanceKm),
        duration: durationMin,
        lastRide: latestRide.startTime,
        mapRegion,
        ridePath: ridePath.length > 0 ? ridePath : undefined,
      });
    } catch (error) {
      console.warn('Failed to load activity stats:', error);
    }
  };

  const handleStartRide = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Location permission required');
      return;
    }

    navigation.navigate('Mapping', {
      screen: 'UserMapView',
      params: { startRide: true },
    });
  };

  const handleSelectHorse = () => {
    navigation.navigate('ProfileStack', {
      screen: 'HorseManagement',
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapView}>
        {stats.mapRegion ? (
          <MapView
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            region={stats.mapRegion}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
          >
            {stats.ridePath && stats.ridePath.length > 1 && (
              <Polyline
                coordinates={stats.ridePath}
                strokeColor="#10b981"
                strokeWidth={3}
              />
            )}
          </MapView>
        ) : (
          <View style={styles.mapGradient} />
        )}
        <View style={styles.mapOverlay}>
          <Text style={styles.mapDistance}>
            {stats.distance > 0 ? `${stats.distance} km` : 'No rides yet'}
          </Text>
        </View>
      </View>

      <View style={styles.mapButtons}>
        <TouchableOpacity style={styles.startButton} onPress={handleStartRide}>
          <Text style={styles.startButtonText}>Start Ride</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.selectButton} onPress={handleSelectHorse}>
          <Text style={styles.selectButtonText}>Select Horse</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mapInfo}>
        <Text style={styles.infoText}>
          📍 Distance: {stats.distance} km
        </Text>
        <Text style={styles.infoText}>
          ⏱ Duration: {stats.duration} min
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 8,
  },
  mapView: {
    height: 120,
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapGradient: {
    height: '100%',
    backgroundColor: '#a7f3d0',
    borderRadius: 8,
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  mapDistance: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: '600',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  mapButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  startButton: {
    flex: 1,
    backgroundColor: '#16a34a',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  startButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  selectButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  mapInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  infoText: {
    fontSize: 10,
    color: '#6b7280',
  },
});
