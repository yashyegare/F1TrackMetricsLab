/**
 * RaceControlOverlay — displays race control flags (SC, VSC, yellow, red) as
 * an overlay strip on the telemetry charts.
 */
import React from 'react';

const FLAG_STYLES = {
  'Yellow': { bg: '#ffd700', text: '#000', icon: '🟡', label: 'YELLOW' },
  'SC': { bg: '#ffa500', text: '#000', icon: '🏎️', label: 'SC' },
  'VSC': { bg: '#ff8c00', text: '#000', icon: '⚡', label: 'VSC' },
  'Red': { bg: '#e10600', text: '#fff', icon: '🔴', label: 'RED' },
  'Chequered': { bg: '#333', text: '#fff', icon: '🏁', label: 'END' },
};

function getFlagStyle(flag, category, message) {
  // Try flag field first
  if (flag) {
    const key = Object.keys(FLAG_STYLES).find(k =>
      flag.toLowerCase().includes(k.toLowerCase())
    );
    if (key) return FLAG_STYLES[key];
  }
  // Fallback to category field (SC/VSC may live here instead of flag)
  if (category) {
    const cat = category.toLowerCase();
    if (cat.includes('virtual')) return FLAG_STYLES['VSC'];
    if (cat.includes('safety') || cat === 'sc') return FLAG_STYLES['SC'];
    if (cat.includes('yellow')) return FLAG_STYLES['Yellow'];
    if (cat.includes('red')) return FLAG_STYLES['Red'];
  }
  // Fallback to message text
  if (message) {
    const msg = message.toLowerCase();
    if (msg.includes('safety car')) return FLAG_STYLES['SC'];
    if (msg.includes('virtual safety car')) return FLAG_STYLES['VSC'];
    if (msg.includes('red flag')) return FLAG_STYLES['Red'];
    if (msg.includes('yellow')) return FLAG_STYLES['Yellow'];
  }
  return null;
}

const FIELD_STYLES = FLAG_STYLES;

/**
 * Render flag markers as a horizontal strip.
 * `flags` is an array of { flag, lap_number, message, date }.
 * `sessionDateStart` is the ISO date of the session start for progress mapping.
 */
export default function RaceControlOverlay({ flags, totalLaps, sessionDateStart }) {
  if (!flags || flags.length === 0) return null;

  // Filter to interesting flags (skip non-flag messages)
  const flagEvents = flags.filter(f =>
    (f.flag && f.flag !== '') ||
    (f.category && (f.category.toLowerCase().includes('safety') || f.category.toLowerCase().includes('virtual') || f.category.toLowerCase().includes('yellow') || f.category.toLowerCase().includes('red')))
  );

  if (flagEvents.length === 0) return null;

  return (
    <div className="race-control-strip">
      <div className="race-control-header">
        <span className="race-control-title">🏁 Race Control</span>
        <span className="race-control-count">{flagEvents.length} events</span>
      </div>
      <div className="race-control-events">
        {flagEvents.map((event, i) => {
          const style = getFlagStyle(event.flag, event.category, event.message) || { bg: '#444', text: '#fff', icon: '🚩', label: event.flag || event.category || 'FLAG' };
          return (
            <div
              key={i}
              className="race-control-event"
              title={`${event.flag} — Lap ${event.lap_number}: ${event.message || ''}`}
            >
              <div className="race-control-marker" style={{ backgroundColor: style.bg, color: style.text }}>
                {style.icon}
              </div>
              <div className="race-control-tooltip" style={{ borderColor: style.bg }}>
                <strong style={{ color: style.bg }}>{style.label}</strong>
                <div style={{ fontSize: 10, color: '#9a9aa0', marginTop: 2 }}>Lap {event.lap_number}</div>
                {event.message && <div className="race-control-msg">{event.message}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
