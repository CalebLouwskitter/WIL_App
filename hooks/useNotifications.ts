import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { saveFCMToken } from '../services/FirebaseNotificationService';
import { NOTIFICATIONS_ENABLED } from '../constants/config';

// Configure how notifications are handled when app is in foreground
if (NOTIFICATIONS_ENABLED) {
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
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);

  useEffect(() => {
    if (!NOTIFICATIONS_ENABLED) return () => {};
    // Register for push notifications and get token
    registerForPushNotificationsAsync().then(token => {
      if (token) {
        setExpoPushToken(token);
        // Save token to Firestore if user is logged in
        if (userId) {
          saveFCMToken(userId, token).catch(error => {
            console.error('Error saving FCM token:', error);
          });
        }
      }
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
      // For development with Expo Go, projectId is auto-detected
      // For production builds, you can specify projectId explicitly
      const tokenData = await Notifications.getExpoPushTokenAsync();
      token = tokenData.data;
      console.log('✅ Expo push token obtained:', token);
    } catch (error: any) {
      console.warn('⚠️ Push notifications not available:', error.message);
      
      // Check if it's the Expo Go limitation
      if (error.message?.includes('projectId') || error.message?.includes('Expo Go')) {
        console.warn('📱 Push notifications require a development build (not supported in Expo Go SDK 53+)');
        console.warn('👉 Run: eas build --profile development --platform android');
        // Don't show alert - just log for developers
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
