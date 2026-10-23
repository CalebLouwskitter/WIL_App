import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAppTheme } from '../../hooks/useAppTheme';

type AuthHeaderProps = {
  activeTab: 'Login' | 'SignUp';
  onTabPress: (tab: 'Login' | 'SignUp') => void;
};

const AuthHeader = ({ activeTab, onTabPress }: AuthHeaderProps) => {
  const { palette } = useAppTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.tabsContainer, { borderColor: palette.divider }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            { backgroundColor: palette.card },
            activeTab === 'Login' && { backgroundColor: palette.primary },
          ]}
          onPress={() => onTabPress('Login')}
        >
          <Text style={[
            styles.tabText,
            activeTab === 'Login' ? { color: palette.onPrimary } : { color: palette.textSecondary }
          ]}>
            Log In
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            { backgroundColor: palette.card },
            activeTab === 'SignUp' && { backgroundColor: palette.primary_signup },
          ]}
          onPress={() => onTabPress('SignUp')}
        >
          <Text style={[
            styles.tabText,
            activeTab === 'SignUp' ? { color: palette.onPrimary } : { color: palette.textSecondary }
          ]}>
            Sign Up
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: 20,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 30,
  },
  tabText: {
    fontWeight: 'bold',
  },
});

export default AuthHeader;
