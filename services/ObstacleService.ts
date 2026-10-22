import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIREBASE_ENABLED, auth, app } from './firebase';
import { COLLECTIONS, Converters, newObstacle, type ObstacleDTO, type ObstacleType, type ObstacleSeverity, type ObstacleStatus, userProfileConverter } from './Data';
import { getFirestore, collection, doc, setDoc, getDocs, getDoc, query, orderBy as fsOrderBy, where as fsWhere, GeoPoint, limit as fsLimit, arrayUnion, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

export type Obstacle = {
  id: string;
  userId: string;
  userName?: string; // Display name of user who marked the obstacle
  type: ObstacleType;
  severity: ObstacleSeverity;
  status: ObstacleStatus;
  title: string;
  description?: string;
  location: { latitude: number; longitude: number };
  photoUrl?: string;
  reportedAt: number;
  resolvedAt?: number;
  verifiedBy?: string[];
  createdAt: number;
  updatedAt: number;
};

/**
 * Where the hazard feed stands. Only `live` means the data came from the server;
 * `cached` is Firestore's offline cache, `unavailable` means Firebase is not configured
 * and `error` means the read or subscription failed.
 */
export type ObstacleFeedStatus = 'unavailable' | 'connecting' | 'live' | 'cached' | 'error';

export type ObstacleFetchResult = {
  obstacles: Obstacle[];
  status: Exclude<ObstacleFeedStatus, 'connecting'>;
  fetchedAt: number;
};

/** How long to wait for the server to acknowledge a report before calling it "not published". */
const PUBLISH_TIMEOUT_MS = 10_000;

const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out')), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });

const toObstacle = (o: ObstacleDTO): Obstacle => ({
  id: o.id,
  userId: o.userId,
  userName: o.userName,
  type: o.type,
  severity: o.severity,
  status: o.status,
  title: o.title,
  description: o.description,
  location: o.location,
  photoUrl: o.photoUrl,
  reportedAt: o.reportedAt,
  resolvedAt: o.resolvedAt,
  verifiedBy: o.verifiedBy || [],
  createdAt: o.createdAt,
  updatedAt: o.updatedAt,
});

const storageKey = (uid?: string) => `OBSTACLES_${uid || 'local'}`;
const globalStorageKey = 'OBSTACLES_GLOBAL';

/**
 * Get user's display name from Firestore
 */
async function getUserDisplayName(uid: string): Promise<string | undefined> {
  try {
    if (FIREBASE_ENABLED && app) {
      const db = getFirestore(app as any);
      const userRef = doc(db, COLLECTIONS.users, uid).withConverter(userProfileConverter as any);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        return userData.displayName || userData.email || 'Anonymous';
      }
    }
  } catch (e) {
    console.warn('Failed to fetch user display name:', e);
  }
  return undefined;
}

/**
 * Save a new obstacle report on this device and try to publish it to Firestore.
 * `published` is true only when the server acknowledged the write; otherwise the
 * report exists on this device only and other riders cannot see it yet.
 */
export async function saveObstacle(
  obstacle: Omit<Obstacle, 'id' | 'createdAt' | 'updatedAt' | 'reportedAt' | 'userId' | 'userName' | 'verifiedBy'>
): Promise<Obstacle & { published: boolean }> {
  const uid = FIREBASE_ENABLED ? auth?.currentUser?.uid : undefined;
  const key = storageKey(uid);
  const existing = await AsyncStorage.getItem(key);
  const list: Obstacle[] = existing ? JSON.parse(existing) : [];
  
  // Fetch user's display name if logged in
  const userName = uid ? await getUserDisplayName(uid) : undefined;
  
  const ts = Date.now();
  const newObstacleObj: Obstacle = {
    ...obstacle,
    id: `${ts}_${Math.random().toString(36).slice(2, 8)}`,
    userId: uid || 'local',
    userName,
    reportedAt: ts,
    verifiedBy: [],
    createdAt: ts,
    updatedAt: ts,
  };
  
  list.push(newObstacleObj);
  await AsyncStorage.setItem(key, JSON.stringify(list));

  // Also persist to Firestore global collection when enabled and signed in
  let published = false;
  try {
    if (FIREBASE_ENABLED && app && auth?.currentUser?.uid) {
      console.log('[ObstacleService] Saving obstacle to Firestore:', newObstacleObj.id);
      const db = getFirestore(app as any);
      const dto: ObstacleDTO = newObstacle({
        id: newObstacleObj.id,
        userId: newObstacleObj.userId,
        userName: newObstacleObj.userName,
        type: newObstacleObj.type,
        severity: newObstacleObj.severity,
        status: newObstacleObj.status,
        title: newObstacleObj.title,
        description: newObstacleObj.description,
        location: newObstacleObj.location,
        photoUrl: newObstacleObj.photoUrl,
        reportedAt: newObstacleObj.reportedAt,
        createdAt: newObstacleObj.createdAt,
        updatedAt: newObstacleObj.updatedAt,
      });
      const ref = doc(collection(db, COLLECTIONS.obstacles), dto.id).withConverter(Converters?.obstacle as any);
      // setDoc only settles once the server answers, so an offline write would hang the form.
      await withTimeout(setDoc(ref, dto as any, { merge: false }), PUBLISH_TIMEOUT_MS);
      published = true;
      console.log('[ObstacleService] Successfully saved obstacle to Firestore');
    }
  } catch (e) {
    console.warn('[ObstacleService] Failed to save obstacle to Firestore:', e);
  }

  return { ...newObstacleObj, published };
}

/**
 * Get obstacles together with how trustworthy the read is. A local-storage fallback
 * (Firebase off, or the server read failed) is reported as `unavailable` / `error`
 * so callers never present it as a checked, up-to-date feed.
 */
export async function fetchObstacles(filters?: { status?: ObstacleStatus; limit?: number }): Promise<ObstacleFetchResult> {
  const uid = FIREBASE_ENABLED ? auth?.currentUser?.uid : undefined;
  let status: ObstacleFetchResult['status'] = 'unavailable';

  // Prefer Firestore when available (global collection)
  if (FIREBASE_ENABLED && app) {
    try {
      const db = getFirestore(app as any);
      const obstaclesCol = collection(db, COLLECTIONS.obstacles).withConverter(Converters?.obstacle as any);

      let q = query(obstaclesCol, fsOrderBy('createdAt', 'desc'));

      if (filters?.status) {
        q = query(q, fsWhere('status', '==', filters.status));
      }

      if (filters?.limit) {
        q = query(q, fsLimit(filters.limit));
      }

      const snap = await getDocs(q);
      const obstacles: Obstacle[] = snap.docs.map(d => toObstacle(d.data() as ObstacleDTO));
      return { obstacles, status: snap.metadata?.fromCache ? 'cached' : 'live', fetchedAt: Date.now() };
    } catch (e) {
      console.warn('Failed to load obstacles from Firestore, falling back to local:', e);
      status = 'error';
    }
  }

  // Local fallback - merge user's own obstacles with global cache
  const key = storageKey(uid);
  const globalKey = globalStorageKey;

  const [userObstacles, globalObstacles] = await Promise.all([
    AsyncStorage.getItem(key),
    AsyncStorage.getItem(globalKey),
  ]);

  const userList: Obstacle[] = userObstacles ? JSON.parse(userObstacles) : [];
  const globalList: Obstacle[] = globalObstacles ? JSON.parse(globalObstacles) : [];

  // Merge and deduplicate
  const mergedMap = new Map<string, Obstacle>();
  [...globalList, ...userList].forEach(o => mergedMap.set(o.id, o));

  let list = Array.from(mergedMap.values());

  if (filters?.status) {
    list = list.filter(o => o.status === filters.status);
  }

  list = list.sort((a, b) => b.createdAt - a.createdAt);

  if (filters?.limit) {
    list = list.slice(0, filters.limit);
  }

  return { obstacles: list, status, fetchedAt: Date.now() };
}

/**
 * Get all obstacles (global - visible to all users)
 */
export async function getObstacles(filters?: { status?: ObstacleStatus; limit?: number }) {
  return (await fetchObstacles(filters)).obstacles;
}

/**
 * Get obstacles in a specific geographic area (for map display)
 */
export async function getObstaclesInArea(
  center: { latitude: number; longitude: number },
  radiusKm: number = 10,
  filters?: { status?: ObstacleStatus }
) {
  const obstacles = await getObstacles(filters);
  
  // Simple distance calculation (Haversine formula)
  const toRad = (deg: number) => deg * (Math.PI / 180);
  const R = 6371; // Earth's radius in km
  
  return obstacles.filter(obstacle => {
    const lat1 = toRad(center.latitude);
    const lat2 = toRad(obstacle.location.latitude);
    const dLat = toRad(obstacle.location.latitude - center.latitude);
    const dLon = toRad(obstacle.location.longitude - center.longitude);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance <= radiusKm;
  });
}

/**
 * Update obstacle status (e.g., mark as resolved)
 */
export async function updateObstacleStatus(obstacleId: string, status: ObstacleStatus) {
  const uid = FIREBASE_ENABLED ? auth?.currentUser?.uid : undefined;
  const key = storageKey(uid);
  const existing = await AsyncStorage.getItem(key);
  const list: Obstacle[] = existing ? JSON.parse(existing) : [];
  
  const index = list.findIndex(o => o.id === obstacleId);
  if (index >= 0) {
    list[index].status = status;
    list[index].updatedAt = Date.now();
    if (status === 'resolved') {
      list[index].resolvedAt = Date.now();
    }
    await AsyncStorage.setItem(key, JSON.stringify(list));
  }

  // Update in Firestore if enabled
  try {
    if (FIREBASE_ENABLED && app) {
      const db = getFirestore(app as any);
      const ref = doc(db, COLLECTIONS.obstacles, obstacleId).withConverter(Converters?.obstacle as any);
      await setDoc(ref, { 
        status, 
        updatedAt: Date.now(),
        ...(status === 'resolved' ? { resolvedAt: Date.now() } : {})
      } as any, { merge: true });
    }
  } catch (e) {
    console.warn('Failed to update obstacle in Firestore:', e);
  }
}

export async function removeObstacle(obstacleId: string) {
  const uid = FIREBASE_ENABLED ? auth?.currentUser?.uid : undefined;
  const userKey = storageKey(uid);
  const globalKey = globalStorageKey;

  // Clean local per-user cache
  try {
    const existingUser = await AsyncStorage.getItem(userKey);
    if (existingUser) {
      const list: Obstacle[] = JSON.parse(existingUser);
      const filtered = list.filter(o => o.id !== obstacleId);
      if (filtered.length !== list.length) {
        await AsyncStorage.setItem(userKey, JSON.stringify(filtered));
      }
    }
  } catch (e) {
    console.warn('Failed to update local user obstacles cache:', e);
  }

  // Clean local global cache (if used)
  try {
    const existingGlobal = await AsyncStorage.getItem(globalKey);
    if (existingGlobal) {
      const list: Obstacle[] = JSON.parse(existingGlobal);
      const filtered = list.filter(o => o.id !== obstacleId);
      if (filtered.length !== list.length) {
        await AsyncStorage.setItem(globalKey, JSON.stringify(filtered));
      }
    }
  } catch (e) {
    console.warn('Failed to update local global obstacles cache:', e);
  }

  // Delete from Firestore when enabled
  try {
    if (FIREBASE_ENABLED && app) {
      const db = getFirestore(app as any);
      const ref = doc(collection(db, COLLECTIONS.obstacles), obstacleId);
      await deleteDoc(ref);
    }
  } catch (e) {
    console.warn('Failed to delete obstacle from Firestore:', e);
  }
}

/**
 * Verify an obstacle (add current user to verifiedBy array)
 */
export async function verifyObstacle(obstacleId: string) {
  const uid = FIREBASE_ENABLED ? auth?.currentUser?.uid : undefined;
  if (!uid) return;

  const key = storageKey(uid);
  const existing = await AsyncStorage.getItem(key);
  const list: Obstacle[] = existing ? JSON.parse(existing) : [];
  
  const index = list.findIndex(o => o.id === obstacleId);
  if (index >= 0) {
    if (!list[index].verifiedBy) {
      list[index].verifiedBy = [];
    }
    if (!list[index].verifiedBy!.includes(uid)) {
      list[index].verifiedBy!.push(uid);
      list[index].updatedAt = Date.now();
      await AsyncStorage.setItem(key, JSON.stringify(list));
    }
  }

  // Update in Firestore if enabled
  try {
    if (FIREBASE_ENABLED && app) {
      const db = getFirestore(app as any);
      const ref = doc(db, COLLECTIONS.obstacles, obstacleId);
      // Use arrayUnion to append uid without overwriting existing verifications
      await updateDoc(ref, {
        verifiedBy: arrayUnion(uid),
        updatedAt: Date.now()
      });
    }
  } catch (e) {
    console.warn('Failed to verify obstacle in Firestore:', e);
  }
}

/**
 * Get user's own obstacle reports
 */
export async function getMyObstacles() {
  const uid = FIREBASE_ENABLED ? auth?.currentUser?.uid : undefined;
  if (!uid) return [];
  
  const allObstacles = await getObstacles();
  return allObstacles.filter(o => o.userId === uid);
}

/**
 * Subscribe to real-time obstacle updates.
 * `onStatus` reports whether the data is really live: `connecting` until the first
 * snapshot, then `live` (server data) or `cached` (offline cache), `unavailable` when
 * Firebase is not configured, and `error` when the listener fails (the one-shot fetch
 * fallback still runs so the callback receives whatever is stored on the device).
 * Returns an unsubscribe function.
 */
export function subscribeToObstacles(
  callback: (obstacles: Obstacle[]) => void,
  filters?: { status?: ObstacleStatus },
  onStatus?: (status: ObstacleFeedStatus) => void
): () => void {
  if (!FIREBASE_ENABLED || !app) {
    console.warn('Real-time subscriptions require Firebase');
    onStatus?.('unavailable');
    return () => {}; // Return empty unsubscribe function
  }

  onStatus?.('connecting');

  const db = getFirestore(app as any);
  const obstaclesCol = collection(db, COLLECTIONS.obstacles).withConverter(Converters?.obstacle as any);

  let q = query(obstaclesCol, fsOrderBy('createdAt', 'desc'));

  if (filters?.status) {
    q = query(q, fsWhere('status', '==', filters.status));
  }

  // includeMetadataChanges so a cached snapshot is followed by another once the server answers
  const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
    onStatus?.(snapshot.metadata.fromCache ? 'cached' : 'live');
    callback(snapshot.docs.map(d => toObstacle(d.data() as ObstacleDTO)));
  }, (error) => {
    console.warn('[ObstacleService] Real-time subscription error:', error);
    onStatus?.('error');
    // Fallback to manual fetch on error
    getObstacles(filters).then(callback).catch(err => {
      console.warn('[ObstacleService] Fallback fetch failed:', err);
    });
  });

  return unsubscribe;
}
