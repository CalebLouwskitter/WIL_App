import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, useColorScheme, Image } from 'react-native';
import { Colors } from '../../constants/colors';
import AuthHeader from '../../components/Auth/AuthHeader';
import AuthInput from '../../components/Auth/AuthInput';
import AuthButton from '../../components/Auth/AuthButton';
import SocialButton from '../../components/Auth/SocialButton';
import { registerUser } from '../../services/auth';

const RegisterScreen = ({ navigation }: { navigation: any }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    try {
      const userCredential = await registerUser(email.trim(), password);
      console.log('Registered user:', userCredential.user?.uid);
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
          setError('Password is too weak.');
          break;
        default:
          setError('Could not create account. Please try again.');
      }
      console.error(err);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.white }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/images/logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <AuthHeader activeTab="SignUp" onTabPress={() => navigation.navigate('Login')} />

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

        <View style={styles.forgotPasswordContainer}>
          {!!error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}
          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={[styles.link, { color: colors.link }]}>Forgot password?</Text>
          </TouchableOpacity>
        </View>

        <AuthButton title="Continue" onPress={handleRegister} isPrimary={false} />

        <View style={styles.orContainer}>
          <View style={[styles.line, { backgroundColor: colors.lightGrey }]} />
          <Text style={[styles.orText, { color: colors.darkGrey }]}>Or</Text>
          <View style={[styles.line, { backgroundColor: colors.lightGrey }]} />
        </View>

        <SocialButton title="Login with Apple" iconName="logo-apple" onPress={() => {}} />
        <SocialButton title="Login with Google" iconName="logo-google" onPress={() => {}} />

        <View style={styles.bottomTextContainer}>
          <Text style={[styles.bottomText, { color: colors.darkGrey }]}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={[styles.link, { color: colors.link }]}>Login</Text>
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
    padding: 20,
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
  forgotPasswordContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
  },
  link: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  orContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  line: {
    flex: 1,
    height: 1,
  },
  orText: {
    marginHorizontal: 10,
  },
  bottomTextContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  bottomText: {},
});

export default RegisterScreen;