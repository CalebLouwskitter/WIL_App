import type { NavigatorScreenParams } from '@react-navigation/native';
import type { RideData } from '@/hooks/useRideTracker';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  VerifyEmail: undefined;
};

export type MappingStackParamList = {
  LiveTracking: {
    followSosUid?: string;
    followSosDisplayName?: string;
    autoStart?: boolean;
    autoStartRequestId?: number;
  } | undefined;
  SelectHorse: undefined;
  RideReviewScreen: { rideData?: RideData; rideId?: string } | undefined;
  MarkObstacle: { location?: { latitude: number; longitude: number } } | undefined;
  OnlineUsers: undefined;
  DuringRideScreen: {
    rideData?: RideData;
    rideId?: string;
    initialTab?: 'sighting' | 'report' | 'obstacles';
  } | undefined;
  ObstacleViewUpdated: {
    rideData?: RideData;
    rideId?: string;
    initialTab?: 'sighting' | 'report' | 'obstacles';
  } | undefined;
};

export type AnalyticsStackParamList = {
  Stats: undefined;
  DetailedStats: { fromDashboard?: boolean } | undefined;
  RideHistory: { fromDashboard?: boolean } | undefined;
  RideDetail: { startTime: number };
  TrailStats: undefined;
  GlobalStats: undefined;
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  PersonalStats: { fromDashboard?: boolean } | undefined;
  AchievementsScreen: { fromDashboard?: boolean } | undefined;
  Settings: undefined;
  CreateHorse: { fromDashboard?: boolean; returnToSelectHorse?: boolean } | undefined;
  HorsesList: undefined;
  AdminManagement: undefined;
  AdminNotificationManagement: undefined;
  AdminObstacleManagement: undefined;
  AdminSosManagement: undefined;
  Notifications: undefined;
  Observations: undefined;
  RideHistory: { fromDashboard?: boolean; fromMapping?: boolean } | undefined;
  RideDetail: { startTime: number };
};

export type TabParamList = {
  Dashboard: undefined;
  Mapping: NavigatorScreenParams<MappingStackParamList>;
  Sos: undefined;
  Analytics: NavigatorScreenParams<AnalyticsStackParamList>;
  ProfileStack: NavigatorScreenParams<ProfileStackParamList>;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<TabParamList>;
};
