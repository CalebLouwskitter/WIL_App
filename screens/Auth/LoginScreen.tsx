import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, TextInput, Alert, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { loginUser, logoutUser } from '../../services/auth';
import { getUser } from '../../services/FirebaseUserService';

const LoginScreen = ({ navigation }: { navigation: any }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const userCredential = await loginUser(email.trim(), password);
      const user = await getUser(userCredential.user.uid);

      if (user && user.status === 'approved') {
        console.log('User signed in!', userCredential.user?.uid);
        setError('');
      } else if (user?.status === 'pending') {
        await logoutUser();
        Alert.alert(
          'Access Pending',
          'Your account is pending approval. You will be able to access the app once an administrator approves your account.'
        );
      } else if (user?.status === 'disapproved') {
        await logoutUser();
        Alert.alert(
          'Access Denied',
          'Your account access was denied. If you believe this is a mistake, please contact support.'
        );
      } else {
        await logoutUser();
        Alert.alert('Login Failed', 'Unable to verify account status. Please try again later.');
      }
    } catch (err: any) {
      switch (err?.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          setError('Wrong password');
          break;
        case 'auth/invalid-email':
          setError('Please enter a valid email address.');
          break;
        case 'auth/too-many-requests':
          setError('Too many attempts. Try again later.');
          break;
        default:
          setError('An unexpected error occurred. Please try again.');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/icons/SBHRA 1.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <View style={[styles.tab, styles.tabActive]}>
            <Text style={styles.tabTextActive}>Log In</Text>
          </View>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.tabTextInactive}>Sign Up</Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.formContainer}>
          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Your Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (error) setError('');
              }}
              placeholder="help@gmail.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (error) setError('');
                }}
                placeholder="••••••••"
                secureTextEntry={!isPasswordVisible}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setIsPasswordVisible(!isPasswordVisible)}
              >
                <Ionicons
                  name={isPasswordVisible ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color="#999"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Error and Forgot Password */}
          <View style={styles.errorForgotContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          {/* Continue Button */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6B7FED" />
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.continueButton, styles.continueButtonLogin]}
              onPress={handleLogin}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Bottom Link */}
        <View style={styles.bottomLinkContainer}>
          <Text style={styles.bottomText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.bottomLinkText}>Sign up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 120,
    height: 120,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 4,
    marginBottom: 32,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: '#6B7FED',
  },
  tabTextActive: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tabTextInactive: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666666',
  },
  formContainer: {
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#333333',
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#333333',
  },
  eyeIcon: {
    paddingHorizontal: 16,
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
    color: '#FF6B6B',
    flex: 1,
  },
  forgotText: {
    fontSize: 13,
    color: '#FF8A5B',
    fontWeight: '500',
  },
  loadingContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueButton: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  continueButtonLogin: {
    backgroundColor: '#6B7FED',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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
    color: '#666666',
  },
  bottomLinkText: {
    fontSize: 14,
    color: '#FF8A5B',
    fontWeight: '600',
  },
});

export default LoginScreen;
