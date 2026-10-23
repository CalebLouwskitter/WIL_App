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
import ObstacleView from '../screens/Mapping/ObstacleView';
import MarkObstacleScreen from '../screens/Mapping/MarkObstacleScreen';
import MapStatusFrame from '../components/MapStatusFrame';
import type { MapStatusHandle } from '../hooks/useMapStatus';

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

describe('G5 Report Screens - Task 3: ObstacleView & MarkObstacleScreen theme', () => {
  const ReactNative = require('react-native');
  const { Colors } = require('../constants/colors');

  afterEach(() => jest.restoreAllMocks());

  it('renders ObstacleView callout and badge with theme tokens in dark mode', () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');

    const sampleObstacle = {
      id: 'o1',
      userId: 'u1',
      title: 'Fallen branch',
      severity: 'critical' as const,
      type: 'tree' as const,
      status: 'active' as const,
      location: { latitude: -26.2, longitude: 28.0 },
      reportedAt: 100,
      createdAt: 100,
      updatedAt: 100,
    };

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<ObstacleView obstacles={[sampleObstacle]} />);
    });

    const texts = renderer.root.findAllByType(ReactNative.Text);
    const titleText = texts.find((t) => [t.props.children].flat().join('') === 'Fallen branch');
    expect(titleText).toBeDefined();
    const titleStyle = ReactNative.StyleSheet.flatten(titleText!.props.style);
    expect(titleStyle.color).toBe(Colors.dark.textPrimary);

    const severityText = texts.find((t) => [t.props.children].flat().join('') === 'critical');
    expect(severityText).toBeDefined();
    const severityBadge = renderer.root.findAllByType(ReactNative.View).find((v) => {
      const s = ReactNative.StyleSheet.flatten(v.props.style);
      return s?.backgroundColor === Colors.dark.obstacleCritical;
    });
    expect(severityBadge).toBeDefined();
  });

  it('renders MarkObstacleScreen container and section title in dark mode', () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <MarkObstacleScreen navigation={{ goBack: jest.fn() }} />
      );
    });

    const rootViews = renderer.root.findAllByType(ReactNative.View);
    const container = ReactNative.StyleSheet.flatten(rootViews[0].props.style);
    expect(container.backgroundColor).toBe(Colors.dark.background);

    const texts = renderer.root.findAllByType(ReactNative.Text);
    const sectionTitle = texts.find((t) => [t.props.children].flat().join('') === 'Obstacle Type');
    expect(sectionTitle).toBeDefined();
    const titleStyle = ReactNative.StyleSheet.flatten(sectionTitle!.props.style);
    expect(titleStyle.color).toBe(Colors.dark.textPrimary);
  });
});

describe('G5 Report Screens - Task 4: MapStatusFrame theme', () => {
  const ReactNative = require('react-native');
  const { Colors } = require('../constants/colors');

  afterEach(() => jest.restoreAllMocks());

  it('renders "Map couldn\'t load" text with readable tokens in dark mode', () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');

    const failedStatus: MapStatusHandle = {
      state: { phase: 'failed', failure: 'tiles-timeout', size: { width: 300, height: 300 }, attempt: 1, errorMessage: null },
      mapKey: 'k1',
      mapProps: { onMapReady: jest.fn(), onMapLoaded: jest.fn(), onLayout: jest.fn() },
      retry: jest.fn(),
      reportError: jest.fn(),
    };

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <MapStatusFrame status={failedStatus}>
          <ReactNative.View />
        </MapStatusFrame>
      );
    });

    const texts = renderer.root.findAllByType(ReactNative.Text);
    const title = texts.find((t) => [t.props.children].flat().join('').includes("Map couldn't load"));
    expect(title).toBeDefined();

    const titleStyle = ReactNative.StyleSheet.flatten(title!.props.style);
    expect(titleStyle.color).toBe(Colors.dark.textPrimary);
    expect(titleStyle.color).not.toBe(Colors.dark.card);
    expect(titleStyle.color).not.toBe(Colors.dark.background);

    const hint = texts.find((t) => [t.props.children].flat().join('').includes('map tiles'));
    expect(hint).toBeDefined();
    const hintStyle = ReactNative.StyleSheet.flatten(hint!.props.style);
    expect(hintStyle.color).toBe(Colors.dark.textSecondary);
    expect(hintStyle.color).not.toBe(Colors.dark.card);
    expect(hintStyle.color).not.toBe(Colors.dark.background);

    const retryBtn = renderer.root.findAllByType(ReactNative.TouchableOpacity).find(
      (b) => b.props.accessibilityLabel === 'Retry loading the map'
    );
    expect(retryBtn).toBeDefined();
    const retryBtnStyle = ReactNative.StyleSheet.flatten(retryBtn!.props.style);
    expect(retryBtnStyle.backgroundColor).toBe(Colors.dark.brandPrimary);
  });

  it('renders loading pill with card background and textPrimary in dark mode', () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');

    const startingStatus: MapStatusHandle = {
      state: { phase: 'starting', failure: null, size: null, attempt: 1, errorMessage: null },
      mapKey: 'k1',
      mapProps: { onMapReady: jest.fn(), onMapLoaded: jest.fn(), onLayout: jest.fn() },
      retry: jest.fn(),
      reportError: jest.fn(),
    };

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <MapStatusFrame status={startingStatus}>
          <ReactNative.View />
        </MapStatusFrame>
      );
    });

    const texts = renderer.root.findAllByType(ReactNative.Text);
    const pillText = texts.find((t) => [t.props.children].flat().join('').includes('Starting map'));
    expect(pillText).toBeDefined();
    const pillTextStyle = ReactNative.StyleSheet.flatten(pillText!.props.style);
    expect(pillTextStyle.color).toBe(Colors.dark.textPrimary);

    const pillView = renderer.root.findAllByType(ReactNative.View).find((v) => {
      const s = ReactNative.StyleSheet.flatten(v.props.style);
      return s?.backgroundColor === Colors.dark.card;
    });
    expect(pillView).toBeDefined();
  });
});
