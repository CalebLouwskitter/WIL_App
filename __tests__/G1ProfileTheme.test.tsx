import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import * as ReactNative from 'react-native';
import { Colors } from '../constants/colors';

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useFocusEffect: (cb: () => void) => React.useEffect(cb, [cb]),
    useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn(), getParent: () => ({ navigate: jest.fn() }) }),
    useRoute: () => ({ params: {} }),
  };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const RN = require('react-native');
  return {
    useSafeAreaInsets: () => ({ top: 40, bottom: 20, left: 0, right: 0 }),
    SafeAreaView: ({ children, style }: any) => React.createElement(RN.View, { style }, children),
  };
});

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
  Ionicons: () => null,
}));

jest.mock('@expo/vector-icons/Ionicons', () => () => null);
jest.mock('react-native-vector-icons/Feather', () => () => null);

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const RN = require('react-native');
  return {
    LinearGradient: ({ children, style }: any) => React.createElement(RN.View, { style }, children),
  };
});

jest.mock('@/services/ObservationStorage', () => ({
  getObservations: jest.fn().mockResolvedValue([]),
  deleteObservation: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/RideStorage', () => ({
  getRides: jest.fn().mockResolvedValue([
    {
      id: 'r1',
      startTime: 1000000,
      totalDistance: 5000,
      duration: 3600000,
    },
  ]),
}));

jest.mock('../services/ProfilePictureService', () => ({
  getProfilePicture: jest.fn().mockResolvedValue(null),
  showPickerOptions: jest.fn().mockResolvedValue(null),
  removeProfilePicture: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/firebase', () => ({
  FIREBASE_ENABLED: true,
  auth: { currentUser: { displayName: 'John Rider', email: 'rider@example.com' } },
}));

jest.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    profile: { uid: 'u1', role: 'member', status: 'approved' },
    loading: false,
  }),
}));

jest.mock('../components/Modals/SettingsModal', () => () => null);
jest.mock('../components/Modals/NotificationsModal', () => () => null);

const mockStatuses = [
  {
    id: 'first-ride',
    title: 'First Ride',
    description: 'Complete your first ride',
    icon: 'award',
    target: 1,
    gradientColors: ['#FF6B9D', '#FF8E53'] as const,
    unlocked: true,
    progress: 1,
  },
  {
    id: 'distance-100',
    title: '100km Club',
    description: 'Ride 100 km in total',
    icon: 'map',
    target: 100,
    unit: 'km',
    gradientColors: ['#A8E6CF', '#7FD8BE'] as const,
    unlocked: false,
    progress: 25,
  },
];

jest.mock('../hooks/useAchievementProgress', () => ({
  useAchievementProgress: () => ({
    awardsSource: 'cache',
    statuses: mockStatuses,
  }),
}));

let mockCurrentUnits: 'metric' | 'imperial' = 'metric';
jest.mock('../contexts/PreferencesContext', () => ({
  usePreferences: () => ({
    preferences: { units: mockCurrentUnits, mapType: 'standard', notificationsWanted: true },
    setUnits: jest.fn(),
    setMapType: jest.fn(),
    setNotificationsWanted: jest.fn(),
    saveError: null,
  }),
  getLocationPermissionStatus: jest.fn().mockResolvedValue('Allowed in foreground'),
}));

import ObservationsScreen from '../screens/Profile/ObservationsScreen';
import AchievementsScreen from '../screens/Profile/AchievementsScreen';
import NotificationItem from '../components/Notifications/NotificationItem';
import NotificationBadge from '../components/Notifications/NotificationBadge';
import SettingsScreen from '../screens/Profile/SettingsScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import { Notification } from '../types/Notification';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('G1 ObservationsScreen Theming', () => {
  it('renders empty-state title in textPrimary and body in textSecondary in dark mode', async () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<ObservationsScreen navigation={{ goBack: jest.fn() }} />);
    });

    const texts = renderer.root.findAllByType(Text);
    const titleText = texts.find((t) => [t.props.children].flat().join('') === 'No Observations Yet');
    expect(titleText).toBeDefined();
    const titleStyle = StyleSheet.flatten(titleText!.props.style);
    expect(titleStyle.color).toBe(Colors.dark.textPrimary);

    const bodyText = texts.find((t) =>
      [t.props.children].flat().join('').includes('Your wildlife sightings')
    );
    expect(bodyText).toBeDefined();
    const bodyStyle = StyleSheet.flatten(bodyText!.props.style);
    expect(bodyStyle.color).toBe(Colors.dark.textSecondary);
  });

  it('renders selected chip in brandSoft with brandPrimary text, and unselected in card with textSecondary', async () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<ObservationsScreen navigation={{ goBack: jest.fn() }} />);
    });

    const tabs = renderer.root.findAllByType(TouchableOpacity).filter((t) => t.props.accessibilityRole === 'tab');
    expect(tabs.length).toBe(3);

    // First tab is 'all' and selected by default
    const allTab = tabs[0];
    const allTabStyle = StyleSheet.flatten(allTab.props.style);
    expect(allTabStyle.backgroundColor).toBe(Colors.dark.brandSoft);
    const allTabText = allTab.findByType(Text);
    expect(StyleSheet.flatten(allTabText.props.style).color).toBe(Colors.dark.brandPrimary);

    // Second tab is 'sightings' and unselected
    const sightingsTab = tabs[1];
    const sightingsTabStyle = StyleSheet.flatten(sightingsTab.props.style);
    expect(sightingsTabStyle.backgroundColor).toBe(Colors.dark.card);
    const sightingsTabText = sightingsTab.findByType(Text);
    expect(StyleSheet.flatten(sightingsTabText.props.style).color).toBe(Colors.dark.textSecondary);
  });
});

describe('G1 AchievementsScreen Theming', () => {
  it('renders transparent ScreenHeader and themed section titles and cards in dark mode', async () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<AchievementsScreen />);
    });

    // Check section title "Unlocked" uses textPrimary
    const texts = renderer.root.findAllByType(Text);
    const unlockedTitle = texts.find((t) => [t.props.children].flat().join('') === 'Unlocked');
    expect(unlockedTitle).toBeDefined();
    expect(StyleSheet.flatten(unlockedTitle!.props.style).color).toBe(Colors.dark.textPrimary);

    // Check achievement card title uses textPrimary
    const cardTitle = texts.find((t) => [t.props.children].flat().join('') === 'First Ride');
    expect(cardTitle).toBeDefined();
    expect(StyleSheet.flatten(cardTitle!.props.style).color).toBe(Colors.dark.textPrimary);

    // Check achievement card description uses textSecondary
    const cardDesc = texts.find((t) => [t.props.children].flat().join('') === 'Complete your first ride');
    expect(cardDesc).toBeDefined();
    expect(StyleSheet.flatten(cardDesc!.props.style).color).toBe(Colors.dark.textSecondary);
  });
});

describe('G1 Notifications Theming', () => {
  it('distinguishes read and unread items in dark mode with distinct backgrounds, borders, and text tokens', () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');

    const sampleNotification: Notification = {
      id: 'n1',
      title: 'Alert Title',
      body: 'Alert Body',
      type: 'alert',
      audience: 'all',
      createdBy: 'u1',
      createdAt: new Date(),
    };

    let unreadRenderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      unreadRenderer = TestRenderer.create(
        <NotificationItem notification={sampleNotification} isRead={false} />
      );
    });

    const unreadTouchable = unreadRenderer.root.findByType(TouchableOpacity);
    const unreadStyle = StyleSheet.flatten(unreadTouchable.props.style);
    expect(unreadStyle.backgroundColor).toBe(Colors.dark.brandSoft);
    expect(unreadStyle.borderColor).toBe(Colors.dark.brandPrimary);

    let readRenderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      readRenderer = TestRenderer.create(
        <NotificationItem notification={sampleNotification} isRead={true} />
      );
    });

    const readTouchable = readRenderer.root.findByType(TouchableOpacity);
    const readStyle = StyleSheet.flatten(readTouchable.props.style);
    expect(readStyle.backgroundColor).toBe(Colors.dark.card);
    expect(readStyle.borderColor).toBe(Colors.dark.divider);

    // Unread background is distinct from read background
    expect(unreadStyle.backgroundColor).not.toBe(readStyle.backgroundColor);
  });

  it('renders NotificationBadge with danger background and card border', () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<NotificationBadge count={5} />);
    });

    const view = renderer.root.findByType(View);
    const badgeStyle = StyleSheet.flatten(view.props.style);
    expect(badgeStyle.backgroundColor).toBe(Colors.dark.danger);
    expect(badgeStyle.borderColor).toBe(Colors.dark.card);
  });
});

describe('G1 SettingsScreen Theming', () => {
  it('renders section title and labels in textPrimary in dark mode', async () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<SettingsScreen />);
    });

    const textNodes = renderer.root.findAllByType(Text);
    const profileSectionTitle = textNodes.find((t) => [t.props.children].flat().join('') === 'Profile');
    expect(profileSectionTitle).toBeDefined();
    expect(StyleSheet.flatten(profileSectionTitle!.props.style).color).toBe(Colors.dark.textPrimary);

    const settingLabel = textNodes.find((t) => [t.props.children].flat().join('').includes('Metric'));
    expect(settingLabel).toBeDefined();
    expect(StyleSheet.flatten(settingLabel!.props.style).color).toBe(Colors.dark.textPrimary);
  });
});

describe('G1 ProfileScreen Theming', () => {
  it('renders section title in textPrimary and uses profileStat tokens for stat box background in dark mode', async () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<ProfileScreen />);
      await Promise.resolve();
    });

    const textNodes = renderer.root.findAllByType(Text);
    const statsTitle = textNodes.find((t) => [t.props.children].flat().join('') === 'Your Stats');
    expect(statsTitle).toBeDefined();
    expect(StyleSheet.flatten(statsTitle!.props.style).color).toBe(Colors.dark.textPrimary);

    // Stat boxes use dark-adapted profileStat tokens
    const statCards = renderer.root.findAllByType(View).filter((v) => {
      const style = StyleSheet.flatten(v.props.style);
      return style && style.backgroundColor === Colors.dark.profileStatRidesBox;
    });
    expect(statCards.length).toBeGreaterThan(0);

    act(() => {
      renderer.unmount();
    });
  });
});

describe('G1 ProfileScreen Units (km/mi)', () => {
  it('proves the Profile summary shows KM with Metric selected', async () => {
    mockCurrentUnits = 'metric';
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<ProfileScreen />);
      await Promise.resolve();
    });
    const textNodes = renderer.root.findAllByType(Text);
    const kmLabel = textNodes.find((t) => [t.props.children].flat().join('') === 'KM');
    expect(kmLabel).toBeDefined();
    const kmValue = textNodes.find((t) => [t.props.children].flat().join('') === '5');
    expect(kmValue).toBeDefined();

    act(() => {
      renderer.unmount();
    });
  });

  it('proves the Profile summary shows MI with Imperial selected', async () => {
    mockCurrentUnits = 'imperial';
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<ProfileScreen />);
      await Promise.resolve();
    });
    const textNodes = renderer.root.findAllByType(Text);
    const miLabel = textNodes.find((t) => [t.props.children].flat().join('') === 'MI');
    expect(miLabel).toBeDefined();
    const miValue = textNodes.find((t) => [t.props.children].flat().join('') === '3');
    expect(miValue).toBeDefined();

    act(() => {
      renderer.unmount();
    });
  });
});
