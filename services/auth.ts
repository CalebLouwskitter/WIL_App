import { auth } from "./firebase";
import { FIREBASE_ENABLED } from "./firebase";
import { getOrCreateUserProfile } from "./Data";
import { sendUserSignupNotification } from "./FirebaseNotificationService";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendEmailVerification, 
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithCredential,
  signOut,
  getAdditionalUserInfo,
  type User
} from "firebase/auth";

export const loginUser = async (email: string, password: string) => {
  if (!FIREBASE_ENABLED || !auth) {
    throw new Error("Firebase not configured. Please add environment variables to enable authentication.");
  }
  return await signInWithEmailAndPassword(auth, email, password);
};

export const registerUser = async (email: string, password: string) => {
  if (!FIREBASE_ENABLED || !auth) {
    throw new Error("Firebase not configured. Please add environment variables to enable authentication.");
  }
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
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
  return await signOut(auth);
};

export const sendPasswordReset = async (email: string) => {
  if (!FIREBASE_ENABLED || !auth) {
    throw new Error("Firebase not configured. Please add environment variables to enable authentication.");
  }
  return await sendPasswordResetEmail(auth, email);
};

export const resendVerificationEmail = async (user: User) => {
  if (!FIREBASE_ENABLED || !auth) {
    throw new Error("Firebase not configured. Please add environment variables to enable authentication.");
  }
  return await sendEmailVerification(user);
};

export const signInWithGoogle = async (idToken: string) => {
  if (!FIREBASE_ENABLED || !auth) {
    throw new Error("Firebase not configured. Please add environment variables to enable authentication.");
  }
  const credential = GoogleAuthProvider.credential(idToken);
  const userCredential = await signInWithCredential(auth, credential);
  
  if (userCredential.user) {
    // Create user profile in Firestore if it doesn't exist
    await getOrCreateUserProfile(userCredential.user);
    
    // Send notification to admins about new user signup (if this is a new user)
    if (getAdditionalUserInfo(userCredential)?.isNewUser) {
      try {
        await sendUserSignupNotification(userCredential.user.uid, userCredential.user.email || 'Unknown');
      } catch (error) {
        console.error('Failed to send signup notification:', error);
      }
    }
  }
  
  return userCredential;
};
