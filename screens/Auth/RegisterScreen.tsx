import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../../hooks/useAppTheme';
import AuthHeader from '../../components/Auth/AuthHeader';
import AuthInput from '../../components/Auth/AuthInput';
import AuthButton from '../../components/Auth/AuthButton';
import { registerUser } from '../../services/auth';

const RegisterScreen = ({ navigation }: { navigation: any }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { palette } = useAppTheme();

  const handleRegister = async () => {
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await registerUser(email.trim(), password);
      console.log('Registered user');
      setError('');
      navigation.navigate('VerifyEmail');
    } catch (err: any) {
      switch (err?.code) {
        case 'auth/email-already-in-use':
          setError('Email already in use.');
          break;
        case 'auth/invalid-email':
          setError('Please enter a valid email address.');
          break;
        case 'auth/weak-password':
          setError('Password must be at least 6 characters.');
          break;
        default:
          setError('Could not create account. Please try again.');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/images/logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <AuthHeader
          activeTab="SignUp"
          onTabPress={(tab) => (tab === 'Login' ? navigation.navigate('Login') : undefined)}
        />

        <AuthInput
          label="Your Email"
          value={email}
          onChangeText={setEmail}
          placeholder="contacthelp@gmail.com"
        />

        <AuthInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••••"
          secureTextEntry
          isPasswordVisible={isPasswordVisible}
          onToggleVisibility={() => setIsPasswordVisible(!isPasswordVisible)}
        />

        {/* Error and Forgot Password */}
        <View style={styles.errorForgotContainer}>
          <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={[styles.forgotText, { color: palette.primary_signup }]}>Forgot password?</Text>
          </TouchableOpacity>
        </View>

        {/* Continue Button */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={palette.primary_signup} />
          </View>
        ) : (
          <AuthButton title="Continue" onPress={handleRegister} isPrimary={false} />
        )}

        {/* Bottom Link */}
        <View style={styles.bottomLinkContainer}>
          <Text style={[styles.bottomText, { color: palette.textSecondary }]}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={[styles.bottomLinkText, { color: palette.primary }]}>Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  logo: {
    width: 120,
    height: 120,
  },
  errorForgotContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    minHeight: 20,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '500',
  },
  loadingContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  bottomLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    paddingBottom: 40,
  },
  bottomText: {
    fontSize: 14,
  },
  bottomLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default RegisterScreen;
