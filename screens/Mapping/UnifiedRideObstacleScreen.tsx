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
  Linking,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Callout } from 'react-native-maps';
import type { RideData } from '@/hooks/useRideTracker';
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
import { saveObstacle } from '../../services/ObstacleService';
import { createAdminNotification } from '../../services/FirebaseNotificationService';
import { trailData } from '@/constants/trails';
import { Feather } from '@expo/vector-icons';
import { fetchObstacles, subscribeToObstacles, type Obstacle, type ObstacleFeedStatus } from '../../services/ObstacleService';
import { useForegroundLocation } from '../../hooks/useForegroundLocation';
import { locationStatusMessage } from '../../utils/locationStatus';
import { MapWithStatus } from '../../components/MapStatusFrame';
import { describeObstacleFeed } from '../../utils/obstacleFeed';
import { usePreferences } from '../../contexts/PreferencesContext';
import { useAppTheme, type AppPalette } from '../../hooks/useAppTheme';

const { width: screenWidth } = Dimensions.get('window');

// Simple UUID generator
const generateUUID = (): UUID => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

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

// South African wildlife categories with updated styling
const WILDLIFE = [
  { id: 'w_buck', label: 'Buck', emoji: '🦌', color: '#F0E6D8' }, // Impala, Kudu, etc.
  { id: 'w_bird', label: 'Bird', emoji: '🦅', color: '#E8F4F8' }, // Various SA birds
  { id: 'w_dassie', label: 'Dassie', emoji: '🐹', color: '#FFF0F5' }, // Rock hyrax
  { id: 'w_meerkat', label: 'Meerkat', emoji: '🦫', color: '#FFE8E0' }, // Suricate
  { id: 'w_monkey', label: 'Monkey', emoji: '🐒', color: '#F5E6FF' }, // Vervet monkey
  { id: 'w_zebra', label: 'Zebra', emoji: '🦓', color: '#FFE6E6' }, // Plains zebra
  { id: 'w_warthog', label: 'Warthog', emoji: '🐗', color: '#E6F0E6' }, // Common warthog
  { id: 'w_giraffe', label: 'Giraffe', emoji: '🦒', color: '#FFF8DC' }, // Giraffe
  { id: 'w_baboon', label: 'Baboon', emoji: '🐵', color: '#F0E6D8' }, // Chacma baboon
  { id: 'w_other', label: 'Other', emoji: '🐾', color: '#F0F0F0' },
];

const QUICK_NOTES = [
  { text: 'crossing path', icon: '→' },
  { text: 'near waterhole', icon: '💧' },
  { text: 'in distance', icon: '👁' },
  { text: 'herd spotted', icon: '🔢' },
  { text: 'horse nervous', icon: '⚠️' },
  { text: 'grazing', icon: '🌿' },
  { text: 'resting', icon: '😴' },
  { text: 'with young', icon: '👶' },
];

const TRAIL_ISSUES = [
  { id: 'i_damage', label: 'Trail Erosion', emoji: '⛰️', color: '#FFFFFF' },
  { id: 'i_obstruction', label: 'Fallen Tree', emoji: '🪵', color: '#FFFFFF' },
  { id: 'i_flooding', label: 'Water Crossing', emoji: '💧', color: '#FFFFFF' },
  { id: 'i_mud', label: 'Muddy Section', emoji: '🟫', color: '#FFFFFF' },
  { id: 'i_gate', label: 'Gate Problem', emoji: '🚪', color: '#FFFFFF' },
  { id: 'i_fence', label: 'Fence Damage', emoji: '🚧', color: '#FFFFFF' },
  { id: 'i_animal', label: 'Animal on Path', emoji: '🐄', color: '#FFFFFF' },
  { id: 'i_other', label: 'Other Issue', emoji: '📝', color: '#FFFFFF' },
];

type Props = {
  route: any;
  navigation: any;
  onSubmit?: (payload: any) => void;
  onClose?: () => void;
  isDuringRide?: boolean; // New prop to distinguish during vs post ride
  rideData?: RideData;
  rideId?: string;
  initialTab?: 'sighting' | 'report' | 'obstacles'; // Initial tab to show
};

export default function UnifiedRideObstacleScreen({ 
  route, 
  navigation, 
  onSubmit, 
  onClose, 
  isDuringRide = false,
  rideData: propRideData,
  rideId: propRideId,
  initialTab = 'obstacles'
}: Props) {
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // Safe area insets
  const insets = useSafeAreaInsets();
  const { preferences } = usePreferences();
  const { palette, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  // State management
  const [activeTab, setActiveTab] = useState<'sighting' | 'report' | 'obstacles'>(
    route.params?.initialTab || initialTab || 'obstacles'
  );
  const [selectedWildlife, setSelectedWildlife] = useState<string | null>(null);
  const [sightingNotes, setSightingNotes] = useState('');
  const [sightingPhoto, setSightingPhoto] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [reportNotes, setReportNotes] = useState('');
  const [reportLocation, setReportLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedTrailId, setSelectedTrailId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [reportLocationSource, setReportLocationSource] = useState<'gps' | 'map' | 'last-ride' | null>(null);
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(true);
  const [feedStatus, setFeedStatus] = useState<ObstacleFeedStatus>('connecting');
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [feedRetryKey, setFeedRetryKey] = useState(0);
  
  const mapRef = useRef<MapView | null>(null);
  const rideData = propRideData || route.params?.rideData;
  const rideId = propRideId || route.params?.rideId;
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

  // Set up real-time obstacle subscription
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    if (isRealTimeEnabled) {
      try {
        unsubscribe = subscribeToObstacles((newObstacles) => {
          setObstacles(newObstacles);
          setLastUpdated(Date.now());
        }, { status: 'active' }, setFeedStatus);

        console.log('[UnifiedRideObstacleScreen] Real-time obstacle subscription enabled');
      } catch (error) {
        console.warn('[UnifiedRideObstacleScreen] Failed to set up real-time subscription:', error);
        setIsRealTimeEnabled(false);
        // Fallback to manual loading
        loadObstacles();
      }
    } else {
      // Manual refresh mode
      loadObstacles();
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
        console.log('[UnifiedRideObstacleScreen] Real-time subscription cleaned up');
      }
    };
  }, [isRealTimeEnabled, feedRetryKey]);

  const loadObstacles = async () => {
    try {
      const result = await fetchObstacles({ status: 'active' });
      setObstacles(result.obstacles);
      setFeedStatus(result.status);
      setLastUpdated(result.fetchedAt);
    } catch (error) {
      console.warn('[UnifiedRideObstacleScreen] Failed to load obstacles:', error);
      setFeedStatus('error');
    }
  };

  const retryFeed = () => {
    setFeedStatus('connecting');
    setFeedRetryKey((k) => k + 1);
  };

  // Real foreground location (expo-location). The watcher lives for the whole screen and is
  // removed on unmount; tab switches never recreate it. The first real fix pre-selects the
  // report location, but nothing is ever guessed.
  const { state: locState, retry: retryLocation } = useForegroundLocation((coords) => {
    setReportLocation((prev) => prev ?? coords);
    setReportLocationSource((prev) => prev ?? 'gps');
  });
  const currentLocation = locState.coords;

  // Last recorded point of the ride being reviewed: only ever offered as an explicit choice
  const lastRidePoint = useMemo(() => {
    const path = rideData?.path;
    if (path && path.length > 0) {
      const p = path[path.length - 1];
      return { latitude: p.latitude, longitude: p.longitude };
    }
    return rideData?.lastKnownLocation
      ? { latitude: rideData.lastKnownLocation.latitude, longitude: rideData.lastKnownLocation.longitude }
      : null;
  }, [rideData]);

  // Center map when location changes or tab switches to report
  useEffect(() => {
    if (mapRef.current && currentLocation && activeTab === 'report') {
      // Add a small delay to ensure the map is rendered
      const timeoutId = setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            latitudeDelta: 0.008,
            longitudeDelta: 0.008,
          }, 1000);
        }
      }, 800); // Increased delay for better reliability
      
      return () => clearTimeout(timeoutId);
    }
  }, [currentLocation, activeTab]);

  // Handle tab switching to ensure map is properly centered
  useEffect(() => {
    if (activeTab === 'report' && mapRef.current) {
      // Delay to ensure map component is rendered after tab switch
      const timeoutId = setTimeout(() => {
        if (mapRef.current) {
          // Center on current location or use last known location
          const centerLocation = currentLocation || rideData?.lastKnownLocation || 
            (rideData?.path && rideData.path.length > 0 ? rideData.path[rideData.path.length - 1] : null);
          
          if (centerLocation) {
            mapRef.current.animateToRegion({
              latitude: centerLocation.latitude,
              longitude: centerLocation.longitude,
              latitudeDelta: 0.008,
              longitudeDelta: 0.008,
            }, 1000);
          }
        }
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [activeTab]); // Only depend on activeTab to avoid re-centering on location changes

  // Track unsaved changes
  useEffect(() => {
    const hasChanges = !!(selectedWildlife || sightingNotes || sightingPhoto || selectedIssue || reportNotes || selectedTrailId);
    setHasUnsavedChanges(hasChanges);
  }, [selectedWildlife, sightingNotes, sightingPhoto, selectedIssue, reportNotes, selectedTrailId]);

  // Helper functions for obstacle display
  const getObstacleIcon = (type: string): string => {
    switch (type) {
      case 'pothole': return 'alert-triangle';
      case 'debris': return 'trash-2';
      case 'animal': return 'alert-triangle';
      case 'tree': return 'feather';
      case 'water': return 'droplet';
      default: return 'alert-circle';
    }
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return palette.obstacleCritical;
      case 'high': return palette.obstacleHigh;
      case 'medium': return palette.obstacleMedium;
      case 'low': return palette.obstacleLow;
      default: return palette.textSecondary;
    }
  };

  const onMapPress = (e: any) => {
    const { coordinate } = e.nativeEvent;
    setReportLocation(coordinate);
    setReportLocationSource('map');
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
      
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera access is needed to take photos of wildlife.');
        setIsLoadingPhoto(false);
        return;
      }

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
      
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Photo library access is needed to choose photos.');
        setIsLoadingPhoto(false);
        return;
      }

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
        return photoUri;
      }

      const filename = `sighting_${currentUser?.uid || 'user'}_${Date.now()}.jpg`;
      const baseDir = ((FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || '') as string;
      const localPath = baseDir + filename;
      
      console.log('Photo path stored locally:', photoUri);
      return photoUri;
    } catch (error) {
      console.error('Error saving photo locally:', error);
      return null;
    }
  };

  const submitAll = async () => {
    try {
      setIsSubmitting(true);
      let obstaclePublished: boolean | null = null;

      if (!selectedWildlife && !selectedIssue && !sightingNotes && !reportNotes && !selectedTrailId) {
        if (onClose) {
          onClose();
        } else {
          navigation.goBack();
        }
        return;
      }

      const observation: any = {
        rideId: rideId,
      };

      if (selectedWildlife || sightingNotes || sightingPhoto) {
        observation.sighting = {
          wildlifeType: selectedWildlife ? WILDLIFE.find((w) => w.id === selectedWildlife)?.label || 'Unknown' : 'Unknown',
          notes: sightingNotes || '',
          photoUri: sightingPhoto || undefined,
          location: currentLocation || undefined,
        };
      }

      // Handle trail reports by creating obstacles directly. A location alone is not a report.
      if (selectedIssue || reportNotes.trim() || selectedTrailId) {
        const chosenTrail = selectedTrailId ? trailData.find((trail) => trail.id === selectedTrailId) : undefined;
        const issueLabel = selectedIssue ? TRAIL_ISSUES.find((i) => i.id === selectedIssue)?.label || 'Other' : 'Other';
        
        // Map trail issues to obstacle types
        const obstacleTypeMap: Record<string, ObstacleType> = {
          'Fallen Tree': 'tree',
          'Water Crossing': 'water',
          'Muddy Section': 'water',
          'Animal on Path': 'animal',
          'Fence Damage': 'debris',
          'Trail Erosion': 'debris',
          'Gate Problem': 'debris',
          'Other Issue': 'other'
        };
        
        const obstacleType = obstacleTypeMap[issueLabel] || 'other';
        const severity = (selectedIssue === 'i_hazard' ? 'high' : 'medium') as ObstacleSeverity;
        const location = reportLocation;

        if (location) {
          try {
            const savedObstacle = await saveObstacle({
              type: obstacleType,
              severity: severity,
              status: 'active',
              title: issueLabel,
              description: reportNotes || undefined,
              location: location,
            });
            obstaclePublished = savedObstacle.published;
            console.log('[UnifiedRideObstacleScreen] Created obstacle from trail report:', issueLabel);

            // Send FCM notification to admins about new trail obstacle (only once the report is on the server)
            try {
              const userId = firebaseAuth?.currentUser?.uid;
              if (userId && savedObstacle.published) {
                await createAdminNotification(
                  userId,
                  'alert',
                  `New Trail Obstacle: ${issueLabel}`,
                  `A new ${severity} severity obstacle has been reported on the trail${savedObstacle.userName ? ` by ${savedObstacle.userName}` : ''}. ${reportNotes ? `Notes: ${reportNotes}` : ''}`,
                  'admins',
                  {
                    obstacleId: savedObstacle.id,
                    type: obstacleType,
                    severity: severity,
                    location: location,
                    reportedBy: savedObstacle.userName || 'Anonymous'
                  }
                );
                console.log('[UnifiedRideObstacleScreen] Admin notification saved');
              }
            } catch (notificationError) {
              console.warn('[UnifiedRideObstacleScreen] Failed to send FCM notification:', notificationError);
              // Non-fatal error - obstacle was still saved
            }
          } catch (error) {
            console.error('[UnifiedRideObstacleScreen] Failed to create obstacle:', error);
            Alert.alert('Error', 'Failed to save obstacle. Please try again.');
            return;
          }
        } else {
          Alert.alert(
            'Location Required',
            locState.status === 'ok'
              ? 'Tap the map to choose where the issue is, or use your current location.'
              : `${locationStatusMessage(locState.status)} A trail report needs a location.`
          );
          return;
        }
      }

      // Only save observation if there's wildlife data (no report data needed since we handle obstacles directly)
      if (observation.sighting) {
        await saveObservation(observation);
      }
      
      onSubmit?.(observation);
      
      // Say exactly what happened: a report is only "visible to others" once the server accepted it
      const outcome: string[] = [];
      if (obstaclePublished === true) {
        outcome.push('Your trail report was sent to SBHRA and can now be seen by other riders.');
      } else if (obstaclePublished === false) {
        outcome.push('Your trail report is saved on this device — not yet visible to others.');
      }
      if (observation.sighting) {
        outcome.push('Your wildlife sighting is saved on this device.');
      }
      const outcomeTitle = obstaclePublished === false ? 'Saved on this device' : '✓ Saved';
      const outcomeMessage = outcome.join('\n\n') || 'Saved on this device.';

      if (isDuringRide) {
        Alert.alert(outcomeTitle, `${outcomeMessage}\n\nKeep riding safely!`, [{ text: 'Continue Riding', style: 'default' }]);
      } else {
        Alert.alert(outcomeTitle, outcomeMessage, [{ text: 'Done', onPress: () => onClose ? onClose() : navigation.goBack() }]);
      }

      // Reset form
      setSelectedWildlife(null);
      setSightingNotes('');
      setSightingPhoto(null);
      setSelectedIssue(null);
      setReportNotes('');
      setReportLocation(currentLocation);
      setReportLocationSource(currentLocation ? 'gps' : null);
      setSelectedTrailId(null);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error saving observations:', error);
      Alert.alert('Save Error', 'Failed to save your observations. Please try again.');
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

  const feedView = describeObstacleFeed(feedStatus, obstacles.length, lastUpdated);

  const reportLocationLabel =
    reportLocationSource === 'gps' ? 'Your current location'
    : reportLocationSource === 'map' ? 'The spot you tapped on the map'
    : reportLocationSource === 'last-ride' ? 'The last point recorded on your ride'
    : null;

  const renderObstacleItem = ({ item }: { item: Obstacle }) => {
    const iconName = getObstacleIcon(item.type);
    const color = getSeverityColor(item.severity);
    
    return (
      <View style={styles.obstacleCard}>
        <View style={styles.obstacleHeader}>
          <View style={[styles.obstacleIconContainer, { backgroundColor: `${color}22` }]}>
            <Feather name={iconName as any} size={20} color={color} />
          </View>
          <View style={styles.obstacleTitleContainer}>
            <Text style={styles.obstacleTitle}>{item.title}</Text>
            <Text style={styles.obstacleSubtitle}>{item.type}</Text>
          </View>
          <View style={[styles.severityBadge, { backgroundColor: color }]}>
            <Text style={styles.severityBadgeText}>{item.severity}</Text>
          </View>
        </View>
        
        {item.description && (
          <Text style={styles.obstacleDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        
        <View style={styles.obstacleFooter}>
          <Text style={styles.obstacleMeta}>
            ✓ {item.verifiedBy?.length || 0} verified • {item.userName || 'Anonymous'}
          </Text>
          <TouchableOpacity 
            style={styles.viewOnMapButton}
            onPress={() => {
              console.log('View on Map pressed for obstacle:', item.id);
              // First switch to report tab, then animate to location after delay
              setActiveTab('report');
              // Wait for tab switch and map render before animating
              setTimeout(() => {
                if (mapRef.current) {
                  console.log('Animating to obstacle location:', item.location);
                  mapRef.current.animateToRegion({
                    latitude: item.location.latitude,
                    longitude: item.location.longitude,
                    latitudeDelta: 0.008,
                    longitudeDelta: 0.008,
                  }, 1000);
                } else {
                  console.warn('Map reference not available when trying to animate to obstacle');
                }
              }, 500); // Allow time for tab switch and map render
            }}
          >
            <Text style={styles.viewOnMapButtonText}>View on Map</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderObstacleMarker = (obstacle: Obstacle) => {
    const iconName = getObstacleIcon(obstacle.type);
    const color = getSeverityColor(obstacle.severity);
    
    return (
      <Marker
        key={obstacle.id}
        coordinate={{
          latitude: obstacle.location.latitude,
          longitude: obstacle.location.longitude,
        }}
        pinColor={color}
      >
        <View style={[styles.markerContainer, { borderColor: color }]}>
          <Feather name={iconName as any} size={20} color={color} />
        </View>
        
        <Callout tooltip>
          <View style={styles.calloutContainer}>
            <View style={styles.calloutHeader}>
              <Feather name={iconName as any} size={16} color={color} />
              <Text style={styles.calloutTitle}>{obstacle.title}</Text>
            </View>
            
            <View style={styles.calloutBody}>
              <View style={styles.badgeRow}>
                <View style={[styles.badge, { backgroundColor: color }]}>
                  <Text style={styles.badgeText}>{obstacle.severity}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: '#6B7280' }]}>
                  <Text style={styles.badgeText}>{obstacle.type}</Text>
                </View>
              </View>
              
              {obstacle.description && (
                <Text style={styles.description} numberOfLines={2}>
                  {obstacle.description}
                </Text>
              )}
              
              <View style={styles.footer}>
                <Text style={styles.verifiedText}>
                  ✓ {obstacle.verifiedBy?.length || 0} verified
                </Text>
                <Text style={styles.reportedBy}>
                  {obstacle.userName || 'Anonymous'}
                </Text>
              </View>
            </View>
          </View>
        </Callout>
      </Marker>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
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
          <View style={[styles.header, { paddingTop: 16 + insets.top }]}>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>
                {isDuringRide ? 'During Ride' : 'Ride Review'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {isDuringRide ? 'Log observations as you ride' : 'Record your observations'}
              </Text>
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
          <View style={styles.content}>
            <View style={styles.contentInner}>
          {/* Enhanced Stats Card - Only show if not during ride */}
          {!isDuringRide && rideData && (
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
          )}

          {/* Tab Selector */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'obstacles' && styles.activeTab]}
              onPress={() => setActiveTab('obstacles')}
            >
              <Text style={[styles.tabText, activeTab === 'obstacles' && styles.activeTabText]}>
                ⚠️ Hazards ({obstacles.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'sighting' && styles.activeTab]}
              onPress={() => setActiveTab('sighting')}
            >
              <Text style={[styles.tabText, activeTab === 'sighting' && styles.activeTabText]}>
                🦌 Wildlife
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'report' && styles.activeTab]}
              onPress={() => setActiveTab('report')}
            >
              <Text style={[styles.tabText, activeTab === 'report' && styles.activeTabText]}>
                📝 Trail Report
              </Text>
            </TouchableOpacity>
          </View>

          {/* Obstacles Section */}
          {activeTab === 'obstacles' && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Trail Obstacles</Text>
                <View style={styles.liveIndicator}>
                  <View style={[styles.liveDot, feedView.indicator.isLive && styles.liveDotActive]} />
                  <Text style={styles.liveText}>{feedView.indicator.label}</Text>
                </View>
              </View>
              <Text style={styles.sectionDescription}>
                Reported obstacles that may affect your ride
              </Text>

              {feedView.kind === 'list' ? (
                <>
                  {feedView.caveat ? <Text style={styles.feedCaveat}>{feedView.caveat}</Text> : null}
                  <FlatList
                    data={obstacles}
                    renderItem={renderObstacleItem}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                    contentContainerStyle={styles.obstacleList}
                  />
                </>
              ) : (
                <View style={styles.emptyState}>
                  <Feather
                    name={feedView.kind === 'empty' || feedView.kind === 'loading' ? 'info' : feedView.kind === 'unavailable' ? 'wifi-off' : 'alert-circle'}
                    size={44}
                    color={feedView.kind === 'unavailable' || feedView.kind === 'error' ? palette.caution : palette.textSecondary}
                  />
                  <Text style={styles.emptyTitle}>{feedView.title}</Text>
                  {feedView.body ? <Text style={styles.emptySubtitle}>{feedView.body}</Text> : null}
                  {feedView.kind === 'error' ? (
                    <TouchableOpacity style={styles.retryButton} onPress={retryFeed}>
                      <Text style={styles.retryButtonText}>Try again</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
            </View>
          )}

          {/* Wildlife Sightings Section */}
          {activeTab === 'sighting' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Wildlife Sighting</Text>
              <Text style={styles.sectionDescription}>
                Log animals you encounter on the trail
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
              <Text style={styles.sectionTitle}>Trail Report</Text>
              <Text style={styles.sectionDescription}>
                Report trail conditions to help other riders
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

              <View style={styles.mapContainer}>
                <Text style={styles.mapLabel}>📍 Mark Location on Map</Text>
                <View style={[styles.locationBanner, locState.status === 'ok' ? styles.locationBannerOk : styles.locationBannerWarn]}>
                  <Text style={styles.locationBannerText}>{locationStatusMessage(locState.status)}</Text>
                  {locState.status === 'denied' || locState.status === 'services-off' || locState.status === 'timeout' ? (
                    <View style={styles.locationActions}>
                      <TouchableOpacity style={styles.locationActionButton} onPress={retryLocation}>
                        <Text style={styles.locationActionText}>Try again</Text>
                      </TouchableOpacity>
                      {locState.status !== 'timeout' ? (
                        <TouchableOpacity style={styles.locationActionButton} onPress={() => Linking.openSettings()}>
                          <Text style={styles.locationActionText}>Open settings</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : null}
                  {locState.status !== 'ok' && lastRidePoint ? (
                    <TouchableOpacity
                      style={styles.locationActionButton}
                      onPress={() => {
                        setReportLocation(lastRidePoint);
                        setReportLocationSource('last-ride');
                      }}
                    >
                      <Text style={styles.locationActionText}>Use the last point of my ride</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <Text style={styles.reportLocationLabel}>
                  {reportLocationLabel ? `Report location: ${reportLocationLabel}` : 'Report location: not set. Tap the map to choose where the issue is.'}
                </Text>
                <View style={styles.mapWrapper}>
                  <MapWithStatus label="report">
                    {(mapProps) => (
                      <MapView
                        {...mapProps}
                        ref={mapRef}
                        style={styles.map}
                        mapType={preferences.mapType}
                        initialRegion={{
                          latitude: currentLocation?.latitude || -26.2041, // Johannesburg fallback
                          longitude: currentLocation?.longitude || 28.0473,
                          latitudeDelta: 0.008,
                          longitudeDelta: 0.008,
                        }}
                        showsUserLocation={true}
                        showsMyLocationButton={false}
                        showsPointsOfInterests={false}
                        showsBuildings={false}
                        showsIndoors={false}
                        showsTraffic={false}
                        showsIndoorLevelPicker={false}
                        loadingEnabled={true}
                        loadingIndicatorColor="#2C5530"
                        loadingBackgroundColor="#FAF9F7"
                        onPress={onMapPress}
                      >
                        {/* Show ride path if available */}
                        {rideData?.path && rideData.path.length > 1 && (
                          <Polyline
                            coordinates={rideData.path}
                            strokeColor="#2C5530"
                            strokeWidth={3}
                          />
                        )}

                        {/* Show existing obstacles */}
                        {obstacles.map(renderObstacleMarker)}

                        {/* Show new report location */}
                        {reportLocation && (
                          <Marker
                            coordinate={{
                              latitude: reportLocation?.latitude || 0,
                              longitude: reportLocation?.longitude || 0,
                            }}
                            pinColor="#C73E1D"
                          >
                            <View style={styles.customMarker}>
                              <Text style={styles.markerEmoji}>📍</Text>
                            </View>
                          </Marker>
                        )}

                        {/* Current location */}
                        {currentLocation && (
                          <Marker
                            coordinate={{
                              latitude: currentLocation?.latitude || 0,
                              longitude: currentLocation?.longitude || 0,
                            }}
                          >
                            <View style={styles.currentLocationMarker}>
                              <View style={styles.currentLocationDot} />
                            </View>
                          </Marker>
                        )}
                      </MapView>
                    )}
                  </MapWithStatus>
                  <TouchableOpacity
                    style={[styles.currentLocationButton, !currentLocation && { opacity: 0.4 }]}
                    disabled={!currentLocation}
                    onPress={() => {
                      if (currentLocation) {
                        setReportLocation(currentLocation);
                        setReportLocationSource('gps');
                        mapRef.current?.animateToRegion({
                          latitude: currentLocation?.latitude || 0,
                          longitude: currentLocation?.longitude || 0,
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
        <View style={[styles.actionContainer, { paddingBottom: insets.bottom + 16 }]}>
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
            <Text style={styles.skipButtonText}>
              {isDuringRide ? 'Continue Riding' : 'Skip for Now'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
            </View>
          </View>
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
</SafeAreaView>
);
}

const createStyles = (palette: AppPalette) =>
  StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  innerContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  content: {
    paddingBottom: 16,
  },
  contentInner: {
    paddingHorizontal: 16,
  },
  
  // Header styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: palette.card,
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: palette.textPrimary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: palette.textSecondary,
    marginTop: 4,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: palette.textSecondary,
    fontWeight: '400',
  },

  // Stats Card
  statsCard: {
    backgroundColor: palette.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
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
    color: palette.textPrimary,
  },
  successBadge: {
    backgroundColor: palette.surfaceVariant,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.success,
  },
  successBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.success,
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
    color: palette.brandPrimary,
  },
  statUnit: {
    fontSize: 14,
    fontWeight: '400',
    color: palette.textMuted,
  },
  statLabel: {
    fontSize: 12,
    color: palette.textSecondary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: palette.divider,
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: palette.surfaceVariant,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: palette.brandPrimary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.textSecondary,
  },
  activeTabText: {
    color: palette.onPrimary,
    fontWeight: '700',
  },

  // Section styles
  section: {
    backgroundColor: palette.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.textPrimary,
    letterSpacing: -0.2,
  },
  sectionDescription: {
    fontSize: 14,
    color: palette.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },

  // Live indicator
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.caution,
  },
  liveDotActive: {
    backgroundColor: palette.success,
  },
  liveText: {
    fontSize: 12,
    fontWeight: '500',
    color: palette.textSecondary,
  },

  feedCaveat: {
    fontSize: 13,
    color: palette.caution,
    backgroundColor: palette.surfaceVariant,
    borderWidth: 1,
    borderColor: palette.caution,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: palette.brandPrimary,
  },
  retryButtonText: {
    color: palette.onPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  locationBanner: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 8,
  },
  locationBannerOk: {
    backgroundColor: '#ECFDF5',
  },
  locationBannerWarn: {
    backgroundColor: '#FEF3C7',
  },
  locationBannerText: {
    fontSize: 13,
    color: '#1F2937',
    lineHeight: 18,
  },
  locationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  locationActionButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  locationActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  reportLocationLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },

  // Obstacle list
  obstacleList: {
    gap: 12,
  },
  obstacleCard: {
    backgroundColor: palette.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.divider,
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  obstacleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  obstacleIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  obstacleTitleContainer: {
    flex: 1,
  },
  obstacleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  obstacleSubtitle: {
    fontSize: 13,
    color: palette.textSecondary,
    textTransform: 'capitalize',
    marginTop: 2,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  severityBadgeText: {
    color: palette.onPrimary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  obstacleDescription: {
    fontSize: 14,
    color: palette.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  obstacleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  obstacleMeta: {
    fontSize: 12,
    color: palette.textMuted,
    flex: 1,
  },
  viewOnMapButton: {
    backgroundColor: palette.brandPrimary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  viewOnMapButtonText: {
    color: palette.onPrimary,
    fontSize: 12,
    fontWeight: '600',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  emptySubtitle: {
    fontSize: 14,
    color: palette.textSecondary,
    textAlign: 'center',
  },

  // Wildlife grid
  wildlifeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  wildlifeCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  wildlifeCardSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  wildlifeEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  wildlifeLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
  },
  wildlifeLabelSelected: {
    color: '#3B82F6',
    fontWeight: '700',
  },

  // Issue grid
  issueGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  issueCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  issueCardSelected: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  issueEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  issueLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
  },
  issueLabelSelected: {
    color: '#F59E0B',
    fontWeight: '700',
  },

  // Input styles
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1F2937',
    minHeight: 80,
  },

  // Quick notes
  quickNotesContainer: {
    marginBottom: 20,
  },
  quickNotesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  quickNotesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickNote: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickNoteIcon: {
    fontSize: 14,
  },
  quickNoteText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },

  // Photo styles
  photoButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  photoButtonIcon: {
    fontSize: 32,
  },
  photoButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  photoPreviewContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  retakePhotoButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: '#2C5530',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retakePhotoText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },

  // Map styles
  mapContainer: {
    marginBottom: 20,
  },
  mapLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  mapWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    height: 300,
  },
  map: {
    flex: 1,
  },
  customMarker: {
    backgroundColor: 'white',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#C73E1D',
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markerEmoji: {
    fontSize: 16,
  },
  currentLocationMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(44, 85, 48, 0.3)',
    borderWidth: 3,
    borderColor: '#2C5530',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentLocationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2C5530',
  },
  currentLocationButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  currentLocationButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2C5530',
  },

  // Obstacle marker styles (from ObstacleView)
  markerContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    borderWidth: 3,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  calloutContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    minWidth: 200,
    maxWidth: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  calloutTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    flex: 1,
    color: '#1F2937',
  },
  calloutBody: {
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  description: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  reportedBy: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },

  // Action buttons
  actionContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 12,
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonLoading: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  skipButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  skipButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },

  });
