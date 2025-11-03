/**
 * Test script to verify geofencing is working
 * Run this to check if your current location is in bounds
 */

import { isWithinAuthorizedArea } from './geofencing';
import * as Location from 'expo-location';

export async function testCurrentLocation() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('❌ Location permission not granted');
      return;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const coords = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };

    const isInBounds = isWithinAuthorizedArea(coords);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 GEOFENCING TEST');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Latitude: ${coords.latitude}`);
    console.log(`Longitude: ${coords.longitude}`);
    console.log(`Status: ${isInBounds ? '✅ INSIDE boundary' : '❌ OUTSIDE boundary'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return { coords, isInBounds };
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}
