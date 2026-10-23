import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { getRides } from '../../services/RideStorage';
import type { RideData } from '../../hooks/useRideTracker';
import { usePreferences } from '../../contexts/PreferencesContext';
import { formatDistance } from '../../utils/units';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAppTheme, type AppPalette } from '../../hooks/useAppTheme';
import { BorderRadius, Shadows, Spacing, Typography } from '../../constants/styleguide';

type RouteParams = {
  fromDashboard?: boolean;
  fromMapping?: boolean;
};

const HistoryScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { preferences } = usePreferences();
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

  const handleBack = () => {
    if (route?.params?.fromDashboard) {
      navigation.getParent()?.navigate('Dashboard');
    } else if (route?.params?.fromMapping) {
      const parent: any = navigation.getParent();
      parent?.navigate('Mapping', { screen: 'LiveTracking' });
    } else {
      navigation.goBack();
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Ride History"
        onBack={handleBack}
        backLabel="Go back"
      />

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
                    <Feather name="navigation" size={18} color={palette.brandPrimary} />
                  </View>
                  <View style={styles.itemText}>
                    <Text style={styles.itemTitle}>Ride #{rides.length - index}</Text>
                    <Text style={styles.itemSub}>
                      {new Date(item.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {item.horseName ? ` • ${item.horseName}` : ''}
                    </Text>
                    {item.pendingSync ? (
                      <View style={styles.pendingRow}>
                        <Feather name="cloud-off" size={12} color={palette.textSecondary} />
                        <Text style={styles.pendingText}>Saved on device, will upload when online</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={styles.itemRight}>
                  {(() => {
                    const dist = formatDistance(item.totalDistance, preferences.units, 1);
                    return (
                      <>
                        <Text style={styles.itemDistValue}>{dist.value}</Text>
                        <Text style={styles.itemDistUnit}>{dist.unit}</Text>
                      </>
                    );
                  })()}
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
};

const createStyles = (palette: AppPalette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  body: { flex: 1, paddingHorizontal: Spacing.md },
  listContent: { paddingBottom: Spacing.xl },
  separator: { height: Spacing.md },
  placeholder: { ...Typography.body, color: palette.textSecondary, textAlign: 'center', marginTop: Spacing.lg },
  item: {
    ...Shadows.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    backgroundColor: palette.card,
    gap: Spacing.sm,
  },
  itemLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  itemText: { flex: 1 },
  itemIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.chipNeutral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: { ...Typography.body, fontWeight: '600', color: palette.textPrimary },
  itemSub: { ...Typography.caption, fontWeight: '400', color: palette.textSecondary, marginTop: Spacing.xs },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs },
  pendingText: { ...Typography.caption, flex: 1, fontWeight: '400', color: palette.textSecondary },
  itemRight: { alignItems: 'flex-end' },
  itemDistValue: { ...Typography.subtitle, color: palette.textPrimary },
  itemDistUnit: { ...Typography.caption, fontWeight: '400', color: palette.textSecondary },
});

export default HistoryScreen;
