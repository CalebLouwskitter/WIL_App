import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Feather as Icon } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getHorses, type Horse } from '../../services/HorseStorage';

const HorsesListScreen = () => {
  const nav = useNavigation<any>();
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
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{item.name}</Text>
        <Text style={styles.sub}>{[item.breed, item.age ? `${item.age} yrs` : undefined].filter(Boolean).join(' • ') || '—'}</Text>
      </View>
      <Text style={styles.meta}>{new Date(item.createdAt).toLocaleDateString()}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
          <Icon name="chevron-left" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Horses</Text>
        <TouchableOpacity onPress={() => nav.navigate('CreateHorse')} style={styles.addBtn}>
          <Icon name="plus" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={horses}
        keyExtractor={(h) => h.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={!loading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No horses yet.</Text>
            <TouchableOpacity style={styles.cta} onPress={() => nav.navigate('CreateHorse')}>
              <Text style={styles.ctaText}>Add your first horse</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FE' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 40, paddingHorizontal: 16, marginBottom: 8 },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#fff' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2D2D2D' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginTop: 12, borderRadius: 16, padding: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  title: { fontSize: 16, fontWeight: '600' },
  sub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  meta: { fontSize: 12, color: '#6B7280' },
  empty: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#6B7280', marginBottom: 12 },
  cta: { backgroundColor: '#2D2D2D', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10 },
  ctaText: { color: '#fff', fontWeight: '700' },
});

export default HorsesListScreen;
