import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useAppTheme } from '../../hooks/useAppTheme';

type AuthButtonProps = {
  title: string;
  onPress: () => void;
  isPrimary: boolean;
  disabled?: boolean;
  loading?: boolean;
};

const AuthButton = ({
  title,
  onPress,
  isPrimary,
  disabled = false,
  loading = false,
}: AuthButtonProps) => {
  const { palette } = useAppTheme();
  const buttonColor = isPrimary ? palette.primary : palette.primary_signup;
  const textColor = palette.onPrimary;

  const isDisabled = Boolean(disabled || loading);

  const handlePress = () => {
    if (isDisabled) return;
    onPress();
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: buttonColor },
        isDisabled && styles.buttonDisabled,
      ]}
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: Boolean(disabled), busy: Boolean(loading) }}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingVertical: 18,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default AuthButton;
