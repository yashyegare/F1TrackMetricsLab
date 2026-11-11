import React from 'react';
import { useStore } from '../store';
import circuits from '../data/circuits.json';

function Outline({ circuit }) {
  const latitude = circuit.lat * Math.PI / 180;
  const points = circuit.coordinates.map(([x, y]) => [x * Math.cos(latitude), -y]);
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const width = Math.max(...xs) - minX, height = Math.max(...ys) - minY;
  const scale = Math.min(260 / (width || 1), 140 / (height || 1));
  const path = points.map(([x,y]) => `${30 + (260 - width * scale) / 2 + (x-minX)*scale},${20 + (140-height*scale)/2 + (y-minY)*scale}`).join(' ');
  return <svg viewBox="0 0 320 180" aria-hidden="true"><polyline points={path} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function LandingHero() {
  const selectedId = useStore(s => s.selectedId);
  const setSelectedId = useStore(s => s.setSelectedId);
  const setCompareId = useStore(s => s.setCompareId);
  const compareId = useStore(s => s.compareId);
  const setMode = useStore(s => s.setMode);
  const selected = circuits.find(c => c.id === selectedId) ?? circuits.find(c => c.id === 'us-2012') ?? circuits[0];
  const open = (mode, circuit = selected) => {
    setSelectedId(circuit.id);
    if (!compareId || compareId === circuit.id) setCompareId(circuits.find(c => c.id !== circuit.id).id);
    setMode(mode);
  };
  return <div className="landing-hero"><div className="landing-content">
    <section className="lab-introduction"><div><p className="landing-badge">THE CIRCUIT WORKSPACE</p><h1 className="landing-title">F1 Track Metrics Lab</h1><p className="landing-subtitle">Understand the layout.<br />Find where the difference is made.</p><p className="lab-landing-copy">Explore circuit maps, compare track shapes, and examine historical qualifying telemetry. Start with a circuit; go deeper when you need to.</p><div className="landing-actions"><button className="landing-btn primary" onClick={() => open('map')}>Explore circuit <span aria-hidden="true">→</span></button><button className="landing-btn secondary" onClick={() => open('compare3d')}>Compare in 3D</button></div><p className="lab-landing-hint">Search the circuit list or press Ctrl / ⌘ K to jump anywhere.</p></div>
    <aside className="lab-selected-preview" aria-label={selected.name}><div className="lab-preview-label">YOUR SELECTED CIRCUIT</div><Outline circuit={selected} /><h2>{selected.location}</h2><p>{(selected.length / 1000).toFixed(3)} km · Selected circuit</p><button onClick={() => open('map')}>Open circuit map ↗</button></aside></section>
    <div className="lab-capabilities"><span><strong>{circuits.length}</strong> circuits to explore</span><span>Map · 2D comparison · 3D view</span><span>Historical telemetry from 2023</span></div>
    <section className="lab-ways"><p className="landing-badge">CHOOSE YOUR VIEW</p><div className="lab-view-options"><button onClick={() => open('map')}><span>01 / MAP</span><strong>Get your bearings</strong><p>Layout, location, and circuit history.</p></button><button onClick={() => open('compare')}><span>02 / COMPARE</span><strong>See the differences</strong><p>Two track outlines and their key statistics.</p></button><button onClick={() => open('compare3d')}><span>03 / 3D & TELEMETRY</span><strong>Explore in depth</strong><p>Interactive layouts and available driver traces.</p></button></div></section>
    <section className="lab-featured"><h2>Start somewhere iconic.</h2><div>{['mc-1929','gb-1948','jp-1962'].map(id => { const circuit = circuits.find(c => c.id === id); return <button key={id} onClick={() => open('map', circuit)}><Outline circuit={circuit} /><strong>{circuit.location}</strong><span>{(circuit.length/1000).toFixed(3)} km <span aria-hidden="true">↗</span></span></button>; })}</div></section>
    <footer className="landing-footer"><p>Telemetry availability depends on the circuit and session. Track geometry and inferred visual details are not a driving simulator.</p><div className="landing-footer-links"><a href="https://nextjs-app-yashyegare.vercel.app/">Race Lab ↗</a><a href="https://github.com/yashyegare/F1TrackMetricsLab">Project & source</a><a href="https://openf1.org">OpenF1</a><a href="https://github.com/bacinger/f1-circuits">Circuit data</a></div><p className="landing-disclaimer">Unofficial fan project. Not associated with the Formula 1 companies.</p></footer>
  </div></div>;
}
