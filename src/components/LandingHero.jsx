import React from 'react';
import { useStore } from '../store';

const features = [
  { icon: '🗺️', title: 'Map View', desc: 'Track drawn on interactive Leaflet map with animated lap marker' },
  { icon: '🎮', title: '3D Visualization', desc: 'Interactive WebGL scenes with road ribbon and orbit controls' },
  { icon: '⚡', title: 'Race Pace Telemetry', desc: 'Real qualifying data from OpenF1 — speed-colored ribbons and variable-speed dots' },
  { icon: '👥', title: 'Driver Comparison', desc: 'Pick any two drivers and see exactly where they gain or lose time' },
  { icon: '📊', title: 'Telemetry Scrubber', desc: '4-lane trace stack: speed, time delta, throttle/brake, gear/DRS' },
  { icon: '🔗', title: 'Shareable Links', desc: 'Deep links preserve circuit, mode, drivers, and telemetry state' },
];

const shortcuts = [
  { keys: '⌘ K', action: 'Open command palette' },
  { keys: '/', action: 'Focus search' },
  { keys: '← →', action: 'Step through circuits' },
  { keys: '1 2 3', action: 'Switch view mode' },
];

export default function LandingHero() {
  const setMode = useStore(s => s.setMode);
  const setSelectedId = useStore(s => s.setSelectedId);

  const handleExplore = () => {
    setSelectedId('us-2012'); // COTA
    setMode('map');
  };

  const handleCompare = () => {
    setSelectedId('us-2012');
    setMode('compare3d');
  };

  return (
    <div className="landing-hero">
      <div className="landing-content">
        <div className="landing-badge">UNOFFICIAL F1 TRACK EXPLORER</div>
        <h1 className="landing-title">
          F1 Track <span className="landing-accent">Metrics</span> Lab
        </h1>
        <p className="landing-subtitle">
          Interactive circuit explorer with 3D visualization, real telemetry comparison,
          and head-to-head driver analysis across 40 F1 tracks.
        </p>

        <div className="landing-actions">
          <button className="landing-btn primary" onClick={handleExplore}>
            🗺️ Explore Tracks
          </button>
          <button className="landing-btn secondary" onClick={handleCompare}>
            🎮 3D Compare
          </button>
        </div>

        <div className="landing-features">
          {features.map((f, i) => (
            <div key={i} className="landing-feature">
              <span className="landing-feature-icon">{f.icon}</span>
              <div>
                <h3 className="landing-feature-title">{f.title}</h3>
                <p className="landing-feature-desc">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="landing-shortcuts">
          <h3 className="landing-shortcuts-title">Keyboard Shortcuts</h3>
          <div className="landing-shortcuts-grid">
            {shortcuts.map((s, i) => (
              <div key={i} className="landing-shortcut">
                <kbd className="landing-kbd">{s.keys}</kbd>
                <span>{s.action}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="landing-disclaimer">
          Unofficial project. Track data from{' '}
          <a href="https://github.com/bacinger/f1-circuits" target="_blank" rel="noopener noreferrer">
            bacinger/f1-circuits
          </a>
          . Telemetry from{' '}
          <a href="https://openf1.org" target="_blank" rel="noopener noreferrer">
            OpenF1
          </a>
          .
        </p>
      </div>
    </div>
  );
}
