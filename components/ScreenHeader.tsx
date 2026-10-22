/**
 * Exceptions: SOS screen (emergency styling) and map overlays (full-bleed)
 * are deliberate exceptions and do not use ScreenHeader.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { resolvePalette } from '../constants/colors';
import { Spacing, Typography } from '../constants/styleguide';

export interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  right?: React.ReactNode;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  onBack,
  backLabel,
  right,
}) => {
  let insets = { top: 0, bottom: 0, left: 0, right: 0 };
  try {
    // In tests without SafeAreaProvider this will throw; fallback to zero
    insets = useSafeAreaInsets();
  } catch {
    insets = { top: 0, bottom: 0, left: 0, right: 0 };
  }
  const scheme = useColorScheme();
  const palette = resolvePalette(scheme);

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.sm }]}>
      <View style={styles.headerRow}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={[styles.backBtn, { backgroundColor: palette.surface }]}
            accessibilityRole="button"
            accessibilityLabel={backLabel ?? 'Go back'}
            activeOpacity={0.7}
          >
            <Feather name="chevron-left" size={24} color={palette.onSurface} />
          </TouchableOpacity>
        ) : (
          <View style={styles.slot} />
        )}
        <Text
          style={[styles.title, { color: palette.onSurface }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {right ? (
          <View style={styles.slot}>{right}</View>
        ) : (
          <View style={styles.slot} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(15, 23, 42, 0.18)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  slot: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...Typography.subtitle,
    flex: 1,
    textAlign: 'center',
  },
});

export default ScreenHeader;
