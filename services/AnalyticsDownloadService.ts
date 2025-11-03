import { Paths, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { 
  getGlobalRideStats, 
  getUserRideStats, 
  getGlobalTrailUsage,
  type GlobalRideStats,
  type UserRideStats,
  type GlobalTrailUsage
} from './GlobalAnalyticsService';

export interface GlobalAnalyticsExport {
  exportDate: string;
  exportTimestamp: number;
  globalStats: GlobalRideStats;
  userStats: UserRideStats[];
  trailUsage: GlobalTrailUsage[];
  summary: {
    totalUsers: number;
    totalRides: number;
    totalDistanceKm: number;
    totalDurationHours: number;
    totalElevationM: number;
    totalTrails: number;
    averageRideDistanceKm: number;
    averageRideDurationMinutes: number;
  };
}

/**
 * Fetch all global analytics data and structure it for export
 */
export const fetchGlobalAnalyticsForExport = async (): Promise<GlobalAnalyticsExport> => {
  console.log('[AnalyticsDownload] Fetching global analytics data...');
  
  const [globalStats, userStats, trailUsage] = await Promise.all([
    getGlobalRideStats(),
    getUserRideStats(),
    getGlobalTrailUsage(),
  ]);

  const now = new Date();
  const exportData: GlobalAnalyticsExport = {
    exportDate: now.toISOString(),
    exportTimestamp: now.getTime(),
    globalStats,
    userStats,
    trailUsage,
    summary: {
      totalUsers: globalStats.uniqueUsers,
      totalRides: globalStats.totalRides,
      totalDistanceKm: globalStats.totalDistance / 1000,
      totalDurationHours: globalStats.totalDuration / (1000 * 60 * 60),
      totalElevationM: globalStats.totalElevation,
      totalTrails: trailUsage.length,
      averageRideDistanceKm: globalStats.totalRides > 0 
        ? (globalStats.totalDistance / 1000) / globalStats.totalRides 
        : 0,
      averageRideDurationMinutes: globalStats.totalRides > 0
        ? (globalStats.totalDuration / (1000 * 60)) / globalStats.totalRides
        : 0,
    },
  };

  console.log('[AnalyticsDownload] Data fetched successfully:', {
    users: exportData.summary.totalUsers,
    rides: exportData.summary.totalRides,
    trails: exportData.summary.totalTrails,
  });

  return exportData;
};

/**
 * Export global analytics data as Excel file
 */
export const exportGlobalAnalyticsExcel = async (): Promise<string> => {
  try {
    const data = await fetchGlobalAnalyticsForExport();
    const workbook = XLSX.utils.book_new();
    
    // Summary Sheet
    const summaryData = [
      ['Global Trail Analytics Report'],
      ['Generated on:', new Date(data.exportDate).toLocaleString()],
      [''],
      ['GLOBAL SUMMARY'],
      ['Metric', 'Value'],
      ['Total Users', data.summary.totalUsers],
      ['Total Rides', data.summary.totalRides],
      ['Total Distance (km)', data.summary.totalDistanceKm.toFixed(2)],
      ['Total Duration (hours)', data.summary.totalDurationHours.toFixed(2)],
      ['Total Elevation (m)', data.summary.totalElevationM.toFixed(0)],
      ['Total Trails', data.summary.totalTrails],
      ['Average Ride Distance (km)', data.summary.averageRideDistanceKm.toFixed(2)],
      ['Average Ride Duration (min)', data.summary.averageRideDurationMinutes.toFixed(1)],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // User Statistics Sheet (Leaderboard)
    const userStatsData = [
      ['Rank', 'User ID', 'User Name', 'Ride Count', 'Total Distance (km)', 'Total Duration (hours)', 'Average Distance (km)'],
      ...data.userStats.map((user, index) => [
        index + 1,
        user.userId,
        user.userName || `Rider ${user.userId.slice(0, 8)}`,
        user.rideCount,
        (user.totalDistance / 1000).toFixed(2),
        (user.totalDuration / (1000 * 60 * 60)).toFixed(2),
        (user.averageDistance / 1000).toFixed(2),
      ])
    ];
    const userStatsSheet = XLSX.utils.aoa_to_sheet(userStatsData);
    XLSX.utils.book_append_sheet(workbook, userStatsSheet, 'User Leaderboard');

    // Trail Usage Sheet
    const trailUsageData = [
      ['Rank', 'Trail ID', 'Trail Name', 'Total Distance (km)', 'Ride Count', 'Unique Users', 'Average Distance (km)'],
      ...data.trailUsage.map((trail, index) => [
        index + 1,
        trail.trailId,
        trail.trailName,
        (trail.totalDistance / 1000).toFixed(2),
        trail.rideCount,
        trail.uniqueUsers,
        (trail.averageDistance / 1000).toFixed(2),
      ])
    ];
    const trailUsageSheet = XLSX.utils.aoa_to_sheet(trailUsageData);
    XLSX.utils.book_append_sheet(workbook, trailUsageSheet, 'Trail Usage');

    // Top 10 Users Detail Sheet
    const top10Data = [
      ['Top 10 Riders - Detailed Analysis'],
      [''],
      ['Rank', 'User Name', 'Rides', 'Distance (km)', 'Duration (hrs)', 'Avg Distance (km)', 'Rides/Day'],
      ...data.userStats.slice(0, 10).map((user, index) => [
        index + 1,
        user.userName || `Rider ${user.userId.slice(0, 8)}`,
        user.rideCount,
        (user.totalDistance / 1000).toFixed(2),
        (user.totalDuration / (1000 * 60 * 60)).toFixed(2),
        (user.averageDistance / 1000).toFixed(2),
        (user.rideCount / 30).toFixed(2), // Assuming ~30 days average
      ])
    ];
    const top10Sheet = XLSX.utils.aoa_to_sheet(top10Data);
    XLSX.utils.book_append_sheet(workbook, top10Sheet, 'Top 10 Details');

    // Top 10 Trails Detail Sheet
    const topTrailsData = [
      ['Top 10 Trails - Detailed Analysis'],
      [''],
      ['Rank', 'Trail Name', 'Total Rides', 'Total Distance (km)', 'Unique Riders', 'Avg Distance (km)', 'Popularity %'],
      ...data.trailUsage.slice(0, 10).map((trail, index) => {
        const totalRides = data.trailUsage.reduce((sum, t) => sum + t.rideCount, 0);
        const popularity = totalRides > 0 ? ((trail.rideCount / totalRides) * 100).toFixed(1) : '0.0';
        return [
          index + 1,
          trail.trailName,
          trail.rideCount,
          (trail.totalDistance / 1000).toFixed(2),
          trail.uniqueUsers,
          (trail.averageDistance / 1000).toFixed(2),
          popularity,
        ];
      })
    ];
    const topTrailsSheet = XLSX.utils.aoa_to_sheet(topTrailsData);
    XLSX.utils.book_append_sheet(workbook, topTrailsSheet, 'Top 10 Trails');

    // Community Insights Sheet
    const avgRidesPerUser = data.summary.totalUsers > 0 
      ? (data.summary.totalRides / data.summary.totalUsers).toFixed(1) 
      : '0.0';
    const avgDistancePerUser = data.summary.totalUsers > 0
      ? (data.summary.totalDistanceKm / data.summary.totalUsers).toFixed(2)
      : '0.00';
    const avgTrailsPerUser = data.summary.totalUsers > 0
      ? (data.trailUsage.length / data.summary.totalUsers).toFixed(2)
      : '0.00';

    const insightsData = [
      ['Community Insights & Analytics'],
      [''],
      ['PARTICIPATION METRICS'],
      ['Metric', 'Value', 'Notes'],
      ['Average Rides per User', avgRidesPerUser, 'Total rides divided by users'],
      ['Average Distance per User (km)', avgDistancePerUser, 'Total distance divided by users'],
      ['Trail Diversity Index', avgTrailsPerUser, 'Average trails per user'],
      [''],
      ['ENGAGEMENT LEVELS'],
      ['Category', 'Count', 'Percentage'],
      ['Highly Active Users (10+ rides)', data.userStats.filter(u => u.rideCount >= 10).length, `${((data.userStats.filter(u => u.rideCount >= 10).length / data.summary.totalUsers) * 100).toFixed(1)}%`],
      ['Moderate Users (5-9 rides)', data.userStats.filter(u => u.rideCount >= 5 && u.rideCount < 10).length, `${((data.userStats.filter(u => u.rideCount >= 5 && u.rideCount < 10).length / data.summary.totalUsers) * 100).toFixed(1)}%`],
      ['Casual Users (1-4 rides)', data.userStats.filter(u => u.rideCount < 5).length, `${((data.userStats.filter(u => u.rideCount < 5).length / data.summary.totalUsers) * 100).toFixed(1)}%`],
      [''],
      ['TRAIL METRICS'],
      ['Most Popular Trail', data.trailUsage[0]?.trailName || 'N/A', `${data.trailUsage[0]?.rideCount || 0} rides`],
      ['Longest Trail Distance', data.trailUsage[0] ? `${(data.trailUsage[0].totalDistance / 1000).toFixed(2)} km` : 'N/A', data.trailUsage[0]?.trailName || 'N/A'],
      ['Most Riders on Single Trail', Math.max(...data.trailUsage.map(t => t.uniqueUsers), 0), 'Maximum unique riders'],
    ];
    const insightsSheet = XLSX.utils.aoa_to_sheet(insightsData);
    XLSX.utils.book_append_sheet(workbook, insightsSheet, 'Insights');

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const file = new File(Paths.document, `GlobalAnalytics_${timestamp}.xlsx`);
    
    // Write Excel file
    const base64 = XLSX.write(workbook, { type: 'base64' });
    file.write(base64, { encoding: 'base64' });

    console.log('[AnalyticsDownload] Excel file created:', file.uri);
    return file.uri;
  } catch (error) {
    console.error('[AnalyticsDownload] Error exporting Excel:', error);
    throw error;
  }
};

/**
 * Export global analytics data as JSON file (for developers/API use)
 */
export const exportGlobalAnalyticsJSON = async (): Promise<string> => {
  try {
    const data = await fetchGlobalAnalyticsForExport();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `global-analytics-${timestamp}.json`;
    
    const file = new File(Paths.document, filename);
    const jsonString = JSON.stringify(data, null, 2);
    file.write(jsonString);

    console.log('[AnalyticsDownload] JSON file created:', file.uri);
    return file.uri;
  } catch (error) {
    console.error('[AnalyticsDownload] Error exporting JSON:', error);
    throw error;
  }
};

/**
 * Export global analytics data as CSV file
 */
export const exportGlobalAnalyticsCSV = async (): Promise<string> => {
  try {
    const data = await fetchGlobalAnalyticsForExport();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `global-analytics-${timestamp}.csv`;
    
    const file = new File(Paths.document, filename);

    let csv = '# Global Trail Analytics Export\n';
    csv += `# Export Date: ${data.exportDate}\n\n`;
    csv += '# SUMMARY\n';
    csv += 'Metric,Value\n';
    csv += `Total Users,${data.summary.totalUsers}\n`;
    csv += `Total Rides,${data.summary.totalRides}\n`;
    csv += `Total Distance (km),${data.summary.totalDistanceKm.toFixed(2)}\n`;
    csv += `Total Duration (hours),${data.summary.totalDurationHours.toFixed(2)}\n`;
    csv += `Total Elevation (m),${data.summary.totalElevationM.toFixed(0)}\n`;
    csv += `Total Trails,${data.summary.totalTrails}\n`;
    csv += `Average Ride Distance (km),${data.summary.averageRideDistanceKm.toFixed(2)}\n`;
    csv += `Average Ride Duration (minutes),${data.summary.averageRideDurationMinutes.toFixed(1)}\n\n`;

    csv += '# USER STATISTICS\n';
    csv += 'Rank,User ID,User Name,Ride Count,Total Distance (km),Total Duration (hours),Average Distance (km)\n';
    data.userStats.forEach((user, index) => {
      const userName = user.userName || `Rider ${user.userId.slice(0, 8)}`;
      csv += `${index + 1},${user.userId},"${userName}",${user.rideCount},`;
      csv += `${(user.totalDistance / 1000).toFixed(2)},`;
      csv += `${(user.totalDuration / (1000 * 60 * 60)).toFixed(2)},`;
      csv += `${(user.averageDistance / 1000).toFixed(2)}\n`;
    });

    csv += '\n# TRAIL USAGE STATISTICS\n';
    csv += 'Rank,Trail ID,Trail Name,Total Distance (km),Ride Count,Unique Users,Average Distance (km)\n';
    data.trailUsage.forEach((trail, index) => {
      csv += `${index + 1},${trail.trailId},"${trail.trailName}",`;
      csv += `${(trail.totalDistance / 1000).toFixed(2)},${trail.rideCount},${trail.uniqueUsers},`;
      csv += `${(trail.averageDistance / 1000).toFixed(2)}\n`;
    });

    file.write(csv);

    console.log('[AnalyticsDownload] CSV file created:', file.uri);
    return file.uri;
  } catch (error) {
    console.error('[AnalyticsDownload] Error exporting CSV:', error);
    throw error;
  }
};

/**
 * Download and share global analytics data
 * @param format - 'excel', 'json', or 'csv'
 */
export const downloadAndShareGlobalAnalytics = async (
  format: 'excel' | 'json' | 'csv' = 'excel'
): Promise<void> => {
  try {
    console.log(`[AnalyticsDownload] Starting ${format.toUpperCase()} export...`);
    
    let filepath: string;
    let mimeType: string;
    
    switch (format) {
      case 'excel':
        filepath = await exportGlobalAnalyticsExcel();
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      case 'json':
        filepath = await exportGlobalAnalyticsJSON();
        mimeType = 'application/json';
        break;
      case 'csv':
        filepath = await exportGlobalAnalyticsCSV();
        mimeType = 'text/csv';
        break;
    }

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(filepath, {
        mimeType,
        dialogTitle: `Share Global Analytics (${format.toUpperCase()})`,
        UTI: format === 'excel' ? 'com.microsoft.excel.xlsx' : undefined,
      });
      console.log('[AnalyticsDownload] File shared successfully');
    } else {
      console.warn('[AnalyticsDownload] Sharing not available on this platform');
      throw new Error('Sharing is not available on this device');
    }
  } catch (error) {
    console.error('[AnalyticsDownload] Error downloading and sharing:', error);
    throw error;
  }
};

/**
 * Get the size of the analytics data (for UI display)
 */
export const getAnalyticsDataSize = async (): Promise<{
  users: number;
  rides: number;
  trails: number;
  estimatedSizeKB: number;
}> => {
  try {
    const data = await fetchGlobalAnalyticsForExport();
    const jsonString = JSON.stringify(data);
    const estimatedSizeKB = jsonString.length / 1024;

    return {
      users: data.userStats.length,
      rides: data.globalStats.totalRides,
      trails: data.trailUsage.length,
      estimatedSizeKB,
    };
  } catch (error) {
    console.error('[AnalyticsDownload] Error getting data size:', error);
    return {
      users: 0,
      rides: 0,
      trails: 0,
      estimatedSizeKB: 0,
    };
  }
};

/**
 * Clean up old analytics export files
 */
export const cleanupOldAnalyticsFiles = async (): Promise<void> => {
  try {
    const directory = Paths.document;
    const items = directory.list();
    
    const analyticsFiles = items.filter((item): item is File => 
      item instanceof File && (
        item.name.startsWith('GlobalAnalytics_') ||
        item.name.startsWith('global-analytics-')
      )
    );
    
    // Keep only the last 5 exports
    if (analyticsFiles.length > 5) {
      const filesToDelete = analyticsFiles
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, analyticsFiles.length - 5);
      
      for (const file of filesToDelete) {
        file.delete();
      }
      
      console.log(`[AnalyticsDownload] Cleaned up ${filesToDelete.length} old files`);
    }
  } catch (error) {
    console.error('[AnalyticsDownload] Error cleaning up old files:', error);
  }
};