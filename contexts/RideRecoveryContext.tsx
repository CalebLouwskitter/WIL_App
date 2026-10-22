/**
 * Ride Recovery Context
 * Manages ride recovery state across the app
 * Handles communication between App.tsx recovery logic and LiveTrackingScreen
 *
 * A stored ride draft is never deleted here except by an explicit discard:
 * - ended (e.g. stopped at the boundary): saved to Ride History
 * - active / stale (interrupted): offered to the rider to resume, save or discard
 * - recorded by another account: ended and saved to that account, never shown
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { BackgroundLocationService } from '../components/backgroundServices/BackgroundLocationService';
import {
  RideStateManager,
  type DraftRideData,
  type RecoveryKind,
  type RideEndReason,
} from '../components/backgroundServices/RideStateManager';
import { recoverActiveRide } from '../components/backgroundServices/BackgroundRideTracker';
import { archiveEndedDraft } from '../services/RideArchive';
import { currentUid, type StoredRide } from '../services/RideStorage';
import { FIREBASE_ENABLED, auth } from '../services/firebase';

export type RecoveryNotice =
  | { type: 'archived'; reason: RideEndReason | null; ride: StoredRide }
  | { type: 'archiveFailed'; error: string };

interface RideRecoveryState {
  /** 'active' or 'stale' when the current user has an interrupted ride. */
  recoveryKind: RecoveryKind;
  hasRecoverableRide: boolean;
  recoveredRideData: DraftRideData | null;
  /** Something to tell the user about a ride saved (or not) during recovery. */
  notice: RecoveryNotice | null;
  /** Increments each time a check finds an interrupted ride to offer. */
  promptRequest: number;
  isResumed: boolean;
  alertShown: boolean;
  checkForRecoverableRide: () => Promise<RecoveryKind>;
  /** Restart tracking. Resolves true only if location tracking really restarted. */
  resumeRide: () => Promise<boolean>;
  /** End the interrupted ride where recording stopped and save it. Throws if not saved. */
  saveRecoveredRide: () => Promise<StoredRide>;
  discardRecoveredRide: () => Promise<void>;
  retryArchive: () => Promise<void>;
  dismissNotice: () => void;
  markAsResumed: () => void;
  markAlertShown: () => void;
  clearRecoveryState: () => void;
}

const RideRecoveryContext = createContext<RideRecoveryState | undefined>(undefined);

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const RideRecoveryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [recoveryKind, setRecoveryKind] = useState<RecoveryKind>('none');
  const [recoveredRideData, setRecoveredRideData] = useState<DraftRideData | null>(null);
  const [notice, setNotice] = useState<RecoveryNotice | null>(null);
  const [promptRequest, setPromptRequest] = useState(0);
  const [isResumed, setIsResumed] = useState(false);
  const [alertShown, setAlertShown] = useState(false);
  const checkedUid = useRef<string | null | undefined>(undefined);

  const resetRecoverable = useCallback(() => {
    setRecoveryKind('none');
    setRecoveredRideData(null);
  }, []);

  /** Archive an ended draft, reporting the outcome when it is the user's own. */
  const archiveAndNotify = useCallback(async (announce: boolean) => {
    try {
      const result = await archiveEndedDraft();
      if (announce && result.status === 'archived') {
        setNotice({ type: 'archived', reason: result.ride.endReason ?? null, ride: result.ride });
      }
    } catch (error) {
      console.error('[RideRecovery] Could not archive ended ride:', error);
      if (announce) setNotice({ type: 'archiveFailed', error: errorMessage(error) });
    }
  }, []);

  /**
   * Check if there's a ride that can be recovered
   */
  const checkForRecoverableRide = useCallback(async (): Promise<RecoveryKind> => {
    try {
      const uid = currentUid();
      checkedUid.current = uid;
      const { kind, ride } = await RideStateManager.recoverFromCrash();

      if (kind === 'none') {
        resetRecoverable();
        return 'none';
      }

      // Recorded under another account: finish it where recording stopped
      // and save it to that account. It is not offered to this user.
      const foreign = ride.ownerUid !== null && ride.ownerUid !== uid;
      if (foreign && kind !== 'ended') {
        await BackgroundLocationService.stop();
        await RideStateManager.endRide('stale', ride.lastUpdateTime);
      }

      if (kind === 'ended' || foreign) {
        resetRecoverable();
        await archiveAndNotify(!foreign);
        return 'none';
      }

      setRecoveryKind(kind);
      setRecoveredRideData(RideStateManager.draftToRideData(ride));
      setPromptRequest((n) => n + 1);
      console.log(`[RideRecovery] Found recoverable ride (${kind})`);
      return kind;
    } catch (error) {
      console.error('[RideRecovery] Error checking for recoverable ride:', error);
      resetRecoverable();
      return 'none';
    }
  }, [archiveAndNotify, resetRecoverable]);

  const resumeRide = useCallback(async (): Promise<boolean> => {
    const result = await recoverActiveRide();
    if (result.resumed) {
      resetRecoverable();
      setIsResumed(true);
    }
    return result.resumed;
  }, [resetRecoverable]);

  const saveRecoveredRide = useCallback(async (): Promise<StoredRide> => {
    const draft = await RideStateManager.getRideState();
    if (!draft) throw new Error('No interrupted ride was found.');

    await BackgroundLocationService.stop();
    if (draft.isActive) {
      // Nothing was recorded after the last update, so the ride ends there
      const reason: RideEndReason = recoveryKind === 'stale' ? 'stale' : 'user';
      await RideStateManager.endRide(reason, draft.lastUpdateTime);
    }
    const result = await archiveEndedDraft();
    if (result.status !== 'archived') throw new Error('The ride could not be saved.');
    resetRecoverable();
    return result.ride;
  }, [recoveryKind, resetRecoverable]);

  const discardRecoveredRide = useCallback(async () => {
    await BackgroundLocationService.stop();
    const draft = await RideStateManager.getRideState();
    if (draft) {
      await RideStateManager.clearRideState(draft.rideId);
    }
    resetRecoverable();
    setIsResumed(false);
    console.log('[RideRecovery] Ride discarded');
  }, [resetRecoverable]);

  const retryArchive = useCallback(async () => {
    setNotice(null);
    await archiveAndNotify(true);
  }, [archiveAndNotify]);

  const dismissNotice = useCallback(() => setNotice(null), []);

  /**
   * Mark the ride as resumed (user confirmed continuation)
   */
  const markAsResumed = useCallback(() => {
    setIsResumed(true);
    console.log('[RideRecovery] Ride marked as resumed');
  }, []);

  /**
   * Mark that the automatic alert has been shown
   */
  const markAlertShown = useCallback(() => {
    setAlertShown(true);
    console.log('[RideRecovery] Automatic alert marked as shown');
  }, []);

  /**
   * Clear recovery state (ride discarded or completed)
   */
  const clearRecoveryState = useCallback(() => {
    resetRecoverable();
    setIsResumed(false);
    setAlertShown(false);
    console.log('[RideRecovery] Recovery state cleared');
  }, [resetRecoverable]);

  // Check on mount
  useEffect(() => {
    checkForRecoverableRide();
  }, [checkForRecoverableRide]);

  // Check again when the signed-in account changes, so a draft recorded by
  // the previous account is saved to it instead of shown to the new one.
  useEffect(() => {
    if (!FIREBASE_ENABLED || !auth) return;
    const unsubscribe = auth.onAuthStateChanged((user: { uid: string } | null) => {
      const uid = user?.uid ?? null;
      if (checkedUid.current !== undefined && uid !== checkedUid.current) {
        checkForRecoverableRide();
      }
    });
    return () => unsubscribe();
  }, [checkForRecoverableRide]);

  const value: RideRecoveryState = {
    recoveryKind,
    hasRecoverableRide: recoveryKind === 'active' || recoveryKind === 'stale',
    recoveredRideData,
    notice,
    promptRequest,
    isResumed,
    alertShown,
    checkForRecoverableRide,
    resumeRide,
    saveRecoveredRide,
    discardRecoveredRide,
    retryArchive,
    dismissNotice,
    markAsResumed,
    markAlertShown,
    clearRecoveryState,
  };

  return (
    <RideRecoveryContext.Provider value={value}>
      {children}
    </RideRecoveryContext.Provider>
  );
};

/**
 * Hook to access ride recovery context
 */
export const useRideRecovery = (): RideRecoveryState => {
  const context = useContext(RideRecoveryContext);
  if (!context) {
    throw new Error('useRideRecovery must be used within RideRecoveryProvider');
  }
  return context;
};
