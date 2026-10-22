import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../hooks/useAppTheme';

export const DEMO_MODE_TEXT = 'Demo mode — not connected to SBHRA servers';

/** Persistent strip shown above the app while Firebase is not configured (development builds only). */
export default function DemoModeBanner() {
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();
  return (
    <View
      style={[styles.banner, { paddingTop: insets.top + 6, backgroundColor: palette.caution }]}
      accessibilityRole="alert"
      accessibilityLabel={DEMO_MODE_TEXT}
    >
      <Text style={[styles.text, { color: palette.onPrimary }]}>{DEMO_MODE_TEXT}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingBottom: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  text: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
