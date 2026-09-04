import React, { useEffect } from 'react';
import { ActivityIndicator, View, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './navigation/AppNavigator';
import AuthNavigator from './navigation/AuthNavigator';
import useFirebaseAuth from './hooks/useFirebaseAuth';
import { FIREBASE_ENABLED } from './services/firebase';
import { useCurrentUser } from './hooks/useCurrentUser';
import PendingApprovalScreen from './screens/Auth/PendingApprovalScreen';
import { logFirebaseStatus } from './services/firebaseConnectionCheck';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { useNotifications } from './hooks/useNotifications';
import { SosProvider } from './contexts/SosContext';
import { RideRecoveryProvider } from './contexts/RideRecoveryContext';
import { RideRecoveryHandler } from './components/RideRecoveryHandler';

export default function App() {
  const { user, initializing, isAuthenticated } = useFirebaseAuth();
  const { profile, loading } = useCurrentUser();
  const allowBypass = !FIREBASE_ENABLED; // allow full app if firebase not configured

  // Register for push notifications when user is logged in
  useNotifications(user?.uid);

  // Log Firebase connection status on app start (dev only)
  useEffect(() => {
    if (__DEV__) {
      logFirebaseStatus();
    }
  }, []);

  // Ride recovery is now handled by RideRecoveryHandler component

  // Hide Android navigation controls; the app uses edge-to-edge layout.
  useEffect(() => {
    if (Platform.OS === 'android') {
      (async () => {
        try {
          await NavigationBar.setVisibilityAsync('hidden');
        } catch (e) {
          if (__DEV__) console.warn('Unable to hide Android navigation bar', e);
        }
      })();
    }
  }, []);
  if (initializing || loading) {
    return (
      <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  return (
    <RideRecoveryProvider>
      <SosProvider>
        <NavigationContainer>
          <StatusBar style="dark" hidden={false} translucent backgroundColor="transparent" />
          <RideRecoveryHandler />
          {allowBypass ? (
            <AppNavigator />
          ) : !isAuthenticated ? (
            <AuthNavigator />
          ) : profile?.status === 'approved' ? (
            <AppNavigator />
          ) : (
            <PendingApprovalScreen status={(profile?.status as any) ?? 'unknown'} />
          )}
        </NavigationContainer>
      </SosProvider>
    </RideRecoveryProvider>
  );
}
