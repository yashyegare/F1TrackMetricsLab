# 🏎️ F1 Track Metrics Lab — Complete Project Summary

## What It Is

An interactive Formula 1 circuit explorer that lets you compare any two tracks in 2D or 3D, overlay real telemetry from live OpenF1 data, and see exactly where drivers gain or lose time — all from a single static client-side app with zero backend.

**Live:** [f1-track-metrics-lab.vercel.app](https://f1-track-metrics-lab.vercel.app)
**Repo:** [github.com/yashyegare/F1TrackMetricsLab](https://github.com/yashyegare/F1TrackMetricsLab)

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | **React 18** | Component-based UI, lazy loading for 3D chunks |
| Build | **Vite 5** | Fast HMR, code-splitting, manual chunk config |
| 3D Rendering | **Three.js + React Three Fiber + Drei** | Declarative WebGL scenes, orbit controls, Html/Billboard labels |
| 2D Map | **Leaflet + react-leaflet** | Street/satellite tile layers, animated lap markers |
| Charts | **Recharts** | 4-lane telemetry scrubber (speed, delta, throttle, gear) |
| State | **Zustand** | Single source of truth for UI state, deep-link persistence |
| Telemetry API | **OpenF1** (live, keyless) | Sessions, laps, location, car_data, pit stops, weather, race control |
| Cache | **IndexedDB** via `idb-keyval` | Async, unlimited storage for telemetry arrays (replaces localStorage) |
| Linting | **ESLint 10** + `eslint-plugin-react-hooks` | Catches stale-closure and dependency bugs in useEffect/useMemo |
| Testing | **Vitest** (54 unit tests) + **Playwright** (5 E2E tests) + **React Testing Library** (6 smoke tests) | Pure-math utils, component rendering, full-app navigation |
| Deployment | **Vercel** | Auto-deploy on push to main |

---

## Data Architecture — How the MVP Telemetry Pipeline Works

This is the core differentiator of the project. Here's the exact flow:

### 1. Circuit Selection → OpenF1 Session Lookup

- User picks Circuit A + Circuit B (any of 40 circuits)
- `openf1.js` maps our circuit IDs (e.g. `us-2012`) to OpenF1 names (e.g. `Austin`) via a `CIRCUIT_MAP`
- Calls `GET https://api.openf1.org/v1/sessions?year=2024&circuit_short_name=Austin`
- Finds the Qualifying session (or falls back to Race)

### 2. Fastest Lap / Driver Selection

- Fetches all laps for that session, sorts by `lap_duration`
- User can override with a specific driver via the driver picker
- Fetches driver metadata (`full_name`, `team_name`) in parallel

### 3. Raw Telemetry Fetch

- Two parallel API calls per driver:
  - `GET /v1/location?session_key=X&driver_number=Y` → GPS position (x, y, z + timestamp) at ~3.7Hz
  - `GET /v1/car_data?session_key=X&driver_number=Y` → Speed, throttle, brake, DRS, gear, RPM at same rate
- Both arrays are filtered to the exact lap window using `date_start` + `lap_duration`
- Joined via **two-pointer timestamp merge** (O(n+m) — both arrays are date-sorted)

### 4. Rotation-Search Alignment (the hard part)

- Our track coordinates are lon/lat → local meters (via Haversine projection)
- OpenF1's coordinates are in an arbitrary local system with unknown origin/rotation
- `telemetryProject.js` normalizes both to unit-box scale, then brute-force searches 0–360° in 1° steps (both normal and mirrored orientations), then refines ±5° at 0.1° steps
- For each candidate rotation, it finds the average nearest-point distance from OpenF1 samples to our polyline
- Best rotation wins → each OpenF1 sample gets a `progress` value (0–1) along our track

### 5. Rendering

- Progress values drive everything: ribbon color (speed → blue/yellow/red gradient), car dot position, telemetry charts
- **Catmull-Rom cubic interpolation** (`interpolateSample`) fills gaps between the ~3.7Hz samples for smooth 60fps animation
- Variable-speed car dot: pace calculated from real speed (km/h → progress/second) using actual circuit length in meters

### 6. Caching

- Every OpenF1 response is cached in IndexedDB with a 7-day TTL
- Qualifying data has an in-memory LRU cache (20 entries, bump-on-hit)
- Projection alignment results are cached per circuit+year

### 7. Extended Endpoints (Fastlytics-inspired)

- `getPitStops()` → tire strategy visualization (stint compounds + durations)
- `getRaceControl()` → flag overlay (SC, VSC, yellow, red)
- `getWeather()` → air/track temperature chips
- `getStints()` → actual compound-per-stint data
- `getIntervals()` → gap-to-leader analysis

---

## The Three View Modes

### 🗺️ Map View

- Leaflet with street/satellite toggle
- Animated lap marker moving along the polyline
- Expandable info panel: length, altitude, lap record, DRS zones, track history timeline, similar tracks algorithm

### 📊 2D Compare

- Two scaled SVG outlines side-by-side
- Full stat comparison card (length, corners, altitude, DRS zones, opening year, direction)
- DRS-colored path segments (detected from track geometry via `drsDetect.js`)

### 🎮 3D View (the MVP centerpiece)

- **Side-by-Side:** Two independent R3F canvases with synced cameras
- **Overlay:** Both tracks superimposed in one scene, normalized to same scale
- Road ribbon with corner markers, start/finish line, elevation banking
- Orbit controls with user-driven camera

---

## Special Features

### ⚡ Race Pace (Real Telemetry)

- Speed-colored ribbon (blue→yellow→red heatmap) on the 3D track
- Variable-speed car dots that slow in corners, surge on straights
- Driver head-to-head comparison with live gap readout (+0.34s)
- Ghost trails behind each dot (color-matched, fading over 1–2 seconds)
- Camera auto-follow tracking the leading car
- Corner hover deltas (hover a corner marker → "T4: +0.18s")
- 4-lane telemetry scrubber: Speed trace, Time Delta, Throttle/Brake, Gear/DRS — MoTeC-style
- Bidirectional scrubbing (hover chart → 3D car snaps to position)
- Weather chips (air/track temperature)
- Best theoretical lap calculation
- Tire strategy strip with actual compounds from `/stints` endpoint
- Race control flag overlay (SC, VSC, yellow, red)
- Sector comparison table

### 🧭 Navigation & UX

- ⌘K Command Palette — search circuits, switch modes instantly
- Real-time search filtering by name, city, or location
- Filter/sort by continent, decade opened, track length, corner count
- Arrow key navigation steps through filtered circuit list
- Deep links: `?circuit=monza&mode=compare3d&vs=spa&racePace=1&year=2024`
- State persistence in localStorage (survives refresh)
- Mobile responsive — collapsible drawer sidebar

### 🏗️ Architecture & Reliability

- ErrorBoundary with WebGL upfront detection + `webglcontextlost` handling — falls back to 2D instead of white-screening
- Code-split Three.js (~1.1MB chunk loaded on demand)
- `manualChunks` in Vite — three.js, React, and vendor split for optimal caching
- ESLint with `react-hooks/rules-of-hooks` + `exhaustive-deps` in CI
- Two-pointer telemetry join (O(n+m) instead of O(n·m))
- IndexedDB telemetry cache with 7-day TTL and LRU eviction
- Ribbon geometry session cache
- Projection alignment cache (LRU, 20 entries)
- CI: lint → unit tests → build → E2E (Playwright with Chromium)

### 📤 Export & Share

- Screenshot individual 3D canvases as PNG
- Shareable comparison cards (1200×630 branded social image)
- Deep-linkable URLs preserving all state including telemetry driver selections

### 🎨 Visual Polish

- Billboard labels in WebGL (no DOM layout shifts)
- Cinematic 800ms ease-out camera transitions
- Checkered start/finish markers on each track
- Animated glow on Race Pace button
- Dark F1-themed UI with gradient backgrounds and soft borders
- SVG icons on all nav buttons (Home, Map, Compare, 3D View)

---

## Testing Coverage

| Suite | Tests | What's Covered |
|-------|-------|----------------|
| `geometry.test.js` | 16 | Haversine distance, cumulative distances, path interpolation, coordinate projection |
| `telemetryProject.test.js` | 18 | Catmull-Rom interpolation, speed-to-color mapping, telemetry binning, rotation search |
| `telemetryAnalysis.test.js` | 14 | Time delta calculation, G-force derivation, trace stack preparation |
| `App.test.jsx` | 6 | Landing page, sidebar, map view, search filtering, unit toggle |
| `e2e/app.spec.js` | 5 | Page load, sidebar, map, 3D canvas, search |

**54 unit + smoke tests passing, 0 lint errors.**

---

## Bundle Size (after optimization)

| Chunk | Size | Contents |
|-------|------|----------|
| Main (initial) | ~315KB | React, app code, circuits.json, Leaflet, Recharts |
| three | ~1.1MB | Three.js + R3F + Drei (code-split, lazy-loaded) |
| vendor | Separate | React, ReactDOM, Zustand |

---

## Project Structure

```
src/
├── App.jsx                     # Main app, sidebar, deep links, keyboard shortcuts
├── store.js                    # Zustand store (mode, selectedId, filters, persistence)
├── index.css                   # Dark F1-themed styling (~1800 lines)
├── data/
│   └── circuits.json           # 40 circuits (minified, 128KB) with geometry, metadata,
│                               # DRS zones, track history, lap records
├── components/
│   ├── CommandPalette.jsx      # ⌘K search and mode switching
│   ├── Compare3DPanel.jsx      # 3D comparison (side-by-side + overlay + Race Pace)
│   ├── ComparePanel.jsx        # 2D flat SVG comparison
│   ├── Overlay3DPanel.jsx      # Overlay mode: both tracks in one 3D scene
│   ├── Track3D.jsx             # Single circuit 3D scene (ribbon, corners, car dot)
│   ├── TelemetryScrubber.jsx   # 4-lane Recharts trace stack
│   ├── SpeedRibbon.jsx         # Vertex-colored tube mesh
│   ├── LandingHero.jsx         # Landing page with feature showcase
│   ├── ErrorBoundary.jsx       # WebGL detection + render error fallback
│   └── LapAnimation.jsx        # Animated marker on 2D polyline
├── hooks/
│   └── useTelemetryForCircuit.js # Extracted telemetry data-fetching hook
├── utils/
│   ├── geometry.js             # Lat/lon projection, path interpolation
│   ├── track3d.js              # Scene coordinates, corner detection
│   ├── telemetryProject.js     # OpenF1 → track alignment via rotation search
│   ├── telemetryAnalysis.js    # Time delta, G-forces, trace preparation
│   ├── openf1.js               # OpenF1 API client with IndexedDB cache
│   ├── ribbonCache.js          # Session-level geometry cache
│   ├── drsDetect.js            # DRS zone detection from track geometry
│   └── types.js                # JSDoc typedefs for all data shapes
├── __tests__/
│   └── App.test.jsx            # React Testing Library smoke tests
e2e/
│   └── app.spec.js             # Playwright E2E tests
docs/screenshots/               # Placeholder SVGs for README
.github/workflows/ci.yml        # GitHub Actions: lint → test → build → E2E
eslint.config.js                # ESLint flat config with react-hooks plugin
playwright.config.js            # Playwright config
jsconfig.json                   # checkJs for utils layer
```

---

## Disclaimer

Unofficial project, not associated with the Formula 1 companies. F1, FORMULA ONE, and related marks are trademarks of Formula One Licensing B.V.

Track data: [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) (MIT)
Telemetry: [OpenF1](https://openf1.org) (free, public API)
