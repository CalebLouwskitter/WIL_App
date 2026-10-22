import { useColorScheme } from 'react-native';
import { Colors, resolvePalette } from '../constants/colors';

export type AppScheme = 'light' | 'dark';
export type AppPalette = typeof Colors.light;

/**
 * The one way screens and components should pick colours: follows the
 * phone's light/dark setting, and treats null/'unspecified' as light.
 */
export function useAppTheme(): { scheme: AppScheme; isDark: boolean; palette: AppPalette } {
  const scheme: AppScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, isDark: scheme === 'dark', palette: resolvePalette(scheme) as AppPalette };
}
