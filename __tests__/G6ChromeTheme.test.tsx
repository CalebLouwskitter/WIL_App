import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import * as ReactNative from 'react-native';
import { Colors } from '../constants/colors';

// Mocks
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@expo/vector-icons', () => {
  const ReactActual = require('react');
  return {
    Feather: (props: any) => ReactActual.createElement('Feather', props),
    Ionicons: (props: any) => ReactActual.createElement('Ionicons', props),
  };
});

jest.mock('react-native-safe-area-context', () => {
  const ReactActual = require('react');
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    SafeAreaView: ({ children, style }: any) => ReactActual.createElement('SafeAreaView', { style }, children),
  };
});

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  getBackgroundPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
}));

jest.mock('../components/backgroundServices', () => ({
  BackgroundLocationService: {
    hasPermissions: jest.fn().mockResolvedValue(false),
    requestPermissions: jest.fn().mockResolvedValue(true),
  },
}));

let capturedScreenOptions: any = null;
jest.mock('@react-navigation/bottom-tabs', () => {
  const ReactActual = require('react');
  return {
    createBottomTabNavigator: () => ({
      Navigator: ({ screenOptions, children }: any) => {
        capturedScreenOptions = typeof screenOptions === 'function' ? screenOptions({}) : screenOptions;
        return ReactActual.createElement('TabNavigator', { screenOptions }, children);
      },
      Screen: () => null,
    }),
  };
});

jest.mock('../screens/Dashboard/DashboardScreen', () => () => null);
jest.mock('../navigation/MappingStack', () => () => null);
jest.mock('../screens/Sos/SosAlertScreen', () => () => null);
jest.mock('../navigation/AnalyticsStack', () => () => null);
jest.mock('../navigation/ProfileStack', () => () => null);

jest.mock('../services/auth', () => ({
  loginUser: jest.fn(),
  logoutUser: jest.fn(),
  registerUser: jest.fn(),
}));

jest.mock('../services/FirebaseUserService', () => ({
  getUser: jest.fn(),
}));

import SettingsModal from '../components/Modals/SettingsModal';
import { PreferencesProvider } from '../contexts/PreferencesContext';
import TabNavigator from '../navigation/TabNavigator';
import LoginScreen from '../screens/Auth/LoginScreen';

describe('G6ChromeTheme', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('SettingsModal', () => {
    it('in dark mode, the Quick Settings title and close icon use palette.textPrimary on palette.card', async () => {
      jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');

      let renderer!: TestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = TestRenderer.create(
          <PreferencesProvider>
            <SettingsModal visible={true} onClose={jest.fn()} />
          </PreferencesProvider>
        );
      });

      // Check modal container has palette.card (#1E1E1E)
      const views = renderer.root.findAllByType(View);
      const containerView = views.find((v) => {
        const style = StyleSheet.flatten(v.props.style);
        return style && style.maxWidth === 420;
      });
      expect(containerView).toBeDefined();
      const containerStyle = StyleSheet.flatten(containerView!.props.style);
      expect(containerStyle.backgroundColor).toBe(Colors.dark.card);

      // Check title uses palette.textPrimary (#F1F5F9)
      const texts = renderer.root.findAllByType(Text);
      const titleNode = texts.find((t) => [t.props.children].flat().join('') === 'Quick Settings');
      expect(titleNode).toBeDefined();
      const titleStyle = StyleSheet.flatten(titleNode!.props.style);
      expect(titleStyle.color).toBe(Colors.dark.textPrimary);

      // Check close icon uses palette.textPrimary
      const feathers = renderer.root.findAll((node) => (node.type as any) === 'Feather' && node.props.name === 'x');
      expect(feathers.length).toBeGreaterThan(0);
      expect(feathers[0].props.color).toBe(Colors.dark.textPrimary);
    });
  });

  describe('TabNavigator', () => {
    it('the tab bar background follows the theme in light and dark mode', () => {
      // Light mode
      jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('light');
      act(() => {
        TestRenderer.create(<TabNavigator />);
      });
      expect(capturedScreenOptions.tabBarStyle.backgroundColor).toBe(Colors.light.card);
      expect(capturedScreenOptions.tabBarActiveTintColor).toBe(Colors.light.brandPrimary);
      expect(capturedScreenOptions.tabBarInactiveTintColor).toBe(Colors.light.textMuted);

      // Dark mode
      jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');
      act(() => {
        TestRenderer.create(<TabNavigator />);
      });
      expect(capturedScreenOptions.tabBarStyle.backgroundColor).toBe(Colors.dark.card);
      expect(capturedScreenOptions.tabBarActiveTintColor).toBe(Colors.dark.brandPrimary);
      expect(capturedScreenOptions.tabBarInactiveTintColor).toBe(Colors.dark.textMuted);
    });
  });

  describe('LoginScreen', () => {
    it("the login screen's main title is readable in dark mode", () => {
      jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');

      let renderer!: TestRenderer.ReactTestRenderer;
      act(() => {
        renderer = TestRenderer.create(<LoginScreen navigation={{ navigate: jest.fn() }} />);
      });

      // Find the main "Log In" title / tab
      const texts = renderer.root.findAllByType(Text);
      const loginTab = texts.find((t) => [t.props.children].flat().join('') === 'Log In');
      expect(loginTab).toBeDefined();
      const loginStyle = StyleSheet.flatten(loginTab!.props.style);
      // Main active title is onPrimary (#FFFFFF) on brand primary button
      expect(loginStyle.color).toBe(Colors.dark.onPrimary);
      expect(loginStyle.color).not.toBe(Colors.dark.card);
      expect(loginStyle.color).not.toBe(Colors.dark.background);
    });
  });
});
