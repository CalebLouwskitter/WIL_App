import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import UserStatsScreen from '../screens/Analytics/UserStatsScreen';
import PersonalStatsScreen from '../screens/Analytics/PersonalStatsScreen';
import RideStatsScreen from '../screens/Analytics/RideStatsScreen';
import RideViewMoreScreen from '../screens/Analytics/RideViewMoreScreen';
import TrailStatsScreen from '../screens/Analytics/TrailStatsScreen';

export type AnalyticsStackParamList = {
  Stats: undefined;
  DetailedStats: { fromDashboard?: boolean };
  RideHistory: undefined;
  RideDetail: { startTime: number };
  TrailStats: undefined;
};

const Stack = createStackNavigator<AnalyticsStackParamList>();

const AnalyticsStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Stats" component={UserStatsScreen} />
      <Stack.Screen name="DetailedStats" component={PersonalStatsScreen} />
      <Stack.Screen name="RideHistory" component={RideStatsScreen} />
      <Stack.Screen name="RideDetail" component={RideViewMoreScreen} />
      <Stack.Screen name="TrailStats" component={TrailStatsScreen} />
    </Stack.Navigator>
  );
};

export default AnalyticsStack;
