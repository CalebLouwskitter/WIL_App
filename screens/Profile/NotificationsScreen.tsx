import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { getObstacles, type Obstacle } from '../../services/ObstacleService';

type Props = {
  navigation: any;
};

const NotificationsScreen: React.FC<Props> = ({ navigation }) => {
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('active');
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];
  const textSecondaryColor = palette.placeholder || '#9CA3AF';
  const styles = useMemo(() => createStyles(palette, textSecondaryColor), [palette, textSecondaryColor]);

  const loadObstacles = async () => {
    try {
      setLoading(true);
      const filterStatus = filter === 'all' ? undefined : filter;
      const data = await getObstacles({ status: filterStatus });
      setObstacles(data);
    } catch (error) {
      console.error('Failed to load obstacles:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadObstacles();
  }, [filter]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadObstacles();
    setRefreshing(false);
  };

  const getObstacleIcon = (type: string) => {
    switch (type) {
      case 'pothole': return 'alert-triangle';
      case 'debris': return 'trash-2';
      case 'animal': return 'eye';
      case 'tree': return 'wind';
      case 'water': return 'droplet';
      default: return 'alert-circle';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return palette.obstacleLow || '#4CAF50';
      case 'medium': return palette.obstacleMedium || '#FF9800';
      case 'high': return palette.obstacleHigh || '#F44336';
      case 'critical': return palette.obstacleCritical || '#9C27B0';
      default: return palette.text;
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatDistance = (lat: number, lon: number) => {
    // This is a placeholder - you can calculate actual distance from user's location
    return 'Near you';
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Obstacle Board</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Feather name="refresh-cw" size={20} color={palette.text} />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'active' && styles.filterTabActive]}
          onPress={() => setFilter('active')}
        >
          <Text style={[styles.filterText, filter === 'active' && styles.filterTextActive]}>
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'resolved' && styles.filterTabActive]}
          onPress={() => setFilter('resolved')}
        >
          <Text style={[styles.filterText, filter === 'resolved' && styles.filterTextActive]}>
            Resolved
          </Text>
        </TouchableOpacity>
      </View>

      {/* Obstacles List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.boardPanel}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={palette.primary} />
              <Text style={styles.loadingText}>Loading obstacles...</Text>
            </View>
          ) : obstacles.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="check-circle" size={48} color={textSecondaryColor} />
              <Text style={styles.emptyText}>No obstacles to display</Text>
              <Text style={styles.emptySubtext}>
                {filter === 'active' 
                  ? 'All trails are clear!' 
                  : 'No obstacles found for this filter'}
              </Text>
            </View>
          ) : (
            obstacles.map((obstacle) => (
              <View key={obstacle.id} style={styles.obstacleCard}>
                {/* Icon and Title Row */}
                <View style={styles.obstacleHeader}>
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: getSeverityColor(obstacle.severity) + '20' },
                    ]}
                  >
                    <Feather
                      name={getObstacleIcon(obstacle.type)}
                      size={24}
                      color={getSeverityColor(obstacle.severity)}
                    />
                  </View>
                  <View style={styles.obstacleInfo}>
                    <Text style={styles.obstacleTitle}>{obstacle.title}</Text>
                    <Text style={styles.obstacleType}>
                      {obstacle.type.charAt(0).toUpperCase() + obstacle.type.slice(1)}
                    </Text>
                  </View>
                  <View style={styles.severityBadge}>
                    <Text
                      style={[
                        styles.severityText,
                        { color: getSeverityColor(obstacle.severity) },
                      ]}
                    >
                      {obstacle.severity.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Description */}
                {obstacle.description && (
                  <Text style={styles.obstacleDescription} numberOfLines={2}>
                    {obstacle.description}
                  </Text>
                )}

                {/* Footer Info */}
                <View style={styles.obstacleFooter}>
                  <View style={styles.footerLeft}>
                    <Feather name="user" size={14} color={textSecondaryColor} />
                    <Text style={styles.footerText}>
                      {obstacle.userName || 'Anonymous'}
                    </Text>
                  </View>
                  <View style={styles.footerRight}>
                    <Feather name="clock" size={14} color={textSecondaryColor} />
                    <Text style={styles.footerText}>{formatDate(obstacle.reportedAt)}</Text>
                  </View>
                </View>

                {/* Status Badge */}
                {obstacle.status === 'verified' && (
                  <View style={styles.verifiedBadge}>
                    <Feather name="check-circle" size={12} color="#4CAF50" />
                    <Text style={styles.verifiedText}>Verified by community</Text>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const createStyles = (palette: any, textSecondaryColor: string) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 50,
      paddingBottom: 16,
      backgroundColor: palette.card,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: palette.text,
      flex: 1,
      textAlign: 'center',
    },
    refreshButton: {
      padding: 8,
    },
    filterContainer: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: palette.card,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    filterTab: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 16,
      marginHorizontal: 4,
      borderRadius: 8,
      backgroundColor: palette.background,
      alignItems: 'center',
    },
    filterTabActive: {
      backgroundColor: palette.primary,
    },
    filterText: {
      fontSize: 14,
      fontWeight: '600',
      color: textSecondaryColor,
    },
    filterTextActive: {
      color: '#FFFFFF',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingVertical: 24,
    },
    boardPanel: {
      backgroundColor: palette.cardElevated || palette.card,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: palette.borderMuted || palette.border,
      gap: 12,
      shadowColor: palette.shadowStrong || 'rgba(15, 23, 42, 0.18)',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 6,
      marginBottom: 32,
    },
    loadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: textSecondaryColor,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
    },
    emptyText: {
      marginTop: 16,
      fontSize: 18,
      fontWeight: '600',
      color: palette.text,
    },
    emptySubtext: {
      marginTop: 8,
      fontSize: 14,
      color: textSecondaryColor,
      textAlign: 'center',
    },
    obstacleCard: {
      backgroundColor: palette.cardElevated || palette.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: palette.borderMuted || palette.border,
      shadowColor: palette.shadowStrong || 'rgba(15, 23, 42, 0.14)',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 4,
    },
    obstacleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    obstacleInfo: {
      flex: 1,
    },
    obstacleTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: palette.text,
      marginBottom: 4,
    },
    obstacleType: {
      fontSize: 13,
      color: textSecondaryColor,
    },
    severityBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: palette.background,
    },
    severityText: {
      fontSize: 11,
      fontWeight: '700',
    },
    obstacleDescription: {
      fontSize: 14,
      color: palette.text,
      lineHeight: 20,
      marginBottom: 12,
    },
    obstacleFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    footerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    footerRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    footerText: {
      fontSize: 12,
      color: textSecondaryColor,
      marginLeft: 6,
    },
    verifiedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: palette.border,
    },
    verifiedText: {
      fontSize: 12,
      color: '#4CAF50',
      marginLeft: 6,
      fontWeight: '600',
    },
  });

export default NotificationsScreen;
