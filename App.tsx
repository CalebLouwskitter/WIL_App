import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './navigation/AppNavigator';
import AuthNavigator from './navigation/AuthNavigator';
import useFirebaseAuth from './hooks/useFirebaseAuth';
import { FIREBASE_ENABLED } from './services/firebase';

export default function App() {
  const { user, initializing, isAuthenticated } = useFirebaseAuth();
  const allowBypass = !FIREBASE_ENABLED; // allow full app if firebase not configured
  if (initializing) {
    return (
      <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  return (
    <NavigationContainer>
  {isAuthenticated || allowBypass ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
