import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'UNITS_METRIC';

export const useUnits = () => {
  const [isMetric, setIsMetric] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      setIsMetric(val !== 'false');
    });
  }, []);

  const toggle = async () => {
    const newValue = !isMetric;
    setIsMetric(newValue);
    await AsyncStorage.setItem(STORAGE_KEY, String(newValue));
  };

  const convertDistance = (meters: number) => {
    if (isMetric) return { value: meters / 1000, unit: 'km' };
    return { value: meters / 1609.34, unit: 'mi' };
  };

  const convertSpeed = (kmh: number) => {
    if (isMetric) return { value: kmh, unit: 'km/h' };
    return { value: kmh * 0.621371, unit: 'mph' };
  };

  return { isMetric, toggle, convertDistance, convertSpeed };
};
