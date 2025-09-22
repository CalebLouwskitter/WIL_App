import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { logoutUser } from '../../services/auth';

export default function PendingApprovalScreen({ status }: { status: 'pending' | 'disapproved' | 'unknown' }) {
  const title = status === 'disapproved' ? 'Access Denied' : 'Access Pending';
  const message =
    status === 'disapproved'
      ? 'Your account access was denied. If you believe this is a mistake, please contact support.'
      : 'Your account is pending approval. You will be able to access the app once an administrator approves your account.';

  const handleLogout = async () => {
    try { await logoutUser(); } catch {}
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F7FE' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  message: { fontSize: 16, color: '#374151', textAlign: 'center', marginBottom: 24 },
  button: { backgroundColor: '#111827', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
