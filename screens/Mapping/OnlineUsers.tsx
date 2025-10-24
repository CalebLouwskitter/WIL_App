import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
  Image,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from 'react-native-vector-icons/Feather';
import { Colors } from '@/constants/colors';
import useOnlineUsers from '../../hooks/useOnlineUsers';
import { auth } from '../../services/firebase';
import { startLocationBroadcast, stopLocationBroadcast, type OnlineUser } from '../../services/OnlineUserService';
import * as Location from 'expo-location';

const OnlineUsersScreen = ({ navigation }: { navigation: any }) => {
  const { users, loading } = useOnlineUsers();
  const filteredUsers = React.useMemo(() => {
    const currentUid = auth?.currentUser?.uid;
    const byKey = new Map<string, OnlineUser>();
    for (const u of users) {
      // hide stale entries older than 5 minutes
      if (Date.now() - (u.lastSeen || 0) > 5 * 60 * 1000) continue;
      // exclude current user's uid
      if (currentUid && u.uid === currentUid) continue;
      const key = `${u.uid}_${u.deviceId || 'unknown'}`;
      const prev = byKey.get(key);
      if (!prev || (u.lastSeen || 0) > (prev.lastSeen || 0)) byKey.set(key, u);
    }
    return Array.from(byKey.values());
  }, [users]);
  const [selectedUser, setSelectedUser] = useState<OnlineUser | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];

  useEffect(() => {
    let cancelled = false;

    const initLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (!cancelled) {
            setCurrentLocation({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            });
          }
        }
      } catch (error) {
        console.warn('Failed to get location:', error);
      }
    };

    initLocation();
    startLocationBroadcast({ isRiding: false });

    return () => {
      cancelled = true;
      stopLocationBroadcast();
    };
  }, []);

  const formatLastSeen = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const handleUserPress = (user: OnlineUser) => {
    setSelectedUser(user);
  };

  const renderUserItem = ({ item }: { item: OnlineUser }) => (
    <TouchableOpacity
      style={[
        styles.userItem,
        {
          backgroundColor: palette.cardElevated,
          borderColor: selectedUser?.uid === item.uid ? palette.brandPrimary : palette.borderMuted,
        },
      ]}
      onPress={() => handleUserPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.userItemLeft}>
        {item.photoURL ? (
          <Image source={{ uri: item.photoURL }} style={styles.userAvatar} />
        ) : (
          <View style={[styles.userAvatarPlaceholder, { backgroundColor: palette.brandMuted }]}>
            <Feather name="user" size={20} color={palette.brandPrimary} />
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: palette.text }]}>{item.displayName || 'Anonymous'}</Text>
          <Text style={[styles.userLastSeen, { color: palette.placeholder }]}>
            {formatLastSeen(item.lastSeen)}
          </Text>
        </View>
      </View>
      {item.isRiding && (
        <View style={[styles.ridingBadge, { backgroundColor: palette.success }]}>
          <Text style={styles.ridingText}>Riding</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const mapRegion = selectedUser
    ? {
        latitude: selectedUser.location.latitude,
        longitude: selectedUser.location.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    : currentLocation
    ? {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      }
    : {
        latitude: -34.033130004432124,
        longitude: 25.498116965895196,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          region={mapRegion}
          showsUserLocation
          showsMyLocationButton
        >
          {filteredUsers.map((user) => (
            <Marker
              key={`${user.uid}_${user.deviceId || 'unknown'}`}
              coordinate={user.location}
              title={user.displayName || 'Anonymous'}
              description={formatLastSeen(user.lastSeen)}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              {user.photoURL ? (
                <View style={styles.avatarShadow}>
                  <Image source={{ uri: user.photoURL }} style={styles.avatar} />
                </View>
              ) : (
                <View style={[styles.avatar, { backgroundColor: user.isRiding ? palette.success : palette.brandPrimary }]} />
              )}
            </Marker>
          ))}
        </MapView>
      </View>

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Online Users</Text>
        <View style={styles.headerRight} />
      </View>

      <View
        style={[
          styles.listContainer,
          {
            backgroundColor: palette.cardElevated,
            borderTopColor: palette.borderMuted,
          },
        ]}
      >
        <View style={styles.listHeader}>
          <Text style={[styles.listTitle, { color: palette.text }]}>Active Riders</Text>
          <View style={[styles.countBadge, { backgroundColor: palette.brandPrimary }]}>
            <Text style={styles.countText}>{filteredUsers.length}</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={palette.brandPrimary} />
          </View>
        ) : filteredUsers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="users" size={48} color={palette.placeholder} />
            <Text style={[styles.emptyText, { color: palette.placeholder }]}>No active riders nearby</Text>
          </View>
        ) : (
          <FlatList
            data={filteredUsers}
            renderItem={renderUserItem}
            keyExtractor={(item) => item.uid}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerRight: {
    width: 40,
  },
  listContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  countBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
  },
  userItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  userAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  userLastSeen: {
    fontSize: 13,
  },
  ridingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ridingText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    borderRadius: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
});

export default OnlineUsersScreen;