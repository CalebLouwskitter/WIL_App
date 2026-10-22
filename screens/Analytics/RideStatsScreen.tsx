import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCurrentUserRides } from '../../services/UserAnalyticsService';
import type { RideData } from '../../hooks/useRideTracker';
import { primaryPreviewRoutes } from '../../constants/trails';
import MapView, { Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { AnalyticsStackParamList, TabParamList } from '../../navigation/types';
import { useAppTheme } from '../../hooks/useAppTheme';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AnalyticsUnavailableNotice } from '../../components/AnalyticsUnavailableNotice';
import { analyticsError, type AnalyticsResult } from '../../services/analyticsResult';

type NavigationProp = StackNavigationProp<AnalyticsStackParamList, 'RideHistory'>;
type ScreenRouteProp = RouteProp<AnalyticsStackParamList, 'RideHistory'>;

const RideStatsScreen = () => {
  const [rides, setRides] = useState<RideData[]>([]);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<AnalyticsResult<unknown> | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { palette, isDark } = useAppTheme();

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await getCurrentUserRides();
        setRides([...data.data].sort((a, b) => b.startTime - a.startTime));
        setProblem(data.status === 'ok' ? null : data);
      } catch (error) {
        console.error('Error loading rides from Firebase:', error);
        setProblem(analyticsError(error, []));
      } finally {
        setLoading(false);
      }
    })();
  }, [reloadKey]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const handleBack = () => {
    const fromDashboard = route.params?.fromDashboard;
    if (fromDashboard) {
      navigation.getParent<BottomTabNavigationProp<TabParamList>>()?.navigate('Dashboard');
    } else {
      navigation.goBack();
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
        <View style={[styles.simpleHeader, { backgroundColor: 'transparent' }]}> 
          <TouchableOpacity 
            style={styles.headerBack} 
            activeOpacity={0.7} 
            onPress={handleBack}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Feather name="arrow-left" size={24} color={palette.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.simpleHeaderTitle, { color: palette.textPrimary }]}>Ride History</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.brandPrimary} />
          <Text style={[styles.loadingText, { color: palette.textSecondary }]}>
            Loading rides from Firebase...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}> 
      {/* Simple Back Header */}
      <View style={[styles.simpleHeader, { backgroundColor: 'transparent' }]}> 
        <TouchableOpacity 
          style={styles.headerBack} 
          activeOpacity={0.7} 
          onPress={handleBack}
        >
          <Feather name="arrow-left" size={24} color={palette.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.simpleHeaderTitle, { color: palette.textPrimary }]}>Ride History</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {problem ? (
          <View style={styles.emptyContainer}>
            <AnalyticsUnavailableNotice result={problem} onRetry={() => setReloadKey((k) => k + 1)} />
          </View>
        ) : rides.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: palette.cardElevated }]}>
              <Feather name="map" size={48} color={palette.textSecondary} />
            </View>
            <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
              No rides yet
            </Text>
            <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
              Start tracking your rides from the{'\n'}Mapping tab to see your history here
            </Text>
          </View>
        ) : (
          rides.map((ride, i) => {
            const routeLines = primaryPreviewRoutes
              .map((r) => {
                const meters = ride.routeDistances?.[r.id] || 0;
                if (meters < 1) return null;
                return { name: r.name, distance: (meters / 1000).toFixed(2) };
              })
              .filter((line): line is { name: string; distance: string } => line !== null);
            
            const distanceKm = (ride.totalDistance / 1000).toFixed(2);
            const durationMin = Math.round(ride.duration / 1000 / 60);
            const avgSpeed = ride.duration > 0 
              ? ((ride.totalDistance / 1000) / (ride.duration / 1000 / 3600)).toFixed(1)
              : '0';

            return (
              <TouchableOpacity
                key={ride.startTime + '-' + i}
                style={[
                  styles.card,
                  {
                    backgroundColor: palette.card,
                    shadowColor: palette.shadowStrong,
                    borderColor: palette.divider,
                  },
                ]}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('RideDetail', { startTime: ride.startTime })}
              >
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={[styles.rideNumberBadge, { backgroundColor: palette.brandPrimary }]}>
                      <Text style={styles.rideNumberText}>#{rides.length - i}</Text>
                    </View>
                    <View style={styles.cardHeaderInfo}>
                      <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>
                        {ride.horseName || 'Ride'}
                      </Text>
                      <View style={styles.dateTimeRow}>
                        <Feather name="calendar" size={12} color={palette.textSecondary} />
                        <Text style={[styles.cardDate, { color: palette.textSecondary }]}>
                          {formatDate(ride.startTime)}
                        </Text>
                        <Text style={[styles.cardTime, { color: palette.textSecondary }]}>
                          • {formatTime(ride.startTime)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={20} color={palette.textSecondary} />
                </View>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Feather name="navigation" size={16} color={palette.brandPrimary} />
                    <Text style={[styles.statValue, { color: palette.textPrimary }]}>{distanceKm}</Text>
                    <Text style={[styles.statLabel, { color: palette.textSecondary }]}>km</Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: palette.divider }]} />
                  <View style={styles.statItem}>
                    <Feather name="clock" size={16} color={palette.caution} />
                    <Text style={[styles.statValue, { color: palette.textPrimary }]}>{durationMin}</Text>
                    <Text style={[styles.statLabel, { color: palette.textSecondary }]}>min</Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: palette.divider }]} />
                  <View style={styles.statItem}>
                    <Feather name="trending-up" size={16} color={palette.success} />
                    <Text style={[styles.statValue, { color: palette.textPrimary }]}>{ride.elevationGain.toFixed(0)}</Text>
                    <Text style={[styles.statLabel, { color: palette.textSecondary }]}>m</Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: palette.divider }]} />
                  <View style={styles.statItem}>
                    <Feather name="zap" size={16} color={palette.caution} />
                    <Text style={[styles.statValue, { color: palette.textPrimary }]}>{avgSpeed}</Text>
                    <Text style={[styles.statLabel, { color: palette.textSecondary }]}>km/h</Text>
                  </View>
                </View>

                {/* Mini Map */}
                {ride.path && ride.path.length > 1 && (
                  <View style={styles.miniMapWrap}>
                    <RideMiniMap path={ride.path} strokeColor={palette.brandPrimary} />
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.1)']}
                      style={styles.mapOverlay}
                    />
                  </View>
                )}

                {/* Route Tags */}
                {routeLines.length > 0 && (
                  <View style={styles.tagsContainer}>
                    <Feather name="map-pin" size={14} color={palette.textSecondary} style={styles.tagIcon} />
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.tagsScrollContent}
                    >
                      {routeLines.map((line, idx) => (
                        <View 
                          key={idx} 
                          style={[styles.routeTag, { backgroundColor: palette.cardElevated, borderColor: palette.divider }]}
                        >
                          <Text style={[styles.routeTagText, { color: palette.textPrimary }]}>
                            {line.name}
                          </Text>
                          <Text style={[styles.routeTagDistance, { color: palette.textSecondary }]}>
                            {line.distance}km
                          </Text>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
};

function RideMiniMap({ path, strokeColor }: { path: RideData['path']; strokeColor: string }) {
  const mapRef = React.useRef<MapView | null>(null);
  const first = path[0];
  return (
    <MapView
      ref={mapRef}
      style={styles.miniMap}
      provider={PROVIDER_DEFAULT}
      pointerEvents="none"
      initialRegion={{
        latitude: first.latitude,
        longitude: first.longitude,
        latitudeDelta: 0.003,
        longitudeDelta: 0.003,
      }}
      onLayout={() => {
        try {
          const coords = path.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
          if (coords.length > 1) {
            mapRef.current?.fitToCoordinates(coords, {
              edgePadding: { top: 20, right: 20, bottom: 20, left: 20 },
              animated: false,
            });
          }
        } catch {}
      }}
    >
      <Polyline
        coordinates={path.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))}
        strokeWidth={3}
        strokeColor={strokeColor}
      />
    </MapView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 15, fontWeight: '500' },
  simpleHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  headerBack: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  simpleHeaderTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  headerSpacer: { width: 40 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 32 },
  emptyIconCircle: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  card: { borderRadius: 16, padding: 16, marginBottom: 16, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rideNumberBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  rideNumberText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  cardHeaderInfo: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  dateTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardDate: { fontSize: 13 },
  cardTime: { fontSize: 13 },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 8 },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 18, fontWeight: '700' },
  statLabel: { fontSize: 11, textTransform: 'uppercase' },
  statDivider: { width: 1, height: 32, marginHorizontal: 4 },
  miniMapWrap: { marginTop: 12, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  miniMap: { width: '100%', height: 160 },
  mapOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, pointerEvents: 'none' },
  tagsContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  tagIcon: { marginRight: 4 },
  tagsScrollContent: { flexDirection: 'row', gap: 8 },
  routeTag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  routeTagText: { fontSize: 13, fontWeight: '600' },
  routeTagDistance: { fontSize: 12 },
  bottomSpacing: { height: 16 },
});

export default RideStatsScreen;