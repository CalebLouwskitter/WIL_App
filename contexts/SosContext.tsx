import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { FIREBASE_ENABLED, app, auth } from '@/services/firebase';
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  collection,
} from 'firebase/firestore';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SosState = {
  active: boolean;
  name: string | null;
  uid?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type SosContextType = {
  state: SosState;
  activate: (name: string | null | undefined, uid?: string | null | undefined) => Promise<void>;
  clear: () => Promise<void>;
};

const SosContext = createContext<SosContextType | undefined>(undefined);

export const SosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SosState>({ active: false, name: null, uid: null });

  // Resolve an actor ID for SOS actions: prefer authenticated UID, else a persistent device ID
  const getOrCreateDeviceId = useCallback(async (): Promise<string> => {
    const KEY = 'sos_device_id';
    try {
      const existing = await AsyncStorage.getItem(KEY);
      if (existing && existing.length > 0) return existing;
      const generated = `device_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      await AsyncStorage.setItem(KEY, generated);
      return generated;
    } catch {
      // Fallback non-persistent
      return `device_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    }
  }, []);

  const resolveActorId = useCallback(async (hintUid?: string | null | undefined): Promise<string> => {
    const u = hintUid ?? auth?.currentUser?.uid ?? null;
    if (u && u.length > 0) return u;
    return await getOrCreateDeviceId();
  }, [getOrCreateDeviceId]);

  // 🔄 Listen only to this actor's SOS document, not global collection
  useEffect(() => {
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        if (!FIREBASE_ENABLED || !app) return;
        const db = getFirestore(app);
        const actorId = await resolveActorId(state.uid);
        const ref = doc(db, 'sos_active', actorId);
        unsub = onSnapshot(ref, (snap) => {
          if (!snap.exists()) {
            setState({ active: false, name: null, uid: null });
            return;
          }
          const data = snap.data() as any;
          setState({
            active: !!data.status,
            name: data.name ?? null,
            uid: data.uid ?? null,
            latitude: data.latitude ?? null,
            longitude: data.longitude ?? null,
          });
        });
      } catch {
        // noop
      }
    })();
    return () => { if (unsub) unsub(); };
  }, [resolveActorId]);

  const activate = useCallback(
    async (name: string | null | undefined, uid?: string | null | undefined) => {
      setState({ active: true, name: name ?? null, uid: uid ?? null });

      if (FIREBASE_ENABLED && app) {
        try {
          const db = getFirestore(app);

          // 🧭 Get current GPS coordinates
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') throw new Error('Location permission denied');
          const loc = await Location.getCurrentPositionAsync({});
          const { latitude, longitude } = loc.coords;

          const actorId = await resolveActorId(uid);
          const sosData = {
            uid: actorId,
            name: name ?? 'Unknown User',
            latitude,
            longitude,
            status: 'active',
            timestamp: serverTimestamp(),
          };

          await setDoc(doc(db, 'sos_active', actorId), sosData);

          await setDoc(doc(db, 'SosAlerts', actorId), sosData, { merge: true });

          setState({ active: true, name: name ?? null, uid: actorId, latitude, longitude });
        } catch (error) {
          console.error('Error activating SOS:', error);
        }
      }
    },
    [resolveActorId]
  );

  const clear = useCallback(async () => {
    setState({ active: false, name: null, uid: null });

    if (FIREBASE_ENABLED && app) {
      try {
        const db = getFirestore(app);
        const actorId = await resolveActorId(state.uid);

        // Only clear our own document
        if (actorId) {
          await deleteDoc(doc(db, 'sos_active', actorId));
          await setDoc(
            doc(db, 'SosAlerts', actorId),
            { status: 'cleared', clearedAt: serverTimestamp() },
            { merge: true }
          );
        }
      } catch (error) {
        console.error('Error clearing SOS:', error);
      }
    }
  }, [resolveActorId, state.uid]);

  const value = useMemo(() => ({ state, activate, clear }), [state, activate, clear]);

  return <SosContext.Provider value={value}>{children}</SosContext.Provider>;
};

export function useSos() {
  const ctx = useContext(SosContext);
  if (!ctx) throw new Error('useSos must be used within a SosProvider');
  return ctx;
}
