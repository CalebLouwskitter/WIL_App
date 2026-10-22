import React, { useEffect, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, RefreshControl, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, CommonActions } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { AnalyticsStackParamList } from '../../navigation/types';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';

import { 
  getGlobalRideStats, 
  getUserRideStats, 
  getGlobalTrailUsage,
  type GlobalRideStats,
  type UserRideStats,
  type GlobalTrailUsage
} from '../../services/GlobalAnalyticsService';
import { useAppTheme } from '../../hooks/useAppTheme';
import { auth } from '../../services/firebase';
import SettingsModal from '../../components/Modals/SettingsModal';
import NotificationsModal from '../../components/Modals/NotificationsModal';
import { AnalyticsDownloadButton } from '../../components/AnalyticsDownloadButton';
import { AnalyticsUnavailableNotice } from '../../components/AnalyticsUnavailableNotice';
import { analyticsError, firstProblem, type AnalyticsResult } from '../../services/analyticsResult';

const { width: screenWidth } = Dimensions.get('window');
const CHART_WIDTH = screenWidth - 64;

type NavigationProp = StackNavigationProp<AnalyticsStackParamList, 'Stats'>;

const GlobalTrailStatsScreen = () => {
  const [globalStats, setGlobalStats] = useState<GlobalRideStats | null>(null);
  const [userStats, setUserStats] = useState<UserRideStats[]>([]);
  const [trailUsage, setTrailUsage] = useState<GlobalTrailUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<AnalyticsResult<unknown> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const navigation = useNavigation<NavigationProp>();
  const { palette, isDark } = useAppTheme();

  const handleRequestFullSettings = () => {
    setTimeout(() => {
      (navigation as any).dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: 'ProfileStack',
              state: {
                index: 1,
                routes: [
                  { name: 'ProfileMain' },
                  { name: 'Settings' },
                ],
              },
            },
          ],
        })
      );
    }, 0);
  };

  const loadData = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      
      const [stats, users, trails] = await Promise.all([
        getGlobalRideStats(),
        getUserRideStats(),
        getGlobalTrailUsage(),
      ]);
      
      setProblem(firstProblem([stats, users, trails]));
      setGlobalStats(stats.data);
      setUserStats(users.data);
      setTrailUsage(trails.data);
    } catch (error) {
      console.error('Failed to load global analytics:', error);
      setProblem(analyticsError(error, null));
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

  // Prepare chart data with validation and better handling of small values
  const topRidersChartData = useMemo(() => {
    const top5 = userStats.slice(0, 5);
    if (top5.length === 0) {
      return null; // Return null instead of showing empty chart
    }
    
    // Check if all values are too small (less than 0.1 km)
    const maxDistance = Math.max(...top5.map(u => u.totalDistance / 1000));
    if (maxDistance < 0.1) {
      return null; // Don't show chart for very small values
    }
    
    return {
      labels: top5.map((u, i) => `#${i + 1}`),
      datasets: [{
        data: top5.map(u => Math.max(0.1, Math.round((u.totalDistance / 1000) * 10) / 10)), // Round to 1 decimal
        colors: top5.map((_, i) => () => i === 0 ? palette.brandPrimary : i === 1 ? palette.success : i === 2 ? palette.caution : palette.profileStatPointsCircle)
      }]
    };
  }, [userStats]);

  const trailDistributionData = useMemo(() => {
    const top5Trails = trailUsage.slice(0, 5);
    if (top5Trails.length === 0) {
      return null;
    }
    
    // Use actual trail names from Firebase, exactly as they appear in Popular Trails
    return top5Trails.map((trail, index) => {
      return {
        name: trail.trailName, // Use exact trail name from Firebase
        population: trail.totalDistance, // Use this for proportions
        color: [palette.brandPrimary, palette.success, palette.caution, palette.profileStatPointsCircle, palette.danger][index],
        legendFontColor: palette.textSecondary,
        legendFontSize: 10
      };
    });
  }, [trailUsage, palette]);

  const chartConfig = {
    backgroundColor: palette.card,
    backgroundGradientFrom: palette.card,
    backgroundGradientTo: palette.card,
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
    labelColor: () => palette.textSecondary,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '5',
      strokeWidth: '2',
      stroke: '#3B82F6'
    },
    propsForBackgroundLines: {
      strokeDasharray: '',
      stroke: palette.divider,
      strokeWidth: 1
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
        <View style={styles.topIcons}>
          <TouchableOpacity
            style={styles.myStatsAction}
            activeOpacity={0.7}
            accessibilityLabel="My stats"
            accessibilityRole="button"
            onPress={() => navigation.navigate('DetailedStats')}
          >
            <Feather name="user" size={18} color={palette.brandPrimary} />
            <Text style={[styles.myStatsActionText, { color: palette.brandPrimary }]}>My stats</Text>
          </TouchableOpacity>
          <View style={styles.topRightIcons}>
            <TouchableOpacity activeOpacity={0.7} onPress={() => setSettingsVisible(true)} accessibilityLabel="Settings" accessibilityRole="button">
              <Feather name="settings" size={27} color={palette.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7} onPress={() => setNotificationsVisible(true)} accessibilityLabel="Notifications" accessibilityRole="button">
              <Feather name="bell" size={27} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.brandPrimary} />
          <Text style={[styles.loadingText, { color: palette.textSecondary }]}>Loading global data...</Text>
        </View>
        <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} onRequestFullSettings={handleRequestFullSettings} />
        <NotificationsModal visible={notificationsVisible} onClose={() => setNotificationsVisible(false)} />
      </SafeAreaView>
    );
  }

  if (problem) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.brandPrimary} />
          }
        >
          <View style={styles.topIcons}>
            <TouchableOpacity
              style={styles.myStatsAction}
              activeOpacity={0.7}
              accessibilityLabel="My stats"
              accessibilityRole="button"
              onPress={() => navigation.navigate('DetailedStats')}
            >
              <Feather name="user" size={18} color={palette.brandPrimary} />
              <Text style={[styles.myStatsActionText, { color: palette.brandPrimary }]}>My stats</Text>
            </TouchableOpacity>
            <View style={styles.topRightIcons}>
              <TouchableOpacity activeOpacity={0.7} onPress={() => setSettingsVisible(true)} accessibilityLabel="Settings" accessibilityRole="button">
                <Feather name="settings" size={27} color={palette.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7} onPress={() => setNotificationsVisible(true)} accessibilityLabel="Notifications" accessibilityRole="button">
                <Feather name="bell" size={27} color={palette.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.contentInner}>
            <AnalyticsUnavailableNotice result={problem} onRetry={() => loadData()} />
            <View style={styles.downloadSection}>
              <AnalyticsDownloadButton disabled disabledReason="Export is unavailable until analytics load." />
            </View>
          </View>
        </ScrollView>
        <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} onRequestFullSettings={handleRequestFullSettings} />
        <NotificationsModal visible={notificationsVisible} onClose={() => setNotificationsVisible(false)} />
      </SafeAreaView>
    );
  }

  const maxTrailDistance = trailUsage.length > 0 ? Math.max(...trailUsage.map(t => t.totalDistance)) : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.brandPrimary} />
        }
      >
        <View style={styles.topIcons}>
          <TouchableOpacity
            style={styles.myStatsAction}
            activeOpacity={0.7}
            accessibilityLabel="My stats"
            accessibilityRole="button"
            onPress={() => navigation.navigate('DetailedStats')}
          >
            <Feather name="user" size={18} color={palette.brandPrimary} />
            <Text style={[styles.myStatsActionText, { color: palette.brandPrimary }]}>My stats</Text>
          </TouchableOpacity>
          <View style={styles.topRightIcons}>
            <TouchableOpacity activeOpacity={0.7} onPress={() => setSettingsVisible(true)} accessibilityLabel="Settings" accessibilityRole="button">
              <Feather name="settings" size={27} color={palette.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7} onPress={() => setNotificationsVisible(true)} accessibilityLabel="Notifications" accessibilityRole="button">
              <Feather name="bell" size={27} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.contentInner}>
          {/* Hero Stats */}
          <LinearGradient
            colors={[palette.brandPrimary, palette.brandPrimaryAlt]}
            style={styles.heroCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.heroHeader}>
              <Feather name="globe" size={32} color="#FFFFFF" />
              <Text style={styles.heroTitle}>Global Community</Text>
            </View>
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{globalStats?.uniqueUsers || 0}</Text>
                <Text style={styles.heroStatLabel}>Active Riders</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{globalStats?.totalRides || 0}</Text>
                <Text style={styles.heroStatLabel}>Total Rides</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Download Button */}
          <View style={styles.downloadSection}>
            <AnalyticsDownloadButton 
              onDownloadStart={() => console.log('Export started')}
              onDownloadComplete={() => console.log('Export complete')}
              onDownloadError={(error) => console.error('Export error:', error)}
            />
          </View>

          {/* Quick Stats Grid */}
          <View style={styles.quickStatsGrid}>
            <View style={[styles.quickStatCard, { backgroundColor: palette.card }]}>
              <View style={[styles.quickStatIcon, { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : '#10B98120' }]}>
                <Feather name="navigation" size={20} color={palette.success} />
              </View>
              <Text style={[styles.quickStatValue, { color: palette.textPrimary }]}>
                {formatDistance(globalStats?.totalDistance || 0)}
              </Text>
              <Text style={[styles.quickStatLabel, { color: palette.textSecondary }]}>Distance</Text>
            </View>
            
            <View style={[styles.quickStatCard, { backgroundColor: palette.card }]}>
              <View style={[styles.quickStatIcon, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#F59E0B20' }]}>
                <Feather name="clock" size={20} color={palette.caution} />
              </View>
              <Text style={[styles.quickStatValue, { color: palette.textPrimary }]}>
                {(() => {
                  const totalMs = globalStats?.totalDuration || 0;
                  const hours = Math.floor(totalMs / (1000 * 60 * 60));
                  const minutes = Math.round((totalMs % (1000 * 60 * 60)) / (1000 * 60));
                  if (hours > 0) {
                    return `${hours}h ${minutes}m`;
                  }
                  return `${minutes}m`;
                })()}
              </Text>
              <Text style={[styles.quickStatLabel, { color: palette.textSecondary }]}>Time</Text>
            </View>
            
            <View style={[styles.quickStatCard, { backgroundColor: palette.card }]}>
              <View style={[styles.quickStatIcon, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : '#8B5CF620' }]}>
                <Feather name="trending-up" size={20} color={isDark ? palette.brandPrimary : '#8B5CF6'} />
              </View>
              <Text style={[styles.quickStatValue, { color: palette.textPrimary }]}>
                {Math.round(globalStats?.totalElevation || 0)}m
              </Text>
              <Text style={[styles.quickStatLabel, { color: palette.textSecondary }]}>Elevation</Text>
            </View>
          </View>

          {/* Top Riders Bar Chart */}
          {topRidersChartData ? (
            <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.divider }]}>
              <View style={styles.sectionHeader}>
                <Feather name="bar-chart-2" size={20} color={palette.brandPrimary} />
                <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>Top 5 Riders by Distance</Text>
              </View>
              <BarChart
                data={topRidersChartData}
                width={CHART_WIDTH}
                height={220}
                yAxisLabel=""
                yAxisSuffix=" km"
                chartConfig={chartConfig}
                style={styles.chart}
                fromZero
                showValuesOnTopOfBars
              />
            </View>
          ) : userStats.length > 0 ? (
            <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.divider }]}>
              <View style={styles.sectionHeader}>
                <Feather name="bar-chart-2" size={20} color={palette.brandPrimary} />
                <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>Top 5 Riders by Distance</Text>
              </View>
              <View style={styles.chartPlaceholder}>
                <Feather name="info" size={32} color={palette.textSecondary} />
                <Text style={[styles.chartPlaceholderText, { color: palette.textSecondary }]}>
                  More ride data needed for chart visualization
                </Text>
                <Text style={[styles.chartPlaceholderSubtext, { color: palette.textSecondary }]}>
                  Complete more rides to see detailed charts
                </Text>
              </View>
            </View>
          ) : null}

          {/* Trail Distribution Pie Chart */}
          {trailDistributionData && trailDistributionData.length > 0 ? (
            <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.divider }]}>
              <View style={styles.sectionHeader}>
                <Feather name="pie-chart" size={20} color={palette.brandPrimary} />
                <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>Trail Usage Distribution</Text>
              </View>
              <PieChart
                data={trailDistributionData}
                width={CHART_WIDTH}
                height={220}
                chartConfig={chartConfig}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="15"
                center={[10, 0]}
                hasLegend={true}
                style={styles.chart}
              />
            </View>
          ) : trailUsage.length > 0 ? (
            <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.divider }]}>
              <View style={styles.sectionHeader}>
                <Feather name="pie-chart" size={20} color={palette.brandPrimary} />
                <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>Trail Usage Distribution</Text>
              </View>
              <View style={styles.chartPlaceholder}>
                <Feather name="info" size={32} color={palette.textSecondary} />
                <Text style={[styles.chartPlaceholderText, { color: palette.textSecondary }]}>
                  More trail data needed for distribution chart
                </Text>
                <Text style={[styles.chartPlaceholderSubtext, { color: palette.textSecondary }]}>
                  Ride on different trails to see usage patterns
                </Text>
              </View>
            </View>
          ) : null}

          {/* Detailed Trail List */}
          <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.divider }]}>
            <View style={styles.sectionHeader}>
              <Feather name="map-pin" size={20} color={palette.brandPrimary} />
              <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>Popular Trails</Text>
            </View>

            {trailUsage.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="map" size={32} color={palette.textSecondary} />
                <Text style={[styles.emptyText, { color: palette.textSecondary }]}>No trail data yet</Text>
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
                      { borderBottomColor: palette.divider }
                    ]}
                  >
                    <View style={styles.trailHeader}>
                      <View style={styles.trailRank}>
                        <Text style={[styles.trailRankText, { color: palette.brandPrimary }]}>#{index + 1}</Text>
                      </View>
                      <Text style={[styles.trailName, { color: palette.textPrimary }]}>
                        {trail.trailName}
                      </Text>
                      <Text style={[styles.trailDistance, { color: palette.textSecondary }]}>
                        {formatDistance(trail.totalDistance)}
                      </Text>
                    </View>

                    <View style={[styles.barBackground, { backgroundColor: palette.cardElevated }]}>
                      <LinearGradient
                        colors={[palette.brandPrimary, palette.brandPrimaryAlt]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.barFill, { width: `${widthPercent}%` }]}
                      />
                    </View>

                    <View style={styles.trailMeta}>
                      <View style={styles.metaBadge}>
                        <Feather name="activity" size={12} color={palette.brandPrimary} />
                        <Text style={[styles.metaText, { color: palette.textSecondary }]}>
                          {trail.rideCount} rides
                        </Text>
                      </View>
                      <View style={styles.metaBadge}>
                        <Feather name="users" size={12} color={palette.caution} />
                        <Text style={[styles.metaText, { color: palette.textSecondary }]}>
                          {trail.uniqueUsers} riders
                        </Text>
                      </View>
                      <View style={styles.metaBadge}>
                        <Feather name="trending-up" size={12} color={palette.success} />
                        <Text style={[styles.metaText, { color: palette.textSecondary }]}>
                          {formatDistance(trail.averageDistance)} avg
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Leaderboard */}
          <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.divider }]}>
            <View style={styles.sectionHeader}>
              <Feather name="award" size={20} color={palette.brandPrimary} />
              <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>Leaderboard</Text>
            </View>

            {userStats.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="users" size={32} color={palette.textSecondary} />
                <Text style={[styles.emptyText, { color: palette.textSecondary }]}>No rider data yet</Text>
              </View>
            ) : (
              userStats.slice(0, 10).map((user, index) => (
                <View
                  key={user.userId}
                  style={[
                    styles.userItem,
                    index === Math.min(9, userStats.length - 1) && styles.lastItem,
                    { borderBottomColor: palette.divider }
                  ]}
                >
                  <View style={styles.userRank}>
                    <LinearGradient
                      colors={index < 3 ? ['#FFD700', '#FFA500'] : [palette.cardElevated, palette.cardElevated]}
                      style={styles.rankBadge}
                    >
                      <Text style={[
                        styles.rankText,
                        { color: index < 3 ? '#FFFFFF' : palette.textPrimary }
                      ]}>
                        {index + 1}
                      </Text>
                    </LinearGradient>
                  </View>

                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: palette.textPrimary }]}>
                      {user.userName || `Rider ${user.userId.slice(0, 8)}`}
                    </Text>
                    <View style={styles.userMeta}>
                      <View style={styles.metaBadge}>
                        <Feather name="activity" size={12} color={palette.brandPrimary} />
                        <Text style={[styles.metaText, { color: palette.textSecondary }]}>
                          {user.rideCount} rides
                        </Text>
                      </View>
                      <View style={styles.metaBadge}>
                        <Feather name="navigation" size={12} color={palette.caution} />
                        <Text style={[styles.metaText, { color: palette.textSecondary }]}>
                          {formatDistance(user.averageDistance)} avg
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.userStats}>
                    <Text style={[styles.userDistance, { color: palette.textPrimary }]}>
                      {formatDistance(user.totalDistance)}
                    </Text>
                    <Text style={[styles.userDuration, { color: palette.textSecondary }]}>
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
      <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} onRequestFullSettings={handleRequestFullSettings} />
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
    alignItems: 'center',
  },
  myStatsAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 22,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
  },
  myStatsActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  topRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 44,
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
  heroCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 32,
  },
  heroStat: {
    flex: 1,
  },
  heroStatValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: -1,
  },
  heroStatLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  downloadSection: {
    marginBottom: 16,
  },
  quickStatsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  quickStatCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  quickStatIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickStatValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  quickStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
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
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  chartPlaceholder: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  chartPlaceholderText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  chartPlaceholderSubtext: {
    fontSize: 13,
    textAlign: 'center',
    opacity: 0.7,
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
    alignItems: 'center',
    marginBottom: 10,
  },
  trailRank: {
    width: 32,
    marginRight: 12,
  },
  trailRankText: {
    fontSize: 14,
    fontWeight: '800',
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 15,
    fontWeight: '800',
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