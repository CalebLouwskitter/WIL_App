# F07 – blank map: device test procedure

F07: on the Samsung Galaxy S24 Ultra (Android 17, Expo Go 57.0.9) the Dashboard preview, the Map tab and the Trail Report map stayed black with no tiles, while the location hook reported a current fix. **The cause is not proven.** This document says what the source shows, what is only a hypothesis, and how to tell the causes apart on a phone.

Versions under test: Expo SDK 57.0.31, React Native 0.86.3, react-native-maps 1.27.2 (matches `expo/bundledNativeModules.json` for SDK 57).

## 1. What changed in the app for this test

Every map on these three screens now reports its own status, separate from location:

| Map | Log label | Where |
| --- | --- | --- |
| Dashboard preview | `dashboard-preview` | `screens/Dashboard/DashboardScreen.tsx` |
| Map tab (`MapViewTracker`) | `tracker` | `components/MapViewTracker.tsx` |
| Trail Report location map | `report` | `screens/Mapping/UnifiedRideObstacleScreen.tsx` |

Status phases (`utils/mapStatus.ts`, hook `hooks/useMapStatus.ts`, UI `components/MapStatusFrame.tsx`):

| Phase | Meaning | What you see |
| --- | --- | --- |
| `starting` | Mounted, waiting for `onMapReady` | Pill "Starting map…" |
| `ready` | `onMapReady` fired, waiting for `onMapLoaded` (tiles drawn) | Pill "Loading map tiles…" |
| `loaded` | `onMapLoaded` fired | Pill disappears |
| `failed:not-ready` | No `onMapReady` within 15 s | Card "Map couldn't load" + hint + Retry |
| `failed:tiles-timeout` | `onMapReady` but no `onMapLoaded` within 10 s | Card + hint + Retry |
| `failed:no-size` | Timed out and the map's layout was 0 wide or 0 high | Card + layout hint + Retry |
| `failed:error` | Rendering the map threw (caught by an error boundary) | Card + message + Retry |

Retry remounts the native map view (new React key) and starts the timers again. Tiles that arrive after a timeout recover the map on their own.

The card's grey details line repeats the status, for example `failed:tiles-timeout size=384x200 attempt=1 · Expo Go`. It contains no coordinates.

**Dev logs** (Metro terminal, `__DEV__` builds only), one line per change, never coordinates:

```
[map:dashboard-preview] starting size=no layout yet attempt=1 +0ms android/expo-go
[map:dashboard-preview] starting size=384x200 attempt=1 +41ms android/expo-go
[map:dashboard-preview] ready size=384x200 attempt=1 +620ms android/expo-go
[map:dashboard-preview] failed:tiles-timeout size=384x200 attempt=1 +10630ms android/expo-go
```

`size` is the map's own `onLayout` size in dp. `+ms` is the time since mount, or since the last Retry.

Google documents that `onMapLoaded` (Android `OnMapLoadedCallback`) fires once all tiles needed to draw the map have been fetched. It "will not fire if the map never loads due to connectivity issues" ([Google Maps Android API reference, `GoogleMap.OnMapLoadedCallback`](https://developers.google.com/android/reference/com/google/android/gms/maps/GoogleMap.OnMapLoadedCallback)). That is why "ready but never loaded" is the tiles signal.

## 2. Static findings

**C** = confirmed in source or config introspection. **H** = hypothesis; it needs a device.

| # | Finding | Status |
| --- | --- | --- |
| 1 | **No screen forces Google.** `MapViewTracker` uses `provider={PROVIDER_DEFAULT}` (`components/MapViewTracker.tsx:319`). The Dashboard and Report maps set no provider. `PROVIDER_GOOGLE` is imported in `UnifiedRideObstacleScreen.tsx:20` but never used. On Android, react-native-maps has only the Google Maps SDK, so every map here is Google Maps on Android. On iOS, all three use Apple Maps. | C |
| 2 | **Keys in `app.config.ts`.** Android: `android.config.googleMaps.apiKey = GOOGLE_MAPS_API_KEY ?? ''`. iOS: `ios.config.googleMapsApiKey = IOS_GOOGLE_MAPS_API_KEY ?? GOOGLE_MAPS_API_KEY ?? ''`. There is no `.env` in this checkout, so both are empty. | C |
| 3 | **Does a key reach the Android manifest?** `npx expo config --type introspect` with `GOOGLE_MAPS_API_KEY` unset: **no** `com.google.android.geo.API_KEY` meta-data. With a placeholder value: the meta-data is present. So the existing config path works, and a build made without the variable has no Maps key at all. (Introspection only, not a real prebuild.) | C |
| 4 | **Expo's documented path differs.** The SDK 57 MapView docs configure the Android key with the `react-native-maps` config plugin (`plugins: [['react-native-maps', { androidGoogleMapsApiKey }]]`). They also require Maps SDK for Android to be enabled, the key restricted to the package name and SHA-1, and a rebuild ([docs.expo.dev/versions/v57.0.0/sdk/map-view](https://docs.expo.dev/versions/v57.0.0/sdk/map-view/)). The legacy `android.config.googleMaps.apiKey` path still introspects correctly (finding 3), so this is a docs mismatch, not a proven defect. | C (mismatch) / H (impact) |
| 5 | **Expo Go does not use the app's key.** The app config's manifest entries apply only at prebuild. The SDK 57 docs say "No additional setup is required when testing your project using Expo Go." **So in Expo Go, the empty `GOOGLE_MAPS_API_KEY` cannot be the cause.** Whether Expo Go's own Google Maps setup works on Android 17 / S24 Ultra is unknown. | C (key not used) / H (Expo Go works) |
| 6 | **No dark style.** No `customMapStyle` anywhere. react-native-maps' Android code does not handle `userInterfaceStyle` (only iOS does), and the app sets `userInterfaceStyle: 'light'`. A dark map theme is therefore not what makes the surface black. | C |
| 7 | **No `liteMode` and no `googleRenderer` override.** The preview uses neither, so every map uses the default `LATEST` renderer (`react-native-maps/android/.../MapManager.java:102`). | C |
| 8 | **`mapType`.** The tracker defaults to `'standard'`; the other two maps don't set it (standard). | C |
| 9 | **Map tab overlays.** The screen background is `#0f172a`. Over the map sit a full-screen `LinearGradient` at 15 % alpha (`LiveTrackingScreen.tsx:432`, `pointerEvents="none"`) and a top gradient at 0 % alpha. Neither can hide tiles; at most they tint them. The dark green → black → dark blue seen in screenshots 24/38 is consistent with a black map tinted by that gradient. | C (overlays) / H (reading of screenshot) |
| 10 | **Zero-height parent.** None is visible in source. Dashboard: map is `absoluteFill` in a 200 dp container. Report: `flex: 1` in a 300 dp wrapper. Map tab: `flex: 1` in `absoluteFill`. In screenshots 26 and 36 the Google logo shows at the bottom-left of the black area. The native SDK draws that logo, so those map views existed and had a real size. The new `size=` log is the proof to collect. | C (source) / H (screenshot) |
| 11 | **Report map `loadingEnabled`.** It has `loadingBackgroundColor="#FAF9F7"` (`UnifiedRideObstacleScreen.tsx:1076`). In react-native-maps 1.27.2 Android, that off-white loading layer stays until `onMapLoaded` (`MapView.java:1039`, `:690`, `:1742`). Screenshot 36 shows black, not off-white. So either `onMapLoaded` fired (the SDK thought it had drawn) or the loading layer is not drawn above the map surface on this device. The new log answers this. | C (code) / H (meaning) |
| 12 | **Location is separate.** `MapViewTracker` gets its own fix and silently falls back to a world view on denial (`MapViewTracker.tsx:189-190`). A location fix says nothing about tiles. The map status UI is independent of the location banner. | C |
| 13 | **Drawer.** The `PanResponder` was created once and closed over `bottomSheetExpanded = false`. While dragging up it set a negative value, so the sheet moved away from the finger. Once open, a tap snapped it shut while state still said open. Fixed in this branch: a ref, pure logic in `utils/bottomSheet.ts`, tap to toggle, and a larger touch area. Screenshots 24/25/38 also show a "Firebase not enabled…" toast lying over the handle, which can swallow the drag. That toast is out of scope here (demo-noise work). | C (code) / H (cause of the one failed drag) |

Leading hypotheses, none proven:

- **H-A:** Expo Go's Google Maps on Android 17 / One UI can't fetch or draw tiles (its key, Play services, renderer).
- **H-B:** The `LATEST` renderer draws a black surface on this device.
- **H-C:** The network blocks Google tile hosts.

The empty app key (finding 2) matters only for development and store builds, not Expo Go.

## 3. Procedure A: Expo Go on the phone

Needs: the phone with USB debugging, `adb` on the PC, the same Wi-Fi as the PC, and Expo Go 57.0.9.

1. On this branch, run `npm ci` once if needed, then `npx expo start`. Open the project in Expo Go.
2. In a second terminal: `adb logcat -c`, then
   `adb logcat | grep -iE "Google Maps|Authorization failure|API key|MapsInitializer|maps|rnmaps"`.
3. Before testing the drawer, dismiss any toast lying over the bottom of the screen (its ✕).
4. **Dashboard.** Wait 20 s. Note the pill text, then the final state, and copy every `[map:dashboard-preview]` line.
5. **Map tab.** Wait 30 s (15 s ready plus 10 s tiles, with margin). Copy the `[map:tracker]` lines. Note the card or pill below the orange banner.
6. **Report.** Dashboard → Sightings / Reports → report tab → scroll to "Mark Location on Map". Wait 20 s and copy the `[map:report]` lines. Check that the location banner ("Using your current location.") and the map card show independent statuses.
7. On any card, press **Retry** once. Note whether the result repeats (`attempt=2`).
8. **Network split.** Switch Wi-Fi → mobile data (or the reverse) and press Retry on each map. In the Google Maps app on the same phone, check that tiles load on that network.
9. **Drawer** (Map tab, not riding):
   - tap the handle: it opens; tap again: it closes;
   - drag up more than 50 dp: it opens; drag down more than 50 dp: it closes (this was the broken case);
   - a short drag snaps back;
   - while dragging, the sheet follows the finger;
   - with TalkBack, the handle reads "Show ride controls, button" and a double-tap toggles it;
   - when open, "Active Horse", "Start Ride" and "Recent" are fully visible and tappable.
10. Record the results (template in section 6).

## 4. Procedure B: development build (configured)

This needs a Google Cloud project you control. **Never commit a key**, and never paste a key into this doc or an issue.

1. Enable **Maps SDK for Android**. Create an API key restricted to Android apps: package `com.sbhra.app` plus the SHA-1 of the build's signing certificate. For a local debug build, that is the debug keystore's SHA-1. For EAS, use the project's Credentials page.
2. Put the key in an untracked `.env` as `GOOGLE_MAPS_API_KEY=…` (for EAS, as a project environment variable).
3. Check that it reaches the manifest without building:
   `npx expo config --type introspect --json` → `_internal.modResults.android.manifest` must contain `com.google.android.geo.API_KEY`. Check for the meta-data's presence; don't print the value.
4. Build and run:
   - **Local:** `npx expo run:android` (a debug build, so the `[map:…]` logs appear in Metro).
   - **EAS:** the `preview` profile in `eas.json`. It is a release APK, so it has no dev logs; read the card's details line and `adb logcat`. It also needs the `GOOGLE_SERVICES_JSON` secret that the profile references.

   There is no `development` (dev-client) profile and `expo-dev-client` is not installed. Adding them is a separate decision.
5. Repeat steps 3–9 of Procedure A.
6. **Control run (optional, most informative):** build once *without* the key. Expect `ready` → `failed:tiles-timeout`, and logcat lines like "Authorization failure" / "API key not found". That records this phone's "missing key" signature for comparison with what Expo Go shows.
7. **Renderer experiment (only if the map reaches `loaded` and is still black):** temporarily add `googleRenderer="LEGACY"` to one map on a local branch, rebuild, and compare. Don't commit it without evidence.

## 5. Telling the causes apart

| Observation (status + logs) | logcat | Points to | Next check |
| --- | --- | --- | --- |
| Stuck `starting` → `failed:not-ready`, `size` non-zero | Exceptions from maps / Play services | Native map never initialised (Expo Go / Play services / native module) | Update Google Play services; try a dev build; capture the exception |
| `failed:no-size`, or `size=…x0` | — | **Layout**: parent has no width or height | Inspect parent styles on that screen and size |
| `ready` → `failed:tiles-timeout` | "Authorization failure", "API key", "Ensure that the Maps SDK for Android is enabled" | **Key / API setup** (dev or store build) | Key restriction (package + SHA-1), API enabled, billing. In Expo Go, report to Expo instead: the app key is not used there |
| `ready` → `failed:tiles-timeout`, recovers after a network switch + Retry | No auth errors; maybe `UnknownHost` / timeouts | **Network** (blocked tile hosts, captive portal, DNS) | Google Maps app on the same network; another network |
| `ready` → `failed:tiles-timeout` on Android, while an iOS device (Apple Maps) loads tiles on the same build | — | **Android Google provider** specific, not JS or layout | Compare Expo Go vs dev build on Android |
| `loaded` reached but the screen is black or dark | No errors | **Rendering**, not tile fetch as far as the SDK knows (renderer / GL surface / something drawn above it) | Renderer experiment (B7); compare the Dashboard, which has no overlays, with the Map tab |
| `failed:error` | JS error in Metro | **Render exception** (message is shown on the card) | Fix the thrown error |
| Location banner says OK but the map failed | — | Expected: location and tiles are separate | Don't treat a fix as map success |

## 6. Screens and sizes to try

- **S24 Ultra** (about 412 × 891 dp) in Expo Go and in a dev build.
- **A small phone or emulator** (about 360 × 640 dp, e.g. an Android emulator "Small Phone"):
  - the Dashboard card must fit in the 200 dp preview (it uses the compact layout);
  - on the Map tab the card is centred, and the open drawer (300 dp) may cover its lower edge, so close the drawer to reach Retry;
  - the drawer's controls must fit inside 300 dp.
- **Font scale 1.3** on both. The hint text wraps; check that Retry stays visible.
- **iOS device or simulator** if one is available, as the Apple Maps comparison for the provider split.

Result template (one row per map, per environment):

| Env (Expo Go / dev build) | Device + size | Map | Log sequence (phases + ms) | `size` | Card shown | logcat key/net lines | After Retry | Network switch |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

## 7. What this branch does not prove

- It does not fix tiles. It makes the failure visible and classifiable.
- Classifications are hints from callbacks and timeouts. Confirm a key cause with logcat, and a network cause by switching networks.
- No device, development build, key or network test was run in this branch. The drawer gesture is tested only as pure logic.
- `RideStatsScreen`, `RideViewMoreScreen` and `OnlineUsers` also contain maps. They are not instrumented yet; each can adopt `MapWithStatus` the same way the Report map does.
