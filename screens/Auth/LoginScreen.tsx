import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../../hooks/useAppTheme';
import AuthHeader from '../../components/Auth/AuthHeader';
import AuthInput from '../../components/Auth/AuthInput';
import AuthButton from '../../components/Auth/AuthButton';
import { loginUser, logoutUser } from '../../services/auth';
import { getUser } from '../../services/FirebaseUserService';

const LoginScreen = ({ navigation }: { navigation: any }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { palette } = useAppTheme();

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
        console.log('User signed in!');
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
          activeTab="Login"
          onTabPress={(tab) => (tab === 'SignUp' ? navigation.navigate('Register') : undefined)}
        />

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
            <ActivityIndicator size="large" color={palette.primary} />
          </View>
        ) : (
          <AuthButton title="Continue" onPress={handleLogin} isPrimary={true} />
        )}

        {/* Bottom Link */}
        <View style={styles.bottomLinkContainer}>
          <Text style={[styles.bottomText, { color: palette.textSecondary }]}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={[styles.bottomLinkText, { color: palette.primary_signup }]}>Sign up</Text>
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

export default LoginScreen;
