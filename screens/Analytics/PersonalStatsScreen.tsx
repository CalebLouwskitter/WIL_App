import { useColorScheme, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View, Animated, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState, useMemo, useRef } from 'react';
import { getCurrentUserRides, getUserRidesByTimePeriod } from '../../services/UserAnalyticsService';
import type { RideData } from '../../hooks/useRideTracker';
import { ReportDownload } from '../../services/AnalyticsService';
import { trailData } from '../../constants/trails';
import { resolvePalette } from '../../constants/colors';
import { AnalyticsUnavailableNotice } from '../../components/AnalyticsUnavailableNotice';
import { analyticsError, type AnalyticsResult } from '../../services/analyticsResult';

import {
  BarChart,
  LineChart,
  PieChart,
} from "react-native-gifted-charts";

type TimeSlot = 'day' | 'week' | 'month' | '3month' | '6month' | '1year';

interface UserStats {
  totalRides: number;
  totalDistance: number;
  favoriteTrail: string;
  hoursRidden: number;
  trailsCompleted: number;
  avgSpeed: number;
  lastRide: string;
}

interface ChartData {
  rideFrequency: Array<{ value: number; label: string; frontColor: string }>;
  trailPopularity: Array<{ value: number; label: string; color: string }>;
  weeklyDistance: Array<{ value: number; dataPointText: string }>;
}

function PersonalStatsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const colorScheme = useColorScheme();
  const theme = resolvePalette(colorScheme);
  const [timeSlot, setTimeSlot] = useState<TimeSlot>('month');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<AnalyticsResult<unknown> | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  const [rides, setRides] = useState<RideData[]>([]);
  
  const userStats = useMemo<UserStats>(() => {
    if (!rides.length) {
      return { totalRides: 0, totalDistance: 0, favoriteTrail: '-', hoursRidden: 0, trailsCompleted: 0, avgSpeed: 0, lastRide: '-' };
    }
    const totalRides = rides.length;
    const totalDistanceMeters = rides.reduce((a, r) => a + (r.totalDistance || 0), 0);
    const totalDistance = +(totalDistanceMeters / 1000).toFixed(1);
    const hoursRidden = +(rides.reduce((a, r) => a + (r.duration || 0), 0) / 1000 / 3600).toFixed(1);
    const avgSpeed = hoursRidden > 0 ? +(totalDistance / hoursRidden).toFixed(1) : 0;
    const lastRideTime = new Date(Math.max(...rides.map(r => r.startTime)));
    const diffDays = Math.floor((Date.now() - lastRideTime.getTime()) / (1000 * 60 * 60 * 24));
    const lastRide = diffDays === 0 ? 'Today' : diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
    
    const trailDistance: Record<string, number> = {};
    rides.forEach((r) => {
      const rd = r.routeDistances || {};
      Object.keys(rd).forEach((k) => {
        trailDistance[k] = (trailDistance[k] || 0) + (rd[k] || 0);
      });
    });

    let favoriteTrail = '-';
    let maxDist = 0;
    Object.entries(trailDistance).forEach(([trailId, dist]) => {
      if (dist > maxDist) {
        maxDist = dist;
        const t = trailData.find(t => t.id === trailId);
        favoriteTrail = t?.name || trailId;
      }
    });

    const trailsCompleted = Object.keys(trailDistance).length;

    return { totalRides, totalDistance, favoriteTrail, hoursRidden, trailsCompleted, avgSpeed, lastRide };
  }, [rides]);

  const [chartData, setChartData] = useState<ChartData>({ rideFrequency: [], trailPopularity: [], weeklyDistance: [] });

  const generateDataForTimeSlot = (slot: TimeSlot, srcRides: RideData[]): ChartData => {
    const primaryColor = theme.brandPrimary || '#3B82F6';

    const now = new Date();
    const start = new Date(now);
    if (slot === 'day') start.setDate(now.getDate() - 1);
    else if (slot === 'week') start.setDate(now.getDate() - 7);
    else if (slot === 'month') start.setMonth(now.getMonth() - 1);
    else if (slot === '3month') start.setMonth(now.getMonth() - 3);
    else if (slot === '6month') start.setMonth(now.getMonth() - 6);
    else if (slot === '1year') start.setFullYear(now.getFullYear() - 1);

    const inRange = srcRides.filter(r => r.startTime >= start.getTime());

    let rideFrequency: Array<{ value: number; label: string; frontColor: string }> = [];
    if (slot === 'day') {
      const buckets = [
        { label: '6AM', range: [6, 8] as const },
        { label: '9AM', range: [9, 11] as const },
        { label: '12PM', range: [12, 14] as const },
        { label: '3PM', range: [15, 17] as const },
        { label: '6PM', range: [18, 20] as const },
        { label: '9PM', range: [21, 23] as const },
      ];
      rideFrequency = buckets.map(b => {
        const count = inRange.filter(r => {
          const h = new Date(r.startTime).getHours();
          return h >= b.range[0] && h <= b.range[1];
        }).length;
        return { value: count, label: b.label, frontColor: primaryColor };
      });
    } else if (slot === 'week') {
      const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
      rideFrequency = labels.map((lbl, idx) => {
        const count = inRange.filter(r => {
          const d = new Date(r.startTime);
          const day = (d.getDay() + 6) % 7;
          return day === idx;
        }).length;
        return { value: count, label: lbl, frontColor: primaryColor };
      });
    } else if (slot === 'month') {
      const weekLabels = ['W1','W2','W3','W4'];
      rideFrequency = weekLabels.map((lbl, idx) => {
        const count = inRange.filter(r => {
          const d = new Date(r.startTime);
          const weekIdx = Math.min(3, Math.floor((d.getDate() - 1) / 7));
          return weekIdx === idx;
        }).length;
        return { value: count, label: lbl, frontColor: primaryColor };
      });
    } else {
      if (slot === '3month' || slot === '6month') {
        const monthsBack = slot === '3month' ? 3 : 6;
        const labels: string[] = [];
        const base = new Date(now.getFullYear(), now.getMonth(), 1);
        for (let i = monthsBack - 1; i >= 0; i--) {
          const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
          labels.push(d.toLocaleString('en-US', { month: 'short' }));
        }
        rideFrequency = labels.map((lbl, i) => {
          const monthIndex = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1 - i), 1).getMonth();
          const count = inRange.filter(r => new Date(r.startTime).getMonth() === monthIndex).length;
          return { value: count, label: lbl, frontColor: primaryColor };
        });
      } else {
        const quarters = ['Q1','Q2','Q3','Q4'];
        rideFrequency = quarters.map((lbl, q) => {
          const count = inRange.filter(r => Math.floor(new Date(r.startTime).getMonth() / 3) === q).length;
          return { value: count, label: lbl, frontColor: primaryColor };
        });
      }
    }

    const weeklyDistance: Array<{ value: number; dataPointText: string }> = rideFrequency.map((bucket, idx) => {
      let totalKm = 0;
      inRange.forEach(r => {
        const d = new Date(r.startTime);
        let match = false;
        if (slot === 'day') {
          const h = d.getHours();
          const ranges = [[6,8],[9,11],[12,14],[15,17],[18,20],[21,23]] as const;
          match = h >= ranges[idx][0] && h <= ranges[idx][1];
        } else if (slot === 'week') {
          const day = (d.getDay() + 6) % 7;
          match = day === idx;
        } else if (slot === 'month') {
          const weekIdx = Math.min(3, Math.floor((d.getDate() - 1) / 7));
          match = weekIdx === idx;
        } else if (slot === '3month' || slot === '6month') {
          const monthsBack = slot === '3month' ? 3 : 6;
          const refMonth = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1 - idx), 1).getMonth();
          match = d.getMonth() === refMonth;
        } else {
          match = Math.floor(d.getMonth() / 3) === idx;
        }
        if (match) totalKm += (r.totalDistance || 0) / 1000;
      });
      const v = +totalKm.toFixed(1);
      return { value: v, dataPointText: `${v}km` };
    });

    const trailDistance: Record<string, number> = {};
    inRange.forEach((r) => {
      const rd = r.routeDistances || {};
      Object.keys(rd).forEach((k) => {
        trailDistance[k] = (trailDistance[k] || 0) + (rd[k] || 0);
      });
    });
    const totalTrailMeters = Object.values(trailDistance).reduce((a, b) => a + b, 0) || 1;
    const sorted = Object.entries(trailDistance).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const colors = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6'];
    const trailPopularity = sorted.map(([id, dist], i) => {
      const t = trailData.find(t => t.id === id);
      const pct = Math.round((dist / totalTrailMeters) * 100);
      return { value: pct, label: t?.name || id, color: colors[i % colors.length] };
    });

    return { rideFrequency, trailPopularity, weeklyDistance };
  };

  useEffect(() => {
    setChartData(generateDataForTimeSlot(timeSlot, rides));
  }, [timeSlot, rides]);

  useEffect(() => { 
    (async () => { 
      try {
        setLoading(true);
        const stored = await getUserRidesByTimePeriod(timeSlot);
        setRides(stored.data);
        setProblem(stored.status === 'ok' ? null : stored);
      } catch (error) {
        console.error('Error loading rides from Firebase:', error);
        setProblem(analyticsError(error, []));
      } finally {
        setLoading(false);
      }
    })(); 

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [timeSlot, reloadKey]);

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      await ReportDownload.generateAndShareReport({ 
        timeSlot, 
        userStats, 
        chartData, 
        generatedDate: new Date().toISOString() 
      });
      Alert.alert('Success', 'Report generated successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to generate report. Please try again.');
      console.error('Report generation error:', error);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const timeSlots: TimeSlot[] = ['day', 'week', 'month', '3month', '6month', '1year'];

  const getTimeSlotLabel = (slot: TimeSlot): string => {
    const labels = {
      day: 'Day',
      week: 'Week',
      month: 'Month',
      '3month': '3M',
      '6month': '6M',
      '1year': '1Y'
    };
    return labels[slot];
  };

  const getChartTitle = (baseTitle: string): string => {
    return `${baseTitle}`;
  };

  const getChartPeriod = (): string => {
    const periods = {
      day: 'Today',
      week: 'This Week',
      month: 'This Month',
      '3month': 'Last 3 Months',
      '6month': 'Last 6 Months',
      '1year': 'This Year'
    };
    return periods[timeSlot];
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundLight }]}>
        <LinearGradient
          colors={['#EFF6FF', '#F8FAFC', '#F1F5F9'] as const}
          style={styles.gradient}
        >
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.brandPrimary} />
            <Text style={[styles.loadingText, { color: theme.onSurfaceVariant }]}>
              Loading stats from Firebase...
            </Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  if (problem) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#EFF6FF', '#F8FAFC', '#F1F5F9'] as const}
          style={styles.gradient}
        >
          <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <View style={styles.headerContent}>
                <TouchableOpacity
                  onPress={() => {
                    if (route?.params?.fromDashboard) {
                      navigation.getParent()?.navigate('Dashboard');
                    } else {
                      navigation.goBack();
                    }
                  }}
                  style={styles.backButton}
                >
                  <LinearGradient colors={['#fff', '#F8FAFC'] as const} style={styles.backButtonGradient}>
                    <Feather name="arrow-left" size={22} color="#0F172A" />
                  </LinearGradient>
                </TouchableOpacity>
                <View style={styles.headerTextContainer}>
                  <Text style={styles.headerTitle}>Personal Stats</Text>
                </View>
              </View>
            </View>
            <AnalyticsUnavailableNotice result={problem} onRetry={() => setReloadKey((k) => k + 1)} />
          </ScrollView>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#EFF6FF', '#F8FAFC', '#F1F5F9'] as const}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {/* Premium Header */}
          <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
            <View style={styles.headerContent}>
              <TouchableOpacity 
                onPress={() => {
                  if (route?.params?.fromDashboard) {
                    navigation.getParent()?.navigate('Dashboard');
                  } else {
                    navigation.goBack();
                  }
                }} 
                style={styles.backButton}
              >
                <LinearGradient
                  colors={['#fff', '#F8FAFC'] as const}
                  style={styles.backButtonGradient}
                >
                  <Feather name="arrow-left" size={22} color="#0F172A" />
                </LinearGradient>
              </TouchableOpacity>
              
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>Personal Stats</Text>
                <View style={styles.headerBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.headerSubtitle}>{getChartPeriod()} • Firebase</Text>
                </View>
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.exportButton}
              onPress={handleGenerateReport}
              disabled={isGeneratingReport}
            >
              <LinearGradient
                colors={['#3B82F6', '#2563EB', '#1E40AF'] as const}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.exportGradient}
              >
                <Feather name={isGeneratingReport ? "loader" : "download"} size={18} color="white" />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Hero Stats Card */}
          <Animated.View style={[
            styles.heroCard,
            { 
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}>
            <LinearGradient
              colors={['#1E40AF', '#3B82F6', '#60A5FA'] as const}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroGradient}
            >
              <View style={styles.heroPattern} />
              <View style={styles.heroContent}>
                <View style={styles.heroMain}>
                  <Text style={styles.heroLabel}>Total Distance</Text>
                  <Text style={styles.heroValue}>{userStats.totalDistance}</Text>
                  <Text style={styles.heroUnit}>kilometers</Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroStats}>
                  <View style={styles.heroStatItem}>
                    <Feather name="activity" size={16} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.heroStatValue}>{userStats.totalRides}</Text>
                    <Text style={styles.heroStatLabel}>Rides</Text>
                  </View>
                  <View style={styles.heroStatItem}>
                    <Feather name="clock" size={16} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.heroStatValue}>{userStats.hoursRidden}h</Text>
                    <Text style={styles.heroStatLabel}>Hours</Text>
                  </View>
                  <View style={styles.heroStatItem}>
                    <Feather name="zap" size={16} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.heroStatValue}>{userStats.avgSpeed}</Text>
                    <Text style={styles.heroStatLabel}>km/h</Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Time Selector with Pills */}
          <Animated.View style={[styles.timeSelector, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeScrollContent}>
              {timeSlots.map(slot => (
                <TouchableOpacity 
                  key={slot} 
                  style={[
                    styles.timePill,
                    timeSlot === slot && styles.timePillActive
                  ]}
                  onPress={() => setTimeSlot(slot)}
                  activeOpacity={0.7}
                >
                  {timeSlot === slot ? (
                    <LinearGradient
                      colors={['#3B82F6', '#2563EB'] as const}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.timePillGradient}
                    >
                      <Text style={styles.timePillTextActive}>{getTimeSlotLabel(slot)}</Text>
                    </LinearGradient>
                  ) : (
                    <Text style={styles.timePillText}>{getTimeSlotLabel(slot)}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>

          {/* Quick Stats Grid */}
          <View style={styles.quickStats}>
            <View style={styles.quickStatCard}>
              <View style={styles.quickStatIconWrapper}>
                <LinearGradient colors={['#DBEAFE', '#BFDBFE'] as const} style={styles.quickStatIcon}>
                  <Feather name="map-pin" size={20} color="#1E40AF" />
                </LinearGradient>
              </View>
              <Text style={styles.quickStatValue}>{userStats.trailsCompleted}</Text>
              <Text style={styles.quickStatLabel}>Trails Completed</Text>
            </View>

            <View style={styles.quickStatCard}>
              <View style={styles.quickStatIconWrapper}>
                <LinearGradient colors={['#D1FAE5', '#A7F3D0'] as const} style={styles.quickStatIcon}>
                  <Feather name="target" size={20} color="#065F46" />
                </LinearGradient>
              </View>
              <Text style={styles.quickStatValue}>{userStats.avgSpeed}</Text>
              <Text style={styles.quickStatLabel}>Average Speed</Text>
              <View style={[styles.quickStatBadge, { backgroundColor: '#D1FAE5' }]}>
                <Text style={[styles.quickStatBadgeText, { color: '#065F46' }]}>km/h</Text>
              </View>
            </View>
          </View>

          {/* Ride Frequency Chart */}
          <View style={styles.chartCard}>
            <View style={styles.chartHeaderPremium}>
              <View style={styles.chartTitleSection}>
                <View style={styles.chartIconBadge}>
                  <LinearGradient colors={['#DBEAFE', '#BFDBFE'] as const} style={styles.chartIconBadgeGradient}>
                    <Feather name="bar-chart-2" size={18} color="#1E40AF" />
                  </LinearGradient>
                </View>
                <View>
                  <Text style={styles.chartTitle}>{getChartTitle('Ride Frequency')}</Text>
                  <Text style={styles.chartSubtitle}>Rides per period</Text>
                </View>
              </View>
            </View>
            <View style={styles.chartWrapper}>
              <BarChart
                barWidth={36}
                noOfSections={4}
                barBorderRadius={10}
                data={chartData.rideFrequency}
                yAxisThickness={0}
                xAxisThickness={0}
                isAnimated
                animationDuration={1200}
                spacing={24}
                hideRules
              />
            </View>
          </View>

          {/* Trail Distribution Chart */}
          <View style={styles.chartCard}>
            <View style={styles.chartHeaderPremium}>
              <View style={styles.chartTitleSection}>
                <View style={styles.chartIconBadge}>
                  <LinearGradient colors={['#D1FAE5', '#A7F3D0'] as const} style={styles.chartIconBadgeGradient}>
                    <Feather name="pie-chart" size={18} color="#065F46" />
                  </LinearGradient>
                </View>
                <View>
                  <Text style={styles.chartTitle}>Trail Distribution</Text>
                  <Text style={styles.chartSubtitle}>Most visited locations</Text>
                </View>
              </View>
            </View>
            <View style={styles.pieWrapper}>
              <View style={styles.pieChartContainer}>
                <PieChart
                  data={chartData.trailPopularity}
                  donut
                  radius={90}
                  innerRadius={65}
                  innerCircleColor="#fff"
                  centerLabelComponent={() => (
                    <View style={styles.pieCenterLabel}>
                      <Text style={styles.pieCenterValue}>{userStats.totalRides}</Text>
                      <Text style={styles.pieCenterText}>Total</Text>
                      <Text style={styles.pieCenterSubtext}>rides</Text>
                    </View>
                  )}
                />
              </View>
              <View style={styles.pieLegendContainer}>
                {chartData.trailPopularity.map((item, index) => (
                  <View key={index} style={styles.legendRow}>
                    <View style={styles.legendLeft}>
                      <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                      <Text style={styles.legendLabel}>{item.label}</Text>
                    </View>
                    <View style={styles.legendRight}>
                      <Text style={styles.legendValue}>{item.value}%</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Distance Trend Chart */}
          <View style={styles.chartCard}>
            <View style={styles.chartHeaderPremium}>
              <View style={styles.chartTitleSection}>
                <View style={styles.chartIconBadge}>
                  <LinearGradient colors={['#FEF3C7', '#FDE68A'] as const} style={styles.chartIconBadgeGradient}>
                    <Feather name="trending-up" size={18} color="#92400E" />
                  </LinearGradient>
                </View>
                <View>
                  <Text style={styles.chartTitle}>{getChartTitle('Distance Progress')}</Text>
                  <Text style={styles.chartSubtitle}>Kilometers over time</Text>
                </View>
              </View>
            </View>
            <View style={styles.chartWrapper}>
              <LineChart
                data={chartData.weeklyDistance}
                areaChart
                yAxisThickness={0}
                xAxisThickness={0}
                color="#3B82F6"
                startFillColor="#3B82F6"
                endFillColor="#3B82F6"
                startOpacity={0.4}
                endOpacity={0.05}
                curved
                isAnimated
                animationDuration={1200}
                hideRules
                hideDataPoints={false}
                dataPointsColor="#3B82F6"
                dataPointsRadius={5}
                thickness={3}
              />
            </View>
          </View>

          {/* Performance Insights */}
          <View style={styles.insightsSection}>
            <Text style={styles.sectionTitle}>Performance Insights</Text>
            
            <View style={styles.insightCard}>
              <LinearGradient
                colors={['#F0F9FF', '#fff'] as const}
                style={styles.insightGradient}
              >
                <View style={styles.insightHeader}>
                  <View style={styles.insightIconCircle}>
                    <Feather name="star" size={18} color="#F59E0B" />
                  </View>
                  <View style={styles.insightTitleContainer}>
                    <Text style={styles.insightTitle}>Favorite Trail</Text>
                    <Text style={styles.insightValue}>{userStats.favoriteTrail}</Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            <View style={styles.insightCard}>
              <LinearGradient
                colors={['#F0FDF4', '#fff'] as const}
                style={styles.insightGradient}
              >
                <View style={styles.insightHeader}>
                  <View style={[styles.insightIconCircle, { backgroundColor: '#D1FAE5' }]}>
                    <Feather name="calendar" size={18} color="#10B981" />
                  </View>
                  <View style={styles.insightTitleContainer}>
                    <Text style={styles.insightTitle}>Last Ride</Text>
                    <Text style={styles.insightValue}>{userStats.lastRide}</Text>
                  </View>
                </View>
              </LinearGradient>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EFF6FF' },
  gradient: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 15, fontWeight: '500' },
  scrollContainer: { paddingTop: 60, paddingBottom: 40 },
  header: { paddingHorizontal: 20, marginBottom: 20 },
  headerContent: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backButton: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 },
  backButtonGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerTextContainer: { marginLeft: 16, flex: 1 },
  headerTitle: { fontSize: 32, fontWeight: '800', color: '#0F172A', letterSpacing: -1, marginBottom: 6 },
  headerBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DBEAFE', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, alignSelf: 'flex-start', gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3B82F6' },
  headerSubtitle: { fontSize: 13, fontWeight: '700', color: '#1E40AF', letterSpacing: 0.3 },
  exportButton: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8, position: 'absolute', right: 20, top: 0 },
  exportGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroCard: { marginHorizontal: 20, marginBottom: 24, borderRadius: 28, overflow: 'hidden', shadowColor: '#1E40AF', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 12 },
  heroGradient: { padding: 28, position: 'relative' },
  heroPattern: { position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  heroContent: { zIndex: 1 },
  heroMain: { alignItems: 'center', marginBottom: 24 },
  heroLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  heroValue: { fontSize: 64, fontWeight: '800', color: '#fff', letterSpacing: -2 },
  heroUnit: { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.9)', marginTop: 4 },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: 20 },
  heroStats: { flexDirection: 'row', justifyContent: 'space-around' },
  heroStatItem: { alignItems: 'center', gap: 6 },
  heroStatValue: { fontSize: 20, fontWeight: '700', color: '#fff', letterSpacing: -0.5 },
  heroStatLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: 0.5 },
  timeSelector: { marginBottom: 24 },
  timeScrollContent: { paddingHorizontal: 20, gap: 10 },
  timePill: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 20, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  timePillActive: { shadowColor: '#3B82F6', shadowOpacity: 0.25, elevation: 6 },
  timePillGradient: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 20, marginVertical: -12, marginHorizontal: -24, alignItems: 'center', justifyContent: 'center' },
  timePillText: { fontSize: 15, fontWeight: '600', color: '#64748B' },
  timePillTextActive: { fontSize: 15, fontWeight: '700', color: '#fff' },
  quickStats: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 24 },
  quickStatCard: { flex: 1, backgroundColor: '#fff', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  quickStatIconWrapper: { marginBottom: 16 },
  quickStatIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  quickStatValue: { fontSize: 32, fontWeight: '800', color: '#0F172A', marginBottom: 6, letterSpacing: -1 },
  quickStatLabel: { fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 12, lineHeight: 18 },
  quickStatBadge: { backgroundColor: '#DBEAFE', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, alignSelf: 'flex-start' },
  quickStatBadgeText: { fontSize: 11, fontWeight: '700', color: '#1E40AF', letterSpacing: 0.3 },
  chartCard: { backgroundColor: '#fff', borderRadius: 28, padding: 24, marginHorizontal: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 },
  chartHeaderPremium: { marginBottom: 24 },
  chartTitleSection: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  chartIconBadge: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  chartIconBadgeGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  chartTitle: { fontSize: 20, fontWeight: '700', color: '#0F172A', marginBottom: 4, letterSpacing: -0.3 },
  chartSubtitle: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  chartWrapper: { paddingVertical: 10 },
  pieWrapper: { gap: 24 },
  pieChartContainer: { alignItems: 'center', paddingVertical: 20 },
  pieCenterLabel: { alignItems: 'center' },
  pieCenterValue: { fontSize: 32, fontWeight: '800', color: '#0F172A', letterSpacing: -1 },
  pieCenterText: { fontSize: 13, fontWeight: '600', color: '#64748B', marginTop: 2 },
  pieCenterSubtext: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  pieLegendContainer: { gap: 12 },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16 },
  legendLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  legendDot: { width: 12, height: 12, borderRadius: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 2 },
  legendLabel: { fontSize: 15, fontWeight: '600', color: '#334155' },
  legendRight: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  legendValue: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  insightsSection: { paddingHorizontal: 20 },
  sectionTitle: { fontSize: 24, fontWeight: '700', color: '#0F172A', marginBottom: 16, letterSpacing: -0.5 },
  insightCard: { marginBottom: 12, borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  insightGradient: { padding: 20 },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  insightIconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 2 },
  insightTitleContainer: { flex: 1 },
  insightTitle: { fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  insightValue: { fontSize: 18, fontWeight: '700', color: '#0F172A', letterSpacing: -0.3 },
});

export default PersonalStatsScreen;