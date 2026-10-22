# SBHRA Mobile Application

## Overview

The **SBHRA Mobile Application** was developed for the **Sardinia Bay
Horse Riders Association (SBHRA)** to streamline trail usage
documentation, animal sighting reports, and rider safety tracking.

Built with **Expo / React Native**, **Firebase**, and **Google Maps**, the
app ensures accurate, real-time data collection to meet compliance
requirements and enhance the rider experience.

------------------------------------------------------------------------

## Features

-   **Horse Management**: Track individual horse profiles, ride stats,
    and achievements.\
-   **GPS Trail Tracking**: Real-time ride tracking with official trail
    identification. Rides are saved on the device first and uploaded
    when there is signal, so a ride recorded offline is not lost.\
-   **GPX Export**: Share any ride as a `.gpx` file from the ride details
    screen (Strava, Garmin Connect, Google Earth, QGIS).\
-   **Obstacle & Trail Updates**: Riders can log trail issues or
    obstructions.\
-   **SOS Alert System**: Emergency alerts with live location sharing.\
-   **Animal Sightings**: Document sightings with photos, notes, and
    checklist categories.\
-   **Analytics Dashboard**: View community and personal stats, export
    reports (monthly, quarterly, annual).\
-   **Admin Controls**: Manage user access, view aggregated ride data,
    generate compliance reports.

------------------------------------------------------------------------

## Technology Stack

-   **App**: Expo (SDK 57) / React Native, TypeScript, React Navigation
-   **Backend**: Firebase (Authentication, Firestore, Cloud Messaging)
-   **Mapping & GPS**: react-native-maps (Google Maps), expo-location,
    expo-task-manager for background tracking

------------------------------------------------------------------------

## Installation & Setup

### Prerequisites

-   Node.js 22 or newer (see `.nvmrc`)
-   A Firebase project with Authentication (email/password) and
    Firestore enabled
-   A Google Maps API key (Maps SDK for Android, and iOS if needed)
-   For Android push notifications: the Firebase `google-services.json`
-   Android Studio and/or Xcode if you build locally; otherwise an
    [Expo](https://expo.dev) account for EAS cloud builds

For an interface review, use **Expo Go for SDK 57** and start the server
with `npx expo start --go`. Full feature testing requires a **development
build** because Expo Go does not include background location or Android
remote push notifications.

### Steps

1.  Clone the repository and install dependencies:

    ``` bash
    git clone https://github.com/CalebLouwskitter/WIL_App.git
    cd WIL_App
    npm install
    ```

2.  Configure environment variables. Copy `.env_default` to `.env` and
    fill in the Firebase web config and Google Maps keys.
    `app.config.ts` reads them and passes them to the app. Check them with:

    ``` bash
    npm run check-firebase
    ```

3.  For Android push notifications, place `google-services.json` in the
    project root (it is git-ignored). EAS builds can instead read it from
    the `GOOGLE_SERVICES_JSON` environment variable.

4.  Build and run a development build on a device or emulator:

    ``` bash
    npx expo run:android
    npx expo run:ios
    ```

    Or build in the cloud with EAS (`npx eas-cli build --profile preview
    --platform android`). Once a dev build is installed, `npm start`
    serves the JavaScript.

5.  Checks:

    ``` bash
    npm run typecheck
    npm test
    ```

------------------------------------------------------------------------

## Usage

1.  **Register/Login** via Firebase Authentication.\
2.  **Set up your Profile** (rider + horse details).\
3.  **Start a Ride** → enables GPS tracking.\
4.  **During Ride**: log obstacles, sightings, or use SOS if needed.\
5.  **End Ride**: review summary, save, and sync with Firebase.\
6.  **Admins**: access analytics dashboard for compliance reports.

------------------------------------------------------------------------

## Contribution

Team members and contributions: - **Joshua Suth** -- Profile,
Achievements, Horse Management, Reporting\
- **Sam** -- Analytics Dashboard\
- **Caleb** -- Firebase Integration, Reports & Sightings, Dashboard\
- **Logan** -- Mapping Functionality\
- **Kyle** -- Dashboard + SOS System

------------------------------------------------------------------------

## License

This application is the property of **SBHRA**.\
All rights reserved © 2025.
