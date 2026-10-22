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

export type SosFailureCode = 'unavailable' | 'location' | 'write-failed';

/**
 * Outcome of an SOS write. `ok` is true only when every write succeeded.
 * `partial` means the first write landed but a later one failed, so a record may exist.
 */
export type SosResult = { ok: boolean; error?: string; code?: SosFailureCode; partial?: boolean };

type SosContextType = {
  state: SosState;
  activate: (name: string | null | undefined, uid?: string | null | undefined) => Promise<SosResult>;
  clear: () => Promise<SosResult>;
};

const NOT_CONNECTED = 'Not connected to SBHRA servers';
const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

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
    async (name: string | null | undefined, uid?: string | null | undefined): Promise<SosResult> => {
      if (!FIREBASE_ENABLED || !app) {
        // Nothing can be sent, and we must not pretend an alert is active
        return { ok: false, code: 'unavailable', error: NOT_CONNECTED };
      }

      let latitude: number;
      let longitude: number;
      try {
        // 🧭 Get current GPS coordinates
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') throw new Error('Location permission denied');
        const loc = await Location.getCurrentPositionAsync({});
        ({ latitude, longitude } = loc.coords);
      } catch (error) {
        console.error('Error getting location for SOS:', error);
        return { ok: false, code: 'location', error: messageOf(error) };
      }

      let firstWriteLanded = false;
      try {
        const db = getFirestore(app);
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
        firstWriteLanded = true;

        await setDoc(doc(db, 'SosAlerts', actorId), sosData, { merge: true });

        setState({ active: true, name: name ?? null, uid: actorId, latitude, longitude });
        return { ok: true };
      } catch (error) {
        console.error('Error activating SOS:', error);
        return { ok: false, code: 'write-failed', error: messageOf(error), partial: firstWriteLanded };
      }
    },
    [resolveActorId]
  );

  const clear = useCallback(async (): Promise<SosResult> => {
    if (!FIREBASE_ENABLED || !app) {
      return { ok: false, code: 'unavailable', error: NOT_CONNECTED };
    }

    try {
      const db = getFirestore(app);
      const actorId = await resolveActorId(state.uid);

      // Only clear our own document
      await deleteDoc(doc(db, 'sos_active', actorId));
      await setDoc(
        doc(db, 'SosAlerts', actorId),
        { status: 'cleared', clearedAt: serverTimestamp() },
        { merge: true }
      );

      // Local state only changes once the server has accepted both writes
      setState({ active: false, name: null, uid: null });
      return { ok: true };
    } catch (error) {
      console.error('Error clearing SOS:', error);
      return { ok: false, code: 'write-failed', error: messageOf(error) };
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
