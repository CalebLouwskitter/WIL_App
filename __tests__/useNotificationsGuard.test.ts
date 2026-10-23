// Loading the notifications hook must never crash startup when the native
// push modules are missing (Expo Go, or a build without them).

const mockConstants: { executionEnvironment: string; appOwnership: string | null } = {
  executionEnvironment: 'bare',
  appOwnership: null,
};

const load = (setup: () => void) => {
  let mod: unknown;
  jest.isolateModules(() => {
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: mockConstants,
      ExecutionEnvironment: { Bare: 'bare', Standalone: 'standalone', StoreClient: 'storeClient' },
    }));
    jest.doMock('expo-device', () => ({ isDevice: false }));
    jest.doMock('../services/FirebaseNotificationService', () => ({ saveExpoPushToken: jest.fn() }));
    setup();
    mod = require('../hooks/useNotifications');
  });
  return mod;
};

beforeEach(() => {
  mockConstants.executionEnvironment = 'bare';
  mockConstants.appOwnership = null;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const missingNativeModule = () =>
  jest.doMock('expo-notifications', () => {
    throw new Error("Cannot find native module 'ExpoTopicSubscriptionModule'");
  });

describe('useNotifications loading', () => {
  it('does not load expo-notifications in Expo Go (storeClient)', () => {
    mockConstants.executionEnvironment = 'storeClient';
    expect(() => load(missingNativeModule)).not.toThrow();
  });

  it('does not load expo-notifications when Expo Go reports itself by appOwnership', () => {
    mockConstants.appOwnership = 'expo';
    expect(() => load(missingNativeModule)).not.toThrow();
  });

  it('treats a missing native push module as unavailable instead of crashing', () => {
    expect(() => load(missingNativeModule)).not.toThrow();
    expect(console.warn).toHaveBeenCalledWith(
      '[Notifications] Push notifications are unavailable in this build:',
      expect.stringContaining('ExpoTopicSubscriptionModule')
    );
  });
});
