import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { getAllUsers, approveUser, disapproveUser } from '../../services/FirebaseUserService'; // Assuming these functions will be created
import { User } from '../../types/User'; // Assuming a User type exists

export default function AdminManagementScreen() {
  const [users, setUsers] = useState<User[]>([]);

  const fetchUsers = async () => {
    try {
      const allUsers = await getAllUsers();
      // Filter out already approved users or other criteria if needed
      setUsers(allUsers.filter(u => u.status !== 'approved'));
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>User Management</Text>
      <FlatList
        data={users}
        renderItem={renderUserItem}
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
});
