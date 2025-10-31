import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
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
    sentAt: new Date(),
    metadata: {
      test: true
    }
  };

  const notificationsCol = collection(firestore, 'notifications');
  const docRef = await addDoc(notificationsCol, {
    ...notification,
    createdAt: serverTimestamp(),
    sentAt: serverTimestamp(),
  });

  return docRef.id;
};

/**
 * Send a notification to admins when a user signs in
 */
export const sendUserSigninNotification = async (userId: string, userEmail: string) => {
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

  // Send FCM push notification to all admins
  await sendPushToAdmins(notification.title, notification.body);

  return docRef.id;
};

/**
 * Send a notification to admins when a user signs up
 */
export const sendUserSignupNotification = async (userId: string, userEmail: string) => {
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

  // Send FCM push notification to all admins
  await sendPushToAdmins(notification.title, notification.body);

  return docRef.id;
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
): Promise<string> => {
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
    sentAt: new Date(),
    metadata: metadata || {}
  };

  const notificationsCol = collection(firestore, 'notifications');
  const docRef = await addDoc(notificationsCol, {
    ...notification,
    createdAt: serverTimestamp(),
    sentAt: serverTimestamp(),
  });

  // Send FCM push notification based on audience
  if (audience === 'users') {
    await sendPushToUsers(title, body);
  } else if (audience === 'admins') {
    await sendPushToAdmins(title, body);
  } else if (audience === 'all') {
    await sendPushToAllUsers(title, body);
  }

  return docRef.id;
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
  await updateDoc(userNotifRef, {
    read: true,
    readAt: serverTimestamp()
  }).catch(async () => {
    // If doesn't exist, create it
    const { setDoc } = await import('firebase/firestore');
    await setDoc(userNotifRef, {
      read: true,
      readAt: serverTimestamp()
    });
  });
};

/**
 * Save FCM token for a user
 */
export const saveFCMToken = async (userId: string, token: string) => {
  if (!firestore) {
    throw new Error("Firestore is not initialized");
  }

  const userRef = doc(firestore, 'users', userId);
  await updateDoc(userRef, {
    fcmToken: token,
    fcmTokenUpdatedAt: serverTimestamp()
  });
};

/**
 * Get all users with FCM tokens
 */
const getUsersWithTokens = async (role?: 'admin' | 'member'): Promise<Array<{ uid: string; fcmToken: string }>> => {
  if (!firestore) {
    throw new Error("Firestore is not initialized");
  }

  const usersCol = collection(firestore, 'users');
  let q = query(usersCol, where('fcmToken', '!=', null));
  
  if (role) {
    q = query(usersCol, where('fcmToken', '!=', null), where('role', '==', role));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(doc => ({ uid: doc.id, fcmToken: doc.data().fcmToken }))
    .filter(user => user.fcmToken);
};

/**
 * Send push notification to all admins
 */
const sendPushToAdmins = async (title: string, body: string) => {
  // This requires a backend Cloud Function to actually send FCM messages
  // We'll store the request in Firestore and let a Cloud Function process it
  if (!firestore) return;

  const pushRequestsCol = collection(firestore, 'pushNotificationRequests');
  await addDoc(pushRequestsCol, {
    title,
    body,
    audience: 'admins',
    createdAt: serverTimestamp(),
    processed: false
  });
};

/**
 * Send push notification to all regular users
 */
const sendPushToUsers = async (title: string, body: string) => {
  if (!firestore) return;

  const pushRequestsCol = collection(firestore, 'pushNotificationRequests');
  await addDoc(pushRequestsCol, {
    title,
    body,
    audience: 'users',
    createdAt: serverTimestamp(),
    processed: false
  });
};

/**
 * Send push notification to all users (admins + members)
 */
const sendPushToAllUsers = async (title: string, body: string) => {
  if (!firestore) return;

  const pushRequestsCol = collection(firestore, 'pushNotificationRequests');
  await addDoc(pushRequestsCol, {
    title,
    body,
    audience: 'all',
    createdAt: serverTimestamp(),
    processed: false
  });
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
