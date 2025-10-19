import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

type QuickLink = {
  key: string;
  label: string;
  icon: string;
  route: string;
  params?: any;
  color: string;
  bgColor: string;
};

const quickLinks: QuickLink[] = [
  {
    key: 'Dashboard',
    label: 'Dashboard',
    icon: 'home',
    route: 'Dashboard',
    color: '#3b82f6',
    bgColor: '#dbeafe',
  },
  {
    key: 'UserMapView',
    label: 'Map View',
    icon: 'map',
    route: 'Mapping',
    params: { screen: 'UserMapView' },
    color: '#10b981',
    bgColor: '#d1fae5',
  },
  {
    key: 'Sos',
    label: 'SOS',
    icon: 'alert-triangle',
    route: 'Sos',
    color: '#ef4444',
    bgColor: '#fee2e2',
  },
  {
    key: 'Analytics',
    label: 'Analytics',
    icon: 'bar-chart-2',
    route: 'Analytics',
    color: '#8b5cf6',
    bgColor: '#ede9fe',
  },
  {
    key: 'Profile',
    label: 'Profile',
    icon: 'user',
    route: 'ProfileStack',
    params: { screen: 'ProfileMain' },
    color: '#f59e0b',
    bgColor: '#fef3c7',
  },
];

export const QuickAccessNavigation: React.FC = () => {
  const navigation = useNavigation<any>();

  const handleNavigation = (link: QuickLink) => {
    if (link.params) {
      navigation.navigate(link.route, link.params);
    } else {
      navigation.navigate(link.route);
    }
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {quickLinks.map((link) => (
          <TouchableOpacity
            key={link.key}
            activeOpacity={0.8}
            style={styles.button}
            onPress={() => handleNavigation(link)}
          >
            <View style={[styles.iconWrapper, { backgroundColor: link.bgColor }]}>
              <Feather name={link.icon as any} size={20} color={link.color} />
            </View>
            <Text style={styles.label}>{link.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  scroll: {
    gap: 12,
    paddingVertical: 4,
  },
  button: {
    width: 96,
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#111827',
  },
});
