import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('../services/firebase', () => ({
  FIREBASE_ENABLED: true,
  app: {},
  auth: { currentUser: { uid: 'user-1' } },
}));

// Legacy top-level horses returned by listDocs(horses, where userId == uid)
const mockLegacy: { current: object[] } = { current: [] };
jest.mock('../services/Data', () => ({
  COLLECTIONS: { users: 'users', horses: 'horses' },
  Converters: { horse: {} },
  newHorse: (partial: object) => partial,
  listDocs: async () => mockLegacy.current,
  getOrCreateUserProfile: async () => undefined,
}));

// In-memory Firestore: document path -> data
const mockStore = new Map<string, any>();
const mockSetDoc = jest.fn(async (ref: { path: string }, data: any) => {
  mockStore.set(ref.path, data);
});
const mockDeleteDoc = jest.fn(async (ref: { path: string }) => {
  mockStore.delete(ref.path);
});
jest.mock('firebase/firestore', () => {
  const ref = (path: string) => ({ path, withConverter() { return this; } });
  return {
    getFirestore: () => ({}),
    collection: (_db: unknown, ...segments: string[]) => ref(segments.join('/')),
    doc: (col: { path: string }, id: string) => ref(`${col.path}/${id}`),
    query: (col: unknown) => col,
    orderBy: () => ({}),
    getDocs: async (col: { path: string }) => ({
      docs: [...mockStore.entries()]
        .filter(([path]) => path.startsWith(`${col.path}/`) && !path.slice(col.path.length + 1).includes('/'))
        .map(([, data]) => ({ data: () => data })),
    }),
    setDoc: (...args: [any, any]) => mockSetDoc(...args),
    deleteDoc: (...args: [any]) => mockDeleteDoc(...args),
  };
});

import { getHorses } from '../services/HorseStorage';

const horse = (id: string, createdAt: number) => ({ id, userId: 'user-1', name: `Horse ${id}`, createdAt, updatedAt: createdAt });
const nestedIds = () =>
  [...mockStore.keys()].filter((p) => p.startsWith('users/user-1/horses/')).map((p) => p.split('/').pop()).sort();

beforeEach(async () => {
  await AsyncStorage.clear();
  mockStore.clear();
  mockLegacy.current = [];
  mockSetDoc.mockClear();
  mockDeleteDoc.mockClear();
});

describe('getHorses legacy copy', () => {
  it('never deletes, and keeps a horse whose copy failed visible', async () => {
    mockLegacy.current = [horse('h1', 1), horse('h2', 2)];
    mockSetDoc.mockImplementationOnce(async () => {
      throw new Error('permission-denied');
    });

    const horses = await getHorses();

    expect(horses.map((h) => h.id).sort()).toEqual(['h1', 'h2']);
    expect(mockDeleteDoc).not.toHaveBeenCalled();
    expect(nestedIds()).toHaveLength(1);
  });

  it('retries a failed copy on the next read even when other horses were copied', async () => {
    mockLegacy.current = [horse('h1', 1), horse('h2', 2)];
    mockSetDoc.mockImplementationOnce(async () => {
      throw new Error('unavailable');
    });
    await getHorses();
    expect(nestedIds()).toHaveLength(1);

    const second = await getHorses();
    expect(nestedIds()).toEqual(['h1', 'h2']);
    expect(second.map((h) => h.id).sort()).toEqual(['h1', 'h2']);

    mockSetDoc.mockClear();
    const third = await getHorses();
    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(third).toHaveLength(2);
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  it('shows nested horses plus legacy horses missing from nested', async () => {
    mockStore.set('users/user-1/horses/h1', horse('h1', 1));
    mockLegacy.current = [horse('h1', 1), horse('h3', 3)];

    const horses = await getHorses();

    expect(horses.map((h) => h.id)).toEqual(['h3', 'h1']);
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc.mock.calls[0][0].path).toBe('users/user-1/horses/h3');
  });

  it('makes no writes on an empty instance', async () => {
    const horses = await getHorses();
    expect(horses).toEqual([]);
    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });
});
