import 'dotenv/config';
import type { ExpoConfig } from 'expo/config';
import * as fs from 'fs';
import * as path from 'path';

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

// Write google-services.json from environment variable if available (for EAS Build)
if (process.env.GOOGLE_SERVICES_JSON) {
  try {
    const googleServicesPath = path.join(__dirname, 'google-services.json');
    fs.writeFileSync(googleServicesPath, process.env.GOOGLE_SERVICES_JSON, 'utf8');
  } catch (error) {
    console.warn('Failed to write google-services.json from environment variable:', error);
  }
}

const config: ExpoConfig = {
  name: 'SBHRA_App',
  slug: 'Sardina-Bay-Horse-App',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icons/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  scheme: 'sbhraapp',
  owner: 'caleblouwskiter', // Expo account owner
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
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? '/local/path/to/google-services.json',
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
  },
  plugins: [
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
        sounds: ['./assets/sounds/notification.wav'],
        mode: 'production',
      },
    ],
  ],
};

export default config;
