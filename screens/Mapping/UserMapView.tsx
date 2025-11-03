import React, { memo, useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import MapView, { PROVIDER_DEFAULT } from 'react-native-maps';
import { DEFAULT_REGION } from '../../services/MapsService';

/**
 * UI-only Map View
 * - Dark map canvas (placeholder View)
 * - Top overlay actions (settings, notifications with dot)
 * - Floating segmented buttons: Free Ride | Recent
 */
const UserMapView: React.FC = () => {
  const [selectedSegment, setSelectedSegment] = useState<'freeRide' | 'recent'>('freeRide');

  const onSettingsPress = useCallback(() => {
    // TODO: handle settings press
    console.log('Settings pressed');
  }, []);

  const onNotificationsPress = useCallback(() => {
    // TODO: handle notifications press
    console.log('Notifications pressed');
  }, []);

  const onSegmentPress = useCallback((segment: 'freeRide' | 'recent') => {
    setSelectedSegment(segment);
  }, []);

  return (
    <View style={styles.root}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_DEFAULT}
        initialRegion={DEFAULT_REGION}
        showsUserLocation
        showsMyLocationButton
        showsCompass
      >
        {/* Future: Polyline(s) will be added here */}
      </MapView>

      {/* Top overlay */}
      <View style={styles.topBar}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.iconBtn, styles.leftIcon]}
          onPress={onSettingsPress}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Settings"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="settings" size={20} color="#fff" />
        </TouchableOpacity>

        <View style={styles.rightIcons}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.iconBtn}
            onPress={onNotificationsPress}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="bell" size={20} color="#fff" />
            <View style={styles.dot} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom segmented buttons */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          activeOpacity={0.9}
          style={[
            styles.segment,
            styles.freeRide,
            selectedSegment === 'freeRide' && styles.segmentSelected,
          ]}
          onPress={() => onSegmentPress('freeRide')}
          accessible
          accessibilityRole="button"
          accessibilityState={{ selected: selectedSegment === 'freeRide' }}
          accessibilityLabel="Free Ride filter"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.segmentText}>Start Ride</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.9}
          style={[
            styles.segment,
            styles.recent,
            selectedSegment === 'recent' && styles.segmentSelected,
            { marginLeft: 12 },
          ]}
          onPress={() => onSegmentPress('recent')}
          accessible
          accessibilityRole="button"
          accessibilityState={{ selected: selectedSegment === 'recent' }}
          accessibilityLabel="Recent filter"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.segmentText}>Recent</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0f10' },
  topBar: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftIcon: { marginRight: 8 },
  rightIcons: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  dot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  segmentContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 200,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  segment: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  segmentSelected: {
    shadowOpacity: 0.5,
    elevation: 10,
  },
  freeRide: { backgroundColor: '#FF7DA4' },
  recent: { backgroundColor: '#F2B270' },
  segmentText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});

export default memo(UserMapView);
