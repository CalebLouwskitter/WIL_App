import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, Dimensions } from 'react-native';
import MapView from 'react-native-maps';
import Feather from 'react-native-vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

type RootNavigationProp = StackNavigationProp<any>;
const screenWidth = Dimensions.get('window').width;
const PADDING_HORIZONTAL = 16;
const GAP_SIZE = 12;
const WIDGET_WIDTH = (screenWidth - (PADDING_HORIZONTAL * 2) - GAP_SIZE) / 2;


const DashboardScreen = () => {
  const navigation = useNavigation<RootNavigationProp>();

  const navigateToScreen = (screen: string) => {
    const profileScreens = ['ProfilePage', 'Settings', 'PersonalStats', 'AchievementsScreen', 'CreateHorse', 'HorsesList', 'AdminManagement', 'Notifications'];

    if (profileScreens.includes(screen)) {
      let profileScreenName = screen;
      if (screen === 'ProfilePage') {
          profileScreenName = 'ProfileMain';
      }
      
      navigation.navigate('ProfileStack', { screen: profileScreenName } as never);

    } else if (screen === 'MappingTab') {
      // FIX: Explicitly navigate to the 'LiveTracking' screen inside the 'Mapping' tab 
      // to ensure the Map widget always opens the map and not a previously opened screen like 'RideReviewScreen'.
      navigation.navigate('Mapping', { screen: 'LiveTracking' } as never); 
      
    } else if (screen === 'ReportsPage') {
        navigation.navigate('Mapping', { screen: 'RideReviewScreen' } as never);

    } else {
      navigation.navigate(screen as never);
    }
  };

  const renderNavWidget = (
    title: string, 
    iconName: string, 
    iconColor: string, 
    targetScreen: string,
    subtitle: string
  ) => (
    <TouchableOpacity
      style={styles.navWidgetContainer}
      activeOpacity={0.8}
      onPress={() => navigateToScreen(targetScreen)}
    >
      <View style={[styles.iconCircle, { backgroundColor: iconColor + '30' }]}>
        <Feather name={iconName} size={24} color={iconColor} />
      </View>
      <Text style={styles.navWidgetTitle}>{title}</Text>
      <Text style={styles.navWidgetSubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>

        <View style={styles.topIcons}>
          <TouchableOpacity 
            activeOpacity={0.7}
            onPress={() => navigateToScreen('Settings')}
          >
            <Feather name="settings" size={27} color="#374151" />
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7}>
            <Feather name="bell" size={27} color="#374151" />
          </TouchableOpacity>
        </View>

        <View style={styles.emergencyAlert}>
          <View style={styles.alertLeft}>
            <Text style={styles.alertIcon}>⚠️</Text>
            <Text style={styles.alertText}>John Needs Help!</Text>
          </View>
          <View style={styles.alertButtons}>
            <TouchableOpacity style={styles.trackButton}>
              <Text style={styles.buttonText}>Track</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.callButton}>
              <Text style={styles.buttonText}>📞 Call</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.mapWidgetContainer}
          onPress={() => navigateToScreen('MappingTab')}
          activeOpacity={0.8}
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
          >
          </MapView>
          
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

        
        <TouchableOpacity 
          style={styles.chartContainer} 
          activeOpacity={0.8}
          onPress={() => navigateToScreen('AnalyticsPage')}
        >
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Analytics & Data</Text>
            <View style={styles.chartTrendBox}>
              <Feather name="arrow-up" size={12} color="#16a34a" />
              <Text style={styles.chartTrend}>6%</Text>
            </View>
          </View>
          
          <View style={styles.chartBars}>
            {[70, 90, 75, 100, 75, 50, 60].map((height, index) => (
              <View key={index} style={[styles.chartBar, { height: height * 0.7 }]} />
            ))}
          </View>
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f7',
  },
  scrollView: {
    flex: 1,
  },
  topIcons: {
    flexDirection: 'row',
    paddingTop: 45,
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: PADDING_HORIZONTAL,
  },

  emergencyAlert: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    marginHorizontal: PADDING_HORIZONTAL,
    marginVertical: 8,
    padding: 12,
    borderRadius: 8,
  },
  alertLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  alertText: {
    color: 'white',
    fontWeight: '600',
  },
  alertButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  trackButton: {
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  callButton: {
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  buttonText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },

  mapWidgetContainer: {
    marginHorizontal: PADDING_HORIZONTAL,
    marginBottom: 16,
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    overflow: 'hidden',
    height: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  mapWidgetMap: {
    ...StyleSheet.absoluteFillObject,
  },
  mapWidgetOverlay: {
    
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  
  mapWidgetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  mapWidgetSubtitle: {
    fontSize: 12,
    color: '#dbeafe',
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  mapWidgetButton: { 
    backgroundColor: '#22c55e',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mapWidgetButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },

  widgetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginHorizontal: PADDING_HORIZONTAL,
    marginLeft: PADDING_HORIZONTAL - (GAP_SIZE / 2),
    marginRight: PADDING_HORIZONTAL - (GAP_SIZE / 2),
    marginBottom: 12,
  },
  navWidgetContainer: {
    width: WIDGET_WIDTH,
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: GAP_SIZE,
    marginHorizontal: GAP_SIZE / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  navWidgetTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  navWidgetSubtitle: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '500',
    lineHeight: 14,
  },

  chartContainer: {
    backgroundColor: 'white',
    marginHorizontal: PADDING_HORIZONTAL,
    marginVertical: 8,
    padding: 16,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  chartTrendBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  chartTrend: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '600',
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 80,
    marginBottom: 8,
    gap: 6,
  },
  chartBar: {
    flex: 1,
    backgroundColor: '#3b82f6',
    borderRadius: 2,
  },
});

export default DashboardScreen;