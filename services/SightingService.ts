import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIREBASE_ENABLED, auth, app } from './firebase';
import { COLLECTIONS, Converters, newSighting, type SightingDTO } from './Data';
import { getFirestore, collection, doc, setDoc, getDocs, query, orderBy as fsOrderBy, where as fsWhere, limit as fsLimit, deleteDoc } from 'firebase/firestore';

export type Sighting = {
  id: string;
  userId: string;
  animalName: string;
  description?: string;
  location: { latitude: number; longitude: number };
  photoUrl?: string;
  timestamp: string;
  createdAt: number;
  updatedAt: number;
};

const storageKey = (uid?: string) => `SIGHTINGS_${uid || 'local'}`;

/**
 * Save a new wildlife sighting (user-specific)
 */
export async function saveSighting(sighting: Omit<Sighting, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) {
  const uid = FIREBASE_ENABLED ? auth?.currentUser?.uid : undefined;
  const key = storageKey(uid);
  const existing = await AsyncStorage.getItem(key);
  const list: Sighting[] = existing ? JSON.parse(existing) : [];
  
  const ts = Date.now();
  const newSightingObj: Sighting = {
    ...sighting,
    id: `${ts}_${Math.random().toString(36).slice(2, 8)}`,
    userId: uid || 'local',
    createdAt: ts,
    updatedAt: ts,
  };
  
  list.push(newSightingObj);
  await AsyncStorage.setItem(key, JSON.stringify(list));

  // Persist to Firestore user's subcollection when enabled and signed in
  try {
    if (FIREBASE_ENABLED && app && auth?.currentUser?.uid) {
      const db = getFirestore(app as any);
      const dto: SightingDTO = newSighting({
        id: newSightingObj.id,
        animalName: newSightingObj.animalName,
        description: newSightingObj.description,
        location: newSightingObj.location,
        photoUrl: newSightingObj.photoUrl,
        timestamp: newSightingObj.timestamp,
        createdAt: newSightingObj.createdAt,
        updatedAt: newSightingObj.updatedAt,
      });
      // Store in user's subcollection: users/{uid}/sightings/{sightingId}
      const ref = doc(collection(db, COLLECTIONS.users, auth.currentUser.uid, COLLECTIONS.sightings), dto.id).withConverter(Converters?.sighting as any);
      await setDoc(ref, dto as any, { merge: false });
    }
  } catch (e) {
    console.warn('Failed to save sighting to Firestore:', e);
  }
  
  return newSightingObj;
}

/**
 * Get all sightings for the current user
 */
export async function getMySightings(filters?: { limit?: number }) {
  const uid = FIREBASE_ENABLED ? auth?.currentUser?.uid : undefined;
  
  if (!uid) {
    // If no user, return local sightings only
    const key = storageKey();
    const existing = await AsyncStorage.getItem(key);
    const list: Sighting[] = existing ? JSON.parse(existing) : [];
    return list.sort((a, b) => b.createdAt - a.createdAt);
  }
  
  // Prefer Firestore when available (user's subcollection)
  if (FIREBASE_ENABLED && app) {
    try {
      const db = getFirestore(app as any);
      const sightingsCol = collection(db, COLLECTIONS.users, uid, COLLECTIONS.sightings).withConverter(Converters?.sighting as any);
      
      let q = query(sightingsCol, fsOrderBy('createdAt', 'desc'));
      
      if (filters?.limit) {
        q = query(q, fsLimit(filters.limit));
      }
      
      const snap = await getDocs(q);
      const sightings: Sighting[] = snap.docs.map(d => {
        const o = d.data() as SightingDTO;
        return {
          id: o.id,
          userId: o.userId,
          animalName: o.animalName,
          description: o.description,
          location: o.location,
          photoUrl: o.photoUrl,
          timestamp: o.timestamp,
          createdAt: o.createdAt,
          updatedAt: o.updatedAt,
        } as Sighting;
      });
      
      return sightings;
    } catch (e) {
      console.warn('Failed to load sightings from Firestore, falling back to local:', e);
    }
  }
  
  // Local fallback
  const key = storageKey(uid);
  const existing = await AsyncStorage.getItem(key);
  const list: Sighting[] = existing ? JSON.parse(existing) : [];
  
  let sorted = list.sort((a, b) => b.createdAt - a.createdAt);
  
  if (filters?.limit) {
    sorted = sorted.slice(0, filters.limit);
  }
  
  return sorted;
}

/**
 * Delete a sighting
 */
export async function deleteSighting(sightingId: string) {
  const uid = FIREBASE_ENABLED ? auth?.currentUser?.uid : undefined;
  const key = storageKey(uid);
  const existing = await AsyncStorage.getItem(key);
  const list: Sighting[] = existing ? JSON.parse(existing) : [];
  
  const filtered = list.filter(s => s.id !== sightingId);
  await AsyncStorage.setItem(key, JSON.stringify(filtered));

  // Delete from Firestore if enabled
  try {
    if (FIREBASE_ENABLED && app && uid) {
      const db = getFirestore(app as any);
      const ref = doc(db, COLLECTIONS.users, uid, COLLECTIONS.sightings, sightingId);
      await deleteDoc(ref);
    }
  } catch (e) {
    console.warn('Failed to delete sighting from Firestore:', e);
  }
}

/**
 * Get a single sighting by ID
 */
export async function getSightingById(sightingId: string): Promise<Sighting | null> {
  const sightings = await getMySightings();
  return sightings.find(s => s.id === sightingId) || null;
}
