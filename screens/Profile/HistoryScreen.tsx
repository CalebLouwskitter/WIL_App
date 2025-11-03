import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

type RouteParams = {
  fromDashboard?: boolean;
  fromMapping?: boolean;
};

const HistoryScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();

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
        <Text style={styles.placeholder}>Your ride history will appear here.</Text>
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
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  placeholder: { color: '#64748B', fontSize: 14, textAlign: 'center' },
});

export default HistoryScreen;
