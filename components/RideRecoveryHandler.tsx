/**
 * Ride Recovery Handler
 * Handles the UI for recovering interrupted rides
 * Shows alerts and navigates to LiveTrackingScreen when user resumes
 */

import React, { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useRideRecovery } from '../contexts/RideRecoveryContext';
import { recoverActiveRide, BackgroundLocationService, RideStateManager } from '../components/backgroundServices';

export const RideRecoveryHandler: React.FC = () => {
  const navigation = useNavigation<any>();
  const { hasRecoverableRide, markAsResumed, markAlertShown, clearRecoveryState } = useRideRecovery();
  const alertShown = useRef(false);

  useEffect(() => {
    // Only show alert once per app session
    if (hasRecoverableRide && !alertShown.current) {
      alertShown.current = true;
      markAlertShown(); // Mark in context to prevent duplicate UI
      showRecoveryAlert();
    }
  }, [hasRecoverableRide, markAlertShown]);

  const showRecoveryAlert = () => {
    Alert.alert(
      'Resume Ride?',
      'A previous ride was detected. Would you like to continue tracking it?',
      [
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            try {
              // Stop any background services
              await BackgroundLocationService.stop();
              // Clear the ride state
              await RideStateManager.clearRideState();
              // Clear recovery context
              clearRecoveryState();
              console.log('[RideRecoveryHandler] Ride discarded');
            } catch (error) {
              console.error('[RideRecoveryHandler] Error discarding ride:', error);
            }
          },
        },
        {
          text: 'Continue',
          style: 'default',
          onPress: async () => {
            try {
              // Recover and restart background tracking
              await recoverActiveRide();
              // Mark as resumed in context
              markAsResumed();
              
              // Navigate to LiveTrackingScreen
              // Use a timeout to ensure navigation stack is ready (especially on slower devices)
              setTimeout(() => {
                try {
                  navigation.navigate('Mapping', {
                    screen: 'LiveTracking',
                  });
                } catch (navError) {
                  console.warn('[RideRecoveryHandler] Navigation error:', navError);
                  // If navigation fails, alert the user
                  Alert.alert(
                    'Navigation Error',
                    'Please navigate to the Mapping tab manually to continue your ride.'
                  );
                }
              }, 500);
              
              console.log('[RideRecoveryHandler] Ride resumed');
            } catch (error) {
              console.error('[RideRecoveryHandler] Error resuming ride:', error);
              Alert.alert(
                'Resume Failed',
                'Could not resume the previous ride. Please start a new ride.'
              );
              clearRecoveryState();
            }
          },
        },
      ],
      { cancelable: false }
    );
  };

  // This component doesn't render anything
  return null;
};
