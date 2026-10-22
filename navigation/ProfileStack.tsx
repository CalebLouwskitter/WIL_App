// navigation/ProfileStack.tsx
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import ProfileScreen from '../screens/Profile/ProfileScreen';
import PersonalStatsScreen from '../screens/Analytics/PersonalStatsScreen';
import AchievementsScreen from '../screens/Profile/AchievementsScreen';
import SettingsScreen from '../screens/Profile/SettingsScreen';
import CreateHorseScreen from '../screens/Profile/CreateHorseScreen';
import HorsesListScreen from '../screens/Profile/HorsesListScreen';
import AdminManagementScreen from '../screens/Profile/AdminManagementScreen';
import ObservationsScreen from '../screens/Profile/ObservationsScreen';
import AdminNotificationManagement from '../screens/Profile/AdminNotificationManagement';
import AdminObstacleManagement from '../screens/Profile/AdminObstacleManagement';
import AdminSosManagement from '../screens/Profile/AdminSosManagement';

import RideViewMoreScreen from '../screens/Analytics/RideViewMoreScreen';
import HistoryScreen from '../screens/Profile/HistoryScreen';
import UserNotificationsScreen from '../screens/Profile/UserNotificationsScreen';

const Stack = createStackNavigator();

const ProfileStack = () => {
  return (
    <Stack.Navigator initialRouteName="ProfileMain" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="PersonalStats" component={PersonalStatsScreen} />
      <Stack.Screen name="AchievementsScreen" component={AchievementsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="CreateHorse" component={CreateHorseScreen} />
      <Stack.Screen name="HorsesList" component={HorsesListScreen} />
      <Stack.Screen name="AdminManagement" component={AdminManagementScreen} />
      <Stack.Screen name="AdminNotificationManagement" component={AdminNotificationManagement} />
      <Stack.Screen name="AdminObstacleManagement" component={AdminObstacleManagement} />
      <Stack.Screen name="AdminSosManagement" component={AdminSosManagement} />
      <Stack.Screen name="Notifications" component={UserNotificationsScreen} />
      <Stack.Screen name="Observations" component={ObservationsScreen} />
      <Stack.Screen name="RideHistory" component={HistoryScreen} />
      <Stack.Screen name="RideDetail" component={RideViewMoreScreen} />
      {/* Add more profile screens as needed */}
    </Stack.Navigator>
  );
};
export type ProfileStackParamList = {
  ProfileMain: undefined;              // no params
  PersonalStats: undefined;            // no params
  AchievementsScreen: undefined;      // no params or define params if any
  Settings: undefined;                 // settings screen
  CreateHorse: undefined;
  HorsesList: undefined;
  AdminManagement: undefined;
  AdminNotificationManagement: undefined;
  AdminObstacleManagement: undefined;
  AdminSosManagement: undefined;
  Notifications: undefined;
  Observations: undefined;
  RideHistory: undefined;
  RideDetail: { startTime: number };
};

export default ProfileStack;
