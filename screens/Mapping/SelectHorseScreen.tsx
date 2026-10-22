import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, useColorScheme, Alert } from 'react-native';
import { Feather as Icon, FontAwesome5 as FAIcon } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MappingStackParamList, TabParamList } from '@/navigation/types';
import { getHorses, setActiveHorseId, getActiveHorseId, deleteHorse, type Horse } from '../../services/HorseStorage';
import { useAppTheme } from '../../hooks/useAppTheme';
import { getRides } from '../../services/RideStorage';

type SelectHorseNavigationProp = StackNavigationProp<MappingStackParamList, 'SelectHorse'>;

const SelectHorseScreen = () => {
  const nav = useNavigation<SelectHorseNavigationProp>();
  const [horses, setHorses] = useState<Horse[]>([]);
  const [rideCounts, setRideCounts] = useState<Record<string, number>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const { palette, isDark } = useAppTheme();

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

  const onDelete = async (id: string, name: string) => {
    Alert.alert(
      'Delete Horse',
      `Are you sure you want to delete ${name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteHorse(id);
            await load();
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: Horse }) => {
    const isActive = item.id === activeId;
    const rideCount = rideCounts[item.id] || 0;
    return (
      <TouchableOpacity 
        style={[
          styles.row, 
          { backgroundColor: palette.card }, 
          isActive && styles.activeRow,
          isActive && { borderColor: palette.brandPrimary }
        ]} 
        onPress={() => onSelect(item.id)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.horseIconContainer,
            { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)' },
          ]}
        >
          <FAIcon name="horse" size={24} color={isActive ? palette.brandPrimary : palette.textSecondary} />
        </View>
        <View style={styles.horseInfo}>
          <Text style={[styles.title, { color: palette.textPrimary }]}>{item.name}</Text>
          <View style={styles.detailsRow}>
            {item.breed && (
              <View
                style={[
                  styles.detailChip,
                  { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)' },
                ]}
              >
                <Text style={[styles.detailText, { color: palette.textSecondary }]}>{item.breed}</Text>
              </View>
            )}
            {item.age && (
              <View
                style={[
                  styles.detailChip,
                  { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)' },
                ]}
              >
                <Text style={[styles.detailText, { color: palette.textSecondary }]}>{item.age} yrs</Text>
              </View>
            )}
            {rideCount > 0 && (
              <View style={[styles.detailChip, styles.rideCountChip, { backgroundColor: palette.brandSoft }]}>
                <Icon name="navigation" size={12} color={palette.brandPrimary} style={{ marginRight: 4 }} />
                <Text style={[styles.detailText, { color: palette.brandPrimary }]}>{rideCount} rides</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.rightControls}>
          <TouchableOpacity
            onPress={() => onDelete(item.id, item.name)}
            style={[
              styles.deleteBtn,
              { backgroundColor: isDark ? 'rgba(244, 63, 94, 0.2)' : 'rgba(244, 63, 94, 0.1)' },
            ]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${item.name}`}
          >
            <Icon name="trash-2" size={16} color={palette.danger} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity 
          onPress={() => nav.goBack()} 
          style={[styles.backBtn, { backgroundColor: palette.card }]}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-left" size={22} color={palette.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.textPrimary }]}>Select Your Horse</Text>
        <TouchableOpacity 
          onPress={() => nav.getParent<BottomTabNavigationProp<TabParamList>>()?.navigate('ProfileStack', { screen: 'CreateHorse', params: { returnToSelectHorse: true } })} 
          style={[styles.addBtn, { backgroundColor: palette.brandPrimary }]}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Add new horse"
        >
          <Icon name="plus" size={20} color={palette.onPrimary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={horses}
        keyExtractor={(h) => h.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <FAIcon name="horse" size={56} color={palette.textMuted} style={{ opacity: 0.3, marginBottom: 16 }} />
            <Text style={[styles.emptyText, { color: palette.textSecondary, fontWeight: '600' }]}>No horses added yet</Text>
            <Text style={[styles.emptyText, { color: palette.textMuted, fontSize: 14, marginTop: -12, marginBottom: 24 }]}>Add your first horse to start tracking rides</Text>
            <TouchableOpacity 
              style={[styles.cta, { backgroundColor: palette.brandPrimary }]} 
              onPress={() => nav.getParent<BottomTabNavigationProp<TabParamList>>()?.navigate('ProfileStack', { screen: 'CreateHorse', params: { returnToSelectHorse: true } })}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Add Your First Horse"
            >
              <Text style={[styles.ctaText, { color: palette.onPrimary }]}>Add Your First Horse</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingTop: 50, 
    paddingHorizontal: 20, 
    paddingBottom: 16,
    marginBottom: 8 
  },
  backBtn: { 
    width: 40, 
    height: 40, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  headerTitle: { 
    fontSize: 22, 
    fontWeight: '700',
    letterSpacing: -0.5
  },
  addBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4
  },
  row: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginHorizontal: 16,
    marginTop: 12, 
    borderRadius: 20, 
    padding: 16, 
    shadowColor: '#000', 
    shadowOpacity: 0.08, 
    shadowRadius: 12, 
    shadowOffset: { width: 0, height: 4 }, 
    elevation: 3,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  activeRow: {
    borderWidth: 2,
    shadowOpacity: 0.15,
    transform: [{ scale: 1.02 }]
  },
  horseIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  horseInfo: {
    flex: 1
  },
  title: { 
    fontSize: 18, 
    fontWeight: '700',
    marginBottom: 6
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  detailChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center'
  },
  rideCountChip: {},
  detailText: {
    fontSize: 12,
    fontWeight: '600'
  },
  checkContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2C5530',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { 
    alignItems: 'center', 
    marginTop: 80,
    paddingHorizontal: 32
  },
  emptyText: { 
    marginBottom: 20,
    fontSize: 16,
    textAlign: 'center'
  },
  cta: { 
    borderRadius: 20, 
    paddingHorizontal: 32, 
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6
  },
  ctaText: { 
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5
  },
});

export default SelectHorseScreen;

