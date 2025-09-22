import { registerRootComponent } from 'expo';
// Ensure Firestore side-effect registration & initialization occurs before app mounts
import './services/FirebaseFirestoreService';
import { seedUsersRbac } from './services/FirebaseUserService';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

// Dev-only auto seed to ensure RBAC fields and admin promotion
if (__DEV__) {
	setTimeout(async () => {
		try {
			await seedUsersRbac();
			// Optionally promote a user to admin by email during dev seeding:
			// import { ensureAdminByEmail } from './services/FirebaseUserService';
			// await ensureAdminByEmail('<dev-admin@example.com>');
			// eslint-disable-next-line no-console
			console.log('[Seed] RBAC seeded and admin ensured');
		} catch (e) {
			// eslint-disable-next-line no-console
			console.warn('[Seed] Failed to run seeding:', e);
		}
	}, 0);
}
