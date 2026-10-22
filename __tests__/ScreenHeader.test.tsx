import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { ScreenHeader } from '../components/ScreenHeader';
import { Spacing } from '../constants/styleguide';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 40, bottom: 20, left: 0, right: 0 }),
}));
jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}));

describe('ScreenHeader', () => {
  it('includes the safe-area top inset in container top padding', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<ScreenHeader title="Test Title" />);
    });

    const rootViews = renderer.root.findAllByType(View);
    // Outer container is the first View
    const outerContainer = rootViews[0];
    const flatStyle = StyleSheet.flatten(outerContainer.props.style);
    expect(flatStyle.paddingTop).toBe(40 + Spacing.sm);
  });

  it('renders title text', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<ScreenHeader title="Dashboard Header" />);
    });

    const texts = renderer.root.findAllByType(Text);
    const titleText = texts.find((t) => [t.props.children].flat().join('') === 'Dashboard Header');
    expect(titleText).toBeDefined();
  });

  it('renders the back button with button role and default label, and calls onBack when pressed', () => {
    const onBack = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<ScreenHeader title="Settings" onBack={onBack} />);
    });

    const buttons = renderer.root.findAllByType(TouchableOpacity);
    expect(buttons.length).toBe(1);
    expect(buttons[0].props.accessibilityRole).toBe('button');
    expect(buttons[0].props.accessibilityLabel).toBe('Go back');

    act(() => {
      buttons[0].props.onPress();
    });
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('uses a custom backLabel when provided', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <ScreenHeader title="Settings" onBack={jest.fn()} backLabel="Return to home" />
      );
    });

    const button = renderer.root.findByType(TouchableOpacity);
    expect(button.props.accessibilityLabel).toBe('Return to home');
  });

  it('does not render a back button when onBack is omitted', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<ScreenHeader title="Root Screen" />);
    });

    const buttons = renderer.root.findAllByType(TouchableOpacity);
    expect(buttons.length).toBe(0);
  });

  it('renders the custom right slot when provided', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <ScreenHeader
          title="With Right Slot"
          right={<Text testID="right-action">Save</Text>}
        />
      );
    });

    const texts = renderer.root.findAllByType(Text);
    const hasRightAction = texts.some((t) => [t.props.children].flat().join('') === 'Save');
    expect(hasRightAction).toBe(true);
  });
});
