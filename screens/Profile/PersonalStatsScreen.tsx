import { useColorScheme, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ThemedText } from 'components/theme/ThemedText';
import { ThemedView } from 'components/theme/ThemedView';
import { Colors } from 'constants/colors';
import { ReportDownload } from 'services/AnalyticsService';
import { Feather } from '@expo/vector-icons';
import { useEffect, useState, useMemo } from 'react';
import { getRides } from 'services/RideStorage';
import type { RideData } from 'hooks/useRideTracker';
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

export default function AnalyticsScreen() {
  const [timeSlot, setTimeSlot] = useState<TimeSlot>('month');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [rides, setRides] = useState<RideData[]>([]);
  const userStats = useMemo<UserStats>(() => {
    if (!rides.length) {
      return { totalRides: 0, totalDistance: 0, favoriteTrail: '-', hoursRidden: 0, trailsCompleted: 0, avgSpeed: 0, lastRide: '-' };
    }
    const totalRides = rides.length;
    const totalDistanceMeters = rides.reduce((a, r) => a + r.totalDistance, 0);
    const totalDistance = +(totalDistanceMeters / 1000).toFixed(1); // km
    // duration stored ms -> hours
    const hoursRidden = +(rides.reduce((a, r) => a + r.duration, 0) / 1000 / 3600).toFixed(1);
    const avgSpeed = hoursRidden > 0 ? +(totalDistance / hoursRidden).toFixed(1) : 0; // km/h
    const lastRideTime = new Date(Math.max(...rides.map(r => r.startTime)));
    const diffDays = Math.floor((Date.now() - lastRideTime.getTime()) / (1000 * 60 * 60 * 24));
    const lastRide = diffDays === 0 ? 'Today' : diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
    // trailsCompleted & favoriteTrail placeholders until route meta tracking exists
    return { totalRides, totalDistance, favoriteTrail: '-', hoursRidden, trailsCompleted: 0, avgSpeed, lastRide };
  }, [rides]);

  const [chartData, setChartData] = useState<ChartData>({ rideFrequency: [], trailPopularity: [], weeklyDistance: [] });

  // Generate data based on selected timeSlot
  const generateDataForTimeSlot = (slot: TimeSlot) => {
    const baseData = {
      day: {
        rideFrequency: [
          { value: 2, label: '6AM', frontColor: colors.primary },
          { value: 1, label: '9AM', frontColor: colors.primary },
          { value: 0, label: '12PM', frontColor: colors.primary },
          { value: 3, label: '3PM', frontColor: colors.primary },
          { value: 2, label: '6PM', frontColor: colors.primary },
          { value: 1, label: '9PM', frontColor: colors.primary },
        ],
        weeklyDistance: [
          { value: 5, dataPointText: '5km' },
          { value: 8, dataPointText: '8km' },
          { value: 3, dataPointText: '3km' },
          { value: 12, dataPointText: '12km' },
          { value: 7, dataPointText: '7km' },
          { value: 9, dataPointText: '9km' },
          { value: 6, dataPointText: '6km' },
        ]
      },
      week: {
        rideFrequency: [
          { value: 3, label: 'Mon', frontColor: colors.primary },
          { value: 2, label: 'Tue', frontColor: colors.primary },
          { value: 4, label: 'Wed', frontColor: colors.primary },
          { value: 1, label: 'Thu', frontColor: colors.primary },
          { value: 5, label: 'Fri', frontColor: colors.primary },
          { value: 6, label: 'Sat', frontColor: colors.primary },
          { value: 4, label: 'Sun', frontColor: colors.primary },
        ],
        weeklyDistance: [
          { value: 12, dataPointText: '12km' },
          { value: 18, dataPointText: '18km' },
          { value: 8, dataPointText: '8km' },
          { value: 23, dataPointText: '23km' },
          { value: 15, dataPointText: '15km' },
          { value: 20, dataPointText: '20km' },
          { value: 14, dataPointText: '14km' },
        ]
      },
      month: {
        rideFrequency: [
          { value: 8, label: 'W1', frontColor: colors.primary },
          { value: 10, label: 'W2', frontColor: colors.primary },
          { value: 14, label: 'W3', frontColor: colors.primary },
          { value: 12, label: 'W4', frontColor: colors.primary },
        ],
        weeklyDistance: [
          { value: 45, dataPointText: '45km' },
          { value: 52, dataPointText: '52km' },
          { value: 38, dataPointText: '38km' },
          { value: 61, dataPointText: '61km' },
        ]
      },
      '3month': {
        rideFrequency: [
          { value: 25, label: 'M1', frontColor: colors.primary },
          { value: 32, label: 'M2', frontColor: colors.primary },
          { value: 28, label: 'M3', frontColor: colors.primary },
        ],
        weeklyDistance: [
          { value: 180, dataPointText: '180km' },
          { value: 220, dataPointText: '220km' },
          { value: 195, dataPointText: '195km' },
        ]
      },
      '6month': {
        rideFrequency: [
          { value: 8, label: 'Jan', frontColor: colors.primary },
          { value: 10, label: 'Feb', frontColor: colors.primary },
          { value: 14, label: 'Mar', frontColor: colors.primary },
          { value: 9, label: 'Apr', frontColor: colors.primary },
          { value: 12, label: 'May', frontColor: colors.primary },
          { value: 15, label: 'Jun', frontColor: colors.primary },
        ],
        weeklyDistance: [
          { value: 120, dataPointText: '120km' },
          { value: 145, dataPointText: '145km' },
          { value: 98, dataPointText: '98km' },
          { value: 178, dataPointText: '178km' },
          { value: 134, dataPointText: '134km' },
          { value: 156, dataPointText: '156km' },
        ]
      },
      '1year': {
        rideFrequency: [
          { value: 15, label: 'Q1', frontColor: colors.primary },
          { value: 22, label: 'Q2', frontColor: colors.primary },
          { value: 18, label: 'Q3', frontColor: colors.primary },
          { value: 25, label: 'Q4', frontColor: colors.primary },
        ],
        weeklyDistance: [
          { value: 320, dataPointText: '320km' },
          { value: 410, dataPointText: '410km' },
          { value: 285, dataPointText: '285km' },
          { value: 465, dataPointText: '465km' },
        ]
      }
    };

    const trailPopularityData = [
      { value: 35, label: 'Secrets', color: '#4CAF50' },
      { value: 25, label: 'Dune', color: '#2196F3' },
      { value: 20, label: 'Coastal', color: '#FFC107' },
      { value: 15, label: 'Forest', color: '#FF5722' },
      { value: 5, label: 'Others', color: '#9E9E9E' },
    ];

    return {
      rideFrequency: baseData[slot].rideFrequency,
      trailPopularity: trailPopularityData,
      weeklyDistance: baseData[slot].weeklyDistance
    };
  };

  useEffect(() => { setChartData(generateDataForTimeSlot(timeSlot)); }, [timeSlot, colors.primary]);

  useEffect(() => { (async () => { try { const stored = await getRides(); setRides(stored); } catch {} })(); }, []);

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
  await ReportDownload.generateAndShareReport({ timeSlot, userStats, chartData, generatedDate: new Date().toISOString() });
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
      day: 'DAY',
      week: 'WEEK',
      month: 'MONTH',
      '3month': '3M',
      '6month': '6M',
      '1year': '1Y'
    };
    return labels[slot];
  };

  const getChartTitle = (baseTitle: string): string => {
    const periods = {
      day: 'Today',
      week: 'This Week',
      month: 'This Month',
      '3month': 'Last 3 Months',
      '6month': 'Last 6 Months',
      '1year': 'This Year'
    };
    return `${baseTitle} (${periods[timeSlot]})`;
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.headerContainer}>
          <View style={styles.titleContainer}>
            <Feather name="bar-chart-2" size={24} color={colors.primary} />
            <ThemedText type="title" style={[styles.title, { color: colors.text }]}>
              Ride Analytics
            </ThemedText>
          </View>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={handleGenerateReport}
              disabled={isGeneratingReport}
            >
              <Feather name="download" size={16} color="white" />
              <Text style={styles.actionButtonText}>
                {isGeneratingReport ? 'Generating...' : 'Export'}
              </Text>
            </TouchableOpacity>
            
            {/*<TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
              onPress={handleEmailReport}
              disabled={isGeneratingReport}
            >
              <Ionicons name="mail-outline" size={16} color="white" />
            </TouchableOpacity>*/}
           
             {/*<TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: '#25D366' }]}
              onPress={handleWhatsAppReport}
              disabled={isGeneratingReport}
            >
              <Ionicons name="logo-whatsapp" size={16} color="white" />
            </TouchableOpacity>*/}
          </View>
        </View>

        {/* Time Slot Selector */}
        <View style={[styles.timeSlotSelector, { backgroundColor: colors.surface }]}>
          {timeSlots.map(slot => (
            <TouchableOpacity 
              key={slot} 
              style={[
                styles.timeSlotButton,
                { 
                  backgroundColor: timeSlot === slot ? colors.primaryContainer : colors.surfaceVariant,
                  borderColor: timeSlot === slot ? colors.primary : 'transparent',
                }
              ]}
              onPress={() => setTimeSlot(slot)}
            >
              <Text style={[
                styles.timeSlotText,
                { 
                  color: timeSlot === slot ? colors.onPrimaryContainer : colors.onSurfaceVariant,
                  fontWeight: timeSlot === slot ? '600' : '400'
                }
              ]}>
                {getTimeSlotLabel(slot)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={[styles.summaryCard, { backgroundColor: colors.surfaceVariant }]}>
            <Feather name="activity" size={24} color={colors.primary} />
            <ThemedText type="defaultSemiBold" style={[styles.summaryValue, { color: colors.onSurface }]}>{userStats.totalRides}</ThemedText>
            <ThemedText style={[styles.summaryLabel, { color: colors.onSurfaceVariant }]}>Total Rides</ThemedText>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: colors.surfaceVariant }]}>
            <Feather name="map" size={24} color={colors.primary} />
            <ThemedText type="defaultSemiBold" style={[styles.summaryValue, { color: colors.onSurface }]}>{userStats.totalDistance}km</ThemedText>
            <ThemedText style={[styles.summaryLabel, { color: colors.onSurfaceVariant }]}>Distance</ThemedText>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: colors.surfaceVariant }]}>
            <Feather name="map-pin" size={24} color={colors.primary} />
            <ThemedText type="defaultSemiBold" style={[styles.summaryValue, { color: colors.onSurface }]}>{userStats.trailsCompleted}</ThemedText>
            <ThemedText style={[styles.summaryLabel, { color: colors.onSurfaceVariant }]}>Trails</ThemedText>
          </View>
        </View>

        {/* Ride Frequency Chart */}
        <ThemedView style={[styles.chartContainer, { backgroundColor: colors.surfaceVariant }]}>
          <ThemedText type="subtitle" style={[styles.chartTitle, { color: colors.onSurface }]}>
            {getChartTitle('Ride Frequency')}
          </ThemedText>
          <BarChart
            barWidth={22}
            noOfSections={4}
            barBorderRadius={4}
            frontColor="lightgrey"
            data={chartData.rideFrequency}
            yAxisThickness={0}
            xAxisThickness={0}
            isAnimated
            animationDuration={1000}
          />
        </ThemedView>

        {/* Trail Popularity Chart */}
        <ThemedView style={[styles.chartContainer, { backgroundColor: colors.surfaceVariant }]}>
          <ThemedText type="subtitle" style={[styles.chartTitle, { color: colors.onSurface }]}>
            Most Popular Trails
          </ThemedText>
          <View style={styles.pieChartContainer}>
            <PieChart
              data={chartData.trailPopularity}
              donut
              showGradient
              sectionAutoFocus
              radius={90}
              innerRadius={60}
              innerCircleColor={colors.surfaceVariant}
              centerLabelComponent={() => (
                <View style={styles.pieCenterLabel}>
                  <ThemedText style={{ fontSize: 14, color: colors.onSurfaceVariant }}>Total</ThemedText>
                  <ThemedText type="defaultSemiBold" style={{ color: colors.onSurface }}>{userStats.totalRides} Rides</ThemedText>
                </View>
              )}
            />
            <View style={styles.pieLegend}>
              {chartData.trailPopularity.map((item, index) => (
                <View key={index} style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: item.color }]} />
                  <ThemedText style={[styles.legendText, { color: colors.onSurfaceVariant }]}>{item.label}: {item.value}%</ThemedText>
                </View>
              ))}
            </View>
          </View>
        </ThemedView>

        {/* Distance Chart */}
        <ThemedView style={[styles.chartContainer, { backgroundColor: colors.surfaceVariant }]}>
          <ThemedText type="subtitle" style={[styles.chartTitle, { color: colors.onSurface }]}>
            {getChartTitle('Distance Progress')}
          </ThemedText>
          <LineChart
            data={chartData.weeklyDistance}
            areaChart
            yAxisThickness={0}
            xAxisThickness={0}
            color={colors.primary}
            startFillColor={colors.primary}
            endFillColor={colors.primary + '20'}
            startOpacity={0.8}
            endOpacity={0.1}
            curved
            isAnimated
            animationDuration={1000}
          />
        </ThemedView>

        {/* Additional Stats */}
        <ThemedView style={[styles.statsContainer, { backgroundColor: colors.surfaceVariant }]}>
          <ThemedText type="subtitle" style={[styles.chartTitle, { color: colors.onSurface }]}>
            Additional Statistics
          </ThemedText>
          <View style={styles.statsGrid}>
            <View style={[styles.statItem, { backgroundColor: colors.surface }]}>
              <Feather name="star" size={20} color={colors.primary} />
              <ThemedText style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>Favorite Trail</ThemedText>
              <ThemedText type="defaultSemiBold" style={{ color: colors.onSurface }}>{userStats.favoriteTrail}</ThemedText>
            </View>
            <View style={[styles.statItem, { backgroundColor: colors.surface }]}>
              <Feather name="clock" size={20} color={colors.primary} />
              <ThemedText style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>Hours Ridden</ThemedText>
              <ThemedText type="defaultSemiBold" style={{ color: colors.onSurface }}>{userStats.hoursRidden}h</ThemedText>
            </View>
            <View style={[styles.statItem, { backgroundColor: colors.surface }]}>
              <Feather name="zap" size={20} color={colors.primary} />
              <ThemedText style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>Avg. Speed</ThemedText>
              <ThemedText type="defaultSemiBold" style={{ color: colors.onSurface }}>{userStats.avgSpeed} km/h</ThemedText>
            </View>
            <View style={[styles.statItem, { backgroundColor: colors.surface }]}>
              <Feather name="calendar" size={20} color={colors.primary} />
              <ThemedText style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>Last Ride</ThemedText>
              <ThemedText type="defaultSemiBold" style={{ color: colors.onSurface }}>{userStats.lastRide}</ThemedText>
            </View>
          </View>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  timeSlotSelector: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 16,
    marginBottom: 20,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  timeSlotButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  timeSlotText: {
    fontSize: 12,
    textAlign: 'center',
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  summaryValue: {
    fontSize: 24,
    marginVertical: 4,
    fontWeight: '600',
  },
  summaryLabel: {
    fontSize: 14,
    marginTop: 4,
  },
  chartContainer: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 18,
    marginBottom: 16,
  },
  pieChartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  pieCenterLabel: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pieLegend: {
    marginLeft: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 14,
  },
  statsContainer: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statItem: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginVertical: 4,
  },
});