export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  status: 'pending' | 'approved' | 'disapproved';
  role?: 'admin' | 'member';
  fcmToken?: string; // Firebase Cloud Messaging token for push notifications
}