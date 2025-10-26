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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Feather } from '@expo/vector-icons';
import { createAdminNotification, getNotificationsForRole, subscribeToNotifications } from '../../services/FirebaseNotificationService';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { Notification, NotificationType, NotificationAudience } from '../../types/Notification';
import { NotificationList } from '../../components/Notifications';

// Check if running in Expo Go (demo mode)
const IS_EXPO_DEMO = true; // Set to false when building production app

export default function AdminNotificationManagement() {
  const navigation = useNavigation();
  const { profile } = useCurrentUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  
  // Form state
  const [notificationType, setNotificationType] = useState<NotificationType>('event');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<NotificationAudience>('users');
  const [showForm, setShowForm] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);

  // Guard: only admins may access this screen
  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      Alert.alert('Access denied', 'You do not have permission to view this screen.', [
        { text: 'OK', onPress: () => (navigation as any).goBack() },
      ]);
    }
    if (profile === null) {
      // Not authenticated or profile not loaded: navigate back
      // Avoid double alerts; just go back silently
      (navigation as any).goBack();
    }
  }, [profile, navigation]);

  useEffect(() => {
    loadNotifications();
    
    // Subscribe to real-time updates
    const unsubscribe = subscribeToNotifications('admin', (newNotifications) => {
      setNotifications(newNotifications);
    });

    return () => unsubscribe();
  }, []);

  const loadNotifications = async () => {
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

  const handleSendNotification = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Validation Error', 'Please fill in both title and body.');
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
      await createAdminNotification(
        profile.uid,
        notificationType,
        title.trim(),
        body.trim(),
        audience
      );

      Alert.alert('Success', 'Notification sent successfully!');
      
      // Reset form
      setTitle('');
      setBody('');
      setShowForm(false);
      
      // Reload notifications
      await loadNotifications();
    } catch (error) {
      console.error('Error sending notification:', error);
      Alert.alert('Error', 'Could not send notification. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const getTypeIcon = (type: NotificationType) => {
    switch (type) {
      case 'event': return 'calendar';
      case 'update': return 'information-circle';
      case 'alert': return 'warning';
      default: return 'notifications';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
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
          <Text style={styles.title}>Notifications</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowForm(!showForm)}
          style={styles.addButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={showForm ? 'close' : 'add'} size={24} color="#2563eb" />
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
            <Text style={styles.formTitle}>Send New Notification</Text>
            
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
              placeholder="Enter notification title"
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />

            {/* Body Input */}
            <Text style={styles.label}>Message</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter notification message"
              value={body}
              onChangeText={setBody}
              multiline
              numberOfLines={4}
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{body.length}/500</Text>

            {/* Send Button */}
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
                  <Ionicons name="send" size={20} color="#FFFFFF" />
                  <Text style={styles.sendButtonText}>Send Notification</Text>
                </>
              )}
            </TouchableOpacity>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FE',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  backButton: {
    width: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  addButton: {
    width: 32,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
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
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
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