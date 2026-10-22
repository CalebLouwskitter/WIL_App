import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme, ScrollView, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import MapView, { Polyline, PROVIDER_DEFAULT, Marker } from 'react-native-maps';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getRides } from '../../services/RideStorage';
import { shareRideAsGpx } from '../../services/GpxExportService';
import type { RideData } from '../../hooks/useRideTracker';
import { useAppTheme } from '../../hooks/useAppTheme';
import { LinearGradient } from 'expo-linear-gradient';
import { primaryPreviewRoutes } from '../../constants/trails';
import { usePreferences } from '../../contexts/PreferencesContext';
import { formatDistance, formatSpeedKmh } from '../../utils/units';

interface RouteParams { startTime: number }

const { width } = Dimensions.get('window');

const RideViewMoreScreen = () => {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { startTime } = (route.params || {}) as RouteParams;
  const [ride, setRide] = useState<RideData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const mapRef = useRef<MapView | null>(null);
  const { palette, isDark } = useAppTheme();
  const { preferences } = usePreferences();

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        // Includes rides saved on the device that haven't been uploaded yet
        const rides = await getRides();
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
      <View style={[styles.container, { backgroundColor: palette.background }]}>
        <View style={[styles.header, { backgroundColor: palette.card }]}>
          <TouchableOpacity 
            onPress={() => nav.goBack()} 
            style={styles.headerBackBtn}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={24} color={palette.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { color: palette.textPrimary }]}>Ride Details</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.brandPrimary} />
          <Text style={[styles.loadingText, { color: palette.textSecondary }]}>
            Loading ride...
          </Text>
        </View>
      </View>
    );
  }

  if (!ride) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>
        <Feather name="map-pin" size={48} color={palette.textSecondary} />
        <Text style={[styles.notFoundText, { color: palette.textPrimary }]}>Ride not found</Text>
        <TouchableOpacity 
          onPress={() => nav.goBack()}
          style={[styles.backButton, { backgroundColor: palette.brandPrimary }]}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={[styles.backButtonText, { color: palette.onPrimary }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const formattedDistance = formatDistance(ride.totalDistance, preferences.units, 2);
  const durationMin = Math.round(ride.duration / 1000 / 60);
  const durationHrs = Math.floor(durationMin / 60);
  const durationMins = durationMin % 60;
  const durationText = durationHrs > 0 
    ? `${durationHrs}h ${durationMins}m`
    : `${durationMins}m`;
  const avgSpeedKmh = ride.duration > 0 
    ? (ride.totalDistance / 1000) / (ride.duration / 1000 / 3600)
    : 0;
  const formattedAvgSpeed = formatSpeedKmh(avgSpeedKmh, preferences.units, 1);
  const formattedMaxSpeed = ((ride as any).maxSpeed || (ride as any).maxSpeed === 0)
    ? formatSpeedKmh((ride as any).maxSpeed, preferences.units, 1)
    : null;
  const calories = Math.round((ride.totalDistance / 1000) * 65);
  
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

  const handleExportGpx = async () => {
    setExporting(true);
    try {
      await shareRideAsGpx(ride);
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Could not export this ride.');
    } finally {
      setExporting(false);
    }
  };

  const routeLines = primaryPreviewRoutes
    .map((r) => {
      const meters = ride.routeDistances?.[r.id] || 0;
      if (meters < 1) return null;
      return { name: r.name, distanceFormatted: formatDistance(meters, preferences.units, 2) };
    })
    .filter((line): line is NonNullable<typeof line> => line !== null);

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: palette.card }]}>
        <TouchableOpacity 
          onPress={() => nav.goBack()} 
          style={styles.headerBackBtn}
          activeOpacity={0.7}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Feather name="arrow-left" size={24} color={palette.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: palette.textPrimary }]}>Ride Details</Text>
          <Text style={[styles.headerSubtitle, { color: palette.textSecondary }]}>
            {formatDate(ride.startTime)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleExportGpx}
          disabled={exporting}
          style={styles.headerBackBtn}
          activeOpacity={0.7}
          accessibilityLabel="Export ride as GPX"
          accessibilityRole="button"
        >
          {exporting ? (
            <ActivityIndicator size="small" color={palette.textPrimary} />
          ) : (
            <Feather name="share" size={22} color={palette.textPrimary} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Ride Info Card */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.divider }]}>
          <View style={styles.rideHeader}>
            <View style={[styles.rideIconCircle, { backgroundColor: palette.brandPrimary + '15' }]}>
              <Feather name="activity" size={28} color={palette.brandPrimary} />
            </View>
            <View style={styles.rideInfo}>
              <Text style={[styles.rideName, { color: palette.textPrimary }]}>
                {ride.horseName || 'Unnamed Ride'}
              </Text>
              <View style={styles.timeRow}>
                <Feather name="clock" size={14} color={palette.textSecondary} />
                <Text style={[styles.timeText, { color: palette.textSecondary }]}>
                  Started at {formatTime(ride.startTime)}
                </Text>
              </View>
              {(ride as any).endTime && (
                <View style={styles.timeRow}>
                  <Feather name="flag" size={14} color={palette.textSecondary} />
                  <Text style={[styles.timeText, { color: palette.textSecondary }]}>
                    Ended at {formatTime((ride as any).endTime)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Map Card */}
        {coords.length > 1 && (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.divider }]}>
            <View style={styles.sectionHeader}>
              <Feather name="map" size={20} color={palette.brandPrimary} />
              <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>Route Map</Text>
            </View>
            <View style={styles.mapContainer}>
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
                      edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, 
                      animated: false 
                    });
                  }
                }}
              >
                <Polyline 
                  coordinates={coords} 
                  strokeWidth={4} 
                  strokeColor={palette.brandPrimary}
                  lineCap="round"
                  lineJoin="round"
                />
                <Marker coordinate={coords[0]} anchor={{ x: 0.5, y: 0.5 }}>
                  <View style={[styles.markerContainer, { backgroundColor: palette.success }]}>
                    <Feather name="play" size={14} color="#FFFFFF" />
                  </View>
                </Marker>
                <Marker coordinate={coords[coords.length - 1]} anchor={{ x: 0.5, y: 0.5 }}>
                  <View style={[styles.markerContainer, { backgroundColor: palette.danger }]}>
                    <Feather name="flag" size={14} color="#FFFFFF" />
                  </View>
                </Marker>
              </MapView>
            </View>
          </View>
        )}

        {/* Primary Stats */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.divider }]}>
          <View style={styles.sectionHeader}>
            <Feather name="bar-chart-2" size={20} color={palette.brandPrimary} />
            <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>Statistics</Text>
          </View>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: palette.cardElevated }]}>
              <View style={[styles.statIconCircle, { backgroundColor: palette.brandPrimary + '20' }]}>
                <Feather name="navigation" size={22} color={palette.brandPrimary} />
              </View>
              <Text style={[styles.statValue, { color: palette.textPrimary }]}>{formattedDistance.value}</Text>
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>Distance ({formattedDistance.unit})</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: palette.cardElevated }]}>
              <View style={[styles.statIconCircle, { backgroundColor: palette.caution + '20' }]}>
                <Feather name="clock" size={22} color={palette.caution} />
              </View>
              <Text style={[styles.statValue, { color: palette.textPrimary }]}>{durationText}</Text>
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>Duration</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: palette.cardElevated }]}>
              <View style={[styles.statIconCircle, { backgroundColor: palette.success + '20' }]}>
                <Feather name="trending-up" size={22} color={palette.success} />
              </View>
              <Text style={[styles.statValue, { color: palette.textPrimary }]}>{ride.elevationGain.toFixed(0)}</Text>
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>Elevation (m)</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: palette.cardElevated }]}>
              <View style={[styles.statIconCircle, { backgroundColor: palette.caution + '20' }]}>
                <Feather name="zap" size={22} color={palette.caution} />
              </View>
              <Text style={[styles.statValue, { color: palette.textPrimary }]}>{formattedAvgSpeed.value}</Text>
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>Avg Speed ({formattedAvgSpeed.unit})</Text>
            </View>
          </View>
        </View>

        {/* Additional Details */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.divider }]}>
          <View style={styles.sectionHeader}>
            <Feather name="info" size={20} color={palette.brandPrimary} />
            <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>Additional Details</Text>
          </View>
          <View style={styles.detailsList}>
            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <Feather name="trending-up" size={18} color={palette.textSecondary} />
                <Text style={[styles.detailLabel, { color: palette.textSecondary }]}>Max Speed</Text>
              </View>
              <Text style={[styles.detailValue, { color: palette.textPrimary }]}>{formattedMaxSpeed ? `${formattedMaxSpeed.value} ${formattedMaxSpeed.unit}` : 'N/A'}</Text>
            </View>
            <View style={[styles.detailDivider, { backgroundColor: palette.divider }]} />
            
            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <Feather name="activity" size={18} color={palette.textSecondary} />
                <Text style={[styles.detailLabel, { color: palette.textSecondary }]}>Est. Calories</Text>
              </View>
              <Text style={[styles.detailValue, { color: palette.textPrimary }]}>{calories} kcal</Text>
            </View>
            <View style={[styles.detailDivider, { backgroundColor: palette.divider }]} />
            
            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <Feather name="map-pin" size={18} color={palette.textSecondary} />
                <Text style={[styles.detailLabel, { color: palette.textSecondary }]}>GPS Points</Text>
              </View>
              <Text style={[styles.detailValue, { color: palette.textPrimary }]}>{ride.path?.length || 0}</Text>
            </View>
          </View>
        </View>

        {/* Routes/Trails */}
        {routeLines.length > 0 && (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.divider }]}>
            <View style={styles.sectionHeader}>
              <Feather name="map-pin" size={20} color={palette.brandPrimary} />
              <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>Routes Covered</Text>
            </View>
            <View style={styles.routesList}>
              {routeLines.map((line, idx) => (
                <View key={idx} style={styles.routeItem}>
                  <View style={[styles.routeBadge, { backgroundColor: palette.brandPrimary + '15' }]}>
                    <Feather name="trending-up" size={16} color={palette.brandPrimary} />
                  </View>
                  <View style={styles.routeInfo}>
                    <Text style={[styles.routeName, { color: palette.textPrimary }]}>{line.name}</Text>
                    <Text style={[styles.routeDistance, { color: palette.textSecondary }]}>
                      {line.distanceFormatted.value} {line.distanceFormatted.unit} covered
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 15, fontWeight: '500' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  notFoundText: { fontSize: 18, fontWeight: '600', marginTop: 8 },
  backButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 16 },
  backButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 3 },
  headerBackBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitleContainer: { flex: 1, marginLeft: 8 },
  headerTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 13, marginTop: 4 },
  headerSpacer: { width: 40 },
  scrollContent: { padding: 16, paddingTop: 12 },
  card: { borderRadius: 16, padding: 18, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3, borderWidth: 1 },
  rideHeader: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  rideIconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  rideInfo: { flex: 1 },
  rideName: { fontSize: 22, fontWeight: '700', marginBottom: 10, letterSpacing: -0.3 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  timeText: { fontSize: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  sectionTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
  mapContainer: { borderRadius: 12, overflow: 'hidden', height: 240 },
  map: { width: '100%', height: '100%' },
  markerContainer: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5, borderWidth: 2, borderColor: '#FFFFFF' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { width: (width - 64) / 2, padding: 16, borderRadius: 12, alignItems: 'center' },
  statIconCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statValue: { fontSize: 26, fontWeight: '700', marginBottom: 4, letterSpacing: -0.5 },
  statLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  detailsList: { gap: 4 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  detailLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailLabel: { fontSize: 15, fontWeight: '500' },
  detailValue: { fontSize: 16, fontWeight: '700' },
  detailDivider: { height: 1 },
  routesList: { gap: 14 },
  routeItem: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  routeBadge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  routeInfo: { flex: 1 },
  routeName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  routeDistance: { fontSize: 14 },
  bottomSpacing: { height: 32 },
});

export default RideViewMoreScreen;