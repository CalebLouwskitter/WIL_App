import { useEffect, useState } from 'react';
import { FIREBASE_ENABLED, auth } from '../services/firebase';
import { firestore } from '../services/FirebaseFirestoreService';
import { getDoc, doc } from 'firebase/firestore';
import type { User } from '../types/User';
import { getOrCreateUserProfile } from '../services/Data';

export function useCurrentUser() {
	const [profile, setProfile] = useState<User | null>(null);
	const [loading, setLoading] = useState(!!FIREBASE_ENABLED);

	useEffect(() => {
			if (!FIREBASE_ENABLED || !auth || !firestore) {
			setLoading(false);
			setProfile(null);
			return;
		}
			const unsub = auth.onAuthStateChanged(async (u) => {
			if (u?.uid) {
				try {
						// Always load through getOrCreateUserProfile to ensure backfill
						const created = await getOrCreateUserProfile(u);
						setProfile({
							uid: created.uid,
							email: created.email ?? null,
							displayName: created.displayName ?? null,
							status: (created.status as any) ?? 'pending',
							role: (created.role as any) ?? 'member',
						} as User);
					} catch (e) {
						// As a fallback, try to ensure profile exists, then refetch
						try {
							const created = await getOrCreateUserProfile(u);
							setProfile({
								uid: created.uid,
								email: created.email ?? null,
								displayName: created.displayName ?? null,
								status: (created.status as any) ?? 'pending',
								role: (created.role as any) ?? 'member',
							} as User);
						} catch (e2) {
							if (__DEV__) console.warn('[useCurrentUser] Failed to load profile', e, e2);
							setProfile(null);
						}
				}
			} else {
				setProfile(null);
			}
			setLoading(false);
		});
		return () => unsub();
	}, []);

	return { profile, loading };
}

export default useCurrentUser;
