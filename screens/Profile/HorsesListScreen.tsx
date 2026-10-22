import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Feather as Icon } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getHorses, type Horse } from '../../services/HorseStorage';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAppTheme, type AppPalette } from '../../hooks/useAppTheme';
import { BorderRadius, ComponentStyles, Shadows, Spacing, Typography } from '../../constants/styleguide';

const HorsesListScreen = () => {
  const nav = useNavigation<any>();
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
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
      <ScreenHeader
        title="My Horses"
        onBack={() => nav.goBack()}
        backLabel="Go back"
        right={
          <TouchableOpacity
            onPress={() => nav.navigate('CreateHorse')}
            style={styles.addBtn}
            accessibilityRole="button"
            accessibilityLabel="Add horse"
          >
            <Icon name="plus" size={24} color={palette.onPrimary} />
          </TouchableOpacity>
        }
      />

      <FlatList
        data={horses}
        keyExtractor={(h) => h.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.brandPrimary} colors={[palette.brandPrimary]} />}
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

const createStyles = (palette: AppPalette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  addBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.brandPrimary },
  listContent: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl },
  row: { ...Shadows.sm, flexDirection: 'row', alignItems: 'center', backgroundColor: palette.card, marginBottom: Spacing.md, borderRadius: BorderRadius.xl, padding: Spacing.md, gap: Spacing.sm },
  horseDetails: { flex: 1 },
  title: { ...Typography.body, fontWeight: '600', color: palette.textPrimary },
  sub: { ...Typography.caption, fontWeight: '400', color: palette.textSecondary, marginTop: Spacing.xs },
  meta: { ...Typography.caption, fontWeight: '400', color: palette.textSecondary, flexShrink: 1, textAlign: 'right' },
  empty: { alignItems: 'center', marginTop: Spacing.xxl },
  emptyText: { ...Typography.body, color: palette.textSecondary, marginBottom: Spacing.md },
  cta: { ...ComponentStyles.button.primary, backgroundColor: palette.brandPrimary, borderRadius: BorderRadius.lg },
  ctaText: { ...Typography.button, color: palette.onPrimary },
});

export default HorsesListScreen;
