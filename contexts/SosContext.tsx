import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { FIREBASE_ENABLED, app } from '@/services/firebase';
import { getFirestore, doc, onSnapshot, setDoc } from 'firebase/firestore';

export type SosState = {
  active: boolean;
  name: string | null;
  uid?: string | null;
};

type SosContextType = {
  state: SosState;
  activate: (name: string | null | undefined, uid?: string | null | undefined) => void;
  clear: () => void;
};

const SosContext = createContext<SosContextType | undefined>(undefined);

export const SosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SosState>({ active: false, name: null, uid: null });

  // Subscribe to shared SOS alert document so everyone sees the current status
  useEffect(() => {
    if (!FIREBASE_ENABLED || !app) return;
    const db = getFirestore(app);
    const ref = doc(db, 'sosAlerts', 'current');
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data() as any;
      if (!data) {
        setState({ active: false, name: null, uid: null });
        return;
      }
      setState({ active: !!data.active, name: data.displayName ?? null, uid: data.uid ?? null });
    });
    return () => unsub();
  }, []);

  const activate = useCallback(async (name: string | null | undefined, uid?: string | null | undefined) => {
    setState({ active: true, name: name ?? null, uid: uid ?? null });
    if (FIREBASE_ENABLED && app) {
      try {
        const db = getFirestore(app);
        const ref = doc(db, 'sosAlerts', 'current');
        await setDoc(ref, {
          active: true,
          uid: uid ?? null,
          displayName: name ?? null,
          startedAt: Date.now(),
        }, { merge: true });
      } catch (e) {
        // Best-effort; local state still shows active
      }
    }
  }, []);

  const clear = useCallback(async () => {
    setState({ active: false, name: null, uid: null });
    if (FIREBASE_ENABLED && app) {
      try {
        const db = getFirestore(app);
        const ref = doc(db, 'sosAlerts', 'current');
        await setDoc(ref, { active: false, endedAt: Date.now() }, { merge: true });
      } catch (e) {}
    }
  }, []);

  const value = useMemo(() => ({ state, activate, clear }), [state, activate, clear]);

  return <SosContext.Provider value={value}>{children}</SosContext.Provider>;
};

export function useSos() {
  const ctx = useContext(SosContext);
  if (!ctx) {
    throw new Error('useSos must be used within a SosProvider');
  }
  return ctx;
}
