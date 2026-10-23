import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../../hooks/useAppTheme';

/**
 * Shown by release builds that were produced without Firebase configuration.
 * There is no offline/demo bypass in release builds, so the user is told plainly.
 */
export default function SetupRequiredScreen() {
  const { palette } = useAppTheme();
  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <Text style={[styles.title, { color: palette.textPrimary }]}>Setup required</Text>
      <Text style={[styles.message, { color: palette.textSecondary }]}>
        This version of the app isn't connected to SBHRA servers, so sign-in, ride sync, hazard reports and SOS are unavailable.
      </Text>
      <Text style={[styles.message, { color: palette.textSecondary }]}>Please install the latest version from SBHRA. In an emergency, contact emergency services directly (e.g. 112).</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  message: { fontSize: 16, textAlign: 'center', marginBottom: 16 },
});
