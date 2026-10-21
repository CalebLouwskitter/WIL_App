# geo-core: plan for a reusable geo toolkit and portfolio apps

Status: plan agreed with Caleb (2026-10-21). No new repository has been
created yet; that waits on his go-ahead.

## Why

WIL_App solved a set of problems that come up in any location-based app:
recording GPS tracks in the background, surviving app kills, saving data
offline and syncing it later, putting user-reported points on a map, and
showing other users live. The SBHRA app wraps all of this in horse-riding
specifics (Sardinia Bay trails, horses, SOS). The idea is to pull out the
generic parts as a standalone library, **geo-core**, and build portfolio apps
on top of it.

## Ownership and what may be reused

WIL_App was a five-person university project for SBHRA. The README says the
app is SBHRA's property, all rights reserved. Caleb's view is that most of
the code is his and that the rights he signed over still leave him free to
reuse his own work. **The agreement he signed is what actually decides
this, so re-read it before geo-core goes public.** Until then the plan
follows these rules:

- **Reuse only Caleb's own code, and rewrite it rather than copy it.** Per
  git blame, he wrote nearly all of the Firebase data layer (`services/Data.ts`),
  the obstacle, sighting, observation and notification services, the admin
  screens, ride recovery (`RideStateManager`, `RideRecoveryContext`) and most
  of the background ride tracker. The offline sync queue and GPX export on
  this branch are new.
- **Don't port teammates' code.** That covers geofencing (`utils/geofencing.ts`),
  trail snapping (`utils/routeSnapping.ts`), trail data, SOS and the
  analytics/Excel export. Where geo-core needs the same capability
  (point-in-polygon, snap-to-line), implement it fresh from the textbook
  algorithm or use a library such as Turf.
- **Nothing SBHRA-specific:** no trail coordinates, logos, Firebase project
  config, user data or wording.
- Every module is rewritten generically and covered by tests, so geo-core is
  a new work rather than a fork of WIL_App.

## Structure: standalone repo, published package

Caleb chose a standalone core repository that apps consume as a dependency.

```
geo-core/                         new GitHub repo (CalebLouwskitter/geo-core)
  src/
    geo/        pure TS math: haversine, bearing, bbox, Douglas-Peucker
                simplification, point-in-polygon, snap-to-polyline, geohash
    track/      track recorder state machine: start/pause/resume/stop,
                accuracy and jitter filtering, distance/elevation/speed stats,
                crash recovery from a persisted session
    sync/       offline outbox: stable client ids, idempotent upserts,
                serialised storage writes, retry on reconnect/foreground,
                per-user scoping, conflict policy hooks
    features/   map feature model: typed point/line/polygon features with
                category, status, media and author; clustering; heat grid
                aggregation; status workflow helpers
    io/         GPX and GeoJSON import/export, CSV for point features
    presence/   opt-in live location sharing with coarse precision and
                area-gated broadcasting
  adapters/     platform bindings, each a separate entry point:
    expo/                 expo-location + expo-task-manager tracker,
                          NetInfo/AppState sync triggers
    async-storage/        storage adapter (MMKV/SQLite can come later)
    firestore/            backend adapter: converters, batched upserts,
                          geohash range queries
    react-native-maps/    <TrackLine>, <FeatureLayer>, <HeatLayer>, <ClusterLayer>
  examples/expo-demo/     small app used to exercise the adapters on a device
  test/                   unit tests for src/ (runs in plain Node)
```

Design rules:

- `src/` has no React Native or Firebase imports, so the core is testable in
  Node and backend-agnostic. Platform code lives only in `adapters/`, and
  each adapter is an optional peer dependency.
- Interfaces first: `StorageAdapter`, `BackendAdapter`, `LocationSource` and
  `ConnectivitySource`. A Supabase or REST backend can be added without
  touching the core.
- Build with tsup (ESM + CJS + types), use package.json `exports` subpaths
  (`geo-core`, `geo-core/expo`, `geo-core/firestore`,
  `geo-core/react-native-maps`), and version with Changesets. Publish to npm
  once the API settles; until then apps can depend on the Git URL.
- CI: typecheck, unit tests and a size check on every PR.

### Where each module comes from

| geo-core module | Pattern taken from (WIL_App) | Approach |
|---|---|---|
| `sync/` outbox | `services/RideStorage.ts` (this branch) | generalise from rides to any record type |
| `adapters/firestore` | `services/Data.ts` converters, `createDoc`/`upsertDoc`/`listDocs` | rewrite with a generic converter factory |
| `track/` recorder and recovery | `RideStateManager`, `BackgroundRideTracker`, `RideRecoveryContext` | rewrite as a platform-free state machine plus an Expo adapter |
| `features/` | obstacle, sighting, observation and report services | one generic feature model replaces four near-duplicate services |
| `presence/` | `OnlineUserService` (mostly Caleb's) | rewrite, adding privacy controls |
| `io/` GPX | `utils/gpx.ts` (this branch) | extend with GeoJSON and import |
| `geo/` polygon/snap | teammates' geofencing and snapping | **not ported**: fresh implementation or Turf |

## Portfolio apps

### 1. Civic issue reporter (first consumer)

A community app for reporting potholes, broken streetlights, illegal dumping
and water leaks.

- Report in a few taps: photo, category, pin (GPS or dragged), short note.
  Reports save offline and sync later (`sync/`).
- A public map clusters reports and shows a heat layer of open issues
  (`features/`, `adapters/react-native-maps`).
- A status workflow (reported → verified → in progress → fixed): residents
  upvote and confirm, and moderators verify and close. This builds on the
  admin/approval screens Caleb built for WIL_App.
- A ward/area dashboard: open vs fixed counts and time-to-fix, with CSV and
  GeoJSON export for councillors (`io/`).
- Portfolio angle: a real South African problem, offline-first for patchy
  coverage, moderation and roles, and clean geo data export.

### 2. Field sightings (second consumer)

A citizen-science app for logging birds, wildlife and plants.

- Offline sightings with photos, species, count and notes, plus an optional
  "survey walk" mode that records a GPS track (`track/`).
- Species layers, seasonal heatmaps and a "near me" feed using geohash queries.
- Export to GeoJSON/CSV for research groups; GPX for survey walks.
- Portfolio angle: proves the core is reusable, since about 70% of the
  features come straight from geo-core with a different feature schema.

Not chosen for now: an adventure tracker (offline GPX recording, replay,
segments). It is the closest to WIL_App and the least distinctive.

## Suggested order of work

1. Create the `geo-core` repo, scaffold it (tsup, tests, CI) and write `geo/`
   and `io/` first: pure functions that are easy to test.
2. `sync/` outbox plus the async-storage and Firestore adapters, generalised
   from the WIL_App ride queue.
3. `features/` and the react-native-maps layers.
4. Start the civic reporter app on geo-core, adding to the core only when the
   app needs something.
5. `track/` and `presence/` when Field sightings needs survey walks.

Open decisions for later: the package name (`geo-core` may be taken on npm,
so possibly `@caleblouwskitter/geo-core`), the licence (MIT is the usual
portfolio choice), and Firestore vs Supabase as the first backend for the
civic app.
