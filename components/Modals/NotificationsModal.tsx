import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableWithoutFeedback,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import { useAppTheme, type AppPalette } from '../../hooks/useAppTheme';
import { fetchObstacles, type Obstacle, type ObstacleFeedStatus } from '../../services/ObstacleService';
import { describeObstacleFeed } from '../../utils/obstacleFeed';

type Props = {
  visible: boolean;
  onClose: () => void;
  onRequestNotificationsScreen?: () => void;
};

const NotificationsModal: React.FC<Props> = ({ visible, onClose, onRequestNotificationsScreen }) => {
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('active');
  const [feedStatus, setFeedStatus] = useState<ObstacleFeedStatus>('connecting');
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const styles = useMemo(() => createStyles(palette, insets), [palette, insets]);
  const feedView = describeObstacleFeed(feedStatus, obstacles.length, lastUpdated);

  useEffect(() => {
    if (!visible) return;

    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const status = filter === 'all' ? undefined : filter;
        const result = await fetchObstacles({ status, limit: 50 });
        if (mounted) {
          setObstacles(result.obstacles);
          setFeedStatus(result.status);
          setLastUpdated(result.fetchedAt);
        }
      } catch {
        // A failed read is an error, never an empty "all clear"
        if (mounted) setFeedStatus('error');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [visible, filter, reloadKey]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const status = filter === 'all' ? undefined : filter;
      const result = await fetchObstacles({ status, limit: 50 });
      setObstacles(result.obstacles);
      setFeedStatus(result.status);
      setLastUpdated(result.fetchedAt);
    } catch {
      setFeedStatus('error');
    } finally {
      setRefreshing(false);
    }
  };

  const renderObstacleCard = (obstacle: Obstacle) => {
    const severityColor = getSeverityColor(obstacle.severity, palette);
    return (
      <View
        key={obstacle.id}
        style={[styles.card, { backgroundColor: palette.card }]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: severityColor + '20' }]}>
            <Feather name={getObstacleIcon(obstacle.type)} size={18} color={severityColor} />
          </View>
          <View style={styles.cardHeaderContent}>
            <Text style={[styles.cardTitle, { color: palette.textPrimary }]} numberOfLines={1}>
              {obstacle.title || 'Trail notification'}
            </Text>
            <Text style={[styles.cardSubtitle, { color: palette.textMuted }]} numberOfLines={1}>
              {formatType(obstacle.type)} · {formatTimestamp(obstacle.reportedAt)}
            </Text>
          </View>
          <View style={[styles.severityBadge, { borderColor: severityColor + '55' }]}> 
            <Text style={[styles.severityLabel, { color: severityColor }]}>{obstacle.severity.toUpperCase()}</Text>
          </View>
        </View>

        {obstacle.description ? (
          <Text style={[styles.cardDescription, { color: palette.textSecondary }]} numberOfLines={2}>
            {obstacle.description}
          </Text>
        ) : null}

        <View style={styles.cardFooter}>
          <View style={styles.footerRow}>
            <Feather name="user" size={14} color={palette.textMuted} />
            <Text style={[styles.footerText, { color: palette.textMuted }]}>
              {obstacle.userName || 'Anonymous rider'}
            </Text>
          </View>
          <View style={styles.footerRow}>
            <Feather name="map-pin" size={14} color={palette.textMuted} />
            <Text style={[styles.footerText, { color: palette.textMuted }]}>
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
                <Feather name="bell" size={18} color={palette.onPrimary} />
              </View>
              <Text style={[styles.headerTitle, { color: palette.textPrimary }]}>Trail notifications</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={22} color={palette.textPrimary} />
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
                <ActivityIndicator size="small" color={palette.brandPrimary} />
                <Text style={[styles.emptyLabel, { color: palette.textSecondary }]}>Loading alerts…</Text>
              </View>
            ) : feedView.kind !== 'list' ? (
              <View style={styles.emptyState}>
                <Feather
                  name={feedView.kind === 'unavailable' ? 'wifi-off' : feedView.kind === 'error' ? 'alert-circle' : 'info'}
                  size={32}
                  color={palette.textMuted}
                />
                <Text style={[styles.emptyLabel, { color: palette.textPrimary }]}>{feedView.title}</Text>
                {feedView.body ? (
                  <Text style={[styles.emptySubLabel, { color: palette.textSecondary }]}>{feedView.body}</Text>
                ) : null}
                {feedView.kind === 'error' ? (
                  <TouchableOpacity
                    style={[styles.viewAllButton, { backgroundColor: palette.brandPrimary }]}
                    onPress={() => setReloadKey((k) => k + 1)}
                  >
                    <Text style={[styles.viewAllText, { color: palette.onPrimary }]}>Try again</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <FlatList
                ListHeaderComponent={
                  feedView.caveat ? (
                    <Text style={[styles.emptySubLabel, { color: palette.textMuted, marginBottom: 8 }]}>
                      {feedView.caveat}
                    </Text>
                  ) : null
                }
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
              style={[styles.viewAllButton, { backgroundColor: palette.brandPrimary }]}
              onPress={handleViewAll}
            >
              <Text style={[styles.viewAllText, { color: palette.onPrimary }]}>Open notifications board</Text>
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

const getSeverityColor = (severity: string, palette: AppPalette) => {
  switch (severity) {
    case 'critical':
      return palette.obstacleCritical;
    case 'high':
      return palette.obstacleHigh;
    case 'medium':
      return palette.obstacleMedium;
    case 'low':
      return palette.obstacleLow;
    default:
      return palette.brandPrimary;
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

const createStyles = (palette: AppPalette, insets: EdgeInsets) =>
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
      backgroundColor: palette.mapOverlay,
    },
    container: {
      width: '100%',
      maxWidth: 420,
      borderRadius: 24,
      backgroundColor: palette.card,
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
      backgroundColor: palette.brandPrimary,
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
      borderBottomColor: palette.divider,
    },
    filterTab: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: palette.background,
      alignItems: 'center',
    },
    filterTabActive: {
      backgroundColor: palette.brandPrimary,
    },
    filterText: {
      fontSize: 13,
      fontWeight: '600',
      color: palette.textSecondary,
    },
    filterTextActive: {
      color: palette.onPrimary,
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
      borderColor: palette.divider,
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
