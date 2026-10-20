import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LiveTrackingScreen from '../screens/Mapping/LiveTrackingScreen';
import SelectHorseScreen from '../screens/Mapping/SelectHorseScreen';
import RideReviewScreen from '@/screens/Mapping/RideReviewScreen';
import MarkObstacleScreen from '@/screens/Mapping/MarkObstacleScreen';
import OnlineUsersScreen from '../screens/Mapping/OnlineUsers';
import DuringRideScreen from '../screens/Mapping/DuringRideScreen';
import ObstacleViewUpdated from '../screens/Mapping/ObstacleViewUpdated';
import type { RideData } from '@/hooks/useRideTracker';

export type MappingStackParamList = {
  LiveTracking: { followSosUid?: string; followSosDisplayName?: string; autoStart?: boolean } | undefined;
  SelectHorse: undefined;
  RideReviewScreen: { rideData?: RideData; rideId?: string } | undefined;
  MarkObstacle: { location?: { latitude: number; longitude: number } } | undefined;
  OnlineUsers: undefined;
  DuringRideScreen: { rideData?: RideData; rideId?: string; initialTab?: 'sighting' | 'report' | 'obstacles' } | undefined;
  ObstacleViewUpdated: { rideData?: RideData; rideId?: string; initialTab?: 'sighting' | 'report' | 'obstacles' } | undefined;
};

const Stack = createStackNavigator<MappingStackParamList>();

const MappingStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LiveTracking" component={LiveTrackingScreen} />
      <Stack.Screen name="SelectHorse" component={SelectHorseScreen} />
      <Stack.Screen name="RideReviewScreen" component={RideReviewScreen} />
      <Stack.Screen name="DuringRideScreen" component={DuringRideScreen} />
      <Stack.Screen name="ObstacleViewUpdated" component={ObstacleViewUpdated} />
      <Stack.Screen name="MarkObstacle" component={MarkObstacleScreen} />
      <Stack.Screen name="OnlineUsers" component={OnlineUsersScreen} />
    </Stack.Navigator>
  );
};

export default MappingStack;
