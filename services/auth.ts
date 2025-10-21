import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, type Auth, signOut } from "firebase/auth";
import { auth } from "./firebase";
import { FIREBASE_ENABLED } from "./firebase";
import { getOrCreateUserProfile } from "./Data";
import { sendUserSignupNotification } from "./FirebaseNotificationService";

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
    
    // Send notification to admins about new user signup
    try {
      await sendUserSignupNotification(userCredential.user.uid, userCredential.user.email || 'Unknown');
    } catch (error) {
      console.error('Failed to send signup notification:', error);
      // Don't fail registration if notification fails
    }
  }
  return userCredential;
};

export const logoutUser = async () => {
  if (!FIREBASE_ENABLED || !auth) {
    throw new Error("Firebase not configured.");
  }
  return await signOut(auth as Auth);
};
