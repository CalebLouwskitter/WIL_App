import React, { useEffect } from 'react';
import { ActivityIndicator, View, Platform, Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './navigation/AppNavigator';
import AuthNavigator from './navigation/AuthNavigator';
import useFirebaseAuth from './hooks/useFirebaseAuth';
import { FIREBASE_ENABLED } from './services/firebase';
import { useCurrentUser } from './hooks/useCurrentUser';
import PendingApprovalScreen from './screens/Auth/PendingApprovalScreen';
import SetupRequiredScreen from './screens/Auth/SetupRequiredScreen';
import DemoModeBanner from './components/DemoModeBanner';
import { logFirebaseStatus } from './services/firebaseConnectionCheck';
import { StatusBar } from 'expo-status-bar';
import { useNotifications } from './hooks/useNotifications';
import { SosProvider } from './contexts/SosContext';
import { RideRecoveryProvider } from './contexts/RideRecoveryContext';
import { RideRecoveryHandler } from './components/RideRecoveryHandler';
import { startRideSync } from './services/RideStorage';
import { PreferencesProvider } from './contexts/PreferencesContext';
import { useColorScheme } from 'react-native';

export default function App() {
  const { user, initializing, isAuthenticated } = useFirebaseAuth();
  const { profile, loading } = useCurrentUser();
  const scheme = useColorScheme();
  const statusBarStyle = scheme === 'dark' ? 'light' : 'dark';
  // Without Firebase config only development builds may run the app, flagged as demo mode.
  // A release build with missing config shows the setup screen instead of a fake working app.
  const allowBypass = !FIREBASE_ENABLED && __DEV__;
  const setupRequired = !FIREBASE_ENABLED && !__DEV__;

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
  if (setupRequired) {
    return (
      <SafeAreaProvider>
        <StatusBar style={statusBarStyle} hidden={false} />
        <SetupRequiredScreen />
      </SafeAreaProvider>
    );
  }
  return (
    <SafeAreaProvider>
      <PreferencesProvider>
        <RideRecoveryProvider>
      <SosProvider>
        <NavigationContainer>
          <StatusBar style={statusBarStyle} hidden={false} />
          <RideRecoveryHandler />
          {allowBypass ? (
            <View style={{ flex: 1 }}>
              <DemoModeBanner />
              <View style={{ flex: 1 }}>
                <AppNavigator />
              </View>
            </View>
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
      </PreferencesProvider>
    </SafeAreaProvider>
  );
}
