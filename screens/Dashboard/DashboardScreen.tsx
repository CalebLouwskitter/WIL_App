import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import Feather from 'react-native-vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

type RootNavigationProp = StackNavigationProp<any>;

const DashboardScreen = () => {
  const navigation = useNavigation<RootNavigationProp>();

  // A common function for navigation
  const navigateToMaps = () => navigation.navigate('MapsPage' as never);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.topIcons}>
          <TouchableOpacity 
            activeOpacity={0.7}
            onPress={() => navigation.navigate('ProfileStack', { screen: 'Settings' } as never)}
          >
            <Feather name="settings" size={27} color="#374151" />
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7}>
            <Feather name="bell" size={27} color="#374151" />
          </TouchableOpacity>
        </View>

        {/* EMERGENCY ALERT */}
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

        {/* MAP WIDGET */}
        <TouchableOpacity 
          style={styles.mapWidgetContainer}
          onPress={navigateToMaps}
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
            <Marker
              coordinate={{ latitude: -33.9648, longitude: 25.5701 }}
              title="Port Elizabeth"
              description="Start your ride here"
            />
          </MapView>
          <View style={styles.mapWidgetOverlay}>
            <View style={styles.mapWidgetContent}>
              <Text style={styles.mapWidgetTitle}>Port Elizabeth</Text>
              <Text style={styles.mapWidgetSubtitle}>Start your ride</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* START RIDE WIDGET */}
        <View style={styles.singleCardGroup}>
          <TouchableOpacity 
            style={styles.cardWrapperFixed}
            activeOpacity={0.8}
            onPress={navigateToMaps}
          >
            <View style={styles.startRideCardInner}>
                <TouchableOpacity style={styles.startButtonWidget} disabled={true}> 
                    <Feather name="anchor" size={14} color="white" />
                    <Text style={styles.startButtonText}>Start Ride</Text>
                </TouchableOpacity>
                <View style={styles.rideInfoWidget}>
                    <View style={styles.infoRow}>
                        <Feather name="maximize-2" size={10} color="#6b7280" style={{ transform: [{ rotate: '90deg' }] }} />
                        <Text style={styles.infoTextWidget}>Distance: 2.5 km</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Feather name="clock" size={10} color="#6b7280" />
                        <Text style={styles.infoTextWidget}>Duration: 34 min</Text>
                    </View>
                </View>
            </View>
          </TouchableOpacity>
        </View>
        
        {/* USER PROFILES */}
        <View style={styles.singleCardGroup}>
          <TouchableOpacity 
            style={styles.cardWrapperFixed}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('ProfileStack' as never)}
          >
            <View style={styles.profileCardCleanInner}>
              <Feather name="user" size={24} color="#3b82f6" style={styles.userIcon} />
              <Text style={styles.profileNameClean}>Rose Smith</Text>
              <Text style={styles.profileEmailClean}>rose.smith@gmail.com</Text>
              <View style={styles.profileStatsClean}>
                <View style={styles.statGroup}>
                  <Text style={styles.statTitleClean}>Rides</Text>
                  <Text style={styles.statValueClean}>42</Text>
                </View>
                <View style={styles.statGroup}>
                  <Text style={styles.statTitleClean}>Distance</Text>
                  <Text style={styles.statValueClean}>123.5 km</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.singleCardGroup}>
          <TouchableOpacity 
            style={styles.cardWrapperFixed}
            activeOpacity={0.8}
            onPress={navigateToMaps}
          >
            <View style={styles.obstacleReportCardInner}>
              <Feather name="alert-triangle" size={16} color="#f97316" />
              <Text style={styles.obstacleTitleNew}>Report Obstacle</Text>
              <Text style={styles.obstacleDescNew}>Tree blocking trail</Text>
              <TouchableOpacity style={styles.submitButtonNew} disabled={true}>
                <Text style={styles.submitTextNew}>Submit</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>

        {/* ANALYTICS AND DATA */}
        <TouchableOpacity style={styles.chartContainer} activeOpacity={0.8}>
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

        {/* COMMUNITY GOAL */}
        <View style={styles.communityGoal}>
          <View style={styles.goalLeft}>
            <Feather name="sun" size={20} color="#fbbf24" style={{ marginRight: 8 }} />
            <View>
              <Text style={styles.goalTitle}>Community Goal</Text>
              <Text style={styles.goalProgress}>📍 Green Bay Beach Trail</Text>
              <Text style={styles.goalProgress}>47/100km</Text>
            </View>
          </View>
          <View style={styles.goalRight}>
            <Text style={styles.goalNumber}>30</Text>
            <Text style={styles.goalLabel}>Riders</Text>
          </View>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

// =========================================================================
// STYLESHEET
// =========================================================================

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
    paddingHorizontal: 16,
  },

  // Emergency Alert
  emergencyAlert: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    marginHorizontal: 16,
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

  // Map Widget
  mapWidgetContainer: {
    marginHorizontal: 16,
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
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  mapWidgetContent: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    flex: 1,
  },
  mapWidgetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  mapWidgetSubtitle: {
    fontSize: 12,
    color: '#dbeafe',
    marginTop: 4,
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

  singleCardGroup: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  
  cardWrapperFixed: {
    width: '50%',
    marginRight: 10,
  },

  // Start Ride Card (Inner View for styling)
  startRideCardInner: {
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  startButtonWidget: {
    flexDirection: 'row',
    backgroundColor: '#22c55e',
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  startButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
  rideInfoWidget: {
    width: '100%',
    paddingHorizontal: 5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoTextWidget: {
    fontSize: 11,
    color: '#6b7280',
    marginLeft: 5,
  },

  // Profile Card (Inner View for styling)
  profileCardCleanInner: {
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  userIcon: {
    backgroundColor: '#bfdbfe',
    borderRadius: 20,
    padding: 5,
    marginBottom: 5,
  },
  profileNameClean: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  profileEmailClean: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 8,
  },
  profileStatsClean: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '90%',
  },
  statGroup: {
    alignItems: 'center',
  },
  statTitleClean: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 2,
  },
  statValueClean: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
  },

  // Obstacle Report Card (Inner View for styling)
  obstacleReportCardInner: {
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  obstacleTitleNew: {
    fontSize: 12,
    color: '#f97316',
    fontWeight: '600',
    marginTop: 5,
  },
  obstacleDescNew: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 8,
  },
  submitButtonNew: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 20,
    paddingVertical: 4,
    borderRadius: 6,
  },
  submitTextNew: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },

  // Chart
  chartContainer: {
    backgroundColor: 'white',
    marginHorizontal: 16,
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

  // Community Goal
  communityGoal: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  goalLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  goalTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  goalProgress: {
    fontSize: 10,
    color: '#6b7280',
    lineHeight: 14,
  },
  goalRight: {
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  goalNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fbbf24',
  },
  goalLabel: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '500',
  },
});

export default DashboardScreen;