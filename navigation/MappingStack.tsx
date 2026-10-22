import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LiveTrackingScreen from '../screens/Mapping/LiveTrackingScreen';
import SelectHorseScreen from '../screens/Mapping/SelectHorseScreen';
import RideReviewScreen from '@/screens/Mapping/RideReviewScreen';
import MarkObstacleScreen from '@/screens/Mapping/MarkObstacleScreen';
import OnlineUsersScreen from '../screens/Mapping/OnlineUsers';
import DuringRideScreen from '../screens/Mapping/DuringRideScreen';
import ObstacleViewUpdated from '../screens/Mapping/ObstacleViewUpdated';
import type { MappingStackParamList } from './types';

export type { MappingStackParamList };

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
