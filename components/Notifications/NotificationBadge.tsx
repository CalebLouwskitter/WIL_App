import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../../hooks/useAppTheme';

interface NotificationBadgeProps {
  count: number;
  maxCount?: number;
}

export default function NotificationBadge({ count, maxCount = 99 }: NotificationBadgeProps) {
  const { palette } = useAppTheme();
  if (count === 0) return null;

  const displayCount = count > maxCount ? `${maxCount}+` : count.toString();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: palette.danger,
          borderColor: palette.card,
        },
      ]}
    >
      <Text style={[styles.badgeText, { color: palette.onPrimary }]}>{displayCount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
});
