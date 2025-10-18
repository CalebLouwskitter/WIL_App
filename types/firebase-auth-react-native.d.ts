declare module 'firebase/auth' {
  export * from '@firebase/auth';
  export { Auth, User, initializeAuth, getReactNativePersistence } from '@firebase/auth';
}

declare module 'firebase/auth/react-native' {
  export * from 'firebase/auth';
}
