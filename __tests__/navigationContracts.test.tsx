import React from 'react';
import { Alert, Text, TouchableOpacity } from 'react-native';
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

jest.mock('react-native-chart-kit', () => ({
  LineChart: () => null,
  BarChart: () => null,
  PieChart: () => null,
}));

jest.mock('../contexts/PreferencesContext', () => ({
  usePreferences: () => ({
    preferences: { units: 'metric' },
    updatePreferences: jest.fn(),
  }),
}));
jest.mock('../components/Modals/SettingsModal', () => () => null);
jest.mock('../components/Modals/NotificationsModal', () => () => null);
jest.mock('../components/AnalyticsDownloadButton', () => ({
  AnalyticsDownloadButton: () => null,
}));
jest.mock('../components/AnalyticsUnavailableNotice', () => ({
  AnalyticsUnavailableNotice: () => null,
}));
jest.mock('../services/firebase', () => ({ auth: null, firestore: null, FIREBASE_ENABLED: false }));

const mockGetCurrentUserRides = jest.fn();
jest.mock('../services/UserAnalyticsService', () => ({
  getCurrentUserRides: () => mockGetCurrentUserRides(),
}));

const mockGlobal = { stats: jest.fn(), users: jest.fn(), trails: jest.fn() };
jest.mock('../services/GlobalAnalyticsService', () => ({
  getGlobalRideStats: () => mockGlobal.stats(),
  getUserRideStats: () => mockGlobal.users(),
  getGlobalTrailUsage: () => mockGlobal.trails(),
}));

const mockAnalytics = {
  stats: {
    totalRides: 5,
    totalDistance: 10000,
    totalDuration: 3600000,
    totalElevationGain: 50,
    averageDistance: 2000,
    averageDuration: 720000,
    averageSpeed: 10,
    longestRide: 3000,
    longestDuration: 1000000,
    totalPoints: 100,
    rides: [],
  },
  loading: false,
  error: null,
  refresh: jest.fn(),
};
jest.mock('../hooks/useAnalytics', () => ({
  useAnalytics: () => mockAnalytics,
}));

const mockResumeRide = jest.fn();
const mockRideRecoveryState = {
  hasRecoverableRide: false,
  isResumed: false,
  notice: null as unknown,
  promptRequest: 0,
  recoveryKind: null as string | null,
  recoveredRideData: null as unknown,
  resumeRide: mockResumeRide,
  saveRecoveredRide: jest.fn(),
  discardRecoveredRide: jest.fn(),
  ackNotice: jest.fn(),
  markAlertShown: jest.fn(),
  retryArchive: jest.fn(),
  dismissNotice: jest.fn(),
};
jest.mock('../contexts/RideRecoveryContext', () => ({
  useRideRecovery: () => mockRideRecoveryState,
}));

import RideStatsScreen from '../screens/Analytics/RideStatsScreen';
import GlobalTrailStatsScreen from '../screens/Analytics/GlobalTrailStatsScreen';
import UserStatsScreen from '../screens/Analytics/UserStatsScreen';
import { RideRecoveryHandler } from '../components/RideRecoveryHandler';
import { analyticsOk } from '../services/analyticsResult';

beforeEach(() => {
  jest.clearAllMocks();
  mockRouteParams = {};
  mockRideRecoveryState.hasRecoverableRide = false;
  mockRideRecoveryState.isResumed = false;
  mockRideRecoveryState.notice = null;
  mockRideRecoveryState.recoveredRideData = null;
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('RideStatsScreen back navigation contract', () => {
  it('in loading state: does not navigate to ProfileMain, calls goBack when not from dashboard', async () => {
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

describe('Analytics hub navigation contract', () => {
  it('GlobalTrailStatsScreen has "My stats" header action that navigates to DetailedStats', async () => {
    mockGlobal.stats.mockResolvedValue(analyticsOk({ totalRides: 0, totalDistance: 0, totalDuration: 0, totalElevation: 0, uniqueUsers: 0, rides: [] }));
    mockGlobal.users.mockResolvedValue(analyticsOk([]));
    mockGlobal.trails.mockResolvedValue(analyticsOk([]));

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<GlobalTrailStatsScreen />);
    });

    const myStatsBtn = renderer.root.findByProps({ accessibilityLabel: 'My stats' });
    expect(myStatsBtn).toBeDefined();

    await act(async () => {
      myStatsBtn.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('DetailedStats');
  });

  it('UserStatsScreen Detailed Analytics card navigates to PersonalStats inside AnalyticsStack', async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<UserStatsScreen />);
    });

    // Find the card with text 'Detailed Analytics'
    const detailedCard = renderer.root.findAllByType(TouchableOpacity).find((n) =>
      n.findAllByType(Text).some((t) => t.props.children === 'Detailed Analytics')
    );
    expect(detailedCard).toBeDefined();

    await act(async () => {
      detailedCard!.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('PersonalStats');
    expect(mockParentNavigate).not.toHaveBeenCalledWith('ProfileStack', expect.anything());
    // Crucially: it must NOT navigate to DetailedStats (self-link)
    expect(mockNavigate).not.toHaveBeenCalledWith('DetailedStats');
  });
});

describe('RideRecoveryHandler navigation contract', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('navigates to Main -> Mapping -> LiveTracking using explicit nested route shape on resume', async () => {
    mockRideRecoveryState.hasRecoverableRide = true;
    mockRideRecoveryState.isResumed = false;
    mockRideRecoveryState.promptRequest = 1;
    mockRideRecoveryState.recoveryKind = 'active';
    mockRideRecoveryState.notice = null;
    mockRideRecoveryState.recoveredRideData = { startTime: Date.now() - 60000, lastUpdateTime: Date.now() - 10000 };
    mockResumeRide.mockResolvedValue(true);

    let alertButtons: any[] = [];
    jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
      alertButtons = buttons || [];
    });

    await act(async () => {
      TestRenderer.create(<RideRecoveryHandler />);
    });

    expect(Alert.alert).toHaveBeenCalled();
    const resumeBtn = alertButtons.find((b) => b.text === 'Resume' || b.text === 'Continue');
    expect(resumeBtn).toBeDefined();

    await act(async () => {
      await resumeBtn.onPress();
      jest.advanceTimersByTime(600);
    });

    expect(mockNavigate).toHaveBeenCalledWith('Main', {
      screen: 'Mapping',
      params: { screen: 'LiveTracking' },
    });
  });
});
