import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getRides } from '../../../services/RideStorage';
import { getOnlineUsers } from '../../../services/OnlineUserService';

type CommunityStats = {
  totalDistance: number;
  goalDistance: number;
  activeRiders: number;
};

export const CommunityGoalWidget: React.FC = () => {
  const [stats, setStats] = useState<CommunityStats>({
    totalDistance: 0,
    goalDistance: 10000,
    activeRiders: 0,
  });

  useEffect(() => {
    loadCommunityStats();
  }, []);

  const loadCommunityStats = async () => {
    try {
      const [rides, onlineUsers] = await Promise.all([
        getRides(),
        getOnlineUsers(),
      ]);

      // Calculate total distance from user's rides (in production, this would be a global aggregate)
      const totalDistance = rides.reduce((sum, ride) => sum + ride.totalDistance / 1000, 0);
      
      // Count active riders
      const activeRiders = onlineUsers.filter((u) => u.isRiding).length;

      setStats({
        totalDistance: Math.round(totalDistance),
        goalDistance: 10000,
        activeRiders,
      });
    } catch (error) {
      console.warn('Failed to load community stats:', error);
    }
  };

  const progressPercent = Math.min(
    (stats.totalDistance / stats.goalDistance) * 100,
    100
  );

  return (
    <View style={styles.container}>
      <View style={styles.goalLeft}>
        <Text style={styles.goalTitle}>Community Goal</Text>
        <Text style={styles.goalProgress}>
          {stats.totalDistance.toLocaleString()}/{stats.goalDistance.toLocaleString()} km
        </Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
      </View>
      <View style={styles.goalRight}>
        <Text style={styles.goalNumber}>{stats.activeRiders}</Text>
        <Text style={styles.goalLabel}>Riders</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalLeft: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  goalProgress: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fbbf24',
    borderRadius: 3,
  },
  goalRight: {
    alignItems: 'flex-end',
    marginLeft: 16,
  },
  goalNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fbbf24',
  },
  goalLabel: {
    fontSize: 10,
    color: '#6b7280',
  },
});
