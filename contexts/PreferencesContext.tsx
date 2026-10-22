import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

export const PREFERENCES_STORAGE_KEY = '@sbhra_preferences_v1';
export const LEGACY_STORAGE_KEY = 'UNITS_METRIC';

export type UnitSystem = 'metric' | 'imperial';
export type MapTypePreference = 'standard' | 'satellite' | 'hybrid';

export interface Preferences {
  units: UnitSystem;
  mapType: MapTypePreference;
  notificationsWanted: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  units: 'metric',
  mapType: 'standard',
  notificationsWanted: true,
};

export type LocationPermissionStatus =
  | 'Allowed all the time'
  | 'Allowed while using the app'
  | 'Not allowed';

export async function getLocationPermissionStatus(): Promise<LocationPermissionStatus> {
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    const bg = await Location.getBackgroundPermissionsAsync();
    if (bg?.granted) {
      return 'Allowed all the time';
    }
    if (fg?.granted) {
      return 'Allowed while using the app';
    }
    return 'Not allowed';
  } catch {
    return 'Not allowed';
  }
}

export interface PreferencesContextType {
  preferences: Preferences;
  setUnits: (units: UnitSystem) => Promise<void>;
  setMapType: (mapType: MapTypePreference) => Promise<void>;
  setNotificationsWanted: (wanted: boolean) => Promise<void>;
  loaded: boolean;
  saveError: string | null;
}

export const PreferencesContext = createContext<PreferencesContextType | null>(null);

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const prefRef = useRef<Preferences>(preferences);
  prefRef.current = preferences;

  useEffect(() => {
    let isMounted = true;

    const loadPreferences = async () => {
      try {
        const stored = await AsyncStorage.getItem(PREFERENCES_STORAGE_KEY);
        if (!isMounted) return;

        if (stored !== null) {
          try {
            const parsed = JSON.parse(stored);
            const initial: Preferences = {
              units: parsed.units === 'imperial' ? 'imperial' : 'metric',
              mapType:
                parsed.mapType === 'satellite' || parsed.mapType === 'hybrid'
                  ? parsed.mapType
                  : 'standard',
              notificationsWanted:
                typeof parsed.notificationsWanted === 'boolean'
                  ? parsed.notificationsWanted
                  : true,
            };
            prefRef.current = initial;
            setPreferences(initial);
          } catch {
            prefRef.current = DEFAULT_PREFERENCES;
            setPreferences(DEFAULT_PREFERENCES);
          }
        } else {
          // Migration: if old UNITS_METRIC is 'false' and new key doesn't exist, start with imperial.
          const legacyMetric = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
          if (!isMounted) return;
          const initial: Preferences = {
            ...DEFAULT_PREFERENCES,
            units: legacyMetric === 'false' ? 'imperial' : 'metric',
          };
          prefRef.current = initial;
          setPreferences(initial);
        }
      } catch {
        if (isMounted) {
          prefRef.current = DEFAULT_PREFERENCES;
          setPreferences(DEFAULT_PREFERENCES);
        }
      } finally {
        if (isMounted) {
          setLoaded(true);
        }
      }
    };

    loadPreferences();

    return () => {
      isMounted = false;
    };
  }, []);

  const updatePreference = useCallback(async <K extends keyof Preferences>(
    key: K,
    value: Preferences[K]
  ) => {
    const previous = prefRef.current;
    const next: Preferences = { ...previous, [key]: value };
    prefRef.current = next;
    setPreferences(next);
    setSaveError(null);

    try {
      await AsyncStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Revert state and record user-facing error message
      prefRef.current = previous;
      setPreferences(previous);
      setSaveError("Couldn't save your setting.");
    }
  }, []);

  const setUnits = useCallback((units: UnitSystem) => updatePreference('units', units), [updatePreference]);
  const setMapType = useCallback((mapType: MapTypePreference) => updatePreference('mapType', mapType), [updatePreference]);
  const setNotificationsWanted = useCallback(
    (wanted: boolean) => updatePreference('notificationsWanted', wanted),
    [updatePreference]
  );

  const value: PreferencesContextType = {
    preferences,
    setUnits,
    setMapType,
    setNotificationsWanted,
    loaded,
    saveError,
  };

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
};

export const usePreferences = (): PreferencesContextType => {
  const context = useContext(PreferencesContext);
  if (!context) {
    if (__DEV__) {
      console.warn('usePreferences must be used within a PreferencesProvider');
    }
    return {
      preferences: DEFAULT_PREFERENCES,
      setUnits: async () => {},
      setMapType: async () => {},
      setNotificationsWanted: async () => {},
      loaded: true,
      saveError: null,
    };
  }
  return context;
};
