import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
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
  const palette = Colors[scheme ?? 'light'];
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [loading, setLoading] = useState(false);

  const styles = useMemo(() => createStyles(palette, insets), [palette, insets]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const data = await getObstacles({ limit: 10 });
        if (mounted) {
          setObstacles(data);
        }
      } catch (e) {
        if (mounted) {
          setObstacles([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [visible]);

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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.container}>
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

              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
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
                  obstacles.map(renderObstacleCard)
                )}
              </ScrollView>

              {onRequestNotificationsScreen ? (
                <TouchableOpacity
                  style={[styles.viewAllButton, { backgroundColor: palette.brandPrimary || '#2563EB' }]}
                  onPress={handleViewAll}
                >
                  <Text style={[styles.viewAllText, { color: palette.onPrimary || '#FFFFFF' }]}>Open notifications board</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
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
      backgroundColor: 'rgba(15, 23, 42, 0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: insets.top + 16,
      paddingBottom: insets.bottom + 16,
      paddingHorizontal: 20,
    },
    container: {
      width: '100%',
      maxWidth: 420,
      borderRadius: 24,
      backgroundColor: palette.background || '#FFFFFF',
      overflow: 'hidden',
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
      maxHeight: 420,
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingBottom: 24,
      gap: 16,
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
