# Firebase emulator and rules

The repo carries its own Firestore and Storage rules (`firestore.rules`, `storage.rules`), index definitions (`firestore.indexes.json`) and a local emulator setup (`firebase.json`, `.firebaserc`). Everything here runs against the **`demo-sbhra`** project. The `demo-` prefix tells the Firebase CLI that this is a demo project, so the emulators never contact a real Firebase project and no credentials are needed.

## Requirements

- Node (see `.nvmrc`) and `npm install`. `firebase-tools` and `@firebase/rules-unit-testing` are dev dependencies, so there is no global install.
- Java 21 or newer (the Firestore and Storage emulators are JARs). The first run downloads them to `~/.cache/firebase/emulators`.

## Running the checks

```bash
npm run test:emulator
```

This starts the auth, firestore and storage emulators for `demo-sbhra` (ports in `firebase.json`: auth 9099, firestore 8080, storage 9199), runs `jest -c jest.emulator.config.js` over `__emulator__/`, then shuts them down. The normal `npm test` (jest-expo) ignores `__emulator__/` and needs no emulator.

- `__emulator__/rules.test.ts` covers the authorization matrix for unauthenticated, pending, approved member, admin and other-user actors.
- `__emulator__/data.test.ts` runs the real `services/Data.ts` and `FirebaseUserService.ts` code as a signed-in emulator client, subject to the rules. It covers aggregate rebuild preserving identity, ride upload with a failed award followed by a retry, missing-profile creation, profile reads that never write, and the seed script.

## Seeding the emulator

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run seed:emulator
```

`scripts/seedEmulator.ts` refuses to run unless `FIRESTORE_EMULATOR_HOST` is set, and it always targets `demo-sbhra`. It writes four synthetic profiles (`seed-admin`, `seed-member`, `seed-pending`, `seed-legacy`; Firestore documents only, with no Auth accounts) and then runs `seedUsersRbac`, which fills in a missing `role` as `member` and a missing `status` as `pending`, never `approved`. The app itself no longer runs any seeding at launch. On Windows PowerShell, set the variable first with `$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"`.

## Running the app against the emulators

1. Start the emulators and leave them running (the UI is on http://127.0.0.1:4000):

   ```bash
   npx firebase emulators:start --only auth,firestore,storage --project demo-sbhra
   ```

2. In your local `.env` set `FIREBASE_USE_EMULATOR=true`, and set `FIREBASE_EMULATOR_HOST` to an address the device can reach: `127.0.0.1` for web or an iOS simulator, `10.0.2.2` for the Android emulator, or your computer's LAN IP for a phone. For a LAN IP, also change each `host` in `firebase.json` to `0.0.0.0`, and only do that on a trusted network.
3. Restart Expo so `app.config.ts` picks the values up.

Emulator mode only works in development builds (`__DEV__`). It ignores the `FIREBASE_*` project values and always uses `demo-sbhra` with a placeholder API key, so a real project's data can't be reached by mistake. Emulator data is lost when the emulators stop unless you add `--import`/`--export-on-exit`.

## Bootstrapping the first admin

No code path promotes a user to admin or approves a user automatically. The rules only let an existing admin change `role` or `status`, and a new user can only create a `role: 'member'`, `status: 'pending'` profile. The first admin has to be set up outside the app:

- **Emulator:** sign up in the app (this creates `users/{uid}` as a pending member), copy the uid from the Emulator UI's Authentication tab, then run `SEED_ADMIN_UID=<uid> npm run seed:emulator` (with `FIRESTORE_EMULATOR_HOST` set as above). Editing `users/{uid}` in the Emulator UI also works, since the UI bypasses the rules.
- **New Firebase project (owner step):** sign up in the app with the owner account, then in the Firebase console → Firestore → `users/{uid}` set `role: "admin"` and `status: "approved"`. The console bypasses the rules. Every later approval and promotion happens in the app's admin screens.

## What these checks do NOT prove

- **Deployed rules.** Nothing here deploys anything. The new project's rules, Storage rules and indexes must be deployed by the owner (for example `firebase deploy --only firestore,storage` against that project), and the deployed versions should be compared with the files in this repo.
- **Any worker.** `pushNotificationRequests` is a write-only queue. No worker that reads it, sends pushes or records receipts exists in this repo or was tested. A queued request means only "request stored".
- **Indexes.** The emulator does not enforce composite indexes. `firestore.indexes.json` lists the ones the current queries appear to need, but only a real project will report a missing one.
- **Device behaviour.** Nothing ran on a phone, Expo Go or a native build, and no network loss, background, push or SOS delivery was tested.
- **Email verification, App Check and quotas.** The rules gate on `role`/`status` in `users/{uid}`, not on `email_verified`. That policy is still an owner decision.

## Behaviour the rules deliberately deny (follow-ups)

These current client calls are denied by the rules. Each one fails inside an existing `try/catch`, but it is a real behaviour change to track:

- `sendUserSignupNotification` (registration). A pending user cannot write the admin-audience `user_signup` notification or its push request. Admins learn about sign-ups from the admin user list until a trusted function creates these.
- `createTestNotification` (member notifications screen). Members cannot author shared notifications.
- SOS from a signed-out device. `SosContext` falls back to a device id when there is no Auth user. Only an Auth uid can write `sos_active/{uid}`.
- The legacy `fcmToken`/`fcmTokenUpdatedAt` profile fields. The owner may write only `expoPushToken`/`expoPushTokenUpdatedAt` (the renamed token contract).
- Other users' profile documents (for example display names in global stats). Members can read only their own `users/{uid}`, because it holds email and push tokens.

The following are open owner decisions that the rules currently resolve one way:

- **Rides are readable by any approved user,** because the community trail-stats screen reads all rides. Ride paths are location history, so decide whether that is acceptable or whether global stats should come from a trusted aggregate.
- **Exact SOS and presence locations are readable by any approved user,** which matches the current dashboard and online-users screens.
- **Awards are written by the client** under deterministic `{uid}_{achievementId}` ids and are write-once. After a ride upload, and again on every retry of an already-saved ride, `saveRideAndUpdateAggregates` reconciles awards from the stored totals, so a failed award write is filled in on the next sync. A user could still award themselves directly. Move awards to a trusted function if that matters.
- **`recalcUserAggregates` is admin-only** under these rules, because it changes totals without a new ride. It writes only the aggregate fields and `updatedAt`, and it does not create a missing profile.
