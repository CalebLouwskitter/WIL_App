import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Notification } from '../../types/Notification';

interface NotificationItemProps {
  notification: Notification;
  onPress?: () => void;
  isRead?: boolean;
}

export default function NotificationItem({ notification, onPress, isRead = false }: NotificationItemProps) {
  const getIconName = () => {
    switch (notification.type) {
      case 'user_signup':
        return 'person-add';
      case 'event':
        return 'calendar';
      case 'update':
        return 'information-circle';
      case 'alert':
        return 'warning';
      default:
        return 'notifications';
    }
  };

  const getIconColor = () => {
    switch (notification.type) {
      case 'user_signup':
        return '#2563eb';
      case 'event':
        return '#16a34a';
      case 'update':
        return '#0ea5e9';
      case 'alert':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  const formatTime = (date: Date) => {
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

  return (
    <TouchableOpacity 
      style={[styles.container, !isRead && styles.unread]} 
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityState={{ selected: false }}
      accessibilityLabel={`${notification.title}, ${notification.body}${!isRead ? ', unread' : ''}`}
    >
      <View style={[styles.iconContainer, { backgroundColor: getIconColor() + '20' }]}>
        <Ionicons name={getIconName() as any} size={24} color={getIconColor()} />
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, isRead ? styles.readTitle : styles.unreadTitle]} numberOfLines={1}>
            {notification.title}
          </Text>
          {!isRead && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.body} numberOfLines={2}>
          {notification.body}
        </Text>
        <Text style={styles.time}>
          {formatTime(notification.createdAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  unread: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
  },
  unreadTitle: {
    fontWeight: '700',
  },
  readTitle: {
    fontWeight: '400',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
    marginLeft: 8,
  },
  body: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  time: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});
