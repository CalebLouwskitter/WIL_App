import { RideStateManager } from '../components/backgroundServices/RideStateManager';
import { saveRide, type StoredRide } from './RideStorage';

// Moves an ended ride draft into ride history. The draft is the only copy of
// the recording until saveRide has resolved, so it is cleared (by id) only
// after that. saveRide is idempotent by id, so retrying after a failure or a
// crash at any step never produces two rides.
//
// Used by the manual stop, the automatic boundary stop (which may run with no
// screen mounted) and startup recovery. The ride is saved under the account
// that started it, not whoever is signed in now.

export type ArchiveResult =
  | { status: 'archived'; ride: StoredRide; draftCleared: boolean }
  | { status: 'none' } // no draft stored
  | { status: 'active'; rideId: string }; // draft is still recording; end it first

let inFlight: Promise<ArchiveResult> | null = null;

/**
 * Save the ended draft to ride history, then clear it. Rejects if the ride
 * could not be saved; the draft is then kept for a retry.
 */
export const archiveEndedDraft = (): Promise<ArchiveResult> => {
  if (!inFlight) {
    inFlight = archive().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
};

const archive = async (): Promise<ArchiveResult> => {
  const draft = await RideStateManager.getRideState();
  if (!draft) return { status: 'none' };
  if (draft.isActive) return { status: 'active', rideId: draft.rideId };

  const ride = await saveRide(RideStateManager.draftToRideData(draft));

  let draftCleared = false;
  try {
    draftCleared = await RideStateManager.clearRideState(draft.rideId);
  } catch (e) {
    // The ride is in history; the leftover draft is archived again (as a
    // no-op) on the next start or launch.
    console.warn('[RideArchive] Ride saved but its draft could not be cleared:', e);
  }
  return { status: 'archived', ride, draftCleared };
};
