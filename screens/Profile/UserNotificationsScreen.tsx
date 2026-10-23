import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather as Icon } from '@expo/vector-icons';
import {
  getNotificationsForRole,
  dismissNotificationForUser,
  createTestNotification,
  markNotificationAsRead,
  getNotificationReadState,
} from '../../services/FirebaseNotificationService';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useAppTheme } from '../../hooks/useAppTheme';
import { FIREBASE_ENABLED } from '../../services/firebase';
import { Notification } from '../../types/Notification';
import { NotificationItem } from '../../components/Notifications';
import ScreenHeader from '../../components/ScreenHeader';

export default function UserNotificationsScreen() {
  const navigation = useNavigation();
  const { palette, isDark } = useAppTheme();
  const { profile, loading: profileLoading } = useCurrentUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readState, setReadState] = useState<Map<string, { read: boolean; dismissed: boolean }>>(new Map());
  const [readStateError, setReadStateError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Every path ends in a resolved state: loading, no profile, error, empty or list.
  const loadNotifications = async (showSpinner = true) => {
    if (!profile) {
      setNotifications([]);
      setReadState(new Map());
      setReadStateError(false);
      setLoadError(null);
      setLoading(false);
      return;
    }

    try {
      if (showSpinner) setLoading(true);
      setLoadError(null);
      // Get notifications for regular users
      const userNotifications = await getNotificationsForRole('member');
      setNotifications(userNotifications);

      // Hydrate per-user read and dismissed state
      try {
        const stateMap = await getNotificationReadState(profile.uid);
        setReadState(stateMap);
        setReadStateError(false);
      } catch (rsError) {
        console.error('Error loading notification read state:', rsError);
        setReadState(new Map());
        setReadStateError(true);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      setLoadError('Could not load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profileLoading) return;
    loadNotifications();
  }, [profile, profileLoading]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadNotifications(false);
    } finally {
      setRefreshing(false);
    }
  };

  const visibleNotifications = notifications.filter(
    (n) => !readState.get(n.id)?.dismissed
  );

  const visibleUnreadNotifications = visibleNotifications.filter(
    (n) => !readState.get(n.id)?.read
  );

  const handleDismissNotification = async (notification: Notification) => {
    if (!profile) return;
    try {
      await dismissNotificationForUser(notification.id, profile.uid);
      setReadState((prev) => {
        const next = new Map(prev);
        next.set(notification.id, {
          read: true,
          dismissed: true,
        });
        return next;
      });
      Alert.alert('Success', 'Notification dismissed');
    } catch (error) {
      console.error('Error dismissing notification:', error);
      Alert.alert('Error', 'Failed to dismiss notification');
    }
  };

  const handleNotificationPress = async (notification: Notification) => {
    if (!profile) return;
    const currentState = readState.get(notification.id);
    if (currentState?.read) return;

    // Optimistically update local state to read
    setReadState((prev) => {
      const next = new Map(prev);
      next.set(notification.id, {
        read: true,
        dismissed: Boolean(currentState?.dismissed),
      });
      return next;
    });

    try {
      await markNotificationAsRead(notification.id, profile.uid);
    } catch (error) {
      console.error('Error marking notification as read on press:', error);
      // Revert optimistic update
      setReadState((prev) => {
        const next = new Map(prev);
        if (currentState) {
          next.set(notification.id, currentState);
        } else {
          next.delete(notification.id);
        }
        return next;
      });
      Alert.alert('Error', 'Failed to mark notification as read');
    }
  };

  const handleCreateTestNotification = async () => {
    if (!profile) return;
    
    try {
      await createTestNotification(profile.uid);
      Alert.alert('Success', 'Test notification created');
      await loadNotifications(false);
    } catch (error) {
      console.error('Error creating test notification:', error);
      Alert.alert('Error', 'Failed to create test notification');
    }
  };

  const handleMarkAsRead = async (notification: Notification) => {
    if (!profile) return;
    try {
      await markNotificationAsRead(notification.id, profile.uid);
      setReadState((prev) => {
        const next = new Map(prev);
        const current = next.get(notification.id);
        next.set(notification.id, {
          read: true,
          dismissed: Boolean(current?.dismissed),
        });
        return next;
      });
      Alert.alert('Success', 'Notification marked as read');
    } catch (error) {
      console.error('Error marking notification as read:', error);
      Alert.alert('Error', 'Failed to mark notification as read');
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!profile || visibleUnreadNotifications.length === 0) return;
    
    try {
      const markPromises = visibleUnreadNotifications.map((notification) => 
        markNotificationAsRead(notification.id, profile.uid)
      );
      await Promise.all(markPromises);
      setReadState((prev) => {
        const next = new Map(prev);
        visibleUnreadNotifications.forEach((n) => {
          const current = next.get(n.id);
          next.set(n.id, {
            read: true,
            dismissed: Boolean(current?.dismissed),
          });
        });
        return next;
      });
      Alert.alert('Success', 'All notifications marked as read');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      Alert.alert('Error', 'Failed to mark all notifications as read');
    }
  };

  const renderListHeader = () => (
    <View>
      <ScreenHeader
        title="Notifications"
        onBack={() => navigation.goBack()}
        right={
          <View style={styles.headerActions}>
            {__DEV__ && profile?.role === 'admin' && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: palette.card, shadowColor: palette.shadow }]}
                onPress={handleCreateTestNotification}
                accessibilityLabel="Create test notification"
                accessibilityRole="button"
                accessibilityHint="Create a test notification"
                activeOpacity={0.7}
              >
                <Icon name="plus" size={18} color={palette.brandPrimary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: palette.card, shadowColor: palette.shadow }]}
              onPress={handleMarkAllAsRead}
              disabled={visibleUnreadNotifications.length === 0}
              accessibilityLabel="Mark all as read"
              accessibilityRole="button"
              accessibilityHint="Mark all notifications as read"
              activeOpacity={0.7}
            >
              <Icon name="check" size={18} color={palette.success} />
            </TouchableOpacity>
          </View>
        }
      />
      {readStateError && (
        <View
          style={[
            styles.readStateWarning,
            {
              backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7',
              borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#FDE68A',
            },
          ]}
        >
          <Text
            style={[
              styles.readStateWarningText,
              { color: isDark ? '#FDE68A' : '#92400E' },
            ]}
          >
            Couldn't load read status.
          </Text>
        </View>
      )}
      {visibleNotifications.length > 0 && (
        <View style={styles.batchActions}>
          <Text style={[styles.batchActionsText, { color: palette.textSecondary }]}>
            {visibleNotifications.length} notification{visibleNotifications.length !== 1 ? 's' : ''}
          </Text>
        </View>
      )}
    </View>
  );

  const renderStatePanel = (content: React.ReactNode) => (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
      <ScreenHeader title="Notifications" onBack={() => navigation.goBack()} />
      <View style={styles.loadingContainer}>{content}</View>
    </SafeAreaView>
  );

  if (profileLoading || (loading && profile)) {
    return renderStatePanel(
      <>
        <ActivityIndicator size="large" color={palette.brandPrimary} />
        <Text style={[styles.loadingText, { color: palette.textSecondary }]}>
          Loading notifications...
        </Text>
      </>
    );
  }

  if (!profile) {
    return renderStatePanel(
      <>
        <View style={[styles.emptyIconCircle, { backgroundColor: palette.card }]}>
          <Icon name={FIREBASE_ENABLED ? 'log-in' : 'wifi-off'} size={32} color={palette.textMuted} />
        </View>
        <Text style={[styles.emptyStateTitle, { color: palette.textPrimary }]}>
          {FIREBASE_ENABLED ? 'Sign in to see notifications' : 'Not connected'}
        </Text>
        <Text style={[styles.emptyStateText, { color: palette.textSecondary }]}>
          {FIREBASE_ENABLED
            ? 'Notifications are tied to your SBHRA account.'
            : 'Notifications need a connection to SBHRA servers.'}
        </Text>
      </>
    );
  }

  if (loadError && notifications.length === 0) {
    return renderStatePanel(
      <>
        <View style={[styles.emptyIconCircle, { backgroundColor: palette.card }]}>
          <Icon name="alert-circle" size={32} color={palette.caution} />
        </View>
        <Text style={[styles.emptyStateTitle, { color: palette.textPrimary }]}>{loadError}</Text>
        <Text style={[styles.emptyStateText, { color: palette.textSecondary }]}>
          Check your connection and try again.
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: palette.brandPrimary }]}
          onPress={() => loadNotifications()}
          accessibilityRole="button"
          accessibilityLabel="Retry loading notifications"
        >
          <Text style={[styles.retryButtonText, { color: palette.onPrimary }]}>Retry</Text>
        </TouchableOpacity>
      </>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
      <FlatList
        data={visibleNotifications}
        ListHeaderComponent={renderListHeader}
        renderItem={({ item }) => (
          <View
            style={[
              styles.notificationItem,
              {
                backgroundColor: palette.card,
                borderColor: palette.divider,
                shadowColor: palette.shadow,
              },
            ]}
          >
            <View style={styles.notificationContent}>
              <NotificationItem
                notification={item}
                isRead={Boolean(readState.get(item.id)?.read)}
                onPress={() => handleNotificationPress(item)}
              />
            </View>
            <View style={styles.notificationActions}>
              <TouchableOpacity
                style={[
                  styles.actionButtonFull,
                  {
                    backgroundColor: isDark ? palette.surfaceVariant : palette.background,
                    borderColor: palette.divider,
                  },
                ]}
                onPress={() => handleMarkAsRead(item)}
                accessibilityLabel="Mark as read"
                accessibilityRole="button"
                accessibilityHint="Mark this notification as read"
                activeOpacity={0.7}
              >
                <Icon name="check" size={16} color={palette.success} />
                <Text style={[styles.actionButtonText, { color: palette.textSecondary }]}>
                  Mark as Read
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionButtonFull,
                  {
                    backgroundColor: isDark ? palette.surfaceVariant : palette.background,
                    borderColor: palette.divider,
                  },
                ]}
                onPress={() => {
                  Alert.alert(
                    'Dismiss Notification',
                    'Hide this notification? It will be removed from your list only.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Dismiss',
                        style: 'destructive',
                        onPress: () => handleDismissNotification(item),
                      },
                    ]
                  );
                }}
                accessibilityLabel="Dismiss notification"
                accessibilityRole="button"
                accessibilityHint="Dismiss this notification"
                activeOpacity={0.7}
              >
                <Icon name="x" size={16} color={palette.danger} />
                <Text style={[styles.actionButtonText, { color: palette.textSecondary }]}>
                  Dismiss
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconCircle, { backgroundColor: palette.card }]}>
              <Icon name="bell" size={32} color={palette.textMuted} />
            </View>
            <Text style={[styles.emptyStateTitle, { color: palette.textPrimary }]}>No notifications</Text>
            <Text style={[styles.emptyStateText, { color: palette.textSecondary }]}>
              Nothing has been sent to you yet.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },

  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  readStateWarning: {
    marginHorizontal: 20,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  readStateWarningText: {
    fontSize: 13,
    fontWeight: '500',
  },
  batchActions: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  batchActionsText: {
    fontSize: 14,
    fontWeight: '500',
    fontStyle: 'italic',
  },

  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  notificationItem: {
    marginBottom: 12,
    borderRadius: 18,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
  },
  notificationContent: {
    marginBottom: 12,
  },
  notificationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButtonFull: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
