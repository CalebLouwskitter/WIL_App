import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, useColorScheme } from 'react-native';
import { Feather as Icon } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../constants/colors';

type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: string;
  target: number;
  progress: number;
  cardColor: string;
};

const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-ride',
    title: 'First Ride',
    description: 'Completed your first ride',
    icon: 'award',
    target: 1,
    progress: 1,
    cardColor: '#FFB0B0',
  },
  {
    id: 'distance-100',
    title: '100km Club',
    description: 'Rode over 100 km',
    icon: 'map',
    target: 100,
    progress: 42,
    cardColor: '#E8FFA2',
  },
  {
    id: 'early-bird',
    title: 'Early Bird',
    description: 'Morning ride before 6 am',
    icon: 'sunrise',
    target: 1,
    progress: 0,
    cardColor: '#A0FF9D',
  },
  {
    id: 'trail-marathon',
    title: 'Trail Marathon',
    description: 'Ride for 4 hours continuously',
    icon: 'clock',
    target: 1,
    progress: 0,
    cardColor: '#FFD6A5',
  },
  {
    id: 'stable-keeper',
    title: 'Stable Keeper',
    description: 'Register three horses',
    icon: 'heart',
    target: 3,
    progress: 2,
    cardColor: '#C9D6FF',
  },
];

const { width: screenWidth } = Dimensions.get('window');

export default function AchievementsScreen() {
  const navigation = useNavigation<any>();
  const scheme = useColorScheme();
  const palette = Colors[scheme ?? 'light'];

  const { unlocked, inProgress } = useMemo(() => {
    const unlockedList = ACHIEVEMENTS.filter((item) => item.progress >= item.target);
    const progressList = ACHIEVEMENTS.filter((item) => item.progress < item.target);
    return { unlocked: unlockedList, inProgress: progressList };
  }, []);

  const renderCard = (achievement: Achievement, isUnlocked: boolean) => {
    const ratio = achievement.target === 0 ? 0 : Math.min(1, achievement.progress / achievement.target);
    const percent = Math.round(ratio * 100);

    return (
      <View key={achievement.id} style={[styles.card, { backgroundColor: achievement.cardColor }]}
      >
        <View style={styles.cardIcon}>
          <Icon name={achievement.icon} size={22} color="#2D2D2D" />
        </View>
        <Text style={styles.cardTitle}>{achievement.title}</Text>
        <Text style={styles.cardDesc}>{achievement.description}</Text>
        {isUnlocked ? (
          <View style={styles.unlockedPill}>
            <Icon name="check-circle" size={16} color="#1F8B4C" />
            <Text style={styles.unlockedText}>Unlocked</Text>
          </View>
        ) : (
          <View style={styles.progressWrap}>
            <Text style={styles.progressLabel}>{achievement.progress}/{achievement.target}</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${percent}%` }]} />
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: '#F4F7FE' }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Icon name="chevron-left" size={24} color="#2D2D2D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Achievements</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Icon name="star" size={20} color="#2D2D2D" style={styles.sectionIcon} />
            <Text style={styles.sectionTitle}>Unlocked</Text>
          </View>
        </View>
        <View style={styles.grid}>
          {unlocked.length
            ? unlocked.map((item) => renderCard(item, true))
            : (
              <View style={styles.emptyCard}>
                <Icon name="lock" size={32} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>No achievements unlocked yet</Text>
                <Text style={styles.emptySubtitle}>Keep riding to earn trophies.</Text>
              </View>
            )}
        </View>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Icon name="target" size={20} color="#2D2D2D" style={styles.sectionIcon} />
            <Text style={styles.sectionTitle}>In Progress</Text>
          </View>
        </View>
        <View style={styles.grid}>
          {inProgress.length
            ? inProgress.map((item) => renderCard(item, false))
            : (
              <View style={styles.emptyCard}>
                <Icon name="trophy" size={32} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>All achievements complete</Text>
                <Text style={styles.emptySubtitle}>You have earned every badge.</Text>
              </View>
            )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D2D2D',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  sectionHeader: {
    marginTop: 18,
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D2D2D',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: (screenWidth - 44) / 2,
    borderRadius: 25,
    padding: 16,
    alignItems: 'center',
    minHeight: 200,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2D2D2D',
    textAlign: 'center',
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 12,
    color: '#4A4949',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 12,
  },
  unlockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  unlockedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1F8B4C',
    textTransform: 'uppercase',
  },
  progressWrap: {
    width: '100%',
    marginTop: 8,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2D2D2D',
    textAlign: 'center',
    marginBottom: 6,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.6)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#2D2D2D',
  },
  emptyCard: {
    width: '100%',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    paddingVertical: 32,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D2D2D',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
});

