jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const mockFirebase: { FIREBASE_ENABLED: boolean; app: object | undefined; auth: { currentUser: object | null } | undefined } = {
  FIREBASE_ENABLED: false,
  app: undefined,
  auth: undefined,
};
jest.mock('../services/firebase', () => ({
  get FIREBASE_ENABLED() {
    return mockFirebase.FIREBASE_ENABLED;
  },
  get app() {
    return mockFirebase.app;
  },
  get auth() {
    return mockFirebase.auth;
  },
}));

const mockRequestPermission = jest.fn();
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: (...a: unknown[]) => mockRequestPermission(...a),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));
jest.mock('firebase/firestore', () => ({
  getFirestore: () => ({}),
  collection: () => ({}),
  doc: () => ({}),
  setDoc: jest.fn(),
  getDocs: jest.fn(),
  query: () => ({}),
  where: () => ({}),
  orderBy: () => ({}),
  onSnapshot: jest.fn(),
  Timestamp: { now: () => ({}) },
}));

import { startLocationBroadcast, stopLocationBroadcast } from '../services/OnlineUserService';

beforeEach(() => {
  mockRequestPermission.mockReset();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  stopLocationBroadcast();
  jest.restoreAllMocks();
});

describe('startLocationBroadcast without a connection', () => {
  it('is a quiet no-op when Firebase is off (demo mode)', async () => {
    await startLocationBroadcast({ isRiding: false });
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('is a quiet no-op when Firebase is on but nobody is signed in', async () => {
    mockFirebase.FIREBASE_ENABLED = true;
    mockFirebase.app = {};
    mockFirebase.auth = { currentUser: null };
    await startLocationBroadcast();
    expect(console.warn).not.toHaveBeenCalled();
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });
});
