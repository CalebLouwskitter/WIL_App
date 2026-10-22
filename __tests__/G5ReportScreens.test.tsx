import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

// Mock dependencies for UnifiedRideObstacleScreen and MapStatusFrame
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}));

jest.mock('react-native-vector-icons/Feather', () => () => null);

const mockMapViewProps = jest.fn();
jest.mock('react-native-maps', () => {
  const React = require('react');
  const MockMapView = (props: any) => {
    mockMapViewProps(props);
    return React.createElement('MapView', props, props.children);
  };
  return {
    __esModule: true,
    default: MockMapView,
    Marker: (props: any) => React.createElement('Marker', props, props.children),
    Polyline: () => null,
    Callout: (props: any) => React.createElement('Callout', props, props.children),
    PROVIDER_GOOGLE: 'google',
  };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///test/',
  copyAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock('../services/firebase', () => ({
  FIREBASE_ENABLED: false,
  app: {},
  auth: { currentUser: null },
  firestore: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  writeBatch: jest.fn(),
  serverTimestamp: jest.fn(),
  updateDoc: jest.fn(),
  setDoc: jest.fn(),
  getFirestore: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  where: jest.fn(),
  limit: jest.fn(),
  GeoPoint: class {},
  arrayUnion: jest.fn(),
  onSnapshot: jest.fn(),
  getDocs: jest.fn(),
}));

jest.mock('firebase/storage', () => ({
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
  getStorage: jest.fn(),
}));

jest.mock('../services/ObstacleService', () => ({
  saveObstacle: jest.fn(),
  fetchObstacles: jest.fn().mockResolvedValue([]),
  subscribeToObstacles: jest.fn((cb) => {
    cb([], 'connected');
    return () => {};
  }),
}));

jest.mock('../services/FirebaseNotificationService', () => ({
  createAdminNotification: jest.fn(),
}));

jest.mock('../services/ObservationStorage', () => ({
  saveObservation: jest.fn(),
}));

jest.mock('../hooks/useForegroundLocation', () => ({
  useForegroundLocation: () => ({
    location: null,
    state: { status: 'idle' },
    requestPermission: jest.fn(),
    refresh: jest.fn(),
  }),
}));

let mockCurrentMapType: 'standard' | 'satellite' | 'hybrid' = 'standard';
jest.mock('../contexts/PreferencesContext', () => ({
  usePreferences: () => ({
    preferences: {
      units: 'metric',
      mapType: mockCurrentMapType,
      notificationsWanted: true,
    },
    setUnits: jest.fn(),
    setMapType: jest.fn(),
    setNotificationsWanted: jest.fn(),
    loaded: true,
    saveError: null,
  }),
}));

import UnifiedRideObstacleScreen from '../screens/Mapping/UnifiedRideObstacleScreen';

describe('G5 Report Screens - Task 1: MapType from Preferences', () => {
  beforeEach(() => {
    mockMapViewProps.mockClear();
    mockCurrentMapType = 'standard';
  });

  it('passes the stored mapType from preferences to the report MapView', async () => {
    mockCurrentMapType = 'satellite';
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <UnifiedRideObstacleScreen
          route={{ params: { initialTab: 'report' } }}
          navigation={{ goBack: jest.fn(), navigate: jest.fn() }}
          initialTab="report"
        />
      );
    });

    expect(mockMapViewProps).toHaveBeenCalled();
    const lastCallProps = mockMapViewProps.mock.calls[mockMapViewProps.mock.calls.length - 1][0];
    expect(lastCallProps.mapType).toBe('satellite');

    act(() => {
      renderer.unmount();
    });
  });

  it('updates the report MapView when mapType preference is hybrid', async () => {
    mockCurrentMapType = 'hybrid';
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <UnifiedRideObstacleScreen
          route={{ params: { initialTab: 'report' } }}
          navigation={{ goBack: jest.fn(), navigate: jest.fn() }}
          initialTab="report"
        />
      );
    });

    expect(mockMapViewProps).toHaveBeenCalled();
    const lastCallProps = mockMapViewProps.mock.calls[mockMapViewProps.mock.calls.length - 1][0];
    expect(lastCallProps.mapType).toBe('hybrid');

    act(() => {
      renderer.unmount();
    });
  });
});

describe('G5 Report Screens - Task 2: Hazard feed in dark mode', () => {
  afterEach(() => jest.restoreAllMocks());

  it('renders hazard-unavailable title with readable textPrimary token in dark mode', async () => {
    const ReactNative = require('react-native');
    const { Colors } = require('../constants/colors');
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');

    const ObstacleService = require('../services/ObstacleService');
    ObstacleService.subscribeToObstacles.mockImplementationOnce((cb: any, opts: any, onStatusChange: any) => {
      onStatusChange?.('unavailable');
      cb([], 'unavailable');
      return () => {};
    });

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <UnifiedRideObstacleScreen
          route={{ params: { initialTab: 'obstacles' } }}
          navigation={{ goBack: jest.fn(), navigate: jest.fn() }}
          initialTab="obstacles"
        />
      );
    });

    const texts = renderer.root.findAllByType(ReactNative.Text);
    const unavailableTitle = texts.find((t) => [t.props.children].flat().join('').includes('Hazard reports unavailable'));
    expect(unavailableTitle).toBeDefined();

    const flatStyle = ReactNative.StyleSheet.flatten(unavailableTitle!.props.style);
    expect(flatStyle.color).toBe(Colors.dark.textPrimary);
    expect(flatStyle.color).not.toBe(Colors.dark.background);
    expect(flatStyle.color).not.toBe(Colors.dark.card);

    act(() => {
      renderer.unmount();
    });
  });
});
