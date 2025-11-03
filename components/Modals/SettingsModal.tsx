import React, { useMemo, useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ScrollView,
  TouchableWithoutFeedback,
  useColorScheme,
} from 'react-native';
import { Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { useUnits } from '../../hooks/useUnits';
import { BackgroundLocationService } from '../backgroundServices';

type Props = {
  visible: boolean;
  onClose: () => void;
  onRequestFullSettings?: () => void;
};

const SettingsModal: React.FC<Props> = ({ visible, onClose, onRequestFullSettings }) => {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const palette = Colors[scheme ?? 'light'];
  const { isMetric, toggle } = useUnits();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationTracking, setLocationTracking] = useState(true);
  const [backgroundEnabled, setBackgroundEnabled] = useState<boolean>(false);

  const styles = useMemo(() => createStyles(palette, insets), [palette, insets]);

  const handleFullSettings = () => {
    onClose();
    onRequestFullSettings?.();
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const has = await BackgroundLocationService.hasPermissions();
        if (mounted) setBackgroundEnabled(has);
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.container}>
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <View style={styles.headerIcon}>
                    <Feather name="settings" size={18} color={palette.onPrimary || '#FFFFFF'} />
                  </View>
                  <Text style={[styles.headerTitle, { color: palette.text }]}>Quick Settings</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Feather name="x" size={22} color={palette.text} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View
                  style={[
                    styles.card,
                    { backgroundColor: palette.cardElevated || palette.surface || '#FFFFFF' },
                  ]}
                >
                  <Text style={[styles.cardTitle, { color: palette.secondary || palette.text }]}>Preferences</Text>
                  <View style={styles.switchRow}>
                    <View style={styles.switchLabelRow}>
                      <Feather name="compass" size={18} color={palette.icon || palette.text} />
                      <Text style={[styles.switchLabel, { color: palette.text }]}>Use metric units</Text>
                    </View>
                    <Switch
                      value={isMetric}
                      onValueChange={toggle}
                      trackColor={{
                        false: palette.border || '#CBD5F5',
                        true: palette.brandPrimary || '#2563EB',
                      }}
                      thumbColor={
                        isMetric
                          ? palette.brandPrimary || '#2563EB'
                          : palette.surfaceVariant || palette.surface || '#FFFFFF'
                      }
                    />
                  </View>

                  <View style={styles.switchRow}>
                    <View style={styles.switchLabelRow}>
                      <Feather name="bell" size={18} color={palette.icon || palette.text} />
                      <Text style={[styles.switchLabel, { color: palette.text }]}>Notifications</Text>
                    </View>
                    <Switch
                      value={notificationsEnabled}
                      onValueChange={setNotificationsEnabled}
                      trackColor={{
                        false: palette.border || '#CBD5F5',
                        true: palette.brandPrimary || '#2563EB',
                      }}
                      thumbColor={
                        notificationsEnabled
                          ? palette.brandPrimary || '#2563EB'
                          : palette.surfaceVariant || palette.surface || '#FFFFFF'
                      }
                    />
                  </View>

                </View>

                <View
                  style={[
                    styles.card,
                    { backgroundColor: palette.cardElevated || palette.surface || '#FFFFFF' },
                  ]}
                >
                  <Text style={[styles.cardTitle, { color: palette.secondary || palette.text }]}>Location tracking</Text>
                  
                  <View style={styles.switchRow}>
                    <View style={styles.switchLabelRow}>
                      <Feather name="map-pin" size={18} color={palette.icon || palette.text} />
                      <Text style={[styles.switchLabel, { color: palette.text }]}>Enable tracking</Text>
                    </View>
                    <Switch
                      value={locationTracking}
                      onValueChange={setLocationTracking}
                      trackColor={{
                        false: palette.border || '#CBD5F5',
                        true: palette.brandPrimary || '#2563EB',
                      }}
                      thumbColor={
                        locationTracking
                          ? palette.brandPrimary || '#2563EB'
                          : palette.surfaceVariant || palette.surface || '#FFFFFF'
                      }
                    />
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.permissionSection}>
                    <Text style={[styles.permissionLabel, { color: palette.secondary || palette.text }]}>
                      Background permission
                    </Text>
                    <View style={styles.permissionRow}>
                      <View style={styles.permissionStatus}>
                        <View style={[styles.statusDot, { backgroundColor: backgroundEnabled ? '#10b981' : '#f59e0b' }]} />
                        <Text style={[styles.permissionText, { color: palette.text }]}>
                          {backgroundEnabled ? 'Enabled' : 'Disabled'}
                        </Text>
                      </View>
                      <View style={styles.permissionActions}>
                        <TouchableOpacity
                          style={[styles.smallBtn, { backgroundColor: palette.brandPrimary || '#2563EB' }]}
                          onPress={async () => {
                            const ok = await BackgroundLocationService.requestPermissions();
                            setBackgroundEnabled(ok);
                          }}
                          activeOpacity={0.9}
                        >
                          <Text style={[styles.smallBtnText, { color: palette.onPrimary || '#FFFFFF' }]}>Request</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.smallBtn, { backgroundColor: palette.surface || '#FFFFFF', borderWidth: 1, borderColor: palette.border || 'rgba(148,163,184,0.25)' }]}
                          onPress={() => Linking.openSettings()}
                          activeOpacity={0.9}
                        >
                          <Text style={[styles.smallBtnText, { color: palette.text }]}>Open Settings</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>

                <View
                  style={[
                    styles.card,
                    { backgroundColor: palette.cardElevated || palette.surface || '#FFFFFF' },
                  ]}
                >
                  <Text style={[styles.cardTitle, { color: palette.secondary || palette.text }]}>Account</Text>
                  <TouchableOpacity style={styles.actionRow}>
                    <View style={styles.switchLabelRow}>
                      <Feather name="user" size={18} color={palette.icon || palette.text} />
                      <Text style={[styles.actionLabel, { color: palette.text }]}>Profile</Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={palette.placeholder || '#9CA3AF'} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionRow}>
                    <View style={styles.switchLabelRow}>
                      <Feather name="shield" size={18} color={palette.icon || palette.text} />
                      <Text style={[styles.actionLabel, { color: palette.text }]}>Privacy</Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={palette.placeholder || '#9CA3AF'} />
                  </TouchableOpacity>
                </View>
              </ScrollView>

              {onRequestFullSettings ? (
                <TouchableOpacity
                  style={[styles.fullButton, { backgroundColor: palette.brandPrimary || '#2563EB' }]}
                  onPress={handleFullSettings}
                >
                  <Text style={[styles.fullButtonText, { color: palette.onPrimary || '#FFFFFF' }]}>
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

const createStyles = (palette: any, insets: EdgeInsets) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.55)',
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
      backgroundColor: palette.background || '#FFFFFF',
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
      backgroundColor: palette.brandPrimary || '#2563EB',
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
      borderColor: palette.border || 'rgba(148, 163, 184, 0.25)',
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
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    actionLabel: {
      fontSize: 15,
      fontWeight: '600',
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
    // Background tracking section
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
      backgroundColor: palette.border || 'rgba(148, 163, 184, 0.25)',
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
