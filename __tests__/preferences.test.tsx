import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  getBackgroundPermissionsAsync: jest.fn(),
}));

import {
  PreferencesProvider,
  usePreferences,
  getLocationPermissionStatus,
  PREFERENCES_STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  DEFAULT_PREFERENCES,
  type PreferencesContextType,
} from '../contexts/PreferencesContext';

describe('PreferencesContext', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  const renderProbe = async (): Promise<{
    getLatest: () => PreferencesContextType;
    renderer: TestRenderer.ReactTestRenderer;
  }> => {
    let latest: PreferencesContextType | null = null;
    const Probe = () => {
      latest = usePreferences();
      return <Text>{latest.preferences.units}</Text>;
    };

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <PreferencesProvider>
          <Probe />
        </PreferencesProvider>
      );
    });

    return {
      getLatest: () => latest!,
      renderer,
    };
  };

  it('loads default preferences when no storage keys exist', async () => {
    const { getLatest } = await renderProbe();
    expect(getLatest().loaded).toBe(true);
    expect(getLatest().preferences).toEqual(DEFAULT_PREFERENCES);
    expect(getLatest().saveError).toBeNull();
  });

  it('loads saved preferences from @sbhra_preferences_v1', async () => {
    const saved = {
      units: 'imperial',
      mapType: 'satellite',
      notificationsWanted: false,
    };
    await AsyncStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(saved));

    const { getLatest } = await renderProbe();
    expect(getLatest().loaded).toBe(true);
    expect(getLatest().preferences).toEqual({
      units: 'imperial',
      mapType: 'satellite',
      notificationsWanted: false,
    });
  });

  it('migrates legacy UNITS_METRIC=false to imperial when new key is absent and keeps old key', async () => {
    await AsyncStorage.setItem(LEGACY_STORAGE_KEY, 'false');

    const { getLatest } = await renderProbe();
    expect(getLatest().loaded).toBe(true);
    expect(getLatest().preferences.units).toBe('imperial');
    expect(getLatest().preferences.mapType).toBe('standard');
    expect(getLatest().preferences.notificationsWanted).toBe(true);

    // Verify old key was not deleted
    const oldVal = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
    expect(oldVal).toBe('false');
  });

  it('reverts optimistic update and sets saveError if AsyncStorage write fails', async () => {
    const { getLatest } = await renderProbe();
    expect(getLatest().preferences.units).toBe('metric');

    const spySetItem = jest
      .spyOn(AsyncStorage, 'setItem')
      .mockRejectedValueOnce(new Error('Disk full'));

    await act(async () => {
      await getLatest().setUnits('imperial');
    });

    expect(getLatest().preferences.units).toBe('metric');
    expect(getLatest().saveError).toBe("Couldn't save your setting.");

    spySetItem.mockRestore();
  });

  it('allows two consumers to see the same updated state', async () => {
    let consumerA!: PreferencesContextType;
    let consumerB!: PreferencesContextType;

    const ComponentA = () => {
      consumerA = usePreferences();
      return <Text testID="a">{consumerA.preferences.units}</Text>;
    };

    const ComponentB = () => {
      consumerB = usePreferences();
      return <Text testID="b">{consumerB.preferences.units}</Text>;
    };

    await act(async () => {
      TestRenderer.create(
        <PreferencesProvider>
          <ComponentA />
          <ComponentB />
        </PreferencesProvider>
      );
    });

    expect(consumerA.preferences.units).toBe('metric');
    expect(consumerB.preferences.units).toBe('metric');

    await act(async () => {
      await consumerA.setUnits('imperial');
    });

    expect(consumerA.preferences.units).toBe('imperial');
    expect(consumerB.preferences.units).toBe('imperial');
  });

  describe('getLocationPermissionStatus', () => {
    it('returns "Allowed all the time" when background permission is granted', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
      (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });

      const status = await getLocationPermissionStatus();
      expect(status).toBe('Allowed all the time');
    });

    it('returns "Allowed while using the app" when foreground is granted and background is not', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
      (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });

      const status = await getLocationPermissionStatus();
      expect(status).toBe('Allowed while using the app');
    });

    it('returns "Not allowed" when neither is granted', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
      (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });

      const status = await getLocationPermissionStatus();
      expect(status).toBe('Not allowed');
    });

    it('returns "Not allowed" on unexpected error', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockRejectedValue(new Error('fail'));

      const status = await getLocationPermissionStatus();
      expect(status).toBe('Not allowed');
    });
  });
});
