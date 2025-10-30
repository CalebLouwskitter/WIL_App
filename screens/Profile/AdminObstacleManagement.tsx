import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Feather } from '@expo/vector-icons';

import { useCurrentUser } from '../../hooks/useCurrentUser';
import {
  getObstacles,
  type Obstacle,
  updateObstacleStatus,
  removeObstacle,
  subscribeToObstacles,
} from '../../services/ObstacleService';
import { type ObstacleStatus } from '../../services/Data';
import type { ProfileStackParamList } from '../../navigation/ProfileStack';

const FILTERS: { label: string; value: ObstacleStatus | 'all' }[] = [
  { label: 'Active', value: 'active' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'All', value: 'all' },
];

type AdminObstacleNavigationProp = StackNavigationProp<ProfileStackParamList, 'AdminObstacleManagement'>;

export default function AdminObstacleManagement() {
  const navigation = useNavigation<AdminObstacleNavigationProp>();
  const { profile, loading: profileLoading } = useCurrentUser();
  const [filter, setFilter] = useState<typeof FILTERS[number]['value']>('active');
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [operationLoading, setOperationLoading] = useState<string | null>(null);
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(true);

  useEffect(() => {
    // Wait for profile to finish loading
    if (!profileLoading) {
      if (profile === null) {
        // Not authenticated: navigate back
        Alert.alert('Access denied', 'You must be logged in to view this screen.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else if (profile.role !== 'admin') {
        // Authenticated but not admin: navigate back
        Alert.alert('Access denied', 'You do not have permission to view this screen.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    }
  }, [profile, profileLoading, navigation]);

  const loadObstacles = useCallback(async () => {
    try {
      setLoading(true);
      const status = filter === 'all' ? undefined : (filter as ObstacleStatus);
      const data = await getObstacles({ status });
      setObstacles(data);
    } catch (error) {
      console.warn('[AdminObstacleManagement] Failed to load obstacles', error);
      Alert.alert('Error', 'Could not load obstacles.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    // Set up real-time subscription
    let unsubscribe: (() => void) | null = null;
    
    if (isRealTimeEnabled && profile && profile.role === 'admin') {
      try {
        const status = filter === 'all' ? undefined : (filter as ObstacleStatus);
        unsubscribe = subscribeToObstacles((newObstacles) => {
          setObstacles(newObstacles);
          setLoading(false);
        }, { status });
        
        console.log('[AdminObstacleManagement] Real-time subscription enabled');
      } catch (error) {
        console.warn('[AdminObstacleManagement] Failed to set up real-time subscription:', error);
        setIsRealTimeEnabled(false);
        // Fallback to manual loading
        loadObstacles();
      }
    } else {
      // Manual refresh mode
      loadObstacles();
      // Set up periodic refresh as fallback
      const interval = setInterval(() => {
        console.log('[AdminObstacleManagement] Periodic refresh');
        loadObstacles();
      }, 30000); // Refresh every 30 seconds
      
      return () => clearInterval(interval);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
        console.log('[AdminObstacleManagement] Real-time subscription cleaned up');
      }
    };
  }, [filter, isRealTimeEnabled, loadObstacles, profile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    
    if (isRealTimeEnabled) {
      // In real-time mode, just trigger a manual fetch once
      try {
        const status = filter === 'all' ? undefined : (filter as ObstacleStatus);
        const data = await getObstacles({ status });
        setObstacles(data);
      } catch (error) {
        console.warn('[AdminObstacleManagement] Manual refresh failed:', error);
      }
    } else {
      await loadObstacles();
    }
    
    setRefreshing(false);
  }, [loadObstacles, filter, isRealTimeEnabled]);

  const handleUpdateStatus = useCallback(
    async (obstacle: Obstacle, nextStatus: ObstacleStatus) => {
      const actionLabel = nextStatus === 'resolved' ? 'mark this obstacle as resolved' : 'mark this obstacle as active';
      Alert.alert('Confirm', `Are you sure you want to ${actionLabel}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            setOperationLoading(obstacle.id);
            try {
              await updateObstacleStatus(obstacle.id, nextStatus);
              setObstacles((prev) =>
                prev.map((item) =>
                  item.id === obstacle.id
                    ? { ...item, status: nextStatus, resolvedAt: nextStatus === 'resolved' ? Date.now() : item.resolvedAt }
                    : item,
                ),
              );
              if (nextStatus === 'resolved') {
                Alert.alert('Success', 'Obstacle marked as resolved. It will no longer appear on active maps.');
              } else {
                Alert.alert('Success', 'Obstacle marked as active and will appear on maps.');
              }
            } catch (error) {
              console.warn('[AdminObstacleManagement] Failed to update obstacle status', error);
              Alert.alert('Error', 'Failed to update obstacle status.');
            } finally {
              setOperationLoading(null);
            }
          },
        },
      ]);
    },
    [],
  );

  const handleDelete = useCallback((obstacle: Obstacle) => {
    Alert.alert(
      'Delete obstacle',
      'This will permanently remove the obstacle for all users. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setOperationLoading(obstacle.id);
            try {
              await removeObstacle(obstacle.id);
              setObstacles((prev) => prev.filter((o) => o.id !== obstacle.id));
              Alert.alert('Deleted', 'Obstacle removed.');
            } catch (e) {
              console.warn('[AdminObstacleManagement] Failed to delete obstacle', e);
              Alert.alert('Error', 'Failed to delete obstacle.');
            } finally {
              setOperationLoading(null);
            }
          },
        },
      ],
    );
  }, []);

  const styles = useMemo(() => createStyles(), []);

  const renderObstacle = ({ item }: { item: Obstacle }) => {
    const severityColor = getSeverityColor(item.severity);
    const isActive = item.status === 'active';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconContainer, { backgroundColor: `${severityColor}22` }]}>
            <Feather name={getObstacleIcon(item.type)} size={22} color={severityColor} />
          </View>
          <View style={styles.cardTitleContainer}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardSubtitle}>{item.type}</Text>
          </View>
          <View style={[styles.statusPill, isActive ? styles.activePill : styles.resolvedPill]}>
            <Text style={styles.statusPillText}>{item.status}</Text>
          </View>
        </View>

        {item.description ? <Text style={styles.description}>{item.description}</Text> : null}

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Feather name="user" size={14} color="#6B7280" />
            <Text style={styles.metaText}>{item.userName ?? 'Anonymous'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="clock" size={14} color="#6B7280" />
            <Text style={styles.metaText}>{formatDate(item.reportedAt)}</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          {isActive ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.resolveButton]}
              onPress={() => handleUpdateStatus(item, 'resolved')}
            >
              <Feather name="check-circle" size={18} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Mark Resolved</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.reopenButton]}
              onPress={() => handleUpdateStatus(item, 'active')}
            >
              <Feather name="rotate-ccw" size={18} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Reopen</Text>
            </TouchableOpacity>
          )}
          <View style={{ width: 8 }} />
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDelete(item)}
          >
            <Feather name="trash-2" size={18} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Show loading while profile is being fetched
  if (profileLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            accessibilityLabel="Go back"
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          >
            <View style={styles.iconButton}>
              <Ionicons name="chevron-back" size={24} color="#111" />
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.title}>Obstacle Management</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusIndicator, isRealTimeEnabled ? styles.statusLive : styles.statusManual]} />
              <Text style={styles.statusText}>
                {isRealTimeEnabled ? 'Live Updates' : 'Manual Refresh'}
              </Text>
            </View>
          </View>
          <View style={{ width: 48 }} />
        </View>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={{ marginTop: 16, color: '#6B7280' }}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        >
          <View style={styles.iconButton}>
            <Ionicons name="chevron-back" size={24} color="#111" />
          </View>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title}>Obstacle Management</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusIndicator, isRealTimeEnabled ? styles.statusLive : styles.statusManual]} />
            <Text style={styles.statusText}>
              {isRealTimeEnabled ? 'Live Updates' : 'Manual Refresh'}
            </Text>
          </View>
        </View>
        <View style={{ width: 48 }} />
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((option) => {
          const selected = option.value === filter;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.filterButton, selected && styles.filterButtonActive]}
              onPress={() => setFilter(option.value)}
            >
              <Text style={[styles.filterButtonText, selected && styles.filterButtonTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <FlatList
          data={obstacles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={obstacles.length ? styles.listContent : styles.emptyContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={renderObstacle}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="check" size={42} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>No obstacles here</Text>
              <Text style={styles.emptySubtitle}>
                {filter === 'active'
                  ? 'All clear! There are no active obstacles at the moment.'
                  : 'No obstacles match this filter.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function formatDate(timestamp: number) {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

function getObstacleIcon(type: string): keyof typeof Feather.glyphMap {
  switch (type) {
    case 'pothole':
      return 'alert-triangle';
    case 'debris':
      return 'trash-2';
    case 'animal':
      return 'eye';
    case 'tree':
      return 'wind';
    case 'water':
      return 'droplet';
    default:
      return 'alert-circle';
  }
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'critical':
      return '#DC2626';
    case 'high':
      return '#EA580C';
    case 'medium':
      return '#F59E0B';
    case 'low':
      return '#10B981';
    default:
      return '#6B7280';
  }
}

function createStyles() {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#F4F7FE',
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      paddingTop: 8,
    },
    backButton: {
      alignItems: 'flex-start',
      justifyContent: 'center',
      minHeight: 48,
      minWidth: 48,
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: '#111827',
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
      gap: 6,
    },
    statusIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    statusLive: {
      backgroundColor: '#10B981',
    },
    statusManual: {
      backgroundColor: '#F59E0B',
    },
    statusText: {
      fontSize: 12,
      fontWeight: '500',
      color: '#6B7280',
    },
    filterRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    filterButton: {
      flex: 1,
      paddingVertical: 10,
      marginHorizontal: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#D1D5DB',
      alignItems: 'center',
    },
    filterButtonActive: {
      backgroundColor: '#2563eb',
      borderColor: '#2563eb',
    },
    filterButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#4B5563',
    },
    filterButtonTextActive: {
      color: '#FFFFFF',
    },
    loading: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    listContent: {
      paddingBottom: 24,
    },
    emptyContent: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    card: {
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      shadowColor: '#00000010',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 3,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    iconContainer: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    cardTitleContainer: {
      flex: 1,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: '#111827',
    },
    cardSubtitle: {
      fontSize: 13,
      color: '#6B7280',
      textTransform: 'capitalize',
    },
    statusPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    activePill: {
      backgroundColor: '#2563eb1A',
    },
    resolvedPill: {
      backgroundColor: '#10B9811A',
    },
    statusPillText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#1F2937',
      textTransform: 'capitalize',
    },
    description: {
      fontSize: 14,
      color: '#4B5563',
      marginBottom: 12,
    },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    metaText: {
      fontSize: 13,
      color: '#6B7280',
    },
    actionsRow: {
      flexDirection: 'row',
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 10,
      borderRadius: 8,
      flex: 1,
    },
    resolveButton: {
      backgroundColor: '#2563eb',
    },
    reopenButton: {
      backgroundColor: '#6B7280',
    },
    actionButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '600',
    },
    deleteButton: {
      backgroundColor: '#DC2626',
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 24,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: '#1F2937',
    },
    emptySubtitle: {
      fontSize: 14,
      color: '#6B7280',
      textAlign: 'center',
    },
  });
}
