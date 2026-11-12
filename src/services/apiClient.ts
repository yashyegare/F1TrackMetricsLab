import { get, set, del, keys } from 'idb-keyval';
import { validateResponse, type ApiRow } from '../domain/openf1Schema';

const BASE = 'https://api.openf1.org/v1';
const PREFIX = 'openf1_v2_';
const TTL = 7 * 24 * 60 * 60 * 1000;
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_ENTRIES = 64;
type CacheEntry = { data:ApiRow[]; ts:number; bytes:number };
type Job = { controller:AbortController; consumers:number; promise:Promise<ApiRow[]> };
const pending = new Map<string,Job>();
let writes = Promise.resolve();
const abortError = () => new DOMException('Request cancelled','AbortError');

export function cacheKey(endpoint:string, params:Record<string,unknown>) {
  const entries = Object.entries(params).filter(([,v]) => v != null).sort(([a],[b]) => a.localeCompare(b));
  return PREFIX+endpoint+'_'+new URLSearchParams(entries.map(([k,v]) => [k,String(v)])).toString();
}
export function oldestFirst(entries:Array<[string,CacheEntry]>) {
  return [...entries].sort((a,b) => a[1].ts-b[1].ts);
}
async function readCache(key:string, endpoint:string) {
  try {
    const item = await get<CacheEntry>(key);
    if (!item) return null;
    if (Date.now()-item.ts > TTL) { await del(key); return null; }
    return validateResponse(endpoint,item.data);
  } catch { return null; }
}
async function writeCache(key:string, data:ApiRow[]) {
  const bytes = JSON.stringify(data).length*2;
  if (bytes > MAX_BYTES) return;
  const write = async () => {
    try {
      const ids = (await keys()).filter((id):id is string => typeof id === 'string' && id.startsWith(PREFIX));
      const entries = (await Promise.all(ids.filter(id => id !== key).map(async id => [id,await get<CacheEntry>(id)] as const)))
        .filter((pair):pair is readonly [string,CacheEntry] => !!pair[1]);
      let size = entries.reduce((sum,[,entry]) => sum+(entry.bytes || MAX_BYTES),0)+bytes;
      let count = entries.length+1;
      for (const [id,entry] of oldestFirst(entries.map(([id,item]) => [id,item]))) {
        if (size <= MAX_BYTES && count <= MAX_ENTRIES) break;
        await del(id); size -= entry.bytes || MAX_BYTES; count--;
      }
      await set(key,{data,ts:Date.now(),bytes});
    } catch { /* Private mode and quota failures must not break a successful response. */ }
  };
  writes = writes.then(write,write);
  await writes;
}
function pause(ms:number,signal:AbortSignal) {
  return new Promise<void>((resolve,reject) => {
    if (signal.aborted) { reject(abortError()); return; }
    const stop = () => { clearTimeout(timer); reject(abortError()); };
    const timer = setTimeout(() => { signal.removeEventListener('abort',stop); resolve(); },ms);
    signal.addEventListener('abort',stop,{once:true});
  });
}
async function download(endpoint:string,params:Record<string,unknown>,signal:AbortSignal) {
  const qs = new URLSearchParams(Object.entries(params).filter(([,v]) => v != null).map(([k,v]) => [k,String(v)]));
  for (let attempt=0;attempt<3;attempt++) {
    if (signal.aborted) throw abortError();
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal.addEventListener('abort',cancel,{once:true});
    const timeout = setTimeout(cancel,20000);
    let delay:number;
    try {
      const res = await fetch(`${BASE}/${endpoint}?${qs}`,{signal:controller.signal});
      if (res.status === 429 || res.status >= 500) {
        if (attempt === 2) throw new Error('Telemetry service is busy. Please retry shortly.');
        const retryAfter = Number(res.headers.get('retry-after'));
        delay = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter*1000,10000) : 1000*2**attempt;
      } else {
        if (!res.ok) throw new Error(`Telemetry request failed (${res.status}).`);
        return validateResponse(endpoint,await res.json());
      }
    } catch (error) {
      if (signal.aborted) throw abortError();
      if (error instanceof DOMException && error.name === 'AbortError') throw new Error('Telemetry request timed out. Please retry.',{cause:error});
      if (!(error instanceof TypeError) || attempt === 2) throw error;
      delay = 1000*2**attempt;
    } finally { clearTimeout(timeout); signal.removeEventListener('abort',cancel); }
    await pause(delay,signal);
  }
  throw new Error('Telemetry unavailable.');
}

// Each subscriber can cancel independently. Only the last cancellation stops
// a shared network request, so comparing two drivers never cancels its sibling.
export function fetchAPI(endpoint:string,params:Record<string,unknown> = {},signal?:AbortSignal):Promise<ApiRow[]> {
  if (signal?.aborted) return Promise.reject(abortError());
  const key = cacheKey(endpoint,params);
  let job = pending.get(key);
  if (!job) {
    const controller = new AbortController();
    job = {controller,consumers:0,promise:Promise.resolve([])};
    const current = job;
    job.promise = (async () => {
      const cached = await readCache(key,endpoint);
      if (controller.signal.aborted) throw abortError();
      if (cached) return cached;
      const data = await download(endpoint,params,controller.signal);
      await writeCache(key,data);
      return data;
    })().finally(() => { if (pending.get(key) === current) pending.delete(key); });
    pending.set(key,job);
  }
  job.consumers++;
  const shared = job;
  return new Promise((resolve,reject) => {
    let done = false;
    const finish = (action:() => void) => {
      if (done) return; done=true; signal?.removeEventListener('abort',cancel); shared.consumers--; action();
    };
    const cancel = () => finish(() => {
      if (!shared.consumers) { shared.controller.abort(); if (pending.get(key) === shared) pending.delete(key); }
      reject(abortError());
    });
    signal?.addEventListener('abort',cancel,{once:true});
    shared.promise.then(value => finish(() => resolve(value)),error => finish(() => reject(error)));
    if (signal?.aborted) cancel();
  });
}
