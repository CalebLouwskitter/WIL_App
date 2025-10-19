import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  useColorScheme,
} from 'react-native';
import { Feather as Icon } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import { Typography, Spacing, BorderRadius, ComponentStyles } from '../../constants/styleguide';
import { FIREBASE_ENABLED, auth } from '../../services/firebase';
import { useUnits } from '../../hooks/useUnits';

// Firebase auth types and functions - using any to bypass type issues with custom declarations
const firebaseAuthModule = async () => import('firebase/auth');

const SettingsScreen = () => {
  const navigation = useNavigation();
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];
  const { isMetric, toggle: toggleUnits } = useUnits();

  // User Profile State
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

  // Settings State
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationTracking, setLocationTracking] = useState(true);

  const handleSaveProfile = async () => {
    if (!FIREBASE_ENABLED || !auth?.currentUser) {
      Alert.alert('Error', 'Authentication not available');
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

      Alert.alert('Success', 'Profile updated successfully');
      setIsEditingProfile(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    }
  };

  const handleChangePassword = async () => {
    if (!FIREBASE_ENABLED || !auth?.currentUser) {
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
      // Re-authenticate user before changing password
      const userEmail = auth.currentUser.email;
      if (!userEmail) {
        Alert.alert('Error', 'No email associated with account');
        return;
      }

      // Dynamic import of Firebase auth functions
      const firebaseAuth: any = await import('firebase/auth');
      const credential = firebaseAuth.EmailAuthProvider.credential(userEmail, currentPassword);
      await firebaseAuth.reauthenticateWithCredential(auth.currentUser, credential);
      await firebaseAuth.updatePassword(auth.currentUser, newPassword);

      Alert.alert('Success', 'Password changed successfully');
      setIsChangingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to change password');
    }
  };

  const renderSectionHeader = (title: string, icon: string) => (
    <View style={styles.sectionHeader}>
      <Icon name={icon as any} size={20} color={colors.brandPrimary} />
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
    </View>
  );

  const renderSettingRow = (
    label: string,
    value: boolean,
    onValueChange: (val: boolean) => void,
    icon: string
  ) => (
    <View style={[styles.settingRow, { backgroundColor: colors.surface }]}>
      <View style={styles.settingLeft}>
        <Icon name={icon as any} size={20} color={colors.icon} />
        <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.brandPrimary }}
        thumbColor={value ? colors.onPrimary : colors.surfaceVariant}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundLight }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.icon} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Profile Section */}
        {renderSectionHeader('Profile', 'user')}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {isEditingProfile ? (
            <>
              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Display Name</Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: colors.backgroundLight, 
                    color: colors.text,
                    borderColor: colors.border 
                  }]}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Enter your name"
                  placeholderTextColor={colors.placeholder}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Email</Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: colors.backgroundLight, 
                    color: colors.text,
                    borderColor: colors.border 
                  }]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter your email"
                  placeholderTextColor={colors.placeholder}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton, { borderColor: colors.border }]}
                  onPress={() => {
                    setIsEditingProfile(false);
                    setDisplayName(auth?.currentUser?.displayName || '');
                    setEmail(auth?.currentUser?.email || '');
                  }}
                >
                  <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
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
              <View style={styles.profileRow}>
                <View>
                  <Text style={[styles.profileLabel, { color: colors.onSurfaceVariant }]}>Name</Text>
                  <Text style={[styles.profileValue, { color: colors.text }]}>
                    {displayName || 'Not set'}
                  </Text>
                </View>
              </View>
              <View style={styles.profileRow}>
                <View>
                  <Text style={[styles.profileLabel, { color: colors.onSurfaceVariant }]}>Email</Text>
                  <Text style={[styles.profileValue, { color: colors.text }]}>
                    {email || 'Not set'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.editButton, { backgroundColor: colors.backgroundLight }]}
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
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              {isChangingPassword ? (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>Current Password</Text>
                    <TextInput
                      style={[styles.input, { 
                        backgroundColor: colors.backgroundLight, 
                        color: colors.text,
                        borderColor: colors.border 
                      }]}
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      placeholder="Enter current password"
                      placeholderTextColor={colors.placeholder}
                      secureTextEntry
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>New Password</Text>
                    <TextInput
                      style={[styles.input, { 
                        backgroundColor: colors.backgroundLight, 
                        color: colors.text,
                        borderColor: colors.border 
                      }]}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="Enter new password"
                      placeholderTextColor={colors.placeholder}
                      secureTextEntry
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>Confirm Password</Text>
                    <TextInput
                      style={[styles.input, { 
                        backgroundColor: colors.backgroundLight, 
                        color: colors.text,
                        borderColor: colors.border 
                      }]}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Confirm new password"
                      placeholderTextColor={colors.placeholder}
                      secureTextEntry
                    />
                  </View>

                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[styles.button, styles.cancelButton, { borderColor: colors.border }]}
                      onPress={() => {
                        setIsChangingPassword(false);
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                      }}
                    >
                      <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
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
                  style={[styles.editButton, { backgroundColor: colors.backgroundLight }]}
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
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {renderSettingRow(
            isMetric ? 'Metric (km, km/h)' : 'Imperial (mi, mph)',
            isMetric,
            toggleUnits,
            'compass'
          )}
        </View>

        {/* App Settings */}
        {renderSectionHeader('App Settings', 'settings')}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {renderSettingRow('Notifications', notificationsEnabled, setNotificationsEnabled, 'bell')}
          {renderSettingRow('Location Tracking', locationTracking, setLocationTracking, 'map-pin')}
        </View>

        {/* About Section */}
        {renderSectionHeader('About', 'info')}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: colors.onSurfaceVariant }]}>Version</Text>
            <Text style={[styles.aboutValue, { color: colors.text }]}>1.0.0</Text>
          </View>
          <TouchableOpacity style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: colors.brandPrimary }]}>Terms of Service</Text>
            <Icon name="external-link" size={16} color={colors.brandPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.aboutRow}>
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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: 50,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Typography.title.fontSize,
    fontWeight: Typography.title.fontWeight,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
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
    borderBottomColor: 'rgba(0,0,0,0.05)',
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
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  settingLabel: {
    fontSize: Typography.body.fontSize,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
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
});

export default SettingsScreen;
