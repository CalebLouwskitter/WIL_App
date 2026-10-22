import React from 'react';
import { Text, Switch, TouchableOpacity } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}));

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  getBackgroundPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
}));

const mockHasPermissions = jest.fn().mockResolvedValue(false);
const mockRequestPermissions = jest.fn().mockResolvedValue(true);
jest.mock('../components/backgroundServices', () => ({
  BackgroundLocationService: {
    hasPermissions: () => mockHasPermissions(),
    requestPermissions: () => mockRequestPermissions(),
  },
}));

import { PreferencesProvider, usePreferences } from '../contexts/PreferencesContext';
import SettingsModal from '../components/Modals/SettingsModal';

const allTexts = (renderer: TestRenderer.ReactTestRenderer): string[] =>
  renderer.root.findAllByType(Text).map((node) => [node.props.children].flat().join(''));

describe('SettingsModal', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('does not contain Profile or Privacy rows', async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <PreferencesProvider>
          <SettingsModal visible={true} onClose={jest.fn()} />
        </PreferencesProvider>
      );
    });

    const renderedTexts = allTexts(renderer);
    expect(renderedTexts).not.toContain('Profile');
    expect(renderedTexts).not.toContain('Privacy');
  });

  it('renders Open full settings only when onRequestFullSettings callback is provided', async () => {
    let withoutCallback!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      withoutCallback = TestRenderer.create(
        <PreferencesProvider>
          <SettingsModal visible={true} onClose={jest.fn()} />
        </PreferencesProvider>
      );
    });

    expect(allTexts(withoutCallback)).not.toContain('Open full settings');

    const mockRequestFull = jest.fn();
    let withCallback!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      withCallback = TestRenderer.create(
        <PreferencesProvider>
          <SettingsModal
            visible={true}
            onClose={jest.fn()}
            onRequestFullSettings={mockRequestFull}
          />
        </PreferencesProvider>
      );
    });

    expect(allTexts(withCallback)).toContain('Open full settings');
  });

  it('toggling units in modal immediately updates a second consumer', async () => {
    let secondConsumerUnits: string | null = null;
    const SecondConsumer = () => {
      const { preferences } = usePreferences();
      secondConsumerUnits = preferences.units;
      return <Text testID="second-consumer">{preferences.units}</Text>;
    };

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <PreferencesProvider>
          <SettingsModal visible={true} onClose={jest.fn()} />
          <SecondConsumer />
        </PreferencesProvider>
      );
    });

    expect(secondConsumerUnits).toBe('metric');

    // Find the metric units switch
    const switches = renderer.root.findAllByType(Switch);
    // First switch is metric units (value is true)
    const metricSwitch = switches[0];
    expect(metricSwitch.props.value).toBe(true);

    // Toggle switch
    await act(async () => {
      metricSwitch.props.onValueChange(false);
    });

    expect(secondConsumerUnits).toBe('imperial');
    expect(metricSwitch.props.value).toBe(false);
  });
});
