import { collection, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { firestore } from './firebase';
import { User } from '../types/User';

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
