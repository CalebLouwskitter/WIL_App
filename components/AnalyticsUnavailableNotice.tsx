import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { resolvePalette } from '../constants/colors';
import type { AnalyticsResult } from '../services/analyticsResult';

export const analyticsNotice = (
  result: AnalyticsResult<unknown>,
): { icon: 'wifi-off' | 'log-in' | 'alert-triangle'; title: string; detail: string } | null => {
  switch (result.status) {
    case 'ok':
      return null;
    case 'unavailable':
      return result.reason === 'signed-out'
        ? { icon: 'log-in', title: 'Sign in to see analytics', detail: 'Analytics are tied to your SBHRA account.' }
        : { icon: 'wifi-off', title: 'Not connected to SBHRA servers', detail: 'Analytics unavailable' };
    case 'error':
      return { icon: 'alert-triangle', title: 'Could not load analytics', detail: 'Something went wrong reaching SBHRA servers.' };
  }
};

/** Shown in place of the numbers when analytics could not be read, so zeros never pass as real data. */
export const AnalyticsUnavailableNotice: React.FC<{
  result: AnalyticsResult<unknown>;
  onRetry?: () => void;
}> = ({ result, onRetry }) => {
  const theme = resolvePalette(useColorScheme());
  const notice = analyticsNotice(result);
  if (!notice) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.borderMuted }]}>
      <Feather name={notice.icon} size={32} color={theme.onSurfaceVariant} />
      <Text style={[styles.title, { color: theme.onSurface }]}>{notice.title}</Text>
      <Text style={[styles.detail, { color: theme.onSurfaceVariant }]}>{notice.detail}</Text>
      {result.status === 'error' && onRetry ? (
        <TouchableOpacity accessibilityRole="button" onPress={onRetry} style={[styles.retry, { borderColor: theme.brandPrimary }]}>
          <Text style={[styles.retryText, { color: theme.brandPrimary }]}>Retry</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: 8,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
  },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  detail: { fontSize: 14, textAlign: 'center' },
  retry: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  retryText: { fontSize: 15, fontWeight: '600' },
});
