import React from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: jest.fn() }) }));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));

const capturedNotificationItemProps: Array<{ notification: any; isRead?: boolean; onPress?: () => void }> = [];
jest.mock('../components/Notifications', () => ({
  NotificationList: () => null,
  NotificationItem: (props: any) => {
    capturedNotificationItemProps.push(props);
    return null;
  },
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
const mockGetNotificationReadState = jest.fn();
const mockDismissNotificationForUser = jest.fn();
const mockMarkNotificationAsRead = jest.fn();
const mockCreateTestNotification = jest.fn();

jest.mock('../services/FirebaseNotificationService', () => ({
  getNotificationsForRole: (...a: unknown[]) => mockGetNotifications(...a),
  deleteNotification: (...a: unknown[]) => mockDelete(...a),
  createTestNotification: (...a: unknown[]) => mockCreateTestNotification(...a),
  markNotificationAsRead: (...a: unknown[]) => mockMarkNotificationAsRead(...a),
  dismissNotificationForUser: (...a: unknown[]) => mockDismissNotificationForUser(...a),
  getNotificationReadState: (...a: unknown[]) => mockGetNotificationReadState(...a),
}));

import UserNotificationsScreen from '../screens/Profile/UserNotificationsScreen';

const texts = (renderer: TestRenderer.ReactTestRenderer) =>
  renderer.root.findAllByType(Text).map((n) => [n.props.children].flat().join(''));

const hasSpinner = (renderer: TestRenderer.ReactTestRenderer) =>
  renderer.root.findAllByType(ActivityIndicator).length > 0;

const findButtonsByLabel = (renderer: TestRenderer.ReactTestRenderer, label: string) =>
  renderer.root
    .findAllByType(TouchableOpacity)
    .filter((t) => t.props.accessibilityLabel === label);

const flushAsync = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
};

const mount = async () => {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<UserNotificationsScreen />);
  });
  await flushAsync();
  return renderer;
};

beforeEach(() => {
  mockFirebase.FIREBASE_ENABLED = true;
  mockGetNotifications.mockReset();
  mockDelete.mockReset();
  mockUseCurrentUser.mockReset();
  mockGetNotificationReadState.mockReset();
  mockGetNotificationReadState.mockResolvedValue(new Map());
  mockDismissNotificationForUser.mockReset();
  mockMarkNotificationAsRead.mockReset();
  mockCreateTestNotification.mockReset();
  capturedNotificationItemProps.length = 0;
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(async () => {
  await flushAsync();
  jest.restoreAllMocks();
});

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

describe('UserNotificationsScreen per-user read and dismiss behaviour', () => {
  it('hides dismissed items from the visible list and shows empty state when all are dismissed', async () => {
    mockUseCurrentUser.mockReturnValue({ profile: { uid: 'u1', role: 'member' }, loading: false });
    mockGetNotifications.mockResolvedValueOnce([
      { id: 'n1', title: 'Visible 1', body: 'Body 1', createdAt: new Date() },
      { id: 'n2', title: 'Dismissed 2', body: 'Body 2', createdAt: new Date() },
    ]);
    const readState = new Map([
      ['n2', { read: true, dismissed: true }],
    ]);
    mockGetNotificationReadState.mockResolvedValueOnce(readState);

    const r = await mount();

    expect(capturedNotificationItemProps.map((p) => p.notification.id)).toEqual(['n1']);
    expect(texts(r)).toContain('1 notification');

    // If all are dismissed:
    mockGetNotifications.mockResolvedValueOnce([
      { id: 'n2', title: 'Dismissed 2', body: 'Body 2', createdAt: new Date() },
    ]);
    mockGetNotificationReadState.mockResolvedValueOnce(readState);
    const emptyR = await mount();
    expect(texts(emptyR)).toContain('No notifications');
  });

  it('passes isRead to NotificationItem based on loaded read state', async () => {
    mockUseCurrentUser.mockReturnValue({ profile: { uid: 'u1', role: 'member' }, loading: false });
    mockGetNotifications.mockResolvedValueOnce([
      { id: 'n1', title: 'Item 1', body: 'Body 1', createdAt: new Date() },
      { id: 'n2', title: 'Item 2', body: 'Body 2', createdAt: new Date() },
    ]);
    const readState = new Map([
      ['n1', { read: true, dismissed: false }],
    ]);
    mockGetNotificationReadState.mockResolvedValueOnce(readState);

    await mount();

    const n1Props = capturedNotificationItemProps.find((p) => p.notification.id === 'n1');
    const n2Props = capturedNotificationItemProps.find((p) => p.notification.id === 'n2');
    expect(n1Props?.isRead).toBe(true);
    expect(n2Props?.isRead).toBe(false);
  });

  it('Dismiss calls dismissNotificationForUser and never calls deleteNotification', async () => {
    mockUseCurrentUser.mockReturnValue({ profile: { uid: 'u1', role: 'member' }, loading: false });
    mockGetNotifications.mockResolvedValueOnce([
      { id: 'n1', title: 'Item 1', body: 'Body 1', createdAt: new Date() },
    ]);
    mockGetNotificationReadState.mockResolvedValueOnce(new Map());
    mockDismissNotificationForUser.mockResolvedValueOnce(undefined);

    const r = await mount();

    const dismissButtons = findButtonsByLabel(r, 'Dismiss notification');
    expect(dismissButtons.length).toBe(1);

    await act(async () => {
      dismissButtons[0].props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Dismiss Notification',
      'Hide this notification? It will be removed from your list only.',
      expect.any(Array)
    );

    const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
    const confirmBtn = alertButtons.find((b: any) => b.text === 'Dismiss');
    await act(async () => {
      await confirmBtn.onPress();
    });
    await flushAsync();

    expect(mockDismissNotificationForUser).toHaveBeenCalledWith('n1', 'u1');
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('keeps the item and shows an error when dismiss fails', async () => {
    mockUseCurrentUser.mockReturnValue({ profile: { uid: 'u1', role: 'member' }, loading: false });
    mockGetNotifications.mockResolvedValueOnce([
      { id: 'n1', title: 'Item 1', body: 'Body 1', createdAt: new Date() },
    ]);
    mockGetNotificationReadState.mockResolvedValueOnce(new Map());
    mockDismissNotificationForUser.mockRejectedValueOnce(new Error('network error'));

    const r = await mount();

    const dismissButtons = findButtonsByLabel(r, 'Dismiss notification');
    await act(async () => {
      dismissButtons[0].props.onPress();
    });

    const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
    const confirmBtn = alertButtons.find((b: any) => b.text === 'Dismiss');
    await act(async () => {
      await confirmBtn.onPress();
    });
    await flushAsync();

    expect(mockDismissNotificationForUser).toHaveBeenCalledWith('n1', 'u1');
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to dismiss notification');
    expect(findButtonsByLabel(r, 'Dismiss notification').length).toBe(1);
  });

  it('still lists items with a note when read state load fails', async () => {
    mockUseCurrentUser.mockReturnValue({ profile: { uid: 'u1', role: 'member' }, loading: false });
    mockGetNotifications.mockResolvedValueOnce([
      { id: 'n1', title: 'Item 1', body: 'Body 1', createdAt: new Date() },
    ]);
    mockGetNotificationReadState.mockRejectedValueOnce(new Error('read state error'));

    const r = await mount();

    expect(hasSpinner(r)).toBe(false);
    expect(texts(r)).toContain("Couldn't load read status.");
    expect(capturedNotificationItemProps.length).toBe(1);
    expect(capturedNotificationItemProps[0].isRead).toBe(false);
  });

  it('hides the test-notification action for members and shows for dev admin', async () => {
    // Member: hidden
    mockUseCurrentUser.mockReturnValue({ profile: { uid: 'u1', role: 'member' }, loading: false });
    mockGetNotifications.mockResolvedValueOnce([]);
    const memberR = await mount();
    expect(findButtonsByLabel(memberR, 'Create test notification').length).toBe(0);

    // Admin: shown
    mockUseCurrentUser.mockReturnValue({ profile: { uid: 'u2', role: 'admin' }, loading: false });
    mockGetNotifications.mockResolvedValueOnce([]);
    const adminR = await mount();
    expect(findButtonsByLabel(adminR, 'Create test notification').length).toBe(1);
  });

  it('tapping a notification marks it read optimistically and reverts on error', async () => {
    mockUseCurrentUser.mockReturnValue({ profile: { uid: 'u1', role: 'member' }, loading: false });
    mockGetNotifications.mockResolvedValueOnce([
      { id: 'n1', title: 'Item 1', body: 'Body 1', createdAt: new Date() },
    ]);
    mockGetNotificationReadState.mockResolvedValueOnce(new Map());
    mockMarkNotificationAsRead.mockResolvedValueOnce(undefined);

    await mount();

    expect(capturedNotificationItemProps[0].isRead).toBe(false);

    await act(async () => {
      await capturedNotificationItemProps[0].onPress!();
    });
    await flushAsync();

    expect(mockMarkNotificationAsRead).toHaveBeenCalledWith('n1', 'u1');

    // Failure case: reverts and alerts
    mockMarkNotificationAsRead.mockRejectedValueOnce(new Error('write failed'));
    mockGetNotifications.mockResolvedValueOnce([
      { id: 'n2', title: 'Item 2', body: 'Body 2', createdAt: new Date() },
    ]);
    mockGetNotificationReadState.mockResolvedValueOnce(new Map());

    await mount();
    const lastProps = capturedNotificationItemProps[capturedNotificationItemProps.length - 1];

    await act(async () => {
      await lastProps.onPress!();
    });
    await flushAsync();

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to mark notification as read');
  });

  it('hydrates read state across reload', async () => {
    mockUseCurrentUser.mockReturnValue({ profile: { uid: 'u1', role: 'member' }, loading: false });
    mockGetNotifications.mockResolvedValue([
      { id: 'n1', title: 'Item 1', body: 'Body 1', createdAt: new Date() },
    ]);
    mockGetNotificationReadState.mockResolvedValue(new Map([['n1', { read: true, dismissed: false }]]));

    await mount();

    expect(mockGetNotificationReadState).toHaveBeenCalledWith('u1');
    const props = capturedNotificationItemProps[capturedNotificationItemProps.length - 1];
    expect(props.isRead).toBe(true);
  });

  it('mark all read marks only visible unread notifications', async () => {
    mockUseCurrentUser.mockReturnValue({ profile: { uid: 'u1', role: 'member' }, loading: false });
    mockGetNotifications.mockResolvedValueOnce([
      { id: 'n1', title: 'Unread 1', body: 'Body 1', createdAt: new Date() },
      { id: 'n2', title: 'Already Read 2', body: 'Body 2', createdAt: new Date() },
      { id: 'n3', title: 'Dismissed 3', body: 'Body 3', createdAt: new Date() },
    ]);
    mockGetNotificationReadState.mockResolvedValueOnce(
      new Map([
        ['n2', { read: true, dismissed: false }],
        ['n3', { read: false, dismissed: true }],
      ])
    );
    mockMarkNotificationAsRead.mockResolvedValue(undefined);

    const r = await mount();

    const markAllBtn = findButtonsByLabel(r, 'Mark all as read')[0];
    await act(async () => {
      await markAllBtn.props.onPress();
    });
    await flushAsync();

    // Only n1 was visible and unread (n2 was read, n3 was dismissed)
    expect(mockMarkNotificationAsRead).toHaveBeenCalledTimes(1);
    expect(mockMarkNotificationAsRead).toHaveBeenCalledWith('n1', 'u1');
  });

  it('renders empty-state title with palette.textPrimary in dark mode', async () => {
    const ReactNative = require('react-native');
    const { Colors } = require('../constants/colors');
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');
    mockUseCurrentUser.mockReturnValue({ profile: { uid: 'u1', role: 'member' }, loading: false });
    mockGetNotifications.mockResolvedValueOnce([]);

    const r = await mount();
    const textNodes = r.root.findAllByType(ReactNative.Text);
    const emptyTitleNode = textNodes.find((t) => [t.props.children].flat().join('') === 'No notifications');
    expect(emptyTitleNode).toBeDefined();
    expect(ReactNative.StyleSheet.flatten(emptyTitleNode!.props.style).color).toBe(Colors.dark.textPrimary);
  });
});
