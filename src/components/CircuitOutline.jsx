import React, { useMemo } from 'react';

export default function CircuitOutline({ circuit }) {
  const points = useMemo(() => {
    const local = circuit.coordinates.map(([x,y]) => [x * Math.cos(circuit.lat * Math.PI / 180), -y]);
    const xs = local.map(p => p[0]), ys = local.map(p => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    const width = Math.max(...xs)-x, height = Math.max(...ys)-y;
    const scale = 80 / (Math.max(width,height) || 1);
    return local.map(([a,b]) => `${10+(80-width*scale)/2+(a-x)*scale},${10+(80-height*scale)/2+(b-y)*scale}`).join(' ');
  }, [circuit]);
  return <svg viewBox="0 0 100 100" className="circuit-outline" aria-hidden="true"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
