import React, { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  FlatList,
} from 'react-native';
import MapView from 'react-native-maps';
import Feather from 'react-native-vector-icons/Feather';
import { useNavigation, CommonActions } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import SettingsModal from '../../components/Modals/SettingsModal';
import NotificationsModal from '../../components/Modals/NotificationsModal';
import { firestore } from '@/services/firebase';
import { onSnapshot, collection } from 'firebase/firestore';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';

type RootNavigationProp = StackNavigationProp<any>;
const screenWidth = Dimensions.get('window').width;
const PADDING_HORIZONTAL = 16;
const GAP_SIZE = 12;
const WIDGET_WIDTH = (screenWidth - PADDING_HORIZONTAL * 2 - GAP_SIZE) / 2;

const DASHBOARD_PROFILE_SCREENS = [
  'ProfilePage', 'Settings', 'PersonalStats', 'AchievementsScreen',
  'RideHistoryPage', 'CreateHorse', 'HorsesList', 'AdminManagement',
  'Notifications',
];

const DashboardScreen = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [sosList, setSosList] = useState<any[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  // Fetch active SOS alerts from Firebase
  useEffect(() => {
  if (!firestore) return;

  const sosActiveRef = collection(firestore, 'sos_active');
  const unsub = onSnapshot(sosActiveRef, (snap) => {
    const activeAlerts = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setSosList(activeAlerts);
  });
  return () => unsub();
}, []);

  const navigateToScreen = (screen: string) => {
    if (DASHBOARD_PROFILE_SCREENS.includes(screen)) {
      const profileTarget = screen === 'ProfilePage' ? 'ProfileMain'
        : screen === 'RideHistoryPage' ? 'RideHistory' : screen;
      if (
        profileTarget === 'PersonalStats' ||
        profileTarget === 'AchievementsScreen' ||
        profileTarget === 'RideHistory' ||
        profileTarget === 'CreateHorse'
      ) {
        navigation.navigate('ProfileStack', { screen: profileTarget, params: { fromDashboard: true } } as never);
      } else {
        navigation.navigate('ProfileStack', { screen: profileTarget } as never);
      }
      return;
    }
    if (screen === 'MappingTab') navigation.navigate('Mapping', { screen: 'LiveTracking' } as never);
    else if (screen === 'ReportsPage') navigation.navigate('Mapping', { screen: 'RideReviewScreen' } as never);
    else if (screen === 'AnalyticsPage') navigation.navigate('Analytics' as never);
    else navigation.navigate(screen as never);
  };

  const handleTrackSOS = async (sosItem: any) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Location permission required.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = current.coords;
      const url = `https://www.google.com/maps/dir/?api=1&origin=${latitude},${longitude}&destination=${sosItem.latitude},${sosItem.longitude}&travelmode=driving`;
      await Linking.openURL(url);
    } catch (err) {
      console.error('Error opening map:', err);
    }
  };

  const renderSosCard = ({ item }: { item: any }) => (
    <View style={styles.sosCard}>
      <Text style={styles.sosTitle}>🚨 SOS ALERT</Text>
      <Text style={styles.sosUser}>{item.name || 'Unknown User'}</Text>
      <TouchableOpacity style={styles.trackButton} onPress={() => handleTrackSOS(item)}>
        <Text style={styles.trackText}>Track</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPaginationDots = () => (
    <View style={styles.dotsContainer}>
      {sosList.map((_, i) => (
        <View key={i} style={[styles.dot, { opacity: i === activeIndex ? 1 : 0.3 }]} />
      ))}
    </View>
  );

  const renderNavWidget = (
    title: string,
    iconName: string,
    iconColor: string,
    targetScreen: string,
    subtitle: string,
  ) => (
    <TouchableOpacity
      key={title}
      style={styles.navWidgetContainer}
      activeOpacity={0.8}
      onPress={() => navigateToScreen(targetScreen)}
    >
      <View style={[styles.iconCircle, { backgroundColor: `${iconColor}30` }]}>
        <Feather name={iconName} size={24} color={iconColor} />
      </View>
      <Text style={styles.navWidgetTitle}>{title}</Text>
      <Text style={styles.navWidgetSubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );

  return (
    <>
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.topIcons}>
            <TouchableOpacity onPress={() => setSettingsVisible(true)}>
              <Feather name="settings" size={27} color="#374151" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setNotificationsVisible(true)}>
              <Feather name="bell" size={27} color="#374151" />
            </TouchableOpacity>
          </View>

          {/* 🔴 Scrollable SOS Section */}
          {sosList.length > 0 && (
            <View style={styles.sosSection}>
              <FlatList
                ref={flatListRef}
                data={sosList}
                renderItem={renderSosCard}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const index = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
                  setActiveIndex(index);
                }}
              />
              {renderPaginationDots()}
            </View>
          )}

          <TouchableOpacity
            style={styles.mapWidgetContainer}
            activeOpacity={0.8}
            onPress={() => navigateToScreen('MappingTab')}
          >
            <MapView
              style={styles.mapWidgetMap}
              initialRegion={{
                latitude: -33.9648,
                longitude: 25.5701,
                latitudeDelta: 0.2,
                longitudeDelta: 0.2,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
            />
            <View style={styles.mapWidgetOverlay} />
          </TouchableOpacity>

          <View style={styles.widgetGrid}>
            {renderNavWidget('My Profile', 'user', '#3b82f6', 'ProfilePage', 'View stats & edit settings')}
            {renderNavWidget('Ride History', 'calendar', '#64748b', 'RideHistoryPage', 'Browse past rides & metrics')}
            {renderNavWidget('Personal Stats', 'activity', '#059669', 'PersonalStats', 'Check your performance metrics')}
            {renderNavWidget('Achievements', 'award', '#fbbf24', 'AchievementsScreen', 'View your earned badges')}
            {renderNavWidget('Sightings / Reports', 'alert-triangle', '#f97316', 'ReportsPage', 'Report obstacles and sightings')}
            {renderNavWidget('Add New Horse', 'plus-circle', '#10b981', 'CreateHorse', 'Register a new riding companion')}
          </View>

          <View style={{ height: 30 }} />
        </ScrollView>
      </SafeAreaView>

      {settingsVisible && (
        <SettingsModal
          visible={settingsVisible}
          onClose={() => setSettingsVisible(false)}
          onRequestFullSettings={() => {
            setTimeout(() => {
              (navigation as any).dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [
                    {
                      name: 'ProfileStack',
                      state: {
                        index: 1,
                        routes: [
                          { name: 'ProfileMain' },
                          { name: 'Settings' },
                        ],
                      },
                    },
                  ],
                })
              );
            }, 0);
          }}
        />
      )}

      {notificationsVisible && (
        <NotificationsModal
          visible={notificationsVisible}
          onClose={() => setNotificationsVisible(false)}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f7' },
  scrollView: { flex: 1 },
  topIcons: { flexDirection: 'row', paddingTop: 45, justifyContent: 'space-between', marginBottom: 16, paddingHorizontal: PADDING_HORIZONTAL },
  sosSection: { marginBottom: 20 },
  sosCard: { width: screenWidth - 40, marginHorizontal: 10, padding: 20, borderRadius: 14, backgroundColor: '#fee2e2', justifyContent: 'center', alignItems: 'center' },
  sosTitle: { fontSize: 22, fontWeight: '700', color: '#dc2626', marginBottom: 5 },
  sosUser: { fontSize: 18, color: '#111', marginBottom: 10 },
  trackButton: { backgroundColor: '#dc2626', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 25 },
  trackText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  dotsContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 4, backgroundColor: '#dc2626' },
  mapWidgetContainer: { marginHorizontal: PADDING_HORIZONTAL, marginBottom: 16, backgroundColor: '#3b82f6', borderRadius: 10, overflow: 'hidden', height: 200 },
  mapWidgetMap: { ...StyleSheet.absoluteFillObject },
  mapWidgetOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },
  widgetGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', marginHorizontal: PADDING_HORIZONTAL, marginLeft: PADDING_HORIZONTAL - GAP_SIZE / 2, marginRight: PADDING_HORIZONTAL - GAP_SIZE / 2, marginBottom: 12 },
  navWidgetContainer: { width: WIDGET_WIDTH, backgroundColor: 'white', padding: 15, borderRadius: 12, marginBottom: GAP_SIZE, marginHorizontal: GAP_SIZE / 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
  iconCircle: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  navWidgetTitle: { fontSize: 14, fontWeight: '700', color: '#1f2937', marginBottom: 4 },
  navWidgetSubtitle: { fontSize: 10, color: '#6b7280', fontWeight: '500', lineHeight: 14 },
});

export default DashboardScreen;
