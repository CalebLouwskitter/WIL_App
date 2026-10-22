import React, { useState, useRef, useEffect, useCallback } from 'react';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Animated,
  Alert,
  Linking,
} from 'react-native';
import * as Location from 'expo-location';
import { PanGestureHandler, State, HandlerStateChangeEvent, PanGestureHandlerEventPayload } from 'react-native-gesture-handler';
import { useSos } from '../../contexts/SosContext';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import useFirebaseAuth from '../../hooks/useFirebaseAuth';
import { auth, FIREBASE_ENABLED } from '../../services/firebase';
import { useFocusEffect } from '@react-navigation/native';
import { startLocationBroadcast, stopLocationBroadcast } from '../../services/OnlineUserService';
import { buildSosShareMessage, whatsAppShareUrls } from '../../utils/sosShare';

const HOLD_THRESHOLD = -150;
const SNAP_VALUE = -200;
const COUNTDOWN_START = 3;

/** What we actually know about the alert. There is no "acknowledged" state: nothing reports a responder receipt yet. */
type SubmitStatus = 'idle' | 'sending' | 'submitted' | 'failed' | 'unavailable';

/** The rider's own WhatsApp share. Opening WhatsApp is all we can know; the rider sends it, or not. */
type ShareStatus = 'idle' | 'working' | 'opened' | 'opened-web' | 'denied' | 'no-fix' | 'failed';

const SosAlertScreen = () => {
  const [helpSent, setHelpSent] = useState(false);
  const [activated, setActivated] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_START);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [submitPartial, setSubmitPartial] = useState(false);
  const [shareStatus, setShareStatus] = useState<ShareStatus>('idle');
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
  const activationFinalizedRef = useRef(false);
  const submitStatusRef = useRef<SubmitStatus>('idle');
  const shareInFlightRef = useRef(false);

  const updateSubmitStatus = (status: SubmitStatus, partial = false) => {
    submitStatusRef.current = status;
    setSubmitStatus(status);
    setSubmitPartial(partial);
  };

  const resetToInitialState = () => {
    activatedRef.current = false;
    updateSubmitStatus('idle');
    setActivated(false);
    setHelpSent(false);
    setCountdown(COUNTDOWN_START);
    setShareStatus('idle');
    activationFinalizedRef.current = false;
    translateY.setValue(0);
    translateYJS.setValue(0);
    Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true }).start();
  };

  const finalizeSosActivation = useCallback(async () => {
    if (activationFinalizedRef.current) return;
    activationFinalizedRef.current = true;

    try {
      startLocationBroadcast({ isRiding: false });
    } catch (error) {
      console.error('Error starting location broadcast for SOS:', error);
    }

    updateSubmitStatus('sending');
    try {
      const result = await activate(activatorNameRef.current, auth?.currentUser?.uid ?? null);
      if (result.ok) {
        activatedThisSessionRef.current = true;
        updateSubmitStatus('submitted');
      } else if (result.code === 'unavailable') {
        updateSubmitStatus('unavailable');
      } else {
        // A partial failure may still have left a record that has to be cleared later
        if (result.partial) activatedThisSessionRef.current = true;
        updateSubmitStatus('failed', !!result.partial);
      }
    } catch (error) {
      console.error('Error finalizing SOS activation:', error);
      updateSubmitStatus('failed');
    }
  }, [activate]);

  const retrySos = () => {
    activationFinalizedRef.current = false;
    finalizeSosActivation();
  };

  // Cancel a submitted alert. Only report it cancelled once the server accepted the clear.
  const cancelSos = async () => {
    const result = await clear();
    if (!result.ok && result.code !== 'unavailable') {
      Alert.alert(
        "Couldn't cancel the alert",
        'The alert may still be active. If you no longer need help, contact SBHRA or emergency services directly.'
      );
      return;
    }
    resetToInitialState();
    activatedThisSessionRef.current = false;
    try { stopLocationBroadcast(); } catch {}
  };

  // Leave the failed / unavailable panel. A half-written record from a partial failure is cleared first.
  const dismissResult = async () => {
    if (activatedThisSessionRef.current) {
      const result = await clear();
      if (!result.ok && result.code !== 'unavailable') {
        Alert.alert("Couldn't cancel the alert", 'A partial alert may still be active. Try again, or contact SBHRA directly.');
        return;
      }
    }
    resetToInitialState();
    activatedThisSessionRef.current = false;
    try { stopLocationBroadcast(); } catch {}
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
          const bestName = (auth?.currentUser?.displayName as string | undefined) ?? profile?.displayName ?? null;
          activatorNameRef.current = (bestName ?? '').trim() || null;
          activationFinalizedRef.current = false;

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
          if (activatedThisSessionRef.current) {
            clear().then((result) => {
              if (!result.ok && result.code !== 'unavailable') {
                Alert.alert("Couldn't cancel the alert", 'The alert may still be active. Contact SBHRA or emergency services directly.');
              }
            });
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

  // Offered after the alert result, only when the rider taps it. Separate from the SBHRA alert.
  const shareLocationViaWhatsApp = async () => {
    if (shareInFlightRef.current) return;
    shareInFlightRef.current = true;
    setShareStatus('working');

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setShareStatus('denied');
        return;
      }

      const { coords } = await Location.getCurrentPositionAsync({});
      const message = buildSosShareMessage(coords);
      if (!message) {
        setShareStatus('no-fix');
        return;
      }

      const { app, web } = whatsAppShareUrls(message);
      if (await Linking.canOpenURL(app)) {
        await Linking.openURL(app);
        setShareStatus('opened');
      } else {
        await Linking.openURL(web);
        setShareStatus('opened-web');
      }
    } catch (error) {
      console.error('Error opening WhatsApp location share:', error);
      setShareStatus('failed');
    } finally {
      shareInFlightRef.current = false;
    }
  };

  // Countdown effect - submits the SBHRA alert when the countdown reaches 0. Nothing else opens by itself.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (activated && !helpSent) {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (timer) clearInterval(timer);
            finalizeSosActivation();
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
  }, [activated, helpSent, finalizeSosActivation]);

  // Backfill activator name if SOS is active but name wasn't available yet
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    if (sosState.active && !sosState.name) {
      const derivedName = (auth?.currentUser?.displayName as string | undefined) ?? profile?.displayName ?? null;
      const sanitized = (derivedName ?? '').trim();
      if (sanitized.length) {
        timeout = setTimeout(() => {
          activate(sanitized, auth?.currentUser?.uid ?? null);
        }, 0);
      }
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [sosState.active, sosState.name, activate, profile?.displayName, user?.displayName]);

  // Sync local UI when SOS is cleared elsewhere
  useEffect(() => {
    if (!sosState.active) {
      resetToInitialState();
      activatedThisSessionRef.current = false;
      try { stopLocationBroadcast(); } catch {}
    }
  }, [sosState.active]);

  // Sync state when screen gains focus
  useFocusEffect(
    React.useCallback(() => {
      if (sosState.active) {
        if (!activatedThisSessionRef.current && !helpSent) {
          setActivated(true);
          setHelpSent(true);
        }
        startLocationBroadcast({ isRiding: false });
      } else if (submitStatusRef.current === 'idle') {
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
              Swipe up and hold to send an SOS alert to SBHRA
            </Text>
            {!FIREBASE_ENABLED && (
              <Text style={[styles.subtitle, { marginTop: -24 }, activated && { color: '#FF0000' }]}>
                Not connected to SBHRA servers. In an emergency, contact emergency services directly, e.g. 112.
              </Text>
            )}
          </>
        ) : (
          <>
            <Text style={[styles.helpSentTitle, activated && styles.whiteText]}>{resultTitle(submitStatus)}</Text>
            <Text style={[styles.helpSentSubtitle, activated && styles.whiteText]}>
              {resultMessage(submitStatus, submitPartial)}
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
          <View style={styles.resultActions}>
            {submitStatus === 'failed' && (
              <TouchableOpacity style={styles.cancelButton} onPress={retrySos}>
                <Text style={styles.cancelButtonText}>Retry</Text>
              </TouchableOpacity>
            )}
            {submitStatus !== 'sending' && (
              <View style={styles.shareBlock}>
                <TouchableOpacity
                  testID="sos-share-whatsapp"
                  accessibilityRole="button"
                  style={[styles.shareButton, shareStatus === 'working' && styles.shareButtonBusy]}
                  onPress={shareLocationViaWhatsApp}
                  disabled={shareStatus === 'working'}
                >
                  <Text style={styles.shareButtonText}>Share my location via WhatsApp</Text>
                </TouchableOpacity>
                <Text style={[styles.shareHint, activated && styles.whiteText]}>{shareMessage(shareStatus)}</Text>
              </View>
            )}
            {submitStatus !== 'sending' && (
              <TouchableOpacity
                style={[styles.cancelButton, submitStatus === 'failed' && styles.secondaryButton]}
                onPress={submitStatus === 'submitted' ? cancelSos : dismissResult}
              >
                <Text style={styles.cancelButtonText}>{submitStatus === 'submitted' ? 'Cancel alert' : 'Dismiss'}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

const resultTitle = (status: SubmitStatus) => {
  switch (status) {
    case 'sending':
      return 'Sending SOS alert…';
    case 'submitted':
      return 'Alert submitted';
    case 'failed':
      return 'SOS alert not sent';
    case 'unavailable':
      return 'Not connected';
    default:
      return 'Having an Emergency?';
  }
};

const resultMessage = (status: SubmitStatus, partial: boolean) => {
  switch (status) {
    case 'sending':
      return 'Contacting SBHRA. If you are in danger, contact emergency services directly, e.g. 112.';
    case 'submitted':
      return 'Alert submitted — not yet acknowledged by a responder. If you are in danger, contact emergency services directly, e.g. 112.';
    case 'failed':
      return `We couldn't submit your alert${partial ? ' (it may have partly gone through)' : ''}. Retry, or contact emergency services directly, e.g. 112.`;
    case 'unavailable':
      return "This app isn't connected to SBHRA servers, so no alert was sent. Contact emergency services directly, e.g. 112.";
    default:
      return '';
  }
};

const SHARE_HINT =
  'Opens WhatsApp with your location. You choose who to send it to and send it yourself. This is separate from the SBHRA alert.';

const shareMessage = (status: ShareStatus) => {
  switch (status) {
    case 'working':
      return 'Getting your location…';
    case 'opened':
      return 'WhatsApp is open. Choose who to send it to and tap send. Nothing is sent until you do.';
    case 'opened-web':
      return "WhatsApp didn't open directly, so we opened wa.me instead. Choose who to send it to and tap send. If WhatsApp isn't installed, contact emergency services directly, e.g. 112.";
    case 'denied':
      return 'Location permission is off, so WhatsApp was not opened. Allow location for SBHRA in Settings, or contact emergency services directly, e.g. 112.';
    case 'no-fix':
      return "We couldn't get a usable location, so WhatsApp was not opened. Try again, or contact emergency services directly, e.g. 112.";
    case 'failed':
      return "We couldn't open WhatsApp. Contact emergency services directly, e.g. 112.";
    default:
      return SHARE_HINT;
  }
};

const styles = StyleSheet.create({
  shareBlock: {
    alignItems: 'center',
    maxWidth: 300,
  },
  shareButton: {
    width: 260,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareButtonBusy: {
    opacity: 0.6,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#075E54',
    textAlign: 'center',
  },
  shareHint: {
    fontSize: 13,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
  },
  resultActions: {
    gap: 12,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#6B7280',
  },
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