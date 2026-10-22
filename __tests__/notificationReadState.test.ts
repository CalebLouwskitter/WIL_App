const mockState: { firestore: any } = {
  firestore: {},
};

jest.mock('../services/FirebaseFirestoreService', () => ({
  get firestore() {
    return mockState.firestore;
  },
}));

const mockDoc = jest.fn();
const mockCollection = jest.fn();
const mockSetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockServerTimestamp = jest.fn(() => ({ _methodName: 'serverTimestamp' }));

jest.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  serverTimestamp: () => mockServerTimestamp(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  onSnapshot: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  getDoc: jest.fn(),
  Timestamp: {
    fromDate: (d: Date) => d,
  },
}));

import {
  markNotificationAsRead,
  dismissNotificationForUser,
  getNotificationReadState,
} from '../services/FirebaseNotificationService';

describe('notification read-state service functions', () => {
  const dummyFirestore = {};

  beforeEach(() => {
    mockState.firestore = dummyFirestore;
    mockDoc.mockReset();
    mockCollection.mockReset();
    mockSetDoc.mockReset();
    mockGetDocs.mockReset();
    mockServerTimestamp.mockClear();

    mockDoc.mockImplementation((_fs, ...segments) => ({ path: segments.join('/') }));
    mockCollection.mockImplementation((_fs, ...segments) => ({ path: segments.join('/') }));
  });

  describe('markNotificationAsRead', () => {
    it('writes read: true and readAt serverTimestamp to users/{uid}/readNotifications/{id} with merge: true', async () => {
      mockSetDoc.mockResolvedValueOnce(undefined);

      await markNotificationAsRead('notif_1', 'user_123');

      expect(mockDoc).toHaveBeenCalledWith(dummyFirestore, 'users', 'user_123', 'readNotifications', 'notif_1');
      expect(mockSetDoc).toHaveBeenCalledWith(
        { path: 'users/user_123/readNotifications/notif_1' },
        {
          read: true,
          readAt: { _methodName: 'serverTimestamp' },
        },
        { merge: true }
      );
    });

    it('throws when firestore is not initialized', async () => {
      mockState.firestore = null;
      await expect(markNotificationAsRead('notif_1', 'user_123')).rejects.toThrow('Firestore is not initialized');
    });
  });

  describe('dismissNotificationForUser', () => {
    it('writes read: true, dismissed: true, readAt, and dismissedAt serverTimestamps with merge: true', async () => {
      mockSetDoc.mockResolvedValueOnce(undefined);

      await dismissNotificationForUser('notif_2', 'user_456');

      expect(mockDoc).toHaveBeenCalledWith(dummyFirestore, 'users', 'user_456', 'readNotifications', 'notif_2');
      expect(mockSetDoc).toHaveBeenCalledWith(
        { path: 'users/user_456/readNotifications/notif_2' },
        {
          read: true,
          readAt: { _methodName: 'serverTimestamp' },
          dismissed: true,
          dismissedAt: { _methodName: 'serverTimestamp' },
        },
        { merge: true }
      );
    });

    it('throws when firestore is not initialized', async () => {
      mockState.firestore = null;
      await expect(dismissNotificationForUser('notif_2', 'user_456')).rejects.toThrow('Firestore is not initialized');
    });
  });

  describe('getNotificationReadState', () => {
    it('reads users/{uid}/readNotifications and builds Map of read/dismissed states', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'notif_1',
            data: () => ({ read: true, dismissed: false }),
          },
          {
            id: 'notif_2',
            data: () => ({ read: true, dismissed: true }),
          },
          {
            id: 'notif_3',
            data: () => ({ read: true }), // omitted dismissed -> false
          },
        ],
      });

      const result = await getNotificationReadState('user_123');

      expect(mockCollection).toHaveBeenCalledWith(dummyFirestore, 'users', 'user_123', 'readNotifications');
      expect(mockGetDocs).toHaveBeenCalledWith({ path: 'users/user_123/readNotifications' });
      expect(result.size).toBe(3);
      expect(result.get('notif_1')).toEqual({ read: true, dismissed: false });
      expect(result.get('notif_2')).toEqual({ read: true, dismissed: true });
      expect(result.get('notif_3')).toEqual({ read: true, dismissed: false });
    });

    it('returns empty map when no read notifications exist', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      const result = await getNotificationReadState('user_123');

      expect(result.size).toBe(0);
    });

    it('throws when firestore is not initialized', async () => {
      mockState.firestore = null;
      await expect(getNotificationReadState('user_123')).rejects.toThrow('Firestore is not initialized');
    });
  });
});
