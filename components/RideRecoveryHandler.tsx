/**
 * Ride Recovery Handler
 * Handles the UI for recovering interrupted rides
 * Shows alerts and navigates to LiveTrackingScreen when user resumes
 *
 * Every prompt keeps the recording until the rider explicitly saves or
 * discards it, and "resumed" is only reported when tracking really restarted.
 */

import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useRideRecovery, type RecoveryNotice } from '../contexts/RideRecoveryContext';

const savedMessage = (reason: RideEndReasonOrNull) => {
  switch (reason) {
    case 'boundary':
      return 'Your ride ended automatically when you left the riding area and was saved to Ride History.';
    case 'stale':
      return 'Your interrupted ride was saved to Ride History.';
    default:
      return 'Your last ride was saved to Ride History.';
  }
};

type RideEndReasonOrNull = Extract<RecoveryNotice, { type: 'archived' }>['reason'];

const formatAgo = (ms: number) => {
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} days`;
};

export const RideRecoveryHandler: React.FC = () => {
  const navigation = useNavigation<any>();
  const {
    recoveryKind,
    recoveredRideData,
    notice,
    promptRequest,
    resumeRide,
    saveRecoveredRide,
    discardRecoveredRide,
    retryArchive,
    dismissNotice,
    markAlertShown,
  } = useRideRecovery();

  // Tell the user about a ride saved (or not) during startup recovery
  useEffect(() => {
    if (!notice) return;
    if (notice.type === 'archived') {
      Alert.alert('Ride saved', savedMessage(notice.reason), [{ text: 'OK', onPress: dismissNotice }]);
    } else {
      Alert.alert(
        'Ride not saved yet',
        'Your last ride is still stored on this device but could not be added to Ride History. It will be tried again next time the app opens.',
        [
          { text: 'Later', style: 'cancel', onPress: dismissNotice },
          { text: 'Retry', onPress: () => retryArchive() },
        ],
        { cancelable: false }
      );
    }
  }, [notice]);

  // Offer an interrupted ride each time a check finds one
  useEffect(() => {
    if (promptRequest > 0 && (recoveryKind === 'active' || recoveryKind === 'stale')) {
      markAlertShown(); // Mark in context to prevent duplicate UI
      showRecoveryAlert();
    }
  }, [promptRequest]);

  const showRecoveryAlert = () => {
    if (recoveryKind === 'stale') {
      const started = recoveredRideData ? new Date(recoveredRideData.startTime).toLocaleString() : 'earlier';
      const idleMs = recoveredRideData ? Date.now() - recoveredRideData.lastUpdateTime : 0;
      Alert.alert(
        'Interrupted Ride',
        `A ride started ${started} stopped recording${idleMs ? ` about ${formatAgo(idleMs)} ago` : ''}. It is still stored on this device.`,
        [
          { text: 'Save partial ride', onPress: saveRide },
          { text: 'Resume', onPress: resume },
          { text: 'Discard', style: 'destructive', onPress: confirmDiscard },
        ],
        { cancelable: false }
      );
      return;
    }

    Alert.alert(
      'Resume Ride?',
      'A ride was still being recorded when the app closed. Would you like to continue tracking it?',
      [
        { text: 'Discard', style: 'destructive', onPress: confirmDiscard },
        { text: 'Save ride', onPress: saveRide },
        { text: 'Continue', style: 'default', onPress: resume },
      ],
      { cancelable: false }
    );
  };

  const confirmDiscard = () => {
    Alert.alert(
      'Discard Ride?',
      'This permanently deletes the recording from this device.',
      [
        { text: 'Keep', style: 'cancel', onPress: showRecoveryAlert },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            try {
              await discardRecoveredRide();
            } catch (error) {
              console.error('[RideRecoveryHandler] Error discarding ride:', error);
              Alert.alert('Discard Failed', 'The ride could not be removed. It is still stored on this device.');
            }
          },
        },
      ],
      { cancelable: false }
    );
  };

  const saveRide = async () => {
    try {
      await saveRecoveredRide();
      Alert.alert('Ride saved', 'Your ride was saved to Ride History.');
    } catch (error) {
      console.error('[RideRecoveryHandler] Error saving ride:', error);
      Alert.alert(
        'Ride not saved',
        'The ride could not be saved to Ride History. It is still stored on this device.',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Retry', onPress: saveRide },
        ]
      );
    }
  };

  const resume = async () => {
    let resumed = false;
    try {
      resumed = await resumeRide();
    } catch (error) {
      console.error('[RideRecoveryHandler] Error resuming ride:', error);
    }

    if (!resumed) {
      Alert.alert(
        'Could Not Resume Tracking',
        'Location tracking could not be restarted. Your ride is still stored on this device.',
        [
          { text: 'Save ride', onPress: saveRide },
          { text: 'Try again', onPress: resume },
        ],
        { cancelable: false }
      );
      return;
    }

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
  };

  // This component doesn't render anything
  return null;
};
