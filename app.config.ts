import 'dotenv/config';
import type { ExpoConfig } from 'expo/config';
import * as fs from 'fs';
// The explicit .ts extension is needed: Expo's config loader does not resolve extensionless TS imports.
import { resolveGoogleServicesFile } from './config/googleServices.ts';

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

// GOOGLE_SERVICES_JSON is either an EAS file secret (a path) or a raw JSON payload,
// which is written to google-services.json. See docs/firebase/PUSH_CONTRACT.md.
// (The explicit .ts extension is required: Expo's config loader does not resolve extensionless TS imports.)
const googleServicesFile = resolveGoogleServicesFile(process.env, fs, __dirname);

const config: ExpoConfig = {
  name: 'SBHRA_App',
  slug: 'Sardina-Bay-Horse-App',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icons/icon.png',
  userInterfaceStyle: 'light',
  scheme: 'sbhraapp',
  owner: 'caleblouwskiter', // Expo account owner
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
    package: 'com.sbhra.app',
    googleServicesFile,
    // Google Maps Android SDK key
    config: {
      googleMaps: {
        apiKey: androidMapsApiKey,
      },
    },
    permissions: [
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_LOCATION',
      'android.permission.POST_NOTIFICATIONS',
    ],
  },
  web: {
    favicon: './assets/images/favicon.png',
  },
  extra: {
    // Expo project configuration
    eas: {
      projectId: 'a87bb906-5013-439d-92d2-fd915b65e342', // Expo project ID from expo.dev
    },
    // Expose Firebase config to the app via Constants.expoConfig.extra
    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY ?? '',
    FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN ?? '',
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ?? '',
    FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET ?? '',
    FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID ?? '',
    FIREBASE_APP_ID: process.env.FIREBASE_APP_ID ?? '',
    // Dev-only local emulators (docs/firebase/EMULATOR.md)
    FIREBASE_USE_EMULATOR: process.env.FIREBASE_USE_EMULATOR ?? 'false',
    FIREBASE_EMULATOR_HOST: process.env.FIREBASE_EMULATOR_HOST ?? '',
  },
  plugins: [
    [
      'expo-splash-screen',
      {
        image: './assets/icons/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
        imageWidth: 240,
      },
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Allow SBHRA to use your location to track horse rides.',
        locationAlwaysPermission:
          'Allow SBHRA to use your location to track horse rides even when the app is closed or not in use.',
        locationWhenInUsePermission:
          'Allow SBHRA to use your location to track horse rides.',
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/icons/notification-icon.png',
        color: '#2563eb',
        mode: 'production',
        // Enable Firebase Cloud Messaging for push notifications
        usesFcm: true,
      },
    ],
  ],
};

export default config;
