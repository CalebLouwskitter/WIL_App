// screens/Profile/ProfileScreen.tsx - WITH PROFILE PICTURE
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Dimensions, Image, ActivityIndicator } from 'react-native';
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
  { color: '#FFB0B0', title: 'First Ride', desc: 'Completed your first ride' },
  { color: '#E8FFA2', title: '100km Club', desc: 'Rode over 100 km' },
  { color: '#A0FF9D', title: 'Early Bird', desc: 'Morning ride before 6 am' },
];

type IconName = 'activity' | 'map' | 'clock' | 'star';
type StatItem = { label: string; value: string; boxColor: string; circleColor: string; icon: IconName };

export default function ProfileScreen() {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const [navDisabled, setNavDisabled] = useState(false);
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];
  
  // Profile picture state
  const [profilePictureUri, setProfilePictureUri] = useState<string | null>(null);
  const [loadingPicture, setLoadingPicture] = useState(false);
  
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

  // Load profile picture
  const loadProfilePicture = useCallback(async () => {
    try {
      const uri = await ProfilePictureService.getProfilePicture();
      setProfilePictureUri(uri);
    } catch (error) {
      console.error('Error loading profile picture:', error);
    }
  }, []);

  // Handle profile picture change
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

  // Handle remove profile picture
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

  const renderAchievement = ({ item }: { item: { color: string; title: string; desc: string } }) => (
    <View style={[styles.achievementCard, { backgroundColor: item.color }]}>
      <View style={styles.achievementIconOuter}>
        <Icon name="award" size={24} />
      </View>
      <Text style={styles.achievementTitle}>{item.title}</Text>
      <Text style={styles.achievementDesc}>{item.desc}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
      <View style={styles.topIcons}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => handleNavigate('Settings')} disabled={navDisabled}>
          <Icon name="settings" size={27} color={colors.icon} />
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} onPress={() => handleNavigate('Notifications')} disabled={navDisabled}>
          <Icon name="bell" size={27} color={colors.icon} />
        </TouchableOpacity>
      </View>

      <View style={styles.userSection}>
        {/* Profile Picture with Edit Button */}
        <TouchableOpacity 
          style={styles.profilePictureContainer}
          onPress={handleChangeProfilePicture}
          activeOpacity={0.8}
        >
          {loadingPicture ? (
            <View style={styles.profilePictureLoading}>
              <ActivityIndicator size="large" color={colors.brandPrimary} />
            </View>
          ) : profilePictureUri ? (
            <>
              <Image 
                source={{ uri: profilePictureUri }} 
                style={styles.profilePicture}
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.6)']}
                style={styles.profilePictureOverlay}
              >
                <Icon name="camera" size={20} color="white" />
              </LinearGradient>
            </>
          ) : (
            <View style={styles.profilePicturePlaceholder}>
              <Icon name="user" size={40} color={colors.icon} />
              <View style={styles.cameraIconContainer}>
                <Icon name="camera" size={16} color="white" />
              </View>
            </View>
          )}
        </TouchableOpacity>

        {/* Profile Picture Options */}
        {profilePictureUri && (
          <TouchableOpacity
            style={styles.removePhotoButton}
            onPress={handleRemoveProfilePicture}
            activeOpacity={0.7}
          >
            <Icon name="trash-2" size={14} color={colors.danger} />
          </TouchableOpacity>
        )}

        <View style={styles.userText}>
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userEmail}>{email}</Text>
        </View>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statsHeader}>
          <Text style={styles.statsTitle}>Stats</Text>
          <TouchableOpacity activeOpacity={0.7} onPress={() => handleNavigate('PersonalStats')} disabled={navDisabled}>
            <Text style={styles.viewMoreText}>View More</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.statsRow}>
          {statsData.map((item, idx) => (
            <View key={idx} style={[styles.statBox, { backgroundColor: item.boxColor }]}>
              <Text style={styles.statLabel1}>{item.label}</Text>
              <Text style={styles.statValue}>{item.value}</Text>
              <View style={[styles.iconCircle, { backgroundColor: item.circleColor }]}>
                <Icon name={item.icon as any} size={16} color="#fff" />
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.achievementsHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="award" size={20} style={{ marginRight: 5 }} />
          <Text style={styles.achievementsTitle}>Achievements</Text>
        </View>
        <TouchableOpacity activeOpacity={0.7} onPress={() => handleNavigate('AchievementsScreen')} disabled={navDisabled}>
          <Text style={styles.viewMoreText}>View More</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={achievementsData}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 4 }}
        keyExtractor={(_, i) => i.toString()}
        renderItem={renderAchievement}
      />

      <TouchableOpacity
        style={styles.addHorseBtn}
        activeOpacity={0.85}
        onPress={() => handleNavigate('CreateHorse')}
        disabled={navDisabled}
      >
        <Icon name="plus" size={18} color="#fff" />
        <Text style={styles.addHorseTxt}>Add Horse</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.myHorsesBtn}
        activeOpacity={0.85}
        onPress={() => handleNavigate('HorsesList')}
        disabled={navDisabled}
      >
        <Icon name="list" size={18} color="#2D2D2D" />
        <Text style={styles.myHorsesTxt}>My Horses</Text>
      </TouchableOpacity>

      {profile?.role === 'admin' && (
        <TouchableOpacity
          style={styles.myHorsesBtn}
          activeOpacity={0.85}
          onPress={() => handleNavigate('AdminManagement')}
        >
          <Icon name="shield" size={18} color="#2D2D2D" />
          <Text style={styles.myHorsesTxt}>Admin Panel</Text>
        </TouchableOpacity>
      )}

      <View style={styles.historyContainer}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <View>
            <Text style={styles.historyTitle}>History</Text>
            <Text style={styles.historySubtitle}>View your latest rides</Text>
          </View>
          <TouchableOpacity
            onPress={() => (navigation as any).navigate('Analytics', { screen: 'RideStats' })}
            activeOpacity={0.7}
            style={styles.historyIconCircle}
          >
            <Icon name="clock" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        {recentRides.length > 0 && (
          <View style={{ marginTop: 12 }}>
            {recentRides.map((r, idx) => (
              <TouchableOpacity
                key={r.startTime}
                style={styles.historyItem}
                activeOpacity={0.8}
                onPress={() => (navigation as any).navigate('Analytics', { screen: 'RideDetail', params: { startTime: r.startTime } })}
              >
                <View>
                  <Text style={styles.historyItemTitle}>Ride #{idx + 1}</Text>
                  <Text style={styles.historyItemSub}>
                    {new Date(r.startTime).toLocaleString()}
                    {r.horseName ? ` • ${r.horseName}` : ''}
                  </Text>
                </View>
                <Text style={styles.historyItemStat}>{(r.totalDistance / 1000).toFixed(1)} km</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const { width: screenWidth } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FE', padding: 16, paddingTop: 35 },
  topIcons: { flexDirection: 'row', paddingTop: 10, justifyContent: 'space-between' },
  userSection: { flexDirection: 'row', alignItems: 'center', marginTop: 20, position: 'relative' },
  
  // Profile Picture Styles
  profilePictureContainer: {
    width: 78,
    height: 78,
    borderRadius: 39,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  profilePicture: {
    width: '100%',
    height: '100%',
  },
  profilePicturePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePictureLoading: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePictureOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2D2D2D',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F4F7FE',
  },
  removePhotoButton: {
    position: 'absolute',
    top: -4,
    left: 56,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  
  userText: { marginLeft: 12 },
  userName: { fontSize: 20, fontWeight: 'bold' },
  userEmail: { fontSize: 14, color: '#666' },
  viewMoreText: { fontSize: 12, color: '#007AFF' },
  statsContainer: { width: '100%', maxWidth: 375, height: 147, marginTop: 35, backgroundColor: '#FFFFFF', borderRadius: 23, padding: 10, alignSelf: 'center' },
  iconCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2, marginHorizontal: 8, marginBottom: 8 },
  statsTitle: { fontWeight: 'bold', fontSize: 16 },
  statBox: { width: (screenWidth - 110) / 4, height: 90, borderRadius: 20, alignItems: 'center', justifyContent: 'space-between', padding: 4, marginBottom: 15 },
  statLabel1: { fontSize: 12 },
  statValue: { fontSize: 14, fontWeight: 'bold' },
  achievementsHeader: { marginTop: 38, marginLeft: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  achievementsTitle: { fontWeight: 'bold', fontSize: 16 },
  achievementCard: { width: 168, height: 217, borderRadius: 25, marginRight: 12, padding: 10, alignItems: 'center' },
  achievementIconOuter: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  achievementTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 4, paddingTop: 10 },
  achievementDesc: { fontSize: 12, color: '#4A4949', textAlign: 'center', paddingTop: 5 },
  historyContainer: { width: '100%', maxWidth: 375, backgroundColor: '#FFFFFF', borderRadius: 25, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', paddingRight: 5, paddingLeft: 15, marginTop: 40, alignSelf: 'center', paddingVertical: 12 },
  historyTitle: { fontSize: 16, fontWeight: 'bold' },
  historySubtitle: { fontSize: 14, color: '#666' },
  historyIconCircle: { width: 53, height: 53, borderRadius: 26.5, backgroundColor: '#2D2D2D', alignItems: 'center', justifyContent: 'center' },
  historyItem: { marginTop: 8, backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  historyItemTitle: { fontSize: 14, fontWeight: '600', color: '#111' },
  historyItemSub: { fontSize: 12, color: '#6B7280' },
  historyItemStat: { fontSize: 14, fontWeight: '600', color: '#111' },
  addHorseBtn: { marginTop: 16, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2D2D2D', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, gap: 8 },
  addHorseTxt: { color: '#fff', fontWeight: '700', marginLeft: 8 },
  myHorsesBtn: { marginTop: 10, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, gap: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  myHorsesTxt: { color: '#2D2D2D', fontWeight: '700', marginLeft: 8 },
});