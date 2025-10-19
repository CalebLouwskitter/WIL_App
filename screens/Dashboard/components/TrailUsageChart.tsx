import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getRides } from '../../../services/RideStorage';

type MonthlyData = {
  month: string;
  rides: number;
};

export const TrailUsageChart: React.FC = () => {
  const navigation = useNavigation<any>();
  const [chartData, setChartData] = useState<MonthlyData[]>([]);
  const [trend, setTrend] = useState(0);

  useEffect(() => {
    loadChartData();
  }, []);

  const loadChartData = async () => {
    try {
      const rides = await getRides();
      
      // Calculate rides per month for last 7 months
      const now = new Date();
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthlyRides: MonthlyData[] = [];

      for (let i = 6; i >= 0; i--) {
        const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = months[targetDate.getMonth()];
        
        const ridesInMonth = rides.filter((ride) => {
          const rideDate = new Date(ride.startTime);
          return (
            rideDate.getMonth() === targetDate.getMonth() &&
            rideDate.getFullYear() === targetDate.getFullYear()
          );
        }).length;

        monthlyRides.push({ month: monthName, rides: ridesInMonth });
      }

      setChartData(monthlyRides);

      // Calculate trend (compare last month to previous month)
      if (monthlyRides.length >= 2) {
        const lastMonth = monthlyRides[monthlyRides.length - 1].rides;
        const previousMonth = monthlyRides[monthlyRides.length - 2].rides;
        const trendPercent = previousMonth > 0
          ? Math.round(((lastMonth - previousMonth) / previousMonth) * 100)
          : 0;
        setTrend(trendPercent);
      }
    } catch (error) {
      console.warn('Failed to load chart data:', error);
    }
  };

  const handleDetails = () => {
    navigation.navigate('Analytics');
  };

  const maxRides = Math.max(...chartData.map((d) => d.rides), 1);

  return (
    <View style={styles.container}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>Trail Usage</Text>
        <Text style={[styles.chartTrend, trend < 0 && styles.chartTrendNegative]}>
          {trend > 0 ? '📈' : trend < 0 ? '📉' : '➡️'} {Math.abs(trend)}%
        </Text>
      </View>

      <View style={styles.chartBars}>
        {chartData.map((data, index) => {
          const height = maxRides > 0 ? (data.rides / maxRides) * 60 : 0;
          return (
            <View
              key={index}
              style={[styles.chartBar, { height: Math.max(height, 2) }]}
            />
          );
        })}
      </View>

      <View style={styles.chartLabels}>
        {chartData.map((data, index) => (
          <Text key={index} style={styles.chartLabel}>
            {data.month}
          </Text>
        ))}
      </View>

      <TouchableOpacity style={styles.detailsButton} onPress={handleDetails}>
        <Text style={styles.detailsText}>Details</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 8,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  chartTrend: {
    fontSize: 10,
    color: '#16a34a',
  },
  chartTrendNegative: {
    color: '#ef4444',
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 60,
    marginBottom: 8,
    gap: 2,
  },
  chartBar: {
    flex: 1,
    backgroundColor: '#3b82f6',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  chartLabel: {
    fontSize: 10,
    color: '#6b7280',
  },
  detailsButton: {
    alignItems: 'center',
  },
  detailsText: {
    color: '#3b82f6',
    fontSize: 14,
  },
});
