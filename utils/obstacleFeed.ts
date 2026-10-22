import type { ObstacleFeedStatus } from '../services/ObstacleService';

export type ObstacleFeedView = {
  /** What the Live/Offline chip says. `isLive` is true only for server-confirmed data. */
  indicator: { label: string; isLive: boolean };
  /** `list` shows reports, `empty` is a successful read with nothing in it, the rest replace the list. */
  kind: 'loading' | 'unavailable' | 'error' | 'empty' | 'list';
  title?: string;
  body?: string;
  /** Set when reports are shown but may be out of date. */
  caveat?: string;
};

const formatUpdated = (ts: number | null | undefined) =>
  ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

/**
 * Maps a feed status to the wording the hazard screens may use. An empty list is
 * only reported as "no active reports" after a successful read, and never as a
 * guarantee that the trail is clear.
 */
export function describeObstacleFeed(
  status: ObstacleFeedStatus,
  count: number,
  lastUpdated?: number | null
): ObstacleFeedView {
  const updated = formatUpdated(lastUpdated);
  const noGuarantee = "This doesn't guarantee the trail is clear.";

  switch (status) {
    case 'unavailable':
      return {
        indicator: { label: 'Not connected', isLive: false },
        kind: 'unavailable',
        title: 'Hazard reports unavailable',
        body: "This app isn't connected to SBHRA servers, so hazard reports can't be checked. Don't assume the trail is clear.",
      };
    case 'error':
      if (count > 0) {
        return {
          indicator: { label: 'Error', isLive: false },
          kind: 'list',
          caveat: "Couldn't refresh hazard reports. These may be out of date.",
        };
      }
      return {
        indicator: { label: 'Error', isLive: false },
        kind: 'error',
        title: "Couldn't load hazard reports",
        body: "Something went wrong reaching SBHRA servers. Don't assume the trail is clear.",
      };
    case 'connecting':
      if (count > 0) {
        return { indicator: { label: 'Connecting…', isLive: false }, kind: 'list' };
      }
      return { indicator: { label: 'Connecting…', isLive: false }, kind: 'loading', title: 'Checking for hazard reports…' };
    case 'cached':
      if (count > 0) {
        return {
          indicator: { label: 'Offline', isLive: false },
          kind: 'list',
          caveat: 'Showing reports saved on this device. They may be out of date.',
        };
      }
      return {
        indicator: { label: 'Offline', isLive: false },
        kind: 'empty',
        title: 'No active reports saved',
        body: `You appear to be offline, so new reports can't be seen. ${noGuarantee}`,
      };
    case 'live':
    default:
      if (count > 0) {
        return { indicator: { label: 'Live', isLive: true }, kind: 'list' };
      }
      return {
        indicator: { label: 'Live', isLive: true },
        kind: 'empty',
        title: 'No active reports',
        body: `${updated ? `Last updated ${updated}. ` : ''}${noGuarantee}`,
      };
  }
}
