import { useContext } from 'react';
import { PreferencesContext } from '../contexts/PreferencesContext';

export const useUnits = () => {
  const context = useContext(PreferencesContext);

  if (!context) {
    if (__DEV__) {
      console.warn('useUnits must be used within a PreferencesProvider');
    }
    const isMetric = true;
    return {
      isMetric,
      toggle: async () => {},
      convertDistance: (meters: number) => ({
        value: meters / 1000,
        unit: 'km' as const,
      }),
      convertSpeed: (kmh: number) => ({
        value: kmh,
        unit: 'km/h' as const,
      }),
    };
  }

  const isMetric = context.preferences.units === 'metric';

  const toggle = async () => {
    await context.setUnits(isMetric ? 'imperial' : 'metric');
  };

  const convertDistance = (meters: number) => {
    if (isMetric) return { value: meters / 1000, unit: 'km' as const };
    return { value: meters / 1609.344, unit: 'mi' as const };
  };

  const convertSpeed = (kmh: number) => {
    if (isMetric) return { value: kmh, unit: 'km/h' as const };
    return { value: kmh / 1.609344, unit: 'mph' as const };
  };

  return { isMetric, toggle, convertDistance, convertSpeed };
};
