// ObservationsScreen.tsx - View all ride observations with photos
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Feather from 'react-native-vector-icons/Feather';
import { getObservations, deleteObservation, type RideObservation } from '@/services/ObservationStorage';

const { width: screenWidth } = Dimensions.get('window');

interface Props {
  navigation: any;
}

export default function ObservationsScreen({ navigation }: Props) {
  const [observations, setObservations] = useState<RideObservation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'sightings' | 'reports'>('all');

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

  const renderObservationCard = (observation: RideObservation) => {
    const hasSighting = !!observation.sighting;
    const hasReport = !!observation.report;

    return (
      <View key={observation.id} style={styles.card}>
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.9)']}
          style={styles.cardGradient}
        >
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              {hasSighting && (
                <View style={[styles.badge, styles.sightingBadge]}>
                  <Text style={styles.badgeText}>🦌 Wildlife</Text>
                </View>
              )}
              {hasReport && (
                <View style={[styles.badge, styles.reportBadge]}>
                  <Text style={styles.badgeText}>⚠️ Report</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={() => handleDelete(observation.id)}
              style={styles.deleteButton}
            >
              <Feather name="trash-2" size={18} color="#C73E1D" />
            </TouchableOpacity>
          </View>

          {/* Timestamp */}
          <Text style={styles.timestamp}>{formatDate(observation.timestamp)}</Text>

          {/* Wildlife Sighting Details */}
          {hasSighting && observation.sighting && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Wildlife Sighting</Text>
              <Text style={styles.wildlifeType}>{observation.sighting.wildlifeType}</Text>
              {observation.sighting.notes && (
                <Text style={styles.notes}>{observation.sighting.notes}</Text>
              )}
              {observation.sighting.photoUri && (
                <View style={styles.photoContainer}>
                  <Image
                    source={{ uri: observation.sighting.photoUri }}
                    style={styles.photo}
                    resizeMode="cover"
                  />
                </View>
              )}
              {observation.sighting.location && (
                <View style={styles.locationRow}>
                  <Feather name="map-pin" size={14} color="#8A8A8A" />
                  <Text style={styles.locationText}>
                    {observation.sighting.location.latitude.toFixed(5)}, 
                    {observation.sighting.location.longitude.toFixed(5)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Trail Report Details */}
          {hasReport && observation.report && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Trail Report</Text>
              <View style={styles.issueRow}>
                <Text style={styles.issueType}>{observation.report.issueType}</Text>
                <View style={[styles.severityBadge, getSeverityStyle(observation.report.severity)]}>
                  <Text style={styles.severityText}>{observation.report.severity.toUpperCase()}</Text>
                </View>
              </View>
              {observation.report.notes && (
                <Text style={styles.notes}>{observation.report.notes}</Text>
              )}
              {observation.report.location && (
                <View style={styles.locationRow}>
                  <Feather name="map-pin" size={14} color="#8A8A8A" />
                  <Text style={styles.locationText}>
                    {observation.report.location.latitude.toFixed(5)}, 
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

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'critical':
        return { backgroundColor: '#C73E1D' };
      case 'high':
        return { backgroundColor: '#F59E0B' };
      case 'medium':
        return { backgroundColor: '#3B82F6' };
      default:
        return { backgroundColor: '#10B981' };
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#2C5530', '#1C3A1F']}
        style={styles.header}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ride Observations</Text>
        <View style={styles.placeholder} />
      </LinearGradient>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All ({observations.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'sightings' && styles.filterTabActive]}
          onPress={() => setFilter('sightings')}
        >
          <Text style={[styles.filterText, filter === 'sightings' && styles.filterTextActive]}>
            Wildlife ({observations.filter(o => o.sighting).length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'reports' && styles.filterTabActive]}
          onPress={() => setFilter('reports')}
        >
          <Text style={[styles.filterText, filter === 'reports' && styles.filterTextActive]}>
            Reports ({observations.filter(o => o.report).length})
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
            <Feather name="eye-off" size={64} color="#E5E5E5" />
            <Text style={styles.emptyTitle}>No Observations Yet</Text>
            <Text style={styles.emptyText}>
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
    backgroundColor: '#FAF9F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  placeholder: {
    width: 40,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  filterTabActive: {
    backgroundColor: '#2C5530',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8A8A8A',
  },
  filterTextActive: {
    color: 'white',
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
    shadowColor: '#000',
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
  sightingBadge: {
    backgroundColor: '#E8F5E9',
  },
  reportBadge: {
    backgroundColor: '#FFEBE6',
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
    color: '#8A8A8A',
    marginBottom: 12,
  },
  section: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C5530',
    marginBottom: 8,
  },
  wildlifeType: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
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
    color: '#1A1A1A',
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'white',
  },
  notes: {
    fontSize: 14,
    color: '#5A5A5A',
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
    backgroundColor: '#F5F5F5',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  locationText: {
    fontSize: 12,
    color: '#8A8A8A',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#8A8A8A',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
});
