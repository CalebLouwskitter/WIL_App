import React from 'react';
import { Alert, Linking, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

// Never reach a real gesture, WhatsApp, location or server: everything the screen touches is mocked.
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  return {
    PanGestureHandler: ({ children }: { children: React.ReactNode }) => children,
    State: { UNDETERMINED: 0, FAILED: 1, BEGAN: 2, CANCELLED: 3, ACTIVE: 4, END: 5 },
    GestureHandlerRootView: View,
  };
});

jest.mock('@react-navigation/native', () => {
  const { useEffect } = require('react');
  return { useFocusEffect: (cb: () => void) => useEffect(cb, [cb]) };
});

jest.mock('../services/firebase', () => ({ auth: { currentUser: null }, FIREBASE_ENABLED: false }));
jest.mock('../hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ profile: null }) }));
jest.mock('../hooks/useFirebaseAuth', () => () => ({ user: null }));

const mockStartBroadcast = jest.fn();
const mockStopBroadcast = jest.fn();
jest.mock('../services/OnlineUserService', () => ({
  startLocationBroadcast: (...a: unknown[]) => mockStartBroadcast(...a),
  stopLocationBroadcast: (...a: unknown[]) => mockStopBroadcast(...a),
}));

const mockActivate = jest.fn();
const mockClear = jest.fn();
jest.mock('../contexts/SosContext', () => ({
  useSos: () => ({ state: { active: false, name: null }, activate: mockActivate, clear: mockClear }),
}));

const mockPermission = jest.fn();
const mockPosition = jest.fn();
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: (...a: unknown[]) => mockPermission(...a),
  getCurrentPositionAsync: (...a: unknown[]) => mockPosition(...a),
}));

import SosAlertScreen from '../screens/Sos/SosAlertScreen';

const texts = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAllByType(Text).map((n) => [n.props.children].flat().join(''));

const mount = async () => {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<SosAlertScreen />);
  });
  return r;
};

/** Swipe past the hold threshold, then let the 3 second countdown run out. */
const swipeAndWaitForCountdown = async (r: TestRenderer.ReactTestRenderer) => {
  const pan = r.root.findAll((n) => typeof n.props.onGestureEvent === 'function')[0];
  await act(async () => {
    pan.props.onGestureEvent({ nativeEvent: { translationY: -160 } });
  });
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
  }
  // Let the awaited activate() result land
  await act(async () => {});
};

let openURL: jest.SpyInstance;
let canOpenURL: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  mockActivate.mockReset().mockResolvedValue({ ok: false, code: 'unavailable', error: 'Not connected' });
  mockClear.mockReset().mockResolvedValue({ ok: false, code: 'unavailable' });
  mockStartBroadcast.mockReset();
  mockStopBroadcast.mockReset();
  mockPermission.mockReset().mockResolvedValue({ status: 'granted' });
  mockPosition.mockReset().mockResolvedValue({ coords: { latitude: -34.03, longitude: 25.5 } });
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  canOpenURL = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('SosAlertScreen countdown', () => {
  it('submits the SBHRA alert at countdown end and opens nothing by itself', async () => {
    const r = await mount();
    await swipeAndWaitForCountdown(r);

    expect(mockActivate).toHaveBeenCalledTimes(1);
    expect(mockStartBroadcast).toHaveBeenCalledWith({ isRiding: false });
    expect(texts(r)).toContain('Not connected');
    expect(mockPermission).not.toHaveBeenCalled();
    expect(canOpenURL).not.toHaveBeenCalled();
    expect(openURL).not.toHaveBeenCalled();
  });
});
