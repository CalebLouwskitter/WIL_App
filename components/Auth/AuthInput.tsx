import React from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity, useColorScheme, KeyboardTypeOptions } from 'react-native';
import { Colors } from '@/constants/colors'; // adjust path as needed
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
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.darkGrey }]}>{label}</Text>
      <View style={[styles.inputContainer, { borderColor: colors.lightGrey, backgroundColor: colors.white }]}>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={onToggleVisibility} style={styles.icon}>
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
  },
});

export default AuthInput;
