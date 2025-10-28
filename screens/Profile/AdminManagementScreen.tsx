import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getAllUsers, approveUser, disapproveUser, deleteUserDoc, seedUsersRbac, setUserRole } from '../../services/FirebaseUserService';
import { User } from '../../types/User'; // Assuming a User type exists

export default function AdminManagementScreen() {
  const navigation = useNavigation();
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const allUsers = await getAllUsers();
      setUsers(allUsers);
    } catch (error) {
      Alert.alert('Error', 'Could not fetch users.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(searchQuery.trim().toLowerCase()), 250);
    return () => clearTimeout(id);
  }, [searchQuery]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const allUsers = await getAllUsers();
      setUsers(allUsers);
    } catch (error) {
      Alert.alert('Error', 'Could not refresh users.');
      console.error(error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleApprove = async (userId: string) => {
    try {
      await approveUser(userId);
      Alert.alert('Success', 'User has been approved.');
      fetchUsers(); // Refresh the list
    } catch (error) {
      Alert.alert('Error', 'Could not approve user.');
      console.error(error);
    }
  };

  const handleDisapprove = async (userId: string) => {
    try {
      await disapproveUser(userId);
      Alert.alert('Success', 'User has been disapproved.');
      fetchUsers(); // Refresh the list
    } catch (error) {
      Alert.alert('Error', 'Could not disapprove user.');
      console.error(error);
    }
  };

  const handleDelete = async (userId: string) => {
    Alert.alert('Delete User', 'Are you sure you want to delete this user document?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteUserDoc(userId);
            Alert.alert('Deleted', 'User document deleted.');
            fetchUsers();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete user');
          }
        }
      }
    ]);
  };

  const handleSeed = async () => {
    try {
      await seedUsersRbac();
      Alert.alert('Seed Completed', 'Users updated with role/status where missing.');
      fetchUsers();
    } catch (e) {
      Alert.alert('Error', 'Failed to run seed.');
    }
  };

  

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const filteredUsers = users.filter(u => (u.email || '').toLowerCase().includes(debouncedQuery));

  const renderHighlightedEmail = (email: string) => {
    const q = debouncedQuery;
    if (!q) {
      return <Text style={styles.userEmail}>{email}</Text>;
    }
    const lower = email.toLowerCase();
    const idx = lower.indexOf(q);
    if (idx === -1) {
      return <Text style={styles.userEmail}>{email}</Text>;
    }
    const before = email.slice(0, idx);
    const match = email.slice(idx, idx + q.length);
    const after = email.slice(idx + q.length);
    return (
      <Text style={styles.userEmail}>
        {before}
        <Text style={styles.highlight}>{match}</Text>
        {after}
      </Text>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={24} color="#111" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title}>Admin</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>
      <View style={styles.promoteRow}>
        <TextInput
          style={styles.input}
          placeholder="Search by email"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      <TouchableOpacity 
        style={styles.adminActionButton}
        onPress={() => (navigation as any).navigate('AdminNotificationManagement')}
      >
        <Ionicons name="notifications" size={20} color="#FFFFFF" />
        <Text style={styles.adminActionButtonText}>Manage Notifications</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={[styles.adminActionButton, styles.obstacleActionButton]}
        onPress={() => (navigation as any).navigate('AdminObstacleManagement')}
      >
        <Ionicons name="warning" size={20} color="#FFFFFF" />
        <Text style={styles.adminActionButtonText}>Manage Obstacles</Text>
      </TouchableOpacity>
      <FlatList
        data={filteredUsers}
        renderItem={({ item }) => {
          const status = item.status ?? 'pending';
          const role = item.role ?? 'member';
          const isApproved = status === 'approved';
          const isDenied = status === 'disapproved';
          return (
            <View style={styles.userItem}>
              <View style={{marginBottom: 10}}>
                {renderHighlightedEmail(item.email || '')}
                <View style={styles.chipsRow}>
                  <View style={[styles.chip, status === 'approved' ? styles.chipApproved : status === 'disapproved' ? styles.chipDisapproved : styles.chipPending]}>
                    <Text style={styles.chipText}>{status}</Text>
                  </View>
                  <View style={[styles.chip, role === 'admin' ? styles.chipRoleAdmin : styles.chipRoleMember]}>
                    <Text style={styles.chipText}>{role}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.approveButton,
                    (isApproved) && styles.buttonDisabled
                  ]}
                  disabled={isApproved}
                  onPress={() => handleApprove(item.uid)}
                >
                  <Text style={styles.buttonText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.disapproveButton,
                    (isDenied) && styles.buttonDisabled
                  ]}
                  disabled={isDenied}
                  onPress={() => handleDisapprove(item.uid)}
                >
                  <Text style={styles.buttonText}>Deny</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor:'#2563eb' }]}
                  onPress={async () => { await setUserRole(item.uid, role === 'admin' ? 'member' : 'admin'); fetchUsers(); }}
                >
                  <Text style={styles.buttonText}>{role === 'admin' ? 'Make Member' : 'Make Admin'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor:'#6b7280' }]}
                  onPress={() => handleDelete(item.uid)}
                >
                  <Text style={styles.buttonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        keyExtractor={(item) => item.uid}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={{ paddingBottom: 24, flexGrow: users.length ? 0 : 1 }}
        ListEmptyComponent={
          <View style={{flex:1, alignItems:'center', justifyContent:'center', paddingVertical: 40}}>
            <Text>No users to manage right now.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F4F7FE',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F7FE',
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  userItem: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  userEmail: {
    fontSize: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    marginRight: 10,
    marginBottom: 8,
  },
  approveButton: {
    backgroundColor: '#28a745',
  },
  disapproveButton: {
    backgroundColor: '#dc3545',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  promoteRow: {
    marginTop: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  promoteButton: {
    backgroundColor: '#0ea5e9',
    marginLeft: 10,
  },
  highlight: {
    backgroundColor: '#FEF08A',
  },
  chipsRow: {
    marginTop: 6,
    flexDirection: 'row',
  },
  chip: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    marginRight: 8,
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  chipApproved: {
    backgroundColor: '#16a34a',
  },
  chipDisapproved: {
    backgroundColor: '#dc2626',
  },
  chipPending: {
    backgroundColor: '#f59e0b',
  },
  chipRoleAdmin: {
    backgroundColor: '#2563eb',
  },
  chipRoleMember: {
    backgroundColor: '#6b7280',
  },
  adminActionButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  adminActionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  obstacleActionButton: {
    backgroundColor: '#dc2626',
  },
});
