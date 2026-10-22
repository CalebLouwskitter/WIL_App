/**
 * Result of a Firebase-backed analytics read. `data` is always present (empty when
 * the read did not succeed) so callers can render it, but only `status === 'ok'`
 * means the numbers are real. 'unavailable' is an expected state (Firebase is off
 * in demo mode, or nobody is signed in); 'error' is a configured read that failed.
 */
export type AnalyticsUnavailableReason = 'firebase-off' | 'signed-out';

export type AnalyticsResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'unavailable'; reason: AnalyticsUnavailableReason; data: T }
  | { status: 'error'; error: unknown; data: T };

export type AnalyticsStatus = AnalyticsResult<unknown>['status'];

export const analyticsOk = <T>(data: T): AnalyticsResult<T> => ({ status: 'ok', data });

export const analyticsUnavailable = <T>(
  reason: AnalyticsUnavailableReason,
  data: T,
): AnalyticsResult<T> => ({ status: 'unavailable', reason, data });

export const analyticsError = <T>(error: unknown, data: T): AnalyticsResult<T> => ({
  status: 'error',
  error,
  data,
});

/** Derive a result from another one, keeping its status and reason/error. */
export const mapAnalytics = <A, B>(
  result: AnalyticsResult<A>,
  fn: (data: A) => B,
): AnalyticsResult<B> => {
  const data = fn(result.data);
  switch (result.status) {
    case 'ok':
      return analyticsOk(data);
    case 'unavailable':
      return analyticsUnavailable(result.reason, data);
    case 'error':
      return analyticsError(result.error, data);
  }
};

/** The first non-'ok' result (errors before unavailable), or null when every read succeeded. */
export const firstProblem = (
  results: ReadonlyArray<AnalyticsResult<unknown>>,
): AnalyticsResult<unknown> | null =>
  results.find((r) => r.status === 'error') ?? results.find((r) => r.status === 'unavailable') ?? null;
