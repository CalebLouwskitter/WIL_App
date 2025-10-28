import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Animated,
  Linking,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { PanGestureHandler, State, HandlerStateChangeEvent, PanGestureHandlerEventPayload } from 'react-native-gesture-handler';
import { useSos } from '../../contexts/SosContext';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import useFirebaseAuth from '../../hooks/useFirebaseAuth';
import { auth } from '../../services/firebase';
import { useFocusEffect } from '@react-navigation/native';
import { startLocationBroadcast, stopLocationBroadcast } from '../../services/OnlineUserService';

const HOLD_THRESHOLD = -150;
const SNAP_VALUE = -200;
const COUNTDOWN_START = 3;

// ✅ Your WhatsApp group link here
const WHATSAPP_GROUP_LINK = '';

const SosAlertScreen = () => {
  const [helpSent, setHelpSent] = useState(false);
  const [activated, setActivated] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_START);
  const { state: sosState, activate, clear } = useSos();
  const { profile } = useCurrentUser();
  const { user } = useFirebaseAuth();

  const translateY = useRef(new Animated.Value(0)).current;
  const translateYJS = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const dragY = useRef(0);
  const activatorNameRef = useRef<string | null>(null);
  const activatedRef = useRef(false);
  const activatedThisSessionRef = useRef(false);

  const resetToInitialState = () => {
    activatedRef.current = false;
    setActivated(false);
    setHelpSent(false);
    setCountdown(COUNTDOWN_START);
    translateY.setValue(0);
    translateYJS.setValue(0);
    Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true }).start();
  };

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: translateYJS } }],
    {
      useNativeDriver: false,
      listener: (e: any) => {
        const ty = (e?.nativeEvent?.translationY ?? 0) as number;
        dragY.current = ty;
        const clampedValue = Math.min(0, ty);
        translateY.setValue(clampedValue);

        if (!activatedRef.current && ty <= HOLD_THRESHOLD) {
          activatedRef.current = true;
          setActivated(true);
          // Capture profile name immediately on activation
          const bestName = (auth?.currentUser?.displayName as string | undefined) ?? profile?.displayName ?? null;
          activatorNameRef.current = (bestName ?? '').trim() || null;
          // Immediately activate global SOS so Dashboard shows the name right away
          activatedThisSessionRef.current = true;
          activate(activatorNameRef.current, auth?.currentUser?.uid ?? null);
          Animated.timing(translateY, {
            toValue: SNAP_VALUE,
            duration: 120,
            useNativeDriver: true,
          }).start();
        }
      },
    }
  );

  const onHandlerStateChange = (event: HandlerStateChangeEvent<PanGestureHandlerEventPayload>) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true }).start();

      if (!helpSent) {
        if (!activatedRef.current) {
          Animated.spring(translateY, { 
            toValue: 0, 
            useNativeDriver: true,
            tension: 80,
            friction: 6
          }).start();
        } else {
          activatedRef.current = false;
          setActivated(false);
          setCountdown(COUNTDOWN_START);
          // User released before help sent. Only clear global SOS if this session initiated activation.
          if (activatedThisSessionRef.current) {
            clear();
            try { stopLocationBroadcast(); } catch {}
            activatedThisSessionRef.current = false;
          }
          Animated.spring(translateY, { 
            toValue: 0, 
            useNativeDriver: true,
            tension: 80,
            friction: 6
          }).start();
        }
      }
    } else if (event.nativeEvent.state === State.BEGAN) {
      Animated.spring(buttonScale, { toValue: 0.95, useNativeDriver: true }).start();
    }
  };

  // Send location to WhatsApp
  const sendLocationToWhatsApp = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to send your location.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const mapsUrl = `https://maps.google.com/?q=${location.coords.latitude},${location.coords.longitude}`;
      const message = `🚨 SOS Activated! 🚨\nMy current location: ${mapsUrl}`;

      const encodedMessage = encodeURIComponent(message);
      const fullUrl = `${WHATSAPP_GROUP_LINK}?text=${encodedMessage}`;

      const supported = await Linking.canOpenURL(fullUrl);
      if (supported) {
        await Linking.openURL(fullUrl);
      } else {
        Alert.alert('Error', 'Could not open WhatsApp. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to get location.');
      console.error('Error sending location:', error);
    }
  };

  // Countdown effect
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (activated && !helpSent) {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (timer) clearInterval(timer);
            setHelpSent(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activated, helpSent]);

  // Trigger side-effects after helpSent commits to true
  useEffect(() => {
    if (helpSent) {
      const derivedName =
        activatorNameRef.current ??
        (auth?.currentUser?.displayName as string | undefined) ??
        profile?.displayName ??
        null;
      const sanitized = (derivedName ?? '').trim() || null;
      activate(sanitized, auth?.currentUser?.uid ?? null);
      // Ensure location broadcast starts so others can follow on the map
      startLocationBroadcast({ isRiding: false });
      sendLocationToWhatsApp();
    }
  }, [helpSent, activate, profile?.displayName, profile?.email, user?.displayName, user?.email]);

  // Backfill activator name if SOS is active but name wasn't available yet
  useEffect(() => {
    if (sosState.active && !sosState.name) {
      const derivedName = (auth?.currentUser?.displayName as string | undefined) ?? profile?.displayName ?? null;
      const sanitized = (derivedName ?? '').trim();
      if (sanitized.length) activate(sanitized, auth?.currentUser?.uid ?? null);
    }
  }, [sosState.active, sosState.name, activate, profile?.displayName, profile?.email, user?.displayName, user?.email]);

  // Sync local UI when SOS is cleared elsewhere; do not auto-mark helpSent on first activation
  useEffect(() => {
    if (!sosState.active) {
      resetToInitialState();
      activatedThisSessionRef.current = false;
      try { stopLocationBroadcast(); } catch {}
    }
  }, [sosState.active]);

  // Also ensure state is synced whenever the screen gains focus
  useFocusEffect(
    React.useCallback(() => {
      if (sosState.active) {
        // Only auto-show Cancel when returning to the screen and this session did not initiate the alert
        if (!activatedThisSessionRef.current && !helpSent) {
          setActivated(true);
          setHelpSent(true);
        }
        // Defensive: make sure broadcasting is on when an active SOS is detected
        startLocationBroadcast({ isRiding: false });
      } else {
        resetToInitialState();
        activatedThisSessionRef.current = false;
        try { stopLocationBroadcast(); } catch {}
      }
      return () => {};
    }, [sosState.active, helpSent])
  );

  const animatedButtonStyle = {
    transform: [
      {
        translateY: translateY.interpolate({
          inputRange: [-200, 0],
          outputRange: [-200, 0],
          extrapolate: 'clamp',
        }),
      },
      { scale: buttonScale },
    ],
  };

  return (
    <View style={[styles.container, activated ? styles.redBackground : null]}>
      <StatusBar
        barStyle={activated ? "light-content" : "dark-content"}
        backgroundColor={activated ? "#FF0000" : "#FFFFFF"}
      />

      {activated && !helpSent && (
        <View style={styles.countdownContainer}>
          <Text style={styles.countdownText}>{countdown}</Text>
        </View>
      )}

      <View style={styles.mainContent}>
        {!helpSent ? (
          <>
            <Text style={[styles.title, activated && { color: '#FF0000' }]}>
              Having an Emergency?
            </Text>
            <Text style={[styles.subtitle, activated && { color: '#FF0000' }]}>
              Swipe the button up and hold.{'\n'}Help will arrive soon.
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.helpSentTitle, activated && styles.whiteText]}>Help has been sent</Text>
            <Text style={[styles.helpSentSubtitle, activated && styles.whiteText]}>
              Emergency services have been notified and are on their way.
            </Text>
          </>
        )}
      </View>

      <View style={styles.buttonContainer}>
        {!helpSent ? (
          <View style={styles.swipeContainer}>
            <View style={styles.swipeTrack}>
              <Animated.View style={[styles.sosButton, animatedButtonStyle]}>
                <Text style={styles.sosText}>SOS</Text>
              </Animated.View>
              <PanGestureHandler
                onGestureEvent={onGestureEvent}
                onHandlerStateChange={onHandlerStateChange}
              >
                <Animated.View style={styles.gestureOverlay} />
              </PanGestureHandler>
            </View>
            <Text style={[styles.swipeInstruction, activated && { color: '#FF0000' }]}>
              Swipe the button up{'\n'}and hold.
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              clear();
              resetToInitialState();
              activatedThisSessionRef.current = false;
              try { stopLocationBroadcast(); } catch {}
            }}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  redBackground: {
    backgroundColor: '#FF0000',
  },
  whiteText: {
    color: '#FFFFFF',
  },
  countdownContainer: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  countdownText: {
    fontSize: 64,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  helpSentTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 20,
  },
  helpSentSubtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonContainer: {
    paddingHorizontal: 40,
    paddingBottom: 40,
    alignItems: 'center',
  },
  swipeContainer: {
    alignItems: 'center',
    position: 'relative',
  },
  swipeTrack: {
    width: 120,
    height: 320,
    backgroundColor: '#F5F5F5',
    borderRadius: 60,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 8,
    borderWidth: 2,
    borderColor: '#E8E8E8',
    position: 'relative',
    overflow: 'hidden',
  },
  sosButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FF4757',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    position: 'absolute',
    bottom: 8,
  },
  sosText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  swipeInstruction: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 20,
  },
  cancelButton: {
    width: 200,
    height: 60,
    backgroundColor: '#FF4757',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cancelButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  gestureOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
});

export default SosAlertScreen;