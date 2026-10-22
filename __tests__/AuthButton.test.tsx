import React from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import AuthButton from '../components/Auth/AuthButton';

const mockSendPasswordReset = jest.fn();
jest.mock('../services/auth', () => ({
  sendPasswordReset: (...args: unknown[]) => mockSendPasswordReset(...args),
}));
jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
  Ionicons: () => null,
}));

import ForgotPasswordScreen from '../screens/Auth/ForgotPasswordScreen';

describe('AuthButton', () => {
  it('calls onPress when pressed and not disabled or loading', () => {
    const onPress = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <AuthButton title="Submit" onPress={onPress} isPrimary={true} />
      );
    });

    const button = renderer.root.findByType(TouchableOpacity);
    act(() => {
      button.props.onPress();
    });

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled is true', () => {
    const onPress = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <AuthButton title="Submit" onPress={onPress} isPrimary={true} disabled={true} />
      );
    });

    const button = renderer.root.findByType(TouchableOpacity);
    act(() => {
      button.props.onPress();
    });

    expect(onPress).not.toHaveBeenCalled();
    expect(button.props.disabled).toBe(true);
  });

  it('does not call onPress when loading is true', () => {
    const onPress = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <AuthButton title="Submit" onPress={onPress} isPrimary={true} loading={true} />
      );
    });

    const button = renderer.root.findByType(TouchableOpacity);
    act(() => {
      button.props.onPress();
    });

    expect(onPress).not.toHaveBeenCalled();
    expect(button.props.disabled).toBe(true);
  });

  it('reflects disabled and busy state in accessibilityState', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <AuthButton title="Save" onPress={jest.fn()} isPrimary={true} disabled={true} loading={false} />
      );
    });

    let button = renderer.root.findByType(TouchableOpacity);
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityState).toEqual({ disabled: true, busy: false });

    act(() => {
      renderer.update(
        <AuthButton title="Save" onPress={jest.fn()} isPrimary={true} disabled={false} loading={true} />
      );
    });

    button = renderer.root.findByType(TouchableOpacity);
    expect(button.props.accessibilityState).toEqual({ disabled: false, busy: true });
  });

  it('keeps the accessibilityLabel as title when loading', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <AuthButton title="Send Reset Link" onPress={jest.fn()} isPrimary={true} loading={true} />
      );
    });

    const button = renderer.root.findByType(TouchableOpacity);
    expect(button.props.accessibilityLabel).toBe('Send Reset Link');
    expect(renderer.root.findAllByType(ActivityIndicator).length).toBe(1);
  });

  it('has a minimum height of at least 48', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <AuthButton title="Tap" onPress={jest.fn()} isPrimary={true} />
      );
    });

    const button = renderer.root.findByType(TouchableOpacity);
    const flatStyle = StyleSheet.flatten(button.props.style);
    expect(flatStyle.minHeight).toBeGreaterThanOrEqual(48);
  });
});

describe('ForgotPasswordScreen in-flight guard', () => {
  beforeEach(() => {
    mockSendPasswordReset.mockReset();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('cannot start a second request while one is in flight', async () => {
    let resolvePromise!: () => void;
    mockSendPasswordReset.mockReturnValue(
      new Promise<void>((resolve) => {
        resolvePromise = resolve;
      })
    );

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <ForgotPasswordScreen navigation={{ goBack: jest.fn() }} />
      );
    });

    // Enter email
    const input = renderer.root.findByType(TextInput);
    act(() => {
      input.props.onChangeText('test@example.com');
    });

    // Find AuthButton
    const authBtn = renderer.root.findByType(AuthButton);

    // First press - starts request
    await act(async () => {
      authBtn.findByType(TouchableOpacity).props.onPress();
    });
    expect(mockSendPasswordReset).toHaveBeenCalledTimes(1);

    // Second press while still in-flight
    await act(async () => {
      authBtn.findByType(TouchableOpacity).props.onPress();
    });
    // Must NOT call sendPasswordReset again
    expect(mockSendPasswordReset).toHaveBeenCalledTimes(1);

    // Resolve the in-flight request
    await act(async () => {
      resolvePromise();
    });
  });
});
