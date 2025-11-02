/**
 * Standardized error handling utilities for the application
 */

import { Alert } from 'react-native';

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ErrorHandlerOptions {
  /** Custom error message to show to the user */
  userMessage?: string;
  /** Context about where the error occurred */
  context?: string;
  /** Severity level of the error */
  severity?: ErrorSeverity;
  /** Whether to show an alert to the user */
  showAlert?: boolean;
  /** Callback function to execute after handling the error */
  onError?: (error: Error) => void;
}

/**
 * Centralized error handler
 */
export function handleError(
  error: unknown,
  options: ErrorHandlerOptions = {}
): void {
  const {
    userMessage = 'An unexpected error occurred',
    context = 'Unknown',
    severity = 'error',
    showAlert = true,
    onError,
  } = options;

  // Extract error message
  const errorMessage = error instanceof Error ? error.message : String(error);
  const fullContext = `[${context}] ${errorMessage}`;

  // Log based on severity
  if (__DEV__) {
    switch (severity) {
      case 'info':
        console.info(fullContext, error);
        break;
      case 'warning':
        console.warn(fullContext, error);
        break;
      case 'error':
        console.error(fullContext, error);
        break;
      case 'critical':
        console.error(`🔴 CRITICAL: ${fullContext}`, error);
        break;
    }
  }

  // Show user alert for errors and critical issues
  if (showAlert && (severity === 'error' || severity === 'critical')) {
    Alert.alert(
      severity === 'critical' ? 'Critical Error' : 'Error',
      userMessage,
      [{ text: 'OK' }]
    );
  }

  // Execute custom error handler
  if (onError && error instanceof Error) {
    try {
      onError(error);
    } catch (callbackError) {
      if (__DEV__) {
        console.error('[ErrorHandler] Error in onError callback:', callbackError);
      }
    }
  }
}

/**
 * Wrapper for async operations with standardized error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  options: ErrorHandlerOptions = {}
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    handleError(error, options);
    return null;
  }
}

/**
 * Common error messages for mapping-related operations
 */
export const ErrorMessages = {
  LOCATION_PERMISSION: 'Location permission is required to use this feature. Please enable it in your device settings.',
  LOCATION_UNAVAILABLE: 'Unable to get your current location. Please check your device settings.',
  CAMERA_PERMISSION: 'Camera permission is required to take photos. Please enable it in your device settings.',
  PHOTO_LIBRARY_PERMISSION: 'Photo library access is required. Please enable it in your device settings.',
  NETWORK_ERROR: 'Network error occurred. Please check your connection and try again.',
  SAVE_FAILED: 'Failed to save your data. Please try again.',
  LOAD_FAILED: 'Failed to load data. Please try again.',
  MAP_ERROR: 'Map error occurred. Please restart the app if the issue persists.',
  OBSTACLE_LOAD_FAILED: 'Failed to load obstacles. Please try again.',
  OBSERVATION_SAVE_FAILED: 'Failed to save observation. Please try again.',
} as const;
