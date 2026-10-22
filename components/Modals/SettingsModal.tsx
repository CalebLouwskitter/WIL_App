import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ScrollView,
  TouchableWithoutFeedback,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import { useAppTheme, type AppPalette } from '../../hooks/useAppTheme';
import {
  usePreferences,
  getLocationPermissionStatus,
  type LocationPermissionStatus,
} from '../../contexts/PreferencesContext';
import { BackgroundLocationService } from '../backgroundServices';

type Props = {
  visible: boolean;
  onClose: () => void;
  onRequestFullSettings?: () => void;
};

const SettingsModal: React.FC<Props> = ({ visible, onClose, onRequestFullSettings }) => {
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();
  const { preferences, setUnits, setNotificationsWanted, saveError } = usePreferences();
  const isMetric = preferences.units === 'metric';

  const [locationPermission, setLocationPermission] =
    useState<LocationPermissionStatus>('Not allowed');
  const [backgroundEnabled, setBackgroundEnabled] = useState<boolean>(false);

  const styles = useMemo(() => createStyles(palette, insets), [palette, insets]);

  const handleFullSettings = () => {
    onClose();
    onRequestFullSettings?.();
  };

  const refreshPermissions = useCallback(async () => {
    try {
      const locStatus = await getLocationPermissionStatus();
      const bg = await BackgroundLocationService.hasPermissions();
      setLocationPermission(locStatus);
      setBackgroundEnabled(bg);
    } catch {}
  }, []);

  useEffect(() => {
    if (visible) {
      refreshPermissions();
    }
  }, [visible, refreshPermissions]);

  const handleToggleUnits = async () => {
    await setUnits(isMetric ? 'imperial' : 'metric');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.container}>
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <View style={styles.headerIcon}>
                    <Feather name="settings" size={18} color={palette.onPrimary} />
                  </View>
                  <Text style={[styles.headerTitle, { color: palette.textPrimary }]}>Quick Settings</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Feather name="x" size={22} color={palette.textPrimary} />
                </TouchableOpacity>
              </View>

              {saveError ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorBannerText}>{saveError}</Text>
                </View>
              ) : null}

              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View
                  style={[
                    styles.card,
                    { backgroundColor: palette.card },
                  ]}
                >
                  <Text style={[styles.cardTitle, { color: palette.textSecondary }]}>Preferences</Text>
                  <View style={styles.switchRow}>
                    <View style={styles.switchLabelRow}>
                      <Feather name="compass" size={18} color={palette.textSecondary} />
                      <Text style={[styles.switchLabel, { color: palette.textPrimary }]}>Use metric units</Text>
                    </View>
                    <Switch
                      value={isMetric}
                      onValueChange={handleToggleUnits}
                      trackColor={{
                        false: palette.divider,
                        true: palette.brandPrimary,
                      }}
                      thumbColor={
                        isMetric
                          ? palette.brandPrimary
                          : palette.card
                      }
                    />
                  </View>

                  <View style={styles.switchRow}>
                    <View style={styles.switchLabelRow}>
                      <Feather name="bell" size={18} color={palette.textSecondary} />
                      <Text style={[styles.switchLabel, { color: palette.textPrimary }]}>Notifications</Text>
                    </View>
                    <Switch
                      value={preferences.notificationsWanted}
                      onValueChange={(val) => setNotificationsWanted(val)}
                      trackColor={{
                        false: palette.divider,
                        true: palette.brandPrimary,
                      }}
                      thumbColor={
                        preferences.notificationsWanted
                          ? palette.brandPrimary
                          : palette.card
                      }
                    />
                  </View>
                  <Text style={[styles.helperCaption, { color: palette.textMuted }]}>
                    Ride alerts aren't being delivered yet — this saves your choice for when they are.
                  </Text>
                </View>

                <View
                  style={[
                    styles.card,
                    { backgroundColor: palette.card },
                  ]}
                >
                  <Text style={[styles.cardTitle, { color: palette.textSecondary }]}>Location permissions</Text>

                  <View style={styles.permissionSection}>
                    <View style={styles.switchLabelRow}>
                      <Feather name="map-pin" size={18} color={palette.textSecondary} />
                      <Text style={[styles.switchLabel, { color: palette.textPrimary }]}>Location permission</Text>
                    </View>
                    <View style={styles.permissionRow}>
                      <View style={styles.permissionStatus}>
                        <View
                          style={[
                            styles.statusDot,
                            {
                              backgroundColor:
                                locationPermission === 'Not allowed' ? palette.danger : palette.success,
                            },
                          ]}
                        />
                        <Text style={[styles.permissionText, { color: palette.textPrimary }]}>
                          {locationPermission}
                        </Text>
                      </View>
                      <View style={styles.permissionActions}>
                        <TouchableOpacity
                          style={[
                            styles.smallBtn,
                            {
                              backgroundColor: palette.card,
                              borderWidth: 1,
                              borderColor: palette.divider,
                            },
                          ]}
                          onPress={() => Linking.openSettings()}
                          activeOpacity={0.9}
                        >
                          <Text style={[styles.smallBtnText, { color: palette.textPrimary }]}>Open Settings</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.permissionSection}>
                    <Text style={[styles.permissionLabel, { color: palette.textSecondary }]}>
                      Background tracking
                    </Text>
                    <View style={styles.permissionRow}>
                      <View style={styles.permissionStatus}>
                        <View style={[styles.statusDot, { backgroundColor: backgroundEnabled ? palette.success : palette.caution }]} />
                        <Text style={[styles.permissionText, { color: palette.textPrimary }]}>
                          {backgroundEnabled ? 'Enabled' : 'Disabled'}
                        </Text>
                      </View>
                      <View style={styles.permissionActions}>
                        <TouchableOpacity
                          style={[styles.smallBtn, { backgroundColor: palette.brandPrimary }]}
                          onPress={async () => {
                            await BackgroundLocationService.requestPermissions();
                            await refreshPermissions();
                          }}
                          activeOpacity={0.9}
                        >
                          <Text style={[styles.smallBtnText, { color: palette.onPrimary }]}>Request</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.smallBtn,
                            {
                              backgroundColor: palette.card,
                              borderWidth: 1,
                              borderColor: palette.divider,
                            },
                          ]}
                          onPress={() => Linking.openSettings()}
                          activeOpacity={0.9}
                        >
                          <Text style={[styles.smallBtnText, { color: palette.textPrimary }]}>Open Settings</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              </ScrollView>

              {onRequestFullSettings ? (
                <TouchableOpacity
                  style={[styles.fullButton, { backgroundColor: palette.brandPrimary }]}
                  onPress={handleFullSettings}
                >
                  <Text style={[styles.fullButtonText, { color: palette.onPrimary }]}>
                    Open full settings
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const createStyles = (palette: AppPalette, insets: EdgeInsets) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: palette.mapOverlay,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: insets.top + 16,
      paddingBottom: insets.bottom + 16,
      paddingHorizontal: 20,
    },
    container: {
      width: '100%',
      maxWidth: 420,
      borderRadius: 24,
      backgroundColor: palette.card,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingVertical: 20,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    headerIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: palette.brandPrimary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
    },
    closeButton: {
      padding: 4,
    },
    scrollView: {
      maxHeight: 420,
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingBottom: 24,
      gap: 16,
    },
    card: {
      borderRadius: 18,
      paddingHorizontal: 20,
      paddingVertical: 18,
      borderWidth: 1,
      borderColor: palette.divider,
      gap: 18,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    switchLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    switchLabel: {
      fontSize: 16,
      fontWeight: '600',
    },
    helperCaption: {
      fontSize: 12,
      lineHeight: 16,
      marginTop: -8,
      marginBottom: 4,
    },
    errorBanner: {
      backgroundColor: '#FEE2E2',
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
      marginHorizontal: 24,
      marginBottom: 12,
    },
    errorBannerText: {
      color: '#DC2626',
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
    },
    fullButton: {
      marginHorizontal: 24,
      marginBottom: 24,
      marginTop: 8,
      paddingVertical: 16,
      borderRadius: 16,
      alignItems: 'center',
    },
    fullButtonText: {
      fontSize: 15,
      fontWeight: '700',
    },
    // Location and Background permission section
    permissionRow: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      gap: 8,
    },
    permissionStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    permissionText: {
      fontSize: 14,
      fontWeight: '600',
    },
    permissionActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
    },
    smallBtn: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
    },
    smallBtnText: {
      fontSize: 13,
      fontWeight: '700',
    },
    divider: {
      height: 1,
      backgroundColor: palette.divider,
      marginVertical: 4,
    },
    permissionSection: {
      gap: 12,
    },
    permissionLabel: {
      fontSize: 13,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
  });

export default SettingsModal;
