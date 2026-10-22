import React from 'react';
import { TextInput, TouchableOpacity } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import AuthInput from '../components/Auth/AuthInput';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

describe('AuthInput accessibility', () => {
  it('sets accessibilityLabel on the TextInput matching label prop', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <AuthInput
          label="Email Address"
          value=""
          onChangeText={jest.fn()}
          placeholder="Enter email"
        />
      );
    });

    const input = renderer.root.findByType(TextInput);
    expect(input.props.accessibilityLabel).toBe('Email Address');
  });

  it('renders eye toggle with button role and flips label between Show password and Hide password', () => {
    const onToggle = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <AuthInput
          label="Password"
          value="secret"
          onChangeText={jest.fn()}
          placeholder="••••••••"
          secureTextEntry={true}
          isPasswordVisible={false}
          onToggleVisibility={onToggle}
        />
      );
    });

    let toggleBtn = renderer.root.findByType(TouchableOpacity);
    expect(toggleBtn.props.accessibilityRole).toBe('button');
    expect(toggleBtn.props.accessibilityLabel).toBe('Show password');
    expect(toggleBtn.props.hitSlop).toBeDefined();

    // Toggle to visible
    act(() => {
      renderer.update(
        <AuthInput
          label="Password"
          value="secret"
          onChangeText={jest.fn()}
          placeholder="••••••••"
          secureTextEntry={true}
          isPasswordVisible={true}
          onToggleVisibility={onToggle}
        />
      );
    });

    toggleBtn = renderer.root.findByType(TouchableOpacity);
    expect(toggleBtn.props.accessibilityLabel).toBe('Hide password');

    // Pressing the toggle triggers onToggleVisibility
    act(() => {
      toggleBtn.props.onPress();
    });
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('does not render eye toggle when secureTextEntry is false or omitted', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <AuthInput
          label="Username"
          value="user"
          onChangeText={jest.fn()}
          placeholder="Username"
        />
      );
    });

    const buttons = renderer.root.findAllByType(TouchableOpacity);
    expect(buttons.length).toBe(0);
  });
});
