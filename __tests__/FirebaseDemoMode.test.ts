// With no Firebase config the app runs in demo mode on purpose. That must not
// raise a LogBox warning/error, while a failed initialisation with a config
// present is a real problem and must still warn.

const mockInitializeApp = jest.fn();
jest.mock('firebase/app', () => ({
  initializeApp: (...a: unknown[]) => mockInitializeApp(...a),
  getApps: () => [],
  getApp: jest.fn(),
}));
jest.mock('firebase/auth', () => ({
  initializeAuth: jest.fn(),
  getReactNativePersistence: jest.fn(),
  connectAuthEmulator: jest.fn(),
}));
jest.mock('firebase/firestore', () => ({
  initializeFirestore: jest.fn(),
  getFirestore: jest.fn(),
  connectFirestoreEmulator: jest.fn(),
}));
jest.mock('firebase/storage', () => ({ getStorage: jest.fn(), connectStorageEmulator: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const mockExtra: { current: Record<string, string> } = { current: {} };
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return { extra: mockExtra.current };
    },
  },
}));

const loadFirebase = () => {
  let mod!: typeof import('../services/firebase');
  jest.isolateModules(() => {
    mod = require('../services/firebase');
  });
  return mod;
};

beforeEach(() => {
  jest.useFakeTimers(); // firebase.ts logs its enabled state from a setTimeout
  mockInitializeApp.mockReset();
  mockExtra.current = {};
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('services/firebase without config', () => {
  it('is disabled and logs no warning or error', () => {
    const fb = loadFirebase();
    expect(fb.FIREBASE_ENABLED).toBe(false);
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('demo mode'), expect.any(String));
  });

  it('still warns, with the error, when a configured app fails to initialise', () => {
    mockExtra.current = {
      FIREBASE_API_KEY: 'k',
      FIREBASE_AUTH_DOMAIN: 'd',
      FIREBASE_PROJECT_ID: 'p',
      FIREBASE_STORAGE_BUCKET: 'b',
      FIREBASE_MESSAGING_SENDER_ID: 's',
      FIREBASE_APP_ID: 'a',
    };
    const failure = new Error('bad config');
    mockInitializeApp.mockImplementation(() => {
      throw failure;
    });
    const fb = loadFirebase();
    expect(fb.FIREBASE_ENABLED).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Initialization failed'), failure);
  });
});
