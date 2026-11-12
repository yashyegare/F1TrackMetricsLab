# Performance measurements

Measured locally on Windows with Node v25.4.0 on 2026-11-12. These are reproducible local observations, not real-user monitoring results.

## Alignment baseline

`node scripts/benchmark.mjs` uses a synthetic 171-sample Austin-outline fixture and runs 12 projections, discarding the first two warm-ups. Observed median: **183.81 ms**; observed slowest/p95 sample in ten runs: **192.05 ms**. Synthetic speed/timestamps do not represent a real lap.

That main-thread-sized task justifies worker execution. Browser alignment now runs in a dedicated worker; User Timing entries named `telemetry-projection` include startup, messaging and computation. The worker changes responsiveness rather than claiming to reduce the algorithm's CPU cost. No fabricated before/after FPS improvement is reported.

## Bundle observations

The Vite 8 build reports approximately **99.28 kB gzip** for the initial application JS chunk, plus small shared runtime/state chunks. The previous build's main chunk was approximately **97.24 kB gzip**. Reliability features therefore add a small initial cost rather than making the first load smaller.

The lazy Three.js chunk is approximately **328.61 kB gzip**, and the lazy analysis workspace, including charts and validation, is approximately **150.75 kB gzip**. The projection worker is approximately **3.22 kB uncompressed**. The sizeable optional 3D workspace remains a known optimization area. Build output is the source of truth because filenames and sizes change with implementation.

## Network and device behavior

Unit tests assert that car-data and location requests carry selected-lap start/end filters. Browser tests exercise the worker and complete driver-analysis flow against deterministic fixtures. API responses are deduplicated and cached. No percentage payload reduction is claimed without a matched real-session measurement.

To assess a target device: open DevTools Performance, record initial load and a driver change, inspect `telemetry-projection`, long tasks, resource transfer sizes and frame rate; repeat with Low power and High graphics. Capture browser/device/network conditions before comparing runs. Real-user LCP/INP/CLS targets need field measurements; they are not represented by these CPU microbenchmarks.
