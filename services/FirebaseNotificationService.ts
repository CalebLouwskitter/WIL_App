import { 
  collection, 
  addDoc, 
  getDocs, 
  doc,
  setDoc, 
  updateDoc, 
  deleteDoc,
  getDoc,
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  serverTimestamp,
  onSnapshot,
  DocumentData,
  QuerySnapshot
} from 'firebase/firestore';
import { firestore } from './FirebaseFirestoreService';
import { Notification, NotificationPreferences, NotificationType, NotificationAudience } from '../types/Notification';

/**
 * Create a test notification for debugging
 */
export const createTestNotification = async (userId: string) => {
  if (!firestore) {
    throw new Error("Firestore is not initialized");
  }

  const notification: Omit<Notification, 'id'> = {
    type: 'update',
    title: 'Test Notification',
    body: 'This is a test notification to verify the system works',
    audience: 'users',
    createdAt: new Date(),
    createdBy: userId,
    metadata: {
      test: true
    }
  };

  const notificationsCol = collection(firestore, 'notifications');
  const docRef = await addDoc(notificationsCol, {
    ...notification,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
};

/**
 * Result of saving a notification and asking for a push to be delivered.
 * `pushQueued` only means the request reached the queue; nothing is delivered
 * until an external worker processes it (see docs/firebase/PUSH_CONTRACT.md).
 */
export interface NotificationSaveResult {
  id: string;
  pushQueued: boolean;
}

/**
 * Queue a push request for an external worker. The notification document is the
 * source of truth, so a failed queue write is logged and reported as
 * `pushQueued: false` rather than thrown.
 */
const queuePushRequest = async (
  notificationId: string,
  audience: NotificationAudience,
  title: string,
  body: string,
  createdBy: string
): Promise<boolean> => {
  if (!firestore) return false;

  try {
    await addDoc(collection(firestore, 'pushNotificationRequests'), {
      title,
      body,
      audience,
      transport: 'expo',
      notificationId,
      createdBy,
      createdAt: serverTimestamp(),
      processed: false,
    });
  } catch (error) {
    console.warn(`Notification ${notificationId} saved but its push request could not be queued:`, error);
    return false;
  }

  // Record that a request exists. Best effort: the queue entry is authoritative.
  try {
    await updateDoc(doc(firestore, 'notifications', notificationId), { queuedAt: serverTimestamp() });
  } catch (error) {
    console.warn(`Could not mark notification ${notificationId} as queued:`, error);
  }
  return true;
};

/**
 * Send a notification to admins when a user signs in
 */
export const sendUserSigninNotification = async (
  userId: string,
  userEmail: string
): Promise<NotificationSaveResult> => {
  if (!firestore) {
    throw new Error("Firestore is not initialized");
  }

  const notification: Omit<Notification, 'id'> = {
    type: 'update',
    title: 'User Signin',
    body: `${userEmail} has signed in`,
    audience: 'admins',
    createdAt: new Date(),
    createdBy: 'system',
    metadata: {
      userId,
      userEmail
    }
  };

  const notificationsCol = collection(firestore, 'notifications');
  const docRef = await addDoc(notificationsCol, {
    ...notification,
    createdAt: serverTimestamp(),
  });

  // The caller's uid is the push request's createdBy; the notification itself is 'system'.
  const pushQueued = await queuePushRequest(docRef.id, 'admins', notification.title, notification.body, userId);

  return { id: docRef.id, pushQueued };
};

/**
 * Send a notification to admins when a user signs up
 */
export const sendUserSignupNotification = async (
  userId: string,
  userEmail: string
): Promise<NotificationSaveResult> => {
  if (!firestore) {
    throw new Error("Firestore is not initialized");
  }

  const notification: Omit<Notification, 'id'> = {
    type: 'user_signup',
    title: 'New User Signup',
    body: `${userEmail} has signed up and needs approval`,
    audience: 'admins',
    createdAt: new Date(),
    createdBy: 'system',
    metadata: {
      userId,
      userEmail
    }
  };

  const notificationsCol = collection(firestore, 'notifications');
  const docRef = await addDoc(notificationsCol, {
    ...notification,
    createdAt: serverTimestamp(),
  });

  // The caller's uid is the push request's createdBy; the notification itself is 'system'.
  const pushQueued = await queuePushRequest(docRef.id, 'admins', notification.title, notification.body, userId);

  return { id: docRef.id, pushQueued };
};

/**
 * Create and send a notification from admin to users
 */
export const createAdminNotification = async (
  createdBy: string,
  type: NotificationType,
  title: string,
  body: string,
  audience: NotificationAudience = 'users',
  metadata?: Record<string, any>
): Promise<NotificationSaveResult> => {
  if (!firestore) {
    throw new Error("Firestore is not initialized");
  }

  const notification: Omit<Notification, 'id'> = {
    type,
    title,
    body,
    audience,
    createdAt: new Date(),
    createdBy,
    metadata: metadata || {}
  };

  const notificationsCol = collection(firestore, 'notifications');
  const docRef = await addDoc(notificationsCol, {
    ...notification,
    createdAt: serverTimestamp(),
  });

  const pushQueued = await queuePushRequest(docRef.id, audience, title, body, createdBy);

  return { id: docRef.id, pushQueued };
};

/**
 * Get notifications for a specific user role
 */
export const getNotificationsForRole = async (
  role: 'admin' | 'member',
  limitCount: number = 50
): Promise<Notification[]> => {
  if (!firestore) {
    throw new Error("Firestore is not initialized");
  }

  const notificationsCol = collection(firestore, 'notifications');
  
  // Admins see: user_signup notifications (audience: admins)
  // Users see: event, update, alert notifications (audience: users or all)
  const audience = role === 'admin' ? 'admins' : 'users';
  
  const q = query(
    notificationsCol,
    where('audience', 'in', [audience, 'all']),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
    sentAt: doc.data().sentAt?.toDate(),
    queuedAt: doc.data().queuedAt?.toDate(),
  } as Notification));
};

/**
 * Subscribe to real-time notifications for a specific role
 */
export const subscribeToNotifications = (
  role: 'admin' | 'member',
  callback: (notifications: Notification[]) => void,
  limitCount: number = 50
): (() => void) => {
  if (!firestore) {
    throw new Error("Firestore is not initialized");
  }

  const notificationsCol = collection(firestore, 'notifications');
  const audience = role === 'admin' ? 'admins' : 'users';
  
  const q = query(
    notificationsCol,
    where('audience', 'in', [audience, 'all']),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      sentAt: doc.data().sentAt?.toDate(),
      queuedAt: doc.data().queuedAt?.toDate(),
    } as Notification));
    callback(notifications);
  });

  return unsubscribe;
};

/**
 * Mark notification as read for a specific user
 */
export const markNotificationAsRead = async (notificationId: string, userId: string) => {
  if (!firestore) {
    throw new Error("Firestore is not initialized");
  }

  const userNotifRef = doc(firestore, 'users', userId, 'readNotifications', notificationId);
  await setDoc(userNotifRef, {
    read: true,
    readAt: serverTimestamp(),
  }, { merge: true });
};

/**
 * Dismiss notification for a specific user (hides it and marks as read)
 */
export const dismissNotificationForUser = async (notificationId: string, userId: string) => {
  if (!firestore) {
    throw new Error("Firestore is not initialized");
  }

  const userNotifRef = doc(firestore, 'users', userId, 'readNotifications', notificationId);
  await setDoc(userNotifRef, {
    read: true,
    readAt: serverTimestamp(),
    dismissed: true,
    dismissedAt: serverTimestamp(),
  }, { merge: true });
};

/**
 * Get notification read and dismissed states for a user
 */
export const getNotificationReadState = async (
  userId: string
): Promise<Map<string, { read: boolean; dismissed: boolean }>> => {
  if (!firestore) {
    throw new Error("Firestore is not initialized");
  }

  const readNotifsCol = collection(firestore, 'users', userId, 'readNotifications');
  const snapshot = await getDocs(readNotifsCol);
  const result = new Map<string, { read: boolean; dismissed: boolean }>();

  snapshot.docs.forEach((d) => {
    const data = d.data();
    result.set(d.id, {
      read: Boolean(data?.read),
      dismissed: Boolean(data?.dismissed),
    });
  });

  return result;
};

/**
 * Save the user's Expo push token (one per user: a second device overwrites the first)
 */
export const saveExpoPushToken = async (userId: string, token: string) => {
  if (!firestore) {
    throw new Error("Firestore is not initialized");
  }

  const userRef = doc(firestore, 'users', userId);
  await updateDoc(userRef, {
    expoPushToken: token,
    expoPushTokenUpdatedAt: serverTimestamp()
  });
};

/**
 * Get all users with Expo push tokens
 */
const getUsersWithTokens = async (role?: 'admin' | 'member'): Promise<Array<{ uid: string; expoPushToken: string }>> => {
  if (!firestore) {
    throw new Error("Firestore is not initialized");
  }

  const usersCol = collection(firestore, 'users');
  let q = query(usersCol, where('expoPushToken', '!=', null));
  
  if (role) {
    q = query(usersCol, where('expoPushToken', '!=', null), where('role', '==', role));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(doc => ({ uid: doc.id, expoPushToken: doc.data().expoPushToken }))
    .filter(user => user.expoPushToken);
};

/**
 * Delete old notifications (cleanup)
 */
export const deleteOldNotifications = async (daysOld: number = 30) => {
  if (!firestore) {
    throw new Error("Firestore is not initialized");
  }

  const notificationsCol = collection(firestore, 'notifications');
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const q = query(
    notificationsCol,
    where('createdAt', '<', Timestamp.fromDate(cutoffDate))
  );

  const snapshot = await getDocs(q);
  const deletePromises = snapshot.docs.map(doc => {
    const { deleteDoc } = require('firebase/firestore');
    return deleteDoc(doc.ref);
  });

  await Promise.all(deletePromises);
  return snapshot.size;
};

/**
 * Delete a specific notification by ID
 */
export const deleteNotification = async (notificationId: string) => {
  if (!firestore) {
    throw new Error("Firestore is not initialized");
  }

  const notificationDoc = doc(firestore, 'notifications', notificationId);
  await deleteDoc(notificationDoc);
};

/**
 * Update a specific notification by ID
 */
export const updateNotification = async (
  notificationId: string,
  updates: Partial<Omit<Notification, 'id' | 'createdAt'>>
) => {
  if (!firestore) {
    throw new Error("Firestore is not initialized");
  }

  const notificationDoc = doc(firestore, 'notifications', notificationId);
  const updateData = {
    ...updates,
    updatedAt: serverTimestamp(),
  };

  await updateDoc(notificationDoc, updateData);
  return notificationId;
};

/**
 * Get a specific notification by ID
 */
export const getNotificationById = async (notificationId: string): Promise<Notification | null> => {
  if (!firestore) {
    throw new Error("Firestore is not initialized");
  }

  const notificationDoc = doc(firestore, 'notifications', notificationId);
  const snapshot = await getDoc(notificationDoc);
  
  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
    createdAt: snapshot.data().createdAt?.toDate() || new Date(),
    sentAt: snapshot.data().sentAt?.toDate(),
    queuedAt: snapshot.data().queuedAt?.toDate(),
    updatedAt: snapshot.data().updatedAt?.toDate(),
  } as Notification;
};

/**
 * Get all notifications (admin only)
 */
export const getAllNotifications = async (limitCount: number = 100): Promise<Notification[]> => {
  if (!firestore) {
    throw new Error("Firestore is not initialized");
  }

  const notificationsCol = collection(firestore, 'notifications');
  const q = query(
    notificationsCol,
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
    sentAt: doc.data().sentAt?.toDate(),
    queuedAt: doc.data().queuedAt?.toDate(),
    updatedAt: doc.data().updatedAt?.toDate(),
  } as Notification));
};

/**
 * Get notifications count by type
 */
export const getNotificationStats = async (): Promise<{
  total: number;
  byType: Record<NotificationType, number>;
  byAudience: Record<NotificationAudience, number>;
}> => {
  if (!firestore) {
    throw new Error("Firestore is not initialized");
  }

  const notificationsCol = collection(firestore, 'notifications');
  const snapshot = await getDocs(notificationsCol);

  const stats = {
    total: snapshot.size,
    byType: {
      user_signup: 0,
      event: 0,
      update: 0,
      alert: 0,
    } as Record<NotificationType, number>,
    byAudience: {
      admins: 0,
      users: 0,
      all: 0,
    } as Record<NotificationAudience, number>,
  };

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const type = data.type as NotificationType;
    const audience = data.audience as NotificationAudience;
    
    if (type && stats.byType[type] !== undefined) {
      stats.byType[type]++;
    }
    
    if (audience && stats.byAudience[audience] !== undefined) {
      stats.byAudience[audience]++;
    }
  });

  return stats;
};
