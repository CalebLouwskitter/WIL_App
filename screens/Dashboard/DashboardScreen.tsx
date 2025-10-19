import React from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  QuickAccessNavigation,
  EmergencyAlertBanner,
  ActivityMapWidget,
  UserFeedCard,
  TrailUsageChart,
  CommunityGoalWidget,
} from './components';

const DashboardScreen = () => {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.topIcons}>
          <TouchableOpacity 
            activeOpacity={0.7}
            onPress={() => navigation.navigate('ProfileStack', { screen: 'Settings' })}
          >
            <Feather name="settings" size={27} />
          </TouchableOpacity>
          <TouchableOpacity 
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Feather name="bell" size={27} />
          </TouchableOpacity>
        </View>

        {/* Quick Access Navigation */}
        <QuickAccessNavigation />

        {/* Emergency Alert Banner - Shows active SOS/high-priority obstacles */}
        <EmergencyAlertBanner />

        {/* Activity Map Widget - Shows recent ride stats and start buttons */}
        <ActivityMapWidget />

        {/* User Feed - Shows online users and their obstacle reports */}
        <UserFeedCard />

        {/* Trail Usage Chart - Shows riding activity over time */}
        <TrailUsageChart />

        {/* Community Goal - Shows collective progress */}
        <CommunityGoalWidget />

        {/* Bottom spacing for scroll */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
});

export default DashboardScreen;