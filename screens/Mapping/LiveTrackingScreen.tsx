import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useBackgroundRideTracker } from '../../components/backgroundServices';
import { saveRide } from '../../services/RideStorage';
import MapViewTracker from '../../components/MapViewTracker';
import RideStatsCard from '../../components/RideStatsCard';
import SettingsModal from '../../components/Modals/SettingsModal';
import NotificationsModal from '../../components/Modals/NotificationsModal';

import Feather from 'react-native-vector-icons/Feather';
import { getActiveHorse } from '../../services/HorseStorage';
import { useFocusEffect, useNavigation, CommonActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { startLocationBroadcast, stopLocationBroadcast } from '../../services/OnlineUserService';
import { Alert, Linking } from 'react-native';

const { width } = Dimensions.get('window');

const LiveTrackingScreen = ({ navigation }: { navigation: any }) => {
  // Background-capable ride tracker with persistent state
  const {
    rideData,
    status,
    currentSpeed,
    startRide,
    stopRide,
    isBackgroundEnabled,
    error,
  } = useBackgroundRideTracker();

  const [isConfirmingStart, setIsConfirmingStart] = useState(false);

  const [activeHorseName, setActiveHorseName] = useState<string | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);

  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();

  // Derive riding state from background tracker status
  const isRiding = status === 'active_foreground' || status === 'active_background';
  const isInBackground = status === 'active_background';

  // Animation states
  const pulseAnim = useState(new Animated.Value(1))[0];
  const scaleAnim = useState(new Animated.Value(0.95))[0];

  useEffect(() => {
    startLocationBroadcast({ isRiding: false });
    return () => {
      stopLocationBroadcast();
    };
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        const horse = await getActiveHorse();
        setActiveHorseName(horse?.name || null);
      })();
    }, [])
  );

  const handleStart = async () => {
    const horse = await getActiveHorse();
    if (!horse) {
      Alert.alert(
        'No Horse Selected',
        'Please select a horse before starting your ride.',
        [
          {
            text: 'Select Horse',
            onPress: () => navigation.navigate('SelectHorse'),
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      
      );
      return;
    }

    try {
      // Start ride with background tracking and horse information
      const success = await startRide(horse.id, horse.name);
      
      if (!success) {
        // Handle permission or initialization errors
        Alert.alert(
          'Failed to Start Ride',
          error || 'Could not start location tracking. Please check permissions.',
          [
            {
              text: 'Check Permissions',
              onPress: () => Linking.openSettings(),
            },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }

      // Start online location broadcast with riding status
      startLocationBroadcast({ isRiding: true });
    } catch (e) {
      console.error('Failed to start ride:', e);
      Alert.alert(
        'Error',
        'An unexpected error occurred while starting the ride.'
      );
    }
  };

  const handleStop = async () => {
    Alert.alert(
      'End Ride?',
      'Are you sure you want to end this ride?',
      [
        { text: 'Continue Riding', style: 'cancel' },
        {
          text: 'End Ride',
          style: 'destructive',
          onPress: async () => {
            stopLocationBroadcast();
            
            const finalRide = await stopRide();
            
            if (finalRide) {
              await saveRide(finalRide);
              navigation.navigate('RideReviewScreen', { ride: finalRide });
            }
          },
        },
      ]
    );
  };

  const handleOpenSettings = () => {
    setSettingsVisible(true);
  };

  const handleOpenNotifications = () => {
    setNotificationsVisible(true);
  };

  return (
    <>
      <View style={styles.container}>
        {/* Background Status Banner */}
        {isInBackground && (
          <View style={styles.backgroundBanner}>
            <Feather name="navigation" size={16} color="#fff" />
            <Text style={styles.backgroundText}>
              Ride tracking in background
            </Text>
          </View>
        )}

        {/* Permission Warning Banner */}
        {!isBackgroundEnabled && !isRiding && (
          <View style={styles.warningBanner}>
            <Feather name="alert-circle" size={16} color="#ff9500" />
            <Text style={styles.warningText}>
              Background tracking disabled. Enable for best experience.
            </Text>
            <TouchableOpacity
              onPress={() => Linking.openSettings()}
              style={styles.warningButton}
            >
              <Text style={styles.warningButtonText}>Enable</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={StyleSheet.absoluteFillObject}>
          <MapViewTracker
            path={rideData?.snappedPath ?? rideData?.path}
            nearestTrail={rideData?.nearestTrail}
            snappedCoordinate={rideData?.snappedCoordinate ?? null}
            snapRadius={rideData?.snapRadius ?? null}
          />
        </View>

        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <LinearGradient
            colors={['rgba(16, 185, 129, 0.15)', 'transparent', 'rgba(59, 130, 246, 0.15)']}
            style={StyleSheet.absoluteFillObject}
          />
        </View>

        <LinearGradient
          colors={['rgba(15, 23, 42, 0.0)', 'transparent']}
          style={styles.topGradient}
          pointerEvents="none"
        />
        <View style={[styles.topIcons, { paddingTop: insets.top + 45 }]}>
          <TouchableOpacity activeOpacity={0.7} onPress={handleOpenSettings}>
            <Feather name="settings" size={27} color="#374151" />
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} onPress={handleOpenNotifications}>
            <Feather name="bell" size={27} color="#374151" />
          </TouchableOpacity>
        </View>

        {isRiding ? (
          <>
            <Animated.View
              style={[
                styles.rideActiveContainer,
                {
                  bottom: insets.bottom + 20,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              <BlurView intensity={100} tint="dark" style={styles.statsCardContainer}>
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.05)']}
                  style={styles.statsGradient}
                >
                  <View style={styles.statsHeader}>
                    <Text style={styles.statsTitle}>Active Ride</Text>
                    <View style={styles.recordingBadge}>
                      <Animated.View
                        style={[
                          styles.recordingDot,
                          { transform: [{ scale: pulseAnim }] },
                        ]}
                      />
                      <Text style={styles.recordingText}>Recording</Text>
                    </View>
                  </View>

                  {rideData && (
                    <View style={styles.statsGrid}>
                      <View style={styles.statItem}>
                        <Text style={[styles.statValue, styles.statValueEmerald]}>
                          {(rideData.totalDistance / 1000).toFixed(2)}
                        </Text>
                        <Text style={styles.statLabel}>kilometers</Text>
                      </View>
                      <View style={[styles.statItem, styles.statItemBorder]}>
                        <Text style={[styles.statValue, styles.statValueOrange]}>
                          {currentSpeed.toFixed(1)}
                        </Text>
                        <Text style={styles.statLabel}>km/h</Text>
                      </View>
                      <View style={[styles.statItem, styles.statItemBorder]}>
                        <Text style={[styles.statValue, styles.statValueBlue]}>
                          {rideData.elevationGain.toFixed(0)}
                        </Text>
                        <Text style={styles.statLabel}>elevation</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={[styles.statValue, styles.statValuePurple]}>
                          {Math.floor(rideData.duration / 60000)}
                        </Text>
                        <Text style={styles.statLabel}>minutes</Text>
                      </View>
                    </View>
                  )}
                </LinearGradient>
              </BlurView>

              <TouchableOpacity
                style={styles.stopButton}
                onPress={handleStop}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={['#f43f5e', '#dc2626', '#f43f5e']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.stopButtonGradient}
                >
                  <Text style={styles.stopButtonText}>Stop Ride</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity
              style={[styles.reportObstacleButton, { bottom: insets.bottom + 240 }]}
              activeOpacity={0.9}
              onPress={() =>
                navigation.navigate('MarkObstacle', {
                  location:
                    rideData?.path && rideData.path.length > 0
                      ? {
                          latitude: rideData.path[rideData.path.length - 1].latitude,
                          longitude: rideData.path[rideData.path.length - 1].longitude,
                        }
                      : undefined,
                })
              }
            >
              <LinearGradient
                colors={['#f59e0b', '#ea580c']}
                style={styles.obstacleButtonGradient}
              >
                <Feather name="alert-triangle" size={28} color="white" />
              </LinearGradient>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={[styles.actionRow, { bottom: insets.bottom + 80 }]}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setIsConfirmingStart(true)}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={['#10b981', '#14b8a6', '#06b6d4']}
                  style={styles.actionButtonGradient}
                >
                  <View style={styles.actionButtonInner}>
                    <Feather name="navigation" size={24} color="white" />
                    <Text style={styles.actionButtonText}>Free Ride</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('SelectHorse')}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={['#8b5cf6', '#a855f7', '#d946ef']}
                  style={styles.actionButtonGradient}
                >
                  <View style={styles.actionButtonInner}>
                    <Feather name="award" size={24} color="white" />
                    <Text style={styles.actionButtonText}>Select Horse</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  const parent = navigation.getParent();
                  if (parent) {
                    parent.navigate('Analytics' as never);
                  }
                }}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={['#3b82f6', '#6366f1', '#8b5cf6']}
                  style={styles.actionButtonGradient}
                >
                  <View style={styles.actionButtonInner}>
                    <Feather name="clock" size={24} color="white" />
                    <Text style={styles.actionButtonText}>Recent</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <View style={[styles.activeHorseBar, { bottom: insets.bottom + 12 }]}>
              <BlurView intensity={80} tint="dark" style={styles.activeHorseBlur}>
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
                  style={styles.activeHorseGradient}
                >
                  <Text style={styles.activeHorseText}>
                    Active horse:{' '}
                    <Text style={styles.activeHorseName}>
                      {activeHorseName || 'None selected'}
                    </Text>
                  </Text>
                </LinearGradient>
              </BlurView>
            </View>
            {/* Start/Cancel confirmation */}
            {isConfirmingStart && (
              <View style={[styles.confirmBar, { bottom: insets.bottom + 20 }]}>
                <BlurView intensity={100} tint="dark" style={styles.confirmBlur}>
                  <View style={styles.confirmRow}>
                    <TouchableOpacity
                      style={[styles.confirmBtn, styles.cancelBtn]}
                      onPress={() => setIsConfirmingStart(false)}
                      activeOpacity={0.9}
                    >
                      <LinearGradient colors={["#ef4444", "#dc2626"]} style={styles.confirmBtnGradient}>
                        <Feather name="x" size={18} color="white" />
                        <Text style={styles.confirmText}>Cancel</Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.confirmBtn, styles.startBtn]}
                      onPress={async () => {
                        setIsConfirmingStart(false);
                        await handleStart();
                      }}
                      activeOpacity={0.9}
                    >
                      <LinearGradient colors={["#10b981", "#14b8a6"]} style={styles.confirmBtnGradient}>
                        <Feather name="play" size={18} color="white" />
                        <Text style={styles.confirmText}>Start</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </BlurView>
              </View>
            )}
          </>
        )}
      </View>

      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        onRequestFullSettings={() => {
          const parent = nav.getParent();
          if (parent) {
            parent.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [
                  {
                    name: 'ProfileStack' as never,
                    state: {
                      index: 1,
                      routes: [
                        { name: 'ProfileMain' as never } as any,
                        { name: 'Settings' as never } as any,
                      ],
                    },
                  } as any,
                ],
              })
            );
          } else {
            nav.navigate('ProfileStack' as never, { screen: 'Settings' } as never);
          }
        }}
      />
      <NotificationsModal
        visible={notificationsVisible}
        onClose={() => setNotificationsVisible(false)}
        onRequestNotificationsScreen={() =>
          nav.navigate('ProfileStack' as never, { screen: 'Notifications' } as never)
        }
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  topIcons: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 16,
    zIndex: 20,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  rideActiveContainer: {
    position: 'absolute',
    left: 24,
    right: 24,
    gap: 16,
  },
  statsCardContainer: {
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  statsGradient: {
    padding: 24,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    gap: 6,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  recordingText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6ee7b7',
  },
  statsGrid: {
    flexDirection: 'row',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statItemBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 4,
  },
  statValueEmerald: {
    color: '#6ee7b7',
  },
  statValueOrange: {
    color: '#fdba74',
  },
  statValueBlue: {
    color: '#93c5fd',
  },
  statValuePurple: {
    color: '#d8b4fe',
  },
  statLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stopButton: {
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  stopButtonGradient: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  stopButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  reportObstacleButton: {
    position: 'absolute',
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  obstacleButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.3)',
  },
  actionRow: {
    position: 'absolute',
    left: 24,
    right: 24,
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  actionButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  actionButtonInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  activeHorseBar: {
    position: 'absolute',
    left: 24,
    right: 24,
    borderRadius: 20,
    overflow: 'hidden',
  },
  activeHorseBlur: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  activeHorseGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  activeHorseText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '600',
  },
  activeHorseName: {
    color: '#6ee7b7',
    fontWeight: 'bold',
  },
  // Confirmation styles
  confirmBar: {
    position: 'absolute',
    left: 24,
    right: 24,
  },
  confirmBlur: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  confirmBtn: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  confirmBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  confirmText: {
    color: 'white',
    fontWeight: 'bold',
  },
  cancelBtn: {},
  startBtn: {},
  // Dev utilities
  devRow: {
    position: 'absolute',
    left: 24,
    right: 24,
  },
  devButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  devButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  devButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 12,
  },
  // Background status banner
  backgroundBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#4A90E2',
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 100,
    gap: 8,
  },
  backgroundText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Permission warning banner
  warningBanner: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 149, 0, 0.9)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 99,
    gap: 8,
  },
  warningText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  warningButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  warningButtonText: {
    color: '#ff9500',
    fontSize: 12,
    fontWeight: '700',
  },
});

export default LiveTrackingScreen;