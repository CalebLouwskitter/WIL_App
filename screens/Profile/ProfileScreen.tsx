import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Dimensions, Image, ActivityIndicator, SafeAreaView, Animated } from 'react-native';
import { Feather as Icon } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ProfileStackParamList } from '@/navigation/ProfileStack';
import { getRides } from '../../services/RideStorage';
import type { RideData } from '../../hooks/useRideTracker';
import { useColorScheme } from 'react-native';
import { Colors } from '../../constants/colors';
import { FIREBASE_ENABLED, auth } from '../../services/firebase';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import ProfilePictureService from '../../services/ProfilePictureService';

type ProfileScreenNavigationProp = StackNavigationProp<ProfileStackParamList, 'ProfileMain'>;

const achievementsData = [
  { color: ['#FF6B9D', '#FF8E53'] as const, title: 'First Ride', desc: 'Completed your first ride', icon: 'award' as const },
  { color: ['#4ECDC4', '#44A08D'] as const, title: '100km Club', desc: 'Rode over 100 km', icon: 'target' as const },
  { color: ['#FFD93D', '#F6A623'] as const, title: 'Early Bird', desc: 'Morning ride before 6 am', icon: 'sunrise' as const },
];

type IconName = 'activity' | 'map' | 'clock' | 'star';
type StatItem = { label: string; value: string; boxColor: string; circleColor: string; icon: IconName };

export default function ProfileScreen() {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const [navDisabled, setNavDisabled] = useState(false);
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];
  
  const [profilePictureUri, setProfilePictureUri] = useState<string | null>(null);
  const [loadingPicture, setLoadingPicture] = useState(false);
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(30);
  
  const [statsData, setStatsData] = useState<StatItem[]>([
    { label: 'Rides', value: '0', boxColor: colors.profileStatRidesBox, circleColor: colors.profileStatRidesCircle, icon: 'activity' },
    { label: 'Km', value: '0', boxColor: colors.profileStatKmBox, circleColor: colors.profileStatKmCircle, icon: 'map' },
    { label: 'Hours', value: '0', boxColor: colors.profileStatHoursBox, circleColor: colors.profileStatHoursCircle, icon: 'clock' },
    { label: 'Points', value: '0', boxColor: colors.profileStatPointsBox, circleColor: colors.profileStatPointsCircle, icon: 'star' },
  ]);
  const [recentRides, setRecentRides] = useState<RideData[]>([]);
  const displayName = FIREBASE_ENABLED && auth?.currentUser?.displayName
    ? auth?.currentUser?.displayName
    : 'Rider';
  const email = FIREBASE_ENABLED && auth?.currentUser?.email ? auth?.currentUser?.email : '—';
  const { profile } = useCurrentUser();

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

  useFocusEffect(
    useCallback(() => {
      loadProfilePicture();
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
    }, [loadProfilePicture])
  );

  useEffect(() => {
    (async () => {
      try {
        const rides: RideData[] = await getRides();
        const sorted = [...rides].sort((a, b) => b.startTime - a.startTime);
        setRecentRides(sorted.slice(0, 3));
        const totalRides = rides.length;
        const totalDistanceMeters = rides.reduce((a, r) => a + (r.totalDistance || 0), 0);
        const totalKm = Math.round(totalDistanceMeters / 1000);
        const totalDurationMs = rides.reduce((a, r) => a + (r.duration || 0), 0);
        const hours = Math.round(totalDurationMs / (1000 * 60 * 60));
        const points = totalRides * 10 + totalKm;

        setStatsData([
          { label: 'Rides', value: String(totalRides), boxColor: colors.profileStatRidesBox, circleColor: colors.profileStatRidesCircle, icon: 'activity' },
          { label: 'Km', value: String(totalKm), boxColor: colors.profileStatKmBox, circleColor: colors.profileStatKmCircle, icon: 'map' },
          { label: 'Hours', value: String(hours), boxColor: colors.profileStatHoursBox, circleColor: colors.profileStatHoursCircle, icon: 'clock' },
          { label: 'Points', value: String(points), boxColor: colors.profileStatPointsBox, circleColor: colors.profileStatPointsCircle, icon: 'star' },
        ]);
      } catch (e) {
        // keep defaults on error
      }
    })();
  }, []);

  const handleNavigate = useCallback(
    (screen: string) => {
      if (navDisabled) return;
      setNavDisabled(true);
      navigation.navigate(screen as never);
      setTimeout(() => setNavDisabled(false), 500);
    },
    [navDisabled, navigation]
  );

  const renderAchievement = ({ item }: { item: typeof achievementsData[0] }) => (
    <LinearGradient
      colors={item.color}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.achievementCard}
    >
      <View style={styles.achievementIconOuter}>
        <Icon name={item.icon} size={32} color="#1E293B" />
      </View>
      <Text style={styles.achievementTitle}>{item.title}</Text>
      <Text style={styles.achievementDesc}>{item.desc}</Text>
      <View style={styles.achievementShine} />
    </LinearGradient>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity 
              style={styles.iconButton}
              activeOpacity={0.7} 
              onPress={() => handleNavigate('Settings')} 
              disabled={navDisabled}
            >
              <Icon name="settings" size={20} color="#64748B" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.iconButton}
              activeOpacity={0.7} 
              onPress={() => handleNavigate('Notifications')} 
              disabled={navDisabled}
            >
              <Icon name="bell" size={20} color="#64748B" />
              <View style={styles.notificationDot} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Enhanced User Profile Card */}
        <Animated.View style={[
          styles.profileCard,
          { 
            transform: [{ translateY: slideAnim }]
          }
        ]}>
          <LinearGradient
            colors={['#1E40AF', '#3B82F6', '#60A5FA'] as const}
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
                >
                  {loadingPicture ? (
                    <View style={styles.profilePictureLoading}>
                      <ActivityIndicator size="large" color="#3B82F6" />
                    </View>
                  ) : profilePictureUri ? (
                    <>
                      <Image 
                        source={{ uri: profilePictureUri }} 
                        style={styles.profilePicture}
                      />
                      <View style={styles.profilePictureBorder} />
                    </>
                  ) : (
                    <View style={styles.profilePicturePlaceholder}>
                      <Icon name="user" size={36} color="#64748B" />
                    </View>
                  )}
                  <View style={styles.cameraButton}>
                    <Icon name="camera" size={14} color="#1E40AF" />
                  </View>
                </TouchableOpacity>

                {profilePictureUri && (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={handleRemoveProfilePicture}
                    activeOpacity={0.7}
                  >
                    <Icon name="x" size={10} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{displayName}</Text>
                <Text style={styles.profileEmail}>{email}</Text>
                <View style={styles.verifiedBadge}>
                  <Icon name="check-circle" size={14} color="#fff" />
                  <Text style={styles.verifiedText}>Verified Rider</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Stats Section */}
        <View style={styles.statsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Stats</Text>
            <TouchableOpacity 
              activeOpacity={0.7} 
              onPress={() => (navigation as any).navigate('Analytics', { screen: 'Stats' })} 
              disabled={navDisabled}
              style={styles.viewAllButton}
            >
              <Text style={styles.viewAllText}>View All</Text>
              <Icon name="chevron-right" size={16} color="#3B82F6" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.statsGrid}>
            {statsData.map((item, idx) => (
              <View key={idx} style={styles.statCard}>
                <View style={[styles.statIconCircle, { backgroundColor: item.circleColor }]}>
                  <Icon name={item.icon} size={20} color="#fff" />
                </View>
                <Text style={styles.statValue}>{item.value}</Text>
                <Text style={styles.statLabel}>{item.label.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Achievements Section */}
        <View style={styles.achievementsSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Icon name="award" size={20} color="#F59E0B" />
              <Text style={styles.sectionTitle}>Achievements</Text>
            </View>
            <TouchableOpacity 
              activeOpacity={0.7} 
              onPress={() => handleNavigate('AchievementsScreen')} 
              disabled={navDisabled}
              style={styles.viewAllButton}
            >
              <Text style={styles.viewAllText}>View All</Text>
              <Icon name="chevron-right" size={16} color="#3B82F6" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={achievementsData}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.achievementsList}
            keyExtractor={(_, i) => i.toString()}
            renderItem={renderAchievement}
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            onPress={() => handleNavigate('CreateHorse')}
            disabled={navDisabled}
          >
            <LinearGradient
              colors={['#1E293B', '#0F172A'] as const}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buttonGradient}
            >
              <View style={styles.buttonIconWrapper}>
                <Icon name="plus" size={20} color="#fff" />
              </View>
              <Text style={styles.buttonText}>Add New Horse</Text>
              <Icon name="arrow-right" size={20} color="#64748B" />
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              activeOpacity={0.85}
              onPress={() => handleNavigate('HorsesList')}
              disabled={navDisabled}
            >
              <View style={styles.secondaryButtonContent}>
                <View style={[styles.secondaryIconCircle, { backgroundColor: '#DBEAFE' }]}>
                  <Icon name="list" size={22} color="#3B82F6" />
                </View>
                <Text style={styles.secondaryButtonText}>My Horses</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              activeOpacity={0.85}
              onPress={() => handleNavigate('Observations')}
              disabled={navDisabled}
            >
              <View style={styles.secondaryButtonContent}>
                <View style={[styles.secondaryIconCircle, { backgroundColor: '#D1FAE5' }]}>
                  <Icon name="eye" size={22} color="#10B981" />
                </View>
                <Text style={styles.secondaryButtonText}>Observations</Text>
              </View>
            </TouchableOpacity>
          </View>

          {profile?.role === 'admin' && (
            <TouchableOpacity
              style={styles.adminButton}
              activeOpacity={0.85}
              onPress={() => handleNavigate('AdminManagement')}
            >
              <LinearGradient
                colors={['#7C3AED', '#6D28D9'] as const}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonGradient}
              >
                <Icon name="shield" size={20} color="#fff" />
                <Text style={styles.buttonText}>Admin Panel</Text>
                <Icon name="chevron-right" size={20} color="#A78BFA" />
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {/* Recent Rides */}
        <View style={styles.ridesSection}>
          <View style={styles.ridesSectionHeader}>
            <View>
              <Text style={styles.ridesSectionTitle}>Recent Rides</Text>
              <Text style={styles.ridesSectionSubtitle}>Your latest activity</Text>
            </View>
            <TouchableOpacity
              onPress={() => (navigation as any).navigate('Analytics', { screen: 'RideHistory' })}
              activeOpacity={0.7}
              style={styles.ridesIconButton}
            >
              <LinearGradient
                colors={['#3B82F6', '#2563EB'] as const}
                style={styles.ridesIconGradient}
              >
                <Icon name="clock" size={24} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
          
          {recentRides.length > 0 ? (
            <View style={styles.ridesList}>
              {recentRides.map((r, idx) => (
                <TouchableOpacity
                  key={r.startTime}
                  style={styles.rideCard}
                  activeOpacity={0.8}
                  onPress={() => (navigation as any).navigate('Analytics', { screen: 'RideDetail', params: { startTime: r.startTime } })}
                >
                  <View style={styles.rideIconWrapper}>
                    <Icon name="navigation" size={20} color="#3B82F6" />
                  </View>
                  <View style={styles.rideDetails}>
                    <Text style={styles.rideTitle}>Ride #{recentRides.length - idx}</Text>
                    <Text style={styles.rideMeta}>
                      {new Date(r.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {r.horseName ? ` • ${r.horseName}` : ''}
                    </Text>
                  </View>
                  <View style={styles.rideDistance}>
                    <Text style={styles.rideDistanceValue}>{(r.totalDistance / 1000).toFixed(1)}</Text>
                    <Text style={styles.rideDistanceUnit}>km</Text>
                  </View>
                  <Icon name="chevron-right" size={20} color="#CBD5E1" />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Icon name="map" size={32} color="#94A3B8" />
              </View>
              <Text style={styles.emptyStateTitle}>No rides yet</Text>
              <Text style={styles.emptyStateText}>Start your first ride to see it here</Text>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const { width: screenWidth } = Dimensions.get('window');
const STAT_WIDTH = (screenWidth - 56) / 2;

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8FAFC'
  },
  scrollView: { 
    flex: 1 
  },
  
  // Header
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#fff',
  },
  
  // Profile Card
  profileCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  profileCardGradient: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    position: 'relative',
    overflow: 'hidden',
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
    borderColor: '#fff',
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
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#1E40AF',
    shadowColor: '#000',
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
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
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
    color: '#fff',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  profileEmail: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 10,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
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
    color: '#fff',
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
    color: '#0F172A',
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
    color: '#3B82F6',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: STAT_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 1,
  },

  // Achievements
  achievementsSection: {
    marginBottom: 28,
  },
  achievementsList: {
    paddingHorizontal: 20,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  achievementIconOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  achievementTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  achievementDesc: {
    fontSize: 14,
    color: '#334155',
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

  // Actions
  actionsContainer: {
    marginHorizontal: 20,
    marginBottom: 28,
    gap: 12,
  },
  primaryButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
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
    color: '#fff',
    letterSpacing: -0.2,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#000',
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
    color: '#0F172A',
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
    marginHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  ridesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  ridesSectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  ridesSectionSubtitle: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  ridesIconButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#3B82F6',
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
  ridesList: {
    gap: 12,
  },
  rideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rideIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rideDetails: {
    flex: 1,
  },
  rideTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  rideMeta: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  rideDistance: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  rideDistanceValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  rideDistanceUnit: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
});