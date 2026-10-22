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

jest.mock('expo-image-picker', () => ({
  __esModule: true,
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

import ProfilePictureService, { type ProfilePicture } from '../services/ProfilePictureService';

describe('ProfilePictureService namespaced cache and ownership validation', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockFirebase.FIREBASE_ENABLED = false;
    mockFirebase.app = undefined;
    mockFirebase.auth = undefined;
    mockFileInfo.mockReset();
    mockDeleteAsync.mockReset();
    mockCopyAsync.mockReset();
    mockMakeDirectoryAsync.mockReset();
    mockReadDirectoryAsync.mockReset();
    mockGetStorage.mockClear();
    mockRef.mockClear();
    mockUploadBytes.mockReset();
    mockGetDownloadURL.mockReset();
    mockDeleteObject.mockReset();

    mockFileInfo.mockResolvedValue({ exists: true });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("does not return account A's cached picture to account B", async () => {
    // Account A caches a picture
    mockFirebase.auth = { currentUser: { uid: 'user_A' } };
    const picA: ProfilePicture = {
      uri: 'file:///data/user/0/com.sbhra/files/profile_pictures/profile_user_A_1.jpg',
      timestamp: Date.now(),
      type: 'local',
      ownerUid: 'user_A',
    };
    await AsyncStorage.setItem('@profile_picture:user_A', JSON.stringify(picA));

    // Verify A sees their own picture
    const retrievedA = await ProfilePictureService.getProfilePicture();
    expect(retrievedA).toBe(picA.uri);

    // Switch to Account B on the same device
    mockFirebase.auth = { currentUser: { uid: 'user_B' } };

    // Account B should see null, never Account A's picture
    const retrievedB = await ProfilePictureService.getProfilePicture();
    expect(retrievedB).toBeNull();

    // Even if Account B's key somehow held a descriptor claiming ownerUid user_A
    const corruptedPic: ProfilePicture = {
      uri: 'file:///data/user/0/com.sbhra/files/profile_pictures/profile_user_A_1.jpg',
      timestamp: Date.now(),
      type: 'local',
      ownerUid: 'user_A',
    };
    await AsyncStorage.setItem('@profile_picture:user_B', JSON.stringify(corruptedPic));

    const retrievedBAfterCorruption = await ProfilePictureService.getProfilePicture();
    expect(retrievedBAfterCorruption).toBeNull();
  });

  it('adopts legacy data when its storagePath matches current uid and does not delete legacy key', async () => {
    mockFirebase.auth = { currentUser: { uid: 'user_C' } };

    const legacyData = {
      uri: 'https://firebasestorage.googleapis.com/v0/b/app/o/users%2Fuser_C%2Fprofile.jpg?alt=media',
      timestamp: 1700000000000,
      type: 'remote',
      storagePath: 'users/user_C/profile.jpg',
    };
    await AsyncStorage.setItem('@profile_picture', JSON.stringify(legacyData));

    // Namespaced key does not exist yet
    expect(await AsyncStorage.getItem('@profile_picture:user_C')).toBeNull();

    // Call getProfilePicture
    const uri = await ProfilePictureService.getProfilePicture();
    expect(uri).toBe(legacyData.uri);

    // Namespaced key is now populated with ownerUid: 'user_C'
    const namespaced = await AsyncStorage.getItem('@profile_picture:user_C');
    expect(namespaced).not.toBeNull();
    const parsedNamespaced: ProfilePicture = JSON.parse(namespaced!);
    expect(parsedNamespaced.ownerUid).toBe('user_C');
    expect(parsedNamespaced.storagePath).toBe('users/user_C/profile.jpg');
    expect(parsedNamespaced.uri).toBe(legacyData.uri);

    // Legacy key MUST NOT be deleted
    const legacyStillThere = await AsyncStorage.getItem('@profile_picture');
    expect(legacyStillThere).toBe(JSON.stringify(legacyData));
  });

  it('ignores legacy data with a non-matching storagePath and never deletes the legacy key', async () => {
    mockFirebase.auth = { currentUser: { uid: 'user_D' } };

    // Legacy descriptor belongs to user_OTHER
    const legacyData = {
      uri: 'https://firebasestorage.googleapis.com/v0/b/app/o/users%2Fuser_OTHER%2Fprofile.jpg?alt=media',
      timestamp: 1700000000000,
      type: 'remote',
      storagePath: 'users/user_OTHER/profile.jpg',
    };
    await AsyncStorage.setItem('@profile_picture', JSON.stringify(legacyData));

    const uri = await ProfilePictureService.getProfilePicture();
    expect(uri).toBeNull();

    // user_D key is NOT populated with user_OTHER's data
    const namespaced = await AsyncStorage.getItem('@profile_picture:user_D');
    expect(namespaced).toBeNull();

    // Legacy key MUST NOT be deleted
    const legacyStillThere = await AsyncStorage.getItem('@profile_picture');
    expect(legacyStillThere).toBe(JSON.stringify(legacyData));
  });

  it('removes picture targeting only the current uid path and never deletes legacy key', async () => {
    mockFirebase.FIREBASE_ENABLED = true;
    mockFirebase.app = {};
    mockFirebase.auth = { currentUser: { uid: 'user_E' } };

    // Also simulate legacy key present on device
    const legacyData = {
      uri: 'https://firebasestorage.googleapis.com/legacy.jpg',
      timestamp: 1234,
      type: 'remote',
      storagePath: 'users/legacy_owner/profile.jpg',
    };
    await AsyncStorage.setItem('@profile_picture', JSON.stringify(legacyData));

    // Cached descriptor with an altered storagePath
    const cachedDescriptor: ProfilePicture = {
      uri: 'file:///data/user/0/com.sbhra/files/profile_pictures/profile_user_E_123.jpg',
      timestamp: Date.now(),
      type: 'local',
      storagePath: 'users/someone_else/profile.jpg', // misleading cached path
      ownerUid: 'user_E',
    };
    await AsyncStorage.setItem('@profile_picture:user_E', JSON.stringify(cachedDescriptor));

    mockFileInfo.mockResolvedValue({ exists: true });

    await ProfilePictureService.removeProfilePicture();

    // Local file deleted
    expect(mockDeleteAsync).toHaveBeenCalledWith(cachedDescriptor.uri);

    // Remote delete targeted only users/<current uid>/profile.jpg, NOT users/someone_else/profile.jpg!
    expect(mockRef).toHaveBeenCalledWith(expect.anything(), 'users/user_E/profile.jpg');
    expect(mockDeleteObject).toHaveBeenCalledWith({ path: 'users/user_E/profile.jpg' });

    // Namespaced key removed
    expect(await AsyncStorage.getItem('@profile_picture:user_E')).toBeNull();

    // Legacy key was NOT deleted
    const legacyStillThere = await AsyncStorage.getItem('@profile_picture');
    expect(legacyStillThere).toBe(JSON.stringify(legacyData));
  });

  it('works in guest/demo mode without Firebase', async () => {
    mockFirebase.FIREBASE_ENABLED = false;
    mockFirebase.app = undefined;
    mockFirebase.auth = undefined;

    const guestPic: ProfilePicture = {
      uri: 'file:///data/user/0/com.sbhra/files/profile_pictures/profile_guest_1.jpg',
      timestamp: Date.now(),
      type: 'local',
      ownerUid: 'guest',
    };
    await AsyncStorage.setItem('@profile_picture:guest', JSON.stringify(guestPic));

    const uri = await ProfilePictureService.getProfilePicture();
    expect(uri).toBe(guestPic.uri);

    // Removing in guest mode removes @profile_picture:guest and deletes local file
    await ProfilePictureService.removeProfilePicture();
    expect(mockDeleteAsync).toHaveBeenCalledWith(guestPic.uri);
    expect(await AsyncStorage.getItem('@profile_picture:guest')).toBeNull();

    // Firebase storage was never contacted
    expect(mockGetStorage).not.toHaveBeenCalled();
    expect(mockDeleteObject).not.toHaveBeenCalled();
  });
});
