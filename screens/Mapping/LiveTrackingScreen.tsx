import React, { useState } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet, Text, Platform, useColorScheme } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import useRideTracker from '../../hooks/useRideTracker';
import { saveRide } from '../../services/RideStorage';
import MapViewTracker from '../../components/MapViewTracker';
import RideStatsCard from '../../components/RideStatsCard';
import { Feather } from '@expo/vector-icons';
import TrailPreviews from '../../components/TrailPreviews';
import { getActiveHorse } from '../../services/HorseStorage';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';

const LiveTrackingScreen = ({ navigation }: { navigation: any }) => {
  const { rideData, startRide, stopRide } = useRideTracker();
  const [isRiding, setIsRiding] = useState(false);
  const [activeHorseName, setActiveHorseName] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];

  const rideActions = [
    {
      key: 'free',
      label: 'Free Ride',
      color: palette.rideFree,
      icon: 'navigation' as const,
      onPress: () => handleStart(),
    },
    {
      key: 'horse',
      label: 'Select Horse',
      color: palette.rideSelect,
      icon: 'award' as const,
      onPress: () => navigation.navigate('SelectHorse'),
    },
    {
      key: 'recent',
      label: 'Recent',
      color: palette.rideRecent,
      icon: 'clock' as const,
      onPress: () => navigation.navigate('Analytics'),
    },
  ];

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        const horse = await getActiveHorse();
        setActiveHorseName(horse?.name || null);
      })();
    }, [])
  );

  const handleStart = async () => {
    // Enforce horse selection before ride start
    const horse = await getActiveHorse();
    if (!horse) {
      navigation.navigate('SelectHorse');
      return;
    }
    setIsRiding(true);
    try {
      await startRide();
    } catch (e) {
      console.warn(e);
      setIsRiding(false);
    }
  };

  const handleStop = async () => {
  const finalRide = stopRide();
  if (finalRide) {
    await saveRide(finalRide);
    navigation.navigate('RideReviewScreen', { ride: finalRide });
  }
  setIsRiding(false);
};

  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFillObject}>
        <MapViewTracker path={rideData?.path} />
      </View>

      {/* Top overlay */}
      <LinearGradient
        colors={[palette.gradientPrimaryStart + 'D9', 'transparent']}
        style={styles.topGradient}
        pointerEvents="none"
      />
      <View style={styles.header} pointerEvents="box-none">
        <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.iconButton}>
          <Feather name="settings" size={28} color="white" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.iconButton}>
          <Feather name="bell" size={28} color="white" />
        </TouchableOpacity>
      </View>

      {/* Bottom overlay / controls */}
      <LinearGradient
        colors={['transparent', palette.mapOverlay]}
        style={styles.bottomGradient}
        pointerEvents="none"
      />
  {isRiding ? (
        <>
          <View
            style={[
              styles.rideActiveContainer,
              {
                bottom: insets.bottom + 210,
                backgroundColor: palette.mapOverlay,
              },
            ]}
            pointerEvents="box-none"
          >
            {rideData && (
              <View
                style={[
                  styles.statsCardWrap,
                  {
                    backgroundColor: palette.cardElevated,
                    shadowColor: palette.shadowStrong,
                  },
                ]}
              >
                <RideStatsCard
                  title="Current Ride"
                  distance={rideData.totalDistance}
                  elevation={rideData.elevationGain}
                  durationMs={rideData.duration}
                />
              </View>
            )}
            <TouchableOpacity
              style={[styles.button, styles.stopButton, { backgroundColor: palette.rideStop }]}
              onPress={handleStop}
            >
              <Text style={styles.buttonText}>Stop Ride</Text>
            </TouchableOpacity>
          </View>
          {/* Floating obstacle report button */}
          <TouchableOpacity
            style={[
              styles.reportObstacleButton,
              {
                bottom: insets.bottom + 340,
                backgroundColor: palette.caution,
                shadowColor: palette.shadowStrong,
              },
            ]}
            onPress={() => navigation.navigate('MarkObstacle', {
              location: rideData?.path && rideData.path.length > 0
                ? {
                    latitude: rideData.path[rideData.path.length - 1].latitude,
                    longitude: rideData.path[rideData.path.length - 1].longitude,
                  }
                : undefined
            })}
          >
            <Feather name="alert-triangle" size={28} color="white" />
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View
            style={[
              styles.previewContainer,
              { bottom: insets.bottom + 320 },
            ]}
            pointerEvents="box-none"
          >
            <TrailPreviews />
          </View>
          <View
            style={[
              styles.actionRow,
              { bottom: insets.bottom + 240 },
            ]}
            pointerEvents="box-none"
          >
            {rideActions.map((action) => (
              <TouchableOpacity
                key={action.key}
                style={[styles.actionButton, { backgroundColor: action.color }]}
                onPress={action.onPress}
                activeOpacity={0.85}
              >
                <Feather name={action.icon} size={22} color={palette.onPrimary} style={styles.actionIcon} />
                <Text style={[styles.actionLabel, { color: palette.onPrimary }]}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {activeHorseName ? (
            <View
              style={[
                styles.activeHorseBar,
                {
                  bottom: insets.bottom + 170,
                  backgroundColor: palette.mapOverlay,
                },
              ]}
            >
              <Text style={styles.activeHorseText}>Active horse: {activeHorseName}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.activeHorseBar,
                {
                  bottom: insets.bottom + 170,
                  backgroundColor: palette.mapOverlay,
                },
              ]}
              onPress={() => navigation.navigate('SelectHorse')}
              activeOpacity={0.8}
            >
              <Text style={styles.activeHorseText}>No horse selected • Tap to choose</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
  },
  header: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 1,
  },
  iconButton: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: 8,
    borderRadius: 30,
  },
  previewContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingVertical: 10,
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 220,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginHorizontal: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  rideActiveContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingBottom: 30,
    paddingHorizontal: 20,
    gap: 18,
  },
  statsCardWrap: {
    borderRadius: 24,
    padding: 12,
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 8,
  },
  stopButton: {
    marginHorizontal: 20,
    marginTop: 8,
  },
  actionRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 24,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 6,
  },
  actionIcon: {
    marginBottom: 6,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  activeHorseBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  activeHorseText: {
    color: '#fff',
    fontWeight: '600',
  },
  reportObstacleButton: {
    position: 'absolute',
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
});

export default LiveTrackingScreen;
