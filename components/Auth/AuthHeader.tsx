import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import { Colors } from '../../constants/colors';

type AuthHeaderProps = {
  activeTab: 'Login' | 'SignUp';
  onTabPress: (tab: 'Login' | 'SignUp') => void;
};

const AuthHeader = ({ activeTab, onTabPress }: AuthHeaderProps) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <View style={styles.container}>
      <View style={[styles.tabsContainer, { borderColor: colors.lightGrey }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            { backgroundColor: colors.inactiveTab },
            activeTab === 'Login' && { backgroundColor: colors.primary },
          ]}
          onPress={() => onTabPress('Login')}
        >
          <Text style={[
            styles.tabText,
            activeTab === 'Login' ? { color: colors.white } : { color: colors.darkGrey }
          ]}>
            Log In
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            { backgroundColor: colors.inactiveTab },
            activeTab === 'SignUp' && { backgroundColor: colors.primary_signup },
          ]}
          onPress={() => onTabPress('SignUp')}
        >
          <Text style={[
            styles.tabText,
            activeTab === 'SignUp' ? { color: colors.white } : { color: colors.darkGrey }
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