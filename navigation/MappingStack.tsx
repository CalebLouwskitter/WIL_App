import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LiveTrackingScreen from '../screens/Mapping/LiveTrackingScreen';
import SelectHorseScreen from '../screens/Mapping/SelectHorseScreen';
import RideReviewScreen from '@/screens/Mapping/RideReviewScreen';
import type { RideData } from '@/hooks/useRideTracker';

export type MappingStackParamList = {
  LiveTracking: undefined;
  SelectHorse: undefined;
  RideReviewScreen: { rideData?: RideData; rideId?: string } | undefined;
};

const Stack = createStackNavigator<MappingStackParamList>();

const MappingStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LiveTracking" component={LiveTrackingScreen} />
      <Stack.Screen name="SelectHorse" component={SelectHorseScreen} />
      <Stack.Screen name="RideReviewScreen" component={RideReviewScreen} />
    </Stack.Navigator>
  );
};

export default MappingStack;
