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
  type User
} from "firebase/auth";

// Import the auth functions dynamically to avoid module resolution issues
const getAuthFunctions = () => {
  try {
    const authModule = require('firebase/auth');
    return {
      signInWithEmailAndPassword: authModule.signInWithEmailAndPassword,
      createUserWithEmailAndPassword: authModule.createUserWithEmailAndPassword,
      sendEmailVerification: authModule.sendEmailVerification,
      sendPasswordResetEmail: authModule.sendPasswordResetEmail,
      GoogleAuthProvider: authModule.GoogleAuthProvider,
      signInWithCredential: authModule.signInWithCredential,
      signOut: authModule.signOut,
    };
  } catch (error) {
    console.warn('Firebase auth functions not available:', error);
    return {};
  }
};

const authFunctions = getAuthFunctions();

export const loginUser = async (email: string, password: string) => {
  if (!FIREBASE_ENABLED || !auth) {
    throw new Error("Firebase not configured. Please add environment variables to enable authentication.");
  }
  return await authFunctions.signInWithEmailAndPassword(auth, email, password);
};

export const registerUser = async (email: string, password: string) => {
  if (!FIREBASE_ENABLED || !auth) {
    throw new Error("Firebase not configured. Please add environment variables to enable authentication.");
  }
  const userCredential = await authFunctions.createUserWithEmailAndPassword(auth, email, password);
  if (userCredential.user) {
    await authFunctions.sendEmailVerification(userCredential.user);
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
  return await authFunctions.signOut(auth);
};

export const sendPasswordReset = async (email: string) => {
  if (!FIREBASE_ENABLED || !auth) {
    throw new Error("Firebase not configured. Please add environment variables to enable authentication.");
  }
  return await authFunctions.sendPasswordResetEmail(auth, email);
};

export const resendVerificationEmail = async (user: User) => {
  if (!FIREBASE_ENABLED || !auth) {
    throw new Error("Firebase not configured. Please add environment variables to enable authentication.");
  }
  return await authFunctions.sendEmailVerification(user);
};

export const signInWithGoogle = async (idToken: string) => {
  if (!FIREBASE_ENABLED || !auth) {
    throw new Error("Firebase not configured. Please add environment variables to enable authentication.");
  }
  const credential = authFunctions.GoogleAuthProvider.credential(idToken);
  const userCredential = await authFunctions.signInWithCredential(auth, credential);
  
  if (userCredential.user) {
    // Create user profile in Firestore if it doesn't exist
    await getOrCreateUserProfile(userCredential.user);
    
    // Send notification to admins about new user signup (if this is a new user)
    if (userCredential.additionalUserInfo?.isNewUser) {
      try {
        await sendUserSignupNotification(userCredential.user.uid, userCredential.user.email || 'Unknown');
      } catch (error) {
        console.error('Failed to send signup notification:', error);
      }
    }
  }
  
  return userCredential;
};
