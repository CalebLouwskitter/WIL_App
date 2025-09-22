import ProfileStack from './ProfileStack'; 
import React, { ReactNode } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';

//Icons import
import Ionicons from 'react-native-vector-icons/Ionicons';// <-- fixed import


// Screens
import DashboardScreen from '../screens/Dashboard/DashboardScreen';
import MappingStack from './MappingStack';
import SosAlertScreen from '../screens/Sos/SosAlertScreen';
import RideStatsScreen from '../screens/Analytics/RideStatsScreen';
import SettingsScreen from '../screens/Profile/SettingsScreen';

import { Colors } from '../constants/colors';
import ProfileScreen from '../screens/Profile/ProfileScreen';

const Tab = createBottomTabNavigator();

const CustomTabBarButton = ({ children, onPress }: { children: ReactNode; onPress?: (e: any) => void }) => (
  <TouchableOpacity style={styles.sosButtonWrapper} onPress={onPress} activeOpacity={0.9}>
    <View style={styles.sosButton}>{children}</View>
  </TouchableOpacity>
);

const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        lazy:true,
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.light.primary,
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: styles.label,
        tabBarBackground: () => <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name="home-outline" color={color} size={24} />
          ),
          tabBarLabel: 'Dashboard',
        }}
      />
      <Tab.Screen
        name="Mapping"
        component={MappingStack}
        options={{
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name="map-outline" color={color} size={24} />
          ),
          tabBarLabel: 'Map',
        }}
      />
      <Tab.Screen
        name="Sos"
        component={SosAlertScreen}
        options={{
          tabBarIcon: () => (
            <View>
              <Text style={styles.sosText}>SOS</Text>
            </View>
          ),
          tabBarButton: (props) => <CustomTabBarButton {...props} />,
          tabBarLabel: '',
        }}
      />
      <Tab.Screen
        name="Analytics"
        component={RideStatsScreen}
        options={{
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name="stats-chart" color={color} size={24} />
          ),
          tabBarLabel: 'Analytics',
        }}
      />
      
      <Tab.Screen
        name="ProfileStack"
        component={ProfileStack}
        options={{
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name="person-outline" color={color} size={24} />
          ),
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    marginBottom:0,
    right: 0,
    backgroundColor: '#FFFFFF',
    height: 110,
    paddingHorizontal: 8,
    paddingBottom:1,
    paddingTop: 8,
    borderTopWidth: 0,
  },
  label: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 14,
    // @ts-ignore Android only
    includeFontPadding: false,
  },
  sosButtonWrapper: {
    top: -5,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  sosButton: {
    width: 60,
    height: 60,
    borderRadius: 35,
    backgroundColor: '#FF3535',
    alignItems: 'center',
    justifyContent: 'center',
    
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  sosText: {
    color: '#FFFFFF',
    marginTop:10,
    fontSize: 12,
    fontFamily:'Poppins',
    alignItems:'center',
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});

export default TabNavigator;
