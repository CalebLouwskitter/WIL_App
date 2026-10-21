import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { RideData } from '../hooks/useRideTracker';
import { gpxFileName, rideToGpx } from '../utils/gpx';

/** Write the ride to a .gpx file in the cache and open the share sheet. */
export async function shareRideAsGpx(ride: RideData): Promise<void> {
  if (!ride.path || ride.path.length === 0) {
    throw new Error('This ride has no recorded GPS points to export.');
  }
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  const file = new File(Paths.cache, gpxFileName(ride));
  if (file.exists) file.delete();
  file.create();
  file.write(rideToGpx(ride));
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/gpx+xml',
    UTI: 'com.topografix.gpx',
    dialogTitle: 'Export ride as GPX',
  });
}
