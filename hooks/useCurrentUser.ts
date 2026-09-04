import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { FIREBASE_ENABLED, auth, firestore } from '../services/firebase';
import type { User } from '../types/User';
import { getOrCreateUserProfile, userProfileConverter } from '../services/Data';

export function useCurrentUser() {
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!FIREBASE_ENABLED);

  useEffect(() => {
    if (!FIREBASE_ENABLED || !auth || !firestore) {
      setLoading(false);
      setProfile(null);
      return;
    }

    const db = firestore;
    let generation = 0;
    let unsubscribeProfile: Unsubscribe | undefined;
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      const currentGeneration = ++generation;
      unsubscribeProfile?.();
      unsubscribeProfile = undefined;
      setProfile(null);
      setLoading(!!user);
      if (!user) return;

      try {
        await getOrCreateUserProfile(user);
        // A previous account's request must not subscribe after logout/switch.
        if (generation !== currentGeneration) return;
        const ref = doc(db, 'users', user.uid).withConverter(userProfileConverter);
        unsubscribeProfile = onSnapshot(ref, (snapshot) => {
          if (generation !== currentGeneration) return;
          const data = snapshot.exists() ? snapshot.data() : null;
          setProfile(data ? {
            uid: user.uid,
            email: data.email ?? null,
            displayName: data.displayName ?? null,
            status: data.status ?? 'pending',
            role: data.role ?? 'member',
          } : null);
          setLoading(false);
        }, (error) => {
          if (generation !== currentGeneration) return;
          console.warn('[useCurrentUser] Profile subscription failed', error);
          setProfile(null);
          setLoading(false);
        });
      } catch (error) {
        if (generation !== currentGeneration) return;
        console.warn('[useCurrentUser] Failed to load profile', error);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      generation++;
      unsubscribeAuth();
      unsubscribeProfile?.();
    };
  }, []);

  return { profile, loading };
}

export default useCurrentUser;
