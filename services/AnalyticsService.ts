import { Paths, File, Directory } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';

// (Farley, 2022)
export interface ReportData {
  timeSlot: 'day' | 'week' | 'month' | '3month' | '6month' | '1year';
  userStats: {
    totalRides: number;
    totalDistance: number;
    favoriteTrail: string;
    hoursRidden: number;
    trailsCompleted: number;
    avgSpeed: number;
    lastRide: string;
  };
  chartData: {
    rideFrequency: Array<{ value: number; label: string; frontColor: string }>;
    trailPopularity: Array<{ value: number; label: string; color: string }>;
    weeklyDistance: Array<{ value: number; dataPointText: string }>;
  };
  generatedDate: string;
}

// (Farley, 2022)
export class ReportDownload {
  
  static async generateExcelReport(data: ReportData): Promise<string> {
    const workbook = XLSX.utils.book_new();
    
    // Summary Sheet
    const summaryData = [
      ['Ride Analytics Report'],
      ['Generated on:', new Date(data.generatedDate).toLocaleDateString()],
      ['Time Period:', this.getTimeSlotLabel(data.timeSlot)],
      [''],
      ['Summary Statistics'],
      ['Total Rides', data.userStats.totalRides],
      ['Total Distance (km)', data.userStats.totalDistance],
      ['Hours Ridden', data.userStats.hoursRidden],
      ['Trails Completed', data.userStats.trailsCompleted],
      ['Average Speed (km/h)', data.userStats.avgSpeed],
      ['Favorite Trail', data.userStats.favoriteTrail],
      ['Last Ride', data.userStats.lastRide],
    ];

    // (Farley, 2022)
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Ride Frequency Sheet
    const frequencyData = [
      ['Period', 'Rides'],
      ...data.chartData.rideFrequency.map(item => [item.label, item.value])
    ];
    const frequencySheet = XLSX.utils.aoa_to_sheet(frequencyData);
    XLSX.utils.book_append_sheet(workbook, frequencySheet, 'Ride Frequency');

    // Trail Popularity Sheet
    const popularityData = [
      ['Trail', 'Percentage', 'Color'],
      ...data.chartData.trailPopularity.map(item => [item.label, `${item.value}%`, item.color])
    ];
    const popularitySheet = XLSX.utils.aoa_to_sheet(popularityData);
    XLSX.utils.book_append_sheet(workbook, popularitySheet, 'Trail Popularity');

    // Distance Data Sheet
    const distanceData = [
      ['Period', 'Distance (km)'],
      ...data.chartData.weeklyDistance.map(item => [
        item.dataPointText.replace('km', ''), 
        parseInt(item.dataPointText.replace('km', ''))
      ])
    ];
    const distanceSheet = XLSX.utils.aoa_to_sheet(distanceData);
    XLSX.utils.book_append_sheet(workbook, distanceSheet, 'Distance Data');

    // Detailed Analysis Sheet
    const analysisData = [
      ['Detailed Analysis'],
      [''],
      ['Performance Metrics'],
      ['Metric', 'Value', 'Notes'],
      ['Rides per Day', (data.userStats.totalRides / this.getDaysInPeriod(data.timeSlot)).toFixed(1), 'Average'],
      ['Distance per Ride', (data.userStats.totalDistance / data.userStats.totalRides).toFixed(1), 'km'],
      ['Time per Ride', (data.userStats.hoursRidden / data.userStats.totalRides).toFixed(1), 'hours'],
      [''],
      ['Goals & Achievements'],
      ['Total Distance Goal', '500 km', 'Target for period'],
      ['Progress', `${((data.userStats.totalDistance / 500) * 100).toFixed(1)}%`, 'Towards goal'],
      ['Trails Goal', '15 trails', 'Target for period'],
      ['Trails Progress', `${((data.userStats.trailsCompleted / 15) * 100).toFixed(1)}%`, 'Towards goal'],
    ];
    const analysisSheet = XLSX.utils.aoa_to_sheet(analysisData);
    XLSX.utils.book_append_sheet(workbook, analysisSheet, 'Analysis');

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const file = new File(Paths.document, `RideAnalytics_${data.timeSlot}_${timestamp}.xlsx`);
    
    // Write Excel file
    const base64 = XLSX.write(workbook, { type: 'base64' });
    file.write(base64, { encoding: 'base64' });

    return file.uri;
  }

  // (Farley, 2022)
  static async generateAndShareReport(data: ReportData): Promise<void> {
    try {
      const filename = await this.generateExcelReport(data);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filename, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Share Ride Analytics Report',
          UTI: 'com.microsoft.excel.xlsx'
        });
      } else {
        throw new Error('Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Error generating/sharing report:', error);
      throw error;
    }
  }

  private static getTimeSlotLabel(timeSlot: string): string {
    const labels: Record<string, string> = {
      'day': 'Today',
      'week': 'This Week',
      'month': 'This Month',
      '3month': 'Last 3 Months',
      '6month': 'Last 6 Months',
      '1year': 'This Year'
    };
    return labels[timeSlot] || timeSlot;
  }

  private static getDaysInPeriod(timeSlot: string): number {
    const days: Record<string, number> = {
      'day': 1,
      'week': 7,
      'month': 30,
      '3month': 90,
      '6month': 180,
      '1year': 365
    };
    return days[timeSlot] || 30;
  }

  static generateTextSummary(data: ReportData): string {
    const period = this.getTimeSlotLabel(data.timeSlot);
    const ridesPerDay = (data.userStats.totalRides / this.getDaysInPeriod(data.timeSlot)).toFixed(1);
    const avgDistance = (data.userStats.totalDistance / data.userStats.totalRides).toFixed(1);
    
    return `Ride Analytics Summary (${period})

Performance Overview:
- Total Rides: ${data.userStats.totalRides}
- Total Distance: ${data.userStats.totalDistance} km
- Time Spent: ${data.userStats.hoursRidden} hours
- Average Speed: ${data.userStats.avgSpeed} km/h
- Rides per Day: ${ridesPerDay}
- Distance per Ride: ${avgDistance} km

Trail Statistics:
- Trails Completed: ${data.userStats.trailsCompleted}
- Favorite Trail: ${data.userStats.favoriteTrail}
- Last Ride: ${data.userStats.lastRide}

Generated on: ${new Date(data.generatedDate).toLocaleString()}`;
  }

static async saveReportLocally(data: ReportData): Promise<string> {
  try {
    const filename = await this.generateExcelReport(data);

    // Request permission
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Permission to access media library was denied');
    }

    // Save to Downloads or another accessible directory
    const asset = await MediaLibrary.createAssetAsync(filename);
    const album = await MediaLibrary.getAlbumAsync('Download');

    if (album == null) {
      await MediaLibrary.createAlbumAsync('Download', asset, false);
    } else {
      await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
    }

    return filename;
  } catch (error) {
    console.error('Error saving report to public storage:', error);
    throw error;
  }
}


  static async getReportFileSize(data: ReportData): Promise<number> {
    try {
      const filename = await this.generateExcelReport(data);
      const file = new File(filename);
      return file.exists ? (file.info().size || 0) : 0;
    } catch (error) {
      console.error('Error getting file size:', error);
      return 0;
    }
  }

  
  static async cleanupOldReports(): Promise<void> {
    try {
      const directory = Paths.document;
      
      const items = directory.list();
      const reportFiles = items.filter((item): item is File => 
        item instanceof File && item.name.startsWith('RideAnalytics_')
      );
      
      // Keep only the last 5 reports
      if (reportFiles.length > 5) {
        const filesToDelete = reportFiles
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(0, reportFiles.length - 5);
        
        for (const file of filesToDelete) {
          file.delete();
        }
      }
    } catch (error) {
      console.error('Error cleaning up old reports:', error);
    }
  }
}
//-----------------
//References:
//-----------------
// Farley, C. (2022) 
// Generate an Excel File with Multiple Worksheets and Formula and Save to Files for Expo React Native, YouTube. 
// Available at: https://www.youtube.com/watch?v=iH9cMDfysOw&t=25s 
// (Accessed: 04 June 2025). 

// (Farley, 2022)
