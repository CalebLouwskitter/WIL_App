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

const shareButton = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAll((n) => n.props.testID === 'sos-share-whatsapp' && typeof n.props.onPress === 'function')[0];

const tapShare = async (r: TestRenderer.ReactTestRenderer, times = 1) => {
  await act(async () => {
    const press = shareButton(r).props.onPress;
    for (let i = 0; i < times; i++) press();
  });
};

const SHARE_LABEL = 'Share my location via WhatsApp';
const HINT =
  'Opens WhatsApp with your location. You choose who to send it to and send it yourself. This is separate from the SBHRA alert.';

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
  // jest-expo already mocks Linking, so spyOn hands back the shared mock: reset its calls too
  openURL = jest.spyOn(Linking, 'openURL').mockReset().mockResolvedValue(true);
  canOpenURL = jest.spyOn(Linking, 'canOpenURL').mockReset().mockResolvedValue(true);
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

describe('SosAlertScreen WhatsApp share offer', () => {
  it('offers the share after an unavailable alert, with the honest hint', async () => {
    const r = await mount();
    await swipeAndWaitForCountdown(r);
    expect(texts(r)).toEqual(expect.arrayContaining(['Not connected', SHARE_LABEL, HINT, 'Dismiss']));
    expect(openURL).not.toHaveBeenCalled();
  });

  it('offers the share after a failed alert, next to Retry', async () => {
    mockActivate.mockResolvedValue({ ok: false, code: 'write-failed', error: 'network', partial: false });
    const r = await mount();
    await swipeAndWaitForCountdown(r);
    expect(texts(r)).toEqual(expect.arrayContaining(['SOS alert not sent', 'Retry', SHARE_LABEL, HINT]));
    expect(openURL).not.toHaveBeenCalled();
  });

  it('also offers the share after a submitted alert, as a secondary action', async () => {
    mockActivate.mockResolvedValue({ ok: true });
    const r = await mount();
    await swipeAndWaitForCountdown(r);
    expect(texts(r)).toEqual(expect.arrayContaining(['Alert submitted', SHARE_LABEL, 'Cancel alert']));
    expect(texts(r)).not.toContain('Retry');
    expect(openURL).not.toHaveBeenCalled();
  });

  it('opens the WhatsApp app once, even on a double tap', async () => {
    const r = await mount();
    await swipeAndWaitForCountdown(r);
    await tapShare(r, 2);

    expect(mockPermission).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledTimes(1);
    const url = openURL.mock.calls[0][0] as string;
    expect(url.startsWith('whatsapp://send?text=')).toBe(true);
    expect(decodeURIComponent(url.split('text=')[1])).toContain('https://maps.google.com/?q=-34.030000,25.500000');
    expect(texts(r)).toContain('WhatsApp is open. Choose who to send it to and tap send. Nothing is sent until you do.');
  });

  it('falls back to wa.me once when the WhatsApp app scheme cannot be opened', async () => {
    canOpenURL.mockResolvedValue(false);
    const r = await mount();
    await swipeAndWaitForCountdown(r);
    await tapShare(r, 2);

    expect(openURL).toHaveBeenCalledTimes(1);
    expect((openURL.mock.calls[0][0] as string).startsWith('https://wa.me/?text=')).toBe(true);
    expect(texts(r).join(' ')).toContain("WhatsApp didn't open directly, so we opened wa.me instead.");
  });

  it('lets the rider share again after the first attempt finished', async () => {
    const r = await mount();
    await swipeAndWaitForCountdown(r);
    await tapShare(r);
    await tapShare(r);
    expect(openURL).toHaveBeenCalledTimes(2);
  });

  it('does not open anything when location is denied, and says so', async () => {
    mockPermission.mockResolvedValue({ status: 'denied' });
    const r = await mount();
    await swipeAndWaitForCountdown(r);
    await tapShare(r);

    expect(mockPosition).not.toHaveBeenCalled();
    expect(canOpenURL).not.toHaveBeenCalled();
    expect(openURL).not.toHaveBeenCalled();
    expect(texts(r)).toContain(
      'Location permission is off, so WhatsApp was not opened. Allow location for SBHRA in Settings, or contact emergency services directly, e.g. 112.'
    );
  });

  it('does not open anything without a usable fix', async () => {
    mockPosition.mockResolvedValue({ coords: { latitude: NaN, longitude: 25.5 } });
    const r = await mount();
    await swipeAndWaitForCountdown(r);
    await tapShare(r);

    expect(openURL).not.toHaveBeenCalled();
    expect(texts(r).join(' ')).toContain("We couldn't get a usable location, so WhatsApp was not opened.");
  });

  it('says clearly when WhatsApp could not be opened at all', async () => {
    canOpenURL.mockResolvedValue(false);
    openURL.mockRejectedValue(new Error('No app to handle https'));
    const r = await mount();
    await swipeAndWaitForCountdown(r);
    await tapShare(r);

    expect(openURL).toHaveBeenCalledTimes(1);
    expect(texts(r)).toContain("We couldn't open WhatsApp. Contact emergency services directly, e.g. 112.");
  });
});
