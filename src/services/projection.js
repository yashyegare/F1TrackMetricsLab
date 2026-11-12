import { projectTelemetry, binTelemetry } from '../utils/telemetryProject';

// Cache by the actual lap sample array and coordinate array identities. This
// cannot accidentally reuse another driver's ribbon for the same circuit/year.
const results = new WeakMap();
export async function projectLap(coordinates,telemetry,signal) {
  if (signal?.aborted) throw new DOMException('Cancelled','AbortError');
  const cached = results.get(telemetry)?.get(coordinates);
  if (cached) return cached;
  const start = performance.now();
  const result = typeof Worker === 'undefined' ? (() => {
    const {projected} = projectTelemetry(coordinates,telemetry);
    return {projected,binned:binTelemetry(projected,coordinates.length)};
  })() : await new Promise((resolve,reject) => {
    const worker = new Worker(new URL('../workers/projection.worker.js',import.meta.url),{type:'module'});
    let timer;
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort',cancel); worker.terminate(); };
    const cancel = () => { cleanup(); reject(new DOMException('Cancelled','AbortError')); };
    signal?.addEventListener('abort',cancel,{once:true});
    timer = setTimeout(() => { cleanup(); reject(new Error('Track alignment timed out.')); },20000);
    worker.onmessage = ({data}) => { cleanup(); data.error ? reject(new Error(data.error)) : resolve(data); };
    worker.onerror = () => { cleanup(); reject(new Error('Track alignment could not be completed.')); };
    worker.postMessage({coordinates,telemetry});
  });
  if (signal?.aborted) throw new DOMException('Cancelled','AbortError');
  performance.measure('telemetry-projection',{start,duration:performance.now()-start});
  let byTrack = results.get(telemetry);
  if (!byTrack) { byTrack = new WeakMap(); results.set(telemetry,byTrack); }
  byTrack.set(coordinates,result);
  return result;
}
