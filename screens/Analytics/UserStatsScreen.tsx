import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme, SafeAreaView, ActivityIndicator, Modal } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { AnalyticsStackParamList, TabParamList } from '../../navigation/types';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAnalytics } from '../../hooks/useAnalytics';
import { Colors, resolvePalette } from '../../constants/colors';
import { Dimensions } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');
const STAT_CARD_WIDTH = (screenWidth - 56) / 2;

type NavigationProp = StackNavigationProp<AnalyticsStackParamList, 'DetailedStats'>;
type ScreenRouteProp = RouteProp<AnalyticsStackParamList, 'DetailedStats'>;

const UserStatsScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { stats, loading, error, refresh } = useAnalytics();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const colorScheme = useColorScheme();
  const theme = resolvePalette(colorScheme);

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleBack = () => {
    if (route.params?.fromDashboard) {
      navigation.getParent<BottomTabNavigationProp<TabParamList>>()?.navigate('Dashboard');
    } else if (typeof navigation.canGoBack === 'function' && !navigation.canGoBack()) {
      navigation.navigate('Stats');
    } else {
      navigation.goBack();
    }
  };

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDistance = (meters: number) => {
    return (meters / 1000).toFixed(1);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundLight }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.brandPrimary} />
          <Text style={[styles.loadingText, { color: theme.onSurfaceVariant }]}>Loading your stats...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundLight }]}>
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={48} color={theme.error} />
          <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
          <TouchableOpacity onPress={refresh} style={[styles.retryButton, { backgroundColor: theme.brandPrimary }]}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundLight }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            activeOpacity={0.7}
            onPress={handleBack}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Feather name="arrow-left" size={24} color={theme.onSurface} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <View style={styles.headerIcon}>
              <Feather name="bar-chart-2" size={24} color={theme.brandPrimary} />
            </View>
            <View style={styles.headerTitleContainer}>
              <Text style={[styles.headerTitle, { color: theme.onSurface }]}>Your Stats</Text>
              <Text style={[styles.headerSubtitle, { color: theme.onSurfaceVariant }]}>
                Performance overview
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.headerActionButton}
              onPress={() => setSettingsVisible(true)}
            >
              <Feather name="settings" size={24} color={theme.icon} />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.headerActionButton}
              onPress={() => setNotificationsVisible(true)}
            >
              <Feather name="bell" size={24} color={theme.icon} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Overview Stats Grid */}
        <View style={styles.statsSection}>
          <Text style={[styles.sectionTitle, { color: theme.onSurface }]}>Overview</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
              <View style={[styles.statIconCircle, { backgroundColor: '#3B82F6' }]}>
                <Feather name="activity" size={20} color="#fff" />
              </View>
              <Text style={[styles.statValue, { color: theme.onSurface }]}>{stats.totalRides}</Text>
              <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>RIDES</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
              <View style={[styles.statIconCircle, { backgroundColor: '#10B981' }]}>
                <Feather name="map" size={20} color="#fff" />
              </View>
              <Text style={[styles.statValue, { color: theme.onSurface }]}>
                {formatDistance(stats.totalDistance)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>KM</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
              <View style={[styles.statIconCircle, { backgroundColor: '#F59E0B' }]}>
                <Feather name="clock" size={20} color="#fff" />
              </View>
              <Text style={[styles.statValue, { color: theme.onSurface }]}>
                {Math.round(stats.totalDuration / (1000 * 60 * 60))}
              </Text>
              <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>HOURS</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
              <View style={[styles.statIconCircle, { backgroundColor: '#8B5CF6' }]}>
                <Feather name="star" size={20} color="#fff" />
              </View>
              <Text style={[styles.statValue, { color: theme.onSurface }]}>{stats.totalPoints}</Text>
              <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>POINTS</Text>
            </View>
          </View>
        </View>

        {/* Performance Metrics */}
        <View style={styles.performanceSection}>
          <Text style={[styles.sectionTitle, { color: theme.onSurface }]}>Performance</Text>
          
          <View style={[styles.performanceCard, { backgroundColor: theme.surface }]}>
            <View style={styles.performanceRow}>
              <View style={styles.performanceItem}>
                <Feather name="trending-up" size={20} color={theme.brandPrimary} />
                <View style={styles.performanceInfo}>
                  <Text style={[styles.performanceLabel, { color: theme.onSurfaceVariant }]}>Avg Speed</Text>
                  <Text style={[styles.performanceValue, { color: theme.onSurface }]}>
                    {stats.averageSpeed.toFixed(1)} km/h
                  </Text>
                </View>
              </View>
              <View style={[styles.performanceDivider, { backgroundColor: theme.borderMuted }]} />
              <View style={styles.performanceItem}>
                <Feather name="navigation" size={20} color={theme.success} />
                <View style={styles.performanceInfo}>
                  <Text style={[styles.performanceLabel, { color: theme.onSurfaceVariant }]}>Avg Distance</Text>
                  <Text style={[styles.performanceValue, { color: theme.onSurface }]}>
                    {formatDistance(stats.averageDistance)} km
                  </Text>
                </View>
              </View>
            </View>

            <View style={[styles.performanceRowDivider, { backgroundColor: theme.borderMuted }]} />

            <View style={styles.performanceRow}>
              <View style={styles.performanceItem}>
                <Feather name="arrow-up" size={20} color={theme.caution} />
                <View style={styles.performanceInfo}>
                  <Text style={[styles.performanceLabel, { color: theme.onSurfaceVariant }]}>Elevation Gain</Text>
                  <Text style={[styles.performanceValue, { color: theme.onSurface }]}>
                    {Math.round(stats.totalElevationGain)} m
                  </Text>
                </View>
              </View>
              <View style={[styles.performanceDivider, { backgroundColor: theme.borderMuted }]} />
              <View style={styles.performanceItem}>
                <Feather name="award" size={20} color="#EF4444" />
                <View style={styles.performanceInfo}>
                  <Text style={[styles.performanceLabel, { color: theme.onSurfaceVariant }]}>Longest Ride</Text>
                  <Text style={[styles.performanceValue, { color: theme.onSurface }]}>
                    {formatDistance(stats.longestRide)} km
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={[styles.sectionTitle, { color: theme.onSurface }]}>Insights</Text>
          
          {/* Global Analytics Card */}
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: theme.surface }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('GlobalStats')}
          >
            <LinearGradient
              colors={['#8B5CF611', '#8B5CF605']}
              style={styles.actionCardGradient}
            >
              <View style={styles.actionCardContent}>
                <View style={[styles.actionIconCircle, { backgroundColor: '#8B5CF622' }]}>
                  <Feather name="globe" size={24} color="#8B5CF6" />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={[styles.actionTitle, { color: theme.onSurface }]}>Global Analytics</Text>
                  <Text style={[styles.actionSubtitle, { color: theme.onSurfaceVariant }]}>
                    Community stats and leaderboards
                  </Text>
                </View>
                <Feather name="chevron-right" size={24} color={theme.onSurfaceVariant} />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: theme.surface }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('RideHistory')}
          >
            <LinearGradient
              colors={[theme.brandPrimary + '11', theme.brandPrimary + '05']}
              style={styles.actionCardGradient}
            >
              <View style={styles.actionCardContent}>
                <View style={[styles.actionIconCircle, { backgroundColor: theme.brandPrimary + '22' }]}>
                  <Feather name="list" size={24} color={theme.brandPrimary} />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={[styles.actionTitle, { color: theme.onSurface }]}>Ride History</Text>
                  <Text style={[styles.actionSubtitle, { color: theme.onSurfaceVariant }]}>
                    View all {stats.totalRides} completed rides
                  </Text>
                </View>
                <Feather name="chevron-right" size={24} color={theme.onSurfaceVariant} />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: theme.surface }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('PersonalStats')}
          >
            <LinearGradient
              colors={['#F59E0B11', '#F59E0B05']}
              style={styles.actionCardGradient}
            >
              <View style={styles.actionCardContent}>
                <View style={[styles.actionIconCircle, { backgroundColor: '#F59E0B22' }]}>
                  <Feather name="pie-chart" size={24} color="#F59E0B" />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={[styles.actionTitle, { color: theme.onSurface }]}>Detailed Analytics</Text>
                  <Text style={[styles.actionSubtitle, { color: theme.onSurfaceVariant }]}>
                    Advanced charts and insights
                  </Text>
                </View>
                <Feather name="chevron-right" size={24} color={theme.onSurfaceVariant} />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: theme.surface }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('TrailStats')}
          >
            <LinearGradient
              colors={[theme.brandSecondary + '11', theme.brandSecondary + '05']}
              style={styles.actionCardGradient}
            >
              <View style={styles.actionCardContent}>
                <View style={[styles.actionIconCircle, { backgroundColor: theme.brandSecondary + '22' }]}>
                  <Feather name="trending-up" size={24} color={theme.brandSecondary} />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={[styles.actionTitle, { color: theme.onSurface }]}>Trail Usage</Text>
                  <Text style={[styles.actionSubtitle, { color: theme.onSurfaceVariant }]}>
                    See which routes you ride most
                  </Text>
                </View>
                <Feather name="chevron-right" size={24} color={theme.onSurfaceVariant} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Modals */}
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
            <Text style={[styles.modalPlaceholder, { color: theme.onSurfaceVariant }]}>
              Quick settings will appear here.
            </Text>
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
            <Text style={[styles.modalPlaceholder, { color: theme.onSurfaceVariant }]}>
              Notifications will show here.
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
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
  statsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: STAT_CARD_WIDTH,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
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
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  performanceSection: {
    marginBottom: 24,
  },
  performanceCard: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  performanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  performanceRowDivider: {
    height: 1,
    marginVertical: 20,
  },
  performanceItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
  },
  performanceDivider: {
    width: 1,
    height: 40,
    marginHorizontal: 8,
  },
  performanceInfo: {
    flex: 1,
  },
  performanceLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  performanceValue: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  actionsSection: {
    marginBottom: 24,
  },
  actionCard: {
    borderRadius: 20,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  actionCardGradient: {
    padding: 20,
  },
  actionCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  actionSubtitle: {
    fontSize: 14,
    fontWeight: '500',
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
    ...StyleSheet.absoluteFill,
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

export default UserStatsScreen;