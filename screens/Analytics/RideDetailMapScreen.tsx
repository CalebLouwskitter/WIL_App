import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme, ScrollView, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import MapView, { Polyline, PROVIDER_DEFAULT, Marker } from 'react-native-maps';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getCurrentUserRides } from '../../services/UserAnalyticsService';
import type { RideData } from '../../hooks/useRideTracker';
import { resolvePalette } from '../../constants/colors';
import { LinearGradient } from 'expo-linear-gradient';

interface RouteParams { startTime: number }

const RideDetailMapScreen = () => {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { startTime } = (route.params || {}) as RouteParams;
  const [ride, setRide] = useState<RideData | null>(null);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<MapView | null>(null);
  const colorScheme = useColorScheme();
  const theme = resolvePalette(colorScheme);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const rides = await getCurrentUserRides();
        const r = rides.find(x => x.startTime === startTime) || null;
        setRide(r);
      } catch (error) {
        console.error('Error loading ride from Firebase:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [startTime]);

  const coords = useMemo(() => ride?.path?.map(p => ({ latitude: p.latitude, longitude: p.longitude })) || [], [ride]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundLight }]}>
        <View style={styles.headerContainer}>
          <TouchableOpacity 
            onPress={() => nav.goBack()} 
            style={[styles.backBtn, { backgroundColor: theme.surface }]}
            activeOpacity={0.8}
          >
            <Feather name="arrow-left" size={22} color={theme.onSurface} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.brandPrimary} />
          <Text style={[styles.loadingText, { color: theme.onSurfaceVariant }]}>
            Loading ride from Firebase...
          </Text>
        </View>
      </View>
    );
  }

  if (!ride) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundLight }]}>
        <Feather name="map-pin" size={48} color={theme.onSurfaceVariant} />
        <Text style={[styles.notFoundText, { color: theme.onSurface }]}>Ride not found</Text>
        <TouchableOpacity 
          onPress={() => nav.goBack()}
          style={[styles.backButton, { backgroundColor: theme.brandPrimary }]}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const distanceKm = (ride.totalDistance / 1000).toFixed(2);
  const durationMin = Math.round(ride.duration / 1000 / 60);
  const durationHrs = Math.floor(durationMin / 60);
  const durationMins = durationMin % 60;
  const durationText = durationHrs > 0 
    ? `${durationHrs}h ${durationMins}m`
    : `${durationMins}m`;
  const avgSpeed = ride.duration > 0 
    ? ((ride.totalDistance / 1000) / (ride.duration / 1000 / 3600)).toFixed(1)
    : '0';
  
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: 'numeric',
      minute: '2-digit',
      hour12: true 
    });
  };

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
            mapRef.current?.fitToCoordinates(coords, { 
              edgePadding: { top: 100, right: 60, bottom: 280, left: 60 }, 
              animated: false 
            });
          }
        }}
      >
        {coords.length > 0 && (
          <>
            <Polyline 
              coordinates={coords} 
              strokeWidth={5} 
              strokeColor={theme.brandPrimary}
              lineCap="round"
              lineJoin="round"
            />
            {/* Start Marker */}
            <Marker coordinate={coords[0]} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={[styles.markerContainer, { backgroundColor: theme.success }]}>
                <Feather name="play" size={16} color="#FFFFFF" />
              </View>
            </Marker>
            {/* End Marker */}
            <Marker coordinate={coords[coords.length - 1]} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={[styles.markerContainer, { backgroundColor: theme.danger }]}>
                <Feather name="flag" size={16} color="#FFFFFF" />
              </View>
            </Marker>
          </>
        )}
      </MapView>

      {/* Header with Back Button */}
      <View style={styles.headerContainer}>
        <TouchableOpacity 
          onPress={() => nav.goBack()} 
          style={[styles.backBtn, { backgroundColor: theme.surface }]}
          activeOpacity={0.8}
        >
          <Feather name="arrow-left" size={22} color={theme.onSurface} />
        </TouchableOpacity>
      </View>

      {/* Bottom Stats Card */}
      <View style={styles.bottomCard}>
        <LinearGradient
          colors={[theme.surface, theme.surface]}
          style={styles.cardGradient}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Title Section */}
            <View style={styles.titleSection}>
              <View style={styles.titleRow}>
                <View style={[styles.titleIcon, { backgroundColor: theme.brandPrimary + '15' }]}>
                  <Feather name="activity" size={24} color={theme.brandPrimary} />
                </View>
                <View style={styles.titleInfo}>
                  <Text style={[styles.rideTitle, { color: theme.onSurface }]}>
                    {ride.horseName || 'Ride Details'}
                  </Text>
                  <Text style={[styles.rideDate, { color: theme.onSurfaceVariant }]}>
                    {formatDate(ride.startTime)}
                  </Text>
                  <Text style={[styles.rideTime, { color: theme.onSurfaceVariant }]}>
                    Started at {formatTime(ride.startTime)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={[styles.statBox, { backgroundColor: theme.surfaceVariant }]}>
                <View style={[styles.statIconCircle, { backgroundColor: theme.brandPrimary + '20' }]}>
                  <Feather name="navigation" size={20} color={theme.brandPrimary} />
                </View>
                <Text style={[styles.statValue, { color: theme.onSurface }]}>{distanceKm}</Text>
                <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>DISTANCE (KM)</Text>
              </View>

              <View style={[styles.statBox, { backgroundColor: theme.surfaceVariant }]}>
                <View style={[styles.statIconCircle, { backgroundColor: theme.brandSecondary + '20' }]}>
                  <Feather name="clock" size={20} color={theme.brandSecondary} />
                </View>
                <Text style={[styles.statValue, { color: theme.onSurface }]}>{durationText}</Text>
                <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>DURATION</Text>
              </View>

              <View style={[styles.statBox, { backgroundColor: theme.surfaceVariant }]}>
                <View style={[styles.statIconCircle, { backgroundColor: theme.success + '20' }]}>
                  <Feather name="trending-up" size={20} color={theme.success} />
                </View>
                <Text style={[styles.statValue, { color: theme.onSurface }]}>{ride.elevationGain.toFixed(0)}</Text>
                <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>ELEVATION (M)</Text>
              </View>

              <View style={[styles.statBox, { backgroundColor: theme.surfaceVariant }]}>
                <View style={[styles.statIconCircle, { backgroundColor: theme.caution + '20' }]}>
                  <Feather name="zap" size={20} color={theme.caution} />
                </View>
                <Text style={[styles.statValue, { color: theme.onSurface }]}>{avgSpeed}</Text>
                <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>AVG SPEED (KM/H)</Text>
              </View>
            </View>
          </ScrollView>
        </LinearGradient>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#000' 
  },
  map: { 
    flex: 1 
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '500',
  },
  center: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  notFoundText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  markerContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  headerContainer: { 
    position: 'absolute', 
    top: 50, 
    left: 20, 
    zIndex: 10,
  },
  backBtn: { 
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '40%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  cardGradient: {
    padding: 20,
    paddingBottom: 32,
  },
  titleSection: {
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  titleIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleInfo: {
    flex: 1,
  },
  rideTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  rideDate: {
    fontSize: 14,
    marginBottom: 2,
  },
  rideTime: {
    fontSize: 13,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statBox: {
    width: '48%',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default RideDetailMapScreen;