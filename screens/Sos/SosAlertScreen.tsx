import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  StatusBar,
  Animated,
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';

const SosAlertScreen = () => {
  const [activated, setActivated] = useState(false);
  const [aboveThreshold, setAboveThreshold] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [counting, setCounting] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const isActivatedRef = useRef(false);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoResetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ACTIVATION_THRESHOLD = -120; // easier to reach
  const CANCEL_HYSTERESIS = 20; // allow small jitter before canceling
  const HOLD_MS = 200; // faster activation while still preventing accidental triggers

  // Map gesture Y to animated value for smooth movement; use listener for activation logic
  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: translateY } }],
    {
      useNativeDriver: true,
      listener: (event: any) => {
        const { translationY } = event.nativeEvent;
        // Activation when swiped up beyond threshold
        if (!isActivatedRef.current && translationY <= ACTIVATION_THRESHOLD) {
          if (!aboveThreshold) setAboveThreshold(true);
          isActivatedRef.current = true;
          // Subtle feedback on crossing threshold (slightly more bouncy)
          Animated.spring(buttonScale, { toValue: 1.06, useNativeDriver: true, tension: 96, friction: 4.5 }).start();
          // Start 10s countdown while held above threshold
          if (!counting) {
            setCounting(true);
            setCountdown(10);
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current as any);
            countdownTimerRef.current = setInterval(() => {
              setCountdown(prev => {
                const next = prev - 1;
                if (next <= 0) {
                  // Countdown finished => finalize activation
                  if (countdownTimerRef.current) {
                    clearInterval(countdownTimerRef.current as any);
                    countdownTimerRef.current = null;
                  }
                  setCounting(false);
                  setActivated(true);
                  Animated.parallel([
                    Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true, tension: 96, friction: 4.5 }),
                    Animated.spring(translateY, { toValue: -200, useNativeDriver: true, friction: 4.5, tension: 96 }),
                  ]).start();

                  // TODO: Trigger actual SOS action here (navigate, API call, etc.)

                  // Auto reset after a short delay to restore UI
                  if (autoResetTimerRef.current) clearTimeout(autoResetTimerRef.current);
                  autoResetTimerRef.current = setTimeout(() => {
                    setActivated(false);
                    isActivatedRef.current = false;
                    setAboveThreshold(false);
                    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 4.5, tension: 96 }).start();
                  }, 1200);
                  return 0;
                }
                return next;
              });
            }, 1000);
          }
        }

        // If user moves back below threshold while still holding, cancel pending activation
        if (isActivatedRef.current && translationY > ACTIVATION_THRESHOLD + CANCEL_HYSTERESIS) {
          isActivatedRef.current = false;
          if (holdTimerRef.current) {
            clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
          }
          if (aboveThreshold) setAboveThreshold(false);
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current as any);
            countdownTimerRef.current = null;
          }
          if (counting) setCounting(false);
          Animated.spring(buttonScale, { toValue: 0.98, useNativeDriver: true, tension: 96, friction: 4.5 }).start();
        }
      },
    }
  );

  const onHandlerStateChange = (
    event: import('react-native-gesture-handler').PanGestureHandlerStateChangeEvent
  ) => {
    const { state, oldState } = event.nativeEvent;
    if (state === State.BEGAN) {
      Animated.spring(buttonScale, { toValue: 0.97, useNativeDriver: true, tension: 96, friction: 4.5 }).start();
    }

    // On gesture end/cancel, reset visuals and state
    if (
      oldState === State.ACTIVE ||
      state === State.END ||
      state === State.CANCELLED ||
      state === State.FAILED
    ) {
      if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
      if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current as any); countdownTimerRef.current = null; }
      if (counting) setCounting(false);
      setAboveThreshold(false);
      Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true, tension: 96, friction: 4.5 }).start();
      // If successfully activated, keep at top until auto-reset; otherwise reset immediately
      if (!activated) {
        isActivatedRef.current = false;
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 96,
          friction: 4.5,
        }).start();
      }
    }
  };

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
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
      />

      <View style={styles.mainContent}>
        <Text style={styles.title}>
          {activated ? 'Emergency Alert Activated' : 'Emergency Alert Activating'}
        </Text>
        <Text style={styles.subtitle}>
          {activated
            ? 'Help is on the way.'
            : (aboveThreshold && counting
                ? `Hold button up to confirm\nActivating in ${countdown} seconds...`
                : 'Swipe the button up and hold.\nHelp will arrive soon.')}
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <Animated.View style={styles.swipeContainer}>
          <View style={styles.swipeTrack}>
            <PanGestureHandler
              onGestureEvent={onGestureEvent}
              onHandlerStateChange={onHandlerStateChange}
              activeOffsetY={-10} // only activate for upward swipes beyond 10px
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <Animated.View style={[styles.sosButton, animatedButtonStyle]}>
                <Text style={styles.sosText}>{(aboveThreshold && counting) || activated ? String(countdown) : 'SOS'}</Text>
              </Animated.View>
            </PanGestureHandler>
          </View>
          <Text style={styles.swipeInstruction}>
            {activated ? 'SOS Activated' : (aboveThreshold && counting ? 'Keep holding...' : 'Swipe the button up\nand hold.')}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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

  buttonContainer: {
    paddingHorizontal: 40,
    paddingBottom: 200,
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
});

export default SosAlertScreen;