import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockParentNavigate = jest.fn();
const mockGetParent = jest.fn(() => ({ navigate: mockParentNavigate }));

let mockRouteParams: Record<string, unknown> | undefined = {};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    getParent: mockGetParent,
    canGoBack: () => true,
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

jest.mock('react-native-gifted-charts', () => ({
  LineChart: () => null,
  BarChart: () => null,
  PieChart: () => null,
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
const mockGetUserRidesByTimePeriod = jest.fn();
jest.mock('../services/UserAnalyticsService', () => ({
  getCurrentUserRides: () => mockGetCurrentUserRides(),
  getUserRidesByTimePeriod: () => mockGetUserRidesByTimePeriod(),
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

let mockUnits: 'metric' | 'imperial' = 'metric';
jest.mock('../contexts/PreferencesContext', () => ({
  usePreferences: () => ({
    preferences: { units: mockUnits },
    updatePreferences: jest.fn(),
  }),
}));

import GlobalTrailStatsScreen from '../screens/Analytics/GlobalTrailStatsScreen';
import UserStatsScreen from '../screens/Analytics/UserStatsScreen';
import PersonalStatsScreen from '../screens/Analytics/PersonalStatsScreen';
import { analyticsOk } from '../services/analyticsResult';

describe('G3 Analytics flow — five required behaviours', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = {};
    mockUnits = 'metric';
    mockGlobal.stats.mockResolvedValue(
      analyticsOk({
        totalRides: 12,
        totalDistance: 25000,
        totalDuration: 7200000,
        totalElevation: 120,
        uniqueUsers: 4,
        rides: [],
      })
    );
    mockGlobal.users.mockResolvedValue(analyticsOk([]));
    mockGlobal.trails.mockResolvedValue(analyticsOk([]));
    mockGetCurrentUserRides.mockResolvedValue(analyticsOk([]));
    mockGetUserRidesByTimePeriod.mockResolvedValue(analyticsOk([]));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Behaviour 1: Global Analytics -> My stats opens Your Stats
  it('1. Global Analytics "My stats" button navigates to DetailedStats (Your Stats)', async () => {
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

  // Behaviour 2: Your Stats -> Detailed Analytics opens Personal Stats inside the Analytics tab
  it('2. Your Stats "Detailed Analytics" card navigates to PersonalStats inside Analytics tab', async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<UserStatsScreen />);
    });

    const detailedCard = renderer.root
      .findAllByType(TouchableOpacity)
      .find((node) => node.findAllByType(Text).some((t) => t.props.children === 'Detailed Analytics'));

    expect(detailedCard).toBeDefined();

    await act(async () => {
      detailedCard!.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('PersonalStats');
    expect(mockParentNavigate).not.toHaveBeenCalledWith('ProfileStack', expect.anything());
  });

  // Behaviour 3: From there, header back and Android back go to Your Stats; back again goes to global Analytics
  describe('3. Back flow chain', () => {
    it('3a. Personal Stats header back calls goBack to return to Your Stats', async () => {
      mockRouteParams = {};
      let renderer!: TestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = TestRenderer.create(<PersonalStatsScreen />);
      });

      // The back button is the touchable near the header title
      const backButtons = renderer.root
        .findAllByType(TouchableOpacity)
        .filter((node) => node.findAllByType(Text).length === 0);

      expect(backButtons.length).toBeGreaterThan(0);
      const backBtn = backButtons[0];

      await act(async () => {
        backBtn.props.onPress();
      });

      expect(mockGoBack).toHaveBeenCalledTimes(1);
      expect(mockParentNavigate).not.toHaveBeenCalled();
    });

    it('3b. Back again from Your Stats calls goBack to return to global Analytics', async () => {
      mockRouteParams = {};
      let renderer!: TestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = TestRenderer.create(<UserStatsScreen />);
      });

      const backBtn = renderer.root.findByProps({ accessibilityLabel: 'Go back' });
      expect(backBtn).toBeDefined();

      await act(async () => {
        backBtn.props.onPress();
      });

      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });
  });

  // Behaviour 4: Your Stats has an on-screen back button (48 pt, accessibility label "Go back") that goes to global Analytics
  it('4. Your Stats has a 48 pt on-screen back button with accessibility label "Go back"', async () => {
    mockRouteParams = {};
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<UserStatsScreen />);
    });

    const backBtn = renderer.root.findByProps({ accessibilityLabel: 'Go back' });
    expect(backBtn).toBeDefined();
    expect(backBtn.props.accessibilityRole).toBe('button');

    const flattened = StyleSheet.flatten(backBtn.props.style);
    expect(flattened.width).toBe(48);
    expect(flattened.height).toBe(48);

    await act(async () => {
      backBtn.props.onPress();
    });

    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  // Behaviour 5: Personal Stats opened from Profile still goes back to Profile. Opened from the Dashboard (fromDashboard), it still goes to the Dashboard.
  describe('5. Personal Stats origin-dependent back destination', () => {
    it('5a. Personal Stats opened without fromDashboard (e.g. from Profile) calls goBack to return to Profile', async () => {
      mockRouteParams = undefined;
      let renderer!: TestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = TestRenderer.create(<PersonalStatsScreen />);
      });

      const backButtons = renderer.root
        .findAllByType(TouchableOpacity)
        .filter((node) => node.findAllByType(Text).length === 0);
      const backBtn = backButtons[0];

      await act(async () => {
        backBtn.props.onPress();
      });

      expect(mockGoBack).toHaveBeenCalledTimes(1);
      expect(mockParentNavigate).not.toHaveBeenCalledWith('Dashboard');
    });

    it('5b. Personal Stats opened from Dashboard with fromDashboard: true navigates to Dashboard', async () => {
      mockRouteParams = { fromDashboard: true };
      let renderer!: TestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = TestRenderer.create(<PersonalStatsScreen />);
      });

      const backButtons = renderer.root
        .findAllByType(TouchableOpacity)
        .filter((node) => node.findAllByType(Text).length === 0);
      const backBtn = backButtons[0];

      await act(async () => {
        backBtn.props.onPress();
      });

      expect(mockGoBack).not.toHaveBeenCalled();
      expect(mockParentNavigate).toHaveBeenCalledWith('Dashboard');
    });

    it('5c. Your Stats opened with fromDashboard: true also navigates to Dashboard', async () => {
      mockRouteParams = { fromDashboard: true };
      let renderer!: TestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = TestRenderer.create(<UserStatsScreen />);
      });

      const backBtn = renderer.root.findByProps({ accessibilityLabel: 'Go back' });
      await act(async () => {
        backBtn.props.onPress();
      });

      expect(mockGoBack).not.toHaveBeenCalled();
      expect(mockParentNavigate).toHaveBeenCalledWith('Dashboard');
    });
  });

  describe('The hub (UserStatsScreen) follows km/mi preferences', () => {
    it('shows KM, km/h, and km when metric is selected', async () => {
      mockUnits = 'metric';
      let renderer!: TestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = TestRenderer.create(<UserStatsScreen />);
      });

      const allTexts = renderer.root
        .findAllByType(Text)
        .map((t) => [t.props.children].flat().join(''));

      expect(allTexts).toContain('KM');
      expect(allTexts).not.toContain('MI');
      expect(allTexts.some((t) => t.includes('km/h'))).toBe(true);
      expect(allTexts.some((t) => t.includes('mph'))).toBe(false);
    });

    it('shows MI, mph, and mi when imperial is selected', async () => {
      mockUnits = 'imperial';
      let renderer!: TestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = TestRenderer.create(<UserStatsScreen />);
      });

      const allTexts = renderer.root
        .findAllByType(Text)
        .map((t) => [t.props.children].flat().join(''));

      expect(allTexts).toContain('MI');
      expect(allTexts).not.toContain('KM');
      expect(allTexts.some((t) => t.includes('mph'))).toBe(true);
      expect(allTexts.some((t) => t.includes('km/h'))).toBe(false);
      expect(allTexts.some((t) => t.includes('mi'))).toBe(true);
    });
  });
});
