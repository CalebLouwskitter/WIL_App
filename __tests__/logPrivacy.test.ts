import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const mockFirebase: {
  FIREBASE_ENABLED: boolean;
  app: object | undefined;
  auth: { currentUser: { uid: string; photoURL?: string | null } | null } | undefined;
} = {
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

const mockFileInfo = jest.fn();
const mockDeleteAsync = jest.fn();
const mockCopyAsync = jest.fn();
const mockMakeDirectoryAsync = jest.fn();
const mockReadDirectoryAsync = jest.fn();

jest.mock('expo-file-system', () => ({
  __esModule: true,
  documentDirectory: 'file:///data/user/0/com.sbhra/files/',
  cacheDirectory: 'file:///data/user/0/com.sbhra/cache/',
  getInfoAsync: (uri: string) => mockFileInfo(uri),
  deleteAsync: (uri: string, opts?: any) =>
    opts !== undefined ? mockDeleteAsync(uri, opts) : mockDeleteAsync(uri),
  copyAsync: (opts: any) => mockCopyAsync(opts),
  makeDirectoryAsync: (dir: string, opts?: any) =>
    opts !== undefined ? mockMakeDirectoryAsync(dir, opts) : mockMakeDirectoryAsync(dir),
  readDirectoryAsync: (dir: string) => mockReadDirectoryAsync(dir),
}));

const mockGetStorage = jest.fn(() => ({}));
const mockRef = jest.fn((_storage: any, path: string) => ({ path }));
const mockUploadBytes = jest.fn();
const mockGetDownloadURL = jest.fn();
const mockDeleteObject = jest.fn();

jest.mock('firebase/storage', () => ({
  __esModule: true,
  getStorage: () => mockGetStorage(),
  ref: (storage: any, path: string) => mockRef(storage, path),
  uploadBytes: (storageRef: any, blob: any, meta: any) => mockUploadBytes(storageRef, blob, meta),
  getDownloadURL: (storageRef: any) => mockGetDownloadURL(storageRef),
  deleteObject: (storageRef: any) => mockDeleteObject(storageRef),
}));

const mockLaunchImageLibraryAsync = jest.fn();
const mockLaunchCameraAsync = jest.fn();

jest.mock('expo-image-picker', () => ({
  __esModule: true,
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  launchCameraAsync: () => mockLaunchCameraAsync(),
  launchImageLibraryAsync: () => mockLaunchImageLibraryAsync(),
  MediaTypeOptions: { Images: 'Images' },
}));

// Provide global fetch mock for blob upload
(global as any).fetch = jest.fn().mockResolvedValue({
  blob: async () => ({ size: 1024, type: 'image/jpeg' }),
});

import ProfilePictureService, { type ProfilePicture } from '../services/ProfilePictureService';

describe('Log privacy in ProfilePictureService', () => {
  const SECRET_UID = 'uid-SECRET-123';
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(async () => {
    await AsyncStorage.clear();
    mockFirebase.FIREBASE_ENABLED = false;
    mockFirebase.app = undefined;
    mockFirebase.auth = { currentUser: { uid: SECRET_UID } };

    mockFileInfo.mockReset().mockResolvedValue({ exists: true });
    mockDeleteAsync.mockReset().mockResolvedValue(undefined);
    mockCopyAsync.mockReset().mockResolvedValue(undefined);
    mockMakeDirectoryAsync.mockReset().mockResolvedValue(undefined);
    mockReadDirectoryAsync.mockReset().mockResolvedValue([`profile_${SECRET_UID}_old.jpg`]);
    mockUploadBytes.mockReset().mockResolvedValue({});
    mockGetDownloadURL.mockReset().mockResolvedValue(`https://storage.mock/${SECRET_UID}/profile.jpg`);
    mockDeleteObject.mockReset().mockResolvedValue(undefined);

    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    const allArgs = [
      ...logSpy.mock.calls.flat(),
      ...warnSpy.mock.calls.flat(),
      ...errorSpy.mock.calls.flat(),
    ];

    for (const arg of allArgs) {
      const serialized = typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
      expect(serialized).not.toContain('SECRET');
    }

    jest.restoreAllMocks();
  });

  it('does not log SECRET during local profile picture save', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///data/cache/temp_picker.jpg' }],
    });

    const result = await ProfilePictureService.chooseFromLibrary();
    expect(result).not.toBeNull();
    expect(logSpy).toHaveBeenCalled();
  });

  it('does not log SECRET during remote profile picture save and read', async () => {
    mockFirebase.FIREBASE_ENABLED = true;
    mockFirebase.app = {};

    mockLaunchCameraAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///data/cache/camera.jpg' }],
    });

    const savedUrl = await ProfilePictureService.takePhoto();
    expect(savedUrl).toBe(`https://storage.mock/${SECRET_UID}/profile.jpg`);

    const readUrl = await ProfilePictureService.getProfilePicture();
    expect(readUrl).toBe(savedUrl);
  });

  it('does not log SECRET during reading legacy cached profile pictures', async () => {
    const legacyData = {
      uri: `https://storage.mock/users/${SECRET_UID}/profile.jpg`,
      timestamp: Date.now(),
      type: 'remote',
      storagePath: `users/${SECRET_UID}/profile.jpg`,
    };
    await AsyncStorage.setItem('@profile_picture', JSON.stringify(legacyData));

    const readUrl = await ProfilePictureService.getProfilePicture();
    expect(readUrl).toBe(legacyData.uri);
  });

  it('does not log SECRET during profile picture remove and cleanup', async () => {
    mockFirebase.FIREBASE_ENABLED = true;
    mockFirebase.app = {};

    const pic: ProfilePicture = {
      uri: `file:///data/user/0/com.sbhra/files/profile_pictures/profile_${SECRET_UID}_1.jpg`,
      timestamp: Date.now(),
      type: 'local',
      ownerUid: SECRET_UID,
    };
    await AsyncStorage.setItem(`@profile_picture:${SECRET_UID}`, JSON.stringify(pic));

    await ProfilePictureService.removeProfilePicture();
  });

  it('does not log SECRET when checking remote profile picture status', async () => {
    mockFirebase.FIREBASE_ENABLED = true;
    mockFirebase.app = {};

    const status = await ProfilePictureService.checkRemoteProfilePicture();
    expect(status.exists).toBe(true);
  });
});
