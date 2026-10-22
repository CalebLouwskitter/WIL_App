import React from 'react';
import { ActivityIndicator, Alert, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: jest.fn() }) }));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('../components/Notifications', () => ({
  NotificationList: () => null,
  NotificationItem: () => null,
}));

const mockFirebase = { FIREBASE_ENABLED: true };
jest.mock('../services/firebase', () => ({
  get FIREBASE_ENABLED() {
    return mockFirebase.FIREBASE_ENABLED;
  },
}));

const mockUseCurrentUser = jest.fn();
jest.mock('../hooks/useCurrentUser', () => ({ useCurrentUser: () => mockUseCurrentUser() }));

const mockGetNotifications = jest.fn();
const mockDelete = jest.fn();
jest.mock('../services/FirebaseNotificationService', () => ({
  getNotificationsForRole: (...a: unknown[]) => mockGetNotifications(...a),
  deleteNotification: (...a: unknown[]) => mockDelete(...a),
  createTestNotification: jest.fn(),
  markNotificationAsRead: jest.fn(),
}));

import UserNotificationsScreen from '../screens/Profile/UserNotificationsScreen';

const texts = (renderer: TestRenderer.ReactTestRenderer) =>
  renderer.root.findAllByType(Text).map((n) => [n.props.children].flat().join(''));

const hasSpinner = (renderer: TestRenderer.ReactTestRenderer) =>
  renderer.root.findAllByType(ActivityIndicator).length > 0;

const mount = async () => {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<UserNotificationsScreen />);
  });
  return renderer;
};

beforeEach(() => {
  mockFirebase.FIREBASE_ENABLED = true;
  mockGetNotifications.mockReset();
  mockDelete.mockReset();
  mockUseCurrentUser.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('UserNotificationsScreen states', () => {
  it('shows the spinner only while a real load is in flight', async () => {
    mockUseCurrentUser.mockReturnValue({ profile: { uid: 'u1' }, loading: false });
    mockGetNotifications.mockReturnValue(new Promise(() => {}));
    const r = await mount();
    expect(hasSpinner(r)).toBe(true);
  });

  it('stops loading and asks to sign in when there is no profile', async () => {
    mockUseCurrentUser.mockReturnValue({ profile: null, loading: false });
    const r = await mount();
    expect(hasSpinner(r)).toBe(false);
    expect(texts(r)).toContain('Sign in to see notifications');
    expect(texts(r).join(' ')).not.toContain('Loading notifications');
    expect(mockGetNotifications).not.toHaveBeenCalled();
  });

  it('says "Not connected" in demo mode (Firebase off)', async () => {
    mockFirebase.FIREBASE_ENABLED = false;
    mockUseCurrentUser.mockReturnValue({ profile: null, loading: false });
    const r = await mount();
    expect(texts(r)).toContain('Not connected');
  });

  it('shows a Retry state when the load fails, and a distinct empty state when it succeeds with nothing', async () => {
    mockUseCurrentUser.mockReturnValue({ profile: { uid: 'u1' }, loading: false });
    mockGetNotifications.mockRejectedValueOnce(new Error('offline'));
    const failed = await mount();
    expect(hasSpinner(failed)).toBe(false);
    expect(texts(failed)).toContain('Could not load notifications.');
    expect(texts(failed)).toContain('Retry');

    mockGetNotifications.mockResolvedValueOnce([]);
    const empty = await mount();
    expect(texts(empty)).toContain('No notifications');
    expect(texts(empty)).not.toContain('Retry');
  });

  it('clears loading in finally even when the read rejects', async () => {
    mockUseCurrentUser.mockReturnValue({ profile: { uid: 'u1' }, loading: false });
    mockGetNotifications.mockRejectedValue(new Error('boom'));
    const r = await mount();
    expect(hasSpinner(r)).toBe(false);
  });
});
