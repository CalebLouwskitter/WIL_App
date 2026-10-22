import React from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity, useColorScheme, KeyboardTypeOptions } from 'react-native';
import { resolvePalette } from '@/constants/colors';
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
  const colorScheme = useColorScheme();
  const colors = resolvePalette(colorScheme);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.darkGrey }]}>{label}</Text>
      <View style={[styles.inputContainer, { borderColor: colors.lightGrey, backgroundColor: colors.surface }]}>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
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
            <Ionicons name={isPasswordVisible ? 'eye-off' : 'eye'} size={24} color={colors.placeholder} />
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
