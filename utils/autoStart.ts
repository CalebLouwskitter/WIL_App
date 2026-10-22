export type AutoStartParams = {
  autoStart?: boolean;
  autoStartRequestId?: number;
} | undefined | null;

export type AutoStartHandledId = number | string | null;

export interface AutoStartResult {
  start: boolean;
  handledId: AutoStartHandledId;
}

export const LEGACY_AUTO_START_ID = '__legacy__';

/**
 * Pure helper to determine whether an incoming auto-start navigation request
 * should trigger a ride start.
 *
 * - A new autoStartRequestId triggers handleStart.
 * - The same id does not trigger handleStart twice.
 * - A new id after a failed attempt (e.g. no horse selected) triggers again.
 * - If isRiding is true, auto-start is blocked.
 * - Legacy { autoStart: true } without an autoStartRequestId starts once.
 */
export function nextAutoStart(
  params: AutoStartParams,
  lastHandledId: AutoStartHandledId = null,
  isRiding: boolean = false
): AutoStartResult {
  if (!params || !params.autoStart || isRiding) {
    return { start: false, handledId: lastHandledId };
  }

  const currentId: AutoStartHandledId =
    params.autoStartRequestId !== undefined
      ? params.autoStartRequestId
      : LEGACY_AUTO_START_ID;

  if (currentId === lastHandledId) {
    return { start: false, handledId: lastHandledId };
  }

  return { start: true, handledId: currentId };
}
