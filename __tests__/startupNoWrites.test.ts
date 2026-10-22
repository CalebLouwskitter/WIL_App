// Importing the app entry point must not touch Firestore (F09: no launch-time
// role/status seeding). Firebase is mocked as enabled with a user document
// that is missing role/status, which the old dev seed would have patched.

const mockWrites = {
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  addDoc: jest.fn(),
  deleteDoc: jest.fn(),
  writeBatch: jest.fn(),
  runTransaction: jest.fn(),
};
const mockLegacyUsers = [{ id: 'legacy-user', ref: {}, data: () => ({ email: 'a@example.test' }) }];
const mockGetDocs = jest.fn(async () => ({
  docs: mockLegacyUsers,
  forEach: (fn: (d: unknown) => void) => mockLegacyUsers.forEach(fn),
}));

jest.mock('firebase/firestore', () => ({
  ...mockWrites,
  getDocs: mockGetDocs,
  getDoc: jest.fn(),
  getFirestore: () => ({}),
  collection: () => ({}),
  doc: () => ({ withConverter: () => ({}) }),
  query: () => ({}),
  where: () => ({}),
  orderBy: () => ({}),
  limit: () => ({}),
}));

jest.mock('../services/firebase', () => ({
  FIREBASE_ENABLED: true,
  app: {},
  auth: { currentUser: null },
  firestore: {},
}));

jest.mock('expo', () => ({ registerRootComponent: jest.fn() }));
jest.mock('../App', () => () => null);

describe('app entry point', () => {
  it('performs no Firestore reads or writes on import', async () => {
    jest.useFakeTimers();
    require('../index');
    jest.runAllTimers();
    jest.useRealTimers();
    await new Promise((resolve) => setImmediate(resolve));

    const { registerRootComponent } = require('expo');
    expect(registerRootComponent).toHaveBeenCalledTimes(1);
    for (const [name, fn] of Object.entries(mockWrites)) {
      expect({ name, calls: fn.mock.calls.length }).toEqual({ name, calls: 0 });
    }
    expect(mockGetDocs).not.toHaveBeenCalled();
  });
});
