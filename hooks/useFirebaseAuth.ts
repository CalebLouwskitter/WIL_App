import { useEffect, useState } from 'react';
import { FIREBASE_ENABLED, auth } from '../services/firebase';

export function useFirebaseAuth() {
	const [initializing, setInitializing] = useState(!!FIREBASE_ENABLED);
	const [user, setUser] = useState<any>(null);

	useEffect(() => {
		if (!FIREBASE_ENABLED || !auth) {
			setInitializing(false);
			return;
		}
		const unsub = auth.onAuthStateChanged((u: any) => {
			setUser(u);
			setInitializing(false);
		});
		return () => unsub();
	}, []);

	return { user, initializing, isAuthenticated: !!user };
}

export default useFirebaseAuth;
