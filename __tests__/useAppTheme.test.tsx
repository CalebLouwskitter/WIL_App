import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import * as ReactNative from 'react-native';
import { Colors } from '../constants/colors';
import { useAppTheme } from '../hooks/useAppTheme';

const capture = (scheme: ReturnType<typeof ReactNative.useColorScheme>) => {
  jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue(scheme);
  let result!: ReturnType<typeof useAppTheme>;
  const Probe = () => {
    result = useAppTheme();
    return null;
  };
  act(() => {
    TestRenderer.create(<Probe />);
  });
  return result;
};

afterEach(() => jest.restoreAllMocks());

describe('useAppTheme', () => {
  it('uses the dark palette when the phone is in dark mode', () => {
    const theme = capture('dark');
    expect(theme.scheme).toBe('dark');
    expect(theme.isDark).toBe(true);
    expect(theme.palette.textPrimary).toBe(Colors.dark.textPrimary);
  });

  it.each([['light'], [null], ['unspecified']] as const)('falls back to light for %p', (scheme) => {
    const theme = capture(scheme as any);
    expect(theme.scheme).toBe('light');
    expect(theme.isDark).toBe(false);
    expect(theme.palette.background).toBe(Colors.light.background);
  });

  it('defines every semantic screen token in both palettes', () => {
    for (const key of ['background', 'card', 'textPrimary', 'textSecondary', 'textMuted', 'divider', 'brandSoft'] as const) {
      expect(Colors.light[key]).toMatch(/^#/);
      expect(Colors.dark[key]).toMatch(/^#/);
    }
  });
});
