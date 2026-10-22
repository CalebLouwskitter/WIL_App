import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather as Icon } from '@expo/vector-icons';
import { useAppTheme } from '../../hooks/useAppTheme';
import AuthInput from '../../components/Auth/AuthInput';
import AuthButton from '../../components/Auth/AuthButton';
import { sendPasswordReset } from '../../services/auth';

const ForgotPasswordScreen = ({ navigation }: { navigation: any }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const { palette } = useAppTheme();

  const handleResetPassword = async () => {
    if (loading) return;
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await sendPasswordReset(email.trim());
      setEmailSent(true);
      Alert.alert(
        'Reset Email Sent',
        'Check your inbox for password reset instructions.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      switch (err?.code) {
        case 'auth/user-not-found':
          setError('No account found with this email address.');
          break;
        case 'auth/invalid-email':
          setError('Please enter a valid email address.');
          break;
        case 'auth/too-many-requests':
          setError('Too many attempts. Please try again later.');
          break;
        default:
          setError('Failed to send reset email. Please try again.');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
      <LinearGradient
        colors={[palette.gradientPrimaryStart, palette.gradientPrimaryEnd]}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color={palette.onPrimary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Icon name="lock" size={48} color={palette.onPrimary} />
          <Text style={[styles.headerTitle, { color: palette.onPrimary }]}>Forgot Password</Text>
          <Text style={[styles.headerSubtitle, { color: palette.onPrimary }]}>
            No worries, we'll send you reset instructions
          </Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.formContainer}>
          <AuthInput
            label="Email Address"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (error) setError('');
            }}
            placeholder="your.email@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {error ? (
            <View style={styles.errorContainer}>
              <Icon name="alert-circle" size={16} color={palette.danger} />
              <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
            </View>
          ) : null}

          <AuthButton
            title={loading ? "Sending..." : "Reset Password"}
            onPress={handleResetPassword}
            isPrimary={true}
            loading={loading}
            disabled={loading}
          />

          <TouchableOpacity
            style={styles.backToLoginContainer}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" size={16} color={palette.brandPrimary} />
            <Text style={[styles.backToLoginText, { color: palette.brandPrimary }]}>
              Back to Login
            </Text>
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
  header: {
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  backButton: {
    marginBottom: 20,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.9,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  formContainer: {
    width: '100%',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  errorText: {
    fontSize: 14,
    marginLeft: 8,
  },
  backToLoginContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
  },
  backToLoginText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default ForgotPasswordScreen;
