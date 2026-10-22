import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const DEMO_MODE_TEXT = 'Demo mode — not connected to SBHRA servers';

/** Persistent strip shown above the app while Firebase is not configured (development builds only). */
export default function DemoModeBanner() {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.banner, { paddingTop: insets.top + 6 }]}
      accessibilityRole="alert"
      accessibilityLabel={DEMO_MODE_TEXT}
    >
      <Text style={styles.text}>{DEMO_MODE_TEXT}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#B45309',
    paddingBottom: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  text: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
