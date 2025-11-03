import ProfileStack from './ProfileStack'; 
import React, { ReactNode } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

//Icons import
import { Feather } from '@expo/vector-icons';


// Screens
import DashboardScreen from '../screens/Dashboard/DashboardScreen';
import MappingStack from './MappingStack';
import SosAlertScreen from '../screens/Sos/SosAlertScreen';
import AnalyticsStack from './AnalyticsStack';

import { Colors } from '../constants/colors';

const Tab = createBottomTabNavigator();

const CustomTabBarButton = ({ children, onPress }: { children: ReactNode; onPress?: (e: any) => void }) => (
  <TouchableOpacity style={styles.sosButtonWrapper} onPress={onPress} activeOpacity={0.9}>
    <View style={styles.sosButton}>{children}</View>
  </TouchableOpacity>
);

const TabNavigator = () => {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={{
        lazy:true,
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: {
          ...styles.tabBar,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
        },
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
            <Feather name="home" color={color} size={24} />
          ),
          tabBarLabel: 'Dashboard',
        }}
      />
      <Tab.Screen
        name="Mapping"
        component={MappingStack}
        options={{
          tabBarIcon: ({ focused, color, size }) => (
            <Feather name="map" color={color} size={24} />
          ),
          tabBarLabel: 'Map',
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            (navigation as any).dispatch(
              CommonActions.reset({
                index: 0,
                routes: [
                  {
                    name: 'Mapping',
                    state: { index: 0, routes: [{ name: 'LiveTracking' }] },
                  } as any,
                ],
              })
            );
          },
        })}
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
        component={AnalyticsStack}
        options={{
          tabBarIcon: ({ focused, color, size }) => (
            <Feather name="trending-up" color={color} size={24} />
          ),
          tabBarLabel: 'Analytics',
        }}
      />
      
      <Tab.Screen
        name="ProfileStack"
        component={ProfileStack}
        options={{
          tabBarIcon: ({ focused, color, size }) => (
            <Feather name="user" color={color} size={24} />
          ),
          tabBarLabel: 'Profile',
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            (navigation as any).dispatch(
              CommonActions.reset({
                index: 0,
                routes: [
                  {
                    name: 'ProfileStack',
                    state: { index: 0, routes: [{ name: 'ProfileMain' }] },
                  } as any,
                ],
              })
            );
          },
        })}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
