import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableWithoutFeedback,
  useColorScheme,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { getObstacles, type Obstacle } from '../../services/ObstacleService';

type Props = {
  visible: boolean;
  onClose: () => void;
  onRequestNotificationsScreen?: () => void;
};

const NotificationsModal: React.FC<Props> = ({ visible, onClose, onRequestNotificationsScreen }) => {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const palette = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('active');

  const styles = useMemo(() => createStyles(palette, insets), [palette, insets]);

  useEffect(() => {
    if (!visible) return;

    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const status = filter === 'all' ? undefined : filter;
        const data = await getObstacles({ status, limit: 50 });
        if (mounted) setObstacles(data);
      } catch {
        if (mounted) setObstacles([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [visible, filter]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const status = filter === 'all' ? undefined : filter;
      const data = await getObstacles({ status, limit: 50 });
      setObstacles(data);
    } finally {
      setRefreshing(false);
    }
  };

  const renderObstacleCard = (obstacle: Obstacle) => {
    const severityColor = getSeverityColor(obstacle.severity, palette);
    return (
      <View
        key={obstacle.id}
        style={[styles.card, { backgroundColor: palette.cardElevated || palette.surface || '#FFFFFF' }]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: severityColor + '20' }]}>
            <Feather name={getObstacleIcon(obstacle.type)} size={18} color={severityColor} />
          </View>
          <View style={styles.cardHeaderContent}>
            <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>
              {obstacle.title || 'Trail notification'}
            </Text>
            <Text style={[styles.cardSubtitle, { color: palette.placeholder || '#9CA3AF' }]} numberOfLines={1}>
              {formatType(obstacle.type)} · {formatTimestamp(obstacle.reportedAt)}
            </Text>
          </View>
          <View style={[styles.severityBadge, { borderColor: severityColor + '55' }]}> 
            <Text style={[styles.severityLabel, { color: severityColor }]}>{obstacle.severity.toUpperCase()}</Text>
          </View>
        </View>

        {obstacle.description ? (
          <Text style={[styles.cardDescription, { color: palette.text }]} numberOfLines={2}>
            {obstacle.description}
          </Text>
        ) : null}

        <View style={styles.cardFooter}>
          <View style={styles.footerRow}>
            <Feather name="user" size={14} color={palette.placeholder || '#9CA3AF'} />
            <Text style={[styles.footerText, { color: palette.placeholder || '#9CA3AF' }]}>
              {obstacle.userName || 'Anonymous rider'}
            </Text>
          </View>
          <View style={styles.footerRow}>
            <Feather name="map-pin" size={14} color={palette.placeholder || '#9CA3AF'} />
            <Text style={[styles.footerText, { color: palette.placeholder || '#9CA3AF' }]}>
              Near you
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const handleViewAll = () => {
    onClose();
    onRequestNotificationsScreen?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <View style={styles.overlay} pointerEvents="box-none">
        {/* Background close layer */}
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} pointerEvents="auto" />
        </TouchableWithoutFeedback>
        {/* Foreground content */}
        <View style={styles.container} pointerEvents="auto">
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <View style={styles.headerIcon}>
                    <Feather name="bell" size={18} color={palette.onPrimary || '#FFFFFF'} />
                  </View>
                  <Text style={[styles.headerTitle, { color: palette.text }]}>Trail notifications</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Feather name="x" size={22} color={palette.text} />
                </TouchableOpacity>
              </View>

              {/* Filters */}
              <View style={styles.filterContainer}>
                <TouchableOpacity
                  style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
                  onPress={() => setFilter('all')}
                >
                  <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterTab, filter === 'active' && styles.filterTabActive]}
                  onPress={() => setFilter('active')}
                >
                  <Text style={[styles.filterText, filter === 'active' && styles.filterTextActive]}>Active</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterTab, filter === 'resolved' && styles.filterTabActive]}
                  onPress={() => setFilter('resolved')}
                >
                  <Text style={[styles.filterText, filter === 'resolved' && styles.filterTextActive]}>Resolved</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.listArea}>
                {loading ? (
                  <View style={styles.emptyState}>
                    <ActivityIndicator size="small" color={palette.brandPrimary || '#2563EB'} />
                    <Text style={[styles.emptyLabel, { color: palette.placeholder || '#9CA3AF' }]}>Loading alerts…</Text>
                  </View>
                ) : obstacles.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Feather name="check-circle" size={32} color={palette.placeholder || '#9CA3AF'} />
                    <Text style={[styles.emptyLabel, { color: palette.placeholder || '#9CA3AF' }]}>All clear on the trails</Text>
                    <Text style={[styles.emptySubLabel, { color: palette.placeholder || '#9CA3AF' }]}>No new reports in the last day</Text>
                  </View>
                ) : (
                  <FlatList
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    data={obstacles}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => renderObstacleCard(item)}
                    showsVerticalScrollIndicator
                    scrollEnabled
                    directionalLockEnabled
                    scrollEventThrottle={16}
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled
                    removeClippedSubviews={false}
                    keyboardDismissMode="on-drag"
                  />
                )}
              </View>

              {/* Hide full-screen redirect by default; keep optional for reuse */}
              {onRequestNotificationsScreen ? (
                <TouchableOpacity
                  style={[styles.viewAllButton, { backgroundColor: palette.brandPrimary || '#2563EB' }]}
                  onPress={handleViewAll}
                >
                  <Text style={[styles.viewAllText, { color: palette.onPrimary || '#FFFFFF' }]}>Open notifications board</Text>
                </TouchableOpacity>
              ) : null}
            </View>
        </View>
    </Modal>
  );
};

const getObstacleIcon = (type: string) => {
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
};

const getSeverityColor = (severity: string, palette: any) => {
  switch (severity) {
    case 'critical':
      return palette.obstacleCritical || '#DC2626';
    case 'high':
      return palette.obstacleHigh || '#EA580C';
    case 'medium':
      return palette.obstacleMedium || '#F59E0B';
    case 'low':
      return palette.obstacleLow || '#10B981';
    default:
      return palette.brandPrimary || '#2563EB';
  }
};

const formatType = (type: string) => type.charAt(0).toUpperCase() + type.slice(1);

const formatTimestamp = (timestamp: number) => {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const date = new Date(timestamp);
  return date.toLocaleDateString();
};

const createStyles = (palette: any, insets: EdgeInsets) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: insets.top + 16,
      paddingBottom: insets.bottom + 16,
      paddingHorizontal: 20,
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.55)',
    },
    container: {
      width: '100%',
      maxWidth: 420,
      borderRadius: 24,
      backgroundColor: palette.background || '#FFFFFF',
      overflow: 'hidden',
      // Fixed panel height to prevent size changes across filters
      minHeight: 560,
      maxHeight: 560,
      flexDirection: 'column',
      flexShrink: 0,
      zIndex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingVertical: 20,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    headerIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: palette.brandPrimary || '#2563EB',
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
    },
    closeButton: {
      padding: 4,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingBottom: 24,
      paddingTop: 8,
      gap: 16,
    },
    filterContainer: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: palette.border || 'rgba(148, 163, 184, 0.25)',
    },
    filterTab: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: palette.card || '#F8FAFC',
      alignItems: 'center',
    },
    filterTabActive: {
      backgroundColor: palette.brandPrimary || '#2563EB',
    },
    filterText: {
      fontSize: 13,
      fontWeight: '600',
      color: palette.placeholder || '#64748B',
    },
    filterTextActive: {
      color: palette.onPrimary || '#FFFFFF',
    },
    listArea: {
      flex: 1,
      minHeight: 0,
    },
    card: {
      borderRadius: 18,
      paddingHorizontal: 20,
      paddingVertical: 18,
      borderWidth: 1,
      borderColor: palette.border || 'rgba(148, 163, 184, 0.25)',
      gap: 12,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardHeaderContent: {
      flex: 1,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
    },
    cardSubtitle: {
      fontSize: 13,
      fontWeight: '500',
    },
    severityBadge: {
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    severityLabel: {
      fontSize: 11,
      fontWeight: '700',
    },
    cardDescription: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '500',
    },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    footerText: {
      fontSize: 12,
      fontWeight: '600',
    },
    emptyState: {
      paddingVertical: 40,
      gap: 12,
      alignItems: 'center',
    },
    emptyLabel: {
      fontSize: 14,
      fontWeight: '600',
    },
    emptySubLabel: {
      fontSize: 12,
      fontWeight: '500',
    },
    viewAllButton: {
      marginHorizontal: 24,
      marginBottom: 24,
      marginTop: 8,
      paddingVertical: 16,
      borderRadius: 16,
      alignItems: 'center',
    },
    viewAllText: {
      fontSize: 15,
      fontWeight: '700',
    },
  });

export default NotificationsModal;
