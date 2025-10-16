import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIREBASE_ENABLED, auth, app } from './firebase';
import { COLLECTIONS, Converters, newReport, type ReportDTO, type ReportType, type ReportSeverity, type ReportStatus } from './Data';
import { getFirestore, collection, doc, setDoc, getDocs, query, orderBy as fsOrderBy, where as fsWhere, limit as fsLimit, deleteDoc, updateDoc } from 'firebase/firestore';

export type Report = {
  id: string;
  userId: string;
  type: ReportType;
  severity: ReportSeverity;
  status: ReportStatus;
  title: string;
  description?: string;
  location?: { latitude: number; longitude: number };
  photoUrl?: string;
  rideId?: string;
  createdAt: number;
  updatedAt: number;
};

const storageKey = (uid?: string) => `REPORTS_${uid || 'local'}`;

/**
 * Save a new trail report (user-specific)
 */
export async function saveReport(report: Omit<Report, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) {
  const uid = FIREBASE_ENABLED ? auth?.currentUser?.uid : undefined;
  const key = storageKey(uid);
  const existing = await AsyncStorage.getItem(key);
  const list: Report[] = existing ? JSON.parse(existing) : [];
  
  const ts = Date.now();
  const newReportObj: Report = {
    ...report,
    id: `${ts}_${Math.random().toString(36).slice(2, 8)}`,
    userId: uid || 'local',
    createdAt: ts,
    updatedAt: ts,
  };
  
  list.push(newReportObj);
  await AsyncStorage.setItem(key, JSON.stringify(list));

  // Persist to Firestore user's subcollection when enabled and signed in
  try {
    if (FIREBASE_ENABLED && app && auth?.currentUser?.uid) {
      const db = getFirestore(app as any);
      const dto: ReportDTO = newReport({
        id: newReportObj.id,
        type: newReportObj.type,
        title: newReportObj.title,
        severity: newReportObj.severity,
        status: newReportObj.status,
        description: newReportObj.description,
        location: newReportObj.location,
        photoUrl: newReportObj.photoUrl,
        rideId: newReportObj.rideId,
        createdAt: newReportObj.createdAt,
        updatedAt: newReportObj.updatedAt,
      });
      // Store in user's subcollection: users/{uid}/reports/{reportId}
      const ref = doc(collection(db, COLLECTIONS.users, auth.currentUser.uid, COLLECTIONS.reports), dto.id).withConverter(Converters?.report as any);
      await setDoc(ref, dto as any, { merge: false });
    }
  } catch (e) {
    console.warn('Failed to save report to Firestore:', e);
  }
  
  return newReportObj;
}

/**
 * Get all reports for the current user
 */
export async function getMyReports(filters?: { status?: ReportStatus; limit?: number }) {
  const uid = FIREBASE_ENABLED ? auth?.currentUser?.uid : undefined;
  
  if (!uid) {
    // If no user, return local reports only
    const key = storageKey();
    const existing = await AsyncStorage.getItem(key);
    const list: Report[] = existing ? JSON.parse(existing) : [];
    return list.sort((a, b) => b.createdAt - a.createdAt);
  }
  
  // Prefer Firestore when available (user's subcollection)
  if (FIREBASE_ENABLED && app) {
    try {
      const db = getFirestore(app as any);
      const reportsCol = collection(db, COLLECTIONS.users, uid, COLLECTIONS.reports).withConverter(Converters?.report as any);
      
      let q = query(reportsCol, fsOrderBy('createdAt', 'desc'));
      
      if (filters?.status) {
        q = query(reportsCol, fsWhere('status', '==', filters.status), fsOrderBy('createdAt', 'desc'));
      }
      
      if (filters?.limit) {
        q = query(q, fsLimit(filters.limit));
      }
      
      const snap = await getDocs(q);
      const reports: Report[] = snap.docs.map(d => {
        const r = d.data() as ReportDTO;
        return {
          id: r.id,
          userId: r.userId,
          type: r.type,
          severity: r.severity,
          status: r.status,
          title: r.title,
          description: r.description,
          location: r.location,
          photoUrl: r.photoUrl,
          rideId: r.rideId,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        } as Report;
      });
      
      return reports;
    } catch (e) {
      console.warn('Failed to load reports from Firestore, falling back to local:', e);
    }
  }
  
  // Local fallback
  const key = storageKey(uid);
  const existing = await AsyncStorage.getItem(key);
  let list: Report[] = existing ? JSON.parse(existing) : [];
  
  if (filters?.status) {
    list = list.filter(r => r.status === filters.status);
  }
  
  list = list.sort((a, b) => b.createdAt - a.createdAt);
  
  if (filters?.limit) {
    list = list.slice(0, filters.limit);
  }
  
  return list;
}

/**
 * Update report status (e.g., mark as reviewed or resolved)
 */
export async function updateReportStatus(reportId: string, status: ReportStatus) {
  const uid = FIREBASE_ENABLED ? auth?.currentUser?.uid : undefined;
  const key = storageKey(uid);
  const existing = await AsyncStorage.getItem(key);
  const list: Report[] = existing ? JSON.parse(existing) : [];
  
  const index = list.findIndex(r => r.id === reportId);
  if (index >= 0) {
    list[index].status = status;
    list[index].updatedAt = Date.now();
    await AsyncStorage.setItem(key, JSON.stringify(list));
  }

  // Update in Firestore if enabled
  try {
    if (FIREBASE_ENABLED && app && uid) {
      const db = getFirestore(app as any);
      const ref = doc(db, COLLECTIONS.users, uid, COLLECTIONS.reports, reportId).withConverter(Converters?.report as any);
      await updateDoc(ref, { 
        status, 
        updatedAt: Date.now()
      } as any);
    }
  } catch (e) {
    console.warn('Failed to update report in Firestore:', e);
  }
}

/**
 * Delete a report
 */
export async function deleteReport(reportId: string) {
  const uid = FIREBASE_ENABLED ? auth?.currentUser?.uid : undefined;
  const key = storageKey(uid);
  const existing = await AsyncStorage.getItem(key);
  const list: Report[] = existing ? JSON.parse(existing) : [];
  
  const filtered = list.filter(r => r.id !== reportId);
  await AsyncStorage.setItem(key, JSON.stringify(filtered));

  // Delete from Firestore if enabled
  try {
    if (FIREBASE_ENABLED && app && uid) {
      const db = getFirestore(app as any);
      const ref = doc(db, COLLECTIONS.users, uid, COLLECTIONS.reports, reportId);
      await deleteDoc(ref);
    }
  } catch (e) {
    console.warn('Failed to delete report from Firestore:', e);
  }
}

/**
 * Get a single report by ID
 */
export async function getReportById(reportId: string): Promise<Report | null> {
  const reports = await getMyReports();
  return reports.find(r => r.id === reportId) || null;
}

/**
 * Get reports by ride ID
 */
export async function getReportsByRideId(rideId: string): Promise<Report[]> {
  const allReports = await getMyReports();
  return allReports.filter(r => r.rideId === rideId);
}
