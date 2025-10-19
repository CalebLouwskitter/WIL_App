import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, useColorScheme } from 'react-native';
import { Feather as Icon } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getHorses, setActiveHorseId, getActiveHorseId, type Horse } from '../../services/HorseStorage';
import { Colors } from '@/constants/colors';
import { getRides } from '../../services/RideStorage';

const SelectHorseScreen = () => {
  const nav = useNavigation<any>();
  const [horses, setHorses] = useState<Horse[]>([]);
  const [rideCounts, setRideCounts] = useState<Record<string, number>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];

  const load = async () => {
    const [list, id, rides] = await Promise.all([getHorses(), getActiveHorseId(), getRides()]);
    setHorses(list);
    setActiveId(id);
    const counts: Record<string, number> = {};
    for (const r of rides) {
      const hid = r.horseId || '';
      if (!hid) continue;
      counts[hid] = (counts[hid] || 0) + 1;
    }
    setRideCounts(counts);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const onSelect = async (id: string) => {
    await setActiveHorseId(id);
    setActiveId(id);
    nav.goBack();
  };

  const renderItem = ({ item }: { item: Horse }) => {
    const isActive = item.id === activeId;
    return (
      <TouchableOpacity style={[styles.row, { backgroundColor: palette.cardElevated }, isActive && { borderWidth: 1, borderColor: palette.brandPrimary }]} onPress={() => onSelect(item.id)}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: palette.onSurface }]}>{item.name}</Text>
          <Text style={[styles.sub, { color: palette.onSurfaceVariant }]}>
            {[
              item.breed,
              item.age ? `${item.age} yrs` : undefined,
              typeof rideCounts[item.id] === 'number' ? `${rideCounts[item.id]} rides` : undefined,
            ].filter(Boolean).join(' • ') || '—'}
          </Text>
        </View>
        {isActive ? <Icon name="check" size={18} color={palette.brandPrimary} /> : <Icon name="chevron-right" size={18} color={palette.onSurfaceVariant} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.brandMuted }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => nav.goBack()} style={[styles.backBtn, { backgroundColor: palette.cardElevated }]}>
          <Icon name="chevron-left" size={24} color={palette.onSurface} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.onSurface }]}>Select Horse</Text>
        <TouchableOpacity onPress={() => nav.navigate('ProfileStack', { screen: 'CreateHorse' })} style={[styles.addBtn, { backgroundColor: palette.brandPrimary }]}>
          <Icon name="plus" size={18} color={palette.onPrimary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={horses}
        keyExtractor={(h) => h.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: palette.onSurfaceVariant }]}>No horses yet.</Text>
            <TouchableOpacity style={[styles.cta, { backgroundColor: palette.brandPrimary }]} onPress={() => nav.navigate('ProfileStack', { screen: 'CreateHorse' })}>
              <Text style={[styles.ctaText, { color: palette.onPrimary }]}>Add a horse</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 40, paddingHorizontal: 16, marginBottom: 8 },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 12, borderRadius: 16, padding: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  title: { fontSize: 16, fontWeight: '600' },
  sub: { fontSize: 12, marginTop: 2 },
  empty: { alignItems: 'center', marginTop: 40 },
  emptyText: { marginBottom: 12 },
  cta: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10 },
  ctaText: { fontWeight: '700' },
});

export default SelectHorseScreen;

