import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { AnalyticsStackParamList, TabParamList } from '../../navigation/types';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useAppTheme } from '../../hooks/useAppTheme';
import { usePreferences } from '../../contexts/PreferencesContext';
import { formatDistance, formatSpeedKmh } from '../../utils/units';
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
  const { palette, isDark } = useAppTheme();
  const { preferences } = usePreferences();
  const unitSystem = preferences?.units || 'metric';

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



  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.brandPrimary} />
          <Text style={[styles.loadingText, { color: palette.textSecondary }]}>Loading your stats...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={48} color={palette.danger} />
          <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
          <TouchableOpacity onPress={refresh} style={[styles.retryButton, { backgroundColor: palette.brandPrimary }]}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: palette.card }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            activeOpacity={0.7}
            onPress={handleBack}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Feather name="arrow-left" size={24} color={palette.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <View style={styles.headerIcon}>
              <Feather name="bar-chart-2" size={24} color={palette.brandPrimary} />
            </View>
            <View style={styles.headerTitleContainer}>
              <Text style={[styles.headerTitle, { color: palette.textPrimary }]}>Your Stats</Text>
              <Text style={[styles.headerSubtitle, { color: palette.textSecondary }]}>
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
              <Feather name="settings" size={24} color={palette.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.headerActionButton}
              onPress={() => setNotificationsVisible(true)}
            >
              <Feather name="bell" size={24} color={palette.textSecondary} />
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
          <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>Overview</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: palette.card }]}>
              <View style={[styles.statIconCircle, { backgroundColor: palette.brandPrimary }]}>
                <Feather name="activity" size={20} color={palette.onPrimary} />
              </View>
              <Text style={[styles.statValue, { color: palette.textPrimary }]}>{stats.totalRides}</Text>
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>RIDES</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: palette.card }]}>
              <View style={[styles.statIconCircle, { backgroundColor: palette.success }]}>
                <Feather name="map" size={20} color={palette.onPrimary} />
              </View>
              <Text style={[styles.statValue, { color: palette.textPrimary }]}>
                {formatDistance(stats.totalDistance, unitSystem, 1).value}
              </Text>
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>
                {formatDistance(stats.totalDistance, unitSystem, 1).unit.toUpperCase()}
              </Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: palette.card }]}>
              <View style={[styles.statIconCircle, { backgroundColor: palette.caution }]}>
                <Feather name="clock" size={20} color={palette.onPrimary} />
              </View>
              <Text style={[styles.statValue, { color: palette.textPrimary }]}>
                {Math.round(stats.totalDuration / (1000 * 60 * 60))}
              </Text>
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>HOURS</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: palette.card }]}>
              <View style={[styles.statIconCircle, { backgroundColor: palette.brandSecondary }]}>
                <Feather name="star" size={20} color={palette.onPrimary} />
              </View>
              <Text style={[styles.statValue, { color: palette.textPrimary }]}>{stats.totalPoints}</Text>
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>POINTS</Text>
            </View>
          </View>
        </View>

        {/* Performance Metrics */}
        <View style={styles.performanceSection}>
          <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>Performance</Text>
          
          <View style={[styles.performanceCard, { backgroundColor: palette.card }]}>
            <View style={styles.performanceRow}>
              <View style={styles.performanceItem}>
                <Feather name="trending-up" size={20} color={palette.brandPrimary} />
                <View style={styles.performanceInfo}>
                  <Text style={[styles.performanceLabel, { color: palette.textSecondary }]}>Avg Speed</Text>
                  <Text style={[styles.performanceValue, { color: palette.textPrimary }]}>
                    {formatSpeedKmh(stats.averageSpeed, unitSystem, 1).value} {formatSpeedKmh(stats.averageSpeed, unitSystem, 1).unit}
                  </Text>
                </View>
              </View>
              <View style={[styles.performanceDivider, { backgroundColor: palette.divider }]} />
              <View style={styles.performanceItem}>
                <Feather name="navigation" size={20} color={palette.success} />
                <View style={styles.performanceInfo}>
                  <Text style={[styles.performanceLabel, { color: palette.textSecondary }]}>Avg Distance</Text>
                  <Text style={[styles.performanceValue, { color: palette.textPrimary }]}>
                    {formatDistance(stats.averageDistance, unitSystem, 1).value} {formatDistance(stats.averageDistance, unitSystem, 1).unit}
                  </Text>
                </View>
              </View>
            </View>

            <View style={[styles.performanceRowDivider, { backgroundColor: palette.divider }]} />

            <View style={styles.performanceRow}>
              <View style={styles.performanceItem}>
                <Feather name="arrow-up" size={20} color={palette.caution} />
                <View style={styles.performanceInfo}>
                  <Text style={[styles.performanceLabel, { color: palette.textSecondary }]}>Elevation Gain</Text>
                  <Text style={[styles.performanceValue, { color: palette.textPrimary }]}>
                    {Math.round(stats.totalElevationGain)} m
                  </Text>
                </View>
              </View>
              <View style={[styles.performanceDivider, { backgroundColor: palette.divider }]} />
              <View style={styles.performanceItem}>
                <Feather name="award" size={20} color={palette.danger} />
                <View style={styles.performanceInfo}>
                  <Text style={[styles.performanceLabel, { color: palette.textSecondary }]}>Longest Ride</Text>
                  <Text style={[styles.performanceValue, { color: palette.textPrimary }]}>
                    {formatDistance(stats.longestRide, unitSystem, 1).value} {formatDistance(stats.longestRide, unitSystem, 1).unit}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>Insights</Text>
          
          {/* Global Analytics Card */}
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: palette.card }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('GlobalStats')}
          >
            <LinearGradient
              colors={isDark ? ['rgba(139, 92, 246, 0.15)', 'rgba(139, 92, 246, 0.05)'] : ['#8B5CF611', '#8B5CF605']}
              style={styles.actionCardGradient}
            >
              <View style={styles.actionCardContent}>
                <View style={[styles.actionIconCircle, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.25)' : '#8B5CF622' }]}>
                  <Feather name="globe" size={24} color={isDark ? palette.brandPrimary : '#8B5CF6'} />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={[styles.actionTitle, { color: palette.textPrimary }]}>Global Analytics</Text>
                  <Text style={[styles.actionSubtitle, { color: palette.textSecondary }]}>
                    Community stats and leaderboards
                  </Text>
                </View>
                <Feather name="chevron-right" size={24} color={palette.textSecondary} />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: palette.card }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('RideHistory')}
          >
            <LinearGradient
              colors={[palette.brandPrimary + '11', palette.brandPrimary + '05']}
              style={styles.actionCardGradient}
            >
              <View style={styles.actionCardContent}>
                <View style={[styles.actionIconCircle, { backgroundColor: palette.brandPrimary + '22' }]}>
                  <Feather name="list" size={24} color={palette.brandPrimary} />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={[styles.actionTitle, { color: palette.textPrimary }]}>Ride History</Text>
                  <Text style={[styles.actionSubtitle, { color: palette.textSecondary }]}>
                    View all {stats.totalRides} completed rides
                  </Text>
                </View>
                <Feather name="chevron-right" size={24} color={palette.textSecondary} />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: palette.card }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('PersonalStats')}
          >
            <LinearGradient
              colors={isDark ? ['rgba(245, 158, 11, 0.15)', 'rgba(245, 158, 11, 0.05)'] : ['#F59E0B11', '#F59E0B05']}
              style={styles.actionCardGradient}
            >
              <View style={styles.actionCardContent}>
                <View style={[styles.actionIconCircle, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.25)' : '#F59E0B22' }]}>
                  <Feather name="pie-chart" size={24} color={palette.caution} />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={[styles.actionTitle, { color: palette.textPrimary }]}>Detailed Analytics</Text>
                  <Text style={[styles.actionSubtitle, { color: palette.textSecondary }]}>
                    Advanced charts and insights
                  </Text>
                </View>
                <Feather name="chevron-right" size={24} color={palette.textSecondary} />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: palette.card }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('TrailStats')}
          >
            <LinearGradient
              colors={[palette.caution + '11', palette.caution + '05']}
              style={styles.actionCardGradient}
            >
              <View style={styles.actionCardContent}>
                <View style={[styles.actionIconCircle, { backgroundColor: palette.caution + '22' }]}>
                  <Feather name="trending-up" size={24} color={palette.caution} />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={[styles.actionTitle, { color: palette.textPrimary }]}>Trail Usage</Text>
                  <Text style={[styles.actionSubtitle, { color: palette.textSecondary }]}>
                    See which routes you ride most
                  </Text>
                </View>
                <Feather name="chevron-right" size={24} color={palette.textSecondary} />
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
          <View style={[styles.modalContent, { backgroundColor: palette.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: palette.textPrimary }]}>Settings</Text>
              <TouchableOpacity onPress={() => setSettingsVisible(false)}>
                <Feather name="x" size={20} color={palette.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalPlaceholder, { color: palette.textSecondary }]}>
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
          <View style={[styles.modalContent, { backgroundColor: palette.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: palette.textPrimary }]}>Notifications</Text>
              <TouchableOpacity onPress={() => setNotificationsVisible(false)}>
                <Feather name="x" size={20} color={palette.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalPlaceholder, { color: palette.textSecondary }]}>
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
    color: '#FFFFFF',
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