export type NotificationType = 'user_signup' | 'event' | 'update' | 'alert';
export type NotificationAudience = 'admins' | 'users' | 'all';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  audience: NotificationAudience;
  createdAt: Date;
  createdBy: string; // userId of creator
  sentAt?: Date;
  updatedAt?: Date;
  metadata?: {
    userId?: string; // for user_signup notifications
    eventId?: string;
    [key: string]: any;
  };
  read?: boolean; // for user's notification history
}

export interface NotificationPreferences {
  userId: string;
  fcmToken?: string;
  enableNotifications: boolean;
  enableUserSignupAlerts: boolean; // admin only
  enableEventAlerts: boolean;
  enableUpdateAlerts: boolean;
  enableGeneralAlerts: boolean;
  updatedAt: Date;
}
