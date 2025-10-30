// RideReviewScreen.tsx
import React from 'react';
import UnifiedRideObstacleScreen from './UnifiedRideObstacleScreen';
import type { StackScreenProps } from '@react-navigation/stack';
import type { MappingStackParamList } from '@/navigation/MappingStack';

type Props = StackScreenProps<MappingStackParamList, 'RideReviewScreen'> & {
  onSubmit?: (payload: any) => void;
  onClose?: () => void;
};

export default function RideReviewScreen({ route, navigation, onSubmit, onClose }: Props) {
  return (
    <UnifiedRideObstacleScreen
      route={route}
      navigation={navigation}
      onSubmit={onSubmit}
      onClose={onClose}
      isDuringRide={false}
    />
  );
}
