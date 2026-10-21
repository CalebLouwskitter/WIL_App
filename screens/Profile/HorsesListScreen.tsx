import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, useColorScheme } from 'react-native';
import { Feather as Icon } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getHorses, type Horse } from '../../services/HorseStorage';
import { Colors } from '../../constants/colors';
import { BorderRadius, ComponentStyles, Shadows, Spacing, Typography } from '../../constants/styleguide';

const HorsesListScreen = () => {
  const nav = useNavigation<any>();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await getHorses();
      setHorses(list);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: Horse }) => (
    <View style={styles.row}>
      <View style={styles.horseDetails}>
        <Text style={styles.title}>{item.name}</Text>
        <Text style={styles.sub}>{[item.breed, item.age ? `${item.age} yrs` : undefined].filter(Boolean).join(' • ') || '—'}</Text>
      </View>
      <Text style={styles.meta}>{new Date(item.createdAt).toLocaleDateString()}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Icon name="chevron-left" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Horses</Text>
        <TouchableOpacity onPress={() => nav.navigate('CreateHorse')} style={styles.addBtn} accessibilityRole="button" accessibilityLabel="Add horse">
          <Icon name="plus" size={24} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={horses}
        keyExtractor={(h) => h.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} colors={[colors.brandPrimary]} />}
        ListEmptyComponent={!loading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No horses yet.</Text>
            <TouchableOpacity style={styles.cta} onPress={() => nav.navigate('CreateHorse')} accessibilityRole="button">
              <Text style={styles.ctaText}>Add your first horse</Text>
            </TouchableOpacity>
          </View>
        ) : undefined}
      />
    </View>
  );
};

const createStyles = (colors: typeof Colors.light) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundLight },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.xxl, paddingHorizontal: Spacing.md, marginBottom: Spacing.lg },
  backBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colors.surface },
  headerTitle: { ...Typography.subtitle, flex: 1, textAlign: 'center', color: colors.onSurface },
  addBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandPrimaryAlt },
  listContent: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl },
  row: { ...Shadows.sm, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, marginBottom: Spacing.md, borderRadius: BorderRadius.xl, padding: Spacing.md, gap: Spacing.sm },
  horseDetails: { flex: 1 },
  title: { ...Typography.body, fontWeight: '600', color: colors.onSurface },
  sub: { ...Typography.caption, fontWeight: '400', color: colors.onSurfaceVariant, marginTop: Spacing.xs },
  meta: { ...Typography.caption, fontWeight: '400', color: colors.onSurfaceVariant, flexShrink: 1, textAlign: 'right' },
  empty: { alignItems: 'center', marginTop: Spacing.xxl },
  emptyText: { ...Typography.body, color: colors.onSurfaceVariant, marginBottom: Spacing.md },
  cta: { ...ComponentStyles.button.primary, backgroundColor: colors.brandPrimaryAlt, borderRadius: BorderRadius.lg },
  ctaText: { ...Typography.button, color: colors.onPrimary },
});

export default HorsesListScreen;
