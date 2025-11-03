import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { getRides } from '../../services/RideStorage';
import type { RideData } from '../../hooks/useRideTracker';
import { useCallback, useState } from 'react';

type RouteParams = {
  fromDashboard?: boolean;
  fromMapping?: boolean;
};

const HistoryScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
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
          <Feather name="arrow-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.title}>Ride History</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.body}>
        {loading ? (
          <Text style={styles.placeholder}>Loading...</Text>
        ) : rides.length === 0 ? (
          <Text style={styles.placeholder}>Your ride history will appear here.</Text>
        ) : (
          <FlatList
            data={rides}
            keyExtractor={(item, index) => `${item.startTime}-${index}`}
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
                    <Feather name="navigation" size={18} color="#3B82F6" />
                  </View>
                  <View>
                    <Text style={styles.itemTitle}>Ride #{rides.length - index}</Text>
                    <Text style={styles.itemSub}>
                      {new Date(item.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {item.horseName ? ` • ${item.horseName}` : ''}
                    </Text>
                  </View>
                </View>
                <View style={styles.itemRight}>
                  <Text style={styles.itemDistValue}>{(item.totalDistance / 1000).toFixed(1)}</Text>
                  <Text style={styles.itemDistUnit}>km</Text>
                </View>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            contentContainerStyle={{ paddingVertical: 12 }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: '700', color: '#0F172A' },
  body: { flex: 1, padding: 20 },
  placeholder: { color: '#64748B', fontSize: 14, textAlign: 'center', marginTop: 24 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemTitle: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  itemSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  itemRight: { alignItems: 'flex-end' },
  itemDistValue: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  itemDistUnit: { fontSize: 12, color: '#64748B' },
});

export default HistoryScreen;
