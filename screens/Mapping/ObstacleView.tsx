import React from 'react';
import { Marker, Callout } from 'react-native-maps';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { Obstacle } from '../../services/ObstacleService';
import type { ObstacleSeverity, ObstacleType } from '../../services/Data';

type Props = {
  obstacles: Obstacle[];
  onObstaclePress?: (obstacle: Obstacle) => void;
  onVerify?: (obstacle: Obstacle) => void;
  filters?: {
    severities?: ObstacleSeverity[];
    types?: ObstacleType[];
    showResolved?: boolean;
  };
};

const getObstacleIcon = (type: string): string => {
  switch (type) {
    case 'pothole':
      return 'alert-circle';
    case 'debris':
      return 'trash-2';
    case 'animal':
      return 'alert-triangle';
    case 'tree':
      return 'feather';
    case 'water':
      return 'droplet';
    default:
      return 'alert-circle';
  }
};

const getSeverityColor = (severity: string): string => {
  switch (severity) {
    case 'critical':
      return '#DC2626'; // red
    case 'high':
      return '#EA580C'; // orange
    case 'medium':
      return '#F59E0B'; // amber
    case 'low':
      return '#10B981'; // green
    default:
      return '#6B7280'; // gray
  }
};

const ObstacleView: React.FC<Props> = ({ obstacles, onObstaclePress, onVerify }) => {
  return (
    <>
      {obstacles.map((obstacle) => {
        const iconName = getObstacleIcon(obstacle.type);
        const color = getSeverityColor(obstacle.severity);
        
        return (
          <Marker
            key={obstacle.id}
            coordinate={{
              latitude: obstacle.location.latitude,
              longitude: obstacle.location.longitude,
            }}
            pinColor={color}
            onPress={() => onObstaclePress?.(obstacle)}
          >
            <View style={[styles.markerContainer, { borderColor: color }]}>
              <Feather name={iconName as any} size={20} color={color} />
            </View>
            
            <Callout tooltip onPress={() => onObstaclePress?.(obstacle)}>
              <View style={styles.calloutContainer}>
                <View style={styles.calloutHeader}>
                  <Feather name={iconName as any} size={16} color={color} />
                  <Text style={styles.calloutTitle}>{obstacle.title}</Text>
                </View>
                
                <View style={styles.calloutBody}>
                  <View style={styles.badgeRow}>
                    <View style={[styles.badge, { backgroundColor: color }]}>
                      <Text style={styles.badgeText}>{obstacle.severity}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: '#6B7280' }]}>
                      <Text style={styles.badgeText}>{obstacle.type}</Text>
                    </View>
                  </View>
                  
                  {obstacle.description && (
                    <Text style={styles.description} numberOfLines={2}>
                      {obstacle.description}
                    </Text>
                  )}
                  
                  <View style={styles.footer}>
                    <Text style={styles.verifiedText}>
                      ✓ {obstacle.verifiedBy?.length || 0} verified
                    </Text>
                    {onVerify && (
                      <TouchableOpacity 
                        style={styles.verifyButton}
                        onPress={() => onVerify(obstacle)}
                      >
                        <Text style={styles.verifyButtonText}>Verify</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            </Callout>
          </Marker>
        );
      })}
    </>
  );
};

const styles = StyleSheet.create({
  markerContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    borderWidth: 3,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  calloutContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    minWidth: 200,
    maxWidth: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  calloutTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    flex: 1,
    color: '#1F2937',
  },
  calloutBody: {
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  description: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  verifyButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  verifyButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ObstacleView;
