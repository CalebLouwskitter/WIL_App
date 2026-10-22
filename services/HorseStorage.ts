import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIREBASE_ENABLED, auth, app } from './firebase';
import { COLLECTIONS, Converters, newHorse, listDocs, type HorseDTO, getOrCreateUserProfile } from './Data';
// Direct Firestore imports for nested subcollection usage
import { getFirestore, collection, doc, setDoc, getDocs, query, orderBy as fsOrderBy, deleteDoc } from 'firebase/firestore';

export type Horse = {
  id: string;
  name: string;
  breed?: string;
  age?: number;
  notes?: string;
  createdAt: number;
  userId?: string;
};

const storageKey = (uid?: string) => `HORSES_${uid || 'local'}`;

const toHorse = (h: HorseDTO): Horse => ({
  id: h.id,
  name: h.name,
  breed: h.breed,
  age: h.age,
  notes: h.notes,
  createdAt: h.createdAt,
  userId: h.userId,
});

export async function saveHorse(horse: Omit<Horse, 'id' | 'createdAt' | 'userId'>) {
  const uid = FIREBASE_ENABLED ? auth?.currentUser?.uid : undefined;
  const key = storageKey(uid);
  const existing = await AsyncStorage.getItem(key);
  const list: Horse[] = existing ? JSON.parse(existing) : [];
  const newHorseObj: Horse = {
    ...horse,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    userId: uid,
  };
  list.push(newHorseObj);
  await AsyncStorage.setItem(key, JSON.stringify(list));

  // Also persist to Firestore under users/{uid}/horses when enabled and signed in
  try {
    if (FIREBASE_ENABLED && app && auth?.currentUser?.uid) {
      const uid = auth.currentUser.uid;
      const db = getFirestore(app as any);
      await getOrCreateUserProfile(auth.currentUser);
      const dto: HorseDTO = newHorse({
        id: newHorseObj.id,
        userId: uid,
        name: newHorseObj.name,
        breed: newHorseObj.breed,
        age: newHorseObj.age,
        notes: newHorseObj.notes,
        createdAt: newHorseObj.createdAt,
      });
      const ref = doc(collection(db, COLLECTIONS.users, uid, 'horses'), dto.id).withConverter(Converters?.horse as any);
      await setDoc(ref, dto as any, { merge: false });
    }
  } catch (e) {
    console.warn('Failed to save horse to Firestore:', e);
  }
  return newHorseObj;
}

export async function getHorses() {
  const uid = FIREBASE_ENABLED ? auth?.currentUser?.uid : undefined;
  // Prefer Firestore when available and signed in
  if (FIREBASE_ENABLED && uid) {
    try {
      const db = getFirestore(app as any);
      // Primary: nested subcollection users/{uid}/horses
      const nestedCol = collection(db, COLLECTIONS.users, uid, 'horses').withConverter(Converters?.horse as any);
      const q = query(nestedCol, fsOrderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const horses: Horse[] = snap.docs.map(d => toHorse(d.data() as HorseDTO));

      // Legacy top-level horses are never deleted here. Any whose id is not in
      // the nested collection yet is shown and copied across; a failed copy
      // leaves it visible and is retried on the next read.
      const nestedIds = new Set(horses.map(h => h.id));
      let legacy: HorseDTO[] = [];
      try {
        legacy = await listDocs<HorseDTO>(COLLECTIONS.horses, {
          where: ['userId', '==', uid],
          orderBy: ['createdAt', 'desc'],
          converter: Converters?.horse as any,
        });
      } catch (e) {
        console.warn('Failed to read legacy horses:', e);
      }
      for (const h of legacy) {
        if (nestedIds.has(h.id)) continue;
        horses.push(toHorse(h));
        try {
          const ref = doc(collection(db, COLLECTIONS.users, uid, 'horses'), h.id).withConverter(Converters?.horse as any);
          await setDoc(ref, h as any, { merge: false });
        } catch (e) {
          console.warn('Failed to copy legacy horse, will retry on next load:', h.id, e);
        }
      }

      if (horses.length === 0) {
        const key = storageKey(uid);
        const existing = await AsyncStorage.getItem(key);
        const localList: Horse[] = existing ? JSON.parse(existing) : [];
        if (localList.length > 0) {
          try {
            for (const lh of localList) {
              const dto: HorseDTO = newHorse({
                id: lh.id,
                userId: uid,
                name: lh.name,
                breed: lh.breed,
                age: lh.age,
                notes: lh.notes,
                createdAt: lh.createdAt,
              });
              const ref = doc(collection(db, COLLECTIONS.users, uid, 'horses'), dto.id).withConverter(Converters?.horse as any);
              await setDoc(ref, dto as any, { merge: false });
            }
          } catch {}
          return localList.sort((a, b) => b.createdAt - a.createdAt);
        }
      }

      return horses.sort((a, b) => b.createdAt - a.createdAt);
    } catch (e) {
      console.warn('Failed to load horses from Firestore, falling back to local:', e);
    }
  }
  const key = storageKey(uid);
  const existing = await AsyncStorage.getItem(key);
  const list: Horse[] = existing ? JSON.parse(existing) : [];
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

const activeKey = (uid?: string) => `ACTIVE_HORSE_${uid || 'local'}`;

export async function setActiveHorseId(horseId: string | null) {
  const uid = FIREBASE_ENABLED ? auth?.currentUser?.uid : undefined;
  const key = activeKey(uid);
  if (horseId) {
    await AsyncStorage.setItem(key, horseId);
  } else {
    await AsyncStorage.removeItem(key);
  }
}

export async function getActiveHorseId() {
  const uid = FIREBASE_ENABLED ? auth?.currentUser?.uid : undefined;
  const key = activeKey(uid);
  return AsyncStorage.getItem(key);
}

export async function getActiveHorse(): Promise<Horse | null> {
  const [id, list] = await Promise.all([getActiveHorseId(), getHorses()]);
  if (!id) return null;
  return list.find(h => h.id === id) || null;
}

// Delete a horse by id from local storage and Firestore (when enabled)
export async function deleteHorse(horseId: string) {
  const uid = FIREBASE_ENABLED ? auth?.currentUser?.uid : undefined;
  const key = storageKey(uid);
  try {
    const existing = await AsyncStorage.getItem(key);
    const list: Horse[] = existing ? JSON.parse(existing) : [];
    const filtered = list.filter(h => h.id !== horseId);
    await AsyncStorage.setItem(key, JSON.stringify(filtered));
  } catch (e) {
    console.warn('Failed to delete horse locally:', e);
  }

  // Firestore deletion
  try {
    if (FIREBASE_ENABLED && app && auth?.currentUser?.uid) {
      const uid = auth.currentUser.uid;
      const db = getFirestore(app as any);
      try {
        const nestedRef = doc(collection(db, COLLECTIONS.users, uid, 'horses'), horseId).withConverter(Converters?.horse as any);
        await deleteDoc(nestedRef as any);
      } catch {}
      // Attempt legacy top-level deletion as well
      try {
        const topRef = doc(collection(db, COLLECTIONS.horses), horseId);
        await deleteDoc(topRef);
      } catch {}
    }
  } catch (e) {
    console.warn('Failed to delete horse from Firestore:', e);
  }

  // Clear active horse if this was active
  try {
    const active = await getActiveHorseId();
    if (active === horseId) {
      await setActiveHorseId(null);
    }
  } catch {}
}
