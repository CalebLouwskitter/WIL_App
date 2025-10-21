import React, { useEffect, useRef, useState } from 'react';
import { useColorScheme, View, Text, Image, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, Region, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import type { RidePoint, TrailProximity } from '../hooks/useRideTracker';
import { primaryPreviewRoutes } from '../constants/trails';
import { Colors } from '@/constants/colors';
import Feather from 'react-native-vector-icons/Feather';
import { getObservations, type RideObservation } from '@/services/ObservationStorage';
import { getTrailUsageStats, type TrailUsageStats } from '@/services/TrailAnalyticsService';
import ObstacleView from '../screens/Mapping/ObstacleView';
import { getObstaclesInArea, verifyObstacle, type Obstacle } from '../services/ObstacleService';
import type { ObstacleSeverity, ObstacleType } from '../services/Data';
import ProfilePictureService from '../services/ProfilePictureService';
import useOnlineUsers from '../hooks/useOnlineUsers';
import { auth } from '../services/firebase';
import { getDeviceId } from '../services/OnlineUserService';
import haversine from 'haversine';

const applyOpacity = (hexColor: string, opacity: number) => {
  const hex = hexColor.replace('#', '').trim();
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return hexColor;
};

// Renders the main MapView with three responsibilities:
// 1) Draw static preview routes (A–C).
// 2) Draw the rider's live path as a polyline.
// 3) Keep a tight, 3D, forward-facing camera follow on the latest point.
type MapType = 'standard' | 'satellite' | 'hybrid' | 'terrain';
type Props = { 
  path: RidePoint[] | undefined;
  mapType?: MapType;
  nearestTrail?: TrailProximity | null;
  snappedCoordinate?: { latitude: number; longitude: number } | null;
  snapRadius?: number | null;
  obstacleFilters?: {
    severities?: ObstacleSeverity[];
    types?: ObstacleType[];
    showResolved?: boolean;
  };
};

// Fallback large region so the map renders immediately while we resolve a more precise region.
const WORLD_REGION: Region = {
  latitude: 0,
  longitude: 0,
  latitudeDelta: 60,
  longitudeDelta: 60,
};

export default function MapViewTracker({ path, mapType = 'standard', nearestTrail, snappedCoordinate, snapRadius, obstacleFilters }: Props) {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];
  const [region, setRegion] = useState<Region | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const [heading, setHeading] = useState<number>(0);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const { users } = useOnlineUsers();
  const [myDeviceId, setMyDeviceId] = useState<string | null>(null);
  const [observations, setObservations] = useState<RideObservation[]>([]);
  const [trailUsage, setTrailUsage] = useState<Record<string, TrailUsageStats>>({});
  const lastFollowCenter = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastObstacleFetchRef = useRef<{ center: { latitude: number; longitude: number }; ts: number } | null>(null);
  const FOLLOW_MIN_METERS = 12;
  const OBSTACLE_FETCH_MIN_MOVE_METERS = 250;
  const OBSTACLE_FETCH_MIN_MS = 10000;
  const filteredObstacles = React.useMemo(() => {
    const f = (obstacleFilters || {});
    let list = obstacles;
    if (f.severities && f.severities.length) {
      list = list.filter(o => (f.severities as any).includes(o.severity as any));
    }

    if (f.types && f.types.length) {
      list = list.filter(o => (f.types as any).includes(o.type as any));
    }
    if (f.showResolved === false) {
      list = list.filter(o => o.status !== 'resolved');
    }
    return list;
  }, [obstacles, obstacleFilters]);

  const maxTrailDistance = React.useMemo(() => {
    return Object.values(trailUsage).reduce((max, stats) => Math.max(max, stats.totalDistance), 0);
  }, [trailUsage]);

  const getTrailStrokeStyle = React.useCallback(
    (trailId: string, fallbackColor: string) => {
      const stats = trailUsage[trailId];
      if (!stats || maxTrailDistance <= 0) {
        return { strokeWidth: 3, strokeColor: fallbackColor };
      }
      const weight = Math.min(1, stats.totalDistance / maxTrailDistance);
      const width = 3 + weight * 6;
      const opacity = 0.35 + weight * 0.65;
      return { strokeWidth: width, strokeColor: applyOpacity(fallbackColor, opacity) };
    },
    [trailUsage, maxTrailDistance]
  );

  // When the path grows, recenter on the most recent point with a tight delta
  // (gives a max-zoomed-in feel so nearby objects are visible).
  useEffect(() => {
    if (path && path.length > 0) {
      const last = path[path.length - 1];
      if (path.length > 1) {
        const prev = path[path.length - 2];
        // compute bearing in degrees 0..360
        const toRad = (v: number) => (v * Math.PI) / 180;
        const toDeg = (v: number) => (v * 180) / Math.PI;
        const dLon = toRad(last.longitude - prev.longitude);
        const lat1 = toRad(prev.latitude);
        const lat2 = toRad(last.latitude);
        const y = Math.sin(dLon) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
        const brng = (toDeg(Math.atan2(y, x)) + 360) % 360;
        setHeading(brng);
      }
      const prevCenter = lastFollowCenter.current;
      const moved = prevCenter ? haversine(prevCenter, last, { unit: 'meter' }) : Infinity;
      if (!prevCenter || moved > FOLLOW_MIN_METERS) {
        setRegion({
          latitude: last.latitude,
          longitude: last.longitude,
          latitudeDelta: 0.002,
          longitudeDelta: 0.002,
        });
        lastFollowCenter.current = { latitude: last.latitude, longitude: last.longitude };
      }
    }
  }, [path?.length]);

  // Animate the camera whenever the region updates to create a 3D nearby-objects look:
  // - high pitch (55º)
  // - high zoom (~18.5)
  // - heading in the direction of travel
  useEffect(() => {
    if (!region || !mapRef.current) return;
    try {
      // Zoom ~17 gives a street-level view on Google; pitch adds 3D perspective
      mapRef.current.animateCamera(
        {
          center: { latitude: region.latitude, longitude: region.longitude },
          pitch: 55,
          heading,
          zoom: 18.5,
          altitude: undefined,
        },
        { duration: 600 }
      );
    } catch (_e) {
  
      // no-op; animateCamera may not be supported on some providers
    }
  }, [region?.latitude, region?.longitude, heading]);



  // If no path yet, acquire current location once for initial region (tight delta)
  // so the user starts fully zoomed into their nearby area.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (region) return;
      try {
        let permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          if (!permission.canAskAgain) return; // Silent fail; map will show world view.
          permission = await Location.requestForegroundPermissionsAsync();
        }

        if (permission.status !== 'granted') return; // Silent fail; map will show world view.
        const loc = await Location.getCurrentPositionAsync({});
        if (!cancelled) {
          setRegion({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.0015,
            longitudeDelta: 0.0015,
          });
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [region]);

  // Load obstacles in the current area
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!region) return;
      const now = Date.now();
      const prev = lastObstacleFetchRef.current;
      const movedEnough = prev
        ? haversine(prev.center, { latitude: region.latitude, longitude: region.longitude }, { unit: 'meter' }) > OBSTACLE_FETCH_MIN_MOVE_METERS
        : true;
      const elapsedEnough = prev ? now - prev.ts >= OBSTACLE_FETCH_MIN_MS : true;
      if (!movedEnough && !elapsedEnough) return;
      try {
        const nearbyObstacles = await getObstaclesInArea(
          { latitude: region.latitude, longitude: region.longitude },
          10, // 10km radius
          { status: 'active' }
        );
        if (!cancelled) {
          setObstacles(nearbyObstacles);
          lastObstacleFetchRef.current = {
            center: { latitude: region.latitude, longitude: region.longitude },
            ts: now,
          };
        }
      } catch (error) {
        console.warn('Failed to load obstacles:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [region?.latitude, region?.longitude]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await getObservations();
        if (mounted) {
          setObservations(data);
        }
      } catch (error) {
        console.warn('Failed to load observations:', error);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Load user's avatar for map marker
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const uri = await ProfilePictureService.getProfilePicture();
        if (mounted) setAvatarUri(uri);
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  // Load this device's id for proper filtering (so other devices on same UID are shown)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const id = await getDeviceId();
        if (mounted) setMyDeviceId(id);
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stats = await getTrailUsageStats();
        if (mounted) {
          setTrailUsage(stats);
        }
      } catch (error) {
        console.warn('Failed to load trail usage stats:', error);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const start = path && path[0];
  const end = path && path[path.length - 1];

  const handleVerifyObstacle = async (obstacle: Obstacle) => {
    try {
      await verifyObstacle(obstacle.id);
      // Refresh obstacles to show updated verification count
      const uid = auth?.currentUser?.uid || 'local';
      setObstacles(prev => prev.map(o => 
        o.id === obstacle.id 
          ? { ...o, verifiedBy: o.verifiedBy?.includes(uid) ? o.verifiedBy : [...(o.verifiedBy || []), uid] }
          : o
      ));
    } catch (error) {
      console.warn('Failed to verify obstacle:', error);
    }
  };

  return (
    <MapView
      style={{ flex: 1 }}
      provider={PROVIDER_DEFAULT}

      // Map type from prop (standard, satellite, hybrid, terrain)
      mapType={mapType}
      initialRegion={region || WORLD_REGION}
      showsUserLocation={false}
      showsMyLocationButton
      showsCompass
      moveOnMarkerPress={false}
      
      // Show buildings and POIs to reinforce the "3D nearby objects" feel
      showsBuildings
      showsIndoors
      showsPointsOfInterest
      ref={mapRef}
    >
      {/* Static preview routes (A-C) */}
      {primaryPreviewRoutes.map((route) => {
        const baseColor = route.color || palette.textOnDark;
        const { strokeWidth, strokeColor } = getTrailStrokeStyle(route.id, baseColor);
        return (
          <Polyline
            key={route.id}
            coordinates={route.routeWaypoints.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))}
            strokeWidth={strokeWidth}
            strokeColor={strokeColor}
          />
        );
      })}
      {path && path.length > 0 && (
        <>
          <Polyline
            coordinates={path.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))}
            strokeWidth={4}
            strokeColor={palette.brandPrimary}
          />
          {start && <Marker coordinate={{ latitude: start.latitude, longitude: start.longitude }} title="Start" />}
          {end && <Marker coordinate={{ latitude: end.latitude, longitude: end.longitude }} title="Current" />}
        </>
      )}
      {snappedCoordinate && !!snapRadius && (
        <Circle
          center={snappedCoordinate}
          radius={snapRadius}
          strokeColor={applyOpacity(palette.brandPrimary, 0.9)}
          fillColor={applyOpacity(palette.brandPrimary, 0.15)}
          strokeWidth={2}
        />
      )}
      {/* Current user avatar marker */}
      {(region || end) && (
        <Marker
          coordinate={{ latitude: (end?.latitude ?? region!.latitude), longitude: (end?.longitude ?? region!.longitude) }}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
        >
          <View>
            {avatarUri ? (
              <View style={styles.avatarShadow}> 
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              </View>
            ) : (
              <View style={[styles.avatar, { backgroundColor: palette.brandPrimary }]} />
            )}
            <View style={[styles.userBadge, { backgroundColor: palette.brandPrimary }]}> 
              <Feather name="user" size={10} color="#FFFFFF" />
            </View>
          </View>
        </Marker>
      )}
      {/* Other online users with their avatars */}
      {users
        .filter(u => {
          const currentUid = auth?.currentUser?.uid;
          // hide stale entries older than 5 minutes
          if (Date.now() - (u.lastSeen || 0) > 5 * 60 * 1000) return false;
          if (!currentUid) return true;
          // hide only my current device, allow other devices of same uid
          if (u.uid === currentUid) {
            if (myDeviceId && u.deviceId) {
              return u.deviceId !== myDeviceId;
            }
            return false;
          }
          return true;
        })
        .map(u => (
          <Marker
            key={`${u.uid}_${u.deviceId || 'unknown'}`}
            coordinate={u.location}
            title={u.displayName || 'Rider'}
            description={u.isRiding ? 'Riding' : undefined}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View>
              {u.photoURL ? (
                <View style={styles.avatarShadow}>
                  <Image source={{ uri: u.photoURL }} style={styles.avatar} />
                </View>
              ) : (
                <View style={[styles.avatar, { backgroundColor: palette.brandPrimary }]} />
              )}
              <View style={[styles.userBadge, { backgroundColor: u.isRiding ? '#10b981' : palette.brandPrimary }]}> 
                <Feather name="user" size={10} color="#FFFFFF" />
              </View>
            </View>
          </Marker>
        ))}
      {observations.map((obs) => {
        const sightingLocation = obs.sighting?.location;
        const reportLocation = obs.report?.location;
        return (
          <React.Fragment key={obs.id}>
            {sightingLocation && (
              <Marker
                coordinate={{ latitude: sightingLocation.latitude, longitude: sightingLocation.longitude }}
                title={obs.sighting?.wildlifeType || 'Wildlife Sighting'}
                description={obs.sighting?.notes}
                pinColor="#10B981"
              />
            )}
            {reportLocation && (
              <Marker
                coordinate={{ latitude: reportLocation.latitude, longitude: reportLocation.longitude }}
                title={obs.report?.issueType || 'Trail Report'}
                description={obs.report?.notes}
                pinColor="#F97316"
              />
            )}
          </React.Fragment>
        );
      })}
      {nearestTrail && (
        <Marker
          coordinate={nearestTrail.coordinate}
          anchor={{ x: 0.5, y: 1 }}
        >
          <View
            style={{
              backgroundColor: palette.cardElevated || '#1F2937',
              borderRadius: 18,
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderWidth: 2,
              borderColor: '#FFFFFF',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Feather name="flag" size={16} color={palette.brandPrimary} />
            <View>
              <Text style={{ color: palette.text, fontWeight: '700', fontSize: 12 }}>{nearestTrail.name}</Text>
              <Text style={{ color: palette.placeholder || '#D1D5DB', fontSize: 11 }}>{`${nearestTrail.distance.toFixed(0)} m away`}</Text>
            </View>
          </View>
        </Marker>
      )}
      {/* Render obstacle markers */}
      <ObstacleView 
        obstacles={filteredObstacles} 
        onVerify={handleVerifyObstacle}
      />
    </MapView>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    borderRadius: 20,
  },
  userBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
