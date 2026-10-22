import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const mockFirebase: { FIREBASE_ENABLED: boolean; app: object | undefined; auth: { currentUser: { uid: string } | null } } = {
  FIREBASE_ENABLED: true,
  app: {},
  auth: { currentUser: { uid: 'test-user' } },
};
jest.mock('@/services/firebase', () => ({
  get FIREBASE_ENABLED() {
    return mockFirebase.FIREBASE_ENABLED;
  },
  get app() {
    return mockFirebase.app;
  },
  get auth() {
    return mockFirebase.auth;
  },
}));

const mockSetDoc = jest.fn();
const mockDeleteDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
  getFirestore: () => ({}),
  doc: (_db: unknown, collectionName: string, id: string) => ({ path: `${collectionName}/${id}` }),
  collection: jest.fn(),
  serverTimestamp: () => 'SERVER_TS',
  onSnapshot: () => () => {},
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
}));

const mockPermission = jest.fn();
const mockPosition = jest.fn();
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: (...a: unknown[]) => mockPermission(...a),
  getCurrentPositionAsync: (...a: unknown[]) => mockPosition(...a),
}));

import { SosProvider, useSos, type SosResult } from '../contexts/SosContext';

type SosApi = ReturnType<typeof useSos>;

const mountSos = async () => {
  const ref: { current: SosApi | null } = { current: null };
  const Probe = () => {
    ref.current = useSos();
    return null;
  };
  await act(async () => {
    TestRenderer.create(
      <SosProvider>
        <Probe />
      </SosProvider>
    );
  });
  return ref as { current: SosApi };
};

beforeEach(() => {
  mockSetDoc.mockReset().mockResolvedValue(undefined);
  mockDeleteDoc.mockReset().mockResolvedValue(undefined);
  mockPermission.mockReset().mockResolvedValue({ status: 'granted' });
  mockPosition.mockReset().mockResolvedValue({ coords: { latitude: -34.03, longitude: 25.5 } });
  mockFirebase.FIREBASE_ENABLED = true;
  mockFirebase.app = {};
  mockFirebase.auth = { currentUser: { uid: 'test-user' } };
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('SosContext results', () => {
  it('activate succeeds only when both writes succeed, and then updates local state', async () => {
    const sos = await mountSos();
    let result!: SosResult;
    await act(async () => {
      result = await sos.current.activate('Rider', 'test-user');
    });
    expect(result).toEqual({ ok: true });
    expect(mockSetDoc).toHaveBeenCalledTimes(2);
    expect(sos.current.state.active).toBe(true);
  });

  it('partial failure (first write ok, second fails) is reported and does not mark the alert active', async () => {
    mockSetDoc.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('unavailable'));
    const sos = await mountSos();
    let result!: SosResult;
    await act(async () => {
      result = await sos.current.activate('Rider', 'test-user');
    });
    expect(result).toMatchObject({ ok: false, code: 'write-failed', partial: true });
    expect(result.error).toContain('unavailable');
    expect(sos.current.state.active).toBe(false);
  });

  it('first write failing is a plain failure, not partial', async () => {
    mockSetDoc.mockRejectedValueOnce(new Error('denied'));
    const sos = await mountSos();
    let result!: SosResult;
    await act(async () => {
      result = await sos.current.activate('Rider', 'test-user');
    });
    expect(result).toMatchObject({ ok: false, code: 'write-failed', partial: false });
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
  });

  it('location failure sends nothing', async () => {
    mockPermission.mockResolvedValue({ status: 'denied' });
    const sos = await mountSos();
    let result!: SosResult;
    await act(async () => {
      result = await sos.current.activate('Rider', 'test-user');
    });
    expect(result).toMatchObject({ ok: false, code: 'location' });
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('clear failure keeps the alert active locally', async () => {
    const sos = await mountSos();
    await act(async () => {
      await sos.current.activate('Rider', 'test-user');
    });
    expect(sos.current.state.active).toBe(true);

    mockSetDoc.mockRejectedValueOnce(new Error('network'));
    let result!: SosResult;
    await act(async () => {
      result = await sos.current.clear();
    });
    expect(result).toMatchObject({ ok: false, code: 'write-failed' });
    expect(sos.current.state.active).toBe(true);
  });

  it('clear updates local state only after both writes succeed', async () => {
    const sos = await mountSos();
    await act(async () => {
      await sos.current.activate('Rider', 'test-user');
    });
    let result!: SosResult;
    await act(async () => {
      result = await sos.current.clear();
    });
    expect(result).toEqual({ ok: true });
    expect(mockDeleteDoc).toHaveBeenCalledWith({ path: 'sos_active/test-user' });
    expect(sos.current.state.active).toBe(false);
  });

  it('returns unavailable without touching Firestore or location when Firebase is off', async () => {
    mockFirebase.FIREBASE_ENABLED = false;
    mockFirebase.app = undefined;
    const sos = await mountSos();
    let activated!: SosResult;
    let cleared!: SosResult;
    await act(async () => {
      activated = await sos.current.activate('Rider', null);
      cleared = await sos.current.clear();
    });
    expect(activated).toMatchObject({ ok: false, code: 'unavailable' });
    expect(cleared).toMatchObject({ ok: false, code: 'unavailable' });
    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockDeleteDoc).not.toHaveBeenCalled();
    expect(mockPermission).not.toHaveBeenCalled();
    expect(sos.current.state.active).toBe(false);
  });
});
