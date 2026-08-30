# 🏎️ F1 Track Metrics Lab

> Interactive Formula 1 circuit explorer with 3D visualization, real telemetry comparison, and head-to-head driver analysis.

[![CI](https://github.com/yashyegare/F1TrackMetricsLab/actions/workflows/ci.yml/badge.svg)](https://github.com/yashyegare/F1TrackMetricsLab/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-40%20passing-brightgreen)](#testing)
[![License](https://img.shields.io/badge/license-MIT-blue)](#disclaimer)

**Live Demo →** [f1-track-metrics-lab.vercel.app](https://f1-track-metrics-lab.vercel.app)

---

## ✨ What It Does

Explore every F1 circuit through three interconnected views — 2D map, flat comparison, and immersive 3D — then overlay **real qualifying telemetry** from OpenF1 to see exactly where drivers gain or lose time.

![Feature Showcase](https://img.shields.io/badge/Hover%20for%20details-royalblue?style=for-the-badge)

| View | What You See |
|------|-------------|
| 🗺️ **Map** | Track drawn on Leaflet (street/satellite) with animated lap marker and expandable info panel |
| 📊 **Compare** | Two circuits side-by-side as scaled SVG outlines with full stat comparison |
| 🎮 **3D View** | Interactive WebGL scenes with road ribbon, corner markers, elevation banking, and orbit controls |

---

## 🏁 Features

### 🎯 Three Comparison Modes

- **Side by Side** — Two independent 3D canvases with synced cameras
- **Overlay** — Both tracks superimposed in one scene, normalized to the same scale
- **Flat Compare** — Clean 2D SVG comparison with stats

### ⚡ Real Telemetry (Race Pace)

Pull live data from [OpenF1](https://openf1.org) (2023+ circuits only):

- 🎨 **Speed-colored ribbon** — Blue (slow) → Yellow → Red (fast) heatmap on the 3D track
- 🚗 **Variable-speed car dot** — Slows in corners, surges on straights (real elapsed time)
- 👥 **Driver picker** — Choose any driver from qualifying to compare head-to-head
- 📈 **4-lane telemetry scrubber** — Speed trace, time delta, throttle/brake, gear/DRS
- 🔗 **Bidirectional scrubbing** — Hover the chart → 3D car snaps to that position
- 📐 **Catmull-Rom smoothing** — Cubic interpolation fills the 3.7Hz sampling gaps

### 🧭 Navigation & UX

- ⌘**K Command Palette** — Search circuits, switch modes instantly
- 🔍 **Real-time search** — Filter by name, city, or location
- 🌍 **Filter/sort** — By continent, decade opened, track length, or corner count
- ⌨️ **Keyboard shortcuts** — Arrow keys step circuits, `/` focuses search
- 🔗 **Deep links** — `?circuit=monza&mode=compare3d&vs=spa&racePace=1&year=2024`
- 💾 **State persistence** — Mode, circuits, and preferences survive refresh
- 📱 **Mobile responsive** — Collapsible drawer sidebar, stacked layouts

### 📊 Circuit Data

- 🏆 **Lap records** — Driver, time, year per circuit
- 🟢 **DRS zones** — Zone count with color-coded straights in 2D
- 📅 **Track history** — Years hosted, GP count, layout changes
- 🔗 **Similar tracks** — Algorithm surfaces comparable circuits by length, shape, and region

### 📤 Export & Share

- 📷 **Screenshot** — Download individual 3D canvases as PNG
- 🔗 **Share Card** — Branded 1200×630 comparison image for social media
- 🌐 **Shareable URLs** — Deep links preserve all state including telemetry driver selections

### 🎨 Visual Polish

- 💡 **Bloom-ready** — Post-processing pipeline (needs R3F version bump)
- 🏷️ **Billboard labels** — Start/finish and corner count rendered in WebGL (no DOM layout shifts)
- 🎬 **Cinematic camera** — 800ms ease-out transitions between circuits
- ♿ **Accessibility** — `prefers-reduced-motion`, `focus-visible` outlines, ARIA labels

---

## 🏗️ Architecture

```
React 18 + Vite
├── Zustand (UI state: mode, selectedId, compareId, unit, filters)
├── React Three Fiber + Drei (3D rendering)
├── Leaflet (2D map)
├── Recharts (telemetry scrubber)
├── idb-keyval (IndexedDB cache for telemetry)
└── OpenF1 API (live qualifying telemetry, 2023+)
```

### Performance

- **Code-split Three.js** — 3D chunks load on demand via `React.lazy()` (~420KB initial)
- **Ribbon geometry cache** — Session-level `BufferGeometry` cache avoids rebuilding mesh
- **Projection cache** — Expensive rotation-search alignment cached per circuit+year (LRU, 20 entries)
- **IndexedDB telemetry cache** — Async, unlimited storage (replaces localStorage)

---

## 🧪 Testing

40 tests across 3 suites covering all pure-math utilities:

```bash
npm test
```

| Suite | What's Tested |
|-------|--------------|
| `geometry.test.js` | Haversine distance, cumulative distances, path interpolation, coordinate projection |
| `telemetryProject.test.js` | Catmull-Rom interpolation, speed-to-color mapping, telemetry binning |
| `telemetryAnalysis.test.js` | Time delta calculation, G-force derivation, trace stack preparation |

---

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 📁 Project Structure

```
src/
├── App.jsx                     # Main app, sidebar, deep links, keyboard shortcuts
├── store.js                    # Zustand store (mode, selectedId, filters, etc.)
├── index.css                   # Dark F1-themed styling
├── data/
│   └── circuits.json           # 40 circuits with geometry, metadata, lap records,
│                               # DRS zones, track history, and continent tags
├── components/
│   ├── CommandPalette.jsx      # ⌘K circuit search and mode switching
│   ├── Compare3DPanel.jsx      # 3D comparison (side-by-side + overlay)
│   ├── ComparePanel.jsx        # 2D flat comparison
│   ├── Overlay3DPanel.jsx      # Overlay mode in shared 3D canvas
│   ├── Track3D.jsx             # Single circuit 3D scene
│   ├── TelemetryScrubber.jsx   # 4-lane telemetry trace stack
│   ├── SpeedRibbon.jsx         # Vertex-colored tube mesh
│   └── LapAnimation.jsx        # Animated marker on 2D polyline
└── utils/
    ├── geometry.js             # Lat/lon projection, path interpolation
    ├── track3d.js              # Scene coordinates, corner detection
    ├── telemetryProject.js     # OpenF1 → track alignment via rotation search
    ├── telemetryAnalysis.js    # Time delta, G-forces, trace preparation
    ├── openf1.js               # OpenF1 API client with IndexedDB cache
    ├── ribbonCache.js          # Session-level geometry cache
    └── drsDetect.js            # DRS zone detection from track geometry
```

---

## ⚠️ Disclaimer

Unofficial project, not associated with the Formula 1 companies. F1, FORMULA ONE, and related marks are trademarks of Formula One Licensing B.V.

Track data: [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) (MIT)
Telemetry: [OpenF1](https://openf1.org) (free, public API)
