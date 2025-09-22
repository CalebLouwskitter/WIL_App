import { collection, getDocs, doc, updateDoc, getDoc, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import { firestore } from './FirebaseFirestoreService';
import { User } from '../types/User';
import { userProfileConverter, type UserProfile } from './Data';

export const getAllUsers = async (): Promise<User[]> => {
  if (!firestore) {
    throw new Error("Firestore is not initialized");
  }
  const usersCol = collection(firestore, 'users');
  const userSnapshot = await getDocs(usersCol);
  const userList = userSnapshot.docs.map(d => ({ uid: d.id, ...d.data() } as User));
  return userList;
};

export const approveUser = async (userId: string) => {
  if (!firestore) {
    throw new Error("Firestore is not initialized");
  }
  const userRef = doc(firestore, 'users', userId);
  await updateDoc(userRef, {
    status: 'approved'
  });
};

export const disapproveUser = async (userId:string) => {
  if (!firestore) {
    throw new Error("Firestore is not initialized");
  }
  const userRef = doc(firestore, 'users', userId);
  await updateDoc(userRef, {
    status: 'disapproved'
  });
};

export const getUser = async (userId: string): Promise<User | null> => {
  if (!firestore) {
    throw new Error("Firestore is not initialized");
  }
  const userRef = doc(firestore, 'users', userId);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    return { uid: userSnap.id, ...userSnap.data() } as User;
  } else {
    return null;
  }
};

export const createUser = async (profile: UserProfile) => {
  if (!firestore) throw new Error('Firestore is not initialized');
  const ref = doc(firestore, 'users', profile.uid).withConverter(userProfileConverter as any);
  await setDoc(ref, profile as any);
};

export const updateUser = async (userId: string, data: Partial<User>) => {
  if (!firestore) throw new Error('Firestore is not initialized');
  const ref = doc(firestore, 'users', userId);
  await updateDoc(ref, data as any);
};

export const deleteUserDoc = async (userId: string) => {
  if (!firestore) throw new Error('Firestore is not initialized');
  const ref = doc(firestore, 'users', userId);
  await deleteDoc(ref);
};

export const setUserRole = async (userId: string, role: 'admin' | 'member') => {
  if (!firestore) throw new Error('Firestore is not initialized');
  const ref = doc(firestore, 'users', userId);
  await updateDoc(ref, { role } as any);
};

// Promote a user to admin by email and approve them
export const ensureAdminByEmail = async (email: string) => {
  if (!firestore) throw new Error('Firestore is not initialized');
  const normalized = (email || '').trim().toLowerCase();
  const col = collection(firestore, 'users');
  // Try email exact match
  let snap = await getDocs(query(col, where('email', '==', normalized)));
  if (snap.empty) {
    // Try emailLower
    try {
      snap = await getDocs(query(col, where('emailLower', '==', normalized)));
    } catch {}
  }
  if (snap.empty) {
    // Fallback scan
    const all = await getDocs(col);
    const matches = all.docs.filter(d => {
      const data = d.data() as any;
      const e = typeof data.email === 'string' ? data.email : '';
      return e.toLowerCase() === normalized;
    });
    if (matches.length === 0) return false;
    await Promise.all(matches.map(d => updateDoc(d.ref, { role: 'admin', status: 'approved', emailLower: normalized } as any)));
    return true;
  } else {
    await Promise.all(snap.docs.map(d => updateDoc(d.ref, { role: 'admin', status: 'approved', emailLower: normalized } as any)));
    return true;
  }
};

// Seed existing users to include role/status defaults
export const seedUsersRbac = async () => {
  if (!firestore) throw new Error('Firestore is not initialized');
  const usersCol = collection(firestore, 'users');
  const userSnapshot = await getDocs(usersCol);
  const updates: Array<Promise<any>> = [];
  userSnapshot.forEach((d) => {
    const data = d.data() as any;
    const role = data.role ?? 'member';
    const status = data.status ?? 'approved';
    const email = typeof data.email === 'string' ? data.email : undefined;
    const emailLower = email ? email.toLowerCase() : undefined;
    const patch: Record<string, any> = {};
    if (data.role !== role) patch.role = role;
    if (data.status !== status) patch.status = status;
    if (email && data.emailLower !== emailLower) patch.emailLower = emailLower;
    if (Object.keys(patch).length) updates.push(updateDoc(doc(firestore as any, 'users', d.id), patch));
  });
  await Promise.all(updates);
};
