import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
  Modal,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Feather } from '@expo/vector-icons';
import { createAdminNotification, getNotificationsForRole, subscribeToNotifications, deleteNotification, updateNotification, getNotificationById, getAllNotifications, getNotificationStats } from '../../services/FirebaseNotificationService';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { Notification, NotificationType, NotificationAudience } from '../../types/Notification';
import { NotificationList } from '../../components/Notifications';
import type { ProfileStackParamList } from '../../navigation/ProfileStack';

// Check if running in Expo Go (demo mode)
const IS_EXPO_DEMO = false; // Set to false once you've configured Firebase Cloud Messaging credentials

type AdminNotificationNavigationProp = StackNavigationProp<ProfileStackParamList, 'AdminNotificationManagement'>;

const AdminNotificationManagement: React.FC = () => {
  const navigation = useNavigation<AdminNotificationNavigationProp>();
  const { profile, loading: profileLoading } = useCurrentUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  
  // Form state
  const [notificationType, setNotificationType] = useState<NotificationType>('event');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<NotificationAudience>('users');
  const [showForm, setShowForm] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [editingNotification, setEditingNotification] = useState<Notification | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [notificationStats, setNotificationStats] = useState<any>(null);

  // Guard: only admins may access this screen
  useEffect(() => {
    // Wait for profile to finish loading
    if (!profileLoading) {
      if (profile === null) {
        // Not authenticated: navigate back
        Alert.alert('Access denied', 'You must be logged in to view this screen.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else if (profile.role !== 'admin') {
        // Authenticated but not admin: navigate back
        Alert.alert('Access denied', 'You do not have permission to view this screen.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    }
  }, [profile, profileLoading, navigation]);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    
    const initializeData = async () => {
      try {
        await loadNotifications();
        await loadStats();
        
        // Subscribe to real-time updates only after initial data is loaded
        unsubscribe = subscribeToNotifications('admin', (newNotifications) => {
          setNotifications(newNotifications);
        });
      } catch (error) {
        console.error('Error initializing admin notification data:', error);
      }
    };
    
    initializeData();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const loadStats = async () => {
    try {
      const stats = await getNotificationStats();
      setNotificationStats(stats);
    } catch (error) {
      console.error('Error loading notification stats:', error);
    }
  };

  const loadNotifications = async () => {
    if (loading) return; // Prevent multiple simultaneous loads
    
    setLoading(true);
    try {
      const notifs = await getNotificationsForRole('admin');
      setNotifications(notifs);
    } catch (error) {
      console.error('Error loading notifications:', error);
      Alert.alert('Error', 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditNotification = (notification: Notification) => {
    setEditingNotification(notification);
    setNotificationType(notification.type);
    setTitle(notification.title);
    setBody(notification.body);
    setAudience(notification.audience);
    setShowForm(true);
  };

  const handleUpdateNotification = async () => {
    if (!editingNotification || !profile?.uid) {
      Alert.alert('Error', 'Missing required information.');
      return;
    }

    // Enhanced validation
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Please enter a notification title.');
      return;
    }

    if (title.trim().length < 3) {
      Alert.alert('Validation Error', 'Title must be at least 3 characters long.');
      return;
    }

    if (title.trim().length > 100) {
      Alert.alert('Validation Error', 'Title must be less than 100 characters.');
      return;
    }

    if (!body.trim()) {
      Alert.alert('Validation Error', 'Please enter a notification message.');
      return;
    }

    if (body.trim().length < 10) {
      Alert.alert('Validation Error', 'Message must be at least 10 characters long.');
      return;
    }

    if (body.trim().length > 500) {
      Alert.alert('Validation Error', 'Message must be less than 500 characters.');
      return;
    }

    setSending(true);
    try {
      await updateNotification(editingNotification.id, {
        type: notificationType,
        title: title.trim(),
        body: body.trim(),
        audience,
      });

      Alert.alert('Success', 'Notification updated successfully!');
      
      // Reset form
      resetForm();
      
      // Reload notifications and stats
      await loadNotifications();
      await loadStats();
    } catch (error) {
      console.error('Error updating notification:', error);
      Alert.alert('Error', 'Could not update notification. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteNotification = async (notification: Notification) => {
    try {
      await deleteNotification(notification.id);
      Alert.alert('Success', 'Notification deleted successfully');
      await loadNotifications();
      await loadStats();
    } catch (error) {
      console.error('Error deleting notification:', error);
      Alert.alert('Error', 'Failed to delete notification');
    }
  };

  const resetForm = () => {
    setTitle('');
    setBody('');
    setNotificationType('event');
    setAudience('users');
    setEditingNotification(null);
    setShowForm(false);
  };

  const handleSendNotification = async () => {
    // Enhanced validation
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Please enter a notification title.');
      return;
    }

    if (title.trim().length < 3) {
      Alert.alert('Validation Error', 'Title must be at least 3 characters long.');
      return;
    }

    if (title.trim().length > 100) {
      Alert.alert('Validation Error', 'Title must be less than 100 characters.');
      return;
    }

    if (!body.trim()) {
      Alert.alert('Validation Error', 'Please enter a notification message.');
      return;
    }

    if (body.trim().length < 10) {
      Alert.alert('Validation Error', 'Message must be at least 10 characters long.');
      return;
    }

    if (body.trim().length > 500) {
      Alert.alert('Validation Error', 'Message must be less than 500 characters.');
      return;
    }

    // Show demo modal if in Expo demo mode
    if (IS_EXPO_DEMO) {
      setShowDemoModal(true);
      return;
    }

    if (!profile?.uid) {
      Alert.alert('Error', 'User not authenticated.');
      return;
    }

    setSending(true);
    try {
      if (editingNotification) {
        await handleUpdateNotification();
      } else {
        await createAdminNotification(
          profile.uid,
          notificationType,
          title.trim(),
          body.trim(),
          audience
        );
        Alert.alert('Success', 'Notification sent successfully!');
      }
      
      // Reset form
      resetForm();
      
      // Reload notifications and stats
      await loadNotifications();
      await loadStats();
    } catch (error) {
      console.error('Error sending notification:', error);
      Alert.alert('Error', 'Could not send notification. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const getTypeIcon = (type: NotificationType): string => {
    switch (type) {
      case 'event': return 'calendar';
      case 'update': return 'information-circle';
      case 'alert': return 'warning';
      case 'user_signup': return 'person-add';
      default: return 'notifications';
    }
  };

  // Show loading while profile is being fetched
  if (profileLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            accessibilityLabel="Go back"
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          >
            <View style={styles.iconButton}>
              <Ionicons name="chevron-back" size={24} color="#111" />
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.title}>Notifications</Text>
          </View>
          <View style={{ width: 48 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={{ marginTop: 16, color: '#6B7280' }}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        >
          <View style={styles.iconButton}>
            <Ionicons name="chevron-back" size={24} color="#111" />
          </View>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title}>Notifications</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowForm(!showForm)}
          style={styles.addButton}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        >
          <View style={[styles.iconButton, styles.addButtonBackground]}>
            <Ionicons name={showForm ? 'close' : 'add'} size={24} color="#2563eb" />
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowStats(!showStats)}
          style={styles.statsButton}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        >
          <View style={[styles.iconButton, styles.statsButtonBackground]}>
            <Ionicons name="bar-chart" size={24} color="#10B981" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Demo Mode Banner */}
      {IS_EXPO_DEMO && (
        <TouchableOpacity 
          style={styles.demoBanner}
          onPress={() => setShowDemoModal(true)}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#FEF3C7', '#FDE68A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.demoBannerGradient}
          >
            <Feather name="info" size={20} color="#92400E" />
            <Text style={styles.demoBannerText}>
              Demo Mode: Push notifications disabled in Expo Go
            </Text>
            <Feather name="chevron-right" size={18} color="#92400E" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Create Notification Form */}
        {showForm && (
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>
              {editingNotification ? 'Edit Notification' : 'Send New Notification'}
            </Text>
            
            {/* Notification Type Selection */}
            <Text style={styles.label}>Type</Text>
            <View style={styles.typeSelector}>
              {(['event', 'update', 'alert'] as NotificationType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeButton,
                    notificationType === type && styles.typeButtonActive,
                  ]}
                  onPress={() => setNotificationType(type)}
                >
                  <Ionicons
                    name={getTypeIcon(type) as any}
                    size={20}
                    color={notificationType === type ? '#FFFFFF' : '#6B7280'}
                  />
                  <Text
                    style={[
                      styles.typeButtonText,
                      notificationType === type && styles.typeButtonTextActive,
                    ]}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Audience Selection */}
            <Text style={styles.label}>Audience</Text>
            <View style={styles.audienceSelector}>
              {(['users', 'admins', 'all'] as NotificationAudience[]).map((aud) => (
                <TouchableOpacity
                  key={aud}
                  style={[
                    styles.audienceButton,
                    audience === aud && styles.audienceButtonActive,
                  ]}
                  onPress={() => setAudience(aud)}
                >
                  <Text
                    style={[
                      styles.audienceButtonText,
                      audience === aud && styles.audienceButtonTextActive,
                    ]}
                  >
                    {aud.charAt(0).toUpperCase() + aud.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Title Input */}
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="Notification Title"
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
            <Text style={styles.characterCount}>
              {title.length}/100 characters
            </Text>

            {/* Body Input */}
            <Text style={styles.label}>Message</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Notification Message"
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={500}
            />
            <Text style={styles.characterCount}>
              {body.length}/500 characters
            </Text>

            {/* Action Buttons */}
            <View style={styles.formActions}>
              {editingNotification && (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={resetForm}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!title.trim() || !body.trim() || sending) && styles.sendButtonDisabled,
                ]}
                onPress={handleSendNotification}
                disabled={!title.trim() || !body.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name={editingNotification ? 'checkmark' : 'send'} size={20} color="#FFFFFF" />
                    <Text style={styles.sendButtonText}>
                      {editingNotification ? 'Update' : 'Send'} Notification
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Statistics Panel */}
        {showStats && notificationStats && (
          <View style={styles.statsContainer}>
            <Text style={styles.statsTitle}>Notification Statistics</Text>
            
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{notificationStats.total}</Text>
                <Text style={styles.statLabel}>Total Notifications</Text>
              </View>
              
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{notifications.length}</Text>
                <Text style={styles.statLabel}>Recent</Text>
              </View>
            </View>

            <Text style={styles.statsSubtitle}>By Type</Text>
            <View style={styles.typeStats}>
              {Object.entries(notificationStats.byType).map(([type, count]) => (
                <View key={type} style={styles.typeStatItem}>
                  <Ionicons name={getTypeIcon(type as NotificationType) as any} size={16} color="#6B7280" />
                  <Text style={styles.typeStatText}>{String(type)}: {String(count)}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.statsSubtitle}>By Audience</Text>
            <View style={styles.audienceStats}>
              {Object.entries(notificationStats.byAudience).map(([audience, count]) => (
                <View key={audience} style={styles.audienceStatItem}>
                  <Text style={styles.audienceStatText}>{String(audience)}: {String(count)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Notification History */}
        <View style={styles.historyContainer}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Recent Notifications</Text>
            <TouchableOpacity onPress={loadNotifications}>
              <Ionicons name="refresh" size={20} color="#2563eb" />
            </TouchableOpacity>
          </View>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
          ) : (
            <NotificationList
              notifications={notifications}
              loading={loading}
              isAdmin={true}
              onDeleteNotification={handleDeleteNotification}
              onEditNotification={handleEditNotification}
            />
          )}
        </View>
      </ScrollView>

      {/* Demo Mode Information Modal */}
      <Modal
        visible={showDemoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDemoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <LinearGradient
              colors={['#3B82F6', '#2563EB', '#1E40AF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalGradientHeader}
            >
              <View style={styles.modalIconContainer}>
                <Feather name="info" size={48} color="#fff" />
              </View>
            </LinearGradient>

            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Demo Mode Active</Text>
              <Text style={styles.modalSubtitle}>Push Notifications Disabled</Text>
              
              <View style={styles.modalInfoBox}>
                <View style={styles.modalInfoRow}>
                  <Feather name="smartphone" size={20} color="#3B82F6" />
                  <Text style={styles.modalInfoText}>
                    You're running the app in <Text style={styles.modalBoldText}>Expo Go</Text> demo mode
                  </Text>
                </View>
                
                <View style={styles.modalInfoRow}>
                  <Feather name="alert-circle" size={20} color="#F59E0B" />
                  <Text style={styles.modalInfoText}>
                    Push notifications require a <Text style={styles.modalBoldText}>production build</Text>
                  </Text>
                </View>
                
                <View style={styles.modalInfoRow}>
                  <Feather name="package" size={20} color="#10B981" />
                  <Text style={styles.modalInfoText}>
                    This feature will be fully functional in the built application
                  </Text>
                </View>
              </View>

              <View style={styles.modalFeatureBox}>
                <Text style={styles.modalFeatureTitle}>Production Features:</Text>
                <View style={styles.modalFeatureList}>
                  <View style={styles.modalFeatureItem}>
                    <Feather name="check-circle" size={16} color="#10B981" />
                    <Text style={styles.modalFeatureText}>Real-time push notifications to all users</Text>
                  </View>
                  <View style={styles.modalFeatureItem}>
                    <Feather name="check-circle" size={16} color="#10B981" />
                    <Text style={styles.modalFeatureText}>Targeted audience selection</Text>
                  </View>
                  <View style={styles.modalFeatureItem}>
                    <Feather name="check-circle" size={16} color="#10B981" />
                    <Text style={styles.modalFeatureText}>Notification analytics & tracking</Text>
                  </View>
                  <View style={styles.modalFeatureItem}>
                    <Feather name="check-circle" size={16} color="#10B981" />
                    <Text style={styles.modalFeatureText}>Firebase Cloud Messaging integration</Text>
                  </View>
                </View>
              </View>

              <View style={styles.modalNote}>
                <Feather name="code" size={16} color="#6B7280" />
                <Text style={styles.modalNoteText}>
                  Set <Text style={styles.modalCodeText}>IS_EXPO_DEMO = false</Text> in production builds
                </Text>
              </View>

              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowDemoModal(false)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#3B82F6', '#2563EB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modalButtonGradient}
                >
                  <Text style={styles.modalButtonText}>Got it!</Text>
                  <Feather name="check" size={20} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default AdminNotificationManagement;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FE',
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
    alignItems: 'flex-start',
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48,
  },
  addButton: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48,
  },
  statsButton: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48,
    marginRight: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonBackground: {
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  statsButtonBackground: {
    backgroundColor: '#F0FDF4',
    borderWidth: 2,
    borderColor: '#10B981',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  content: {
    flex: 1,
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#111827',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    gap: 6,
  },
  typeButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  typeButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
  },
  audienceSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  audienceButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  audienceButtonActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  audienceButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  audienceButtonTextActive: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  characterCount: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
    marginBottom: 8,
  },
  textArea: {
    minHeight: 100,
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
  },
  sendButton: {
    flexDirection: 'row',
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
  statsContainer: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#111827',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2563eb',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  statsSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  typeStats: {
    marginBottom: 16,
  },
  typeStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  typeStatText: {
    fontSize: 13,
    color: '#6B7280',
  },
  audienceStats: {
    marginBottom: 16,
  },
  audienceStatItem: {
    marginBottom: 4,
  },
  audienceStatText: {
    fontSize: 13,
    color: '#6B7280',
  },
  historyContainer: {
    margin: 16,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  
  // Demo Banner Styles
  demoBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  demoBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  demoBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
  
  // Demo Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 24,
    width: '100%',
    maxWidth: 500,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  modalGradientHeader: {
    padding: 32,
    alignItems: 'center',
  },
  modalIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    padding: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: '500',
  },
  modalInfoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 14,
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalInfoText: {
    flex: 1,
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  modalBoldText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  modalFeatureBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  modalFeatureTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#065F46',
    marginBottom: 12,
  },
  modalFeatureList: {
    gap: 10,
  },
  modalFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalFeatureText: {
    flex: 1,
    fontSize: 13,
    color: '#047857',
    lineHeight: 18,
  },
  modalNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  modalNoteText: {
    flex: 1,
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
  },
  modalCodeText: {
    fontFamily: 'monospace',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 11,
    color: '#1E293B',
  },
  modalButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  modalButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});