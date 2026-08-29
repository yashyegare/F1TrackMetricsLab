# F1 Circuits

An interactive map of Formula 1 circuit layouts — inspired by [f1.svemir.co](https://f1.svemir.co) / [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits).

Built with React + Vite + Leaflet, plus [three.js](https://threejs.org) (via [react-three-fiber](https://docs.pmnd.rs/react-three-fiber) / [drei](https://github.com/pmndrs/drei)) for the 3D comparison view. Track outlines and metadata (length, altitude, year opened, first GP) are bundled locally in `src/data/circuits.json`, pulled from the `bacinger/f1-circuits` GeoJSON dataset — no external API calls at runtime.

## Modes

- **Map** — the track drawn on a live Leaflet map (street/satellite), with an animated lap marker.
- **Compare** — two tracks side by side as flat, same-size-card SVG outlines.
- **3D View** — two tracks side by side as interactive 3D scenes (drag to rotate, scroll to zoom), each with a road-width ribbon, numbered corner markers, a start/finish gantry, and computed stats (corner count, spin direction, longest straight) derived from the track outline.

## Run it locally

```bash
npm install
npm run dev
```

Then open the printed local URL (usually `http://localhost:5173`).

## Build for production

```bash
npm run build
npm run preview   # to test the production build locally
```

The output goes to `dist/` — deployable as-is to any static host (Vercel, Netlify, GitHub Pages, Cloudflare Pages, etc.).

## Project structure

```
src/
  App.jsx        # map, sidebar circuit list, info panel, mode switching
  index.css      # dark F1-themed styling
  data/
    circuits.json  # merged track geometry + metadata (40 circuits)
  components/
    ComparePanel.jsx    # flat 2D side-by-side comparison
    Compare3DPanel.jsx  # 3D side-by-side comparison + stats
    Track3D.jsx          # single circuit's three.js scene
    LapAnimation.jsx     # animated marker along the 2D map polyline
  utils/
    geometry.js  # lat/lon <-> local meters, lap interpolation
    track3d.js   # 3D scene coords, corner detection, direction, longest straight
  main.jsx       # React entry point
```

## Updating circuit data

The `bacinger/f1-circuits` repo adds/updates circuits occasionally (e.g. new street circuits). To refresh `src/data/circuits.json`, re-download the `.geojson` files from that repo's `circuits/` folder plus `f1-locations.json`, and re-run the merge script that combines geometry + location metadata into one JSON array.

## Ideas to extend

- Real per-corner data (braking zones, DRS zones, apex speed) instead of the geometric corner-detection heuristic in `utils/track3d.js`.
- An actual elevation profile — the dataset only has one altitude value per circuit, so the 3D view is flat; per-point elevation would let the ribbon rise and fall.
- Sync the two 3D cameras in "3D View" mode so rotating one rotates both.
- Animate a car/marker driving the 3D ribbon, mirroring the existing 2D lap animation.
- Toggle between satellite and the current dark basemap (the `TileLayer` URL is a single line to swap).

## A note on the 3D view

`Track3D.jsx` builds a flat road-width ribbon from the same outline coordinates used on the 2D map, offsetting each point left/right by half the (stylized) track width to form the mesh — then adds pole-mounted corner markers and a checkered start/finish gantry, with `@react-three/drei`'s `<Html>` used to project small DOM labels onto their 3D positions (the same general technique — a 3D scene with camera-projected DOM overlays — used for the point labels on [landonorris.com/on-track](https://landonorris.com/on-track), which is also built on three.js). Corner count, spin direction, and longest-straight stats come from `utils/track3d.js`, computed geometrically from the outline — there's no lap-timing data in the source dataset, so treat them as illustrative, not official.

## Disclaimer

This project is unofficial and not associated with the Formula 1 companies. F1, FORMULA ONE, FORMULA 1, and related marks are trademarks of Formula One Licensing B.V. Track data source: [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) (MIT licensed).
