import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather as Icon } from '@expo/vector-icons';
import { getNotificationsForRole, deleteNotification, createTestNotification, markNotificationAsRead } from '../../services/FirebaseNotificationService';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { Notification } from '../../types/Notification';
import { NotificationList, NotificationItem } from '../../components/Notifications';

export default function UserNotificationsScreen() {
  const navigation = useNavigation();
  const { profile } = useCurrentUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = async () => {
    if (!profile) return;
    
    try {
      setLoading(true);
      console.log('Loading notifications for user:', profile.uid);
      // Get notifications for regular users
      const userNotifications = await getNotificationsForRole('member');
      console.log('Loaded notifications:', userNotifications.length);
      setNotifications(userNotifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
      Alert.alert('Error', 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [profile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const handleDeleteNotification = async (notification: Notification) => {
    try {
      await deleteNotification(notification.id);
      Alert.alert('Success', 'Notification deleted successfully');
      await loadNotifications();
    } catch (error) {
      console.error('Error deleting notification:', error);
      Alert.alert('Error', 'Failed to delete notification');
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    // Handle notification press - could navigate to relevant screen
    console.log('Notification pressed:', notification);
  };

  const handleCreateTestNotification = async () => {
    if (!profile) return;
    
    try {
      await createTestNotification(profile.uid);
      Alert.alert('Success', 'Test notification created');
      await loadNotifications();
    } catch (error) {
      console.error('Error creating test notification:', error);
      Alert.alert('Error', 'Failed to create test notification');
    }
  };

  const handleMarkAsRead = async (notification: Notification) => {
    try {
      // Mark notification as read in user's subcollection
      await markNotificationAsRead(notification.id, profile?.uid || '');
      Alert.alert('Success', 'Notification marked as read');
      await loadNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
      Alert.alert('Error', 'Failed to mark notification as read');
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!profile) return;
    
    try {
      // Mark all notifications as read
      const markPromises = notifications.map(notification => 
        markNotificationAsRead(notification.id, profile.uid)
      );
      await Promise.all(markPromises);
      Alert.alert('Success', 'All notifications marked as read');
      await loadNotifications();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      Alert.alert('Error', 'Failed to mark all notifications as read');
    }
  };

  const renderListHeader = () => (
    <View>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          accessibilityHint="Navigate back to previous screen"
          activeOpacity={0.7}
        >
          <Icon name="arrow-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleMarkAllAsRead}
            disabled={notifications.length === 0}
            accessibilityLabel="Mark all as read"
            accessibilityRole="button"
            accessibilityHint="Mark all notifications as read"
            activeOpacity={0.7}
          >
            <Icon name="check" size={18} color="#10B981" />
          </TouchableOpacity>
        </View>
      </View>
      {notifications.length > 0 && (
        <View style={styles.batchActions}>
          <Text style={styles.batchActionsText}>
            {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
          </Text>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessibilityLabel="Go back"
            accessibilityRole="button"
            accessibilityHint="Navigate back to previous screen"
            activeOpacity={0.7}
          >
            <Icon name="arrow-left" size={22} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.title}>Notifications</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={notifications}
        ListHeaderComponent={renderListHeader}
        renderItem={({ item }) => (
          <View style={styles.notificationItem}>
            <View style={styles.notificationContent}>
              <NotificationItem
                notification={item}
                onPress={() => handleNotificationPress(item)}
              />
            </View>
            <View style={styles.notificationActions}>
              <TouchableOpacity
                style={styles.actionButtonFull}
                onPress={() => handleMarkAsRead(item)}
                accessibilityLabel="Mark as read"
                accessibilityRole="button"
                accessibilityHint="Mark this notification as read"
                activeOpacity={0.7}
              >
                <Icon name="check" size={16} color="#10B981" />
                <Text style={styles.actionButtonText}>Mark as Read</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButtonFull}
                onPress={() => {
                  Alert.alert(
                    'Delete Notification',
                    'Are you sure you want to delete this notification?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => handleDeleteNotification(item) }
                    ]
                  );
                }}
                accessibilityLabel="Delete notification"
                accessibilityRole="button"
                accessibilityHint="Delete this notification"
                activeOpacity={0.7}
              >
                <Icon name="trash-2" size={16} color="#EF4444" />
                <Text style={styles.actionButtonText}>Delete</Text>
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
            <View style={styles.emptyIconCircle}>
              <Icon name="bell" size={32} color="#94A3B8" />
            </View>
            <Text style={styles.emptyStateTitle}>No notifications</Text>
            <Text style={styles.emptyStateText}>You're all caught up!</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
    color: '#64748B',
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  batchActions: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  batchActionsText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  notificationItem: {
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
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
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
});
