import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './navigation/AppNavigator';
import AuthNavigator from './navigation/AuthNavigator';
import useFirebaseAuth from './hooks/useFirebaseAuth';
import { FIREBASE_ENABLED } from './services/firebase';
import { useCurrentUser } from './hooks/useCurrentUser';
import PendingApprovalScreen from './screens/Auth/PendingApprovalScreen';
import { logFirebaseStatus } from './services/firebaseConnectionCheck';

export default function App() {
  const { user, initializing, isAuthenticated } = useFirebaseAuth();
  const { profile, loading } = useCurrentUser();
  const allowBypass = !FIREBASE_ENABLED; // allow full app if firebase not configured

  // Log Firebase connection status on app start (dev only)
  useEffect(() => {
    if (__DEV__) {
      logFirebaseStatus();
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
    <NavigationContainer>
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
  );
}
