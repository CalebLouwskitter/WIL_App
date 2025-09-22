import React, { useEffect, useRef, useState } from 'react';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import type { RidePoint } from '../hooks/useRideTracker';
import { primaryPreviewRoutes } from '../constants/trails';

// Renders the main MapView with three responsibilities:
// 1) Draw static preview routes (A–C).
// 2) Draw the rider's live path as a polyline.
// 3) Keep a tight, 3D, forward-facing camera follow on the latest point.
type Props = { path: RidePoint[] | undefined };

// Fallback large region so the map renders immediately while we resolve a more precise region.
const WORLD_REGION: Region = {
  latitude: 0,
  longitude: 0,
  latitudeDelta: 60,
  longitudeDelta: 60,
};

export default function MapViewTracker({ path }: Props) {
  const [region, setRegion] = useState<Region | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const [heading, setHeading] = useState<number>(0);

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
      setRegion({
        latitude: last.latitude,
        longitude: last.longitude,
        latitudeDelta: 0.002,
        longitudeDelta: 0.002,
      });
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
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return; // Silent fail; map will show world view.
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

  const start = path && path[0];
  const end = path && path[path.length - 1];

  return (
    <MapView
      style={{ flex: 1 }}
      provider={PROVIDER_DEFAULT}

      // Hybrid map type shows roads + satellite for a more detailed view
      mapType="hybrid"
      initialRegion={region || WORLD_REGION}
      region={region || undefined}
      showsUserLocation
      showsMyLocationButton
      showsCompass
      followsUserLocation
      
      // Show buildings and POIs to reinforce the "3D nearby objects" feel
      showsBuildings
      showsIndoors
      showsPointsOfInterest
      ref={mapRef}
    >
      {/* Static preview routes (A-C) */}
      {primaryPreviewRoutes.map((route) => (
        <Polyline
          key={route.id}
          coordinates={route.routeWaypoints.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))}
          strokeWidth={3}
          strokeColor={route.color || '#FFFFFF'}
        />
      ))}
      {path && path.length > 0 && (
        <>
          <Polyline
            coordinates={path.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))}
            strokeWidth={4}
            strokeColor="#1E88E5"
          />
          {start && <Marker coordinate={{ latitude: start.latitude, longitude: start.longitude }} title="Start" />}
          {end && <Marker coordinate={{ latitude: end.latitude, longitude: end.longitude }} title="Current" />}
        </>
      )}
    </MapView>
  );
}
