import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: { children?: React.ReactNode }) => children ?? null }));
jest.mock('../services/AnalyticsDownloadService', () => ({ downloadAndShareGlobalAnalytics: jest.fn() }));

import { AnalyticsUnavailableNotice } from '../components/AnalyticsUnavailableNotice';
import { AnalyticsDownloadButton } from '../components/AnalyticsDownloadButton';
import { analyticsError, analyticsOk, analyticsUnavailable, firstProblem } from '../services/analyticsResult';

const texts = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAllByType(Text).map((n) => [n.props.children].flat().join(''));

const render = (el: React.ReactElement) => {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(el);
  });
  return r;
};

describe('AnalyticsUnavailableNotice', () => {
  it('says the app is not connected when Firebase is off', () => {
    const r = render(<AnalyticsUnavailableNotice result={analyticsUnavailable('firebase-off', [])} />);
    expect(texts(r)).toEqual(['Not connected to SBHRA servers', 'Analytics unavailable']);
  });

  it('asks the user to sign in when signed out', () => {
    const r = render(<AnalyticsUnavailableNotice result={analyticsUnavailable('signed-out', [])} />);
    expect(texts(r)).toContain('Sign in to see analytics');
  });

  it('offers Retry only for a real error', () => {
    const onRetry = jest.fn();
    const failed = render(<AnalyticsUnavailableNotice result={analyticsError(new Error('x'), [])} onRetry={onRetry} />);
    expect(texts(failed)).toContain('Could not load analytics');
    act(() => failed.root.findByType(TouchableOpacity).props.onPress());
    expect(onRetry).toHaveBeenCalledTimes(1);

    const off = render(<AnalyticsUnavailableNotice result={analyticsUnavailable('firebase-off', [])} onRetry={onRetry} />);
    expect(off.root.findAllByType(TouchableOpacity)).toHaveLength(0);
  });

  it('renders nothing for ok data, including real zeros', () => {
    const r = render(<AnalyticsUnavailableNotice result={analyticsOk({ totalRides: 0 })} />);
    expect(r.toJSON()).toBeNull();
  });
});

describe('firstProblem', () => {
  it('is null when everything is ok and prefers an error over unavailable', () => {
    expect(firstProblem([analyticsOk(1), analyticsOk(2)])).toBeNull();
    const unavailable = analyticsUnavailable('firebase-off', 0);
    const failed = analyticsError(new Error('x'), 0);
    expect(firstProblem([analyticsOk(1), unavailable, failed])).toBe(failed);
    expect(firstProblem([analyticsOk(1), unavailable])).toBe(unavailable);
  });
});

describe('AnalyticsDownloadButton when disabled', () => {
  it('cannot be pressed and shows why', () => {
    const r = render(<AnalyticsDownloadButton disabled disabledReason="Analytics unavailable" />);
    expect(r.root.findByType(TouchableOpacity).props.disabled).toBe(true);
    expect(texts(r)).toContain('Analytics unavailable');
  });

  it('is enabled by default and shows no reason', () => {
    const r = render(<AnalyticsDownloadButton />);
    expect(r.root.findByType(TouchableOpacity).props.disabled).toBe(false);
    expect(texts(r)).toEqual(['Export Analytics']);
  });
});
