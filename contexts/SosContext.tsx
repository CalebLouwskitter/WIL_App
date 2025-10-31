import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { FIREBASE_ENABLED, app } from '@/services/firebase';
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

  // 🔄 Listen to currently active SOS alerts (global dashboard visibility)
  useEffect(() => {
    if (!FIREBASE_ENABLED || !app) return;
    const db = getFirestore(app);
    const activeRef = collection(db, 'sos_active');

    const unsub = onSnapshot(activeRef, (snap) => {
      if (snap.empty) {
        setState({ active: false, name: null, uid: null });
        return;
      }

      // If multiple SOS alerts are active, this keeps last one
      const latest = snap.docs[snap.docs.length - 1].data() as any;
      setState({
        active: !!latest.status,
        name: latest.name ?? null,
        uid: latest.uid ?? null,
        latitude: latest.latitude ?? null,
        longitude: latest.longitude ?? null,
      });
    });

    return () => unsub();
  }, []);

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

          const sosData = {
            uid: uid ?? null,
            name: name ?? 'Unknown User',
            latitude,
            longitude,
            status: 'active',
            timestamp: serverTimestamp(),
          };

          await setDoc(doc(db, 'sos_active', uid ?? 'unknown'), sosData);

          await setDoc(doc(db, 'SosAlerts', uid ?? 'unknown'), sosData, { merge: true });

          setState({ active: true, name: name ?? null, uid, latitude, longitude });
        } catch (error) {
          console.error('Error activating SOS:', error);
        }
      }
    },
    []
  );

  const clear = useCallback(async () => {
    const uid = state.uid;
    setState({ active: false, name: null, uid: null });

    if (FIREBASE_ENABLED && app && uid) {
      try {
        const db = getFirestore(app);

        await deleteDoc(doc(db, 'sos_active', uid));

        await setDoc(
          doc(db, 'SosAlerts', uid),
          { status: 'cleared', clearedAt: serverTimestamp() },
          { merge: true }
        );
      } catch (error) {
        console.error('Error clearing SOS:', error);
      }
    }
  }, [state.uid]);

  const value = useMemo(() => ({ state, activate, clear }), [state, activate, clear]);

  return <SosContext.Provider value={value}>{children}</SosContext.Provider>;
};

export function useSos() {
  const ctx = useContext(SosContext);
  if (!ctx) throw new Error('useSos must be used within a SosProvider');
  return ctx;
}
