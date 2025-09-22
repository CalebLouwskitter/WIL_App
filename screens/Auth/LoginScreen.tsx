import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, useColorScheme } from 'react-native';
import { Colors } from '../../constants/colors';
import AuthHeader from '../../components/Auth/AuthHeader';
import AuthInput from '../../components/Auth/AuthInput';
import AuthButton from '../../components/Auth/AuthButton';
import SocialButton from '../../components/Auth/SocialButton';
import { loginUser, logoutUser } from '../../services/auth';
import { getUser } from '../../services/FirebaseUserService';
import { Alert } from 'react-native';

const LoginScreen = ({ navigation }: { navigation: any }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    try {
      const userCredential = await loginUser(email.trim(), password);
      const user = await getUser(userCredential.user.uid);

      if (user && user.status === 'approved') {
        console.log('User signed in!', userCredential.user?.uid);
        setError('');
        // TODO: Navigate to main app screen
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
          setError('Invalid email or password.');
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
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.white }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <AuthHeader activeTab="Login" onTabPress={() => navigation.navigate('Register')} />

        <AuthInput
          label="Your Email"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (error) setError('');
          }}
          placeholder="help@gmail.com"
        />

        <AuthInput
          label="Password"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (error) setError('');
          }}
          placeholder="••••••••••"
          secureTextEntry={!isPasswordVisible}
          isPasswordVisible={isPasswordVisible}
          onToggleVisibility={() => setIsPasswordVisible(!isPasswordVisible)}
        />

        <View style={styles.forgotPasswordContainer}>
          {error ? (
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          ) : (
            <View />
          )}
          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={[styles.link, { color: colors.link }]}>Forgot password?</Text>
          </TouchableOpacity>
        </View>

        <AuthButton title="Continue" onPress={handleLogin} isPrimary={true} />

        <View style={styles.orContainer}>
          <View style={[styles.line, { backgroundColor: colors.lightGrey }]} />
          <Text style={[styles.orText, { color: colors.darkGrey }]}>Or</Text>
          <View style={[styles.line, { backgroundColor: colors.lightGrey }]} />
        </View>

        <SocialButton title="Login with Apple" iconName="logo-apple" onPress={() => {}} />
        <SocialButton title="Login with Google" iconName="logo-google" onPress={() => {}} />

        <View style={styles.bottomTextContainer}>
          <Text style={[styles.bottomText, { color: colors.darkGrey }]}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={[styles.link, { color: colors.link }]}>Sign up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: { padding: 20 },
  forgotPasswordContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    alignItems: 'center',
  },
  errorText: { fontSize: 14 },
  link: { fontSize: 14, fontWeight: 'bold' },
  orContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  line: { flex: 1, height: 1 },
  orText: { marginHorizontal: 10 },
  bottomTextContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  bottomText: {},
});

export default LoginScreen;
