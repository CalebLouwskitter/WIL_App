const mockAddDoc = jest.fn();
const mockUpdateDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => ({ __col: name }),
  doc: (_db: unknown, ...segments: string[]) => ({ __doc: segments.join('/') }),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  serverTimestamp: () => 'SERVER_TS',
  getDocs: jest.fn(),
  deleteDoc: jest.fn(),
  getDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  onSnapshot: jest.fn(),
  Timestamp: { fromDate: jest.fn() },
}));

jest.mock('../services/FirebaseFirestoreService', () => ({ firestore: {} }));

import { createAdminNotification } from '../services/FirebaseNotificationService';

describe('createAdminNotification push queue', () => {
  beforeEach(() => {
    mockAddDoc.mockReset();
    mockUpdateDoc.mockReset();
  });

  it('saves the notification without sentAt, then queues exactly the allowed push keys', async () => {
    mockAddDoc.mockImplementation(async (col: { __col: string }) => ({ id: `${col.__col}-id` }));
    mockUpdateDoc.mockResolvedValue(undefined);

    const result = await createAdminNotification('admin-1', 'alert', 'T', 'B', 'users');

    expect(result).toEqual({ id: 'notifications-id', pushQueued: true });
    const [, notification] = mockAddDoc.mock.calls[0];
    expect(notification).not.toHaveProperty('sentAt');
    expect(notification).not.toHaveProperty('queuedAt');

    const [col, request] = mockAddDoc.mock.calls[1];
    expect(col).toEqual({ __col: 'pushNotificationRequests' });
    expect(Object.keys(request).sort()).toEqual(
      ['audience', 'body', 'createdAt', 'createdBy', 'notificationId', 'processed', 'title', 'transport'].sort()
    );
    expect(request).toMatchObject({
      transport: 'expo',
      notificationId: 'notifications-id',
      createdBy: 'admin-1',
      audience: 'users',
      processed: false,
    });
    expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: 'notifications/notifications-id' }, { queuedAt: 'SERVER_TS' });
  });

  it('keeps the saved notification and reports pushQueued=false when the queue write fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockAddDoc.mockImplementation(async (col: { __col: string }) => {
      if (col.__col === 'pushNotificationRequests') throw new Error('permission-denied');
      return { id: 'notifications-id' };
    });

    const result = await createAdminNotification('admin-1', 'alert', 'T', 'B', 'admins');

    expect(result).toEqual({ id: 'notifications-id', pushQueued: false });
    expect(mockUpdateDoc).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
