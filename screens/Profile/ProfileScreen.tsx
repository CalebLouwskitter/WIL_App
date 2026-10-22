import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Image,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather as Icon } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ProfileStackParamList } from '@/navigation/ProfileStack';
import { getRides } from '../../services/RideStorage';
import type { RideData } from '../../hooks/useRideTracker';
import { useAppTheme } from '../../hooks/useAppTheme';
import { usePreferences } from '../../contexts/PreferencesContext';
import { formatDistance } from '../../utils/units';
import { FIREBASE_ENABLED, auth } from '../../services/firebase';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useAchievementProgress } from '../../hooks/useAchievementProgress';
import { achievementDataNote, buildAchievementPreview, type AchievementPreviewItem } from '../../utils/achievements';
import ProfilePictureService from '../../services/ProfilePictureService';
import SettingsModal from '../../components/Modals/SettingsModal';
import NotificationsModal from '../../components/Modals/NotificationsModal';
import ErrorBoundary from '../../components/ErrorBoundary';

type ProfileScreenNavigationProp = StackNavigationProp<ProfileStackParamList, 'ProfileMain'>;

type IconName = 'activity' | 'map' | 'clock' | 'star';
type StatItem = { label: string; value: string; boxColor: string; circleColor: string; icon: IconName };

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const [navDisabled, setNavDisabled] = useState<boolean>(false);
  const { palette, isDark } = useAppTheme();
  const { preferences } = usePreferences();
  const [settingsVisible, setSettingsVisible] = useState<boolean>(false);
  const [notificationsVisible, setNotificationsVisible] = useState<boolean>(false);
  
  const [profilePictureUri, setProfilePictureUri] = useState<string | null>(null);
  const [loadingPicture, setLoadingPicture] = useState(false);
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(0);
  
  const initialDist = formatDistance(0, preferences.units, 0);
  const distLabel = preferences.units === 'imperial' ? 'MI' : 'KM';
  const [statsData, setStatsData] = useState<StatItem[]>([
    { label: 'Rides', value: '0', boxColor: palette.profileStatRidesBox, circleColor: palette.profileStatRidesCircle, icon: 'activity' },
    { label: distLabel, value: initialDist.value, boxColor: palette.profileStatKmBox, circleColor: palette.profileStatKmCircle, icon: 'map' },
    { label: 'Hours', value: '0', boxColor: palette.profileStatHoursBox, circleColor: palette.profileStatHoursCircle, icon: 'clock' },
    { label: 'Points', value: '0', boxColor: palette.profileStatPointsBox, circleColor: palette.profileStatPointsCircle, icon: 'star' },
  ]);
  const [recentRides, setRecentRides] = useState<RideData[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const displayName = FIREBASE_ENABLED && auth?.currentUser?.displayName
    ? auth?.currentUser?.displayName
    : 'Rider';
  const email = FIREBASE_ENABLED && auth?.currentUser?.email ? auth?.currentUser?.email : '—';
  const { profile } = useCurrentUser();
  const { awardsSource, statuses } = useAchievementProgress();
  const achievementPreview = useMemo(() => buildAchievementPreview(statuses), [statuses]);
  const dataNote = achievementDataNote(awardsSource);

  const loadProfilePicture = useCallback(async () => {
    try {
      const uri = await ProfilePictureService.getProfilePicture();
      setProfilePictureUri(uri);
    } catch (error) {
      console.error('Error loading profile picture:', error);
    }
  }, []);

  const handleChangeProfilePicture = async () => {
    setLoadingPicture(true);
    try {
      const uri = await ProfilePictureService.showPickerOptions();
      if (uri) {
        setProfilePictureUri(uri);
      }
    } catch (error) {
      console.error('Error changing profile picture:', error);
    } finally {
      setLoadingPicture(false);
    }
  };

  const handleRemoveProfilePicture = async () => {
    try {
      await ProfilePictureService.removeProfilePicture();
      setProfilePictureUri(null);
    } catch (error) {
      console.error('Error removing profile picture:', error);
    }
  };

  const loadStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const rides: RideData[] = await getRides();
      const sorted = [...rides].sort((a, b) => b.startTime - a.startTime);
      setRecentRides(sorted.slice(0, 3));
      const totalRides = rides.length;
      const totalDistanceMeters = rides.reduce((a, r) => a + (r.totalDistance || 0), 0);
      const totalKm = Math.round(totalDistanceMeters / 1000);
      const dist = formatDistance(totalDistanceMeters, preferences.units, 0);
      const totalDurationMs = rides.reduce((a, r) => a + (r.duration || 0), 0);
      const hours = Math.round(totalDurationMs / (1000 * 60 * 60));
      const points = totalRides * 10 + totalKm;
      const currentDistLabel = preferences.units === 'imperial' ? 'MI' : 'KM';

      setStatsData([
        { label: 'Rides', value: String(totalRides), boxColor: palette.profileStatRidesBox, circleColor: palette.profileStatRidesCircle, icon: 'activity' },
        { label: currentDistLabel, value: dist.value, boxColor: palette.profileStatKmBox, circleColor: palette.profileStatKmCircle, icon: 'map' },
        { label: 'Hours', value: String(hours), boxColor: palette.profileStatHoursBox, circleColor: palette.profileStatHoursCircle, icon: 'clock' },
        { label: 'Points', value: String(points), boxColor: palette.profileStatPointsBox, circleColor: palette.profileStatPointsCircle, icon: 'star' },
      ]);
    } catch (e) {
      console.error('Error loading stats:', e);
      // keep defaults on error
    } finally {
      setIsLoadingStats(false);
    }
  }, [palette, preferences.units]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useFocusEffect(
    useCallback(() => {
      loadProfilePicture();
      loadStats();
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }, [loadProfilePicture, loadStats])
  );

  const handleNavigate = useCallback(
    (screen: string, params?: any) => {
      if (navDisabled) return;
      setNavDisabled(true);
      if (params) {
        (navigation as any).navigate(screen, params);
      } else {
        (navigation as any).navigate(screen);
      }
      setTimeout(() => setNavDisabled(false), 500);
    },
    [navDisabled, navigation]
  );

  const renderAchievement = ({ item }: { item: AchievementPreviewItem }) => {
    const statusText = item.earned
      ? 'Earned'
      : item.progressLabel
      ? `Progress ${item.progressLabel}`
      : "Progress isn't tracked yet";
    return (
      <LinearGradient
        colors={isDark ? ([palette.card, palette.card] as const) : item.gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.achievementCard,
          {
            backgroundColor: palette.card,
            borderColor: palette.divider,
            borderWidth: isDark ? 1 : 0,
            shadowColor: palette.shadow,
          },
          !item.earned && styles.achievementCardLocked,
        ]}
      >
        <View
          style={[
            styles.achievementIconOuter,
            {
              backgroundColor: isDark ? palette.surfaceVariant : 'rgba(255, 255, 255, 0.95)',
              shadowColor: palette.shadow,
            },
          ]}
        >
          <Icon
            name={(item.earned ? item.icon : 'lock') as any}
            size={32}
            color={isDark ? (item.earned ? palette.brandPrimary : palette.textMuted) : '#1E293B'}
          />
        </View>
        <Text
          style={[
            styles.achievementTitle,
            { color: isDark ? palette.textPrimary : '#0F172A' },
          ]}
        >
          {item.title}
        </Text>
        <Text
          style={[
            styles.achievementDesc,
            { color: isDark ? palette.textSecondary : '#334155' },
          ]}
        >
          {item.description}
        </Text>
        <Text
          style={[
            styles.achievementStatus,
            { color: isDark ? palette.textPrimary : '#0F172A' },
          ]}
        >
          {statusText}
        </Text>
        <View style={styles.achievementShine} />
      </LinearGradient>
    );
  };

  return (
    <ErrorBoundary>
      <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        
        {/* Top Icons (Dashboard-style) */}
        <View style={[styles.topIcons, { paddingHorizontal: 16 }]}>        
          <TouchableOpacity activeOpacity={0.7} onPress={() => setSettingsVisible(true)} accessibilityLabel="Settings" accessibilityRole="button" accessibilityHint="Open settings menu">
            <Icon name="settings" size={27} color={palette.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} onPress={() => setNotificationsVisible(true)} accessibilityLabel="Notifications" accessibilityRole="button" accessibilityHint="View notifications">
            <Icon name="bell" size={27} color={palette.textSecondary} />
          </TouchableOpacity>
        </View>


        {/* Enhanced User Profile Card */}
        <Animated.View style={[
          styles.profileCard,
          { 
            transform: [{ translateY: slideAnim }],
            shadowColor: palette.shadow,
          }
        ]}>
          <LinearGradient
            colors={
              isDark
                ? (['#1E3A8A', '#1D4ED8', '#2563EB'] as const)
                : (['#1E40AF', '#3B82F6', '#60A5FA'] as const)
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profileCardGradient}
          >
            {/* Decorative elements */}
            <View style={styles.decorativeCircle1} />
            <View style={styles.decorativeCircle2} />
            
            <View style={styles.profileContent}>
              <View style={styles.profilePictureWrapper}>
                <TouchableOpacity 
                  style={styles.profilePictureContainer}
                  onPress={handleChangeProfilePicture}
                  activeOpacity={0.8}
                  accessibilityLabel="Change profile picture"
                  accessibilityRole="button"
                  accessibilityHint="Select or take a new profile picture"
                >
                  {loadingPicture ? (
                    <View style={styles.profilePictureLoading}>
                      <ActivityIndicator size="large" color={palette.brandPrimary} />
                    </View>
                  ) : profilePictureUri ? (
                    <>
                      <Image 
                        source={{ uri: profilePictureUri }} 
                        style={styles.profilePicture}
                      />
                      <View style={[styles.profilePictureBorder, { borderColor: palette.card }]} />
                    </>
                  ) : (
                    <View style={styles.profilePicturePlaceholder}>
                      <Icon name="user" size={36} color={palette.textMuted} />
                    </View>
                  )}
                  <View
                    style={[
                      styles.cameraButton,
                      {
                        backgroundColor: palette.card,
                        borderColor: palette.brandPrimary,
                        shadowColor: palette.shadow,
                      },
                    ]}
                  >
                    <Icon name="camera" size={14} color={palette.brandPrimary} />
                  </View>
                </TouchableOpacity>

                {profilePictureUri && (
                  <TouchableOpacity
                    style={[
                      styles.removeButton,
                      { backgroundColor: palette.danger, shadowColor: palette.danger },
                    ]}
                    onPress={handleRemoveProfilePicture}
                    activeOpacity={0.7}
                    accessibilityLabel="Remove profile picture"
                    accessibilityRole="button"
                    accessibilityHint="Remove current profile picture"
                  >
                    <Icon name="x" size={10} color={palette.onPrimary} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, { color: palette.onPrimary }]}>{displayName}</Text>
                <Text
                  style={[
                    styles.profileEmail,
                    { color: isDark ? 'rgba(255, 255, 255, 0.8)' : '#DBEAFE' },
                  ]}
                >
                  {email}
                </Text>
                {/* Only an approved profile read from the server counts as verified */}
                {FIREBASE_ENABLED && profile?.status === 'approved' && (
                  <View style={styles.verifiedBadge}>
                    <Icon name="check-circle" size={14} color={palette.onPrimary} />
                    <Text style={[styles.verifiedText, { color: palette.onPrimary }]}>Verified Rider</Text>
                  </View>
                )}
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Settings Widget */}
        <View style={styles.settingsWidget}>
          <TouchableOpacity
            style={[
              styles.settingsCard,
              {
                backgroundColor: palette.card,
                borderColor: palette.divider,
                shadowColor: palette.shadow,
              },
            ]}
            activeOpacity={0.85}
            onPress={() => handleNavigate('Settings')}
            disabled={navDisabled}
            accessibilityLabel="Open full settings"
            accessibilityRole="button"
            accessibilityHint="Navigate to settings screen"
          >
            <View style={styles.settingsCardContent}>
              <View
                style={[
                  styles.secondaryIconCircle,
                  { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.2)' : '#D1FAE5' },
                ]}
              >
                <Icon name="settings" size={22} color={palette.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.secondaryButtonText, { color: palette.textPrimary }]}>Settings</Text>
                <Text style={[styles.settingsSubtitle, { color: palette.textSecondary }]}>Open full settings</Text>
              </View>
              <Icon name="chevron-right" size={20} color={palette.textMuted} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Notifications Widget */}
        <View style={styles.settingsWidget}>
          <TouchableOpacity
            style={[
              styles.settingsCard,
              {
                backgroundColor: palette.card,
                borderColor: palette.divider,
                shadowColor: palette.shadow,
              },
            ]}
            activeOpacity={0.85}
            onPress={() => handleNavigate('Notifications')}
            disabled={navDisabled}
            accessibilityLabel="View all notifications"
            accessibilityRole="button"
            accessibilityHint="Navigate to notifications screen"
          >
            <View style={styles.settingsCardContent}>
              <View
                style={[
                  styles.secondaryIconCircle,
                  { backgroundColor: palette.brandSoft },
                ]}
              >
                <Icon name="bell" size={22} color={palette.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.secondaryButtonText, { color: palette.textPrimary }]}>Notifications</Text>
                <Text style={[styles.settingsSubtitle, { color: palette.textSecondary }]}>View all your notifications</Text>
              </View>
              <Icon name="chevron-right" size={20} color={palette.textMuted} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Stats Section */}
        <View style={styles.statsSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>Your Stats</Text>
            <TouchableOpacity 
              activeOpacity={0.7} 
              onPress={() => handleNavigate('PersonalStats')} 
              disabled={navDisabled}
              style={styles.viewAllButton}
              accessibilityLabel="View all statistics"
              accessibilityRole="button"
              accessibilityHint="Navigate to detailed statistics screen"
            >
              <Text style={[styles.viewAllText, { color: palette.brandPrimary }]}>View All</Text>
              <Icon name="chevron-right" size={16} color={palette.brandPrimary} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.statsGrid}>
            {statsData.map((item, idx) => (
              <View
                key={idx}
                style={[
                  styles.statCard,
                  { backgroundColor: item.boxColor, shadowColor: palette.shadow },
                ]}
              >
                <View
                  style={[
                    styles.statIconCircle,
                    { backgroundColor: item.circleColor, shadowColor: palette.shadow },
                  ]}
                >
                  <Icon name={item.icon} size={20} color={palette.onPrimary} />
                </View>
                <Text style={[styles.statValue, { color: palette.textPrimary }]}>{item.value}</Text>
                <Text style={[styles.statLabel, { color: palette.textSecondary }]}>
                  {item.label.toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Achievements Section */}
        <View style={styles.achievementsSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Icon name="award" size={20} color="#F59E0B" />
              <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>Achievements</Text>
            </View>
            <TouchableOpacity 
              activeOpacity={0.7} 
              onPress={() => handleNavigate('AchievementsScreen')} 
              disabled={navDisabled}
              style={styles.viewAllButton}
              accessibilityLabel="View all achievements"
              accessibilityRole="button"
              accessibilityHint="Navigate to achievements screen"
            >
              <Text style={[styles.viewAllText, { color: palette.brandPrimary }]}>View All</Text>
              <Icon name="chevron-right" size={16} color={palette.brandPrimary} />
            </TouchableOpacity>
          </View>

          {awardsSource === 'loading' ? (
            <View style={styles.achievementsLoading}>
              <ActivityIndicator size="small" color={palette.brandPrimary} />
              <Text style={[styles.achievementsLoadingText, { color: palette.textSecondary }]}>
                Checking your achievements…
              </Text>
            </View>
          ) : (
            <FlatList
              data={achievementPreview}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.achievementsList}
              keyExtractor={(item) => item.id}
              renderItem={renderAchievement}
            />
          )}

          {dataNote ? (
            <Text
              style={[
                styles.achievementsNote,
                {
                  backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7',
                  color: isDark ? '#FDE68A' : '#92400E',
                },
              ]}
            >
              {dataNote}
            </Text>
          ) : null}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.primaryButton, { shadowColor: palette.shadow }]}
            activeOpacity={0.85}
            onPress={() => handleNavigate('CreateHorse')}
            disabled={navDisabled}
            accessibilityLabel="Add new horse"
            accessibilityRole="button"
            accessibilityHint="Navigate to create horse screen"
          >
            <LinearGradient
              colors={
                isDark
                  ? (['#1E3A8A', '#1D4ED8'] as const)
                  : (['#1E293B', '#0F172A'] as const)
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buttonGradient}
            >
              <View style={styles.buttonIconWrapper}>
                <Icon name="plus" size={20} color={palette.onPrimary} />
              </View>
              <Text style={[styles.buttonText, { color: palette.onPrimary }]}>Add New Horse</Text>
              <Icon name="arrow-right" size={20} color={palette.textMuted} />
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.secondaryButton,
                {
                  backgroundColor: palette.card,
                  borderColor: palette.divider,
                  shadowColor: palette.shadow,
                },
              ]}
              activeOpacity={0.85}
              onPress={() => handleNavigate('HorsesList')}
              disabled={navDisabled}
              accessibilityLabel="View my horses"
              accessibilityRole="button"
              accessibilityHint="Navigate to horses list screen"
            >
              <View style={styles.secondaryButtonContent}>
                <View
                  style={[
                    styles.secondaryIconCircle,
                    { backgroundColor: palette.brandSoft },
                  ]}
                >
                  <Icon name="list" size={22} color={palette.brandPrimary} />
                </View>
                <Text style={[styles.secondaryButtonText, { color: palette.textPrimary }]}>My Horses</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.secondaryButton,
                {
                  backgroundColor: palette.card,
                  borderColor: palette.divider,
                  shadowColor: palette.shadow,
                },
              ]}
              activeOpacity={0.85}
              onPress={() => handleNavigate('Observations')}
              disabled={navDisabled}
              accessibilityLabel="View observations"
              accessibilityRole="button"
              accessibilityHint="Navigate to observations screen"
            >
              <View style={styles.secondaryButtonContent}>
                <View
                  style={[
                    styles.secondaryIconCircle,
                    { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.2)' : '#D1FAE5' },
                  ]}
                >
                  <Icon name="eye" size={22} color={palette.success} />
                </View>
                <Text style={[styles.secondaryButtonText, { color: palette.textPrimary }]}>Observations</Text>
              </View>
            </TouchableOpacity>
          </View>

          {profile?.role === 'admin' && (
            <TouchableOpacity
              style={styles.adminButton}
              activeOpacity={0.85}
              onPress={() => handleNavigate('AdminManagement')}
              accessibilityLabel="Open admin panel"
              accessibilityRole="button"
              accessibilityHint="Navigate to admin management screen"
            >
              <LinearGradient
                colors={['#7C3AED', '#6D28D9'] as const}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonGradient}
              >
                <Icon name="shield" size={20} color={palette.onPrimary} />
                <Text style={[styles.buttonText, { color: palette.onPrimary }]}>Admin Panel</Text>
                <Icon name="chevron-right" size={20} color="#A78BFA" />
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {/* Recent Rides */}
        <View
          style={[
            styles.ridesSection,
            {
              backgroundColor: palette.card,
              borderColor: palette.divider,
              shadowColor: palette.shadow,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => handleNavigate('RideHistory')}
            activeOpacity={0.85}
            style={styles.ridesSectionHeader}
            accessibilityLabel="Open ride history"
            accessibilityRole="button"
            accessibilityHint="Navigate to ride history screen"
          >
            <View>
              <Text style={[styles.ridesSectionTitle, { color: palette.textPrimary }]}>Ride History</Text>
              <Text style={[styles.ridesSectionSubtitle, { color: palette.textSecondary }]}>
                See all your past rides
              </Text>
            </View>
            <View
              style={[
                styles.ridesIconButton,
                { shadowColor: palette.brandPrimary },
              ]}
            >
              <LinearGradient
                colors={[palette.brandPrimary, palette.brandPrimaryAlt] as const}
                style={styles.ridesIconGradient}
              >
                <Icon name="clock" size={24} color={palette.onPrimary} />
              </LinearGradient>
            </View>
          </TouchableOpacity>
        </View>

        <View style={{ height: 28 }} />
      </ScrollView>

      {settingsVisible && (
        <SettingsModal
          visible={settingsVisible}
          onClose={() => setSettingsVisible(false)}
          onRequestFullSettings={() => {
            setSettingsVisible(false);
            setTimeout(() => {
              (navigation as any).navigate('Settings');
            }, 0);
          }}
        />
      )}

      {notificationsVisible && (
        <NotificationsModal
          visible={notificationsVisible}
          onClose={() => setNotificationsVisible(false)}
        />
      )}
      </SafeAreaView>
    </ErrorBoundary>
  );
};

export default ProfileScreen;

const { width: screenWidth } = Dimensions.get('window');
const STAT_WIDTH = (screenWidth - 56) / 2;

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
  },
  
  scrollView: { 
    flex: 1 
  },
  
   // Header
  header: {
    display: 'none',
  },
  topIcons: {
    flexDirection: 'row',
    paddingTop: 45,
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },

  // Profile Card
  profileCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingBottom: 20,
    overflow: 'hidden',
    elevation: 10,
  },
  profileCardGradient: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  decorativeCircle1: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  decorativeCircle2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  profilePictureWrapper: {
    position: 'relative',
  },
  profilePictureContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    position: 'relative',
  },
  profilePicture: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  profilePictureBorder: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 43,
    borderWidth: 3,
  },
  profilePicturePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePictureLoading: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    left: 58,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  profileEmail: {
    fontSize: 14,
    marginBottom: 10,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // Stats
  statsSection: {
    marginHorizontal: 20,
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 15,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: STAT_WIDTH,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  statIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Achievements
  achievementsSection: {
    marginBottom: 28,
  },
  achievementsList: {
    paddingHorizontal: 20,
  },
  achievementsLoading: {
    height: 240,
    marginHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  achievementsLoadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  achievementsNote: {
    fontSize: 13,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    marginHorizontal: 20,
  },
  achievementCard: {
    width: 190,
    height: 240,
    borderRadius: 24,
    marginRight: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  achievementCardLocked: {
    opacity: 0.8,
  },
  achievementStatus: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  achievementIconOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  achievementTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  achievementDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
  achievementShine: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },

  // Settings Widget
  settingsWidget: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  settingsCard: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
    borderWidth: 1,
  },
  settingsCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  settingsSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Actions
  actionsContainer: {
    marginHorizontal: 16,
    marginBottom: 28,
    gap: 12,
  },
  primaryButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  buttonIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    flex: 1,
    marginLeft: 16,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  secondaryButtonContent: {
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  secondaryIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  adminButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },

  // Recent Rides
  ridesSection: {
    marginHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  ridesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  ridesSectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  ridesSectionSubtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  ridesIconButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  ridesIconGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
