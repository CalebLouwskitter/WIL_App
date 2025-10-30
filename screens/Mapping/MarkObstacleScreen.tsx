import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { saveObstacle } from '../../services/ObstacleService';
import { createAdminNotification } from '../../services/FirebaseNotificationService';
import { auth as firebaseAuth } from '../../services/firebase';
import type { ObstacleType, ObstacleSeverity } from '../../services/Data';
import { Colors } from '@/constants/colors';

type Props = {
  navigation: any;
  route?: {
    params?: {
      location?: { latitude: number; longitude: number };
    };
  };
};

const MarkObstacleScreen: React.FC<Props> = ({ navigation, route }) => {
  const [selectedType, setSelectedType] = useState<ObstacleType>('pothole');
  const [selectedSeverity, setSelectedSeverity] = useState<ObstacleSeverity>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(
    route?.params?.location || null
  );
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];
  const styles = useMemo(() => createStyles(palette), [palette]);

  const obstacleTypes: { type: ObstacleType; label: string; icon: string }[] = [
    { type: 'pothole', label: 'Pothole', icon: 'alert-triangle' },
    { type: 'debris', label: 'Debris', icon: 'trash-2' },
    { type: 'animal', label: 'Animal', icon: 'alert-triangle' },
    { type: 'tree', label: 'Fallen Tree', icon: 'feather' },
    { type: 'water', label: 'Water Hazard', icon: 'droplet' },
    { type: 'other', label: 'Other', icon: 'alert-circle' },
  ];

  const severityLevels: { severity: ObstacleSeverity; label: string; color: string }[] = [
    { severity: 'low', label: 'Low', color: palette.obstacleLow },
    { severity: 'medium', label: 'Medium', color: palette.obstacleMedium },
    { severity: 'high', label: 'High', color: palette.obstacleHigh },
    { severity: 'critical', label: 'Critical', color: palette.obstacleCritical },
  ];

  const getCurrentLocation = async () => {
    setGettingLocation(true);
    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        if (!permission.canAskAgain) {
          Alert.alert('Permission Denied', 'Location permission is required to mark obstacles.');
          return;
        }
        permission = await Location.requestForegroundPermissionsAsync();
      }

      if (permission.status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to mark obstacles.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to get current location.');
      console.error(error);
    } finally {
      setGettingLocation(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Please provide a title for the obstacle.');
      return;
    }

    if (!location) {
      Alert.alert('Location Required', 'Please set a location for the obstacle.');
      return;
    }

    setLoading(true);
    try {
      const savedObstacle = await saveObstacle({
        type: selectedType,
        severity: selectedSeverity,
        status: 'active',
        title: title.trim(),
        description: description.trim() || undefined,
        location,
      });

      // Send FCM notification to admins about new trail obstacle
      try {
        const userId = firebaseAuth?.currentUser?.uid;
        if (userId) {
          await createAdminNotification(
            userId,
            'alert',
            `New Trail Obstacle: ${title.trim()}`,
            `A new ${selectedSeverity} severity obstacle (${selectedType}) has been reported on the trail${savedObstacle.userName ? ` by ${savedObstacle.userName}` : ''}. ${description.trim() ? `Notes: ${description.trim()}` : ''}`,
            'admins',
            {
              obstacleId: savedObstacle.id,
              type: selectedType,
              severity: selectedSeverity,
              location: location,
              reportedBy: savedObstacle.userName || 'Anonymous'
            }
          );
          console.log('[MarkObstacleScreen] FCM notification sent to admins');
        }
      } catch (notificationError) {
        console.warn('[MarkObstacleScreen] Failed to send FCM notification:', notificationError);
        // Non-fatal error - obstacle was still saved
      }

      Alert.alert('Success', 'Obstacle reported successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to report obstacle. Please try again.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[palette.gradientPrimaryStart, palette.gradientPrimaryEnd]}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report Obstacle</Text>
      </LinearGradient>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Obstacle Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Obstacle Type</Text>
          <View style={styles.typeGrid}>
            {obstacleTypes.map((item) => (
              <TouchableOpacity
                key={item.type}
                style={[
                  styles.typeCard,
                  selectedType === item.type && styles.typeCardSelected,
                ]}
                onPress={() => setSelectedType(item.type)}
              >
                <Feather
                  name={item.icon as any}
                  size={28}
                  color={selectedType === item.type ? palette.obstaclePrimary : palette.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.typeLabel,
                    selectedType === item.type && styles.typeLabelSelected,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Severity Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Severity Level</Text>
          <View style={styles.severityRow}>
            {severityLevels.map((item) => (
              <TouchableOpacity
                key={item.severity}
                style={[
                  styles.severityButton,
                  { borderColor: item.color },
                  selectedSeverity === item.severity && { backgroundColor: item.color },
                ]}
                onPress={() => setSelectedSeverity(item.severity)}
              >
                <Text
                  style={[
                    styles.severityText,
                    { color: selectedSeverity === item.severity ? 'white' : item.color },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Title Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Large pothole on trail"
            placeholderTextColor="#9CA3AF"
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
        </View>

        {/* Description Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Provide additional details about the obstacle..."
            placeholderTextColor="#9CA3AF"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            maxLength={500}
          />
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          {location ? (
            <View style={styles.locationBox}>
              <Feather name="map-pin" size={20} color={palette.obstacleLow} />
              <Text style={styles.locationText}>
                {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.locationButton}
              onPress={getCurrentLocation}
              disabled={gettingLocation}
            >
              {gettingLocation ? (
                <ActivityIndicator color={palette.brandPrimary} />
              ) : (
                <>
                  <Feather name="map-pin" size={20} color={palette.brandPrimary} />
                  <Text style={styles.locationButtonText}>Get Current Location</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Feather name="check-circle" size={24} color="white" />
              <Text style={styles.submitButtonText}>Submit Report</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const createStyles = (palette: typeof Colors.light) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.brandMuted,
    },
    header: {
      paddingTop: 50,
      paddingBottom: 20,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
    },
    backButton: {
      marginRight: 16,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: palette.onPrimary,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: 20,
      gap: 8,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: palette.onSurface,
      marginBottom: 12,
    },
    typeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    typeCard: {
      width: '30%',
      aspectRatio: 1,
      backgroundColor: palette.cardElevated,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: palette.borderMuted,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
      shadowColor: palette.shadow,
      shadowOpacity: 0.12,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 4,
      elevation: 3,
    },
    typeCardSelected: {
      borderColor: palette.obstaclePrimary,
      backgroundColor: palette.cardMuted,
    },
    typeLabel: {
      fontSize: 12,
      color: palette.onSurfaceVariant,
      marginTop: 8,
      textAlign: 'center',
      fontWeight: '500',
    },
    typeLabelSelected: {
      color: palette.obstaclePrimary,
      fontWeight: '600',
    },
    severityRow: {
      flexDirection: 'row',
      gap: 8,
    },
    severityButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 2,
      alignItems: 'center',
      backgroundColor: palette.cardElevated,
    },
    severityText: {
      fontSize: 14,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    input: {
      backgroundColor: palette.cardElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.borderMuted,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: palette.onSurface,
    },
    textArea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    locationBox: {
      backgroundColor: palette.cardElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.borderMuted,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    locationText: {
      fontSize: 14,
      color: palette.onSurface,
      fontFamily: 'monospace',
    },
    locationButton: {
      backgroundColor: palette.cardElevated,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: palette.brandPrimary,
      borderStyle: 'dashed',
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    locationButtonText: {
      fontSize: 16,
      color: palette.brandPrimary,
      fontWeight: '600',
    },
    submitButton: {
      backgroundColor: palette.brandPrimary,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 12,
      marginBottom: 32,
      shadowColor: palette.shadowStrong,
      shadowOpacity: 0.2,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 6,
      elevation: 6,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: palette.onPrimary,
    },
  });

export default MarkObstacleScreen;
