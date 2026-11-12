# F1 Track Metrics Lab

An unofficial circuit explorer and qualifying-lap comparison tool. Built with React, Three.js, Leaflet, Recharts and OpenF1.

[Live application](https://f1-track-metrics-lab.vercel.app/) · [Architecture and engineering decisions](docs/architecture.md) · [Measured performance](docs/performance.md)

## Start locally

Use Node 22.12+ (CI covers Node 22 and 24).

```sh
npm ci
npm run dev
```

Open http://localhost:5174. To validate changes:

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm audit --audit-level=moderate
node scripts/benchmark.mjs
```

Playwright requires its Chromium browser: `npx playwright install chromium`.

## What to try

1. Explore a circuit on the map, save a favorite, or reopen a recent track.
2. Open **3D View → Compare drivers**. Select the circuit, qualifying year and two different drivers.
3. Read the recorded lap/sector differences, expand the sampled telemetry traces, and scrub the distance axis.
4. Play the synchronized side-by-side replay. The clock is shared; each driver follows their own recorded timeline.
5. Use **Compare tracks** for normalized track geometry. Cross-track replay does not claim to measure driver performance.

Example deep link:

`/?circuit=us-2012&mode=compare3d&analysis=drivers&racePace=1&year=2024&driverA=4&driverB=16`

The legacy `racePace` URL flag is retained for existing links; the UI correctly calls the source qualifying telemetry.

## Data provenance and limits

- Circuit outlines and archived metadata: [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits). An archived lap record or DRS count may belong to an earlier season/layout.
- Recorded telemetry, lap/sector timing and race context: [OpenF1](https://openf1.org/docs/), historical coverage from 2023. Qualifying is never silently replaced with a race or sprint session.
- Corner counts, straight sections and track direction are inferred from geometry. Green highlights are inferred straights, **not verified DRS locations**.
- Elevation, banking, road width and object heights are stylized. This is not a driving simulator or engineering survey.
- Distance traces use sampled location data and interpolation. Their delta is an estimate; the recorded lap and sector times remain the timing reference. Conditions and qualifying runs may differ.
- Race length is the maximum recorded completed lap in the matching race session. Missing race timing stays unavailable; there is no fixed lap-count fallback.
- Calendar collection is the **announced 2026 calendar**, with a linked FIA source. It is not a live schedule.

## Reliability and tests

The suite covers geometry, telemetry interpolation, data mapping, session integrity, request cancellation, timeout/retry behavior, cache isolation, schema contracts and production gating. Browser tests cover discovery, mobile layouts, favorites, same-session driver analysis, deep links, missing sessions and cross-track safeguards. Test counts are deliberately not hardcoded into badges; CI is the source of truth.

Recorded public API samples under `src/services/__tests__/fixtures/` test schema compatibility. Browser fixtures under `e2e/fixtures/` are explicitly synthetic and deterministic. Live API availability remains outside the app's control.

## Release process

GitHub CI runs strict linting, TypeScript checks for the domain/service boundaries, the complete dependency audit, unit tests, build and browser tests. Vercel production builds wait for the exact main-branch commit's required checks; unavailable or failed checks stop the release. Preview builds and local builds do not wait for production checks. [Release design](docs/architecture.md#release-safety)

The optional [Cloud Run deployment](docs/cloud-run-setup.md) remains gated by CI. No API key is needed for the historical OpenF1 endpoints used here. Favorites, preferences and recent tracks remain in this browser.

## Ownership and attribution

The repository integrates open-source rendering, mapping, charting and data services; it does not claim to implement their internals. See the architecture notes for application-owned logic, tradeoffs and remaining limitations. This project is not associated with Formula 1, the FIA, or their companies.
