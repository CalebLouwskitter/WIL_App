/**
 * Ride Recovery Context
 * Manages ride recovery state across the app
 * Handles communication between App.tsx recovery logic and LiveTrackingScreen
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { RideStateManager } from '../components/backgroundServices';
import type { RideData } from '../hooks/useRideTracker';

interface RideRecoveryState {
  hasRecoverableRide: boolean;
  recoveredRideData: RideData | null;
  isResumed: boolean;
  checkForRecoverableRide: () => Promise<void>;
  markAsResumed: () => void;
  clearRecoveryState: () => void;
}

const RideRecoveryContext = createContext<RideRecoveryState | undefined>(undefined);

export const RideRecoveryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasRecoverableRide, setHasRecoverableRide] = useState(false);
  const [recoveredRideData, setRecoveredRideData] = useState<RideData | null>(null);
  const [isResumed, setIsResumed] = useState(false);

  /**
   * Check if there's a ride that can be recovered
   */
  const checkForRecoverableRide = useCallback(async () => {
    try {
      const hasActive = await RideStateManager.hasActiveRide();
      
      if (hasActive) {
        const rideData = await RideStateManager.toRideData();
        setHasRecoverableRide(true);
        setRecoveredRideData(rideData);
        console.log('[RideRecovery] Found recoverable ride');
      } else {
        setHasRecoverableRide(false);
        setRecoveredRideData(null);
      }
    } catch (error) {
      console.error('[RideRecovery] Error checking for recoverable ride:', error);
      setHasRecoverableRide(false);
      setRecoveredRideData(null);
    }
  }, []);

  /**
   * Mark the ride as resumed (user confirmed continuation)
   */
  const markAsResumed = useCallback(() => {
    setIsResumed(true);
    console.log('[RideRecovery] Ride marked as resumed');
  }, []);

  /**
   * Clear recovery state (ride discarded or completed)
   */
  const clearRecoveryState = useCallback(() => {
    setHasRecoverableRide(false);
    setRecoveredRideData(null);
    setIsResumed(false);
    console.log('[RideRecovery] Recovery state cleared');
  }, []);

  // Check on mount
  useEffect(() => {
    checkForRecoverableRide();
  }, [checkForRecoverableRide]);

  const value: RideRecoveryState = {
    hasRecoverableRide,
    recoveredRideData,
    isResumed,
    checkForRecoverableRide,
    markAsResumed,
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
