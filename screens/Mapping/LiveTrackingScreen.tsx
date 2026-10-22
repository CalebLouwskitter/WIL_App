import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Animated, Dimensions, PanResponder } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import { useBackgroundRideTracker } from '../../components/backgroundServices';
import { archiveEndedDraft } from '../../services/RideArchive';
import MapViewTracker from '../../components/MapViewTracker';
import RideStatsCard from '../../components/RideStatsCard';
import SettingsModal from '../../components/Modals/SettingsModal';
import NotificationsModal from '../../components/Modals/NotificationsModal';
import { useRideRecovery } from '../../contexts/RideRecoveryContext';
import { isWithinAuthorizedArea } from '../../utils/geofencing';

import Feather from 'react-native-vector-icons/Feather';
import { FontAwesome5 as FAIcon } from '@expo/vector-icons';
import { getActiveHorse } from '../../services/HorseStorage';
import { useFocusEffect, useNavigation, CommonActions, useRoute } from '@react-navigation/native';
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
    persistWarning,
  } = useBackgroundRideTracker();

  const [isConfirmingStart, setIsConfirmingStart] = useState(false);

  const [activeHorseName, setActiveHorseName] = useState<string | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [userHeading, setUserHeading] = useState<number | null>(null);
  const [bottomSheetExpanded, setBottomSheetExpanded] = useState(false);

  const insets = useSafeAreaInsets();
  const bottomSheetAnim = useRef(new Animated.Value(0)).current;
  const route = useRoute<any>();
  const followSosDisplayName: string | undefined = route?.params?.followSosDisplayName;
  const followSosUid: string | undefined = route?.params?.followSosUid;
  const autoStartedRef = useRef(false);

  const nav = useNavigation<any>();
  
  // Ride recovery context
  const { hasRecoverableRide, isResumed, clearRecoveryState, checkForRecoverableRide } = useRideRecovery();

  // Derive riding state from background tracker status
  const isRiding = status === 'active_foreground' || status === 'active_background';
  const isInBackground = status === 'active_background';

  // Animation states
  const pulseAnim = useState(new Animated.Value(1))[0];
  const scaleAnim = useState(new Animated.Value(0.95))[0];
  const confirmSlideAnim = useState(new Animated.Value(100))[0];
  const confirmFadeAnim = useState(new Animated.Value(0))[0];

  // Pan responder for bottom sheet drag
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0 && bottomSheetExpanded) {
          // Dragging down when expanded
          bottomSheetAnim.setValue(-gestureState.dy);
        } else if (gestureState.dy < 0 && !bottomSheetExpanded) {
          // Dragging up when collapsed
          bottomSheetAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dy) > 50) {
          // Threshold for toggle
          if (gestureState.dy > 0 && bottomSheetExpanded) {
            // Swiped down - collapse
            toggleBottomSheet(false);
          } else if (gestureState.dy < 0 && !bottomSheetExpanded) {
            // Swiped up - expand
            toggleBottomSheet(true);
          } else {
            // Return to current state
            Animated.spring(bottomSheetAnim, {
              toValue: bottomSheetExpanded ? 300 : 0,
              useNativeDriver: false,
            }).start();
          }
        } else {
          // Return to current state
          Animated.spring(bottomSheetAnim, {
            toValue: bottomSheetExpanded ? 300 : 0,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const toggleBottomSheet = (expand: boolean) => {
    setBottomSheetExpanded(expand);
    Animated.spring(bottomSheetAnim, {
      toValue: expand ? 300 : 0,
      tension: 50,
      friction: 8,
      useNativeDriver: false,
    }).start();
  };

  useEffect(() => {
    startLocationBroadcast({ isRiding: false });
    return () => {
      stopLocationBroadcast();
    };
  }, []);

  // Auto-start a ride when navigated with autoStart flag
  useEffect(() => {
    const shouldAutoStart = route?.params?.autoStart === true;
    if (shouldAutoStart && !isRiding && !autoStartedRef.current) {
      autoStartedRef.current = true;
      // bypass UI confirmation and trigger the same start flow
      handleStart();
    }
  }, [route?.params?.autoStart, isRiding]);

  // Track device heading/compass when riding (only in foreground)
  useEffect(() => {
    let headingSubscription: any = null;
    
    const startHeadingTracking = async () => {
      if (!isRiding) {
        setUserHeading(null);
        return;
      }
      
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        
        headingSubscription = await Location.watchHeadingAsync((heading: Location.LocationHeadingObject) => {
          // heading.magHeading is the magnetic heading in degrees (0-360)
          // 0/360 = North, 90 = East, 180 = South, 270 = West
          setUserHeading(heading.magHeading);
        });
      } catch (error) {
        console.warn('Failed to start heading tracking:', error);
      }
    };
    
    startHeadingTracking();
    
    return () => {
      if (headingSubscription) {
        headingSubscription.remove();
      }
    };
  }, [isRiding]);

  // Show resume banner when ride is resumed
  useEffect(() => {
    if (isResumed && isRiding) {
      setShowResumeBanner(true);
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        setShowResumeBanner(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isResumed, isRiding]);

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
      // Check if user is within authorized boundary before starting ride
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const isInBounds = isWithinAuthorizedArea({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });

      if (!isInBounds) {
        Alert.alert(
          'Outside Authorized Area',
          'You must be within the designated trail area to start a ride. Please move to the trail system before starting.',
          [{ text: 'OK', style: 'cancel' }]
        );
        return;
      }

      // Start ride with background tracking and horse information
      const result = await startRide(horse.id, horse.name);

      if (!result.ok) {
        // Handle permission or initialization errors
        Alert.alert(
          'Failed to Start Ride',
          result.error || 'Could not start location tracking. Please check permissions.',
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
            await stopRide();
            await finishRide();
          },
        },
      ]
    );
  };

  // Save the ended ride to history. The recording stays on the device until
  // this succeeds, so a failure can be retried here or at the next launch.
  const finishRide = async () => {
    try {
      const result = await archiveEndedDraft();
      if (result.status === 'active') {
        throw new Error('The ride could not be ended.');
      }
      // Clear recovery state since ride is complete
      clearRecoveryState();
      if (result.status === 'archived') {
        navigation.navigate('RideReviewScreen', { rideData: result.ride, rideId: result.ride.id });
      }
    } catch (e) {
      console.error('Failed to save ride:', e);
      Alert.alert(
        'Ride Not Saved Yet',
        'Your ride is still stored on this device but could not be added to Ride History.',
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Retry',
            onPress: async () => {
              await stopRide();
              await finishRide();
            },
          },
        ]
      );
    }
  };

  const handleOpenSettings = () => {
    setSettingsVisible(true);
  };

  const handleOpenNotifications = () => {
    setNotificationsVisible(true);
  };

  const handleManualResumeCheck = async () => {
    try {
      // Re-check for recoverable rides; RideRecoveryHandler shows the
      // resume / save / discard prompt when one is found
      const kind = await checkForRecoverableRide();

      if (kind !== 'active' && kind !== 'stale') {
        Alert.alert('No Interrupted Rides', 'No interrupted rides found to resume.');
      }
    } catch (error) {
      console.error('Manual resume check failed:', error);
      Alert.alert('Error', 'Failed to check for interrupted rides.');
    }
  };

  const getCardinalDirection = (heading: number): string => {
    if (heading >= 337.5 || heading < 22.5) return 'N';
    if (heading >= 22.5 && heading < 67.5) return 'NE';
    if (heading >= 67.5 && heading < 112.5) return 'E';
    if (heading >= 112.5 && heading < 157.5) return 'SE';
    if (heading >= 157.5 && heading < 202.5) return 'S';
    if (heading >= 202.5 && heading < 247.5) return 'SW';
    if (heading >= 247.5 && heading < 292.5) return 'W';
    if (heading >= 292.5 && heading < 337.5) return 'NW';
    return 'N';
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

        {/* Persistence Warning Banner */}
        {isRiding && persistWarning && (
          <View style={styles.warningBanner}>
            <Feather name="alert-triangle" size={16} color="#ff9500" />
            <Text style={styles.warningText}>{persistWarning}</Text>
          </View>
        )}

        {/* Resume Ride Banner */}
        {showResumeBanner && (
          <View style={styles.resumeBanner}>
            <Feather name="rotate-ccw" size={16} color="#fff" />
            <Text style={styles.resumeText}>
              Ride resumed successfully
            </Text>
            <TouchableOpacity onPress={() => setShowResumeBanner(false)}>
              <Feather name="x" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        <View style={StyleSheet.absoluteFill}>
          <MapViewTracker
            path={rideData?.snappedPath ?? rideData?.path}
            nearestTrail={rideData?.nearestTrail}
            snappedCoordinate={rideData?.snappedCoordinate ?? null}
            snapRadius={rideData?.snapRadius ?? null}
            followUserDisplayName={followSosDisplayName}
            followUserUid={followSosUid}
          />
        </View>

        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <LinearGradient
            colors={['rgba(16, 185, 129, 0.15)', 'transparent', 'rgba(59, 130, 246, 0.15)']}
            style={StyleSheet.absoluteFill}
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
              <BlurView intensity={80} tint="light" style={styles.statsCardContainer}>
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
              style={[styles.reportButton, { top: insets.top + 100 }]}
              activeOpacity={0.9}
              onPress={() =>
                navigation.navigate('DuringRideScreen', {
                  rideData: rideData,
                  rideId: rideData?.id,
                  initialTab: 'report',
                })
              }
            >
              <BlurView intensity={60} tint="light" style={styles.reportButtonBlur}>
                <View style={styles.reportButtonInner}>
                  <Feather name="alert-triangle" size={20} color="#EA580C" />
                  <Text style={styles.reportButtonText}>Report</Text>
                </View>
              </BlurView>
            </TouchableOpacity>

            {/* Compass/Heading Indicator */}
            {userHeading !== null && (
              <View style={[styles.compassContainer, { top: insets.top + 170 }]}>
                <BlurView intensity={60} tint="light" style={styles.compassBlur}>
                  <LinearGradient
                    colors={['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.08)']}
                    style={styles.compassGradient}
                  >
                    <Animated.View
                      style={[
                        styles.compassIcon,
                        { transform: [{ rotate: `${userHeading}deg` }] }
                      ]}
                    >
                      <Feather name="navigation" size={20} color="#059669" />
                    </Animated.View>
                    <Text style={styles.compassText}>
                      {getCardinalDirection(userHeading)}
                    </Text>
                    <Text style={styles.compassDegrees}>{Math.round(userHeading)}°</Text>
                  </LinearGradient>
                </BlurView>
              </View>
            )}
          </>
        ) : (
          <>
            {/* Bottom Sheet */}
            <Animated.View
              style={[
                styles.bottomSheet,
                {
                  bottom: bottomSheetAnim.interpolate({
                    inputRange: [0, 300],
                    outputRange: [-250, 0],
                  }),
                },
              ]}
            >
              <BlurView intensity={80} tint="light" style={styles.bottomSheetBlur}>
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.05)']}
                  style={styles.bottomSheetGradient}
                >
                  {/* Drag Handle */}
                  <View {...panResponder.panHandlers} style={styles.dragHandleContainer}>
                    <View style={styles.dragHandle} />
                  </View>

                  {/* Active Horse Display */}
                  <TouchableOpacity
                    style={styles.horseSelector}
                    onPress={() => {
                      navigation.navigate('SelectHorse');
                      toggleBottomSheet(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <FAIcon name="horse" size={18} color="#2C5530" />

                    <View style={styles.horseSelectorText}>
                      <Text style={styles.horseSelectorLabel}>Active Horse</Text>
                      <Text style={styles.horseSelectorValue}>
                        {activeHorseName || 'Tap to select'}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={20} color="#6B7280" />
                  </TouchableOpacity>

                  {/* Manual Resume Button */}
                  {hasRecoverableRide && !isRiding && (
                    <TouchableOpacity
                      style={styles.resumeRideButton}
                      onPress={() => {
                        handleManualResumeCheck();
                        toggleBottomSheet(false);
                      }}
                      activeOpacity={0.9}
                    >
                      <LinearGradient
                        colors={['rgba(16, 185, 129, 0.3)', 'rgba(16, 185, 129, 0.2)']}
                        style={styles.resumeRideGradient}
                      >
                        <Feather name="rotate-ccw" size={18} color="#6ee7b7" />
                        <Text style={styles.resumeRideText}>Resume Interrupted Ride</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}

                  {/* Action Cards (Dashboard style) */}
                  <View style={styles.sheetWidgetsContainer}>
                    <TouchableOpacity
                      style={styles.sheetCard}
                      onPress={async () => {
                        toggleBottomSheet(false);
                        await handleStart();
                      }}
                      activeOpacity={0.9}
                    >
                      <View style={styles.sheetCardHeader}>
                        <View style={[styles.iconCircle, { backgroundColor: '#10b98120' }]}>
                          <Feather name="play" size={22} color="#10b981" />
                        </View>
                        <Text style={styles.sheetCardTitle}>Start Ride</Text>
                      </View>
                      <Text style={styles.sheetCardSubtitle}>Begin recording your ride immediately</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.sheetCard}
                      onPress={() => {
                        (navigation as any).navigate('ProfileStack', { screen: 'RideHistory', params: { fromMapping: true } });
                        toggleBottomSheet(false);
                      }}
                      activeOpacity={0.9}
                    >
                      <View style={styles.sheetCardHeader}>
                        <View style={[styles.iconCircle, { backgroundColor: '#3b82f620' }]}> 
                          <Feather name="clock" size={22} color="#3b82f6" />
                        </View>
                        <Text style={styles.sheetCardTitle}>Recent</Text>
                      </View>
                      <Text style={styles.sheetCardSubtitle}>View your latest rides and metrics</Text>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </BlurView>
            </Animated.View>

            {/* Enhanced Start/Cancel confirmation */}
            {isConfirmingStart && (
              <View style={styles.confirmOverlay}>
                <Animated.View 
                  style={[
                    styles.confirmBar, 
                    { 
                      opacity: confirmFadeAnim,
                      transform: [{ translateY: confirmSlideAnim }]
                    }
                  ]}
                >
                  <BlurView intensity={80} tint="light" style={styles.confirmBlur}>
                    <LinearGradient
                      colors={['rgba(255, 255, 255, 0.1)', 'rgba(175, 91, 91, 0.05)']}
                      style={styles.confirmGradientBg}
                    >
                      <View style={styles.confirmHeader}>
                        <Feather name="navigation" size={24} color="#059669" />
                        <Text style={styles.confirmTitle}>Start Your Ride?</Text>
                      </View>
                      {activeHorseName && (
                        <Text style={styles.confirmSubtitle}>
                          Recording ride with {activeHorseName}
                        </Text>
                      )}
                      <View style={styles.confirmRow}>
                        <TouchableOpacity
                          style={[styles.confirmBtn, styles.cancelBtn]}
                          onPress={() => {
                            Animated.parallel([
                              Animated.timing(confirmSlideAnim, {
                                toValue: 100,
                                duration: 200,
                                useNativeDriver: true,
                              }),
                              Animated.timing(confirmFadeAnim, {
                                toValue: 0,
                                duration: 200,
                                useNativeDriver: true,
                              }),
                            ]).start(() => setIsConfirmingStart(false));
                          }}
                          activeOpacity={0.9}
                        >
                          <LinearGradient 
                            colors={["#64748b", "#475569"]} 
                            style={styles.confirmBtnGradient}
                          >
                            <Feather name="x" size={20} color="white" />
                            <Text style={styles.confirmText}>Cancel</Text>
                          </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.confirmBtn, styles.startBtn]}
                          onPress={async () => {
                            Animated.parallel([
                              Animated.timing(confirmSlideAnim, {
                                toValue: 100,
                                duration: 200,
                                useNativeDriver: true,
                              }),
                              Animated.timing(confirmFadeAnim, {
                                toValue: 0,
                                duration: 200,
                                useNativeDriver: true,
                              }),
                            ]).start();
                            setIsConfirmingStart(false);
                            await handleStart();
                          }}
                          activeOpacity={0.9}
                        >
                          <LinearGradient 
                            colors={["#10b981", "#14b8a6", "#06b6d4"]} 
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.confirmBtnGradient}
                          >
                            <Feather name="play" size={20} color="white" />
                            <Text style={styles.confirmText}>Start Ride</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    </LinearGradient>
                  </BlurView>
                </Animated.View>
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
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  statsGradient: {
    padding: 20,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    gap: 6,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#059669',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 3,
  },
  recordingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
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
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  statValueEmerald: {
    color: '#059669',
  },
  statValueOrange: {
    color: '#EA580C',
  },
  statValueBlue: {
    color: '#3B82F6',
  },
  statValuePurple: {
    color: '#9333EA',
  },
  statLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stopButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  stopButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  stopButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  reportButton: {
    position: 'absolute',
    left: 24,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  reportButtonBlur: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  reportButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  reportButtonText: {
    color: '#EA580C',
    fontSize: 14,
    fontWeight: '700',
  },
  quickActionsRow: {
    position: 'absolute',
    left: 24,
    right: 24,
    flexDirection: 'row',
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    height: 64,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  quickActionButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  quickActionButtonInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  quickActionEmoji: {
    fontSize: 20,
  },
  quickActionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
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
  confirmOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.2)',
    zIndex: 200,
  },
  confirmBar: {
    width: '100%',
    maxWidth: 520,
  },
  confirmBlur: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
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
  // Resume ride banner
  resumeBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#10b981',
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 101,
    gap: 8,
  },
  resumeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  // Manual resume check button
  resumeCheckButton: {
    position: 'absolute',
    left: 24,
    right: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  resumeCheckBlur: {
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 16,
  },
  resumeCheckGradient: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  resumeCheckText: {
    color: '#6ee7b7',
    fontSize: 13,
    fontWeight: '600',
  },
  // Compass/Heading indicator styles
  compassContainer: {
    position: 'absolute',
    right: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  compassBlur: {
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  compassGradient: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 2,
  },
  compassIcon: {
    marginBottom: 2,
  },
  compassText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '700',
  },
  compassDegrees: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '600',
  },
  // Enhanced confirmation dialog styles
  confirmGradientBg: {
    padding: 20,
  },
  confirmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 8,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  confirmSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  sheetCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 10,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  sheetCardSubtitle: {
    fontSize: 10,
    color: '#6b7280',
    marginLeft: 0,
    marginTop: 2,
  },
  // Bottom Sheet Styles
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 300,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 20,
  },
  bottomSheetBlur: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
  },
  bottomSheetGradient: {
    flex: 1,
    padding: 20,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  horseSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#0051f3ff',
    marginBottom: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  horseSelectorText: {
    flex: 1,
  },
  horseSelectorLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    fontWeight: '600',
  },
  horseSelectorValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  resumeRideButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  resumeRideGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  resumeRideText: {
    color: '#6ee7b7',
    fontSize: 14,
    fontWeight: '600',
  },
  sheetButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  sheetButton: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  sheetButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
  },
  sheetButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  floatingExpandButton: {
    position: 'absolute',
    left: 24,
    right: 24,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  floatingButtonBlur: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  floatingButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 12,
  },
  floatingButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Dashboard-like cards container inside bottom sheet
  sheetWidgetsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  // Dashboard-like single card
  sheetCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
});

export default LiveTrackingScreen;