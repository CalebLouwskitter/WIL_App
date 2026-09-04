import 'firebase/auth';
import type { Persistence, ReactNativeAsyncStorage } from 'firebase/auth';

// Augment the public SDK types without replacing its existing exports.
// Firebase 11 exposes this helper in the React Native runtime entry point.
declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
