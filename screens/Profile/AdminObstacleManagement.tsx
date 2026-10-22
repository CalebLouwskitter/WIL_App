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
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { useAppTheme, type AppPalette } from '../../hooks/useAppTheme';

const FILTERS: { label: string; value: ObstacleStatus | 'all' }[] = [
  { label: 'Active', value: 'active' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'All', value: 'all' },
];

type AdminObstacleNavigationProp = StackNavigationProp<ProfileStackParamList, 'AdminObstacleManagement'>;

export default function AdminObstacleManagement() {
  const navigation = useNavigation<AdminObstacleNavigationProp>();
  const { palette, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(palette, isDark), [palette, isDark]);
  const { profile, loading: profileLoading } = useCurrentUser();
  const [filter, setFilter] = useState<typeof FILTERS[number]['value']>('active');
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [operationLoading, setOperationLoading] = useState<string | null>(null);
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(true);

  useEffect(() => {
    if (!profileLoading) {
      if (profile === null) {
        Alert.alert('Access denied', 'You must be logged in to view this screen.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else if (profile.role !== 'admin') {
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
        loadObstacles();
      }
    } else {
      loadObstacles();
      const interval = setInterval(() => {
        console.log('[AdminObstacleManagement] Periodic refresh');
        loadObstacles();
      }, 30000);

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

  const renderObstacle = ({ item }: { item: Obstacle }) => {
    const severityColor = getSeverityColor(item.severity, palette);
    const isActive = item.status === 'active';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : `${severityColor}22` }]}>
            <Feather name={getObstacleIcon(item.type)} size={22} color={severityColor} />
          </View>
          <View style={styles.cardTitleContainer}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardSubtitle}>{item.type}</Text>
          </View>
          <View style={[styles.statusPill, isActive ? styles.activePill : styles.resolvedPill]}>
            <Text style={[styles.statusPillText, isActive ? styles.activePillText : styles.resolvedPillText]}>
              {item.status}
            </Text>
          </View>
        </View>

        {item.description ? <Text style={styles.description}>{item.description}</Text> : null}

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Feather name="user" size={14} color={palette.textSecondary} />
            <Text style={styles.metaText}>{item.userName ?? 'Anonymous'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="clock" size={14} color={palette.textSecondary} />
            <Text style={styles.metaText}>{formatDate(item.reportedAt)}</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          {isActive ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.resolveButton]}
              onPress={() => handleUpdateStatus(item, 'resolved')}
            >
              <Feather name="check-circle" size={18} color={palette.onPrimary} />
              <Text style={styles.actionButtonText}>Mark Resolved</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.reopenButton]}
              onPress={() => handleUpdateStatus(item, 'active')}
            >
              <Feather name="rotate-ccw" size={18} color={palette.onPrimary} />
              <Text style={styles.actionButtonText}>Reopen</Text>
            </TouchableOpacity>
          )}
          <View style={{ width: 8 }} />
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDelete(item)}
          >
            <Feather name="trash-2" size={18} color={palette.onPrimary} />
            <Text style={styles.actionButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

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
              <Ionicons name="chevron-back" size={24} color={palette.textPrimary} />
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
          <ActivityIndicator size="large" color={palette.brandPrimary} />
          <Text style={{ marginTop: 16, color: palette.textSecondary }}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        >
          <View style={styles.iconButton}>
            <Ionicons name="chevron-back" size={24} color={palette.textPrimary} />
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
          <ActivityIndicator size="large" color={palette.brandPrimary} />
        </View>
      ) : (
        <FlatList
          data={obstacles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={obstacles.length ? styles.listContent : styles.emptyContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.brandPrimary} colors={[palette.brandPrimary]} />}
          renderItem={renderObstacle}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="check" size={42} color={palette.textMuted} />
              <Text style={styles.emptyTitle}>No obstacles here</Text>
              <Text style={styles.emptySubtitle}>
                {filter === 'active'
                  ? 'No active obstacles reported.'
                  : 'No obstacles match this filter.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
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

function getSeverityColor(severity: string, palette: AppPalette) {
  switch (severity) {
    case 'critical':
      return palette.danger;
    case 'high':
      return palette.caution;
    case 'medium':
      return palette.brandSecondary;
    case 'low':
      return palette.success;
    default:
      return palette.textSecondary;
  }
}

function createStyles(palette: AppPalette, isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 50,
      paddingBottom: 16,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: palette.card,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: palette.shadowStrong,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: palette.card,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: palette.shadowStrong,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: palette.textPrimary,
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
      backgroundColor: palette.success,
    },
    statusManual: {
      backgroundColor: palette.caution,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '500',
      color: palette.textSecondary,
    },
    filterRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    filterButton: {
      flex: 1,
      paddingVertical: 10,
      marginHorizontal: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: palette.divider,
      backgroundColor: palette.card,
      alignItems: 'center',
    },
    filterButtonActive: {
      backgroundColor: palette.brandPrimary,
      borderColor: palette.brandPrimary,
    },
    filterButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: palette.textSecondary,
    },
    filterButtonTextActive: {
      color: palette.onPrimary,
    },
    loading: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: palette.background,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    emptyContent: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    card: {
      backgroundColor: palette.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      shadowColor: palette.shadowStrong,
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
      color: palette.textPrimary,
    },
    cardSubtitle: {
      fontSize: 13,
      color: palette.textSecondary,
      textTransform: 'capitalize',
    },
    statusPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    activePill: {
      backgroundColor: palette.brandSoft,
    },
    activePillText: {
      color: palette.brandPrimary,
    },
    resolvedPill: {
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.18)' : '#D1FAE5',
    },
    resolvedPillText: {
      color: palette.success,
    },
    statusPillText: {
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    description: {
      fontSize: 14,
      color: palette.textSecondary,
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
      color: palette.textSecondary,
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
      backgroundColor: palette.brandPrimary,
    },
    reopenButton: {
      backgroundColor: palette.textSecondary,
    },
    actionButtonText: {
      color: palette.onPrimary,
      fontSize: 15,
      fontWeight: '600',
    },
    deleteButton: {
      backgroundColor: palette.danger,
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
      color: palette.textPrimary,
    },
    emptySubtitle: {
      fontSize: 14,
      color: palette.textSecondary,
      textAlign: 'center',
    },
  });
}
