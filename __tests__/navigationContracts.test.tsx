import React from 'react';
import { TouchableOpacity } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockParentNavigate = jest.fn();
const mockGetParent = jest.fn(() => ({ navigate: mockParentNavigate }));

let mockRouteParams: Record<string, unknown> = {};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    getParent: mockGetParent,
  }),
  useRoute: () => ({
    params: mockRouteParams,
  }),
  useFocusEffect: (cb: () => void) => cb(),
  CommonActions: {},
}));

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
  FontAwesome5: () => null,
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

jest.mock('react-native-maps', () => ({
  __esModule: true,
  default: () => null,
  Polyline: () => null,
  PROVIDER_DEFAULT: 'default',
}));

jest.mock('../components/Modals/SettingsModal', () => () => null);
jest.mock('../components/Modals/NotificationsModal', () => () => null);
jest.mock('../services/firebase', () => ({ auth: null, firestore: null, FIREBASE_ENABLED: false }));

const mockGetCurrentUserRides = jest.fn();
jest.mock('../services/UserAnalyticsService', () => ({
  getCurrentUserRides: () => mockGetCurrentUserRides(),
}));

import RideStatsScreen from '../screens/Analytics/RideStatsScreen';

beforeEach(() => {
  jest.clearAllMocks();
  mockRouteParams = {};
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('RideStatsScreen back navigation contract', () => {
  it('in loading state: does not navigate to ProfileMain, calls goBack when not from dashboard', async () => {
    // Keep in loading state with unresolved promise
    mockGetCurrentUserRides.mockReturnValue(new Promise(() => {}));
    mockRouteParams = {};

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<RideStatsScreen />);
    });

    const backButton = renderer.root.findByType(TouchableOpacity);
    await act(async () => {
      backButton.props.onPress();
    });

    expect(mockNavigate).not.toHaveBeenCalledWith('ProfileMain');
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(mockParentNavigate).not.toHaveBeenCalled();
  });

  it('in loading state: does not navigate to ProfileMain, navigates to Dashboard when fromDashboard is true', async () => {
    mockGetCurrentUserRides.mockReturnValue(new Promise(() => {}));
    mockRouteParams = { fromDashboard: true };

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<RideStatsScreen />);
    });

    const backButton = renderer.root.findByType(TouchableOpacity);
    await act(async () => {
      backButton.props.onPress();
    });

    expect(mockNavigate).not.toHaveBeenCalledWith('ProfileMain');
    expect(mockGoBack).not.toHaveBeenCalled();
    expect(mockParentNavigate).toHaveBeenCalledWith('Dashboard');
  });

  it('in loaded state: calls goBack when fromDashboard is false', async () => {
    mockGetCurrentUserRides.mockResolvedValue({ status: 'ok', data: [] });
    mockRouteParams = {};

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<RideStatsScreen />);
    });

    const backButton = renderer.root.findByType(TouchableOpacity);
    await act(async () => {
      backButton.props.onPress();
    });

    expect(mockNavigate).not.toHaveBeenCalledWith('ProfileMain');
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
