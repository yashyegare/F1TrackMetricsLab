import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const memory = vi.hoisted(() => new Map());
vi.mock('idb-keyval',() => ({get:vi.fn(async key => memory.get(key)),set:vi.fn(async (key,value) => memory.set(key,value)),del:vi.fn(async key => memory.delete(key)),keys:vi.fn(async () => [...memory.keys()])}));
import { fetchAPI, cacheKey, oldestFirst } from '../apiClient';
const rows = [{driver_number:1,full_name:'Driver One'}];
const response = (body:unknown,status=200,headers={}) => ({ok:status===200,status,json:async () => body,headers:new Headers(headers)});
describe('validated request lifecycle',() => {
  beforeEach(() => {memory.clear();vi.stubGlobal('fetch',vi.fn());});
  afterEach(() => {vi.useRealTimers();vi.unstubAllGlobals();});
  it('deduplicates matching requests and caches valid results',async () => {
    vi.mocked(fetch).mockResolvedValue(response(rows) as Response);
    const [a,b] = await Promise.all([fetchAPI('drivers',{session_key:1}),fetchAPI('drivers',{session_key:1})]);
    expect(a).toEqual(b);expect(fetch).toHaveBeenCalledTimes(1);
    await fetchAPI('drivers',{session_key:1});expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('rejects malformed and non-array responses',async () => {
    vi.mocked(fetch).mockResolvedValue(response({error:'invalid'}) as Response);
    await expect(fetchAPI('drivers',{session_key:2})).rejects.toThrow('Invalid drivers');
    expect(memory.size).toBe(0);
  });
  it('retries a rate limit after the server delay',async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValueOnce(response([],429,{'retry-after':'1'}) as Response).mockResolvedValue(response(rows) as Response);
    const request=fetchAPI('drivers',{session_key:3});
    await vi.advanceTimersByTimeAsync(1100);
    expect(await request).toEqual(rows);expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('does not retry permanent client errors',async () => {
    vi.mocked(fetch).mockResolvedValue(response([],404) as Response);
    await expect(fetchAPI('drivers',{session_key:4})).rejects.toThrow('404');expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('cancels one subscriber while preserving its sibling',async () => {
    let release:(value:Response) => void = () => {};
    vi.mocked(fetch).mockImplementation(() => new Promise(resolve => {release=resolve;}));
    const controller=new AbortController();
    const first=fetchAPI('drivers',{session_key:5},controller.signal);
    const rejected=expect(first).rejects.toMatchObject({name:'AbortError'});
    const second=fetchAPI('drivers',{session_key:5});
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    controller.abort();release(response(rows) as Response);
    await rejected;expect(await second).toEqual(rows);
  });
  it('aborts the network when its last subscriber leaves',async () => {
    let network:AbortSignal|undefined;
    vi.mocked(fetch).mockImplementation((_url,options) => new Promise((_resolve,reject) => {
      network=options?.signal as AbortSignal;network.addEventListener('abort',() => reject(new DOMException('Cancelled','AbortError')));
    }));
    const controller=new AbortController();
    const request=fetchAPI('drivers',{session_key:6},controller.signal);
    const rejected=expect(request).rejects.toMatchObject({name:'AbortError'});
    await vi.waitFor(() => expect(network).toBeDefined());controller.abort();await rejected;expect(network?.aborted).toBe(true);
  });
  it('times out a stalled server request',async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation((_url,options) => new Promise((_resolve,reject) => options?.signal?.addEventListener('abort',() => reject(new DOMException('Timeout','AbortError')))));
    const request=fetchAPI('drivers',{session_key:7});
    const rejected=expect(request).rejects.toThrow('timed out');await vi.advanceTimersByTimeAsync(20001);await rejected;
  });
  it('evicts by timestamp rather than alphabetic key',() => {
    expect(oldestFirst([['z',{ts:1,bytes:1,data:[]}],['a',{ts:2,bytes:1,data:[]}]]).map(([key]) => key)).toEqual(['z','a']);
    expect(cacheKey('drivers',{b:2,a:1})).toBe(cacheKey('drivers',{a:1,b:2}));
  });
});
