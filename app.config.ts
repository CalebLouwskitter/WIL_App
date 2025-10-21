import 'dotenv/config';
import type { ExpoConfig } from 'expo/config';

// This replaces app.json and allows reading keys from .env
// Expected vars in .env:
//   GOOGLE_MAPS_API_KEY=<your-android-key>
//   IOS_GOOGLE_MAPS_API_KEY=<your-ios-key>
//   FIREBASE_API_KEY=...
//   FIREBASE_AUTH_DOMAIN=...
//   FIREBASE_PROJECT_ID=...
//   FIREBASE_STORAGE_BUCKET=...
//   FIREBASE_MESSAGING_SENDER_ID=...
//   FIREBASE_APP_ID=...

const androidMapsApiKey = process.env.GOOGLE_MAPS_API_KEY ?? '';
const iosMapsApiKey = process.env.IOS_GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY ?? '';

const config: ExpoConfig = {
  name: 'SBHRA_App',
  slug: 'SBHRA_App',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icons/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  owner: 'your-expo-username', // Replace with your Expo username or leave blank
  splash: {
    image: './assets/icons/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    supportsTablet: true,
    // Google Maps iOS SDK key
    config: {
      googleMapsApiKey: iosMapsApiKey,
    },
    infoPlist: {
      NSLocationWhenInUseUsageDescription: 'This app uses your location to display your position on the map and for ride tracking.',
      NSLocationAlwaysAndWhenInUseUsageDescription: 'This app needs access to your location even when not in use to track rides in the background.',
      NSLocationAlwaysUsageDescription: 'This app needs access to your location to track rides even when the app is in the background.',
      NSCameraUsageDescription: 'This app needs access to your camera to take photos for your profile and horses.',
      NSPhotoLibraryUsageDescription: 'This app needs access to your photo library to select photos for your profile and horses.',
      NSPhotoLibraryAddUsageDescription: 'This app needs permission to save photos to your photo library.',
      NSMicrophoneUsageDescription: 'This app does not use the microphone.',
      UIBackgroundModes: ['location'],
    },
    bundleIdentifier: 'com.sbhra.app',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/icons/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    edgeToEdgeEnabled: true,
    package: 'com.sbhra.app',
    // Google Maps Android SDK key
    config: {
      googleMaps: {
        apiKey: androidMapsApiKey,
      },
    },
    permissions: [
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.POST_NOTIFICATIONS',
    ],
  },
  web: {
    favicon: './assets/images/favicon.png',
  },
  extra: {
    // Expo project configuration
    eas: {
      projectId: '1234abcd-5678-90ef-ghij-klmnopqrstuv', // Replace with your actual Expo project ID from eas.json or expo.dev
    },
    // Expose Firebase config to the app via Constants.expoConfig.extra
    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY ?? '',
    FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN ?? '',
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ?? '',
    FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET ?? '',
    FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID ?? '',
    FIREBASE_APP_ID: process.env.FIREBASE_APP_ID ?? '',
  },
};

export default config;
