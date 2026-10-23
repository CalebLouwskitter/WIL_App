import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getTrailUsageSummaries, type TrailUsageSummary } from '../../services/TrailAnalyticsService';
import { useAppTheme } from '../../hooks/useAppTheme';

const TrailStatsScreen = () => {
  const [summaries, setSummaries] = useState<TrailUsageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation<any>();
  const { palette, isDark } = useAppTheme();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await getTrailUsageSummaries();
        if (mounted) {
          setSummaries(data);
        }
      } catch (error) {
        console.warn('Failed to load trail usage summaries:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const totalDistance = useMemo(() => summaries.reduce((sum, item) => sum + item.totalDistance, 0), [summaries]);
  const totalRides = useMemo(() => summaries.reduce((sum, item) => sum + item.rideCount, 0), [summaries]);
  const maxDistance = useMemo(() => summaries.reduce((max, item) => Math.max(max, item.totalDistance), 0), [summaries]);

  const formatDistance = (meters: number) => `${(meters / 1000).toFixed(2)} km`;

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
        <View style={[styles.header, { backgroundColor: palette.card, borderBottomColor: palette.divider }]}>
          <TouchableOpacity style={styles.headerBack} activeOpacity={0.7} onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={24} color={palette.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: palette.textPrimary }]}>Trail Insights</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.brandPrimary} />
          <Text style={[styles.loadingText, { color: palette.textSecondary }]}>
            Loading trail data from Firebase...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}> 
      <View style={[styles.header, { backgroundColor: palette.card, borderBottomColor: palette.divider }]}> 
        <TouchableOpacity style={styles.headerBack} activeOpacity={0.7} onPress={() => navigation.goBack()} accessibilityLabel="Go back" accessibilityRole="button"> 
          <Feather name="arrow-left" size={24} color={palette.textPrimary} /> 
        </TouchableOpacity> 
        <Text style={[styles.headerTitle, { color: palette.textPrimary }]}>Trail Insights</Text> 
        <View style={styles.headerSpacer} /> 
      </View> 
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}> 
        <View style={styles.metricsRow}> 
          <LinearGradient colors={[palette.brandPrimary, palette.brandPrimaryAlt]} style={styles.metricCard}> 
            <Text style={[styles.metricValue, { color: palette.onPrimary }]}>{totalRides}</Text> 
            <Text style={[styles.metricLabel, { color: palette.onPrimary }]}>Ride Interactions</Text> 
          </LinearGradient> 
          <LinearGradient colors={[palette.caution, palette.caution]} style={styles.metricCard}> 
            <Text style={[styles.metricValue, { color: palette.onPrimary }]}>{formatDistance(totalDistance)}</Text> 
            <Text style={[styles.metricLabel, { color: palette.onPrimary }]}>Total Distance</Text> 
          </LinearGradient> 
        </View> 
        {summaries.length === 0 ? ( 
          <View style={[styles.emptyState, { backgroundColor: palette.card }]}> 
            <Feather name="map" size={40} color={palette.textSecondary} /> 
            <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>No trail activity yet</Text> 
            <Text style={[styles.emptySubtitle, { color: palette.textSecondary }]}>Ride with route tracking to see trail usage.</Text> 
          </View> 
        ) : ( 
          <View style={[styles.list, { backgroundColor: palette.card, borderColor: palette.divider }]}> 
            {summaries.map((item, index) => {
              const widthPercent = maxDistance > 0 ? Math.min(100, Math.max(8, (item.totalDistance / maxDistance) * 100)) : 8;
              return (
                <View
                  key={item.trailId}
                  style={[styles.listItem, index === summaries.length - 1 && styles.lastListItem]}
                >
                  <View style={styles.itemHeader}>
                    <Text style={[styles.trailName, { color: palette.textPrimary }]}>{item.trailName}</Text>
                    <Text style={[styles.trailDistance, { color: palette.textSecondary }]}>{formatDistance(item.totalDistance)}</Text>
                  </View>
                  <View style={[styles.barBackground, { backgroundColor: palette.cardElevated }]}>
                    <View style={[styles.barFill, { width: `${widthPercent}%`, backgroundColor: palette.brandPrimary }]} />
                  </View>
                  <View style={styles.itemMeta}>
                    <View style={styles.metaBadge}> 
                      <Feather name="activity" size={14} color={palette.brandPrimary} /> 
                      <Text style={[styles.metaText, { color: palette.textPrimary }]}>{item.rideCount} rides</Text> 
                    </View> 
                    <View style={styles.metaBadge}> 
                      <Feather name="navigation" size={14} color={palette.caution} /> 
                      <Text style={[styles.metaText, { color: palette.textPrimary }]}>{formatDistance(item.averageDistance)}</Text> 
                    </View> 
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
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
    fontSize: 15,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBack: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 6,
  },
  metricLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  list: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  listItem: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lastListItem: {
    borderBottomWidth: 0,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  trailName: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  trailDistance: {
    fontSize: 14,
    fontWeight: '600',
  },
  barBackground: {
    height: 10,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 12,
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
  },
  itemMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default TrailStatsScreen;