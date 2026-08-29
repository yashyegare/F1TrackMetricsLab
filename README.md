# F1 Track Metrics Lab

Interactive Formula 1 circuit explorer with 2D map, flat comparison, and 3D visualization modes. Built with React, Vite, Leaflet, and Three.js.

Track data (outlines, metadata, lap records, DRS zones, history) sourced from [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) — no external API calls at runtime.

## Features

### Views

- **Map** — track drawn on a live Leaflet map (street/satellite) with animated lap marker and expandable info panel
- **Compare** — two circuits side by side as scaled SVG outlines with stats
- **3D View** — interactive 3D scenes with road ribbon, corner markers, start/finish gantry, and synthetic elevation banking

### 3D Comparison

- **Side by Side** — two independent 3D canvases with orbit controls and auto-rotate
- **Overlay** — both tracks superimposed in one scene, normalized to the same scale, semi-transparent with color-coded legend
- Elevation exaggeration derived from circuit altitude, applied as corner banking (labeled as stylized)

### Circuit Data

- **Lap records** — driver, time, year per circuit
- **DRS zones** — zone count per circuit
- **Track history** — years hosted, total GP count, layout change notes
- **Similar tracks** — algorithm surfaces comparable circuits by length, shape, and region

### Navigation & UX

- **Filter/sort** — by continent, decade opened, track length, or corner count
- **Search** — real-time text search across circuit names and locations
- **Keyboard shortcuts** — arrow keys to step through circuits, `/` to focus search
- **Deep links** — `?circuit=monza&mode=compare3d&vs=spa` for shareable/bookmarkable views
- **localStorage persistence** — mode, selected circuits, and unit preference survive page refresh

### Responsive

- **Mobile drawer** — collapsible sidebar with hamburger toggle at ≤768px
- **Info panel** — glowing collapsible panel on the map, expandable on tap

### Units

- Toggle between metric (km/m) and imperial (mi/ft) across all views

### Performance

- **Code-split Three.js** — initial bundle ~420KB; 3D chunks load on demand via `React.lazy()`
- **Ribbon geometry cache** — session-level cache avoids rebuilding mesh when switching circuits

## Run locally

```bash
npm install
npm run dev
```

## Build for production

```bash
npm run build        # output in dist/
npm run preview      # test production build locally
```

Deployable as-is to any static host (Vercel, Netlify, GitHub Pages, Cloudflare Pages).

## Project structure

```
src/
  App.jsx                    # main app, sidebar, deep links, keyboard shortcuts
  index.css                  # dark F1-themed styling
  data/
    circuits.json            # 40 circuits with geometry, metadata, lap records,
                             # DRS zones, track history, and continent tags
  components/
    ComparePanel.jsx         # flat 2D side-by-side comparison
    Compare3DPanel.jsx       # 3D side-by-side + overlay toggle
    Track3D.jsx              # single circuit 3D scene with elevation banking
    Overlay3DPanel.jsx       # overlay comparison in shared 3D canvas
    LapAnimation.jsx         # animated marker on 2D map polyline
  utils/
    geometry.js              # lat/lon projection, lap interpolation
    track3d.js               # scene coords, corner detection, direction, straights
    ribbonCache.js           # session-level BufferGeometry cache
  main.jsx                   # React entry point
```

## Disclaimer

Unofficial project, not associated with the Formula 1 companies. F1, FORMULA ONE, and related marks are trademarks of Formula One Licensing B.V. Track data: [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) (MIT).
