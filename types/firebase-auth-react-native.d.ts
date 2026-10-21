// firebase/auth ships getReactNativePersistence at runtime (via the "react-native"
// bundle) but its public typings omit it. Augment the module instead of
// redeclaring it, so every other export keeps its real types.
import type { Persistence } from 'firebase/auth';

declare module 'firebase/auth' {
  interface ReactNativeAsyncStorage {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  }
  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
