import { useEffect, useRef, useState } from 'react';
import type * as ExpoNotifications from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { saveExpoPushToken } from '../services/FirebaseNotificationService';
import { NOTIFICATIONS_ENABLED } from '../constants/config';

// Expo Go does not contain the native Android push-notification modules
// (e.g. ExpoTopicSubscriptionModule), and loading expo-notifications without
// them throws at startup. Skip it in Expo Go, and treat any other load failure
// as "push unavailable" rather than crashing the app.
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient || Constants.appOwnership === 'expo';

function loadNotifications(): typeof ExpoNotifications | null {
  if (isExpoGo) return null;
  try {
    return require('expo-notifications');
  } catch (error) {
    console.warn('[Notifications] Push notifications are unavailable in this build:', (error as Error)?.message ?? error);
    return null;
  }
}

const Notifications = loadNotifications();

// Configure how notifications are handled when app is in foreground
if (NOTIFICATIONS_ENABLED && Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export function useNotifications(userId?: string) {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState<ExpoNotifications.Notification | null>(null);
  const notificationListener = useRef<ExpoNotifications.Subscription | undefined>(undefined);
  const responseListener = useRef<ExpoNotifications.Subscription | undefined>(undefined);

  useEffect(() => {
    if (!NOTIFICATIONS_ENABLED || !Notifications) return () => {};
    // Register for push notifications and get token
    registerForPushNotificationsAsync().then(token => {
      if (token) {
        setExpoPushToken(token);
        // Save token to Firestore if user is logged in
        if (userId) {
          saveExpoPushToken(userId, token).catch(error => {
            console.error('Error saving Expo push token:', error);
          });
        }
      }
    }).catch(error => {
      console.warn('Push notification registration failed:', error);
    });

    // Listener for notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received in foreground:', notification);
      setNotification(notification);
    });

    // Listener for when user taps on notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      // You can handle navigation here based on notification data
      const data = response.notification.request.content.data;
      // Example: navigate to specific screen based on notification type
      // navigation.navigate('NotificationsScreen');
    });

    // Cleanup listeners on unmount
    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [userId]);

  return { expoPushToken, notification };
}

/**
 * Register device for push notifications
 * @returns Expo push token or undefined if registration fails
 */
async function registerForPushNotificationsAsync() {
  if (!Notifications) return;
  let token;

  // Configure Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563eb',
    });
  }

  if (Device.isDevice) {
    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    // Request permissions if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    // Alert user if permissions not granted
    if (finalStatus !== 'granted') {
      alert('Failed to get push notification permissions!');
      return;
    }
    
    // Get Expo push token
    try {
      // Use the projectId from app.config.ts (EAS project ID)
      const projectId = 'a87bb906-5013-439d-92d2-fd915b65e342';
      
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });
      token = tokenData.data;
      console.log('✅ Expo push token obtained:', token);
    } catch (error: any) {
      console.warn('⚠️ Push notifications not available:', error.message);
      
      // Check if it's the Expo Go limitation
      if (error.message?.includes('projectId')) {
        console.warn('📱 Please set your Expo projectId in useNotifications.ts');
        console.warn('👉 Find your projectId at: https://expo.dev/accounts/[username]/projects/[project-slug]');
      } else if (error.message?.includes('credentials')) {
        console.warn('📱 FCM credentials not configured. Run: eas credentials');
      } else {
        // Other errors might need user attention
        console.error('Error details:', error.message);
      }
    }
  } else {
    alert('Must use physical device for Push Notifications');
  }

  return token;
}
