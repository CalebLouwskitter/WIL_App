import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getTrailUsageSummaries, type TrailUsageSummary } from '../../services/TrailAnalyticsService';
import { resolvePalette } from '../../constants/colors';

const TrailStatsScreen = () => {
  const [summaries, setSummaries] = useState<TrailUsageSummary[]>([]);
  const navigation = useNavigation<any>();
  const colorScheme = useColorScheme();
  const theme = resolvePalette(colorScheme);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await getTrailUsageSummaries();
        if (mounted) {
          setSummaries(data);
        }
      } catch (error) {
        console.warn('Failed to load trail usage summaries:', error);
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundLight }]}> 
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.borderMuted }]}> 
        <TouchableOpacity style={styles.headerBack} activeOpacity={0.7} onPress={() => navigation.goBack()}> 
          <Feather name="arrow-left" size={24} color={theme.onSurface} /> 
        </TouchableOpacity> 
        <Text style={[styles.headerTitle, { color: theme.onSurface }]}>Trail Insights</Text> 
        <View style={styles.headerSpacer} /> 
      </View> 
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}> 
        <View style={styles.metricsRow}> 
          <LinearGradient colors={[theme.brandPrimary, theme.brandPrimaryAlt]} style={styles.metricCard}> 
            <Text style={[styles.metricValue, { color: theme.onPrimary }]}>{totalRides}</Text> 
            <Text style={[styles.metricLabel, { color: theme.onPrimary }]}>Ride Interactions</Text> 
          </LinearGradient> 
          <LinearGradient colors={[theme.brandSecondary, theme.brandSecondary]} style={styles.metricCard}> 
            <Text style={[styles.metricValue, { color: theme.onPrimary }]}>{formatDistance(totalDistance)}</Text> 
            <Text style={[styles.metricLabel, { color: theme.onPrimary }]}>Total Distance</Text> 
          </LinearGradient> 
        </View> 
        {summaries.length === 0 ? ( 
          <View style={[styles.emptyState, { backgroundColor: theme.surface }]}> 
            <Feather name="map" size={40} color={theme.onSurfaceVariant} /> 
            <Text style={[styles.emptyTitle, { color: theme.onSurface }]}>No trail activity yet</Text> 
            <Text style={[styles.emptySubtitle, { color: theme.onSurfaceVariant }]}>Ride with route tracking to see trail usage.</Text> 
          </View> 
        ) : ( 
          <View style={[styles.list, { backgroundColor: theme.surface, borderColor: theme.borderMuted }]}> 
            {summaries.map((item, index) => {
              const widthPercent = maxDistance > 0 ? Math.min(100, Math.max(8, (item.totalDistance / maxDistance) * 100)) : 8;
              return (
                <View
                  key={item.trailId}
                  style={[styles.listItem, index === summaries.length - 1 && styles.lastListItem]}
                >
                  <View style={styles.itemHeader}>
                    <Text style={[styles.trailName, { color: theme.onSurface }]}>{item.trailName}</Text>
                    <Text style={[styles.trailDistance, { color: theme.onSurfaceVariant }]}>{formatDistance(item.totalDistance)}</Text>
                  </View>
                  <View style={[styles.barBackground, { backgroundColor: theme.surfaceVariant }]}>
                    <View style={[styles.barFill, { width: `${widthPercent}%`, backgroundColor: theme.brandPrimary }]} />
                  </View>
                  <View style={styles.itemMeta}>
                    <View style={styles.metaBadge}> 
                      <Feather name="activity" size={14} color={theme.brandPrimary} /> 
                      <Text style={[styles.metaText, { color: theme.onSurface }]}>{item.rideCount} rides</Text> 
                    </View> 
                    <View style={styles.metaBadge}> 
                      <Feather name="navigation" size={14} color={theme.brandSecondary} /> 
                      <Text style={[styles.metaText, { color: theme.onSurface }]}>{formatDistance(item.averageDistance)}</Text> 
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
