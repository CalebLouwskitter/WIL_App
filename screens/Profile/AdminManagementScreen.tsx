import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { getAllUsers, approveUser, disapproveUser, deleteUserDoc, setUserRole } from '../../services/FirebaseUserService';
import { User } from '../../types/User';
import type { ProfileStackParamList } from '../../navigation/ProfileStack';
import { useAppTheme, type AppPalette } from '../../hooks/useAppTheme';

type AdminManagementScreenNavigationProp = StackNavigationProp<ProfileStackParamList, 'AdminManagement'>;

export default function AdminManagementScreen() {
  const navigation = useNavigation<AdminManagementScreenNavigationProp>();
  const { palette, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(palette, isDark), [palette, isDark]);

  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [operationLoading, setOperationLoading] = useState<string | null>(null);

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
    setOperationLoading(userId);
    try {
      await approveUser(userId);
      Alert.alert('Success', 'User has been approved.');
      fetchUsers();
    } catch (error) {
      Alert.alert('Error', 'Could not approve user.');
      console.error(error);
    } finally {
      setOperationLoading(null);
    }
  };

  const handleDisapprove = async (userId: string) => {
    setOperationLoading(userId);
    try {
      await disapproveUser(userId);
      Alert.alert('Success', 'User has been disapproved.');
      fetchUsers();
    } catch (error) {
      Alert.alert('Error', 'Could not disapprove user.');
      console.error(error);
    } finally {
      setOperationLoading(null);
    }
  };

  const handleDelete = async (userId: string) => {
    Alert.alert('Remove User', 'This will permanently delete the user and their data. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setOperationLoading(userId);
          try {
            await deleteUserDoc(userId);
            Alert.alert('Deleted', 'User document deleted.');
            fetchUsers();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete user');
            console.error(e);
          } finally {
            setOperationLoading(null);
          }
        },
      },
    ]);
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'member') => {
    Alert.alert(
      'Confirm Role Change',
      `Are you sure you want to make this user ${newRole}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes',
          onPress: async () => {
            setOperationLoading(userId);
            try {
              await setUserRole(userId, newRole);
              Alert.alert('Success', `User role changed to ${newRole}.`);
              fetchUsers();
            } catch (error) {
              Alert.alert('Error', 'Failed to change role.');
              console.error(error);
            } finally {
              setOperationLoading(null);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={palette.brandPrimary} />
      </SafeAreaView>
    );
  }

  const filteredUsers = users.filter((u) => (u.email || '').toLowerCase().includes(debouncedQuery));

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

  const renderListHeader = () => (
    <View>
      <View style={styles.headerRow}>
        <TouchableOpacity
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={24} color={palette.textPrimary} />
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
          placeholderTextColor={palette.textMuted}
          selectionColor={palette.brandPrimary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <Text style={styles.hintText}>Search by email to filter users</Text>
      </View>
      <View style={styles.adminCardsContainer}>
        <TouchableOpacity
          style={styles.adminCard}
          onPress={() => navigation.navigate('AdminNotificationManagement')}
          activeOpacity={0.7}
        >
          <View style={styles.adminCardContent}>
            <View style={styles.adminIconContainer}>
              <Ionicons name="notifications" size={24} color={palette.brandPrimary} />
            </View>
            <View style={styles.adminTextContainer}>
              <Text style={styles.adminCardTitle}>Manage Notifications</Text>
              <Text style={styles.adminCardSubtitle}>Send and manage push notifications</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={palette.textMuted} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.adminCard, styles.obstacleCard]}
          onPress={() => navigation.navigate('AdminObstacleManagement')}
          activeOpacity={0.7}
        >
          <View style={styles.adminCardContent}>
            <View style={[styles.adminIconContainer, styles.obstacleIconContainer]}>
              <MaterialCommunityIcons name="traffic-cone" size={24} color={palette.danger} />
            </View>
            <View style={styles.adminTextContainer}>
              <Text style={styles.adminCardTitle}>Manage Obstacles</Text>
              <Text style={styles.adminCardSubtitle}>Add, edit, or remove map obstacles</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={palette.textMuted} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.adminCard}
          onPress={() => navigation.navigate('AdminSosManagement')}
          activeOpacity={0.7}
        >
          <View style={styles.adminCardContent}>
            <View style={[styles.adminIconContainer, styles.sosIconContainer]}>
              <Ionicons name="alert-circle" size={24} color={palette.danger} />
            </View>
            <View style={styles.adminTextContainer}>
              <Text style={styles.adminCardTitle}>Manage SOS Alerts</Text>
              <Text style={styles.adminCardSubtitle}>View active alerts and cancel if needed</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={palette.textMuted} />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={filteredUsers}
        ListHeaderComponent={renderListHeader}
        renderItem={({ item }) => {
          const status = item.status ?? 'pending';
          const role = item.role ?? 'member';
          const isApproved = status === 'approved';
          const isDenied = status === 'disapproved';
          return (
            <View style={styles.userItem}>
              <View style={{ marginBottom: 10 }}>
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
                    (isApproved || operationLoading === item.uid) && styles.buttonDisabled,
                  ]}
                  disabled={isApproved || operationLoading === item.uid}
                  onPress={() => handleApprove(item.uid)}
                >
                  {operationLoading === item.uid ? (
                    <ActivityIndicator size="small" color={palette.onPrimary} />
                  ) : (
                    <Text style={styles.buttonText}>Approve</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.disapproveButton,
                    (isDenied || operationLoading === item.uid) && styles.buttonDisabled,
                  ]}
                  disabled={isDenied || operationLoading === item.uid}
                  onPress={() => handleDisapprove(item.uid)}
                >
                  {operationLoading === item.uid ? (
                    <ActivityIndicator size="small" color={palette.onPrimary} />
                  ) : (
                    <Text style={styles.buttonText}>Block</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.roleButton]}
                  onPress={() => handleRoleChange(item.uid, role === 'admin' ? 'member' : 'admin')}
                  disabled={operationLoading === item.uid}
                >
                  {operationLoading === item.uid ? (
                    <ActivityIndicator size="small" color={palette.onPrimary} />
                  ) : (
                    <Text style={styles.buttonText}>{role === 'admin' ? 'Make Member' : 'Make Admin'}</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.deleteButton]}
                  onPress={() => handleDelete(item.uid)}
                  disabled={operationLoading === item.uid}
                >
                  {operationLoading === item.uid ? (
                    <ActivityIndicator size="small" color={palette.onPrimary} />
                  ) : (
                    <Text style={styles.buttonText}>Delete</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        keyExtractor={(item) => item.uid}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        ListEmptyComponent={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
            <Text style={{ color: palette.textSecondary }}>No users to manage right now.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const createStyles = (palette: AppPalette, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.background,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: palette.textPrimary,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 50,
      paddingBottom: 16,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: palette.card,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: palette.shadowStrong,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    userItem: {
      backgroundColor: palette.card,
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      flexDirection: 'column',
      alignItems: 'stretch',
      shadowColor: palette.shadowStrong,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    userEmail: {
      fontSize: 16,
      color: palette.textPrimary,
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
      backgroundColor: palette.success,
    },
    disapproveButton: {
      backgroundColor: palette.danger,
    },
    roleButton: {
      backgroundColor: palette.brandPrimary,
    },
    deleteButton: {
      backgroundColor: palette.textSecondary,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      color: palette.onPrimary,
      fontWeight: 'bold',
    },
    promoteRow: {
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    input: {
      flex: 1,
      backgroundColor: palette.surfaceVariant,
      borderColor: palette.divider,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: palette.textPrimary,
    },
    highlight: {
      backgroundColor: palette.brandSoft,
      color: palette.brandPrimary,
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
      color: palette.onPrimary,
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    chipApproved: {
      backgroundColor: palette.success,
    },
    chipDisapproved: {
      backgroundColor: palette.danger,
    },
    chipPending: {
      backgroundColor: palette.caution,
    },
    chipRoleAdmin: {
      backgroundColor: palette.brandPrimary,
    },
    chipRoleMember: {
      backgroundColor: palette.textSecondary,
    },
    adminCardsContainer: {
      paddingHorizontal: 16,
      marginBottom: 20,
    },
    adminCard: {
      backgroundColor: palette.card,
      borderRadius: 12,
      marginBottom: 12,
      shadowColor: palette.shadowStrong,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 3.84,
      elevation: 5,
    },
    adminCardContent: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
    },
    adminIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: palette.chipNeutral,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    obstacleIconContainer: {
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.18)' : '#FEF2F2',
    },
    sosIconContainer: {
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.18)' : '#FEE2E2',
    },
    adminTextContainer: {
      flex: 1,
    },
    adminCardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: palette.textPrimary,
      marginBottom: 4,
    },
    adminCardSubtitle: {
      fontSize: 14,
      color: palette.textSecondary,
      lineHeight: 20,
    },
    hintText: {
      fontSize: 12,
      color: palette.textSecondary,
      marginTop: 4,
      textAlign: 'left',
    },
    obstacleCard: {
      borderWidth: 1,
      borderColor: palette.divider,
    },
  });
