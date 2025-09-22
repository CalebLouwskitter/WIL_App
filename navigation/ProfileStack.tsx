// navigation/ProfileStack.tsx
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import ProfileScreen from '../screens/Profile/ProfileScreen';
import PersonalStatsScreen from '../screens/Profile/PersonalStatsScreen';
import SettingsScreen from '../screens/Profile/SettingsScreen';
import CreateHorseScreen from '../screens/Profile/CreateHorseScreen';
import HorsesListScreen from '../screens/Profile/HorsesListScreen';
import AdminManagementScreen from '../screens/Profile/AdminManagementScreen';

const Stack = createStackNavigator();

const ProfileStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="PersonalStats" component={PersonalStatsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="CreateHorse" component={CreateHorseScreen} />
      <Stack.Screen name="HorsesList" component={HorsesListScreen} />
      <Stack.Screen name="AdminManagement" component={AdminManagementScreen} />
      {/* Add more profile screens as needed */}
    </Stack.Navigator>
  );
};
export type ProfileStackParamList = {
  ProfileMain: undefined;              // no params
  PersonalStats: undefined;            // no params
  AchievementsScreen: undefined;      // no params or define params if any
  CreateHorse: undefined;
  HorsesList: undefined;
  AdminManagement: undefined;
};

export default ProfileStack;
