const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Execute real application modules with native/cloud boundaries replaced.
function loader(mocks) {
  const cache = new Map();
  function load(filename) {
    filename = path.resolve(__dirname, '..', filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(code, {
      exports: module.exports, __DEV__: false, console, setTimeout,
      require(spec) {
        if (Object.hasOwn(mocks, spec)) return mocks[spec];
        if (spec.startsWith('.')) return load(path.resolve(path.dirname(filename), `${spec}.ts`));
        throw new Error(`Unexpected dependency ${spec}`);
      },
    }, { filename });
    return module.exports;
  }
  return load;
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('all Firebase entry points share one initialization and configure Firestore first', () => {
  const app = {}, auth = {}, firestore = {}, calls = [];
  const load = loader({
    'firebase/app': { getApps: () => [], initializeApp: () => { calls.push('app'); return app; } },
    'firebase/auth': { getReactNativePersistence: () => ({}), initializeAuth: () => { calls.push('auth'); return auth; } },
    'firebase/firestore': {
      initializeFirestore: (_, options) => { assert.equal(options.experimentalForceLongPolling, true); calls.push('firestore'); return firestore; },
      getFirestore: () => { throw new Error('Must configure Firestore before obtaining it'); },
    },
    '@react-native-async-storage/async-storage': {},
    'expo-constants': { expoConfig: { extra: Object.fromEntries(['API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'STORAGE_BUCKET', 'MESSAGING_SENDER_ID', 'APP_ID'].map(k => [`FIREBASE_${k}`, 'test'])) } },
  });
  for (const file of ['firebase', 'FirebaseConfig', 'FirebaseAuthRN']) {
    const value = load(`services/${file}.ts`);
    assert.equal(value.app, app);
    assert.equal(value.auth, auth);
  }
  assert.equal(load('services/FirebaseFirestoreService.ts').firestore, firestore);
  assert.deepEqual(calls, ['app', 'auth', 'firestore']);
});

function profileHarness(createProfile = async () => {}) {
  let authCallback, snapshotCallback, cleanup, stateIndex = 0, subscriptions = 0, removals = 0;
  const states = [];
  const load = loader({
    react: {
      useState(initial) { const index = stateIndex++; states[index] = initial; return [initial, value => { states[index] = value; }]; },
      useEffect(effect) { cleanup = effect(); },
    },
    'firebase/auth': { onAuthStateChanged(_, callback) { authCallback = callback; return () => {}; } },
    'firebase/firestore': {
      doc: () => ({ withConverter() { return this; } }),
      onSnapshot(_, callback) { subscriptions++; snapshotCallback = callback; return () => { removals++; }; },
    },
    '../services/firebase': { FIREBASE_ENABLED: true, auth: {}, firestore: {} },
    '../services/Data': { getOrCreateUserProfile: createProfile, userProfileConverter: {} },
  });
  load('hooks/useCurrentUser.ts').useCurrentUser();
  return {
    states,
    login: user => authCallback(user),
    snapshot(data) { snapshotCallback({ exists: () => !!data, data: () => data }); },
    cleanup: () => cleanup(),
    get subscriptions() { return subscriptions; },
    get removals() { return removals; },
  };
}

test('profile approval and edits update without signing in again', async () => {
  const h = profileHarness();
  await h.login({ uid: 'rider' });
  h.snapshot({ status: 'pending', displayName: 'Before' });
  assert.equal(h.states[0].status, 'pending');
  h.snapshot({ status: 'approved', displayName: 'After' });
  assert.equal(h.states[0].status, 'approved');
  assert.equal(h.states[0].displayName, 'After');
  assert.equal(h.states[1], false);
  h.cleanup();
  assert.equal(h.removals, 1);
});

test('slow profile initialization cannot restore an account after logout', async () => {
  let resolve;
  const h = profileHarness(() => new Promise(r => { resolve = r; }));
  const pending = h.login({ uid: 'previous-user' });
  await h.login(null);
  resolve();
  await pending;
  await tick();
  assert.equal(h.subscriptions, 0);
  assert.equal(h.states[0], null);
  assert.equal(h.states[1], false);
});

test('unmount prevents an in-flight profile request from attaching a listener', async () => {
  let resolve;
  const h = profileHarness(() => new Promise(r => { resolve = r; }));
  const pending = h.login({ uid: 'rider' });
  h.cleanup();
  resolve();
  await pending;
  assert.equal(h.subscriptions, 0);
});

test('ride app-state listener observes a ride started after screen mount', async () => {
  let active = false, listener;
  const statuses = [];
  let index = 0;
  const cleanups = [];
  const effects = [];
  const load = loader({
    react: {
      useState(initial) { const slot = index++; return [initial, value => { if (slot === 1) statuses.push(value); }]; },
      useRef: value => ({ current: value }),
      useCallback: callback => callback,
      useEffect(effect) { effects.push(effect); },
    },
    'expo-location': {},
    'react-native': { AppState: { currentState: 'active', addEventListener(_, callback) { listener = callback; return { remove() {} }; } } },
    './BackgroundLocationService': { BackgroundLocationService: { hasPermissions: async () => true, isTaskRunning: async () => true } },
    './RideStateManager': { RideStateManager: {
      hasActiveRide: async () => active,
      toRideData: async () => ({ path: [], duration: 1000 }),
      subscribe: () => () => {},
    } },
  });
  load('components/backgroundServices/BackgroundRideTracker.ts').useBackgroundRideTracker();
  effects.forEach(effect => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); });
  await tick();
  active = true;
  await listener('background');
  await listener('active');
  assert.deepEqual(statuses, ['active_background', 'active_foreground']);
  cleanups.forEach(cleanup => cleanup());
});
