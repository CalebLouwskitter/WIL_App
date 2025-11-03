import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  Alert,
  Modal,
  useColorScheme
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { downloadAndShareGlobalAnalytics } from '../services/AnalyticsDownloadService';
import { resolvePalette } from '../constants/colors';

interface AnalyticsDownloadButtonProps {
  onDownloadStart?: () => void;
  onDownloadComplete?: () => void;
  onDownloadError?: (error: Error) => void;
}

export const AnalyticsDownloadButton: React.FC<AnalyticsDownloadButtonProps> = ({
  onDownloadStart,
  onDownloadComplete,
  onDownloadError,
}) => {
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const colorScheme = useColorScheme();
  const theme = resolvePalette(colorScheme);

  const handleDownload = async (format: 'json' | 'csv' | 'excel') => {
    try {
      setLoading(true);
      setModalVisible(false);
      onDownloadStart?.();

      await downloadAndShareGlobalAnalytics(format);

      Alert.alert(
        'Success',
        `Analytics data exported as ${format.toUpperCase()} and ready to share!`,
        [{ text: 'OK' }]
      );

      onDownloadComplete?.();
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert(
        'Export Failed',
        'Failed to export analytics data. Please try again.',
        [{ text: 'OK' }]
      );
      onDownloadError?.(error as Error);
    } finally {
      setLoading(false);
    }
  };

  const showDownloadOptions = () => {
    setModalVisible(true);
  };

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={showDownloadOptions}
        disabled={loading}
        style={styles.buttonContainer}
      >
        <LinearGradient
          colors={[theme.brandPrimary, theme.brandPrimaryAlt]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.button}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Feather name="download" size={20} color="#FFFFFF" />
              <Text style={styles.buttonText}>Export Analytics</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View 
            style={[styles.modalContent, { backgroundColor: theme.surface }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeader}>
              <Feather name="download-cloud" size={32} color={theme.brandPrimary} />
              <Text style={[styles.modalTitle, { color: theme.onSurface }]}>
                Export Analytics
              </Text>
              <Text style={[styles.modalSubtitle, { color: theme.onSurfaceVariant }]}>
                Choose your preferred format
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.formatOption, { backgroundColor: theme.surfaceVariant }]}
              onPress={() => handleDownload('excel')}
              activeOpacity={0.7}
            >
              <View style={styles.formatIconContainer}>
                <Feather name="file-text" size={24} color="#10B981" />
              </View>
              <View style={styles.formatInfo}>
                <Text style={[styles.formatTitle, { color: theme.onSurface }]}>Excel Format</Text>
                <Text style={[styles.formatDescription, { color: theme.onSurfaceVariant }]}>
                  Multiple sheets with detailed analytics
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color={theme.onSurfaceVariant} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.formatOption, { backgroundColor: theme.surfaceVariant }]}
              onPress={() => handleDownload('json')}
              activeOpacity={0.7}
            >
              <View style={styles.formatIconContainer}>
                <Feather name="code" size={24} color={theme.brandPrimary} />
              </View>
              <View style={styles.formatInfo}>
                <Text style={[styles.formatTitle, { color: theme.onSurface }]}>JSON Format</Text>
                <Text style={[styles.formatDescription, { color: theme.onSurfaceVariant }]}>
                  Complete data with full ride details
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color={theme.onSurfaceVariant} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.formatOption, { backgroundColor: theme.surfaceVariant }]}
              onPress={() => handleDownload('csv')}
              activeOpacity={0.7}
            >
              <View style={styles.formatIconContainer}>
                <Feather name="database" size={24} color={theme.brandSecondary} />
              </View>
              <View style={styles.formatInfo}>
                <Text style={[styles.formatTitle, { color: theme.onSurface }]}>CSV Format</Text>
                <Text style={[styles.formatDescription, { color: theme.onSurfaceVariant }]}>
                  Spreadsheet-friendly summary data
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color={theme.onSurfaceVariant} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: theme.borderMuted }]}
              onPress={() => setModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelButtonText, { color: theme.onSurfaceVariant }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  buttonContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  formatOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    gap: 12,
  },
  formatIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatInfo: {
    flex: 1,
    gap: 4,
  },
  formatTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  formatDescription: {
    fontSize: 13,
    fontWeight: '500',
  },
  cancelButton: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AnalyticsDownloadButton;