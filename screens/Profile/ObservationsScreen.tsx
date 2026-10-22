// ObservationsScreen.tsx - View all ride observations with photos
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Feather from 'react-native-vector-icons/Feather';
import { useAppTheme } from '../../hooks/useAppTheme';
import ScreenHeader from '../../components/ScreenHeader';
import { getObservations, deleteObservation, type RideObservation } from '@/services/ObservationStorage';

interface Props {
  navigation: any;
}

export default function ObservationsScreen({ navigation }: Props) {
  const [observations, setObservations] = useState<RideObservation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'sightings' | 'reports'>('all');
  const { palette, isDark } = useAppTheme();

  const loadObservations = async () => {
    try {
      const data = await getObservations();
      // Sort by timestamp descending (newest first)
      setObservations(data.sort((a, b) => b.timestamp - a.timestamp));
    } catch (error) {
      console.error('Error loading observations:', error);
      Alert.alert('Error', 'Failed to load observations');
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadObservations();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadObservations();
    setRefreshing(false);
  };

  const handleDelete = (observationId: string) => {
    Alert.alert(
      'Delete Observation?',
      'Are you sure you want to delete this observation? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteObservation(observationId);
              await loadObservations();
              Alert.alert('Success', 'Observation deleted');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete observation');
            }
          },
        },
      ]
    );
  };

  const filteredObservations = observations.filter((obs) => {
    if (filter === 'sightings') return !!obs.sighting;
    if (filter === 'reports') return !!obs.report;
    return true;
  });

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'critical':
        return { backgroundColor: palette.obstacleCritical };
      case 'high':
        return { backgroundColor: palette.obstacleHigh };
      case 'medium':
        return { backgroundColor: palette.obstacleMedium };
      default:
        return { backgroundColor: palette.obstacleLow };
    }
  };

  const renderObservationCard = (observation: RideObservation) => {
    const hasSighting = !!observation.sighting;
    const hasReport = !!observation.report;

    return (
      <View key={observation.id} style={[styles.card, { backgroundColor: palette.card, shadowColor: palette.shadow }]}>
        <LinearGradient
          colors={[palette.card, palette.card]}
          style={styles.cardGradient}
        >
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              {hasSighting && (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : '#E8F5E9' },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: palette.success }]}>🦌 Wildlife</Text>
                </View>
              )}
              {hasReport && (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FFEBE6' },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: palette.danger }]}>⚠️ Report</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={() => handleDelete(observation.id)}
              style={styles.deleteButton}
              accessibilityRole="button"
              accessibilityLabel="Delete observation"
            >
              <Feather name="trash-2" size={18} color={palette.danger} />
            </TouchableOpacity>
          </View>

          {/* Timestamp */}
          <Text style={[styles.timestamp, { color: palette.textMuted }]}>
            {formatDate(observation.timestamp)}
          </Text>

          {/* Wildlife Sighting Details */}
          {hasSighting && observation.sighting && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: palette.brandPrimary }]}>Wildlife Sighting</Text>
              <Text style={[styles.wildlifeType, { color: palette.textPrimary }]}>
                {observation.sighting.wildlifeType}
              </Text>
              {observation.sighting.notes && (
                <Text style={[styles.notes, { color: palette.textSecondary }]}>
                  {observation.sighting.notes}
                </Text>
              )}
              {observation.sighting.photoUri && (
                <View style={styles.photoContainer}>
                  <Image
                    source={{ uri: observation.sighting.photoUri }}
                    style={[styles.photo, { backgroundColor: palette.divider }]}
                    resizeMode="cover"
                  />
                </View>
              )}
              {observation.sighting.location && (
                <View style={styles.locationRow}>
                  <Feather name="map-pin" size={14} color={palette.textMuted} />
                  <Text style={[styles.locationText, { color: palette.textMuted }]}>
                    {observation.sighting.location.latitude.toFixed(5)},{' '}
                    {observation.sighting.location.longitude.toFixed(5)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Trail Report Details */}
          {hasReport && observation.report && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: palette.brandPrimary }]}>Trail Report</Text>
              <View style={styles.issueRow}>
                <Text style={[styles.issueType, { color: palette.textPrimary }]}>
                  {observation.report.issueType}
                </Text>
                <View style={[styles.severityBadge, getSeverityStyle(observation.report.severity)]}>
                  <Text style={[styles.severityText, { color: palette.onPrimary }]}>
                    {observation.report.severity.toUpperCase()}
                  </Text>
                </View>
              </View>
              {observation.report.notes && (
                <Text style={[styles.notes, { color: palette.textSecondary }]}>
                  {observation.report.notes}
                </Text>
              )}
              {observation.report.trailName && (
                <View style={styles.trailRow}>
                  <Feather name="map" size={14} color={palette.brandPrimary} />
                  <Text style={[styles.trailLabel, { color: palette.brandPrimary }]}>Trail:</Text>
                  <Text style={[styles.trailValue, { color: palette.textPrimary }]}>
                    {observation.report.trailName}
                  </Text>
                </View>
              )}
              {observation.report.location && (
                <View style={styles.locationRow}>
                  <Feather name="map-pin" size={14} color={palette.textMuted} />
                  <Text style={[styles.locationText, { color: palette.textMuted }]}>
                    {observation.report.location.latitude.toFixed(5)},{' '}
                    {observation.report.location.longitude.toFixed(5)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </LinearGradient>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <ScreenHeader title="Ride Observations" onBack={() => navigation.goBack()} />

      {/* Filter Tabs */}
      <View
        style={[
          styles.filterContainer,
          { backgroundColor: palette.card, borderBottomColor: palette.divider },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.filterTab,
            { backgroundColor: filter === 'all' ? palette.brandSoft : palette.card },
          ]}
          onPress={() => setFilter('all')}
          accessibilityRole="tab"
          accessibilityState={{ selected: filter === 'all' }}
        >
          <Text
            style={[
              styles.filterText,
              { color: filter === 'all' ? palette.brandPrimary : palette.textSecondary },
            ]}
          >
            All ({observations.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterTab,
            { backgroundColor: filter === 'sightings' ? palette.brandSoft : palette.card },
          ]}
          onPress={() => setFilter('sightings')}
          accessibilityRole="tab"
          accessibilityState={{ selected: filter === 'sightings' }}
        >
          <Text
            style={[
              styles.filterText,
              { color: filter === 'sightings' ? palette.brandPrimary : palette.textSecondary },
            ]}
          >
            Wildlife ({observations.filter((o) => o.sighting).length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterTab,
            { backgroundColor: filter === 'reports' ? palette.brandSoft : palette.card },
          ]}
          onPress={() => setFilter('reports')}
          accessibilityRole="tab"
          accessibilityState={{ selected: filter === 'reports' }}
        >
          <Text
            style={[
              styles.filterText,
              { color: filter === 'reports' ? palette.brandPrimary : palette.textSecondary },
            ]}
          >
            Reports ({observations.filter((o) => o.report).length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredObservations.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="eye-off" size={64} color={palette.textMuted} />
            <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>No Observations Yet</Text>
            <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
              Your wildlife sightings and trail reports will appear here
            </Text>
          </View>
        ) : (
          filteredObservations.map(renderObservationCard)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  card: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardGradient: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 8,
  },
  timestamp: {
    fontSize: 12,
    marginBottom: 12,
  },
  section: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  wildlifeType: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  issueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  issueType: {
    fontSize: 16,
    fontWeight: '700',
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  notes: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  photoContainer: {
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: 200,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  trailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  trailLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  trailValue: {
    fontSize: 13,
  },
  locationText: {
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
});
