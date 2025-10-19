import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { getOnlineUsers, type OnlineUser } from '../../../services/OnlineUserService';
import { getObstacles, type Obstacle } from '../../../services/ObstacleService';

type UserWithObstacle = {
  user: OnlineUser;
  obstacle?: Obstacle;
};

export const UserFeedCard: React.FC = () => {
  const [feedItems, setFeedItems] = useState<UserWithObstacle[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadFeed();
    const interval = setInterval(loadFeed, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const loadFeed = async () => {
    try {
      const [users, obstacles] = await Promise.all([
        getOnlineUsers(),
        getObstacles({ status: 'active', limit: 10 }),
      ]);

      // Combine users with their recent obstacles
      const feed: UserWithObstacle[] = users.slice(0, 2).map((user) => {
        const userObstacle = obstacles.find((o) => o.userId === user.uid);
        return { user, obstacle: userObstacle };
      });

      setFeedItems(feed);
      setLoading(false);
    } catch (error) {
      console.warn('Failed to load user feed:', error);
      setLoading(false);
    }
  };

  const handleSubmitObstacle = (userId: string, obstacleId?: string) => {
    // Navigate to obstacle detail or create screen
    console.log('Navigate to obstacle for user:', userId);
  };

  const handleImageError = (userId: string) => {
    setImageErrors((prev) => new Set(prev).add(userId));
  };

  if (loading || feedItems.length === 0) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {feedItems.map((item, index) => (
        <View key={item.user.uid} style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            {item.user.photoURL && !imageErrors.has(item.user.uid) ? (
              <Image
                source={{ uri: item.user.photoURL }}
                style={styles.avatarImage}
                onError={() => handleImageError(item.user.uid)}
              />
            ) : (
              <Text style={styles.avatarText}>
                {item.user.displayName?.[0]?.toUpperCase() || '👤'}
              </Text>
            )}
          </View>
          <Text style={styles.profileName} numberOfLines={1}>
            {item.user.displayName || 'Anonymous'}
          </Text>
          <Text style={styles.profileEmail} numberOfLines={1}>
            {item.user.isRiding ? '🚴 Riding now' : 'Online'}
          </Text>
          
          <View style={styles.profileStats}>
            <Text style={styles.statText}>
              {item.user.lastSeen
                ? `${Math.round((Date.now() - item.user.lastSeen) / 60000)}m ago`
                : 'Just now'}
            </Text>
          </View>

          {item.obstacle && (
            <View style={styles.obstacleReport}>
              <Text style={styles.obstacleTitle}>⚠️ {item.obstacle.type}</Text>
              <Text style={styles.obstacleDesc} numberOfLines={2}>
                {item.obstacle.title}
              </Text>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={() => handleSubmitObstacle(item.user.uid, item.obstacle?.id)}
              >
                <Text style={styles.submitText}>View</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 4,
  },
  profileCard: {
    width: 160,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  profileAvatar: {
    width: 40,
    height: 40,
    backgroundColor: '#3b82f6',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  profileName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 8,
  },
  profileStats: {
    width: '100%',
    marginBottom: 8,
    alignItems: 'center',
  },
  statText: {
    fontSize: 10,
    color: '#6b7280',
  },
  obstacleReport: {
    alignItems: 'center',
    marginTop: 8,
    width: '100%',
  },
  obstacleTitle: {
    fontSize: 10,
    color: '#f97316',
    marginBottom: 4,
  },
  obstacleDesc: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 8,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  submitText: {
    fontSize: 10,
    color: '#374151',
  },
});
