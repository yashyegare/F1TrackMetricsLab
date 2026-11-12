# Architecture and engineering decisions

## Application boundaries

- `src/store.js`: navigation, circuit pair, analysis mode, browser-local favorites/preferences. Track comparison keeps a distinct pair; driver analysis derives both sides from the selected circuit.
- `src/services/apiClient.ts` and `src/domain/openf1Schema.ts`: typed request/cache lifecycle and runtime validation. Existing presentation components remain JavaScript; the gradual TypeScript boundary is intentional rather than a claim that the entire application is typed.
- `src/utils/openf1.js`: session selection, lap-window requests, timestamp joins and recorded race-lap count. Missing qualifying never falls back to another session type.
- `src/hooks/useTelemetryForCircuit.js`: one orchestration hook for each side. Every effect owns an AbortController; cancellation prevents stale state updates and releases its network subscription.
- `src/workers/projection.worker.js`: computational track alignment off the main browser thread. Results are cached by sample-array and geometry identity, preventing cross-driver cache collisions. Cancellation terminates the worker.
- `Compare3DPanel`, `RaceDataPanel`, `DriverInsights`, `Overlay3DPanel` and `OverlayScene`: orchestration, race context, recorded timing insight, overlay controls and scene rendering are separate responsibilities.

## Request lifecycle

Queries with identical sorted parameters share one in-flight request. Each consumer has an independent cancellation signal. The underlying request is aborted when its last consumer cancels; cancelling one driver does not break the other. Requests have a 20-second timeout and at most three attempts. Retryable network failures, 429s and server errors use bounded delays; permanent client errors and malformed responses fail directly.

The versioned IndexedDB cache expires after seven days, permits at most 64 entries and budgets approximately 20 MiB of serialized UTF-16 data. Eviction uses timestamps rather than alphabetic keys. Quota and unavailable-storage errors cannot turn a successful network response into an application failure. The byte budget is an estimate of serialization size, not a claim about actual browser database allocation.

## Comparison semantics

Driver timing requires the same circuit, session key and year and distinct drivers. Official lap and sector differences are computed from recorded timing fields. The largest sector difference is descriptive, not a causal explanation of driving technique. A common playback clock drives each lap's own timestamp-to-position timeline. Chart scrubbing uses monotonic recorded travel distance, distinct from the outline's arbitrary start coordinate.

Track comparison normalizes shapes for exploration and exposes no driver-performance delta. Synthetic 90-second gaps and estimated corner timestamps have been removed. Geometry-derived corners/straights and stylized elevation are explicitly labelled.

## Performance tradeoffs

The homepage does not import the 3D scene or charting bundle. Three.js and the analysis workspace remain lazy. Telemetry queries request only the selected lap's date window, instead of downloading all driver-session samples. Worker projection avoids blocking the UI during alignment. Graphics Auto/Low power/High settings bound pixel density and expensive contact shadows; auto mode considers viewport, reduced motion and reported hardware concurrency.

`preserveDrawingBuffer` is retained for reliable image export. It has a rendering cost. Removing it would require an explicit render-on-export path and cross-browser validation. Quality settings are a heuristic, not an FPS guarantee. See measured limitations in performance.md.

## Release safety

The production Vercel build reads public GitHub Actions status for its exact commit SHA and main branch, requiring `test (22)`, `test (24)` and `e2e`. The test jobs include lint, audit, typecheck, tests and build. Missing, failed or skipped checks fail closed; waiting is limited to eight minutes. No GitHub secret is placed in client code. Anonymous GitHub rate limits or outages can block a release; they cannot bypass the gate. Public build previews skip this gate to avoid circular dependencies.

Cloud Run's existing main-only job depends on the test/browser gates. This repository does not provision extra infrastructure or add a database solely for portfolio complexity.

## Remaining limits

- External data can be unavailable, delayed, incomplete or revised. Runtime validation catches schema changes but cannot prove source accuracy.
- Source outlines/archived metadata are not versioned engineering surveys. Calendar metadata requires deliberate source-backed updates.
- Tests exercise recorded contract samples and synthetic browser weekends; they do not guarantee every historical API session.
- Device-level FPS, full Core Web Vitals and container-base-image vulnerability scanning are not claimed as completed measurements.
