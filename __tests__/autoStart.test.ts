import { nextAutoStart, LEGACY_AUTO_START_ID } from '../utils/autoStart';

describe('nextAutoStart', () => {
  it('starts when given a new request id', () => {
    const result = nextAutoStart({ autoStart: true, autoStartRequestId: 101 }, null, false);
    expect(result).toEqual({ start: true, handledId: 101 });
  });

  it('does not start twice for the same request id', () => {
    const result = nextAutoStart({ autoStart: true, autoStartRequestId: 101 }, 101, false);
    expect(result).toEqual({ start: false, handledId: 101 });
  });

  it('starts again when a new request id arrives after a previous/failed attempt', () => {
    const first = nextAutoStart({ autoStart: true, autoStartRequestId: 101 }, null, false);
    expect(first).toEqual({ start: true, handledId: 101 });

    // User retries from dashboard after failed attempt (e.g. no horse selected)
    const retry = nextAutoStart({ autoStart: true, autoStartRequestId: 102 }, first.handledId, false);
    expect(retry).toEqual({ start: true, handledId: 102 });
  });

  it('blocks auto-start when isRiding is true', () => {
    const result = nextAutoStart({ autoStart: true, autoStartRequestId: 103 }, null, true);
    expect(result).toEqual({ start: false, handledId: null });
  });

  it('preserves existing handledId when isRiding is true', () => {
    const result = nextAutoStart({ autoStart: true, autoStartRequestId: 104 }, 100, true);
    expect(result).toEqual({ start: false, handledId: 100 });
  });

  it('starts once for legacy autoStart: true without an id', () => {
    const first = nextAutoStart({ autoStart: true }, null, false);
    expect(first).toEqual({ start: true, handledId: LEGACY_AUTO_START_ID });

    const second = nextAutoStart({ autoStart: true }, first.handledId, false);
    expect(second).toEqual({ start: false, handledId: LEGACY_AUTO_START_ID });
  });

  it('does not start when autoStart is false or missing', () => {
    expect(nextAutoStart(undefined, null, false)).toEqual({ start: false, handledId: null });
    expect(nextAutoStart(null, null, false)).toEqual({ start: false, handledId: null });
    expect(nextAutoStart({ autoStart: false }, null, false)).toEqual({ start: false, handledId: null });
  });
});
