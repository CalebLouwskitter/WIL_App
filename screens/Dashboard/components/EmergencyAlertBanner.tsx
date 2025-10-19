import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getObstacles, type Obstacle } from '../../../services/ObstacleService';
import { getOnlineUsers, type OnlineUser } from '../../../services/OnlineUserService';

type EmergencyAlert = {
  type: 'sos' | 'obstacle';
  userId?: string;
  userName: string;
  message: string;
  location?: { latitude: number; longitude: number };
  obstacleId?: string;
};

export const EmergencyAlertBanner: React.FC = () => {
  const navigation = useNavigation<any>();
  const [alert, setAlert] = useState<EmergencyAlert | null>(null);

  useEffect(() => {
    loadEmergencyAlerts();
    const interval = setInterval(loadEmergencyAlerts, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  const loadEmergencyAlerts = async () => {
    try {
      // Check for high-severity unresolved obstacles
      const obstacles = await getObstacles({ status: 'active', limit: 5 });
      const urgentObstacles = obstacles.filter(
        (o) => o.severity === 'high' || o.severity === 'critical'
      );

      if (urgentObstacles.length > 0) {
        const obstacle = urgentObstacles[0];
        setAlert({
          type: 'obstacle',
          userName: obstacle.userName || 'Someone',
          message: `${obstacle.title}!`,
          location: obstacle.location,
          obstacleId: obstacle.id,
        });
        return;
      }

      // Check for online users who might need help (future SOS integration)
      const onlineUsers = await getOnlineUsers();
      // This is where SOS service would integrate
      
      setAlert(null);
    } catch (error) {
      console.warn('Failed to load emergency alerts:', error);
    }
  };

  const handleTrack = () => {
    if (alert?.location) {
      navigation.navigate('Mapping', {
        screen: 'UserMapView',
        params: {
          initialLocation: alert.location,
          highlightObstacle: alert.obstacleId,
        },
      });
    }
  };

  const handleCall = () => {
    // Future: Integrate with emergency calling system
    console.log('Emergency call initiated');
  };

  if (!alert) return null;

  return (
    <View style={styles.container}>
      <View style={styles.alertLeft}>
        <Text style={styles.alertIcon}>⚠️</Text>
        <Text style={styles.alertText} numberOfLines={1}>
          {alert.userName}: {alert.message}
        </Text>
      </View>
      <View style={styles.alertButtons}>
        <TouchableOpacity style={styles.trackButton} onPress={handleTrack}>
          <Text style={styles.buttonText}>Track</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.callButton} onPress={handleCall}>
          <Text style={styles.buttonText}>📞 Call</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 12,
    borderRadius: 8,
  },
  alertLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  alertIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  alertText: {
    color: 'white',
    fontWeight: '500',
    flex: 1,
  },
  alertButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  trackButton: {
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  callButton: {
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  buttonText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '500',
  },
});
