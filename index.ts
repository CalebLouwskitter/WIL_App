import { registerRootComponent } from 'expo';
// Ensure Firestore side-effect registration & initialization occurs before app mounts
import './services/FirebaseFirestoreService';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

// Launch performs no Firestore writes. User seeding lives in
// scripts/seedEmulator.ts and runs only against the local emulator.
