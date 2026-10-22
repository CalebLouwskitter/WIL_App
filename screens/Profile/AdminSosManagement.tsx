import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, FlatList, RefreshControl, SafeAreaView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Feather } from '@expo/vector-icons';

import { useCurrentUser } from '../../hooks/useCurrentUser';
import type { ProfileStackParamList } from '../../navigation/ProfileStack';

import { FIREBASE_ENABLED, app } from '../../services/firebase';
import { getFirestore, collection, onSnapshot, deleteDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';

type AdminSosNavigationProp = StackNavigationProp<ProfileStackParamList, 'AdminSosManagement'>;

type SosActiveItem = {
  id: string;
  uid?: string;
  name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: string;
  timestamp?: any;
};

const AdminSosManagement: React.FC = () => {
  const navigation = useNavigation<AdminSosNavigationProp>();
  const { profile, loading: profileLoading } = useCurrentUser();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sosList, setSosList] = useState<SosActiveItem[]>([]);
  const [operationLoading, setOperationLoading] = useState<string | null>(null);

  // Access control
  useEffect(() => {
    if (!profileLoading) {
      if (profile === null) {
        Alert.alert('Access denied', 'You must be logged in to view this screen.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else if (profile.role !== 'admin') {
        Alert.alert('Access denied', 'You do not have permission to view this screen.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    }
  }, [profile, profileLoading, navigation]);

  // Subscribe to active SOS alerts
  useEffect(() => {
    let unsub: (() => void) | null = null;

    (async () => {
      try {
        if (!FIREBASE_ENABLED || !app) {
          setLoading(false);
          return;
        }
        const db = getFirestore(app);
        const sosRef = collection(db, 'sos_active');
        unsub = onSnapshot(sosRef, (snap) => {
          const items: SosActiveItem[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
          setSosList(items);
          setLoading(false);
        });
      } catch (e) {
        console.warn('[AdminSosManagement] Failed to subscribe to sos_active', e);
        setLoading(false);
      }
    })();

    return () => { if (unsub) unsub(); };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Real-time listener handles updates; just delay to show refresh UX
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  const handleCancelSos = useCallback(async (item: SosActiveItem) => {
    Alert.alert('Cancel SOS', `Are you sure you want to cancel ${item.name ?? 'this user'}'s SOS alert?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: async () => {
          if (!FIREBASE_ENABLED || !app) return;
          try {
            setOperationLoading(item.id);
            const db = getFirestore(app);
            // Remove active SOS
            await deleteDoc(doc(db, 'sos_active', item.id));
            // Mark cleared in history document bucket
            await setDoc(
              doc(db, 'SosAlerts', item.id),
              { status: 'cleared_by_admin', clearedAt: serverTimestamp() },
              { merge: true }
            );
            Alert.alert('SOS Cleared', 'The SOS alert has been cancelled.');
          } catch (e) {
            console.warn('[AdminSosManagement] Failed to cancel SOS', e);
            Alert.alert('Error', 'Failed to cancel the SOS alert.');
          } finally {
            setOperationLoading(null);
          }
        },
      },
    ]);
  }, []);

  const styles = useMemo(() => createStyles(), []);

  const renderItem = ({ item }: { item: SosActiveItem }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: '#fee2e2' }]}>
          <Ionicons name="alert-circle" size={22} color="#b91c1c" />
        </View>
        <View style={styles.cardTitleContainer}>
          <Text style={styles.cardTitle}>{item.name ?? 'Unknown User'}</Text>
          <Text style={styles.cardSubtitle}>Active SOS</Text>
        </View>
        <View style={[styles.statusPill, styles.activePill]}>
          <Text style={styles.statusPillText}>active</Text>
        </View>
      </View>


      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleCancelSos(item)}
          disabled={operationLoading === item.id}
        >
          {operationLoading === item.id ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Feather name="x-circle" size={18} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Cancel SOS</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  if (profileLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            accessibilityLabel="Go back"
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          >
            <View style={styles.iconButton}>
              <Ionicons name="chevron-back" size={24} color="#111" />
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.title}>SOS Alerts</Text>
          </View>
          <View style={{ width: 48 }} />
        </View>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={{ marginTop: 16, color: '#6B7280' }}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        >
          <View style={styles.iconButton}>
            <Ionicons name="chevron-back" size={24} color="#111" />
          </View>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title}>SOS Alerts</Text>
        </View>
        <View style={{ width: 48 }} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <FlatList
          data={sosList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={sosList.length ? styles.listContent : styles.emptyContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="check" size={42} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>No active SOS alerts</Text>
              <Text style={styles.emptySubtitle}>No active SOS alerts.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

function createStyles() {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#E5E7EB',
    },
    backButton: { padding: 4 },
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F3F4F6',
    },
    title: { fontSize: 18, fontWeight: '600', color: '#111827' },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    listContent: { padding: 16 },
    emptyContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    emptyState: { alignItems: 'center' },
    emptyTitle: { marginTop: 12, fontSize: 16, fontWeight: '600', color: '#111827' },
    emptySubtitle: { marginTop: 4, fontSize: 14, color: '#6B7280' },

    card: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#E5E7EB',
      borderRadius: 12,
      padding: 12,
      backgroundColor: '#fff',
      marginBottom: 12,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center' },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    cardTitleContainer: { flex: 1 },
    cardTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
    cardSubtitle: { fontSize: 12, color: '#6B7280' },
    statusPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    activePill: { backgroundColor: '#fee2e2' },
    statusPillText: { fontSize: 12, color: '#b91c1c', fontWeight: '600' },

    

    actionsRow: { flexDirection: 'row', marginTop: 12 },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 8,
      flex: 1,
    },
    deleteButton: { backgroundColor: '#EF4444' },
    actionButtonText: { color: '#fff', fontWeight: '600', marginLeft: 8 },
  });
}

export default AdminSosManagement;
