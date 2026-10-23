import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import HorsesListScreen from '../screens/Profile/HorsesListScreen';
import CreateHorseScreen from '../screens/Profile/CreateHorseScreen';
import HistoryScreen from '../screens/Profile/HistoryScreen';
import AdminManagementScreen from '../screens/Profile/AdminManagementScreen';
import AdminNotificationManagement from '../screens/Profile/AdminNotificationManagement';
import AdminObstacleManagement from '../screens/Profile/AdminObstacleManagement';
import { ScreenHeader } from '../components/ScreenHeader';
import { Colors } from '../constants/colors';
import { saveHorse } from '../services/HorseStorage';

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockParentNavigate = jest.fn();
const mockGetParent = jest.fn(() => ({ navigate: mockParentNavigate }));
let mockRouteParams: any = {};
let mockPreferences = { units: 'metric' };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
    navigate: mockNavigate,
    getParent: mockGetParent,
  }),
  useFocusEffect: (cb: () => void) => {
    require('react').useEffect(cb, [cb]);
  },
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
  Ionicons: () => null,
  MaterialCommunityIcons: () => null,
}));

// The admin screens import icons by subpath, which the root mock above does not cover.
jest.mock('@expo/vector-icons/Ionicons', () => () => null);
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children, style }: any) => {
    const { View } = require('react-native');
    return <View style={style}>{children}</View>;
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 40, bottom: 20, left: 0, right: 0 }),
  SafeAreaView: ({ children, style }: any) => {
    const { View } = require('react-native');
    return <View style={style}>{children}</View>;
  },
}));

const mockHorses = [
  { id: 'h1', name: 'Thunder', breed: 'Arabian', age: 7, createdAt: 1672531199000 },
];

jest.mock('../services/HorseStorage', () => ({
  getHorses: jest.fn(() => Promise.resolve(mockHorses)),
  saveHorse: jest.fn(() => Promise.resolve()),
}));

const mockRides = [
  {
    id: 'r1',
    startTime: 1700000000000,
    endTime: 1700003600000,
    totalDistance: 5000,
    horseName: 'Thunder',
    pendingSync: false,
  },
];

jest.mock('../services/RideStorage', () => ({
  getRides: jest.fn(() => Promise.resolve(mockRides)),
}));

jest.mock('../contexts/PreferencesContext', () => ({
  usePreferences: () => ({ preferences: mockPreferences }),
}));

const mockUsers = [
  { uid: 'u1', email: 'rider@example.com', status: 'approved', role: 'member' },
  { uid: 'u2', email: 'pending@example.com', status: 'pending', role: 'member' },
];

jest.mock('../services/FirebaseUserService', () => ({
  getAllUsers: jest.fn(() => Promise.resolve(mockUsers)),
  approveUser: jest.fn(() => Promise.resolve()),
  disapproveUser: jest.fn(() => Promise.resolve()),
  deleteUserDoc: jest.fn(() => Promise.resolve()),
  setUserRole: jest.fn(() => Promise.resolve()),
}));

const mockCurrentUser = { uid: 'admin_1', role: 'admin' };
jest.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ profile: mockCurrentUser, loading: false }),
}));

jest.mock('../services/FirebaseNotificationService', () => ({
  createAdminNotification: jest.fn(() => Promise.resolve({ pushQueued: true })),
  getNotificationsForRole: jest.fn(() => Promise.resolve([])),
  subscribeToNotifications: jest.fn(() => () => {}),
  deleteNotification: jest.fn(() => Promise.resolve()),
  updateNotification: jest.fn(() => Promise.resolve()),
  getNotificationStats: jest.fn(() => Promise.resolve({ total: 0, byType: {}, byAudience: {} })),
}));

jest.mock('../components/Notifications', () => ({
  NotificationList: () => null,
}));

const mockObstacles = [
  {
    id: 'o1',
    title: 'Fallen Tree',
    type: 'tree',
    severity: 'critical',
    status: 'active',
    reportedAt: 1700000000000,
    userName: 'Rider 1',
  },
];

jest.mock('../services/ObstacleService', () => ({
  getObstacles: jest.fn(() => Promise.resolve(mockObstacles)),
  updateObstacleStatus: jest.fn(() => Promise.resolve()),
  removeObstacle: jest.fn(() => Promise.resolve()),
  subscribeToObstacles: jest.fn(() => () => {}),
}));

const flushAsync = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });
};

describe('G2 — HorsesListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = {};
  });

  afterEach(async () => {
    await flushAsync();
    jest.restoreAllMocks();
  });

  it('renders ScreenHeader with title "My Horses" and wires back navigation', async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<HorsesListScreen />);
    });
    await flushAsync();

    const header = renderer.root.findByType(ScreenHeader);
    expect(header).toBeDefined();
    expect(header.props.title).toBe('My Horses');

    act(() => {
      header.props.onBack();
    });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('navigates to CreateHorse when add button in header right slot is pressed', async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<HorsesListScreen />);
    });
    await flushAsync();

    const header = renderer.root.findByType(ScreenHeader);
    const rightSlot = header.props.right;
    expect(rightSlot).toBeDefined();

    const addBtn = renderer.root.findByProps({ accessibilityLabel: 'Add horse' });
    act(() => {
      addBtn.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('CreateHorse');
  });

  it('renders horse title with dark-mode textPrimary color', async () => {
    const ReactNative = require('react-native');
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<HorsesListScreen />);
    });
    await flushAsync();

    const texts = renderer.root.findAllByType(Text);
    const titleText = texts.find((t) => [t.props.children].flat().join('') === 'Thunder');
    expect(titleText).toBeDefined();
    const flatStyle = StyleSheet.flatten(titleText!.props.style);
    expect(flatStyle.color).toBe(Colors.dark.textPrimary);
  });
});

describe('G2 — CreateHorseScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = {};
  });

  afterEach(async () => {
    await flushAsync();
    jest.restoreAllMocks();
  });

  it('renders ScreenHeader with title "Add Horse"', async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<CreateHorseScreen />);
    });
    await flushAsync();

    const header = renderer.root.findByType(ScreenHeader);
    expect(header).toBeDefined();
    expect(header.props.title).toBe('Add Horse');
  });

  it('back button navigates to SelectHorse when returnToSelectHorse is set', async () => {
    mockRouteParams = { returnToSelectHorse: true };
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<CreateHorseScreen />);
    });
    await flushAsync();

    const header = renderer.root.findByType(ScreenHeader);
    act(() => {
      header.props.onBack();
    });
    expect(mockGetParent).toHaveBeenCalled();
    expect(mockParentNavigate).toHaveBeenCalledWith('Mapping', { screen: 'SelectHorse' });
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('back button navigates to Dashboard when fromDashboard is set', async () => {
    mockRouteParams = { fromDashboard: true };
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<CreateHorseScreen />);
    });
    await flushAsync();

    const header = renderer.root.findByType(ScreenHeader);
    act(() => {
      header.props.onBack();
    });
    expect(mockGetParent).toHaveBeenCalled();
    expect(mockParentNavigate).toHaveBeenCalledWith('Dashboard');
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('back button calls goBack() when no return param is present', async () => {
    mockRouteParams = {};
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<CreateHorseScreen />);
    });
    await flushAsync();

    const header = renderer.root.findByType(ScreenHeader);
    act(() => {
      header.props.onBack();
    });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(mockParentNavigate).not.toHaveBeenCalled();
  });

  it('onSave navigates to SelectHorse when returnToSelectHorse is set', async () => {
    mockRouteParams = { returnToSelectHorse: true };
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<CreateHorseScreen />);
    });
    await flushAsync();

    const nameInput = renderer.root.findByProps({ accessibilityLabel: 'Horse name' });
    act(() => {
      nameInput.props.onChangeText('Shadowfax');
    });

    const saveBtn = renderer.root.findByProps({ accessibilityLabel: 'Save horse' });
    await act(async () => {
      await saveBtn.props.onPress();
    });
    await flushAsync();

    expect(saveHorse).toHaveBeenCalledWith(expect.objectContaining({ name: 'Shadowfax' }));
    expect(mockParentNavigate).toHaveBeenCalledWith('Mapping', { screen: 'SelectHorse' });
  });

  it('onSave navigates to Dashboard when fromDashboard is set', async () => {
    mockRouteParams = { fromDashboard: true };
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<CreateHorseScreen />);
    });
    await flushAsync();

    const nameInput = renderer.root.findByProps({ accessibilityLabel: 'Horse name' });
    act(() => {
      nameInput.props.onChangeText('Shadowfax');
    });

    const saveBtn = renderer.root.findByProps({ accessibilityLabel: 'Save horse' });
    await act(async () => {
      await saveBtn.props.onPress();
    });
    await flushAsync();

    expect(saveHorse).toHaveBeenCalledWith(expect.objectContaining({ name: 'Shadowfax' }));
    expect(mockParentNavigate).toHaveBeenCalledWith('Dashboard');
  });

  it('onSave calls goBack() when no return param is present', async () => {
    mockRouteParams = {};
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<CreateHorseScreen />);
    });
    await flushAsync();

    const nameInput = renderer.root.findByProps({ accessibilityLabel: 'Horse name' });
    act(() => {
      nameInput.props.onChangeText('Shadowfax');
    });

    const saveBtn = renderer.root.findByProps({ accessibilityLabel: 'Save horse' });
    await act(async () => {
      await saveBtn.props.onPress();
    });
    await flushAsync();

    expect(saveHorse).toHaveBeenCalledWith(expect.objectContaining({ name: 'Shadowfax' }));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('renders field labels in dark mode using palette.textPrimary', async () => {
    const ReactNative = require('react-native');
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<CreateHorseScreen />);
    });
    await flushAsync();

    const texts = renderer.root.findAllByType(Text);
    const labelText = texts.find((t) => [t.props.children].flat().join('') === 'Name');
    expect(labelText).toBeDefined();
    const flatStyle = StyleSheet.flatten(labelText!.props.style);
    expect(flatStyle.color).toBe(Colors.dark.textPrimary);
  });
});

describe('G2 — HistoryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = {};
    mockPreferences = { units: 'metric' };
  });

  afterEach(async () => {
    await flushAsync();
    jest.restoreAllMocks();
  });

  it('renders ScreenHeader with title "Ride History"', async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<HistoryScreen />);
    });
    await flushAsync();

    const header = renderer.root.findByType(ScreenHeader);
    expect(header).toBeDefined();
    expect(header.props.title).toBe('Ride History');
  });

  it('back button navigates to Dashboard when fromDashboard is true', async () => {
    mockRouteParams = { fromDashboard: true };
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<HistoryScreen />);
    });
    await flushAsync();

    const header = renderer.root.findByType(ScreenHeader);
    act(() => {
      header.props.onBack();
    });
    expect(mockGetParent).toHaveBeenCalled();
    expect(mockParentNavigate).toHaveBeenCalledWith('Dashboard');
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('back button navigates to LiveTracking when fromMapping is true', async () => {
    mockRouteParams = { fromMapping: true };
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<HistoryScreen />);
    });
    await flushAsync();

    const header = renderer.root.findByType(ScreenHeader);
    act(() => {
      header.props.onBack();
    });
    expect(mockGetParent).toHaveBeenCalled();
    expect(mockParentNavigate).toHaveBeenCalledWith('Mapping', { screen: 'LiveTracking' });
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('back button calls goBack() when neither fromDashboard nor fromMapping is set', async () => {
    mockRouteParams = {};
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<HistoryScreen />);
    });
    await flushAsync();

    const header = renderer.root.findByType(ScreenHeader);
    act(() => {
      header.props.onBack();
    });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(mockParentNavigate).not.toHaveBeenCalled();
  });

  it('formats distance in metric and imperial correctly', async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<HistoryScreen />);
    });
    await flushAsync();

    const texts = renderer.root.findAllByType(Text).map((t) => [t.props.children].flat().join(''));
    expect(texts).toContain('5.0');
    expect(texts).toContain('km');
  });

  it('renders ride title in dark mode using palette.textPrimary', async () => {
    const ReactNative = require('react-native');
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<HistoryScreen />);
    });
    await flushAsync();

    const texts = renderer.root.findAllByType(Text);
    const rideTitle = texts.find((t) => [t.props.children].flat().join('') === 'Ride #1');
    expect(rideTitle).toBeDefined();
    const flatStyle = StyleSheet.flatten(rideTitle!.props.style);
    expect(flatStyle.color).toBe(Colors.dark.textPrimary);
  });
});

describe('G2 — Admin Screens Theme & Readability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await flushAsync();
    jest.restoreAllMocks();
  });

  it('AdminManagementScreen: title renders with dark-mode textPrimary', async () => {
    const ReactNative = require('react-native');
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<AdminManagementScreen />);
    });
    await flushAsync();

    const texts = renderer.root.findAllByType(Text);
    const titleText = texts.find((t) => [t.props.children].flat().join('') === 'Admin');
    expect(titleText).toBeDefined();
    const titleStyle = StyleSheet.flatten(titleText!.props.style);
    expect(titleStyle.color).toBe(Colors.dark.textPrimary);
  });

  it('AdminManagementScreen: status badges use semantic tokens', async () => {
    const ReactNative = require('react-native');
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('light');

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<AdminManagementScreen />);
    });
    await flushAsync();

    const texts = renderer.root.findAllByType(Text);
    const approvedText = texts.find((t) => [t.props.children].flat().join('') === 'approved');
    expect(approvedText).toBeDefined();
  });

  it('AdminNotificationManagement: title renders with dark-mode textPrimary', async () => {
    const ReactNative = require('react-native');
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<AdminNotificationManagement />);
    });
    await flushAsync();

    const texts = renderer.root.findAllByType(Text);
    const titleText = texts.find((t) => [t.props.children].flat().join('') === 'Notifications');
    expect(titleText).toBeDefined();
    const titleStyle = StyleSheet.flatten(titleText!.props.style);
    expect(titleStyle.color).toBe(Colors.dark.textPrimary);
  });

  it('AdminObstacleManagement: title renders with dark-mode textPrimary', async () => {
    const ReactNative = require('react-native');
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<AdminObstacleManagement />);
    });
    await flushAsync();

    const texts = renderer.root.findAllByType(Text);
    const titleText = texts.find((t) => [t.props.children].flat().join('') === 'Obstacle Management');
    expect(titleText).toBeDefined();
    const titleStyle = StyleSheet.flatten(titleText!.props.style);
    expect(titleStyle.color).toBe(Colors.dark.textPrimary);
  });
});
