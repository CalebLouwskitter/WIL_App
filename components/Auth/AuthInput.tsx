import React from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity, KeyboardTypeOptions } from 'react-native';
import { useAppTheme } from '../../hooks/useAppTheme';
import { Ionicons } from '@expo/vector-icons';

type AuthInputProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  onToggleVisibility?: () => void;
  isPasswordVisible?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
};

const AuthInput = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  onToggleVisibility,
  isPasswordVisible = false,
  keyboardType,
  autoCapitalize,
}: AuthInputProps) => {
  const { palette } = useAppTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: palette.textPrimary }]}>{label}</Text>
      <View style={[styles.inputContainer, { borderColor: palette.divider, backgroundColor: palette.card }]}>
        <TextInput
          style={[styles.input, { color: palette.textPrimary }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette.textMuted}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          accessibilityLabel={label}
        />
        {secureTextEntry && (
          <TouchableOpacity
            onPress={onToggleVisibility}
            style={styles.icon}
            accessibilityRole="button"
            accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Ionicons name={isPasswordVisible ? 'eye-off' : 'eye'} size={24} color={palette.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 15,
  },
  label: {
    marginBottom: 5,
    fontSize: 14,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
  },
  input: {
    flex: 1,
    padding: 15,
    fontSize: 16,
  },
  icon: {
    padding: 10,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AuthInput;
