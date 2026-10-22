import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import UserStatsScreen from '../screens/Analytics/UserStatsScreen';
import RideStatsScreen from '../screens/Analytics/RideStatsScreen';
import RideViewMoreScreen from '../screens/Analytics/RideViewMoreScreen';
import TrailStatsScreen from '../screens/Analytics/TrailStatsScreen';
import GlobalTrailStatsScreen from '../screens/Analytics/GlobalTrailStatsScreen';
import PersonalStatsScreen from '../screens/Analytics/PersonalStatsScreen';
import type { AnalyticsStackParamList } from './types';

export type { AnalyticsStackParamList };

const Stack = createStackNavigator<AnalyticsStackParamList>();

const AnalyticsStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Stats" component={GlobalTrailStatsScreen} />
      <Stack.Screen name="DetailedStats" component={UserStatsScreen} />
      <Stack.Screen name="PersonalStats" component={PersonalStatsScreen} />
      <Stack.Screen name="RideHistory" component={RideStatsScreen} />
      <Stack.Screen name="RideDetail" component={RideViewMoreScreen} />
      <Stack.Screen name="TrailStats" component={TrailStatsScreen} />
      <Stack.Screen name="GlobalStats" component={GlobalTrailStatsScreen} />
    </Stack.Navigator>
  );
};

export default AnalyticsStack;
