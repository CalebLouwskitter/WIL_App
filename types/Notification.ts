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
  queuedAt?: Date; // a push request was queued; says nothing about delivery
  sentAt?: Date; // set by the delivery worker once the push service accepted it
  updatedAt?: Date;
  metadata?: {
    userId?: string; // for user_signup notifications
    eventId?: string;
    [key: string]: any;
  };
  read?: boolean; // for user's notification history
  dismissed?: boolean;
}

export interface NotificationPreferences {
  userId: string;
  expoPushToken?: string;
  enableNotifications: boolean;
  enableUserSignupAlerts: boolean; // admin only
  enableEventAlerts: boolean;
  enableUpdateAlerts: boolean;
  enableGeneralAlerts: boolean;
  updatedAt: Date;
}
