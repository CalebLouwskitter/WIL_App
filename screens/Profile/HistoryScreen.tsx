import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, useColorScheme } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { getRides } from '../../services/RideStorage';
import type { RideData } from '../../hooks/useRideTracker';
import { useCallback, useState } from 'react';
import { Colors } from '../../constants/colors';
import { BorderRadius, Shadows, Spacing, Typography } from '../../constants/styleguide';

type RouteParams = {
  fromDashboard?: boolean;
  fromMapping?: boolean;
};

const HistoryScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [rides, setRides] = useState<RideData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      const load = async () => {
        try {
          setLoading(true);
          const data = await getRides();
          if (!mounted) return;
          const sorted = [...data].sort((a, b) => b.startTime - a.startTime);
          setRides(sorted);
        } catch (e) {
          // noop
        } finally {
          if (mounted) setLoading(false);
        }
      };
      load();
      return () => {
        mounted = false;
      };
    }, [])
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (route?.params?.fromDashboard) {
              navigation.getParent()?.navigate('Dashboard');
            } else if (route?.params?.fromMapping) {
              const parent: any = navigation.getParent();
              parent?.navigate('Mapping', { screen: 'LiveTracking' });
            } else {
              navigation.goBack();
            }
          }}
          style={styles.backButton}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Feather name="chevron-left" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.title}>Ride History</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.body}>
        {loading ? (
          <Text style={styles.placeholder}>Loading...</Text>
        ) : rides.length === 0 ? (
          <Text style={styles.placeholder}>Your ride history will appear here.</Text>
        ) : (
          <FlatList
            data={rides}
            keyExtractor={(item, index) => item.id ?? `${item.startTime}-${index}`}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={styles.item}
                activeOpacity={0.8}
                onPress={() => (navigation as any).navigate('RideDetail', { startTime: item.startTime })}
                accessibilityLabel={`View ride details for ride #${rides.length - index}`}
                accessibilityRole="button"
              >
                <View style={styles.itemLeft}>
                  <View style={styles.itemIconCircle}>
                    <Feather name="navigation" size={18} color={colors.brandPrimary} />
                  </View>
                  <View style={styles.itemText}>
                    <Text style={styles.itemTitle}>Ride #{rides.length - index}</Text>
                    <Text style={styles.itemSub}>
                      {new Date(item.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {item.horseName ? ` • ${item.horseName}` : ''}
                    </Text>
                    {item.pendingSync ? (
                      <View style={styles.pendingRow}>
                        <Feather name="cloud-off" size={12} color={colors.onSurfaceVariant} />
                        <Text style={styles.pendingText}>Saved on device, will upload when online</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={styles.itemRight}>
                  <Text style={styles.itemDistValue}>{(item.totalDistance / 1000).toFixed(1)}</Text>
                  <Text style={styles.itemDistUnit}>km</Text>
                </View>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: typeof Colors.light) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundLight },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...Typography.subtitle, flex: 1, textAlign: 'center', color: colors.onSurface },
  headerSpacer: { width: 48 },
  body: { flex: 1, paddingHorizontal: Spacing.md },
  listContent: { paddingBottom: Spacing.xl },
  separator: { height: Spacing.md },
  placeholder: { ...Typography.body, color: colors.onSurfaceVariant, textAlign: 'center', marginTop: Spacing.lg },
  item: {
    ...Shadows.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    backgroundColor: colors.surface,
    gap: Spacing.sm,
  },
  itemLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  itemText: { flex: 1 },
  itemIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.chipNeutral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: { ...Typography.body, fontWeight: '600', color: colors.onSurface },
  itemSub: { ...Typography.caption, fontWeight: '400', color: colors.onSurfaceVariant, marginTop: Spacing.xs },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs },
  pendingText: { ...Typography.caption, flex: 1, fontWeight: '400', color: colors.onSurfaceVariant },
  itemRight: { alignItems: 'flex-end' },
  itemDistValue: { ...Typography.subtitle, color: colors.onSurface },
  itemDistUnit: { ...Typography.caption, fontWeight: '400', color: colors.onSurfaceVariant },
});

export default HistoryScreen;
