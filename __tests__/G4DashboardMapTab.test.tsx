import React from 'react';
import * as ReactNative from 'react-native';
import { Text, TouchableOpacity, View, StyleSheet, SafeAreaView } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { Colors } from '../constants/colors';

// Navigation mock
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockDispatch = jest.fn();
const mockGetParent = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    dispatch: mockDispatch,
    getParent: mockGetParent,
  }),
  useRoute: () => ({ params: {} }),
  useFocusEffect: (cb: any) => {
    const React = require('react');
    React.useEffect(cb, []);
  },
  CommonActions: {
    reset: jest.fn(),
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 40, bottom: 20, left: 0, right: 0 }),
}));

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
  FontAwesome5: () => null,
}));

jest.mock('react-native-vector-icons/Feather', () => () => null);

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, style }: any) => React.createElement(View, { style }, children),
  };
});

jest.mock('expo-blur', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    BlurView: ({ children, style }: any) => React.createElement(View, { style }, children),
  };
});

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: { latitude: -33.96, longitude: 25.57 },
  }),
  watchHeadingAsync: jest.fn().mockResolvedValue({ remove: jest.fn() }),
  Accuracy: { Balanced: 3 },
}));

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockMapView = (props: any) => <View testID="map-view" {...props} />;
  const MockMarker = (props: any) => <View testID="map-marker" {...props} />;
  return {
    __esModule: true,
    default: MockMapView,
    Marker: MockMarker,
    PROVIDER_DEFAULT: 'default',
  };
});

jest.mock('../components/MapViewTracker', () => () => null);
jest.mock('../components/RideStatsCard', () => () => null);
jest.mock('../components/Modals/SettingsModal', () => () => null);
jest.mock('../components/Modals/NotificationsModal', () => () => null);

jest.mock('../hooks/useMapStatus', () => ({
  useMapStatus: () => ({
    state: { phase: 'loaded' },
    mapKey: 'preview-key',
    mapProps: {},
    retry: jest.fn(),
    reportError: jest.fn(),
  }),
}));

const mockRideTracker = {
  rideData: null,
  status: 'idle',
  currentSpeed: 0,
  startRide: jest.fn(),
  stopRide: jest.fn(),
  isBackgroundEnabled: false,
  persistWarning: null,
};
jest.mock('../components/backgroundServices', () => ({
  useBackgroundRideTracker: () => mockRideTracker,
}));

jest.mock('../contexts/RideRecoveryContext', () => ({
  useRideRecovery: () => ({
    hasRecoverableRide: false,
    isResumed: false,
    clearRecoveryState: jest.fn(),
    checkForRecoverableRide: jest.fn().mockResolvedValue('none'),
  }),
}));

const mockPreferences = {
  units: 'metric' as 'metric' | 'imperial',
  mapType: 'standard' as 'standard' | 'satellite' | 'hybrid' | 'terrain',
  followSos: false,
};
jest.mock('../contexts/PreferencesContext', () => ({
  usePreferences: () => ({
    preferences: mockPreferences,
    setUnits: jest.fn(),
    setMapType: jest.fn(),
    loaded: true,
  }),
}));

jest.mock('../services/HorseStorage', () => ({
  getActiveHorse: jest.fn().mockResolvedValue(null),
  getActiveHorseId: jest.fn().mockResolvedValue(null),
  getHorses: jest.fn().mockResolvedValue([]),
  deleteHorse: jest.fn().mockResolvedValue(undefined),
  setActiveHorseId: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/RideArchive', () => ({
  archiveEndedDraft: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/RideStorage', () => ({
  getRides: jest.fn().mockResolvedValue([]),
}));

jest.mock('../services/OnlineUserService', () => ({
  startLocationBroadcast: jest.fn().mockResolvedValue(undefined),
  stopLocationBroadcast: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../hooks/useOnlineUsers', () => () => ({
  users: [
    {
      uid: 'user-1',
      displayName: 'Rider Alice',
      location: { latitude: -33.96, longitude: 25.57 },
      lastSeen: Date.now(),
      isRiding: true,
    },
  ],
  loading: false,
  source: 'live',
}));

jest.mock('../services/firebase', () => ({
  auth: { currentUser: { uid: 'my-uid' } },
  firestore: null,
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  onSnapshot: jest.fn(() => () => {}),
  getDocs: jest.fn().mockResolvedValue({ docs: [] }),
}));

import LiveTrackingScreen from '../screens/Mapping/LiveTrackingScreen';
import OnlineUsersScreen from '../screens/Mapping/OnlineUsers';
import DashboardScreen from '../screens/Dashboard/DashboardScreen';
import ErrorBoundary from '../components/ErrorBoundary';
import SelectHorseScreen from '../screens/Mapping/SelectHorseScreen';
import { getRides } from '../services/RideStorage';

describe('G4 Dashboard & Map Tab — Task 1: Riders Online & OnlineUsers ScreenHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders "Riders online" button on Map tab with >= 44pt touch target and navigates to OnlineUsers', async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<LiveTrackingScreen navigation={{ navigate: mockNavigate } as any} />);
    });

    const buttons = renderer.root.findAllByType(TouchableOpacity);
    const ridersBtn = buttons.find(
      (b) => b.props.accessibilityLabel === 'Riders online'
    );
    expect(ridersBtn).toBeDefined();

    // Check accessibility role
    expect(ridersBtn!.props.accessibilityRole).toBe('button');

    // Check touch target is at least 44 pt
    const flatStyle = StyleSheet.flatten(ridersBtn!.props.style);
    expect(flatStyle.minHeight).toBeGreaterThanOrEqual(44);
    expect(flatStyle.minWidth).toBeGreaterThanOrEqual(44);

    // Check label text is present inside button
    const texts = ridersBtn!.findAllByType(Text);
    const hasLabel = texts.some((t) => [t.props.children].flat().join('') === 'Riders online');
    expect(hasLabel).toBe(true);

    // Check press navigates to OnlineUsers
    act(() => {
      ridersBtn!.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('OnlineUsers');
    renderer.unmount();
  });

  it('OnlineUsers screen renders ScreenHeader and its back button calls navigation.goBack()', async () => {
    const mockNav = { goBack: mockGoBack, navigate: mockNavigate };
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<OnlineUsersScreen navigation={mockNav} />);
    });

    const buttons = renderer.root.findAllByType(TouchableOpacity);
    const backBtn = buttons.find(
      (b) => b.props.accessibilityLabel === 'Go back'
    );
    expect(backBtn).toBeDefined();

    act(() => {
      backBtn!.props.onPress();
    });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    renderer.unmount();
  });
});

describe('G4 Dashboard — Task 2: 7-day chart follows km/mi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows km subtitle and km total when preferences.units is metric', async () => {
    mockPreferences.units = 'metric';
    (getRides as jest.Mock).mockResolvedValueOnce([
      { startTime: Date.now() - 3600000, totalDistance: 10000 },
    ]);

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<DashboardScreen />);
    });

    const allTexts = renderer.root.findAllByType(Text).map((t) => [t.props.children].flat().join(''));
    expect(allTexts).toContain('Distance ridden per day, last 7 days (km)');
    expect(allTexts).toContain('10.0 km');
    renderer.unmount();
  });

  it('shows mi subtitle and mi total when preferences.units is imperial', async () => {
    mockPreferences.units = 'imperial';
    (getRides as jest.Mock).mockResolvedValueOnce([
      { startTime: Date.now() - 3600000, totalDistance: 10000 },
    ]);

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<DashboardScreen />);
    });

    const allTexts = renderer.root.findAllByType(Text).map((t) => [t.props.children].flat().join(''));
    expect(allTexts).toContain('Distance ridden per day, last 7 days (mi)');
    // 10000 metres in miles: 10000 / 1609.344 = 6.2137 => 6.2 mi
    expect(allTexts).toContain('6.2 mi');
    renderer.unmount();
  });
});

describe('G4 Dashboard — Task 3: map preview uses stored map type', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes preferences.mapType to the preview MapView', async () => {
    mockPreferences.mapType = 'satellite';

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<DashboardScreen />);
    });

    const mapViews = renderer.root.findAllByProps({ testID: 'map-view' });
    expect(mapViews.length).toBeGreaterThan(0);
    expect(mapViews[0].props.mapType).toBe('satellite');
    renderer.unmount();
  });

  it('renders Dashboard with dark theme tokens in dark mode', async () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<DashboardScreen />);
    });

    const safeAreas = renderer.root.findAllByType(SafeAreaView);
    const containerStyle = StyleSheet.flatten(safeAreas[0].props.style);
    expect(containerStyle.backgroundColor).toBe(Colors.dark.background);

    const texts = renderer.root.findAllByType(Text);
    const startRideText = texts.find((t) => [t.props.children].flat().join('') === 'Start Ride');
    expect(startRideText).toBeDefined();
    const textStyle = StyleSheet.flatten(startRideText!.props.style);
    expect(textStyle.color).toBe(Colors.dark.textPrimary);

    renderer.unmount();
  });
});

describe('G4 ErrorBoundary — Theme support', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders themed error UI in dark mode when an error is caught', () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const Thrower = () => {
      throw new Error('Test crash');
    };

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <ErrorBoundary>
          <Thrower />
        </ErrorBoundary>
      );
    });

    const rootViews = renderer.root.findAllByType(View);
    const containerStyle = StyleSheet.flatten(rootViews[0].props.style);
    expect(containerStyle.backgroundColor).toBe(Colors.dark.background);

    const texts = renderer.root.findAllByType(Text);
    const titleText = texts.find((t) => [t.props.children].flat().join('') === 'Something went wrong');
    expect(titleText).toBeDefined();
    const titleStyle = StyleSheet.flatten(titleText!.props.style);
    expect(titleStyle.color).toBe(Colors.dark.textPrimary);

    renderer.unmount();
  });
});

describe('G4 SelectHorseScreen — Theme support', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders themed SelectHorseScreen in dark mode', async () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<SelectHorseScreen />);
    });

    const rootViews = renderer.root.findAllByType(View);
    const containerStyle = StyleSheet.flatten(rootViews[0].props.style);
    expect(containerStyle.backgroundColor).toBe(Colors.dark.background);

    const texts = renderer.root.findAllByType(Text);
    const titleText = texts.find((t) => [t.props.children].flat().join('') === 'Select Your Horse');
    expect(titleText).toBeDefined();
    const titleStyle = StyleSheet.flatten(titleText!.props.style);
    expect(titleStyle.color).toBe(Colors.dark.textPrimary);

    renderer.unmount();
  });
});
