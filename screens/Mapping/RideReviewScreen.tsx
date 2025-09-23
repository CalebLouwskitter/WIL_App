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
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';

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

  // Wildlife categories with updated styling
  const WILDLIFE = [
    { id: 'w_deer', label: 'Deer', emoji: '🦌', color: '#F0E6D8' },
    { id: 'w_bird', label: 'Bird', emoji: '🦅', color: '#E8F4F8' },
    { id: 'w_rabbit', label: 'Rabbit', emoji: '🐰', color: '#FFF0F5' },
    { id: 'w_fox', label: 'Fox', emoji: '🦊', color: '#FFE8E0' },
    { id: 'w_squirrel', label: 'Squirrel', emoji: '🐿️', color: '#F5E6FF' },
    { id: 'w_boar', label: 'Wild Boar', emoji: '🐗', color: '#FFE6E6' },
    { id: 'w_badger', label: 'Badger', emoji: '🦡', color: '#E6F0E6' },
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const mapRef = useRef<MapView | null>(null);
  const { rideData, rideId } = route.params ?? {};
  const currentUser = auth().currentUser;

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

  // Get initial location and track updates
  useEffect(() => {
    let watchId: number | null = null;

    const requestLocationPermission = async () => {
      if (Platform.OS === 'android') {
        try {
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
      navigator.geolocation.getCurrentPosition(
        (position: GeolocationPosition) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setCurrentLocation(coords);
          setReportLocation(coords);
        },
        (error: GeolocationError) => {
          console.log('Error getting location:', error.message);
          // Set default location if error
          const defaultCoords = {
            latitude: rideData?.path?.[rideData.path.length - 1]?.latitude ?? 51.5074,
            longitude: rideData?.path?.[rideData.path.length - 1]?.longitude ?? -0.1278,
          };
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
          setCurrentLocation(coords);

          // Update map region to follow user
          if (mapRef.current && activeTab === 'report') {
            mapRef.current.animateToRegion({
              latitude: coords.latitude,
              longitude: coords.longitude,
              latitudeDelta: 0.008,
              longitudeDelta: 0.008,
            }, 1000);
          }
        },
        (error: GeolocationError) => {
          console.log('Error watching location:', error.message);
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
    const hasChanges = !!(selectedWildlife || sightingNotes || sightingPhoto || selectedIssue || reportNotes || reportLocation);
    setHasUnsavedChanges(hasChanges);
  }, [selectedWildlife, sightingNotes, sightingPhoto, selectedIssue, reportNotes, reportLocation]);

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
    // Simple photo placeholder since we don't have react-native-image-picker
    // You'll need to implement this with your actual image picker library
    Alert.alert(
      'Add Photo',
      'Photo functionality requires react-native-image-picker to be installed.',
      [
        {
          text: 'Use Placeholder',
          onPress: () => {
            // Set a placeholder image for demonstration
            setSightingPhoto('https://via.placeholder.com/300x200?text=Wildlife+Photo');
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleChoosePhoto = async () => {
    // Same as above - placeholder implementation
    handleTakePhoto();
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

  const uploadPhotoToFirebase = async (photoUri: string): Promise<string | null> => {
    try {
      if (!photoUri || photoUri.startsWith('http')) {
        // If it's already a URL or placeholder, return as is
        return photoUri;
      }

      const filename = `sightings/${currentUser?.uid}/${Date.now()}_photo.jpg`;
      const reference = storage().ref(filename);
      
      // Upload file
      await reference.putFile(photoUri);
      
      // Get download URL
      const downloadUrl = await reference.getDownloadURL();
      return downloadUrl;
    } catch (error) {
      console.error('Error uploading photo:', error);
      return null;
    }
  };

  const saveToFirebase = async (payload: any) => {
    try {
      setIsSubmitting(true);
      const batch = firestore().batch();
      const timestamp = firestore.FieldValue.serverTimestamp();

      // Save wildlife sighting if exists
      if (payload.sighting) {
        let photoUrl = null;
        if (payload.sighting.photo_uri) {
          photoUrl = await uploadPhotoToFirebase(payload.sighting.photo_uri);
        }

        const sightingRef = firestore()
          .collection('wildlife_sightings')
          .doc();
        
        batch.set(sightingRef, {
          ...payload.sighting,
          photo_url: photoUrl,
          photo_uri: undefined, // Remove local URI
          user_id: currentUser?.uid,
          user_email: currentUser?.email,
          created_at: timestamp,
          ride_id: rideId || `ride_${Date.now()}`,
        });
      }

      // Save trail report if exists
      if (payload.report) {
        const reportRef = firestore()
          .collection('trail_reports')
          .doc();
        
        batch.set(reportRef, {
          ...payload.report,
          user_id: currentUser?.uid,
          user_email: currentUser?.email,
          created_at: timestamp,
          status: 'pending', // For admin review
          ride_id: rideId || `ride_${Date.now()}`,
        });
      }

      // Update ride document if rideId exists
      if (rideId) {
        const rideRef = firestore()
          .collection('rides')
          .doc(rideId);
        
        batch.update(rideRef, {
          has_sighting: !!payload.sighting,
          has_report: !!payload.report,
          updated_at: timestamp,
        });
      }

      // Commit all changes
      await batch.commit();

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

  const submitAll = async () => {
    const nowISO = new Date().toISOString();
    const payload: any = {};

    if (selectedWildlife || sightingNotes || sightingPhoto) {
      payload.sighting = {
        wildlife_type: selectedWildlife ? WILDLIFE.find((w) => w.id === selectedWildlife)?.label : undefined,
        notes: sightingNotes,
        photo_uri: sightingPhoto,
        sighting_time: nowISO,
        location: currentLocation, // Include current location with sighting
      };
    }

    if (selectedIssue || reportNotes || reportLocation) {
      payload.report = {
        location: reportLocation ?? null,
        issue_type: selectedIssue ? TRAIL_ISSUES.find((i) => i.id === selectedIssue)?.label : undefined,
        date: nowISO.slice(0, 10),
        time: nowISO,
        notes: reportNotes,
        severity: selectedIssue === 'i_hazard' ? 'high' : 'medium', // Add severity based on type
      };
    }

    if (!payload.sighting && !payload.report) {
      onClose?.();
      return;
    }

    // Save to Firebase
    const success = await saveToFirebase(payload);
    
    if (success) {
      // Call the original onSubmit if provided
      onSubmit?.(payload);
      
      // Success feedback
      Alert.alert(
        '✓ Successfully Saved',
        'Your observations have been uploaded and saved to the database.',
        [{ text: 'Done', onPress: () => onClose?.() }]
      );

      // Reset form
      setSelectedWildlife(null);
      setSightingNotes('');
      setSightingPhoto(null);
      setSelectedIssue(null);
      setReportNotes('');
      setReportLocation(currentLocation); // Reset to current location instead of null
      setHasUnsavedChanges(false);
    }
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      Alert.alert(
        'Save Your Observations?',
        'You have unsaved changes. What would you like to do?',
        [
          { text: 'Continue Editing', style: 'cancel' },
          { text: 'Discard & Close', style: 'destructive', onPress: () => onClose?.() },
          { text: 'Save & Close', onPress: () => submitAll() },
        ]
      );
    } else {
      onClose?.();
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
            <Text style={styles.headerTitle}>Ride Review</Text>
            <Text style={styles.headerSubtitle}>Record your observations</Text>
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
          {/* Enhanced Stats Card */}
          <View style={styles.statsCard}>
            <View style={styles.statsHeader}>
              <Text style={styles.statsTitle}>Today's Performance</Text>
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
                  {stats.elevation.toFixed(0)}
                  <Text style={styles.statUnit}> m</Text>
                </Text>
                <Text style={styles.statLabel}>Elevation</Text>
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
                ⚠️ Trail Reports
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
              <Text style={styles.sectionTitle}>Report Trail Conditions</Text>
              <Text style={styles.sectionDescription}>
                Keep trails safe for all riders
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
                  placeholder="Provide details about the issue..."
                  placeholderTextColor={BRAND_COLORS.text.light}
                  style={styles.textInput}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.mapContainer}>
                <Text style={styles.mapLabel}>📍 Mark Location on Map</Text>
                <View style={styles.mapWrapper}>
                  <MapView
                    ref={mapRef}
                    provider={PROVIDER_GOOGLE}
                    style={styles.map}
                    showsUserLocation={true}
                    showsMyLocationButton={true}
                    followsUserLocation={true}
                    initialRegion={{
                      latitude: currentLocation?.latitude ?? (rideData?.path?.[rideData.path.length - 1]?.latitude ?? 51.5074),
                      longitude: currentLocation?.longitude ?? (rideData?.path?.[rideData.path.length - 1]?.longitude ?? -0.1278),
                      latitudeDelta: 0.008,
                      longitudeDelta: 0.008,
                    }}
                    onPress={onMapPress}
                  >
                    {/* Show the ride path if available */}
                    {rideData?.path && rideData.path.length > 0 && (
                      <Polyline
                        coordinates={rideData.path}
                        strokeColor="rgba(44, 85, 48, 0.7)"
                        strokeWidth={3}
                      />
                    )}
                    
                    {/* Show issue marker */}
                    {reportLocation && (
                      <Marker 
                        coordinate={reportLocation}
                        title="Issue Location"
                        pinColor="#C73E1D"
                      >
                        <View style={styles.customMarker}>
                          <Text style={styles.markerEmoji}>⚠️</Text>
                        </View>
                      </Marker>
                    )}
                    
                    {/* Show current location if different from report location */}
                    {currentLocation && (!reportLocation || 
                      (Math.abs(currentLocation.latitude - reportLocation.latitude) > 0.0001 ||
                       Math.abs(currentLocation.longitude - reportLocation.longitude) > 0.0001)) && (
                      <Marker
                        coordinate={currentLocation}
                        title="Current Location"
                        opacity={0.7}
                      >
                        <View style={styles.currentLocationMarker}>
                          <View style={styles.currentLocationDot} />
                        </View>
                      </Marker>
                    )}
                  </MapView>
                  <View style={styles.mapOverlay}>
                    <Text style={styles.mapHint}>
                      {reportLocation ? '📍 Issue marked - Tap map to move' : 'Tap the map to mark issue location'}
                    </Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.currentLocationButton}
                    onPress={() => {
                      if (currentLocation) {
                        setReportLocation(currentLocation);
                        mapRef.current?.animateToRegion({
                          latitude: currentLocation.latitude,
                          longitude: currentLocation.longitude,
                          latitudeDelta: 0.008,
                          longitudeDelta: 0.008,
                        }, 1000);
                      }
                    }}
                  >
                    <Text style={styles.currentLocationButtonText}>📍 Use Current Location</Text>
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
                {isSubmitting ? 'Saving...' : 'Save Observations'}
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

  // Map styles
  mapContainer: {
    marginTop: 20,
  },
  mapLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  mapWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    height: 250,
    position: 'relative',
  },
  map: {
    flex: 1,
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
  mapHint: {
    fontSize: 12,
    color: '#8A8A8A',
    fontWeight: '500',
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
  currentLocationButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  currentLocationButtonText: {
    fontSize: 12,
    fontWeight: '600',
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