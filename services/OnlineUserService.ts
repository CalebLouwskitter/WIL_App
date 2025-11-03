import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIREBASE_ENABLED, auth, app } from './firebase';
import { getFirestore, collection, doc, setDoc, getDocs, query, where, orderBy, Timestamp, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import * as Location from 'expo-location';
import { isWithinAuthorizedArea } from '../utils/geofencing';

export type OnlineUser = {
  uid: string;
  displayName?: string;
  photoURL?: string;
  location: {
    latitude: number;
    longitude: number;
  };
  lastSeen: number;
  isRiding?: boolean;
  deviceId?: string;
};

const LOCATION_UPDATE_INTERVAL = 2 * 60 * 1000;
const ONLINE_THRESHOLD = 30 * 60 * 1000;

const storageKey = 'ONLINE_USERS_LOCAL';
const deviceIdKey = 'DEVICE_ID';
let updateTimer: NodeJS.Timeout | null = null;

async function getOrCreateDeviceId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(deviceIdKey);
    if (existing) return existing;
    const id = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    await AsyncStorage.setItem(deviceIdKey, id);
    return id;
  } catch {
    return 'device';
  }
}

export async function getDeviceId() {
  return getOrCreateDeviceId();
}

type StartLocationBroadcastOptions = {
  isRiding?: boolean;
};

export async function startLocationBroadcast({ isRiding = false }: StartLocationBroadcastOptions = {}) {
  if (!FIREBASE_ENABLED || !auth?.currentUser) {
    console.warn('Firebase not enabled or user not authenticated');
    return;
  }

  const broadcast = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Location permission not granted');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Check if location is within authorized boundary
      const isInBounds = isWithinAuthorizedArea({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (!isInBounds) {
        console.warn('[OnlineUserService] Location outside authorized area - not broadcasting');
        return;
      }

      const db = getFirestore(app as any);
      const currentUser = auth?.currentUser;
      if (!currentUser) return;
      const deviceId = await getOrCreateDeviceId();
      const docId = `${currentUser.uid}_${deviceId}`;
      const userLocationRef = doc(db, 'onlineUsers', docId);
      
      await setDoc(userLocationRef, {
        uid: currentUser.uid,
        deviceId,
        displayName: currentUser.displayName || 'Anonymous',
        photoURL: currentUser.photoURL || null,
        location: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
        lastSeen: Date.now(),
        isRiding,
        updatedAt: Timestamp.now(),
      }, { merge: true });

      console.log('Location broadcast successful');
    } catch (error) {
      console.warn('Failed to broadcast location:', error);
    }
  };

  await broadcast();

  if (updateTimer) {
    clearInterval(updateTimer);
  }
  updateTimer = setInterval(broadcast, LOCATION_UPDATE_INTERVAL);
}

export function stopLocationBroadcast() {
  if (updateTimer) {
    clearInterval(updateTimer);
    updateTimer = null;
  }

  if (FIREBASE_ENABLED && auth?.currentUser && app) {
    (async () => {
      try {
        const db = getFirestore(app);
        const deviceId = await getOrCreateDeviceId();
        const docId = `${auth.currentUser!.uid}_${deviceId}`;
        const userLocationRef = doc(db, 'onlineUsers', docId);
        await setDoc(userLocationRef, { isRiding: false, lastSeen: Date.now() }, { merge: true });
      } catch (e) {
        console.warn(e);
      }
    })();
  }
}

export async function getOnlineUsers(): Promise<OnlineUser[]> {
  if (!FIREBASE_ENABLED || !app) {
    const cached = await AsyncStorage.getItem(storageKey);
    return cached ? JSON.parse(cached) : [];
  }

  try {
    console.log('[OnlineUserService] getOnlineUsers: querying recent users...');
    const db = getFirestore(app);
    const onlineUsersRef = collection(db, 'onlineUsers');
    const threshold = Date.now() - ONLINE_THRESHOLD;
    
    const q = query(
      onlineUsersRef,
      where('lastSeen', '>=', threshold),
      orderBy('lastSeen', 'desc')
    );

    const snapshot = await getDocs(q);
    console.log(`[OnlineUserService] getOnlineUsers: snapshot size=${snapshot.size}`);
    const users: OnlineUser[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      users.push({
        uid: data.uid,
        displayName: data.displayName,
        photoURL: data.photoURL,
        location: data.location,
        lastSeen: data.lastSeen,
        isRiding: data.isRiding,
        deviceId: data.deviceId,
      });
    });

    console.log(`[OnlineUserService] getOnlineUsers: returning users=${users.length}`);
    await AsyncStorage.setItem(storageKey, JSON.stringify(users));
    return users;
  } catch (error) {
    console.warn('Failed to fetch online users:', error);
    const cached = await AsyncStorage.getItem(storageKey);
    return cached ? JSON.parse(cached) : [];
  }
}

export function subscribeToOnlineUsers(callback: (users: OnlineUser[]) => void): Unsubscribe {
  if (!FIREBASE_ENABLED || !app) {
    return () => {};
  }

  const db = getFirestore(app);
  const onlineUsersRef = collection(db, 'onlineUsers');
  const threshold = Date.now() - ONLINE_THRESHOLD;
  
  const q = query(
    onlineUsersRef,
    where('lastSeen', '>=', threshold),
    orderBy('lastSeen', 'desc')
  );

  console.log('[OnlineUserService] subscribeToOnlineUsers: subscribing...');
  return onSnapshot(q, (snapshot) => {
    console.log(`[OnlineUserService] onSnapshot: size=${snapshot.size}`);
    const users: OnlineUser[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      users.push({
        uid: data.uid,
        displayName: data.displayName,
        photoURL: data.photoURL,
        location: data.location,
        lastSeen: data.lastSeen,
        isRiding: data.isRiding,
        deviceId: data.deviceId,
      });
    });
    console.log(`[OnlineUserService] onSnapshot: users after filter=${users.length}`);
    callback(users);
    AsyncStorage.setItem(storageKey, JSON.stringify(users));
  }, (error) => {
    console.warn('Online users subscription error:', error);
  });
}
