import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather as Icon } from '@expo/vector-icons';
import { useAppTheme } from '../../hooks/useAppTheme';
import { resendVerificationEmail } from '../../services/auth';
import { auth } from '../../services/firebase';
import AuthButton from '../../components/Auth/AuthButton';

const VerifyEmailScreen = ({ navigation }: { navigation: any }) => {
  const { palette } = useAppTheme();
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const handleResendEmail = async () => {
    if (cooldown > 0) {
      Alert.alert('Please wait', `You can resend in ${cooldown} seconds.`);
      return;
    }

    const user = auth?.currentUser;
    if (!user) {
      Alert.alert('Error', 'No user found. Please register again.');
      return;
    }

    setResending(true);
    try {
      await resendVerificationEmail(user);
      Alert.alert('Email Sent', 'A new verification email has been sent to your inbox.');
      
      // Set cooldown for 60 seconds
      setCooldown(60);
      const interval = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error: any) {
      console.error('Error resending verification email:', error);
      Alert.alert('Error', 'Failed to resend verification email. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleGoToLogin = () => {
    navigation.navigate('Login');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
      <LinearGradient
        colors={[palette.gradientPrimaryStart, palette.gradientPrimaryEnd]}
        style={styles.header}
      >
        <View style={styles.iconContainer}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}>
            <Icon name="mail" size={48} color={palette.onPrimary} />
          </View>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <Text style={[styles.title, { color: palette.textPrimary }]}>Verify Your Email</Text>
        <Text style={[styles.body, { color: palette.textSecondary }]}>
          We sent a verification link to your email. Please check your inbox (and spam folder) and click the link to verify your account.
        </Text>

        <View style={styles.instructionBox}>
          <View style={styles.instructionItem}>
            <View style={[styles.stepCircle, { backgroundColor: palette.brandPrimary }]}>
              <Text style={[styles.stepNumber, { color: palette.onPrimary }]}>1</Text>
            </View>
            <Text style={[styles.instructionText, { color: palette.textPrimary }]}>
              Check your email inbox
            </Text>
          </View>
          
          <View style={styles.instructionItem}>
            <View style={[styles.stepCircle, { backgroundColor: palette.brandPrimary }]}>
              <Text style={[styles.stepNumber, { color: palette.onPrimary }]}>2</Text>
            </View>
            <Text style={[styles.instructionText, { color: palette.textPrimary }]}>
              Click the verification link
            </Text>
          </View>
          
          <View style={styles.instructionItem}>
            <View style={[styles.stepCircle, { backgroundColor: palette.brandPrimary }]}>
              <Text style={[styles.stepNumber, { color: palette.onPrimary }]}>3</Text>
            </View>
            <Text style={[styles.instructionText, { color: palette.textPrimary }]}>
              Return here and log in
            </Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <AuthButton
            title={resending ? "Sending..." : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Verification Email"}
            onPress={handleResendEmail}
            isPrimary={false}
          />

          <AuthButton
            title="Go to Login"
            onPress={handleGoToLogin}
            isPrimary={true}
          />
        </View>

        <View style={styles.helpContainer}>
          <Icon name="info" size={16} color={palette.brandPrimary} />
          <Text style={[styles.helpText, { color: palette.textSecondary }]}>
            Didn't receive an email? Check your spam folder or resend.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  header: {
    paddingTop: 40,
    paddingBottom: 40,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  instructionBox: {
    marginBottom: 30,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  instructionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  buttonContainer: {
    marginBottom: 20,
  },
  helpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpText: {
    fontSize: 14,
    marginLeft: 6,
    textAlign: 'center',
  },
});

export default VerifyEmailScreen;
