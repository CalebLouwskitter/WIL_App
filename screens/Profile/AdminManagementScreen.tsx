import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput } from 'react-native';
import { getAllUsers, approveUser, disapproveUser, deleteUserDoc, seedUsersRbac, setUserRole, ensureAdminByEmail } from '../../services/FirebaseUserService';
import { User } from '../../types/User'; // Assuming a User type exists

export default function AdminManagementScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [adminEmail, setAdminEmail] = useState('');

  const fetchUsers = async () => {
    try {
  const allUsers = await getAllUsers();
  setUsers(allUsers);
    } catch (error) {
      Alert.alert('Error', 'Could not fetch users.');
      console.error(error);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

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

  const renderUserItem = ({ item }: { item: User }) => (
    <View style={styles.userItem}>
      <Text style={styles.userEmail}>{item.email}</Text>
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={[styles.button, styles.approveButton]} onPress={() => handleApprove(item.uid)}>
          <Text style={styles.buttonText}>Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.disapproveButton]} onPress={() => handleDisapprove(item.uid)}>
          <Text style={styles.buttonText}>Disapprove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const handlePromoteByEmail = async () => {
    const email = adminEmail.trim();
    if (!email) {
      Alert.alert('Validation', 'Please enter an email to promote.');
      return;
    }
    try {
      const ok = await ensureAdminByEmail(email);
      if (ok) {
        Alert.alert('Success', `Promoted ${email} to admin and approved.`);
        setAdminEmail('');
        fetchUsers();
      } else {
        Alert.alert('Not found', `No user document found with email ${email}.`);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to promote by email.');
      console.error(e);
    }
  };

  return (
    <View style={styles.container}>
      <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
        <Text style={styles.title}>User Management</Text>
        <TouchableOpacity onPress={handleSeed} style={[styles.button, { backgroundColor:'#111' }]}> 
          <Text style={styles.buttonText}>Seed RBAC</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.promoteRow}>
        <TextInput
          style={styles.input}
          placeholder="email@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={adminEmail}
          onChangeText={setAdminEmail}
        />
        <TouchableOpacity style={[styles.button, styles.promoteButton]} onPress={handlePromoteByEmail}>
          <Text style={styles.buttonText}>Promote Admin</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={users}
        renderItem={({ item }) => (
          <View style={styles.userItem}>
            <View>
              <Text style={styles.userEmail}>{item.email}</Text>
              <Text>Status: {item.status ?? 'pending'} • Role: {item.role ?? 'member'}</Text>
            </View>
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={[styles.button, styles.approveButton]} onPress={() => handleApprove(item.uid)}>
                <Text style={styles.buttonText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.disapproveButton]} onPress={() => handleDisapprove(item.uid)}>
                <Text style={styles.buttonText}>Deny</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, { backgroundColor:'#2563eb' }]} onPress={async () => { await setUserRole(item.uid, item.role === 'admin' ? 'member' : 'admin'); fetchUsers(); }}>
                <Text style={styles.buttonText}>{item.role === 'admin' ? 'Make Member' : 'Make Admin'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, { backgroundColor:'#6b7280' }]} onPress={() => handleDelete(item.uid)}>
                <Text style={styles.buttonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        keyExtractor={(item) => item.uid}
        ListEmptyComponent={<Text>No pending users for approval.</Text>}
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  userItem: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userEmail: {
    fontSize: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    marginLeft: 10,
  },
  approveButton: {
    backgroundColor: '#28a745',
  },
  disapproveButton: {
    backgroundColor: '#dc3545',
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
});
