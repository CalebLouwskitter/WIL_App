import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, type Auth, signOut } from "firebase/auth";
import { auth } from "./firebase";
import { FIREBASE_ENABLED } from "./firebase";
import { getOrCreateUserProfile } from "./Data";

export const loginUser = async (email: string, password: string) => {
  if (!FIREBASE_ENABLED || !auth) {
    throw new Error("Firebase not configured. Please add environment variables to enable authentication.");
  }
  return await signInWithEmailAndPassword(auth as Auth, email, password);
};

export const registerUser = async (email: string, password: string) => {
  if (!FIREBASE_ENABLED || !auth) {
    throw new Error("Firebase not configured. Please add environment variables to enable authentication.");
  }
  const userCredential = await createUserWithEmailAndPassword(auth as Auth, email, password);
  if (userCredential.user) {
    await sendEmailVerification(userCredential.user);
    await getOrCreateUserProfile(userCredential.user); // Create user profile in Firestore
  }
  return userCredential;
};

export const logoutUser = async () => {
  if (!FIREBASE_ENABLED || !auth) {
    throw new Error("Firebase not configured.");
  }
  return await signOut(auth as Auth);
};
