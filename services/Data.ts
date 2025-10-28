// Centralized app data models & (optional) Firestore converters.
// Keep this file framework-light so types can also be imported in non-Firebase contexts.
// NOTE: Only use converters if FIREBASE_ENABLED is true (see firebase).

import {
	getFirestore,
	doc,
	collection,
	setDoc,
	getDoc,
	getDocs,
	query as fsQuery,
	where as fsWhere,
	orderBy as fsOrderBy,
	limit as fsLimit,
	writeBatch,
	runTransaction,
	deleteDoc,
	type QueryDocumentSnapshot,
	type FirestoreDataConverter,
	type SnapshotOptions,
	type DocumentReference,
	type Query,
} from 'firebase/firestore';
import { FIREBASE_ENABLED, auth, app } from './firebase';
import { User } from 'firebase/auth';

// ---------- Firestore Helpers ---------- //

/**
 * Gets a typed document reference with a converter.
 * @param collectionPath The path to the collection.
 * @param docId The document ID.
 * @param converter The FirestoreDataConverter.
 * @returns A DocumentReference for the typed document.
 */
function getTypedDocRef<T>(collectionPath: string, docId: string, converter: FirestoreDataConverter<T>) {
	if (!FIREBASE_ENABLED || !app) throw new Error('Firebase is not enabled.');
	const db = getFirestore(app);
	return doc(db, collectionPath, docId).withConverter(converter);
}

/**
 * Creates a user profile if it doesn't exist.
 * @param user The Firebase Auth user object.
 * @returns The user's profile, either existing or newly created.
 */
export async function getOrCreateUserProfile(user: User): Promise<UserProfile> {
	const userRef = getTypedDocRef<UserProfile>('users', user.uid, userProfileConverter);
	const userSnap = await getDoc(userRef);

	if (userSnap.exists()) {
		const data = userSnap.data();
		if (!data.role || !data.status) {
			const patched: UserProfile = {
				...data,
				role: data.role ?? 'member',
				status: data.status ?? 'approved',
				updatedAt: Date.now(),
			};
			await setDoc(userRef, patched);
			return patched;
		}
		return data;
	} else {
		const newUserProfile: UserProfile = {
			uid: user.uid,
			email: user.email || undefined,
			displayName: user.displayName || undefined,
			photoURL: user.photoURL || undefined,
			role: 'member',
			status: 'pending',
			createdAt: Date.now(),
			updatedAt: Date.now(),
			totalRides: 0,
			totalDistanceM: 0,
			totalDurationMs: 0,
			points: 0,
		};
		await setDoc(userRef, newUserProfile);
		return newUserProfile;
	}
}

// ---------- Core Primitive Types ---------- //

export type TimestampMs = number; // epoch millis
export type UUID = string;

// ---------- User Profile ---------- //

export interface UserProfile {
	uid: string;            // firebase auth uid
	displayName?: string;
	email?: string;
	photoURL?: string;
	// Role Based Access Control
	role?: 'admin' | 'member';
	status?: 'pending' | 'approved' | 'disapproved';
	createdAt: TimestampMs;
	updatedAt: TimestampMs;
	// Aggregate ride stats (denormalized for fast profile display)
	totalRides: number;
	totalDistanceM: number; // meters
	totalDurationMs: number;
	points: number;         // gamified points (rides*10 + km, etc.)
}

// ---------- Ride / Tracking ---------- //

export interface RidePointDTO {
	lat: number;
	lng: number;
	alt: number;
	t: number; // timestamp ms
}

export interface RideDTO {
	id: UUID;
	userId: string;
	horseId?: string | null;
	horseName?: string | null;
	startTime: TimestampMs;
	endTime: TimestampMs;
	totalDistance: number;      // meters
	elevationGain: number;      // meters
	duration: number;           // ms
	path: RidePointDTO[];       // simplified path list
	routeDistances?: Record<string, number>; // per predefined route id (meters)
	createdAt: TimestampMs;
	updatedAt: TimestampMs;
	// Optional summary fields (can be recalculated if missing)
	avgSpeedMps?: number;
	maxSpeedMps?: number;
}

// ---------- Horses ---------- //

export interface HorseDTO {
	id: UUID;
	userId: string;        // owner
	name: string;
	breed?: string;
	age?: number;
	notes?: string;
	createdAt: TimestampMs;
	updatedAt: TimestampMs;
	retired?: boolean;
}

// ---------- Achievements ---------- //

export interface AchievementDTO {
	id: string;               // stable id e.g. FIRST_RIDE
	userId: string;
	earnedAt: TimestampMs;
	meta?: Record<string, any>; // optional additional info
	createdAt: TimestampMs;     // duplicate of earnedAt (for uniform indexing)
	updatedAt: TimestampMs;
}

// ---------- SOS Alert / Emergency ---------- //

export interface SosAlertDTO {
	id: UUID;
	userId: string;
	createdAt: TimestampMs;
	resolvedAt?: TimestampMs;
	status: 'open' | 'resolved' | 'cancelled';
	lastLocation?: { lat: number; lng: number }; // last known location
	notes?: string;
}

// ---------- Notifications (local or remote) ---------- //

export interface NotificationPrefDTO {
	userId: string;
	allowPush: boolean;
	allowEmail: boolean;
	createdAt: TimestampMs;
	updatedAt: TimestampMs;
}

// ---------- Sightings (users/{uid}/sightings) ---------- //

export interface SightingDTO {
	id: UUID;
	userId: string;
	animalName: string; // e.g. "dog"
	description?: string;
	location: { latitude: number; longitude: number };
	photoUrl?: string;
	timestamp: string; 
	createdAt: TimestampMs;
	updatedAt: TimestampMs;
}

// ---------- Obstacles (users/{uid}/obstacles) ---------- //

export type ObstacleType = 'pothole' | 'debris' | 'animal' | 'tree' | 'water' | 'other';
export type ObstacleSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ObstacleStatus = 'active' | 'resolved' | 'verified' | 'disputed';

export interface ObstacleDTO {
	id: UUID;
	userId: string;
	userName?: string; // Display name of user who marked the obstacle
	type: ObstacleType;
	severity: ObstacleSeverity;
	status: ObstacleStatus;
	title: string;
	description?: string;
	location: { latitude: number; longitude: number };
	photoUrl?: string;
	reportedAt: TimestampMs;
	resolvedAt?: TimestampMs;
	verifiedBy?: string[]; // array of user IDs who verified this obstacle
	createdAt: TimestampMs;
	updatedAt: TimestampMs;
}

// ---------- Trail Reports (users/{uid}/reports) ---------- //

export type ReportType = 'trail_damage' | 'safety_hazard' | 'maintenance_needed' | 'illegal_activity' | 'wildlife_concern' | 'other';
export type ReportSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

export interface ReportDTO {
	id: UUID;
	userId: string;
	type: ReportType;
	severity: ReportSeverity;
	status: ReportStatus;
	title: string;
	description?: string;
	location?: { latitude: number; longitude: number };
	photoUrl?: string;
	rideId?: string; // Associated ride if report was made during a ride
	trailId?: string;
	trailName?: string;
	createdAt: TimestampMs;
	updatedAt: TimestampMs;
}

// ---------- Utility Creators ---------- //

const now = () => Date.now();
const currentUid = () => (FIREBASE_ENABLED ? auth?.currentUser?.uid : undefined);

export function newUserProfile(partial: Partial<UserProfile> & { uid: string }): UserProfile {
	const ts = now();
	return {
		displayName: '',
		email: '',
		photoURL: undefined,
		role: 'member',
		status: 'pending',
		totalRides: 0,
		totalDistanceM: 0,
		totalDurationMs: 0,
		points: 0,
		createdAt: ts,
		updatedAt: ts,
		...partial,
	} as UserProfile;
}

export function newRide(partial: Partial<RideDTO> & { id: UUID; startTime: number }): RideDTO {
	const ts = now();
	const end = partial.endTime ?? partial.startTime ?? ts;
	return {
		userId: currentUid() || 'local',
		horseId: null,
		horseName: null,
		endTime: end,
		totalDistance: 0,
		elevationGain: 0,
		duration: end - partial.startTime,
		path: [],
		createdAt: ts,
		updatedAt: ts,
		...partial,
	} as RideDTO;
}

export function newHorse(partial: Partial<HorseDTO> & { id: UUID; name: string }): HorseDTO {
	const ts = now();
	return {
		userId: currentUid() || 'local',
		breed: undefined,
		age: undefined,
		notes: undefined,
		retired: false,
		createdAt: ts,
		updatedAt: ts,
		...partial,
	} as HorseDTO;
}

export function newAchievement(partial: Partial<AchievementDTO> & { id: string }): AchievementDTO {
	const ts = now();
	return {
		userId: currentUid() || 'local',
		earnedAt: ts,
		createdAt: ts,
		updatedAt: ts,
		...partial,
	} as AchievementDTO;
}

export function newSosAlert(partial: Partial<SosAlertDTO> & { id: UUID }): SosAlertDTO {
	const ts = now();
	return {
		userId: currentUid() || 'local',
		createdAt: ts,
		status: 'open',
		...partial,
	} as SosAlertDTO;
}

export function newNotificationPrefs(partial: Partial<NotificationPrefDTO> & { userId: string }): NotificationPrefDTO {
	const ts = now();
	return {
		allowPush: true,
		allowEmail: false,
		createdAt: ts,
		updatedAt: ts,
		...partial,
	} as NotificationPrefDTO;
}

export function newSighting(partial: Partial<SightingDTO> & { id: UUID; animalName: string; location: { latitude: number; longitude: number } }): SightingDTO {
	const ts = now();
	return {
		userId: currentUid() || 'local',
		description: undefined,
		photoUrl: undefined,
		timestamp: new Date(ts).toISOString(),
		createdAt: ts,
		updatedAt: ts,
		...partial,
	} as SightingDTO;
}

export function newObstacle(partial: Partial<ObstacleDTO> & { id: UUID; type: ObstacleType; title: string; location: { latitude: number; longitude: number } }): ObstacleDTO {
	const ts = now();
	return {
		userId: currentUid() || 'local',
		severity: 'medium',
		status: 'active',
		description: undefined,
		photoUrl: undefined,
		reportedAt: ts,
		verifiedBy: [],
		createdAt: ts,
		updatedAt: ts,
		...partial,
	} as ObstacleDTO;
}

export function newReport(partial: Partial<ReportDTO> & { id: UUID; type: ReportType; title: string }): ReportDTO {
	const ts = now();
	return {
		userId: currentUid() || 'local',
		severity: 'medium',
		status: 'pending',
		description: undefined,
		location: undefined,
		photoUrl: undefined,
		rideId: undefined,
		trailId: undefined,
		trailName: undefined,
		createdAt: ts,
		updatedAt: ts,
		...partial,
	} as ReportDTO;
}

// ---------- Firestore Converters ---------- //

export const userProfileConverter: FirestoreDataConverter<UserProfile> = {
	toFirestore: (profile: UserProfile) => {
		const data = { ...profile };
		// The uid is the doc id, so we don't need to store it in the document.
		delete (data as any).uid;
		// Firestore rejects undefined; strip them
		Object.keys(data).forEach((k) => {
			if ((data as any)[k] === undefined) delete (data as any)[k];
		});
		return data;
	},
	fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions): UserProfile => {
		const data = snapshot.data(options);
		return {
			uid: snapshot.id,
			displayName: data.displayName,
			email: data.email,
			photoURL: data.photoURL,
			role: (data.role as 'admin' | 'member') ?? 'member',
			status: (data.status as 'pending' | 'approved' | 'disapproved') ?? 'pending',
			createdAt: data.createdAt,
			updatedAt: data.updatedAt,
			totalRides: data.totalRides || 0,
			totalDistanceM: data.totalDistanceM || 0,
			totalDurationMs: data.totalDurationMs || 0,
			points: data.points || 0,
		};
	},
};

export const rideConverter: FirestoreDataConverter<RideDTO> = {
	toFirestore: (ride: RideDTO) => {
		const data = { ...ride };
		delete (data as any).id; // Use document ID for ride ID
		// Firestore rejects undefined; strip them (e.g., routeDistances)
		return stripUndefined(data as any) as any;
	},
	fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions): RideDTO => {
		const data = snapshot.data(options);
		return {
			...data,
			id: snapshot.id,
		} as RideDTO;
	},
};

export const horseConverter: FirestoreDataConverter<HorseDTO> = {
	toFirestore: (horse: HorseDTO) => {
		const data = { ...horse };
		delete (data as any).id;
		// Firestore rejects undefined; align with rideConverter behavior
		return stripUndefined(data as any) as any;
	},
	fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions): HorseDTO => {
		const data = snapshot.data(options);
		return {
			...data,
			id: snapshot.id,
		} as HorseDTO;
	},
};

export const achievementConverter: FirestoreDataConverter<AchievementDTO> = {
	toFirestore: (achievement: AchievementDTO) => {
		const data = { ...achievement };
		delete (data as any).id;
		return data;
	},
	fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions): AchievementDTO => {
		const data = snapshot.data(options);
		return {
			...data,
			id: snapshot.id,
		} as AchievementDTO;
	},
};

export const sosAlertConverter: FirestoreDataConverter<SosAlertDTO> = {
	toFirestore: (alert: SosAlertDTO) => {
		const data = { ...alert };
		delete (data as any).id;
		return data;
	},
	fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions): SosAlertDTO => {
		const data = snapshot.data(options);
		return {
			...data,
			id: snapshot.id,
		} as SosAlertDTO;
	},
};

export const notificationPrefConverter: FirestoreDataConverter<NotificationPrefDTO> = {
	toFirestore: (prefs: NotificationPrefDTO) => {
		const data = { ...prefs };
		// The userId is the doc id, so we don't need to store it in the document.
		delete (data as any).userId;
		return data;
	},
	fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions): NotificationPrefDTO => {
		const data = snapshot.data(options);
		return {
			userId: snapshot.id,
			allowPush: data.allowPush,
			allowEmail: data.allowEmail,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt,
		};
	},
};

// Helper to strip undefined values (Firestore rejects undefined)
function stripUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
	const clean: any = {};
	Object.keys(obj).forEach(key => {
		if (obj[key] !== undefined) {
			clean[key] = obj[key];
		}
	});
	return clean;
}

export const sightingConverter: FirestoreDataConverter<SightingDTO> = {
	toFirestore: (sighting: SightingDTO) => {
		const data = { ...sighting };
		delete (data as any).id;
		return stripUndefined(data);
	},
	fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions): SightingDTO => {
		const data = snapshot.data(options);
		return {
			...data,
			id: snapshot.id,
		} as SightingDTO;
	},
};

export const obstacleConverter: FirestoreDataConverter<ObstacleDTO> = {
	toFirestore: (obstacle: ObstacleDTO) => {
		const data = { ...obstacle };
		delete (data as any).id;
		return stripUndefined(data);
	},
	fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions): ObstacleDTO => {
		const data = snapshot.data(options);
		return {
			...data,
			id: snapshot.id,
		} as ObstacleDTO;
	},
};

export const reportConverter: FirestoreDataConverter<ReportDTO> = {
	toFirestore: (report: ReportDTO) => {
		const data = { ...report };
		delete (data as any).id;
		return stripUndefined(data);
	},
	fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions): ReportDTO => {
		const data = snapshot.data(options);
		return {
			...data,
			id: snapshot.id,
		} as ReportDTO;
	},
};

export const Converters = {
	userProfile: userProfileConverter,
	ride: rideConverter,
	horse: horseConverter,
	achievement: achievementConverter,
	sosAlert: sosAlertConverter,
	notificationPref: notificationPrefConverter,
	sighting: sightingConverter,
	obstacle: obstacleConverter,
	report: reportConverter,
};

// ---------- Collection name helpers ---------- //

export const COLLECTIONS = {
	users: 'users',
	rides: 'rides',
	horses: 'horses',
	achievements: 'achievements',
	sosAlerts: 'sos_alerts',
	notificationPrefs: 'notification_prefs',
	obstacles: 'obstacles',
	sightings: 'sightings',
	reports: 'reports',
};

// ---------- Type Guards ---------- //

export function isRide(obj: any): obj is RideDTO {
	return obj && typeof obj === 'object' && 'startTime' in obj && Array.isArray(obj.path);
}

export function isHorse(obj: any): obj is HorseDTO {
	return obj && typeof obj === 'object' && 'name' in obj && 'userId' in obj;
}

export function isUserProfile(obj: any): obj is UserProfile {
	return obj && typeof obj === 'object' && 'uid' in obj && 'createdAt' in obj;
}

// ---------- Mappers (Local <-> Firebase) ---------- //

export function ridePointToDTO(p: { latitude: number; longitude: number; altitude: number; timestamp: number }): RidePointDTO {
	return { lat: p.latitude, lng: p.longitude, alt: p.altitude, t: p.timestamp };
}

export function ridePointFromDTO(p: RidePointDTO) {
	return { latitude: p.lat, longitude: p.lng, altitude: p.alt, timestamp: p.t };
}

export function calculateRideSummary(ride: RideDTO): RideDTO {
	if (ride.duration <= 0) return ride;
	const avg = ride.totalDistance / (ride.duration / 1000);
	return { ...ride, avgSpeedMps: avg };
}

// Future: add aggregation helpers (e.g., updateUserAggregatesFromRide)

// ============================================================================
// Firestore CRUD Helpers (safe no-ops if FIREBASE_ENABLED is false)
// ============================================================================

// We now use direct static imports so Firestore service registers correctly.
// All helpers guard on FIREBASE_ENABLED & app presence.

// Generic collection helpers
export async function createDoc<T extends { id: string }>(colName: string, data: T, converter?: FirestoreDataConverter<T>) {
	if (!FIREBASE_ENABLED || !app) return data; // local fallback
	const db = getFirestore(app);
	const ref = doc(collection(db, colName), data.id).withConverter(converter || (undefined as any));
	await setDoc(ref, data, { merge: false });
	return data;
}

export async function upsertDoc<T extends { id: string }>(colName: string, data: T, converter?: FirestoreDataConverter<T>) {
	if (!FIREBASE_ENABLED || !app) return data;
	const db = getFirestore(app);
	const ref = doc(collection(db, colName), data.id).withConverter(converter || (undefined as any));
	await setDoc(ref, data, { merge: true });
	return data;
}

export async function getDocById<T>(colName: string, id: string, converter?: FirestoreDataConverter<T>): Promise<T | null> {
	if (!FIREBASE_ENABLED || !app) return null;
	const db = getFirestore(app);
	const ref = doc(collection(db, colName), id).withConverter(converter || (undefined as any));
	const snap = await getDoc(ref);
	return snap.exists() ? (snap.data() as T) : null;
}

export async function listDocs<T>(
	colName: string,
	opts?: { where?: [string, any, any]; orderBy?: [string, 'asc' | 'desc' | undefined]; limit?: number; converter?: FirestoreDataConverter<T> }
): Promise<T[]> {
	if (!FIREBASE_ENABLED || !app) return [];
	const db = getFirestore(app);
	let q: any = collection(db, colName);
	if (opts?.where) q = fsQuery(q, fsWhere(opts.where[0], opts.where[1], opts.where[2]));
	if (opts?.orderBy) {
		const dir = opts.orderBy[1];
		q = fsQuery(q, fsOrderBy(opts.orderBy[0], dir === 'asc' || dir === 'desc' ? dir : undefined));
	}
	if (opts?.limit) q = fsQuery(q, fsLimit(opts.limit));
	if (opts?.converter) q = q.withConverter(opts.converter);
	const snap = await getDocs(q);
	return snap.docs.map(d => d.data() as T);
}

// --------------------------------------------------------------------------
// Domain-Specific Helpers
// --------------------------------------------------------------------------

export async function saveRideAndUpdateAggregates(ride: RideDTO) {
	if (!FIREBASE_ENABLED || !app) return ride;
	const db = getFirestore(app);
	const batch = writeBatch(db);
	const rideRef = doc(collection(db, COLLECTIONS.rides), ride.id).withConverter(rideConverter);
	batch.set(rideRef, ride, { merge: false });

	const profRef = doc(collection(db, COLLECTIONS.users), ride.userId).withConverter(userProfileConverter);
	const achievementsToAward: { id: string; meta?: Record<string, any> }[] = [];
	await runTransaction(db, async (tx) => {
		const profSnap = await tx.get(profRef);
		let profile = profSnap.exists() ? profSnap.data() : newUserProfile({ uid: ride.userId });
		const prevTotalRides = profile.totalRides;
		const prevTotalDistanceM = profile.totalDistanceM;
		profile.totalRides += 1;
		profile.totalDistanceM += ride.totalDistance;
		profile.totalDurationMs += ride.duration;
		profile.points = profile.totalRides * 10 + Math.round(profile.totalDistanceM / 1000);
		profile.updatedAt = Date.now();
		tx.set(profRef, profile, { merge: true });
		if (prevTotalRides === 0 && profile.totalRides >= 1) {
			achievementsToAward.push({ id: 'first-ride', meta: { rideId: ride.id, startTime: ride.startTime } });
		}
		const hundredKm = 100_000;
		if (prevTotalDistanceM < hundredKm && profile.totalDistanceM >= hundredKm) {
			achievementsToAward.push({ id: 'distance-100', meta: { totalDistanceM: profile.totalDistanceM } });
		}
	});

	const rideDurationGoal = 4 * 60 * 60 * 1000;
	if (ride.duration >= rideDurationGoal) {
		achievementsToAward.push({ id: 'trail-marathon', meta: { durationMs: ride.duration, rideId: ride.id } });
	}
	const rideStartHour = new Date(ride.startTime).getHours();
	if (rideStartHour < 6) {
		achievementsToAward.push({ id: 'early-bird', meta: { rideId: ride.id, startTime: ride.startTime } });
	}

	await batch.commit();

	if (achievementsToAward.length > 0) {
		await Promise.all(achievementsToAward.map((ach) => awardAchievement(ride.userId, ach.id, ach.meta)));
	}
	return ride;
}

export async function recalcUserAggregates(userId: string) {
	if (!FIREBASE_ENABLED || !app) return null;
	const db = getFirestore(app);
	const q = fsQuery(collection(db, COLLECTIONS.rides), fsWhere('userId', '==', userId));
	const snap = await getDocs(q);
	let totalRides = 0;
	let totalDistanceM = 0;
	let totalDurationMs = 0;
	snap.forEach(docSnap => {
		const r = docSnap.data() as RideDTO;
		totalRides += 1;
		totalDistanceM += r.totalDistance;
		totalDurationMs += r.duration;
	});
	const profile = newUserProfile({ uid: userId, totalRides, totalDistanceM, totalDurationMs, points: totalRides * 10 + Math.round(totalDistanceM / 1000) });
	const ref = doc(collection(db, COLLECTIONS.users), userId).withConverter(userProfileConverter);
	await setDoc(ref, profile, { merge: true });
	return profile;
}


export async function awardAchievement(userId: string, achievementId: string, meta?: Record<string, any>) {
	if (!FIREBASE_ENABLED || !app) return null;
	const db = getFirestore(app);
	const ref = doc(collection(db, COLLECTIONS.achievements), `${userId}_${achievementId}`).withConverter(achievementConverter);
	const snap = await getDoc(ref);
	if (snap.exists()) return snap.data();
	const ach = newAchievement({ id: achievementId, userId, meta });
	await setDoc(ref, ach);
	return ach;
}

export async function listUserAchievements(userId: string) {
	return listDocs<AchievementDTO>(COLLECTIONS.achievements, { where: ['userId', '==', userId] });
}

export async function setNotificationPrefs(prefs: NotificationPrefDTO) {
	if (!FIREBASE_ENABLED || !app) return prefs;
	const db = getFirestore(app);
	const ref = doc(collection(db, COLLECTIONS.notificationPrefs), prefs.userId).withConverter(notificationPrefConverter);
	await setDoc(ref, prefs, { merge: true });
	return prefs;
}

export async function getNotificationPrefs(userId: string) {
	if (!FIREBASE_ENABLED || !app) return null;
	return getDocById<NotificationPrefDTO>(COLLECTIONS.notificationPrefs, userId, notificationPrefConverter);
}

// --------------------------------------------------------------------------
// Sightings: users/{uid}/sightings helpers
// --------------------------------------------------------------------------

function userSightingsCol(db: any, uid: string) {
	return collection(db, COLLECTIONS.users, uid, 'sightings');
}

export async function createSighting(uid: string, sighting: SightingDTO) {
	if (!FIREBASE_ENABLED || !app) return sighting;
	const db = getFirestore(app);
	const ref = doc(userSightingsCol(db, uid), sighting.id).withConverter(sightingConverter);
	await setDoc(ref, sighting, { merge: false });
	return sighting;
}

export async function upsertSighting(uid: string, sighting: SightingDTO) {
	if (!FIREBASE_ENABLED || !app) return sighting;
	const db = getFirestore(app);
	const ref = doc(userSightingsCol(db, uid), sighting.id).withConverter(sightingConverter);
	await setDoc(ref, { ...sighting, updatedAt: Date.now() }, { merge: true });
	return sighting;
}

export async function getSighting(uid: string, id: string): Promise<SightingDTO | null> {
	if (!FIREBASE_ENABLED || !app) return null;
	const db = getFirestore(app);
	const ref = doc(userSightingsCol(db, uid), id).withConverter(sightingConverter);
	const snap = await getDoc(ref);
	return snap.exists() ? snap.data() : null;
}

export async function listSightings(
	uid: string,
	opts?: { limit?: number; orderBy?: [keyof SightingDTO & string, ('asc' | 'desc')?] }
): Promise<SightingDTO[]> {
	if (!FIREBASE_ENABLED || !app) return [];
	const db = getFirestore(app);
	let q: Query<SightingDTO> = userSightingsCol(db, uid).withConverter(sightingConverter);
	if (opts?.orderBy) {
		const dir = opts.orderBy[1];
		q = fsQuery(q, fsOrderBy(opts.orderBy[0], dir === 'asc' || dir === 'desc' ? dir : undefined));
	}
	if (opts?.limit) q = fsQuery(q, fsLimit(opts.limit));
	const snap = await getDocs(q);
	return snap.docs.map(d => d.data());
}

export async function deleteSighting(uid: string, id: string) {
	if (!FIREBASE_ENABLED || !app) return true;
	const db = getFirestore(app);
	const ref = doc(userSightingsCol(db, uid), id);
	await deleteDoc(ref);
	return true;
}

// --------------------------------------------------------------------------
// Obstacles: obstacles collection helpers
// --------------------------------------------------------------------------

export async function createObstacle(obstacle: ObstacleDTO) {
	return createDoc<ObstacleDTO>(COLLECTIONS.obstacles, obstacle, obstacleConverter);
}

export async function upsertObstacle(obstacle: ObstacleDTO) {
	return upsertDoc<ObstacleDTO>(COLLECTIONS.obstacles, obstacle, obstacleConverter);
}

export async function getObstacle(id: string): Promise<ObstacleDTO | null> {
	return getDocById<ObstacleDTO>(COLLECTIONS.obstacles, id, obstacleConverter);
}

export async function listObstacles(
	opts?: { 
		userId?: string;
		status?: ObstacleStatus;
		limit?: number; 
		orderBy?: [keyof ObstacleDTO & string, ('asc' | 'desc')?] 
	}
): Promise<ObstacleDTO[]> {
	if (!FIREBASE_ENABLED || !app) return [];
	const db = getFirestore(app);
	let q: Query<ObstacleDTO> = collection(db, COLLECTIONS.obstacles).withConverter(obstacleConverter);
	
	// Add filters
	if (opts?.userId) {
		q = fsQuery(q, fsWhere('userId', '==', opts.userId));
	}
	if (opts?.status) {
		q = fsQuery(q, fsWhere('status', '==', opts.status));
	}
	
	// Add ordering
	if (opts?.orderBy) {
		const dir = opts.orderBy[1];
		q = fsQuery(q, fsOrderBy(opts.orderBy[0], dir === 'asc' || dir === 'desc' ? dir : undefined));
	} else {
		// Default sort by reportedAt desc
		q = fsQuery(q, fsOrderBy('reportedAt', 'desc'));
	}
	
	// Add limit
	if (opts?.limit) q = fsQuery(q, fsLimit(opts.limit));
	
	const snap = await getDocs(q);
	return snap.docs.map(d => d.data());
}

export async function deleteObstacle(id: string) {
	if (!FIREBASE_ENABLED || !app) return true;
	const db = getFirestore(app);
	const ref = doc(collection(db, COLLECTIONS.obstacles), id);
	await deleteDoc(ref);
	return true;
}

// --------------------------------------------------------------------------
// Reports: reports collection helpers
// --------------------------------------------------------------------------

export async function createReport(report: ReportDTO) {
	return createDoc<ReportDTO>(COLLECTIONS.reports, report, reportConverter);
}

export async function upsertReport(report: ReportDTO) {
	return upsertDoc<ReportDTO>(COLLECTIONS.reports, report, reportConverter);
}

export async function getReport(id: string): Promise<ReportDTO | null> {
	return getDocById<ReportDTO>(COLLECTIONS.reports, id, reportConverter);
}

export async function listReports(
	opts?: { 
		userId?: string;
		status?: ReportStatus;
		limit?: number; 
		orderBy?: [keyof ReportDTO & string, ('asc' | 'desc')?] 
	}
): Promise<ReportDTO[]> {
	if (!FIREBASE_ENABLED || !app) return [];
	const db = getFirestore(app);
	let q: Query<ReportDTO> = collection(db, COLLECTIONS.reports).withConverter(reportConverter);
	
	// Add filters
	if (opts?.userId) {
		q = fsQuery(q, fsWhere('userId', '==', opts.userId));
	}
	if (opts?.status) {
		q = fsQuery(q, fsWhere('status', '==', opts.status));
	}
	
	// Add ordering
	if (opts?.orderBy) {
		const dir = opts.orderBy[1];
		q = fsQuery(q, fsOrderBy(opts.orderBy[0], dir === 'asc' || dir === 'desc' ? dir : undefined));
	} else {
		// Default sort by createdAt desc
		q = fsQuery(q, fsOrderBy('createdAt', 'desc'));
	}
	
	// Add limit
	if (opts?.limit) q = fsQuery(q, fsLimit(opts.limit));
	
	const snap = await getDocs(q);
	return snap.docs.map(d => d.data());
}

export async function deleteReport(id: string) {
	if (!FIREBASE_ENABLED || !app) return true;
	const db = getFirestore(app);
	const ref = doc(collection(db, COLLECTIONS.reports), id);
	await deleteDoc(ref);
	return true;
}
