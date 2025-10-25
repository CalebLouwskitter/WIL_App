import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View, useColorScheme, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { 
  getGlobalRideStats, 
  getUserRideStats, 
  getGlobalTrailUsage,
  type GlobalRideStats,
  type UserRideStats,
  type GlobalTrailUsage
} from '../../services/GlobalAnalyticsService';
import { resolvePalette } from '../../constants/colors';
import { auth } from '../../services/FirebaseConfig';
import SettingsModal from '../../components/Modals/SettingsModal';
import NotificationsModal from '../../components/Modals/NotificationsModal';

const GlobalTrailStatsScreen = () => {
  const [globalStats, setGlobalStats] = useState<GlobalRideStats | null>(null);
  const [userStats, setUserStats] = useState<UserRideStats[]>([]);
  const [trailUsage, setTrailUsage] = useState<GlobalTrailUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const navigation = useNavigation<any>();
  const colorScheme = useColorScheme();
  const theme = resolvePalette(colorScheme);

  const loadData = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      
      const [stats, users, trails] = await Promise.all([
        getGlobalRideStats(),
        getUserRideStats(),
        getGlobalTrailUsage(),
      ]);
      
      setGlobalStats(stats);
      setUserStats(users);
      setTrailUsage(trails);
    } catch (error) {
      console.error('Failed to load global analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const formatDistance = (meters: number) => `${(meters / 1000).toFixed(2)} km`;
  const formatDuration = (ms: number) => {
    const minutes = Math.round(ms / 1000 / 60);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundLight }]}>
        <View style={styles.topIcons}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => setSettingsVisible(true)}>
            <Feather name="settings" size={27} color="#374151" />
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} onPress={() => setNotificationsVisible(true)}>
            <Feather name="bell" size={27} color="#374151" />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.brandPrimary} />
          <Text style={[styles.loadingText, { color: theme.onSurfaceVariant }]}>Loading global data...</Text>
        </View>
        <SettingsModal
          visible={settingsVisible}
          onClose={() => setSettingsVisible(false)}
          onRequestFullSettings={() => {
            setSettingsVisible(false);
            setTimeout(() => {
              (navigation as any).dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [
                    {
                      name: 'ProfileStack',
                      state: { index: 1, routes: [{ name: 'ProfileMain' }, { name: 'Settings' }] },
                    } as any,
                  ],
                })
              );
            }, 0);
          }}
        />
        <NotificationsModal visible={notificationsVisible} onClose={() => setNotificationsVisible(false)} />
      </SafeAreaView>
    );
  }

  const maxTrailDistance = trailUsage.length > 0 ? Math.max(...trailUsage.map(t => t.totalDistance)) : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundLight }]}>
      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.brandPrimary} />
        }
      >
        {/* Top icons moved inside ScrollView to scroll with content */}
        <View style={styles.topIcons}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => setSettingsVisible(true)}>
            <Feather name="settings" size={27} color="#374151" />
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} onPress={() => setNotificationsVisible(true)}>
            <Feather name="bell" size={27} color="#374151" />
          </TouchableOpacity>
        </View>

        <View style={styles.contentInner}>
        {/* Global Overview */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.borderMuted }]}>
          <View style={styles.sectionHeader}>
            <Feather name="globe" size={20} color={theme.brandPrimary} />
            <Text style={[styles.sectionTitle, { color: theme.onSurface }]}>Community Overview</Text>
          </View>
          
          <View style={styles.overviewGrid}>
            <View style={[styles.overviewCard, { backgroundColor: theme.surfaceVariant }]}>
              <Feather name="users" size={24} color={theme.brandPrimary} />
              <Text style={[styles.overviewValue, { color: theme.onSurface }]}>
                {globalStats?.uniqueUsers || 0}
              </Text>
              <Text style={[styles.overviewLabel, { color: theme.onSurfaceVariant }]}>Active Riders</Text>
            </View>

            <View style={[styles.overviewCard, { backgroundColor: theme.surfaceVariant }]}>
              <Feather name="activity" size={24} color={theme.brandSecondary} />
              <Text style={[styles.overviewValue, { color: theme.onSurface }]}>
                {globalStats?.totalRides || 0}
              </Text>
              <Text style={[styles.overviewLabel, { color: theme.onSurfaceVariant }]}>Total Rides</Text>
            </View>

            <View style={[styles.overviewCard, { backgroundColor: theme.surfaceVariant }]}>
              <Feather name="navigation" size={24} color={theme.success} />
              <Text style={[styles.overviewValue, { color: theme.onSurface }]}>
                {formatDistance(globalStats?.totalDistance || 0)}
              </Text>
              <Text style={[styles.overviewLabel, { color: theme.onSurfaceVariant }]}>Distance</Text>
            </View>

            <View style={[styles.overviewCard, { backgroundColor: theme.surfaceVariant }]}>
              <Feather name="clock" size={24} color={theme.caution} />
              <Text style={[styles.overviewValue, { color: theme.onSurface }]}>
                {formatDuration(globalStats?.totalDuration || 0)}
              </Text>
              <Text style={[styles.overviewLabel, { color: theme.onSurfaceVariant }]}>Time</Text>
            </View>
          </View>
        </View>

        {/* Trail Usage */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.borderMuted }]}>
          <View style={styles.sectionHeader}>
            <Feather name="map-pin" size={20} color={theme.brandPrimary} />
            <Text style={[styles.sectionTitle, { color: theme.onSurface }]}>Popular Trails</Text>
          </View>

          {trailUsage.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="map" size={32} color={theme.onSurfaceVariant} />
              <Text style={[styles.emptyText, { color: theme.onSurfaceVariant }]}>No trail data yet</Text>
            </View>
          ) : (
            trailUsage.map((trail, index) => {
              const widthPercent = maxTrailDistance > 0 
                ? Math.min(100, Math.max(8, (trail.totalDistance / maxTrailDistance) * 100)) 
                : 8;
              
              return (
                <View
                  key={trail.trailId}
                  style={[
                    styles.trailItem,
                    index === trailUsage.length - 1 && styles.lastItem,
                    { borderBottomColor: theme.borderMuted }
                  ]}
                >
                  <View style={styles.trailHeader}>
                    <Text style={[styles.trailName, { color: theme.onSurface }]}>
                      {trail.trailName}
                    </Text>
                    <Text style={[styles.trailDistance, { color: theme.onSurfaceVariant }]}>
                      {formatDistance(trail.totalDistance)}
                    </Text>
                  </View>

                  <View style={[styles.barBackground, { backgroundColor: theme.surfaceVariant }]}>
                    <LinearGradient
                      colors={[theme.brandPrimary, theme.brandPrimaryAlt]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.barFill, { width: `${widthPercent}%` }]}
                    />
                  </View>

                  <View style={styles.trailMeta}>
                    <View style={styles.metaBadge}>
                      <Feather name="activity" size={12} color={theme.brandPrimary} />
                      <Text style={[styles.metaText, { color: theme.onSurfaceVariant }]}>
                        {trail.rideCount} rides
                      </Text>
                    </View>
                    <View style={styles.metaBadge}>
                      <Feather name="users" size={12} color={theme.brandSecondary} />
                      <Text style={[styles.metaText, { color: theme.onSurfaceVariant }]}>
                        {trail.uniqueUsers} riders
                      </Text>
                    </View>
                    <View style={styles.metaBadge}>
                      <Feather name="trending-up" size={12} color={theme.success} />
                      <Text style={[styles.metaText, { color: theme.onSurfaceVariant }]}>
                        {formatDistance(trail.averageDistance)} avg
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Top Riders */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.borderMuted }]}>
          <View style={styles.sectionHeader}>
            <Feather name="award" size={20} color={theme.brandPrimary} />
            <Text style={[styles.sectionTitle, { color: theme.onSurface }]}>Top Riders</Text>
          </View>

          {userStats.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="users" size={32} color={theme.onSurfaceVariant} />
              <Text style={[styles.emptyText, { color: theme.onSurfaceVariant }]}>No rider data yet</Text>
            </View>
          ) : (
            userStats.slice(0, 10).map((user, index) => (
              <View
                key={user.userId}
                style={[
                  styles.userItem,
                  index === Math.min(9, userStats.length - 1) && styles.lastItem,
                  { borderBottomColor: theme.borderMuted }
                ]}
              >
                <View style={styles.userRank}>
                  <View style={[
                    styles.rankBadge,
                    index < 3 && { backgroundColor: theme.brandPrimary },
                    index >= 3 && { backgroundColor: theme.surfaceVariant }
                  ]}>
                    <Text style={[
                      styles.rankText,
                      index < 3 && { color: '#FFFFFF' },
                      index >= 3 && { color: theme.onSurface }
                    ]}>
                      {index + 1}
                    </Text>
                  </View>
                </View>

                <View style={styles.userInfo}>
                  <Text style={[styles.userName, { color: theme.onSurface }]}>
                    {user.userName || `Rider ${user.userId.slice(0, 8)}`}
                  </Text>
                  <View style={styles.userMeta}>
                    <View style={styles.metaBadge}>
                      <Feather name="activity" size={12} color={theme.brandPrimary} />
                      <Text style={[styles.metaText, { color: theme.onSurfaceVariant }]}>
                        {user.rideCount} rides
                      </Text>
                    </View>
                    <View style={styles.metaBadge}>
                      <Feather name="navigation" size={12} color={theme.brandSecondary} />
                      <Text style={[styles.metaText, { color: theme.onSurfaceVariant }]}>
                        {formatDistance(user.averageDistance)} avg
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.userStats}>
                  <Text style={[styles.userDistance, { color: theme.onSurface }]}>
                    {formatDistance(user.totalDistance)}
                  </Text>
                  <Text style={[styles.userDuration, { color: theme.onSurfaceVariant }]}>
                    {formatDuration(user.totalDuration)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.bottomSpacing} />
        </View>
      </ScrollView>
      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        onRequestFullSettings={() => {
          setSettingsVisible(false);
          setTimeout(() => {
            (navigation as any).dispatch(
              CommonActions.reset({
                index: 0,
                routes: [
                  {
                    name: 'ProfileStack',
                    state: { index: 1, routes: [{ name: 'ProfileMain' }, { name: 'Settings' }] },
                  } as any,
                ],
              })
            );
          }, 0);
        }}
      />
      <NotificationsModal visible={notificationsVisible} onClose={() => setNotificationsVisible(false)} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topIcons: {
    flexDirection: 'row',
    paddingTop: 45,
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '500',
  },
  content: {
    paddingBottom: 16,
  },
  contentInner: {
    paddingHorizontal: 16,
  },
  section: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  overviewCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  overviewValue: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  overviewLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
  },
  trailItem: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  trailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  trailName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    flex: 1,
  },
  trailDistance: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 12,
  },
  barBackground: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  trailMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  userRank: {
    width: 40,
    alignItems: 'center',
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 14,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
    gap: 6,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  userMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  userStats: {
    alignItems: 'flex-end',
    gap: 4,
  },
  userDistance: {
    fontSize: 16,
    fontWeight: '700',
  },
  userDuration: {
    fontSize: 12,
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 32,
  },
});

export default GlobalTrailStatsScreen;