import React from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Notification } from '../../types/Notification';
import NotificationItem from './NotificationItem';

interface NotificationListProps {
  notifications: Notification[];
  loading?: boolean;
  onNotificationPress?: (notification: Notification) => void;
  readNotificationIds?: Set<string>;
  onDeleteNotification?: (notification: Notification) => void;
  onEditNotification?: (notification: Notification) => void;
  isAdmin?: boolean;
}

export default function NotificationList({ 
  notifications, 
  loading = false, 
  onNotificationPress,
  readNotificationIds = new Set(),
  onDeleteNotification,
  onEditNotification,
  isAdmin = false
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

  const renderSwipeableItem = ({ item }: { item: Notification }) => {
    if (onDeleteNotification) {
      return (
        <SwipeableItem
          notification={item}
          onPress={() => onNotificationPress?.(item)}
          isRead={readNotificationIds.has(item.id)}
          onDelete={() => onDeleteNotification(item)}
          onEdit={() => onEditNotification?.(item)}
          isAdmin={isAdmin}
        />
      );
    }
    
    return (
      <NotificationItem
        notification={item}
        onPress={() => onNotificationPress?.(item)}
        isRead={readNotificationIds.has(item.id)}
      />
    );
  };

  return (
    <FlatList
      data={notifications}
      renderItem={renderSwipeableItem}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

const SwipeableItem = ({ 
  notification, 
  onPress, 
  isRead, 
  onDelete,
  onEdit,
  isAdmin
}: {
  notification: Notification;
  onPress?: () => void;
  isRead?: boolean;
  onDelete: () => void;
  onEdit?: () => void;
  isAdmin?: boolean;
}) => {
  const [isSwiped, setIsSwiped] = React.useState(false);

  const handleDelete = () => {
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete }
      ]
    );
  };

  const handleEdit = () => {
    onEdit?.();
    setIsSwiped(false);
  };

  return (
    <View style={styles.swipeContainer}>
      {isSwiped && (
        <View style={styles.actionButtons}>
          {isAdmin && onEdit && (
            <TouchableOpacity 
              style={styles.editButton}
              onPress={handleEdit}
              activeOpacity={0.7}
            >
              <Ionicons name="create" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Edit</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={styles.deleteButton}
            onPress={handleDelete}
            activeOpacity={0.7}
          >
            <Ionicons name="trash" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
      <TouchableOpacity
        onLongPress={() => setIsSwiped(!isSwiped)}
        onPress={onPress}
        activeOpacity={0.7}
        style={[styles.swipeContent, isSwiped && styles.swipedContent]}
      >
        <NotificationItem
          notification={notification}
          onPress={onPress}
          isRead={isRead}
        />
      </TouchableOpacity>
    </View>
  );
};

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
  swipeContainer: {
    marginBottom: 8,
    position: 'relative',
  },
  actionButtons: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  editButton: {
    width: 80,
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  deleteButton: {
    width: 80,
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  swipeContent: {
    transform: [{ translateX: 0 }],
  },
  swipedContent: {
    transform: [{ translateX: -160 }],
  },
});
