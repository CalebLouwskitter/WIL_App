import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, useColorScheme, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather as Icon } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { resendVerificationEmail } from '../../services/auth';
import { auth } from '../../services/firebase';
import AuthButton from '../../components/Auth/AuthButton';

const VerifyEmailScreen = ({ navigation }: { navigation: any }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.white }]}>
      <LinearGradient
        colors={[colors.gradientPrimaryStart, colors.gradientPrimaryEnd]}
        style={styles.header}
      >
        <View style={styles.iconContainer}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}>
            <Icon name="mail" size={48} color={colors.white} />
          </View>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.darkGrey }]}>Verify Your Email</Text>
        <Text style={[styles.body, { color: colors.darkGrey }]}>
          We sent a verification link to your email. Please check your inbox (and spam folder) and click the link to verify your account.
        </Text>

        <View style={styles.instructionBox}>
          <View style={styles.instructionItem}>
            <View style={[styles.stepCircle, { backgroundColor: colors.brandPrimary }]}>
              <Text style={styles.stepNumber}>1</Text>
            </View>
            <Text style={[styles.instructionText, { color: colors.darkGrey }]}>
              Check your email inbox
            </Text>
          </View>
          
          <View style={styles.instructionItem}>
            <View style={[styles.stepCircle, { backgroundColor: colors.brandPrimary }]}>
              <Text style={styles.stepNumber}>2</Text>
            </View>
            <Text style={[styles.instructionText, { color: colors.darkGrey }]}>
              Click the verification link
            </Text>
          </View>
          
          <View style={styles.instructionItem}>
            <View style={[styles.stepCircle, { backgroundColor: colors.brandPrimary }]}>
              <Text style={styles.stepNumber}>3</Text>
            </View>
            <Text style={[styles.instructionText, { color: colors.darkGrey }]}>
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
          <Icon name="info" size={16} color={colors.link} />
          <Text style={[styles.helpText, { color: colors.darkGrey }]}>
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
    paddingTop: 60,
    paddingBottom: 60,
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
    padding: 24,
    justifyContent: 'center',
  },
  title: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    marginBottom: 12,
    textAlign: 'center',
  },
  body: { 
    fontSize: 16, 
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  instructionBox: {
    marginBottom: 32,
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
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  instructionText: {
    fontSize: 15,
    flex: 1,
  },
  buttonContainer: {
    marginBottom: 24,
  },
  helpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  helpText: {
    fontSize: 14,
    marginLeft: 8,
    textAlign: 'center',
    flex: 1,
  },
});

export default VerifyEmailScreen;
