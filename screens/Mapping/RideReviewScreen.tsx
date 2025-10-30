// RideReviewScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  Dimensions,
  Platform,
  Animated,
  KeyboardAvoidingView,
  Image,
  PermissionsAndroid,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import RideStatsCard from '@/components/RideStatsCard';
import type { RideData } from '@/hooks/useRideTracker';
import { StackScreenProps } from '@react-navigation/stack';
import type { MappingStackParamList } from '@/navigation/MappingStack';
import { collection, doc, writeBatch, serverTimestamp, updateDoc, setDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app, auth as firebaseAuth, firestore as db } from '@/services/firebase';
import { getStorage } from 'firebase/storage';
import {
  newSighting,
  newObstacle,
  newReport,
  createSighting,
  createObstacle,
  createReport,
  type SightingDTO,
  type ObstacleDTO,
  type ReportDTO,
  type ObstacleType,
  type ObstacleSeverity,
  type ReportType,
  type ReportSeverity,
  type UUID,
} from '@/services/Data';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { saveObservation } from '@/services/ObservationStorage';
import { trailData } from '@/constants/trails';

// Type definitions for geolocation
interface GeolocationPosition {
  coords: {
    latitude: number;
    longitude: number;
    altitude: number | null;
    accuracy: number;
    altitudeAccuracy: number | null;
    heading: number | null;
    speed: number | null;
  };
  timestamp: number;
}

interface GeolocationError {
  code: number;
  message: string;
  PERMISSION_DENIED: number;
  POSITION_UNAVAILABLE: number;
  TIMEOUT: number;
}

const { width: screenWidth } = Dimensions.get('window');

// Simple UUID generator
const generateUUID = (): UUID => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

type Props = StackScreenProps<MappingStackParamList, 'RideReviewScreen'> & {
  onSubmit?: (payload: any) => void;
  onClose?: () => void;
};

export default function RideReviewScreen({ route, navigation, onSubmit, onClose }: Props) {
  // Professional color scheme for equestrian app
  const BRAND_COLORS = {
    primary: '#2C5530', // Deep forest green
    secondary: '#8B7355', // Saddle brown
    accent: '#D4AF37', // Gold
    danger: '#C73E1D',
    background: '#FAF9F7',
    cardBg: '#FFFFFF',
    text: {
      primary: '#1A1A1A',
      secondary: '#5A5A5A',
      light: '#8A8A8A',
    },
    border: '#E5E5E5',
    success: '#4CAF50',
  };

  // Wildlife categories - Sardinia Bay, Port Elizabeth fauna
  const WILDLIFE = [
    { id: 'w_bushbuck', label: 'Bushbuck', emoji: '🦌', color: '#F0E6D8' },
    { id: 'w_duiker', label: 'Duiker', emoji: '🦌', color: '#FFF0F5' },
    { id: 'w_vervet', label: 'Vervet Monkey', emoji: '🐒', color: '#FFE8D8' },
    { id: 'w_tortoise', label: 'Tortoise', emoji: '🐢', color: '#F5E6FF' },
    { id: 'w_mongoose', label: 'Mongoose', emoji: '🦦', color: '#FFE8E0' },
    { id: 'w_porcupine', label: 'Porcupine', emoji: '🦔', color: '#E6F0E6' },
    { id: 'w_snake', label: 'Snake', emoji: '🐍', color: '#FFF8E6' },
    { id: 'w_dolphin', label: 'Dolphin', emoji: '🐬', color: '#E8F4F8' },
    { id: 'w_seabird', label: 'Seabird', emoji: '🦅', color: '#E6F5FF' },
    { id: 'w_hare', label: 'Cape Hare', emoji: '🐰', color: '#FFF0F0' },
    { id: 'w_other', label: 'Other', emoji: '🐾', color: '#F0F0F0' },
  ];

  const QUICK_NOTES = [
    { text: 'crossing trail', icon: '→' },
    { text: 'near water', icon: '💧' },
    { text: 'in distance', icon: '👁' },
    { text: 'multiple', icon: '🔢' },
    { text: 'spooked horse', icon: '⚠️' },
  ];

  const TRAIL_ISSUES = [
    { id: 'i_damage', label: 'Trail Damage', emoji: '🚧', color: '#FFE6E6' },
    { id: 'i_obstruction', label: 'Obstruction', emoji: '🪵', color: '#FFE8E0' },
    { id: 'i_flooding', label: 'Water/Mud', emoji: '💧', color: '#E6F0FF' },
    { id: 'i_erosion', label: 'Erosion', emoji: '⛰️', color: '#F0E6D8' },
    { id: 'i_gate', label: 'Gate Issue', emoji: '🚪', color: '#FFE6F0' },
    { id: 'i_signage', label: 'Signage', emoji: '📍', color: '#FFF0E6' },
    { id: 'i_hazard', label: 'Hazard', emoji: '⚠️', color: '#FFEBE6' },
    { id: 'i_other', label: 'Other', emoji: '📝', color: '#F0F0F0' },
  ];

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // State management
  const [activeTab, setActiveTab] = useState<'sighting' | 'report'>('sighting');
  const [selectedWildlife, setSelectedWildlife] = useState<string | null>(null);
  const [sightingNotes, setSightingNotes] = useState('');
  const [sightingPhoto, setSightingPhoto] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [reportNotes, setReportNotes] = useState('');
  const [reportLocation, setReportLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedTrailId, setSelectedTrailId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const mapRef = useRef<MapView | null>(null);
  const { rideData, rideId } = route.params ?? {};
  const currentUser = firebaseAuth?.currentUser;

  const stats = useMemo(() => {
    if (!rideData) return { distance: 0, elevation: 0, duration: 0 };
    return {
      distance: rideData.totalDistance ?? 0,
      elevation: rideData.elevationGain ?? 0,
      duration: rideData.duration ?? 0,
    };
  }, [rideData]);

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Snap map to user location when switching to report tab
  useEffect(() => {
    if (activeTab === 'report' && currentLocation && mapRef.current) {
      setTimeout(() => {
        mapRef.current?.animateToRegion({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }, 1000);
      }, 300);
    }
  }, [activeTab]);

  // Get initial location and track updates
  useEffect(() => {
    let watchId: number | null = null;

    const requestLocationPermission = async () => {
      if (Platform.OS === 'android') {
        try {
          const alreadyGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
          if (alreadyGranted) {
            return true;
          }
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Location Permission',
              message: 'This app needs access to your location to track your ride and mark issues on the map.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          );
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        } catch (err) {
          console.warn(err);
          return false;
        }
      }
      return true;
    };

    const startLocationTracking = async () => {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) return;

      // Get initial location using navigator.geolocation (built-in)
      console.log('[Location] Requesting current position...');
      navigator.geolocation.getCurrentPosition(
        (position: GeolocationPosition) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          console.log('[Location] Got current position:', coords);
          setCurrentLocation(coords);
          setReportLocation(coords);
        },
        (error: GeolocationError) => {
          console.log('[Location] Error getting location:', error.message, error.code);
          // Set default location if error - use ride end point if available
          const defaultCoords = {
            latitude: rideData?.path?.[rideData.path.length - 1]?.latitude ?? -34.0254,
            longitude: rideData?.path?.[rideData.path.length - 1]?.longitude ?? 25.5002,
          };
          console.log('[Location] Using fallback location:', defaultCoords);
          setCurrentLocation(defaultCoords);
          setReportLocation(defaultCoords);
        },
        { 
          enableHighAccuracy: true, 
          timeout: 20000, 
          maximumAge: 1000 
        }
      );

      // Watch position for updates
      watchId = navigator.geolocation.watchPosition(
        (position: GeolocationPosition) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          console.log('[Location] Position updated:', coords);
          setCurrentLocation(coords);
          // Map will auto-follow user location via showsUserLocation prop
        },
        (error: GeolocationError) => {
          console.log('[Location] Error watching location:', error.message, error.code);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 2000,
        }
      );
    };

    startLocationTracking();

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [activeTab, rideData]);

  // Track unsaved changes
  useEffect(() => {
    const hasChanges = !!(selectedWildlife || sightingNotes || sightingPhoto || selectedIssue || reportNotes || reportLocation || selectedTrailId);
    setHasUnsavedChanges(hasChanges);
  }, [selectedWildlife, sightingNotes, sightingPhoto, selectedIssue, reportNotes, reportLocation, selectedTrailId]);

  // Handle back navigation with unsaved changes
  useEffect(() => {
    const beforeRemove = (e: any) => {
      if (!hasUnsavedChanges) return;
      e.preventDefault();
      Alert.alert(
        'Save Your Observations?',
        'You have unsaved wildlife sightings or trail reports. Would you like to save them before leaving?',
        [
          { text: 'Continue Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              navigation.dispatch(e.data.action);
            },
          },
          {
            text: 'Save & Exit',
            style: 'default',
            onPress: () => {
              submitAll();
              navigation.dispatch(e.data.action);
            },
          },
        ]
      );
    };

    const unsubscribe = navigation.addListener('beforeRemove', beforeRemove);
    return unsubscribe;
  }, [hasUnsavedChanges, navigation]);

  const onMapPress = (e: any) => {
    const { coordinate } = e.nativeEvent;
    setReportLocation(coordinate);
  };

  const addQuickNote = (text: string) => {
    setSightingNotes((prev) => {
      const separator = prev ? ', ' : '';
      return prev + separator + text;
    });
  };

  const handleTakePhoto = async () => {
    try {
      setIsLoadingPhoto(true);
      
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Camera access is needed to take photos of wildlife.',
          [{ text: 'OK' }]
        );
        setIsLoadingPhoto(false);
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSightingPhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    } finally {
      setIsLoadingPhoto(false);
    }
  };

  const handleChoosePhoto = async () => {
    try {
      setIsLoadingPhoto(true);
      
      // Request media library permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Photo library access is needed to choose photos.',
          [{ text: 'OK' }]
        );
        setIsLoadingPhoto(false);
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSightingPhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error choosing photo:', error);
      Alert.alert('Error', 'Failed to choose photo. Please try again.');
    } finally {
      setIsLoadingPhoto(false);
    }
  };

  const handlePhotoPress = () => {
    Alert.alert(
      'Add Photo',
      'Choose how you want to add a photo',
      [
        { text: 'Take Photo', onPress: handleTakePhoto },
        { text: 'Choose from Library', onPress: handleChoosePhoto },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const removePhoto = () => {
    Alert.alert(
      'Remove Photo?',
      'Are you sure you want to remove this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => setSightingPhoto(null) },
      ]
    );
  };

  const savePhotoLocally = async (photoUri: string): Promise<string | null> => {
    try {
      if (!photoUri || photoUri.startsWith('http')) {
        // If it's already a URL or placeholder, return as is
        return photoUri;
      }

      // Save photo locally instead of uploading to Firebase
      const filename = `sighting_${currentUser?.uid || 'user'}_${Date.now()}.jpg`;
      const baseDir = ((FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || '') as string;
      const localPath = baseDir + filename;
      
      // Copy the photo to app's document directory using writeAsStringAsync for base64 or copyAsync if available
      // For demo purposes, we'll just keep the original URI since we're storing locally
      console.log('Photo path stored locally:', photoUri);
      return photoUri; // Return the original URI for local storage
    } catch (error) {
      console.error('Error saving photo locally:', error);
      return null;
    }
  };

  const saveToFirebase = async (payload: any) => {
    try {
      setIsSubmitting(true);
      if (!currentUser?.uid) {
        console.warn('User not authenticated');
        Alert.alert('Authentication Error', 'You must be logged in to save observations.');
        return false;
      }

      // Save wildlife sighting if exists
      if (payload.sighting) {
        let photoUrl: string | undefined = undefined;
        if (payload.sighting.photo_uri) {
          const localPhotoPath = await savePhotoLocally(payload.sighting.photo_uri);
          if (localPhotoPath) photoUrl = localPhotoPath;
        }

        // Create proper SightingDTO
        const sighting: SightingDTO = newSighting({
          id: generateUUID(),
          animalName: payload.sighting.wildlife_type || 'Unknown',
          location: {
            latitude: payload.sighting.location?.latitude || currentLocation?.latitude || 0,
            longitude: payload.sighting.location?.longitude || currentLocation?.longitude || 0,
          },
          description: payload.sighting.notes,
          photoUrl,
          timestamp: payload.sighting.sighting_time,
          userId: currentUser.uid,
        });

        await createSighting(currentUser.uid, sighting);
      }

      // Save trail report/obstacle if exists
      if (payload.report) {
        // Determine if this is an obstacle or a report based on issue type
        const issueTypeLabel = payload.report.issue_type || 'other';
        const isObstacle = ['obstruction', 'hazard'].some(keyword => 
          issueTypeLabel.toLowerCase().includes(keyword)
        );

        if (isObstacle) {
          // Create ObstacleDTO
          const obstacle: ObstacleDTO = newObstacle({
            id: generateUUID(),
            type: mapIssueToObstacleType(issueTypeLabel),
            title: issueTypeLabel,
            location: {
              latitude: payload.report.location?.latitude || currentLocation?.latitude || 0,
              longitude: payload.report.location?.longitude || currentLocation?.longitude || 0,
            },
            description: payload.report.notes,
            severity: mapSeverityToObstacle(payload.report.severity),
            userId: currentUser.uid,
            userName: currentUser.displayName || currentUser.email || 'Anonymous',
          });

          await createObstacle(obstacle);
        } else {
          // Create ReportDTO
          const report: ReportDTO = newReport({
            id: generateUUID(),
            type: mapIssueToReportType(issueTypeLabel),
            title: issueTypeLabel,
            description: payload.report.notes,
            severity: mapSeverityToReport(payload.report.severity),
            userId: currentUser.uid,
            location: payload.report.location ? {
              latitude: payload.report.location.latitude,
              longitude: payload.report.location.longitude,
            } : undefined,
            rideId: rideId,
          });

          await createReport(report);
        }
      }

      // Update ride document if rideId exists
      if (rideId && db) {
        try {
          const rideRef = doc(db, 'rides', rideId);
          await updateDoc(rideRef, {
            has_sighting: !!payload.sighting,
            has_report: !!payload.report,
            updated_at: serverTimestamp(),
          });
        } catch (error) {
          console.log('Could not update ride document (may not exist yet):', error);
        }
      }

      return true;
    } catch (error) {
      console.error('Error saving to Firebase:', error);
      Alert.alert(
        'Save Error',
        'Failed to save your observations. Please try again.',
        [{ text: 'OK' }]
      );
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to map issue type to ObstacleType
  const mapIssueToObstacleType = (issueLabel: string): ObstacleType => {
    const lower = issueLabel.toLowerCase();
    if (lower.includes('water') || lower.includes('mud')) return 'water';
    if (lower.includes('obstruction') || lower.includes('damage')) return 'debris';
    if (lower.includes('tree')) return 'tree';
    if (lower.includes('hazard')) return 'other';
    return 'other';
  };

  // Helper function to map issue type to ReportType
  const mapIssueToReportType = (issueLabel: string): ReportType => {
    const lower = issueLabel.toLowerCase();
    if (lower.includes('damage')) return 'trail_damage';
    if (lower.includes('hazard') || lower.includes('safety')) return 'safety_hazard';
    if (lower.includes('gate') || lower.includes('signage')) return 'maintenance_needed';
    if (lower.includes('erosion')) return 'maintenance_needed';
    return 'other';
  };

  // Helper function to map severity string to ObstacleSeverity
  const mapSeverityToObstacle = (severity?: string): ObstacleSeverity => {
    if (!severity) return 'medium';
    const lower = severity.toLowerCase();
    if (lower === 'critical') return 'critical';
    if (lower === 'high') return 'high';
    if (lower === 'low') return 'low';
    return 'medium';
  };

  // Helper function to map severity string to ReportSeverity
  const mapSeverityToReport = (severity?: string): ReportSeverity => {
    if (!severity) return 'medium';
    const lower = severity.toLowerCase();
    if (lower === 'critical') return 'critical';
    if (lower === 'high') return 'high';
    if (lower === 'low') return 'low';
    return 'medium';
  };

  const submitAll = async () => {
    try {
      setIsSubmitting(true);

      // Check if there's anything to save
      if (!selectedWildlife && !selectedIssue && !sightingNotes && !reportNotes && !selectedTrailId) {
        if (onClose) {
          onClose();
        } else {
          navigation.goBack();
        }
        return;
      }

      // Build observation object
      const observation: any = {
        rideId: rideId,
      };

      // Add sighting data if exists
      if (selectedWildlife || sightingNotes || sightingPhoto) {
        observation.sighting = {
          wildlifeType: selectedWildlife ? WILDLIFE.find((w) => w.id === selectedWildlife)?.label || 'Unknown' : 'Unknown',
          notes: sightingNotes || '',
          photoUri: sightingPhoto || undefined,
          location: currentLocation || undefined,
        };
      }

      // Add report data if exists
      if (selectedIssue || reportNotes || reportLocation || selectedTrailId) {
        const chosenTrail = selectedTrailId ? trailData.find((trail) => trail.id === selectedTrailId) : undefined;
        observation.report = {
          issueType: selectedIssue ? TRAIL_ISSUES.find((i) => i.id === selectedIssue)?.label || 'Other' : 'Other',
          notes: reportNotes || '',
          severity: (selectedIssue === 'i_hazard' ? 'high' : 'medium') as 'low' | 'medium' | 'high' | 'critical',
          location: reportLocation || currentLocation || undefined,
          trailId: selectedTrailId || undefined,
          trailName: chosenTrail?.name,
        };
      }

      // Save observation using the new storage service
      await saveObservation(observation);
      
      // Call the original onSubmit if provided (for backward compatibility)
      onSubmit?.(observation);
      
      // Success feedback
      Alert.alert(
        '✓ Report Submitted',
        'Your trail report has been saved and will help other riders stay informed.',
        [{ text: 'Done', onPress: () => onClose ? onClose() : navigation.goBack() }]
      );

      // Reset form
      setSelectedWildlife(null);
      setSightingNotes('');
      setSightingPhoto(null);
      setSelectedIssue(null);
      setReportNotes('');
      setReportLocation(currentLocation);
      setSelectedTrailId(null);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error saving observations:', error);
      Alert.alert(
        'Save Error',
        'Failed to save your observations. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      Alert.alert(
        'Save Your Observations?',
        'You have unsaved changes. What would you like to do?',
        [
          { text: 'Continue Editing', style: 'cancel' },
          { text: 'Discard & Close', style: 'destructive', onPress: () => onClose ? onClose() : navigation.goBack() },
          { text: 'Save & Close', onPress: () => submitAll() },
        ]
      );
    } else {
      if (onClose) {
        onClose();
      } else {
        navigation.goBack();
      }
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Animated.View 
        style={[
          styles.innerContainer,
          {
            opacity: fadeAnim,
            transform: [
              { translateY: slideAnim },
              { scale: scaleAnim }
            ]
          }
        ]}
      >
        {/* Professional Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Trail Report & Sightings</Text>
            <Text style={styles.headerSubtitle}>Report trail conditions and wildlife</Text>
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Optional: Ride stats for context - only show if ride data exists */}
          {rideData && (
            <View style={styles.statsCard}>
              <View style={styles.statsHeader}>
                <Text style={styles.statsTitle}>Ride Summary</Text>
                <View style={styles.successBadge}>
                  <Text style={styles.successBadgeText}>Completed</Text>
                </View>
              </View>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {(stats.distance / 1000).toFixed(1)}
                    <Text style={styles.statUnit}> km</Text>
                  </Text>
                  <Text style={styles.statLabel}>Distance</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {Math.floor(stats.duration / 60000)}
                    <Text style={styles.statUnit}> min</Text>
                  </Text>
                  <Text style={styles.statLabel}>Duration</Text>
                </View>
              </View>
            </View>
          )}

          {/* Tab Selector */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'sighting' && styles.activeTab]}
              onPress={() => setActiveTab('sighting')}
            >
              <Text style={[styles.tabText, activeTab === 'sighting' && styles.activeTabText]}>
                🦌 Wildlife Sightings
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'report' && styles.activeTab]}
              onPress={() => setActiveTab('report')}
            >
              <Text style={[styles.tabText, activeTab === 'report' && styles.activeTabText]}>
                🚧 Trail Conditions
              </Text>
            </TouchableOpacity>
          </View>

          {/* Wildlife Sightings Section */}
          {activeTab === 'sighting' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>What did you see?</Text>
              <Text style={styles.sectionDescription}>
                Help other riders by logging wildlife encounters
              </Text>

              <View style={styles.wildlifeGrid}>
                {WILDLIFE.map((animal) => {
                  const isSelected = animal.id === selectedWildlife;
                  return (
                    <TouchableOpacity
                      key={animal.id}
                      onPress={() => setSelectedWildlife(isSelected ? null : animal.id)}
                      style={[
                        styles.wildlifeCard,
                        { backgroundColor: animal.color },
                        isSelected && styles.wildlifeCardSelected,
                      ]}
                    >
                      <Text style={styles.wildlifeEmoji}>{animal.emoji}</Text>
                      <Text style={[styles.wildlifeLabel, isSelected && styles.wildlifeLabelSelected]}>
                        {animal.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Additional Details</Text>
                <TextInput
                  value={sightingNotes}
                  onChangeText={setSightingNotes}
                  placeholder="Describe location, behavior, or other details..."
                  placeholderTextColor={BRAND_COLORS.text.light}
                  style={styles.textInput}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.quickNotesContainer}>
                <Text style={styles.quickNotesLabel}>Quick add:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.quickNotesRow}>
                    {QUICK_NOTES.map((note, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={() => addQuickNote(note.text)}
                        style={styles.quickNote}
                      >
                        <Text style={styles.quickNoteIcon}>{note.icon}</Text>
                        <Text style={styles.quickNoteText}>{note.text}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {sightingPhoto ? (
                <View style={styles.photoPreviewContainer}>
                  <Image source={{ uri: sightingPhoto }} style={styles.photoPreview} />
                  <TouchableOpacity style={styles.removePhotoButton} onPress={removePhoto}>
                    <Text style={styles.removePhotoText}>✕</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.retakePhotoButton} onPress={handlePhotoPress}>
                    <Text style={styles.retakePhotoText}>Retake Photo</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.photoButton} 
                  onPress={handlePhotoPress}
                  disabled={isLoadingPhoto}
                >
                  <Text style={styles.photoButtonIcon}>📷</Text>
                  <Text style={styles.photoButtonText}>
                    {isLoadingPhoto ? 'Loading...' : 'Add Photo'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Trail Reports Section */}
          {activeTab === 'report' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Report trail conditions</Text>
              <Text style={styles.sectionDescription}>
                Help maintain safe trails by reporting conditions and issues
              </Text>

              <View style={styles.issueGrid}>
                {TRAIL_ISSUES.map((issue) => {
                  const isSelected = issue.id === selectedIssue;
                  return (
                    <TouchableOpacity
                      key={issue.id}
                      onPress={() => setSelectedIssue(isSelected ? null : issue.id)}
                      style={[
                        styles.issueCard,
                        { backgroundColor: issue.color },
                        isSelected && styles.issueCardSelected,
                      ]}
                    >
                      <Text style={styles.issueEmoji}>{issue.emoji}</Text>
                      <Text style={[styles.issueLabel, isSelected && styles.issueLabelSelected]}>
                        {issue.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  value={reportNotes}
                  onChangeText={setReportNotes}
                  placeholder="Describe the issue..."
                  placeholderTextColor={BRAND_COLORS.text.light}
                  style={styles.textInput}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.trailSelectorContainer}>
                <Text style={styles.inputLabel}>Trail (optional)</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.trailChipsRow}
                >
                  {trailData.map((trail) => {
                    const isSelected = trail.id === selectedTrailId;
                    return (
                      <TouchableOpacity
                        key={trail.id}
                        onPress={() => setSelectedTrailId(isSelected ? null : trail.id)}
                        style={[styles.trailChip, isSelected && styles.trailChipSelected]}
                      >
                        <Text style={[styles.trailChipText, isSelected && styles.trailChipTextSelected]}>
                          {trail.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.mapContainer}>
                <Text style={styles.mapLabel}>📍 Mark Location on Map</Text>
                <Text style={styles.mapHint}>View trails, your ride path, and tap to mark the report location</Text>
                <View style={styles.mapWrapper}>
                  <MapView
                    ref={mapRef}
                    provider={PROVIDER_GOOGLE}
                    style={styles.map}
                    initialRegion={{
                      latitude: currentLocation?.latitude || rideData?.path?.[0]?.latitude || -34.0254,
                      longitude: currentLocation?.longitude || rideData?.path?.[0]?.longitude || 25.5002,
                      latitudeDelta: 0.02,
                      longitudeDelta: 0.02,
                    }}
                    onPress={onMapPress}
                    showsUserLocation={true}
                    showsMyLocationButton={false}
                    showsPointsOfInterest={false}
                    showsBuildings={false}
                    showsIndoors={false}
                    showsTraffic={false}
                    showsIndoorLevelPicker={false}
                    loadingEnabled={true}
                    loadingIndicatorColor="#2C5530"
                    loadingBackgroundColor="#FAF9F7"
                  >
                    {/* Display all trail routes */}
                    {trailData.map((trail) => (
                      <Polyline
                        key={trail.id}
                        coordinates={trail.routeWaypoints.map(wp => ({
                          latitude: wp.latitude,
                          longitude: wp.longitude,
                        }))}
                        strokeColor={trail.color || '#0080ff'}
                        strokeWidth={3}
                        lineJoin="round"
                        lineCap="round"
                        zIndex={1}
                      />
                    ))}
                    
                    {/* Show the completed ride path on top of trails */}
                    {rideData?.path && rideData.path.length > 1 && (
                      <Polyline
                        coordinates={rideData.path.map(p => ({
                          latitude: p.latitude,
                          longitude: p.longitude,
                        }))}
                        strokeColor="#2C5530"
                        strokeWidth={5}
                        lineJoin="round"
                        lineCap="round"
                        zIndex={2}
                      />
                    )}
                    
                    {/* Start marker */}
                    {rideData?.path && rideData.path.length > 0 && (
                      <Marker
                        coordinate={{
                          latitude: rideData.path[0].latitude,
                          longitude: rideData.path[0].longitude,
                        }}
                        title="Ride Start"
                      >
                        <View style={styles.startMarker}>
                          <Text style={styles.startMarkerText}>🏁</Text>
                        </View>
                      </Marker>
                    )}
                    
                    {/* End marker */}
                    {rideData?.path && rideData.path.length > 1 && (
                      <Marker
                        coordinate={{
                          latitude: rideData.path[rideData.path.length - 1].latitude,
                          longitude: rideData.path[rideData.path.length - 1].longitude,
                        }}
                        title="Ride End"
                      >
                        <View style={styles.endMarker}>
                          <Text style={styles.endMarkerText}>🏁</Text>
                        </View>
                      </Marker>
                    )}
                    
                    {/* User's selected report location */}
                    {reportLocation && (
                      <Marker
                        coordinate={{
                          latitude: reportLocation?.latitude || 0,
                          longitude: reportLocation?.longitude || 0,
                        }}
                        pinColor="#C73E1D"
                        title="Report Location"
                      >
                        <View style={styles.customMarker}>
                          <Text style={styles.markerEmoji}>📍</Text>
                        </View>
                      </Marker>
                    )}
                    
                    {/* Current location indicator */}
                    {currentLocation && (
                      <Marker
                        coordinate={{
                          latitude: currentLocation?.latitude || 0,
                          longitude: currentLocation?.longitude || 0,
                        }}
                        title="Current Location"
                      >
                        <View style={styles.currentLocationMarker}>
                          <View style={styles.currentLocationDot} />
                        </View>
                      </Marker>
                    )}
                  </MapView>
                  <TouchableOpacity 
                    style={styles.centerLocationButton}
                    onPress={() => {
                      console.log('Center button pressed');
                      console.log('currentLocation:', currentLocation);
                      console.log('reportLocation:', reportLocation);
                      console.log('rideData path length:', rideData?.path?.length);
                      
                      // Use current location, or fall back to last ride point, or report location
                      const targetLocation = currentLocation || 
                        (rideData?.path && rideData.path.length > 0 ? rideData.path[rideData.path.length - 1] : null) ||
                        reportLocation;
                      
                      if (targetLocation) {
                        console.log('Centering on:', targetLocation);
                        mapRef.current?.animateToRegion({
                          latitude: targetLocation.latitude,
                          longitude: targetLocation.longitude,
                          latitudeDelta: 0.015,
                          longitudeDelta: 0.015,
                        }, 800);
                      } else {
                        Alert.alert('Location Not Available', 'No location data available yet.');
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.centerLocationButtonText}>📍 Center</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!selectedWildlife && !selectedIssue) && styles.submitButtonDisabled,
                isSubmitting && styles.submitButtonLoading
              ]}
              onPress={submitAll}
              disabled={(!selectedWildlife && !selectedIssue) || isSubmitting}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Saving...' : 'Save Report'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.skipButton} 
              onPress={handleClose}
              disabled={isSubmitting}
            >
              <Text style={styles.skipButtonText}>Skip for Now</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
      </ScrollView>
    </Animated.View>
  </KeyboardAvoidingView>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F7',
  },
  innerContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  
  // Header styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2C5530',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#8A8A8A',
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#5A5A5A',
    fontWeight: '300',
  },

  // Stats Card
  statsCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  successBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  successBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2C5530',
  },
  statUnit: {
    fontSize: 14,
    fontWeight: '400',
    color: '#8A8A8A',
  },
  statLabel: {
    fontSize: 12,
    color: '#8A8A8A',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E5E5',
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8A8A8A',
  },
  activeTabText: {
    color: '#2C5530',
    fontWeight: '600',
  },

  // Section styles
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#8A8A8A',
    marginBottom: 20,
  },

  // Wildlife Grid
  wildlifeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  wildlifeCard: {
    width: (screenWidth - 40 - 48) / 4,
    aspectRatio: 1,
    margin: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  wildlifeCardSelected: {
    borderColor: '#2C5530',
    transform: [{ scale: 1.05 }],
    shadowColor: '#2C5530',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  wildlifeEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  wildlifeLabel: {
    fontSize: 11,
    textAlign: 'center',
    color: '#5A5A5A',
  },
  wildlifeLabelSelected: {
    fontWeight: '600',
    color: '#2C5530',
  },

  // Issue Grid (similar to wildlife)
  issueGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  issueCard: {
    width: (screenWidth - 40 - 48) / 4,
    aspectRatio: 1,
    margin: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  issueCardSelected: {
    borderColor: '#C73E1D',
    transform: [{ scale: 1.05 }],
    shadowColor: '#C73E1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  issueEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  issueLabel: {
    fontSize: 11,
    textAlign: 'center',
    color: '#5A5A5A',
  },
  issueLabelSelected: {
    fontWeight: '600',
    color: '#C73E1D',
  },

  // Input styles
  inputGroup: {
    marginTop: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#1A1A1A',
    backgroundColor: '#FAFAFA',
    minHeight: 80,
  },

  // Quick Notes
  quickNotesContainer: {
    marginTop: 16,
  },
  quickNotesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A8A8A',
    marginBottom: 8,
  },
  quickNotesRow: {
    flexDirection: 'row',
  },
  quickNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  quickNoteIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  quickNoteText: {
    fontSize: 13,
    color: '#5A5A5A',
  },

  // Photo styles
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  photoButtonIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5A5A5A',
  },
  photoPreviewContainer: {
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  retakePhotoButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retakePhotoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2C5530',
  },

  trailSelectorContainer: {
    marginTop: 20,
  },
  trailChipsRow: {
    paddingVertical: 8,
    gap: 8,
  },
  trailChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    borderWidth: 2,
    borderColor: '#E5E5E5',
  },
  trailChipSelected: {
    backgroundColor: '#E8F5E9',
    borderColor: '#2C5530',
  },
  trailChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5A5A5A',
  },
  trailChipTextSelected: {
    color: '#2C5530',
  },

  // Map styles
  mapContainer: {
    marginTop: 20,
  },
  mapLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  mapHint: {
    fontSize: 12,
    color: '#8A8A8A',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  mapWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    height: 250,
    position: 'relative',
  },
  map: {
    flex: 1,
    borderRadius: 12,
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 8,
    alignItems: 'center',
  },
  customMarker: {
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#C73E1D',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  markerEmoji: {
    fontSize: 20,
  },
  startMarker: {
    backgroundColor: '#4CAF50',
    padding: 6,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  startMarkerText: {
    fontSize: 16,
  },
  endMarker: {
    backgroundColor: '#2C5530',
    padding: 6,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  endMarkerText: {
    fontSize: 16,
  },
  currentLocationMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(44, 85, 48, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentLocationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2C5530',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  centerLocationButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1001,
  },
  centerLocationButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2C5530',
  },

  // Action Buttons
  actionContainer: {
    marginHorizontal: 20,
    marginTop: 24,
  },
  submitButton: {
    backgroundColor: '#2C5530',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#2C5530',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#B0B0B0',
    shadowOpacity: 0.1,
  },
  submitButtonLoading: {
    backgroundColor: '#1C3A1F',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  skipButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8A8A8A',
    textDecorationLine: 'underline',
  },
});