import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet, Text, Platform, useColorScheme, Alert } from 'react-native';
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
import MapTypeModal from '../../components/MapTypeModal';
import { useUnits } from '../../hooks/useUnits';
import type { ObstacleSeverity } from '../../services/Data';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const LiveTrackingScreen = ({ navigation }: { navigation: any }) => {
  const { rideData, startRide, stopRide, currentSpeed } = useRideTracker();
  const [isRiding, setIsRiding] = useState(false);
  const [activeHorseName, setActiveHorseName] = useState<string | null>(null);
  const [mapTypeModalVisible, setMapTypeModalVisible] = useState(false);
  const [currentMapType, setCurrentMapType] = useState<'standard' | 'satellite' | 'hybrid' | 'terrain'>('standard');
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];
  const { isMetric, toggle } = useUnits();
  const [showSevereOnly, setShowSevereOnly] = useState(false);

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

  // Navigation guard to prevent accidental ride abandonment
  useEffect(() => {
    const beforeRemove = (e: any) => {
      if (!isRiding) return;
      e.preventDefault();
      Alert.alert(
        'Ride in Progress',
        'You have an active ride. Do you want to stop and save it before leaving?',
        [
          { text: 'Continue Riding', style: 'cancel' },
          {
            text: 'Discard Ride',
            style: 'destructive',
            onPress: () => {
              stopRide();
              setIsRiding(false);
              navigation.dispatch(e.data.action);
            },
          },
          {
            text: 'Stop & Save',
            style: 'default',
            onPress: async () => {
              await handleStop();
              navigation.dispatch(e.data.action);
            },
          },
        ]
      );
    };

    const unsubscribe = navigation.addListener('beforeRemove', beforeRemove);
    return unsubscribe;
  }, [isRiding, navigation]);

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

  const handleMapTypeSelect = (type: 'standard' | 'satellite' | 'hybrid' | 'terrain') => {
    setCurrentMapType(type);
  };

  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFillObject}>
        <MapViewTracker 
          path={rideData?.path} 
          mapType={currentMapType} 
          nearestTrail={rideData?.nearestTrail}
          obstacleFilters={{
            severities: showSevereOnly ? (['high', 'critical'] as ObstacleSeverity[]) : [],
            showResolved: false,
          }}
        />
      </View>

      {/* Top overlay */}
      <LinearGradient
        colors={[palette.gradientPrimaryStart + 'D9', 'transparent']}
        style={styles.topGradient}
        pointerEvents="none"
      />
      <View style={styles.header} pointerEvents="box-none">
        <TouchableOpacity onPress={() => setMapTypeModalVisible(true)} style={styles.iconButton}>
          <Feather name="map" size={28} color="white" />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            onPress={() => navigation.navigate('OnlineUsers')} 
            style={styles.iconButton}
          >
            <Feather name="users" size={28} color="white" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => navigation.navigate('ProfileStack', { screen: 'Notifications' })} 
            style={styles.iconButton}
          >
            <Feather name="bell" size={28} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Map Type Modal */}
      <MapTypeModal
        visible={mapTypeModalVisible}
        onClose={() => setMapTypeModalVisible(false)}
        onSelectMapType={handleMapTypeSelect}
        currentMapType={currentMapType}
      />

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
                  speedKmh={currentSpeed}
                  isMetric={isMetric}
                />
              </View>
            )}
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, { backgroundColor: palette.cardElevated }]}
                onPress={toggle}
                activeOpacity={0.85}
              >
                <Text style={[styles.toggleBtnText, { color: palette.onSurface }]}>
                  Units: {isMetric ? 'km/h' : 'mph'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, { backgroundColor: palette.cardElevated }]}
                onPress={() => setShowSevereOnly((v) => !v)}
                activeOpacity={0.85}
              >
                <Text style={[styles.toggleBtnText, { color: palette.onSurface }]}>
                  {showSevereOnly ? 'Filter: High+' : 'Filter: All'}
                </Text>
              </TouchableOpacity>
            </View>
            {rideData?.path && rideData.path.length > 1 && (
              <TouchableOpacity
                style={[styles.toggleBtn, { backgroundColor: palette.cardElevated, marginHorizontal: 20 }]}
                onPress={async () => {
                  try {
                    const name = `ride-${rideData.startTime}.gpx`;
                    const baseDir = ((FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || '') as string;
                    const uri = baseDir + name;
                    const fmt = (n: number) => (n < 10 ? `0${n}` : `${n}`);
                    const date = new Date(rideData.startTime);
                    const dateName = `${date.getFullYear()}-${fmt(date.getMonth() + 1)}-${fmt(date.getDate())}`;
                    const trkSeg = rideData.path
                      .map((p) => `<trkpt lat="${p.latitude}" lon="${p.longitude}"><ele>${p.altitude || 0}</ele><time>${new Date(p.timestamp).toISOString()}</time></trkpt>`) 
                      .join('');
                    const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="WIL_App" xmlns="http://www.topografix.com/GPX/1/1">\n<trk>\n<name>Ride ${dateName}</name>\n<trkseg>${trkSeg}</trkseg>\n</trk>\n</gpx>`;
                    await FileSystem.writeAsStringAsync(uri, gpx);
                    await Sharing.shareAsync(uri, { mimeType: 'application/gpx+xml', dialogTitle: 'Export GPX' });
                  } catch (e) {
                    Alert.alert('Export Failed', 'Could not export GPX.');
                  }
                }}
                activeOpacity={0.9}
              >
                <Text style={[styles.toggleBtnText, { color: palette.onSurface }]}>Export GPX</Text>
              </TouchableOpacity>
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
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  previewContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingVertical: 10,
    backgroundColor: 'transparent',
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
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 8,
  },
  toggleBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default LiveTrackingScreen;
