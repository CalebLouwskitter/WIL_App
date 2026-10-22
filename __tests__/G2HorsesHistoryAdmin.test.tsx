import React from 'react';
import { StyleSheet, Text, TouchableOpacity, useColorScheme } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import HorsesListScreen from '../screens/Profile/HorsesListScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { Colors } from '../constants/colors';

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockGetParent = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
    navigate: mockNavigate,
    getParent: mockGetParent,
  }),
  useFocusEffect: (cb: () => void) => {
    require('react').useEffect(cb, [cb]);
  },
  useRoute: () => ({ params: {} }),
}));

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
  Ionicons: () => null,
  MaterialCommunityIcons: () => null,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 40, bottom: 20, left: 0, right: 0 }),
  SafeAreaView: ({ children, style }: any) => <>{children}</>,
}));

const mockHorses = [
  { id: 'h1', name: 'Thunder', breed: 'Arabian', age: 7, createdAt: 1672531199000 },
];

jest.mock('../services/HorseStorage', () => ({
  getHorses: jest.fn(() => Promise.resolve(mockHorses)),
  saveHorse: jest.fn(() => Promise.resolve()),
}));

const flushAsync = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });
};

describe('G2 — HorsesListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    // Test back button
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
