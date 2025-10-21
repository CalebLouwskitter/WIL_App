import React from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Notification } from '../../types/Notification';
import NotificationItem from './NotificationItem';

interface NotificationListProps {
  notifications: Notification[];
  loading?: boolean;
  onNotificationPress?: (notification: Notification) => void;
  readNotificationIds?: Set<string>;
}

export default function NotificationList({ 
  notifications, 
  loading = false, 
  onNotificationPress,
  readNotificationIds = new Set()
}: NotificationListProps) {
  
  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (notifications.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No notifications yet</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={notifications}
      renderItem={({ item }) => (
        <NotificationItem
          notification={item}
          onPress={() => onNotificationPress?.(item)}
          isRead={readNotificationIds.has(item.id)}
        />
      )}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
  listContent: {
    padding: 16,
  },
});
