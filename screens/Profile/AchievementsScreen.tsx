import React, { useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather as Icon } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useAchievementProgress } from '../../hooks/useAchievementProgress';
import { achievementDataNote, type AchievementStatus } from '../../utils/achievements';
import ScreenHeader from '../../components/ScreenHeader';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = (screenWidth - 52) / 2;

export default function AchievementsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { palette, isDark } = useAppTheme();
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

  const { awardsSource, statuses } = useAchievementProgress();

  const { unlocked, inProgress, untracked } = useMemo(() => {
    return {
      unlocked: statuses.filter((item) => item.unlocked),
      inProgress: statuses.filter((item) => !item.unlocked && item.progress !== null),
      untracked: statuses.filter((item) => !item.unlocked && item.progress === null),
    };
  }, [statuses]);

  const totalProgress = useMemo(() => {
    const total = statuses.filter((item) => item.unlocked || item.progress !== null).length;
    const completed = unlocked.length;
    return { total, completed, percentage: total === 0 ? 0 : Math.round((completed / total) * 100) };
  }, [statuses, unlocked]);

  const dataNote = achievementDataNote(awardsSource);

  const renderCard = (achievement: AchievementStatus, isUnlocked: boolean, index: number) => {
    const progress = achievement.progress ?? 0;
    const ratio = achievement.target === 0 ? 0 : Math.min(1, progress / achievement.target);
    const percent = Math.round(ratio * 100);
    const progressLabel = `${progress}/${achievement.target}${achievement.unit ? ` ${achievement.unit}` : ''}`;

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
        <View
          style={[
            styles.achievementCard,
            {
              backgroundColor: palette.card,
              borderColor: isUnlocked
                ? (isDark ? 'rgba(96, 165, 250, 0.3)' : '#DBEAFE')
                : palette.divider,
              shadowColor: palette.shadow,
            },
            !isUnlocked && styles.achievementCardLocked,
          ]}
        >
          {/* Decorative shine */}
          <View
            style={[
              styles.cardShine,
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.2)' },
            ]}
          />

          {/* Icon */}
          <View
            style={[
              styles.cardIconContainer,
              {
                backgroundColor: isUnlocked
                  ? (isDark ? 'rgba(34, 197, 94, 0.2)' : '#E8F5E9')
                  : (isDark ? palette.surfaceVariant : '#F1F5F9'),
                shadowColor: palette.shadow,
              },
            ]}
          >
            <Icon
              name={achievement.icon as any}
              size={28}
              color={isUnlocked ? palette.success : palette.textMuted}
            />
          </View>

          {/* Content */}
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>
              {achievement.title}
            </Text>
            <Text style={[styles.cardDescription, { color: palette.textSecondary }]}>
              {achievement.description}
            </Text>

            {isUnlocked ? (
              <View
                style={[
                  styles.unlockedBadge,
                  {
                    backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : '#E8F5E9',
                    shadowColor: palette.shadow,
                  },
                ]}
              >
                <Icon name="check-circle" size={14} color={palette.success} />
                <Text style={[styles.unlockedText, { color: palette.success }]}>Unlocked</Text>
              </View>
            ) : achievement.progress === null ? (
              <Text style={[styles.progressText, { color: palette.textMuted }]}>
                Progress isn't tracked yet
              </Text>
            ) : (
              <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                  <Text style={[styles.progressText, { color: palette.textPrimary }]}>
                    {progressLabel}
                  </Text>
                  <Text style={[styles.progressPercent, { color: palette.textSecondary }]}>
                    {percent}%
                  </Text>
                </View>
                <View style={[styles.progressBarContainer, { backgroundColor: palette.divider }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${percent}%`, backgroundColor: palette.brandPrimary },
                    ]}
                  />
                </View>
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <LinearGradient
        colors={[palette.background, palette.card] as const}
        style={styles.gradient}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <ScreenHeader
            title="Achievements"
            backgroundColor="transparent"
            onBack={() => {
              if (route?.params?.fromDashboard) {
                navigation.getParent()?.navigate('Dashboard');
              } else {
                navigation.goBack();
              }
            }}
          />

          {/* Progress Summary */}
          <Animated.View
            style={[
              styles.summaryCard,
              {
                opacity: fadeAnim,
                transform: [{ scale: fadeAnim }],
              },
            ]}
          >
            <LinearGradient
              colors={
                isDark
                  ? ([palette.gradientPrimaryStart, palette.gradientPrimaryEnd] as const)
                  : (['#3B82F6', '#2563EB'] as const)
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.summaryGradient}
            >
              <View style={styles.summaryLeft}>
                <Text style={styles.summaryTitle}>Your Progress</Text>
                <Text style={styles.summarySubtitle}>
                  {awardsSource === 'loading'
                    ? 'Checking your achievements…'
                    : `${totalProgress.completed} of ${totalProgress.total} tracked achievements unlocked`}
                </Text>
                <View style={styles.summaryProgressBar}>
                  <View
                    style={[
                      styles.summaryProgressFill,
                      { width: `${totalProgress.percentage}%` },
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

          {dataNote ? (
            <Text
              style={[
                styles.dataNote,
                {
                  backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7',
                  color: isDark ? '#FDE68A' : '#92400E',
                },
              ]}
            >
              {dataNote}
            </Text>
          ) : null}

          {/* Unlocked Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View
                  style={[
                    styles.sectionIconCircle,
                    { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7' },
                  ]}
                >
                  <Icon name="star" size={16} color="#F59E0B" />
                </View>
                <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>Unlocked</Text>
              </View>
              <View
                style={[
                  styles.countBadge,
                  { backgroundColor: palette.card, borderColor: palette.divider, borderWidth: 1 },
                ]}
              >
                <Text style={[styles.countText, { color: palette.textPrimary }]}>
                  {unlocked.length}
                </Text>
              </View>
            </View>

            <View style={styles.cardsGrid}>
              {unlocked.length > 0 ? (
                unlocked.map((item, idx) => renderCard(item, true, idx))
              ) : (
                <View
                  style={[
                    styles.emptyState,
                    {
                      backgroundColor: palette.card,
                      borderColor: palette.divider,
                      shadowColor: palette.shadow,
                    },
                  ]}
                >
                  <View style={[styles.emptyIconCircle, { backgroundColor: palette.background }]}>
                    <Icon name="lock" size={40} color={palette.textMuted} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
                    No achievements unlocked yet
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: palette.textSecondary }]}>
                    Complete a ride to earn your first one.
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* In Progress Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View
                  style={[
                    styles.sectionIconCircle,
                    { backgroundColor: palette.brandSoft },
                  ]}
                >
                  <Icon name="target" size={16} color={palette.brandPrimary} />
                </View>
                <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
                  In Progress
                </Text>
              </View>
              <View
                style={[
                  styles.countBadge,
                  { backgroundColor: palette.card, borderColor: palette.divider, borderWidth: 1 },
                ]}
              >
                <Text style={[styles.countText, { color: palette.textPrimary }]}>
                  {inProgress.length}
                </Text>
              </View>
            </View>

            <View style={styles.cardsGrid}>
              {inProgress.length > 0 ? (
                inProgress.map((item, idx) => renderCard(item, false, idx))
              ) : (
                <View
                  style={[
                    styles.emptyState,
                    {
                      backgroundColor: palette.card,
                      borderColor: palette.divider,
                      shadowColor: palette.shadow,
                    },
                  ]}
                >
                  <View style={[styles.emptyIconCircle, { backgroundColor: palette.background }]}>
                    <Icon name="award" size={40} color={palette.textMuted} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
                    Nothing in progress
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: palette.textSecondary }]}>
                    Every achievement we can track is unlocked.
                  </Text>
                </View>
              )}
            </View>
          </View>

          {untracked.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <View
                    style={[
                      styles.sectionIconCircle,
                      { backgroundColor: palette.divider },
                    ]}
                  >
                    <Icon name="help-circle" size={16} color={palette.textSecondary} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
                    Not tracked yet
                  </Text>
                </View>
              </View>
              <View style={styles.cardsGrid}>
                {untracked.map((item, idx) => renderCard(item, false, idx))}
              </View>
            </View>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  dataNote: {
    fontSize: 13,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },

  // Summary Card
  summaryCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 24,
    overflow: 'hidden',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  countBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  countText: {
    fontSize: 14,
    fontWeight: '700',
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
    borderWidth: 1,
    padding: 20,
    minHeight: 220,
    position: 'relative',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  achievementCardLocked: {
    opacity: 0.75,
  },
  cardShine: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  cardIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
    fontWeight: '500',
  },

  // Unlocked Badge
  unlockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    alignSelf: 'flex-start',
    gap: 6,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  unlockedText: {
    fontSize: 12,
    fontWeight: '700',
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
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },

  // Empty State
  emptyState: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 48,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
});
