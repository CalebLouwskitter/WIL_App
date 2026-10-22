// ObstacleView.tsx
import React from 'react';
import UnifiedRideObstacleScreen from './UnifiedRideObstacleScreen';
import type { StackScreenProps } from '@react-navigation/stack';
import type { MappingStackParamList } from '@/navigation/MappingStack';

type Props = StackScreenProps<MappingStackParamList, 'ObstacleViewUpdated'> & {
  onSubmit?: (payload: any) => void;
  onClose?: () => void;
};

export default function ObstacleViewUpdated({ route, navigation, onSubmit, onClose }: Props) {
  return (
    <UnifiedRideObstacleScreen
      route={{ 
        params: {
          rideData: route.params?.rideData,
          rideId: route.params?.rideId,
          initialTab: route.params?.initialTab,
        }
      } as any}
      navigation={navigation}
      onSubmit={onSubmit}
      onClose={onClose}
      isDuringRide={true}
      rideData={route.params?.rideData}
      rideId={route.params?.rideId}
      initialTab={route.params?.initialTab}
    />
  );
}
