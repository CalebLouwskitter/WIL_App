import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIREBASE_ENABLED, auth } from './firebase';
import { 
  createSighting, 
  createObstacle, 
  createReport,
  newSighting,
  newObstacle,
  newReport,
  type SightingDTO,
  type ObstacleDTO,
  type ReportDTO,
  type UUID 
} from './Data';

const OBSERVATIONS_STORAGE_KEY = 'ride_observations';

export interface RideObservation {
  id: string;
  rideId?: string;
  timestamp: number;
  userId?: string;
  
  // Wildlife sighting data
  sighting?: {
    wildlifeType: string;
    notes: string;
    photoUri?: string;
    location?: {
      latitude: number;
      longitude: number;
    };
  };
  
  // Trail report data
  report?: {
    issueType: string;
    notes: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    location?: {
      latitude: number;
      longitude: number;
    };
    trailId?: string;
    trailName?: string;
  };
}

// Generate UUID
const generateUUID = (): UUID => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Save observation locally and sync to Firebase if available
 */
export const saveObservation = async (observation: Omit<RideObservation, 'id' | 'timestamp' | 'userId'>): Promise<string> => {
  const id = generateUUID();
  const timestamp = Date.now();
  const userId = auth?.currentUser?.uid;
  
  const fullObservation: RideObservation = {
    id,
    timestamp,
    userId,
    ...observation,
  };
  
  // Save locally
  try {
    const existingRaw = await AsyncStorage.getItem(OBSERVATIONS_STORAGE_KEY);
    const existing: RideObservation[] = existingRaw ? JSON.parse(existingRaw) : [];
    existing.push(fullObservation);
    await AsyncStorage.setItem(OBSERVATIONS_STORAGE_KEY, JSON.stringify(existing));
  } catch (error) {
    console.error('Error saving observation locally:', error);
    throw error;
  }
  
  // Sync to Firebase if enabled
  if (FIREBASE_ENABLED && userId) {
    try {
      // Save sighting if exists
      if (observation.sighting) {
        const sightingDTO: SightingDTO = newSighting({
          id: generateUUID(),
          animalName: observation.sighting.wildlifeType,
          location: observation.sighting.location || { latitude: 0, longitude: 0 },
          description: observation.sighting.notes,
          photoUrl: observation.sighting.photoUri,
          timestamp: new Date(timestamp).toISOString(),
          userId,
        });
        await createSighting(userId, sightingDTO);
      }
      
      // Note: Trail reports are now handled directly by UnifiedRideObstacleScreen
      // using saveObstacle() to create proper obstacles for map display
    } catch (error) {
      console.warn('Failed to sync observation to Firebase:', error);
      // Non-fatal: local save succeeded
    }
  }
  
  return id;
};

/**
 * Get all observations for the current user
 */
export const getObservations = async (): Promise<RideObservation[]> => {
  try {
    const raw = await AsyncStorage.getItem(OBSERVATIONS_STORAGE_KEY);
    if (!raw) return [];
    
    const observations: RideObservation[] = JSON.parse(raw);
    const userId = auth?.currentUser?.uid;
    
    // Filter by current user if authenticated
    if (userId) {
      return observations.filter(obs => !obs.userId || obs.userId === userId);
    }
    
    return observations;
  } catch (error) {
    console.error('Error loading observations:', error);
    return [];
  }
};

/**
 * Get observations for a specific ride
 */
export const getObservationsByRide = async (rideId: string): Promise<RideObservation[]> => {
  const all = await getObservations();
  return all.filter(obs => obs.rideId === rideId);
};

/**
 * Delete an observation
 */
export const deleteObservation = async (observationId: string): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(OBSERVATIONS_STORAGE_KEY);
    if (!raw) return;
    
    const observations: RideObservation[] = JSON.parse(raw);
    const filtered = observations.filter(obs => obs.id !== observationId);
    await AsyncStorage.setItem(OBSERVATIONS_STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting observation:', error);
    throw error;
  }
};

// Helper mapping functions
const mapIssueToObstacleType = (issueLabel: string): any => {
  // Direct mapping for MarkObstacleScreen types
  if (issueLabel === 'Fallen Tree') return 'tree';
  if (issueLabel === 'Water Hazard' || issueLabel === 'Water Crossing' || issueLabel === 'Muddy Section') return 'water';
  if (issueLabel === 'Animal') return 'animal';
  if (issueLabel === 'Debris' || issueLabel === 'Fence Damage') return 'debris';
  if (issueLabel === 'Pothole') return 'pothole';
  return 'other';
};

const mapIssueToReportType = (issueLabel: string): any => {
  if (issueLabel === 'Trail Erosion') return 'trail_damage';
  if (issueLabel === 'Gate Problem') return 'maintenance_needed';
  return 'other';
};
