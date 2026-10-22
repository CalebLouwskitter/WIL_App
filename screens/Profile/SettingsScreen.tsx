import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import { Feather as Icon } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Typography, Spacing, BorderRadius, ComponentStyles } from '../../constants/styleguide';
import { FIREBASE_ENABLED, auth } from '../../services/firebase';
import { useAppTheme } from '../../hooks/useAppTheme';
import {
  usePreferences,
  getLocationPermissionStatus,
  type LocationPermissionStatus,
} from '../../contexts/PreferencesContext';
import ErrorBoundary from '../../components/ErrorBoundary';
import ScreenHeader from '../../components/ScreenHeader';

// Version from package.json - will be updated dynamically
const APP_VERSION = '1.0.0';

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { palette, isDark } = useAppTheme();
  const colors = palette;
  const { preferences, setUnits, setMapType, setNotificationsWanted, saveError } = usePreferences();
  const isMetric = preferences.units === 'metric';
  const toggleUnits = () => setUnits(isMetric ? 'imperial' : 'metric');
  const [locationPermission, setLocationPermission] = useState<LocationPermissionStatus>('Not allowed');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const status = await getLocationPermissionStatus();
        if (mounted) setLocationPermission(status);
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // User Profile State
  const [originalDisplayName, setOriginalDisplayName] = useState(
    FIREBASE_ENABLED && auth?.currentUser?.displayName ? auth.currentUser.displayName : ''
  );
  const [originalEmail, setOriginalEmail] = useState(
    FIREBASE_ENABLED && auth?.currentUser?.email ? auth.currentUser.email : ''
  );
  const [displayName, setDisplayName] = useState(
    FIREBASE_ENABLED && auth?.currentUser?.displayName ? auth.currentUser.displayName : ''
  );
  const [email, setEmail] = useState(
    FIREBASE_ENABLED && auth?.currentUser?.email ? auth.currentUser.email : ''
  );
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Password Change State
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSaveProfile = async () => {
    if (!FIREBASE_ENABLED || !auth?.currentUser) {
      Alert.alert('Error', 'Authentication not available');
      // Reset form on error
      setDisplayName(originalDisplayName);
      setEmail(originalEmail);
      setIsEditingProfile(false);
      return;
    }

    try {
      // Dynamic import of Firebase auth functions
      const firebaseAuth: any = await import('firebase/auth');
      
      if (displayName !== auth.currentUser.displayName) {
        await firebaseAuth.updateProfile(auth.currentUser, { displayName });
      }

      if (email !== auth.currentUser.email && email) {
        await firebaseAuth.updateEmail(auth.currentUser, email);
      }

      // Update original values on success
      setOriginalDisplayName(displayName);
      setOriginalEmail(email);
      setIsEditingProfile(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', error.message || 'Failed to update profile');
      // Reset form on error
      setDisplayName(originalDisplayName);
      setEmail(originalEmail);
    }
  };

  const handleChangePassword = async () => {
    if (!FIREBASE_ENABLED || !auth?.currentUser || !auth?.currentUser?.email) {
      Alert.alert('Error', 'Authentication not available');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    try {
      // Dynamic import of Firebase auth functions
      const firebaseAuth: any = await import('firebase/auth');
      
      // Re-authenticate user first
      const credential = firebaseAuth.EmailAuthProvider.credential(
        auth.currentUser.email,
        currentPassword
      );
      
      await firebaseAuth.reauthenticateWithCredential(auth.currentUser, credential);
      await firebaseAuth.updatePassword(auth.currentUser, newPassword);

      // Reset form on success
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsChangingPassword(false);
      Alert.alert('Success', 'Password changed successfully');
    } catch (error: any) {
      console.error('Error changing password:', error);
      Alert.alert('Error', error.message || 'Failed to change password');
    }
  };

  const renderSectionHeader = (title: string, icon: string) => (
    <View style={styles.sectionHeader}>
      <Icon name={icon as any} size={20} color={colors.brandPrimary} />
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
    </View>
  );

  const renderSettingRow = (
    label: string,
    value: boolean,
    onValueChange: (val: boolean) => void,
    icon: string
  ) => (
    <View style={[styles.settingRow, { backgroundColor: colors.card }]}>
      <View style={styles.settingLeft}>
        <Icon name={icon as any} size={20} color={colors.icon} />
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.divider, true: colors.brandPrimary }}
        thumbColor={value ? colors.onPrimary : colors.surfaceVariant}
      />
    </View>
  );

  return (
    <ErrorBoundary>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Settings" onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {saveError ? (
          <View
            style={[
              styles.errorBanner,
              { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' },
            ]}
          >
            <Text style={[styles.errorBannerText, { color: colors.danger }]}>{saveError}</Text>
          </View>
        ) : null}
        {/* Profile Section */}
        {renderSectionHeader('Profile', 'user')}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {isEditingProfile ? (
            <>
              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Display Name</Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: isDark ? colors.surfaceVariant : colors.background, 
                    color: colors.textPrimary,
                    borderColor: colors.divider 
                  }]}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Enter your name"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Email</Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: isDark ? colors.surfaceVariant : colors.background, 
                    color: colors.textPrimary,
                    borderColor: colors.divider 
                  }]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter your email"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton, { borderColor: colors.divider }]}
                  onPress={() => {
                    setIsEditingProfile(false);
                    setDisplayName(originalDisplayName);
                    setEmail(originalEmail);
                  }}
                >
                  <Text style={[styles.buttonText, { color: colors.textPrimary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.saveButton, { backgroundColor: colors.brandPrimary }]}
                  onPress={handleSaveProfile}
                >
                  <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Save</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={[styles.profileRow, { borderBottomColor: colors.divider }]}>
                <View>
                  <Text style={[styles.profileLabel, { color: colors.textSecondary }]}>Name</Text>
                  <Text style={[styles.profileValue, { color: colors.textPrimary }]}>
                    {displayName || 'Not set'}
                  </Text>
                </View>
              </View>
              <View style={[styles.profileRow, { borderBottomColor: colors.divider }]}>
                <View>
                  <Text style={[styles.profileLabel, { color: colors.textSecondary }]}>Email</Text>
                  <Text style={[styles.profileValue, { color: colors.textPrimary }]}>
                    {email || 'Not set'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.editButton,
                  { backgroundColor: isDark ? colors.surfaceVariant : colors.background },
                ]}
                onPress={() => setIsEditingProfile(true)}
              >
                <Icon name="edit-2" size={16} color={colors.brandPrimary} />
                <Text style={[styles.editButtonText, { color: colors.brandPrimary }]}>Edit Profile</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Password Section */}
        {FIREBASE_ENABLED && (
          <>
            {renderSectionHeader('Security', 'lock')}
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              {isChangingPassword ? (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Current Password</Text>
                    <TextInput
                      style={[styles.input, { 
                        backgroundColor: isDark ? colors.surfaceVariant : colors.background, 
                        color: colors.textPrimary,
                        borderColor: colors.divider 
                      }]}
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      placeholder="Enter current password"
                      placeholderTextColor={colors.textMuted}
                      secureTextEntry
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>New Password</Text>
                    <TextInput
                      style={[styles.input, { 
                        backgroundColor: isDark ? colors.surfaceVariant : colors.background, 
                        color: colors.textPrimary,
                        borderColor: colors.divider 
                      }]}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="Enter new password"
                      placeholderTextColor={colors.textMuted}
                      secureTextEntry
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Confirm Password</Text>
                    <TextInput
                      style={[styles.input, { 
                        backgroundColor: isDark ? colors.surfaceVariant : colors.background, 
                        color: colors.textPrimary,
                        borderColor: colors.divider 
                      }]}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Confirm new password"
                      placeholderTextColor={colors.textMuted}
                      secureTextEntry
                    />
                  </View>

                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[styles.button, styles.cancelButton, { borderColor: colors.divider }]}
                      onPress={() => {
                        setIsChangingPassword(false);
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                      }}
                    >
                      <Text style={[styles.buttonText, { color: colors.textPrimary }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.button, styles.saveButton, { backgroundColor: colors.brandPrimary }]}
                      onPress={handleChangePassword}
                    >
                      <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Change Password</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.editButton,
                    { backgroundColor: isDark ? colors.surfaceVariant : colors.background },
                  ]}
                  onPress={() => setIsChangingPassword(true)}
                >
                  <Icon name="key" size={16} color={colors.brandPrimary} />
                  <Text style={[styles.editButtonText, { color: colors.brandPrimary }]}>Change Password</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* Units & Measurements */}
        {renderSectionHeader('Units & Measurements', 'sliders')}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {renderSettingRow(
            isMetric ? 'Metric (km, km/h)' : 'Imperial (mi, mph)',
            isMetric,
            toggleUnits,
            'compass'
          )}
        </View>

        {/* App Settings */}
        {renderSectionHeader('App Settings', 'settings')}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {renderSettingRow(
            'Notifications',
            preferences.notificationsWanted,
            (val) => setNotificationsWanted(val),
            'bell'
          )}
          <Text style={[styles.helperCaption, { color: colors.textSecondary }]}>
            Ride alerts aren't being delivered yet — this saves your choice for when they are.
          </Text>
          <View style={[styles.settingRow, { backgroundColor: colors.card, marginTop: 4 }]}>
            <View style={styles.settingLeft}>
              <Icon name="map-pin" size={20} color={colors.icon} />
              <View style={{ marginLeft: 12 }}>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Location permission</Text>
                <Text style={[styles.permissionStatusText, { color: locationPermission === 'Not allowed' ? colors.danger : colors.textSecondary }]}>
                  {locationPermission}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.smallSettingsButton,
                {
                  borderColor: colors.divider,
                  backgroundColor: isDark ? colors.surfaceVariant : colors.background,
                },
              ]}
              onPress={() => Linking.openSettings()}
            >
              <Text style={[styles.smallSettingsButtonText, { color: colors.textPrimary }]}>Open phone settings</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Map Settings */}
        {renderSectionHeader('Map Settings', 'map')}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.mapTypeContainer}>
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Map Type</Text>
            <View style={styles.mapTypeButtons}>
              {(['standard', 'satellite', 'hybrid'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.mapTypeButton,
                    preferences.mapType === type && styles.mapTypeButtonActive,
                    {
                      backgroundColor:
                        preferences.mapType === type
                          ? colors.brandPrimary
                          : isDark
                          ? colors.surfaceVariant
                          : colors.background,
                    },
                  ]}
                  onPress={() => setMapType(type)}
                >
                  <Text style={[
                    styles.mapTypeButtonText,
                    preferences.mapType === type && styles.mapTypeButtonTextActive,
                    { color: preferences.mapType === type ? colors.onPrimary : colors.textPrimary }
                  ]}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* About Section */}
        {renderSectionHeader('About', 'info')}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={[styles.aboutRow, { borderBottomColor: colors.divider }]}>
            <Text style={[styles.aboutLabel, { color: colors.textSecondary }]}>Version</Text>
            <Text style={[styles.aboutValue, { color: colors.textPrimary }]}>{APP_VERSION}</Text>
          </View>
          <TouchableOpacity style={[styles.aboutRow, { borderBottomColor: colors.divider }]}>
            <Text style={[styles.aboutLabel, { color: colors.brandPrimary }]}>Terms of Service</Text>
            <Icon name="external-link" size={16} color={colors.brandPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.aboutRow, { borderBottomColor: colors.divider }]}>
            <Text style={[styles.aboutLabel, { color: colors.brandPrimary }]}>Privacy Policy</Text>
            <Icon name="external-link" size={16} color={colors.brandPrimary} />
          </TouchableOpacity>
        </View>

        {/* Sign Out */}
        {FIREBASE_ENABLED && auth?.currentUser && (
          <TouchableOpacity
            style={[styles.signOutButton, { backgroundColor: colors.danger }]}
            onPress={() => {
              Alert.alert(
                'Sign Out',
                'Are you sure you want to sign out?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: () => auth?.signOut(),
                  },
                ]
              );
            }}
          >
            <Icon name="log-out" size={20} color={colors.onPrimary} />
            <Text style={[styles.signOutText, { color: colors.onPrimary }]}>Sign Out</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
      </View>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: Typography.subtitle.fontSize,
    fontWeight: Typography.subtitle.fontWeight,
    marginLeft: Spacing.sm,
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  profileRow: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  profileLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  profileValue: {
    fontSize: Typography.body.fontSize,
    fontWeight: '500',
  },
  inputContainer: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  input: {
    ...ComponentStyles.input,
    paddingHorizontal: Spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  button: {
    flex: 1,
    ...ComponentStyles.button.primary,
    borderRadius: BorderRadius.md,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  saveButton: {
    // backgroundColor set dynamically
  },
  buttonText: {
    fontSize: Typography.button.fontSize,
    fontWeight: Typography.button.fontWeight,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  mapTypeContainer: {
    paddingVertical: Spacing.sm,
  },
  mapTypeButtons: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  mapTypeButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  mapTypeButtonActive: {
    // Styles applied dynamically
  },
  mapTypeButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  mapTypeButtonTextActive: {
    // Styles applied dynamically
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  aboutLabel: {
    fontSize: Typography.body.fontSize,
  },
  aboutValue: {
    fontSize: Typography.body.fontSize,
    fontWeight: '500',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  signOutText: {
    fontSize: Typography.button.fontSize,
    fontWeight: Typography.button.fontWeight,
  },
  helperCaption: {
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: Spacing.md,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.sm,
  },
  permissionStatusText: {
    fontSize: 12,
    marginTop: 2,
  },
  smallSettingsButton: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  smallSettingsButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  errorBanner: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  errorBannerText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default SettingsScreen;
