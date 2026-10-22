import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn(), getParent: () => undefined }),
  useRoute: () => ({ params: {} }),
  CommonActions: {},
}));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
jest.mock('react-native-chart-kit', () => ({ LineChart: () => null, BarChart: () => null, PieChart: () => null }));
jest.mock('react-native-maps', () => ({ __esModule: true, default: () => null, Polyline: () => null, PROVIDER_DEFAULT: 'default' }));
jest.mock('../components/Modals/SettingsModal', () => () => null);
jest.mock('../components/Modals/NotificationsModal', () => () => null);
jest.mock('../services/firebase', () => ({ auth: null, FIREBASE_ENABLED: false }));
jest.mock('../services/AnalyticsDownloadService', () => ({ downloadAndShareGlobalAnalytics: jest.fn() }));

const mockGlobal = { stats: jest.fn(), users: jest.fn(), trails: jest.fn() };
jest.mock('../services/GlobalAnalyticsService', () => ({
  getGlobalRideStats: () => mockGlobal.stats(),
  getUserRideStats: () => mockGlobal.users(),
  getGlobalTrailUsage: () => mockGlobal.trails(),
}));
const mockUserRides = jest.fn();
jest.mock('../services/UserAnalyticsService', () => ({
  getCurrentUserRides: () => mockUserRides(),
}));

import GlobalTrailStatsScreen from '../screens/Analytics/GlobalTrailStatsScreen';
import RideStatsScreen from '../screens/Analytics/RideStatsScreen';
import { AnalyticsDownloadButton } from '../components/AnalyticsDownloadButton';
import { analyticsError, analyticsOk, analyticsUnavailable } from '../services/analyticsResult';

const zeroStats = { totalRides: 0, totalDistance: 0, totalDuration: 0, totalElevation: 0, uniqueUsers: 0, rides: [] };

const texts = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAllByType(Text).map((n) => [n.props.children].flat().join(''));

const mount = async (el: React.ReactElement) => {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(el);
  });
  return r;
};

const mockGlobalReads = (stats: unknown, users: unknown, trails: unknown) => {
  mockGlobal.stats.mockResolvedValue(stats);
  mockGlobal.users.mockResolvedValue(users);
  mockGlobal.trails.mockResolvedValue(trails);
};

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  // RN's SafeAreaView deprecation warning, emitted by the existing screens
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('GlobalTrailStatsScreen: unavailable versus zero', () => {
  it('shows an unavailable state, not zeros, when not connected', async () => {
    mockGlobalReads(
      analyticsUnavailable('firebase-off', zeroStats),
      analyticsUnavailable('firebase-off', []),
      analyticsUnavailable('firebase-off', []),
    );
    const r = await mount(<GlobalTrailStatsScreen />);
    const t = texts(r);

    expect(t).toContain('Not connected to SBHRA servers');
    expect(t).toContain('Analytics unavailable');
    expect(t).not.toContain('Active Riders');
    expect(t).not.toContain('Total Rides');

    const exportButton = r.root.findByType(AnalyticsDownloadButton);
    expect(exportButton.props.disabled).toBe(true);
    expect(exportButton.props.disabledReason).toMatch(/unavailable/i);
  });

  it('shows real zeros, with the export enabled, when connected and there is no activity', async () => {
    mockGlobalReads(analyticsOk(zeroStats), analyticsOk([]), analyticsOk([]));
    const r = await mount(<GlobalTrailStatsScreen />);
    const t = texts(r);

    expect(t).toContain('Active Riders');
    expect(t).toContain('Total Rides');
    expect(t).not.toContain('Not connected to SBHRA servers');
    expect(r.root.findByType(AnalyticsDownloadButton).props.disabled).toBeFalsy();
  });

  it('shows a Retry state when a configured read failed', async () => {
    mockGlobalReads(
      analyticsError(new Error('permission-denied'), zeroStats),
      analyticsError(new Error('permission-denied'), []),
      analyticsError(new Error('permission-denied'), []),
    );
    const r = await mount(<GlobalTrailStatsScreen />);
    expect(texts(r)).toContain('Could not load analytics');
    expect(texts(r)).toContain('Retry');

    // Retry reloads, and a recovered connection replaces the error with the numbers
    mockGlobalReads(analyticsOk(zeroStats), analyticsOk([]), analyticsOk([]));
    await act(async () => {
      r.root.findAllByType(TouchableOpacity).find((n) => n.findAllByType(Text).some((x) => x.props.children === 'Retry'))!.props.onPress();
    });
    expect(texts(r)).toContain('Active Riders');
  });
});

describe('RideStatsScreen: unavailable versus no rides', () => {
  it('does not claim "No rides yet" when analytics are unavailable', async () => {
    mockUserRides.mockResolvedValue(analyticsUnavailable('firebase-off', []));
    const r = await mount(<RideStatsScreen />);
    expect(texts(r)).toContain('Not connected to SBHRA servers');
    expect(texts(r)).not.toContain('No rides yet');
  });

  it('says "No rides yet" only when the read worked and found nothing', async () => {
    mockUserRides.mockResolvedValue(analyticsOk([]));
    const r = await mount(<RideStatsScreen />);
    expect(texts(r)).toContain('No rides yet');
    expect(texts(r)).not.toContain('Not connected to SBHRA servers');
  });
});
