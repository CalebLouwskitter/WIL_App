import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme, SafeAreaView, Modal } from 'react-native';
import { getRides } from '../../services/RideStorage';
import type { RideData as BaseRideData } from '../../hooks/useRideTracker';
import { primaryPreviewRoutes } from '../../constants/trails';
import MapView, { Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors, resolvePalette } from '../../constants/colors';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Extend RideData locally to include optional routeDistances if the active hook version omits it
type RideData = BaseRideData & { routeDistances?: Record<string, number> };

const RideStatsScreen = () => {
  const [rides, setRides] = useState<RideData[]>([]);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const colorScheme = useColorScheme();
  const theme = resolvePalette(colorScheme);

  useEffect(() => {
    (async () => {
      const data = await getRides();
      setRides(data.sort((a, b) => b.startTime - a.startTime));
    })();
  }, []);

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundLight }]}> 
      {/* Simple Back Header */}
      <View style={[styles.simpleHeader, { backgroundColor: 'transparent' }]}> 
        <TouchableOpacity 
          style={styles.headerBack} 
          activeOpacity={0.7} 
          onPress={() => {
            const fromDashboard = route.params?.fromDashboard;
            if (fromDashboard) {
              navigation.getParent()?.navigate('Dashboard');
            } else {
              navigation.goBack();
            }
          }}
        >
          <Feather name="arrow-left" size={24} color={theme.onSurface} />
        </TouchableOpacity>
        <Text style={[styles.simpleHeaderTitle, { color: theme.onSurface }]}>Ride History</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {rides.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: theme.surfaceVariant }]}>
              <Feather name="map" size={48} color={theme.onSurfaceVariant} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.onSurface }]}>
              No rides yet
            </Text>
            <Text style={[styles.emptyText, { color: theme.onSurfaceVariant }]}>
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
                    backgroundColor: theme.surface,
                    shadowColor: theme.shadowStrong,
                    borderColor: theme.borderMuted,
                  },
                ]}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('RideDetail', { startTime: ride.startTime })}
              >
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={[styles.rideNumberBadge, { backgroundColor: theme.brandPrimary }]}>
                      <Text style={styles.rideNumberText}>#{rides.length - i}</Text>
                    </View>
                    <View style={styles.cardHeaderInfo}>
                      <Text style={[styles.cardTitle, { color: theme.onSurface }]}>
                        {ride.horseName || 'Ride'}
                      </Text>
                      <View style={styles.dateTimeRow}>
                        <Feather name="calendar" size={12} color={theme.onSurfaceVariant} />
                        <Text style={[styles.cardDate, { color: theme.onSurfaceVariant }]}>
                          {formatDate(ride.startTime)}
                        </Text>
                        <Text style={[styles.cardTime, { color: theme.onSurfaceVariant }]}>
                          • {formatTime(ride.startTime)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={20} color={theme.onSurfaceVariant} />
                </View>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Feather name="navigation" size={16} color={theme.brandPrimary} />
                    <Text style={[styles.statValue, { color: theme.onSurface }]}>{distanceKm}</Text>
                    <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>km</Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: theme.borderMuted }]} />
                  <View style={styles.statItem}>
                    <Feather name="clock" size={16} color={theme.brandSecondary} />
                    <Text style={[styles.statValue, { color: theme.onSurface }]}>{durationMin}</Text>
                    <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>min</Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: theme.borderMuted }]} />
                  <View style={styles.statItem}>
                    <Feather name="trending-up" size={16} color={theme.success} />
                    <Text style={[styles.statValue, { color: theme.onSurface }]}>{ride.elevationGain.toFixed(0)}</Text>
                    <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>m</Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: theme.borderMuted }]} />
                  <View style={styles.statItem}>
                    <Feather name="zap" size={16} color={theme.caution} />
                    <Text style={[styles.statValue, { color: theme.onSurface }]}>{avgSpeed}</Text>
                    <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>km/h</Text>
                  </View>
                </View>

                {/* Mini Map */}
                {ride.path && ride.path.length > 1 && (
                  <View style={styles.miniMapWrap}>
                    <RideMiniMap path={ride.path} />
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.1)']}
                      style={styles.mapOverlay}
                    />
                  </View>
                )}

                {/* Route Tags */}
                {routeLines.length > 0 && (
                  <View style={styles.tagsContainer}>
                    <Feather name="map-pin" size={14} color={theme.onSurfaceVariant} style={styles.tagIcon} />
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.tagsScrollContent}
                    >
                      {routeLines.map((line, idx) => (
                        <View 
                          key={idx} 
                          style={[styles.routeTag, { backgroundColor: theme.chipNeutral, borderColor: theme.borderMuted }]}
                        >
                          <Text style={[styles.routeTagText, { color: theme.onSurface }]}>
                            {line.name}
                          </Text>
                          <Text style={[styles.routeTagDistance, { color: theme.onSurfaceVariant }]}>
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
      <Modal
        visible={settingsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <View style={styles.modalWrapper}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setSettingsVisible(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}> 
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.onSurface }]}>Settings</Text>
              <TouchableOpacity onPress={() => setSettingsVisible(false)}>
                <Feather name="x" size={20} color={theme.onSurfaceVariant} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalPlaceholder, { color: theme.onSurfaceVariant }]}>Quick settings will appear here.</Text>
          </View>
        </View>
      </Modal>
      <Modal
        visible={notificationsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNotificationsVisible(false)}
      >
        <View style={styles.modalWrapper}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setNotificationsVisible(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}> 
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.onSurface }]}>Notifications</Text>
              <TouchableOpacity onPress={() => setNotificationsVisible(false)}>
                <Feather name="x" size={20} color={theme.onSurfaceVariant} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalPlaceholder, { color: theme.onSurfaceVariant }]}>Notifications will show here.</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

function RideMiniMap({ path }: { path: RideData['path'] }) {
  const ref = useRef<MapView | null>(null);
  const first = path[0];
  return (
    <MapView
      ref={ref}
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
            ref.current?.fitToCoordinates(coords, {
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
        strokeColor={Colors.light.primary} // keeps blue in both themes
      />
    </MapView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  simpleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    // No bottom border to avoid white bar
  },
  headerBack: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simpleHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 40,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  globalInsightsCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
    overflow: 'hidden',
  },
  globalInsightsGradient: {
    padding: 20,
  },
  globalInsightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  globalIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  globalInsightsText: {
    flex: 1,
    marginLeft: 14,
    marginRight: 12,
    gap: 4,
  },
  globalInsightsTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  globalInsightsSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  trailInsightsCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
    overflow: 'hidden',
  },
  trailInsightsGradient: {
    padding: 20,
  },
  trailInsightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trailIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailInsightsText: {
    flex: 1,
    marginLeft: 14,
    marginRight: 12,
    gap: 4,
  },
  trailInsightsTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  trailInsightsSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rideNumberBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rideNumberText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  cardHeaderInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardDate: {
    fontSize: 13,
  },
  cardTime: {
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 32,
    marginHorizontal: 4,
  },
  miniMapWrap: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  miniMap: {
    width: '100%',
    height: 160,
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    pointerEvents: 'none',
  },
  tagsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  tagIcon: {
    marginRight: 4,
  },
  tagsScrollContent: {
    flexDirection: 'row',
    gap: 8,
  },
  routeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  routeTagText: {
    fontSize: 13,
    fontWeight: '600',
  },
  routeTagDistance: {
    fontSize: 12,
  },
  bottomSpacing: {
    height: 16,
  },
  modalWrapper: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalPlaceholder: {
    fontSize: 15,
    lineHeight: 22,
  },
});

export default RideStatsScreen;