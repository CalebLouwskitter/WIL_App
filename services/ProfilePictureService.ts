// services/ProfilePictureService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native';
import { auth, FIREBASE_ENABLED, app } from './firebase';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const PROFILE_PICTURE_KEY = '@profile_picture';

export interface ProfilePicture {
  uri: string;
  timestamp: number;
  type: 'local' | 'remote';
  storagePath?: string;
}

class ProfilePictureService {
  // Get the appropriate directory (cacheDirectory as fallback for Expo Go)
  private getStorageDirectory(): string | null {
    const docDir = (FileSystem as any).documentDirectory;
    const cacheDir = (FileSystem as any).cacheDirectory;
    
    // Prefer documentDirectory, fallback to cacheDirectory
    const dir = docDir || cacheDir;
    
    if (dir) {
      return `${dir}profile_pictures/`;
    }
    
    return null;
  }

  // Initialize the profile pictures directory
  async init() {
    try {
      const PROFILE_PICTURES_DIR = this.getStorageDirectory();
      
      if (!PROFILE_PICTURES_DIR) {
        console.warn('No storage directory available, will store URI reference only');
        return;
      }
      
      console.log('Initializing profile pictures directory:', PROFILE_PICTURES_DIR);
      
      const dirInfo = await FileSystem.getInfoAsync(PROFILE_PICTURES_DIR);
      console.log('Directory info:', dirInfo);
      
      if (!dirInfo.exists) {
        console.log('Creating directory...');
        await FileSystem.makeDirectoryAsync(PROFILE_PICTURES_DIR, { intermediates: true });
        console.log('Directory created successfully');
      } else {
        console.log('Directory already exists');
      }
    } catch (error) {
      console.error('Error initializing profile pictures directory:', error);
      // Don't throw - we can still work without copying files
    }
  }

  // Request camera permissions
  async requestCameraPermission(): Promise<boolean> {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      console.log('Camera permission status:', status);
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Camera permission is required to take photos.'
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error requesting camera permission:', error);
      return false;
    }
  }

  // Request media library permissions
  async requestMediaLibraryPermission(): Promise<boolean> {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('Media library permission status:', status);
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Media library permission is required to choose photos.'
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error requesting media library permission:', error);
      return false;
    }
  }

  // Take a photo with camera
  async takePhoto(): Promise<string | null> {
    try {
      console.log('Starting takePhoto...');
      const hasPermission = await this.requestCameraPermission();
      if (!hasPermission) {
        console.log('Camera permission not granted');
        return null;
      }

      console.log('Launching camera...');
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      console.log('Camera result:', result);

      if (!result.canceled && result.assets[0]) {
        console.log('Photo taken, saving...');
        return await this.saveProfilePicture(result.assets[0].uri);
      }
      
      console.log('Photo taking was canceled');
      return null;
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', `Failed to take photo: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  // Choose photo from library
  async chooseFromLibrary(): Promise<string | null> {
    try {
      console.log('Starting chooseFromLibrary...');
      const hasPermission = await this.requestMediaLibraryPermission();
      if (!hasPermission) {
        console.log('Media library permission not granted');
        return null;
      }

      console.log('Launching image library...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      console.log('Image library result:', result);

      if (!result.canceled && result.assets[0]) {
        console.log('Photo selected, saving...');
        return await this.saveProfilePicture(result.assets[0].uri);
      }
      
      console.log('Photo selection was canceled');
      return null;
    } catch (error) {
      console.error('Error choosing photo:', error);
      Alert.alert('Error', `Failed to choose photo: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  // Save profile picture to local storage
  private async saveProfilePicture(sourceUri: string): Promise<string> {
    try {
      console.log('Saving profile picture, source URI:', sourceUri);
      
      const PROFILE_PICTURES_DIR = this.getStorageDirectory();
      let destinationUri = sourceUri;

      // Only copy file if we have a storage directory available
      if (PROFILE_PICTURES_DIR) {
        try {
          await this.init();
          
          // Generate unique filename
          const filename = `profile_${Date.now()}.jpg`;
          destinationUri = `${PROFILE_PICTURES_DIR}${filename}`;
          
          console.log('Destination URI:', destinationUri);
          console.log('Copying file...');

          // Copy file to app's storage directory
          await FileSystem.copyAsync({
            from: sourceUri,
            to: destinationUri,
          });

          console.log('File copied successfully');
          
          // Delete old profile pictures
          await this.deleteOldProfilePictures(destinationUri);
        } catch (copyError) {
          console.warn('Could not copy file, using original URI:', copyError);
          // Fall back to using the source URI directly
          destinationUri = sourceUri;
        }
      } else {
        console.log('No storage directory available, storing original URI');
      }

      // If Firebase is enabled and user is authenticated, upload to Firebase Storage
      if (FIREBASE_ENABLED && auth?.currentUser && app) {
        try {
          const uid = auth.currentUser.uid;
          const storage = getStorage(app);
          const storagePath = `users/${uid}/profile.jpg`;
          const storageRef = ref(storage, storagePath);

          // Read file into a blob
          const response = await fetch(destinationUri);
          const blob = await response.blob();
          console.log('Uploading profile picture to Firebase Storage:', storagePath);
          await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
          const downloadUrl = await getDownloadURL(storageRef);
          console.log('Uploaded. Download URL obtained.');

          // Optionally update auth profile photoURL (skipped to avoid API differences)

          // Save remote reference to AsyncStorage
          const profilePic: ProfilePicture = {
            uri: downloadUrl,
            timestamp: Date.now(),
            type: 'remote',
            storagePath,
          };
          await AsyncStorage.setItem(PROFILE_PICTURE_KEY, JSON.stringify(profilePic));
          console.log('Saved remote profile picture to AsyncStorage');
          return downloadUrl;
        } catch (uploadError) {
          console.warn('Failed to upload to Firebase Storage, falling back to local only:', uploadError);
        }
      }

      // Fallback: Save local reference to AsyncStorage
      const profilePic: ProfilePicture = {
        uri: destinationUri,
        timestamp: Date.now(),
        type: 'local',
      };
      await AsyncStorage.setItem(PROFILE_PICTURE_KEY, JSON.stringify(profilePic));
      console.log('Saved local profile picture to AsyncStorage');
      return destinationUri;
    } catch (error) {
      console.error('Error saving profile picture:', error);
      try { console.error('Error details:', JSON.stringify(error)); } catch {}
      throw error;
    }
  }

  // Get current profile picture
  async getProfilePicture(): Promise<string | null> {
    try {
      console.log('getProfilePicture() -> FIREBASE_ENABLED:', !!FIREBASE_ENABLED, 'hasUser:', !!auth?.currentUser, 'hasApp:', !!app);
      const data = await AsyncStorage.getItem(PROFILE_PICTURE_KEY);
      if (!data) {
        console.log('No profile picture found in storage');
        // Try to fetch from Firebase Storage deterministic path
        if (FIREBASE_ENABLED && auth?.currentUser && app) {
          try {
            const storage = getStorage(app);
            const storagePath = `users/${auth.currentUser.uid}/profile.jpg`;
            const storageRef = ref(storage, storagePath);
            console.log('Attempting remote fetch from Storage path:', storagePath);
            const url = await getDownloadURL(storageRef);
            // Cache for next time
            const profilePic: ProfilePicture = { uri: url, timestamp: Date.now(), type: 'remote', storagePath };
            await AsyncStorage.setItem(PROFILE_PICTURE_KEY, JSON.stringify(profilePic));
            return url;
          } catch (e: any) {
            if (e?.code === 'storage/object-not-found') {
              console.log('Remote profile picture not found (expected for new users).');
            } else {
              console.warn('Remote fetch failed:', e?.code || e?.message || e);
            }
            // Fallback to Firebase auth photoURL if available
            if (auth?.currentUser?.photoURL) return auth.currentUser.photoURL;
          }
        } else if (auth?.currentUser?.photoURL) {
          return auth.currentUser.photoURL;
        }
        return null;
      }

      const profilePic: ProfilePicture = JSON.parse(data);
      console.log('Profile picture from storage:', profilePic);

      // Check if file still exists (only if it's a copied file, not original ImagePicker URI)
      if (profilePic.uri.includes('profile_pictures')) {
        const fileInfo = await FileSystem.getInfoAsync(profilePic.uri);
        console.log('File info:', fileInfo);
        
        if (!fileInfo.exists) {
          console.log('Profile picture file no longer exists');
          await this.removeProfilePicture();
          // Attempt to fetch from Firebase Storage again
          if (FIREBASE_ENABLED && auth?.currentUser && app) {
            try {
              const storage = getStorage(app);
              const storagePath = `users/${auth.currentUser.uid}/profile.jpg`;
              const storageRef = ref(storage, storagePath);
              console.log('Retrying remote fetch from Storage path:', storagePath);
              const url = await getDownloadURL(storageRef);
              const newPic: ProfilePicture = { uri: url, timestamp: Date.now(), type: 'remote', storagePath };
              await AsyncStorage.setItem(PROFILE_PICTURE_KEY, JSON.stringify(newPic));
              return url;
            } catch (e: any) {
              if (e?.code === 'storage/object-not-found') {
                console.log('Remote profile picture not found on retry.');
              } else {
                console.warn('Retry remote fetch failed:', e?.code || e?.message || e);
              }
            }
          }
          // Final fallback to auth photoURL
          if (auth?.currentUser?.photoURL) return auth.currentUser.photoURL;
          return null;
        }
      }

      return profilePic.uri;
    } catch (error) {
      console.error('Error getting profile picture:', error);
      return null;
    }
  }

  async checkRemoteProfilePicture(): Promise<{ exists: boolean; url: string | null; path: string | null; reason?: string }> {
    try {
      if (!FIREBASE_ENABLED) return { exists: false, url: null, path: null, reason: 'FIREBASE_DISABLED' };
      if (!auth?.currentUser) return { exists: false, url: null, path: null, reason: 'NO_AUTH_USER' };
      if (!app) return { exists: false, url: null, path: null, reason: 'NO_APP' };
      const storage = getStorage(app);
      const storagePath = `users/${auth.currentUser.uid}/profile.jpg`;
      const storageRef = ref(storage, storagePath);
      console.log('checkRemoteProfilePicture -> attempting getDownloadURL:', storagePath);
      const url = await getDownloadURL(storageRef);
      console.log('checkRemoteProfilePicture -> success');
      return { exists: true, url, path: storagePath };
    } catch (e: any) {
      if (e?.code === 'storage/object-not-found') {
        console.log('checkRemoteProfilePicture -> object not found (no remote picture yet).');
      } else {
        console.warn('checkRemoteProfilePicture -> failed:', e?.code || e?.message || e);
      }
      return { exists: false, url: null, path: null, reason: e?.code || e?.message };
    }
  }

// ... (rest of the code remains the same)
  async removeProfilePicture(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(PROFILE_PICTURE_KEY);
      if (data) {
        const profilePic: ProfilePicture = JSON.parse(data);
        
        // Only try to delete if it's a copied file in our directory
        if (profilePic.uri.includes('profile_pictures')) {
          try {
            const fileInfo = await FileSystem.getInfoAsync(profilePic.uri);
            if (fileInfo.exists) {
              await FileSystem.deleteAsync(profilePic.uri);
              console.log('Profile picture file deleted');
            }
          } catch (deleteError) {
            console.warn('Could not delete file:', deleteError);
          }
        }

        // If uploaded to Firebase Storage, delete it as well
        if (FIREBASE_ENABLED && auth?.currentUser && profilePic.storagePath && app) {
          try {
            const storage = getStorage(app);
            const storageRef = ref(storage, profilePic.storagePath);
            await deleteObject(storageRef);
            console.log('Remote profile picture deleted from Firebase Storage');
          } catch (e) {
            console.warn('Could not delete remote profile picture:', e);
          }
          // Auth photoURL not modified here
        }
      }

      // Remove from AsyncStorage
      await AsyncStorage.removeItem(PROFILE_PICTURE_KEY);
      console.log('Profile picture removed from storage');
    } catch (error) {
      console.error('Error removing profile picture:', error);
    }
  }

  // Delete old profile pictures (cleanup)
  private async deleteOldProfilePictures(currentUri: string): Promise<void> {
    try {
      const PROFILE_PICTURES_DIR = this.getStorageDirectory();
      if (!PROFILE_PICTURES_DIR) return;

      const files = await FileSystem.readDirectoryAsync(PROFILE_PICTURES_DIR);
      console.log('Files in directory:', files);
      
      for (const file of files) {
        const fileUri = `${PROFILE_PICTURES_DIR}${file}`;
        if (fileUri !== currentUri) {
          console.log('Deleting old file:', fileUri);
          await FileSystem.deleteAsync(fileUri, { idempotent: true });
        }
      }
    } catch (error) {
      console.error('Error deleting old profile pictures:', error);
    }
  }

  // Show picker options
  async showPickerOptions(): Promise<string | null> {
    return new Promise((resolve) => {
      Alert.alert(
        'Profile Picture',
        'Choose how you want to add your photo',
        [
          {
            text: 'Take Photo',
            onPress: async () => {
              const uri = await this.takePhoto();
              resolve(uri);
            },
          },
          {
            text: 'Choose from Library',
            onPress: async () => {
              const uri = await this.chooseFromLibrary();
              resolve(uri);
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(null),
          },
        ]
      );
    });
  }
}

export default new ProfilePictureService();
