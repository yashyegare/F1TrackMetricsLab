import {it,expect} from 'vitest';
import {getCachedEdges,getCachedRibbonGeometry,cacheSize} from '../ribbonCache';
it('never reuses a same-circuit ribbon across different coordinate scales',() => {
  const a=[[0,0],[10,0],[10,10],[0,10]],b=[[0,0],[1,0],[1,1],[0,1]];
  const ea=getCachedEdges('same',a,1),eb=getCachedEdges('same',b,1);
  const ga=getCachedRibbonGeometry('same',a,ea,[]),gb=getCachedRibbonGeometry('same',b,eb,[]);
  expect(ga).not.toBe(gb);expect(ea).not.toBe(eb);
  expect(getCachedRibbonGeometry('same',a,ea,[])).toBe(ga);
});
it('bounds the GPU geometry cache',() => {
  for(let i=0;i<70;i++) {
    const points=[[0,0],[1,0],[1,1]];
    getCachedRibbonGeometry(`c${i}`,points,getCachedEdges(`c${i}`,points,1),[]);
  }
  expect(cacheSize()).toBeLessThanOrEqual(64);
});
