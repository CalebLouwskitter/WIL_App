import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Notification } from '../../types/Notification';
import { useAppTheme } from '../../hooks/useAppTheme';

interface NotificationItemProps {
  notification: Notification;
  onPress?: () => void;
  isRead?: boolean;
}

export default function NotificationItem({ notification, onPress, isRead = false }: NotificationItemProps) {
  const { palette, isDark } = useAppTheme();

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
        return palette.brandPrimary;
      case 'event':
        return palette.success;
      case 'update':
        return palette.brandPrimary;
      case 'alert':
        return palette.caution;
      default:
        return palette.textSecondary;
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

  const iconColor = getIconColor();

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: isRead ? palette.card : palette.brandSoft,
          borderColor: isRead ? palette.divider : palette.brandPrimary,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityState={{ selected: false }}
      accessibilityLabel={`${notification.title}, ${notification.body}${!isRead ? ', unread' : ''}`}
    >
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : iconColor + '20',
          },
        ]}
      >
        <Ionicons name={getIconName() as any} size={24} color={iconColor} />
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text
            style={[
              styles.title,
              isRead ? styles.readTitle : styles.unreadTitle,
              { color: isRead ? palette.textSecondary : palette.textPrimary },
            ]}
            numberOfLines={1}
          >
            {notification.title}
          </Text>
          {!isRead && (
            <View style={[styles.unreadDot, { backgroundColor: palette.brandPrimary }]} />
          )}
        </View>
        <Text style={[styles.body, { color: palette.textSecondary }]} numberOfLines={2}>
          {notification.body}
        </Text>
        <Text style={[styles.time, { color: palette.textMuted }]}>
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
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
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
    marginLeft: 8,
  },
  body: {
    fontSize: 14,
    marginBottom: 4,
  },
  time: {
    fontSize: 12,
  },
});
