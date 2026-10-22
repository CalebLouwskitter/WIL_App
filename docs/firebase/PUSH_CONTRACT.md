# Push notification and native Firebase config contract

Status: client side only. **No worker exists in this repo and none was deployed.** Firebase is deliberately unconfigured while the owner creates a new instance. Nothing here has been delivered to a real device.

## Expo Push Service versus direct FCM

| | Expo Push Service (chosen) | Direct FCM |
|---|---|---|
| Token the app saves | Expo token, `ExponentPushToken[...]` | FCM registration token |
| Client call | `Notifications.getExpoPushTokenAsync({ projectId })` | `getDevicePushTokenAsync()` |
| Server sends via | `https://exp.host/--/api/v2/push/send`, then receipts | FCM HTTP v1 with a service-account credential |
| Server credential | Expo access token (optional, recommended) | Google service account |

The hook already requests an Expo token, so the contract is Expo Push Service. Android delivery still rides on FCM underneath, which is why `google-services.json` and the FCM credentials uploaded to Expo (`eas credentials`) are still needed for a development build. Switching to direct FCM later means changing the client token call, the stored field and the worker together.

## Why the stored token is an Expo token

Previously the Expo token was saved as `fcmToken`, which mislabelled it and invited a worker to hand it to FCM, which would reject it. The field and function are now named for what they hold:

- `saveFCMToken` is now `saveExpoPushToken` (`services/FirebaseNotificationService.ts`).
- `users/{uid}.fcmToken` is now `expoPushToken`, and `fcmTokenUpdatedAt` is now `expoPushTokenUpdatedAt`.

Existing documents written under the old names are not migrated. The new instance starts empty.

## The hardcoded Expo project id

`hooks/useNotifications.ts` passes a literal project id (the EAS project id, also in `app.config.ts` under `extra.eas.projectId`) to `getExpoPushTokenAsync`. Expo tokens are scoped to that project. If the owner moves to a new Expo project, change both places together, otherwise the app registers tokens against the old project. The hook could read `Constants.expoConfig.extra.eas.projectId` instead; that is left as follow-up so this change stays a rename.

Expo Go cannot register native push. `useNotifications` only `require`s `expo-notifications` when `Constants.executionEnvironment` is not `StoreClient`, and that guard is unchanged. Real push needs a development build.

## One token per user

`expoPushToken` is a single field on the user profile, so the latest device to register wins and a second device overwrites the first. Per-installation tokens (a `users/{uid}/devices/{installationId}` subcollection, plus cleanup on logout) are the better model and are not implemented. Until then, logging out does not clear the token, and a shared device keeps receiving the previous user's pushes until the next user registers. Treat that as a known gap before using real recipients.

Firestore rules (owned by the rules work) let a user update only `expoPushToken` and `expoPushTokenUpdatedAt` on their own profile.

## Queue schema: `pushNotificationRequests`

The client writes one document per request. Rules accept exactly these keys:

| Key | Value |
|---|---|
| `title`, `body` | strings copied from the notification |
| `audience` | `'admins'`, `'users'` or `'all'` |
| `transport` | `'expo'` |
| `notificationId` | id of the saved `notifications` doc |
| `createdBy` | uid of the caller who wrote the request |
| `createdAt` | server timestamp |
| `processed` | `false` |

`notifications` documents may carry `queuedAt` and `sentAt`:

- `createdAt` is set on creation. Lists are ordered by `createdAt`.
- `queuedAt` is set by the client after the queue write succeeds. It means a request exists, not that anything was delivered. The client sets it with a follow-up update that is best effort, so it can be absent on a queued notification if the rules deny that update.
- `sentAt` is no longer written by the client. The worker should set it only once Expo accepted the message. Nothing in the app reads `sentAt`; screens use `createdAt`.

### Failure behaviour

The notification is written first and the push request second. If the queue write fails, the notification stays (it is still visible in the app), the failure is logged, and `createAdminNotification` returns `{ id, pushQueued: false }`. The admin screen then says the push was not queued instead of "sent successfully". Retry is manual for now; a worker or a retry action could scan for notifications that have no `queuedAt` and no matching request.

## What the worker must do

A trusted process (Cloud Function or a small server) that watches `pushNotificationRequests` where `processed == false`:

1. **Authenticate and validate.** Run with its own credentials, never from the app. Verify `createdBy` is an approved user who may target that `audience` (members must not be able to broadcast to `all`), that `notificationId` exists and matches the title and body, and reject anything else.
2. **Resolve recipients.** Select users by audience and role, require `status == 'approved'`, skip missing tokens, and drop anything that is not an Expo token.
3. **Rate limit.** Cap requests per `createdBy` and per audience over a window, and cap total sends, since a client can create requests.
4. **Send.** Batch to Expo's push API (100 messages per request) with the Expo access token kept server-side.
5. **Receipts.** Store ticket ids, fetch receipts later (about 15 minutes), and record per-recipient outcomes.
6. **Expired tokens.** On `DeviceNotRegistered`, clear that user's `expoPushToken`. Never log tokens.
7. **Idempotency.** Claim a request with a transaction that flips `processed` (or a status field) before sending, so retries and duplicate triggers do not send twice. Set `processed`, `processedAt` and `sentAt` on the notification, record an error summary on failure, and cap retries.

Test only with explicit test recipients on an isolated project.

## SOS does not use this queue

`SosContext` writes `sos_active/{uid}` and `SosAlerts/{uid}` directly and never touches `pushNotificationRequests`. A worker on this queue will not deliver SOS alerts, and a worker on a differently named collection (the review notes call it `sos_alerts`) would not match either path. SOS dispatch and acknowledgement need their own contract that names the real path and its states. Do not connect real responders while that is undefined.

## Native Firebase config (F10)

`config/googleServices.ts` resolves `android.googleServicesFile` from `GOOGLE_SERVICES_JSON`:

1. An existing file path (an EAS **file** secret) is used as-is.
2. A JSON payload (trimmed, starts with `{`) is written to `google-services.json` next to `app.config.ts`, and that path is used.
3. Anything else uses `./google-services.json`.

The contents are never logged. `google-services.json` stays gitignored. `app.config.ts` imports the helper with an explicit `.ts` extension, because Expo's config loader does not resolve extensionless TypeScript imports, and `tsconfig.json` sets `allowImportingTsExtensions` for that.

**For the owner:** `eas.json` is unchanged. Its `preview` profile still sets `GOOGLE_SERVICES_JSON` to the old `@google-services-json` string. That is neither a path nor a payload, so it falls back to `./google-services.json`, which a cloud build will not have. When the new Firebase app exists, create an EAS file secret and point the profile at it, or replace the reference.

## Remaining external work

- New Firebase project, its client config in `.env`/EAS, and `google-services.json`.
- FCM credentials uploaded to the Expo project.
- The worker above, and deploying the Firestore rules.
- A development build on a physical Android device to register a real token and receive a real push.
- Per-installation tokens, logout cleanup, and an SOS dispatch contract.
