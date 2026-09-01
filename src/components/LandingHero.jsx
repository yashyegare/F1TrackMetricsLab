import React from 'react';
import { useStore } from '../store';

const features = [
  { icon: '🗺️', title: 'Interactive Map', desc: 'Leaflet-powered map with animated lap marker, street/satellite toggle, and circuit info panel', color: '#e10600' },
  { icon: '🎮', title: '3D Track Visualization', desc: 'WebGL ribbon with elevation banking, corner markers, orbit controls, and cinematic camera transitions', color: '#00a3ff' },
  { icon: '⚡', title: 'Real Telemetry', desc: 'Live qualifying data from OpenF1 — speed-colored ribbons, variable-speed car dots, and driver head-to-head', color: '#ffcc00' },
  { icon: '📊', title: 'Telemetry Scrubber', desc: 'MoTeC-style 5-lane trace stack: speed, time delta, throttle/brake, gear/DRS, and RPM', color: '#00cc44' },
  { icon: '🏁', title: 'Race Context', desc: 'Tire strategy strips, pit stop durations, race control flags, and sector-by-sector comparisons', color: '#ff6b00' },
  { icon: '🔗', title: 'Deep Links & Sharing', desc: 'Shareable URLs preserve full state — circuit, mode, drivers, telemetry year. Branded PNG export cards', color: '#a855f7' },
];

const stats = [
  { value: '40', label: 'Circuits' },
  { value: '24', label: 'Countries' },
  { value: '2023+', label: 'Telemetry' },
  { value: '3', label: 'View Modes' },
];

const techStack = [
  { name: 'React', desc: 'UI framework' },
  { name: 'Three.js', desc: '3D rendering' },
  { name: 'Leaflet', desc: 'Map tiles' },
  { name: 'Recharts', desc: 'Data charts' },
  { name: 'Zustand', desc: 'State mgmt' },
  { name: 'OpenF1', desc: 'Live data' },
];

const shortcuts = [
  { keys: '⌘ K', action: 'Command palette' },
  { keys: '/', action: 'Search' },
  { keys: '← →', action: 'Navigate' },
  { keys: '1 2 3', action: 'View mode' },
];

export default function LandingHero() {
  const setMode = useStore(s => s.setMode);
  const setSelectedId = useStore(s => s.setSelectedId);

  return (
    <div className="landing-hero">
      <div className="landing-content">
        {/* Hero */}
        <div className="landing-hero-section">
          <div className="landing-badge">UNOFFICIAL F1 TRACK EXPLORER</div>
          <h1 className="landing-title">
            F1 Track <span className="landing-accent">Metrics</span> Lab
          </h1>
          <p className="landing-subtitle">
            Interactive circuit explorer with 3D visualization, real telemetry comparison,
            and head-to-head driver analysis across every modern F1 track.
          </p>

          <div className="landing-actions">
            <button className="landing-btn primary" onClick={() => { setSelectedId('us-2012'); setMode('map'); }}>
              🗺️ Explore Tracks
            </button>
            <button className="landing-btn secondary" onClick={() => { setSelectedId('us-2012'); setMode('compare3d'); }}>
              🎮 3D Compare
            </button>
            <button className="landing-btn ghost" onClick={() => { setSelectedId('us-2012'); setMode('compare'); }}>
              📊 2D Compare
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="landing-stats">
          {stats.map((s, i) => (
            <div key={i} className="landing-stat">
              <span className="landing-stat-value">{s.value}</span>
              <span className="landing-stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Features */}
        <div className="landing-section">
          <h2 className="landing-section-title">Everything you need to explore F1 tracks</h2>
          <div className="landing-features">
            {features.map((f, i) => (
              <div key={i} className="landing-feature" style={{ '--accent': f.color }}>
                <div className="landing-feature-icon-wrap" style={{ background: `${f.color}15`, borderColor: `${f.color}30` }}>
                  <span className="landing-feature-icon">{f.icon}</span>
                </div>
                <div className="landing-feature-body">
                  <h3 className="landing-feature-title">{f.title}</h3>
                  <p className="landing-feature-desc">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tech stack */}
        <div className="landing-section">
          <h2 className="landing-section-title">Built with</h2>
          <div className="landing-tech">
            {techStack.map((t, i) => (
              <div key={i} className="landing-tech-item">
                <span className="landing-tech-name">{t.name}</span>
                <span className="landing-tech-desc">{t.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Keyboard shortcuts */}
        <div className="landing-section">
          <h2 className="landing-section-title">Keyboard shortcuts</h2>
          <div className="landing-shortcuts">
            {shortcuts.map((s, i) => (
              <div key={i} className="landing-shortcut">
                <kbd className="landing-kbd">{s.keys}</kbd>
                <span className="landing-shortcut-action">{s.action}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="landing-footer">
          <div className="landing-footer-links">
            <a href="https://github.com/yashyegare/F1TrackMetricsLab" target="_blank" rel="noopener noreferrer">GitHub</a>
            <span className="landing-footer-dot">·</span>
            <a href="https://openf1.org" target="_blank" rel="noopener noreferrer">OpenF1 API</a>
            <span className="landing-footer-dot">·</span>
            <a href="https://github.com/bacinger/f1-circuits" target="_blank" rel="noopener noreferrer">Track Data</a>
          </div>
          <p className="landing-disclaimer">
            Unofficial project, not associated with Formula 1 companies.
          </p>
        </div>
      </div>
    </div>
  );
}
