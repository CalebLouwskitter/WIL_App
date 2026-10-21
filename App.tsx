import React, { useEffect } from 'react';
import { ActivityIndicator, View, Platform, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './navigation/AppNavigator';
import AuthNavigator from './navigation/AuthNavigator';
import useFirebaseAuth from './hooks/useFirebaseAuth';
import { FIREBASE_ENABLED } from './services/firebase';
import { useCurrentUser } from './hooks/useCurrentUser';
import PendingApprovalScreen from './screens/Auth/PendingApprovalScreen';
import { logFirebaseStatus } from './services/firebaseConnectionCheck';
import { StatusBar } from 'expo-status-bar';
import { useNotifications } from './hooks/useNotifications';
import { SosProvider } from './contexts/SosContext';
import { RideRecoveryProvider } from './contexts/RideRecoveryContext';
import { RideRecoveryHandler } from './components/RideRecoveryHandler';
import { startRideSync } from './services/RideStorage';

export default function App() {
  const { user, initializing, isAuthenticated } = useFirebaseAuth();
  const { profile, loading } = useCurrentUser();
  const allowBypass = !FIREBASE_ENABLED; // allow full app if firebase not configured

  // Register for push notifications when user is logged in
  useNotifications(user?.uid);

  // Upload rides that were saved while offline, now and whenever we reconnect
  useEffect(() => {
    if (!user?.uid) return;
    return startRideSync();
  }, [user?.uid]);

  // Log Firebase connection status on app start (dev only)
  useEffect(() => {
    if (__DEV__) {
      logFirebaseStatus();
    }
  }, []);

  // Ride recovery is now handled by RideRecoveryHandler component

  // Attempt to hide Android navigation bar globally (requires expo-navigation-bar)
  useEffect(() => {
    if (Platform.OS === 'android') {
      (async () => {
        try {
          const NavigationBar = require('expo-navigation-bar');
          await NavigationBar.setVisibilityAsync('hidden');
          await NavigationBar.setBehaviorAsync('overlay-swipe');
          await NavigationBar.setBackgroundColorAsync('#00000000');
        } catch (e) {
          // Module may not be installed; ignore to avoid crashing
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
