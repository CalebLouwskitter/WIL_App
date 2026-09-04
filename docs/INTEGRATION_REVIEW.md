# App integration cleanup

This review treats the existing app as functional. Its focus is inconsistent imports,
duplicate initialization, stale state, and unfinished wiring, rather than a redesign.
Baseline: main at 85ea904a6e58f97ba79ff6c8b7503853e24a220b.

## Why imports appeared broken

- `types/firebase-auth-react-native.d.ts` declared a replacement module instead of
  augmenting Firebase's real exports. Its `@firebase/auth` re-export was resolved
  from the application directory, although the locked dependency lives inside
  `node_modules/firebase/node_modules`. This hid real exports from TypeScript.
- `services/auth.ts` then worked around the type errors with dynamic `require`
  calls returning untyped functions. Restoring SDK types allows ordinary imports.
- `expo-navigation-bar` was required but absent from package.json. A try/catch
  cannot make a statically resolved Metro dependency optional.
- `@react-navigation/native` and `expo-linking` were imported directly but relied
  on transitive installation. They are now explicit dependencies.
- ProfilePictureService called the legacy filesystem API through the new SDK 54
  entry point. It now imports the compatible legacy entry point.

## What was connected

- FirebaseConfig is the only Firebase initializer. firebase, FirebaseAuthRN, and
  FirebaseFirestoreService retain their public paths as compatibility re-exports.
  Firestore configuration happens before other services obtain the instance.
- Authentication uses typed SDK functions; Google new-user detection uses
  getAdditionalUserInfo rather than a nonexistent UserCredential property.
- DuringRideScreen's route contract now includes its existing rideId argument.
- useCurrentUser subscribes to profile changes, so approval/name/role updates can
  propagate without another login. Previous-account and unmount races are guarded.
- The background tracker app-state callback reads current ride activity instead
  of closing over the initial idle status.
- Android navigation controls use the declared dependency and avoid calls that
  are incompatible with the app's edge-to-edge configuration.

## Unfinished files are not necessarily missing features

The six store files are empty. There is no implemented Redux store to connect.
LocationService, SosService, NotificationService, FirebaseAnalyticsService,
usePermissions, and useLiveTracking are also empty. Their apparent responsibilities
are handled elsewhere by actual implementations such as BackgroundLocationService,
SosContext, FirebaseNotificationService, and the existing hooks.

There are also alternative, unreferenced implementations (for example
services/useAnalytics.ts and FirebaseAuthRN's former initializer). Blindly importing
these would create competing paths. Empty placeholders and unused alternative
screens have been retained pending an explicit decision to remove or reuse them.

## Remaining coherence and performance work

- hooks/useAnalytics and UserAnalyticsService compute overlapping statistics from
  different loading paths. Consolidate the behavior with explicit tests for units,
  rounding, offline results, and date ranges before replacing either path.
- UserStatsScreen currently requests data both on mount and on focus. Other large
  screens should be checked for redundant requests, listeners, and loading flashes.
- useCurrentUser still runs per consumer. A shared session/profile provider can
  reduce repeated initialization reads, but needs navigation lifecycle testing.
- LiveTrackingScreen and UnifiedRideObstacleScreen mix UI, navigation, data, and
  tracking concerns. Extract cohesive logic incrementally; line count alone is not
  evidence of a rendering bottleneck.
- Notification tap handling currently has a navigation placeholder. Map supported
  payload types to actual routes after verifying the backend payload contract.
- Tracking startup, save/recovery ordering, and offline reconciliation findings
  from the earlier review remain separate work; this patch does not redesign them.

## Validation

- Baseline tsc: nine diagnostics. Cleanup: npm run typecheck passes.
- npm run test:integration runs five tests against actual transpiled app modules
  with React/native/Firebase boundaries mocked: singleton setup, live profile
  updates, logout race, unmount race, and app-state transitions after starting a ride.
- Android Metro/Hermes export completed (1,519 modules). Export warns that the
  private google-services.json is absent in this checkout.
- No device performance measurement, signed native build, or live Firebase test
  has been performed. A new native build is needed for the added navigation module.
