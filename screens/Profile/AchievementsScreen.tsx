import React, { useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, useColorScheme, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather as Icon } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: string;
  target: number;
  progress: number;
  gradientColors: readonly [string, string];
};

const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-ride',
    title: 'First Ride',
    description: 'Completed your first ride',
    icon: 'award',
    target: 1,
    progress: 1,
    gradientColors: ['#FF6B9D', '#FF8E53'] as const,
  },
  {
    id: 'distance-100',
    title: '100km Club',
    description: 'Rode over 100 km',
    icon: 'map',
    target: 100,
    progress: 42,
    gradientColors: ['#A8E6CF', '#7FD8BE'] as const,
  },
  {
    id: 'early-bird',
    title: 'Early Bird',
    description: 'Morning ride before 6 am',
    icon: 'sunrise',
    target: 1,
    progress: 0,
    gradientColors: ['#FFD93D', '#F6A623'] as const,
  },
  {
    id: 'trail-marathon',
    title: 'Trail Marathon',
    description: 'Ride for 4 hours continuously',
    icon: 'clock',
    target: 1,
    progress: 0,
    gradientColors: ['#FFA07A', '#FF6B9D'] as const,
  },
  {
    id: 'stable-keeper',
    title: 'Stable Keeper',
    description: 'Register three horses',
    icon: 'heart',
    target: 3,
    progress: 2,
    gradientColors: ['#C9D6FF', '#A1C4FD'] as const,
  },
  {
    id: 'speed-demon',
    title: 'Speed Demon',
    description: 'Reach 30 km/h',
    icon: 'zap',
    target: 1,
    progress: 0,
    gradientColors: ['#F093FB', '#F5576C'] as const,
  },
];

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = (screenWidth - 52) / 2;

export default function AchievementsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
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
  }, []);

  const { unlocked, inProgress } = useMemo(() => {
    const unlockedList = ACHIEVEMENTS.filter((item) => item.progress >= item.target);
    const progressList = ACHIEVEMENTS.filter((item) => item.progress < item.target);
    return { unlocked: unlockedList, inProgress: progressList };
  }, []);

  const totalProgress = useMemo(() => {
    const total = ACHIEVEMENTS.length;
    const completed = unlocked.length;
    return { total, completed, percentage: Math.round((completed / total) * 100) };
  }, [unlocked]);

  const renderCard = (achievement: Achievement, isUnlocked: boolean, index: number) => {
    const ratio = achievement.target === 0 ? 0 : Math.min(1, achievement.progress / achievement.target);
    const percent = Math.round(ratio * 100);

    return (
      <Animated.View
        key={achievement.id}
        style={[
          styles.cardWrapper,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity activeOpacity={0.8}>
          <LinearGradient
            colors={achievement.gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.achievementCard}
          >
            {/* Decorative shine */}
            <View style={styles.cardShine} />

            {/* Icon */}
            <View style={[styles.cardIconContainer, isUnlocked && styles.cardIconUnlocked]}>
              <Icon 
                name={achievement.icon as any} 
                size={28} 
                color={isUnlocked ? '#10B981' : '#64748B'} 
              />
            </View>

            {/* Content */}
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{achievement.title}</Text>
              <Text style={styles.cardDescription}>{achievement.description}</Text>

              {isUnlocked ? (
                <View style={styles.unlockedBadge}>
                  <Icon name="check-circle" size={14} color="#10B981" />
                  <Text style={styles.unlockedText}>Unlocked</Text>
                </View>
              ) : (
                <View style={styles.progressSection}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressText}>
                      {achievement.progress}/{achievement.target}
                    </Text>
                    <Text style={styles.progressPercent}>{percent}%</Text>
                  </View>
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
                  </View>
                </View>
              )}
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#F8FAFC', '#F1F5F9'] as const}
        style={styles.gradient}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <View style={[styles.header, { paddingHorizontal: 0 }]}>
            <TouchableOpacity 
              onPress={() => {
                if (route?.params?.fromDashboard) {
                  navigation.getParent()?.navigate('Dashboard');
                } else {
                  navigation.goBack();
                }
              }} 
              style={styles.backButton}
            >
              <Icon name="chevron-left" size={24} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Achievements</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Progress Summary */}
          <Animated.View 
            style={[
              styles.summaryCard,
              { 
                opacity: fadeAnim,
                transform: [{ scale: fadeAnim }]
              }
            ]}
          >
            <LinearGradient
              colors={['#3B82F6', '#2563EB'] as const}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.summaryGradient}
            >
              <View style={styles.summaryLeft}>
                <Text style={styles.summaryTitle}>Your Progress</Text>
                <Text style={styles.summarySubtitle}>
                  {totalProgress.completed} of {totalProgress.total} achievements unlocked
                </Text>
                <View style={styles.summaryProgressBar}>
                  <View 
                    style={[
                      styles.summaryProgressFill, 
                      { width: `${totalProgress.percentage}%` }
                    ]} 
                  />
                </View>
              </View>
              <View style={styles.summaryRight}>
                <View style={styles.percentageCircle}>
                  <Text style={styles.percentageText}>{totalProgress.percentage}</Text>
                  <Text style={styles.percentageSymbol}>%</Text>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Unlocked Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionIconCircle}>
                  <Icon name="star" size={16} color="#F59E0B" />
                </View>
                <Text style={styles.sectionTitle}>Unlocked</Text>
              </View>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{unlocked.length}</Text>
              </View>
            </View>

            <View style={styles.cardsGrid}>
              {unlocked.length > 0 ? (
                unlocked.map((item, idx) => renderCard(item, true, idx))
              ) : (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconCircle}>
                    <Icon name="lock" size={40} color="#94A3B8" />
                  </View>
                  <Text style={styles.emptyTitle}>No achievements unlocked yet</Text>
                  <Text style={styles.emptySubtitle}>Keep riding to earn your first trophy!</Text>
                </View>
              )}
            </View>
          </View>

          {/* In Progress Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIconCircle, { backgroundColor: '#DBEAFE' }]}>
                  <Icon name="target" size={16} color="#3B82F6" />
                </View>
                <Text style={styles.sectionTitle}>In Progress</Text>
              </View>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{inProgress.length}</Text>
              </View>
            </View>

            <View style={styles.cardsGrid}>
              {inProgress.length > 0 ? (
                inProgress.map((item, idx) => renderCard(item, false, idx))
              ) : (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconCircle}>
                    <Icon name="award" size={40} color="#94A3B8" />
                  </View>
                  <Text style={styles.emptyTitle}>All achievements complete!</Text>
                  <Text style={styles.emptySubtitle}>You've earned every badge. Amazing work!</Text>
                </View>
              )}
            </View>
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  gradient: {
    flex: 1,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  backButton: {
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
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 44,
    height: 44,
  },

  // Summary Card
  summaryCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  summaryGradient: {
    flexDirection: 'row',
    padding: 24,
    alignItems: 'center',
  },
  summaryLeft: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  summarySubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 16,
    fontWeight: '500',
  },
  summaryProgressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  summaryProgressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 4,
  },
  summaryRight: {
    marginLeft: 20,
  },
  percentageCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  percentageText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },
  percentageSymbol: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },

  // Content
  scrollContent: {
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  countBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  countText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },

  // Cards Grid
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  cardWrapper: {
    width: CARD_WIDTH,
  },
  achievementCard: {
    borderRadius: 24,
    padding: 20,
    minHeight: 220,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  cardShine: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  cardIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardIconUnlocked: {
    backgroundColor: '#fff',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  cardDescription: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    marginBottom: 16,
    fontWeight: '500',
  },

  // Unlocked Badge
  unlockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    alignSelf: 'flex-start',
    gap: 6,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  unlockedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Progress
  progressSection: {
    marginTop: 'auto',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 4,
  },

  // Empty State
  emptyState: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 48,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
});