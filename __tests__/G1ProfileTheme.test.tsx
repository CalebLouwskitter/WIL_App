import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import * as ReactNative from 'react-native';
import { Colors } from '../constants/colors';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => cb(),
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
}));

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
}));

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

import ObservationsScreen from '../screens/Profile/ObservationsScreen';

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
