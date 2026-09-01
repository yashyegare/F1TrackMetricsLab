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

function getFlagStyle(flag) {
  if (!flag) return null;
  const key = Object.keys(FIELD_STYLES).find(k =>
    flag.toLowerCase().includes(k.toLowerCase())
  );
  return key ? FLAG_STYLES[key] : null;
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
  const flagEvents = flags.filter(f => f.flag && f.flag !== '');

  if (flagEvents.length === 0) return null;

  return (
    <div className="race-control-strip">
      <div className="race-control-header">
        <span className="race-control-title">🏁 Race Control</span>
        <span className="race-control-count">{flagEvents.length} events</span>
      </div>
      <div className="race-control-events">
        {flagEvents.map((event, i) => {
          const style = getFlagStyle(event.flag) || { bg: '#444', text: '#fff', icon: '🚩', label: event.flag };
          const lapPct = totalLaps ? ((event.lap_number || 0) / totalLaps) * 100 : 0;
          return (
            <div
              key={i}
              className="race-control-event"
              style={{ left: `${Math.min(lapPct, 98)}%` }}
              title={`${event.flag} — Lap ${event.lap_number}: ${event.message || ''}`}
            >
              <div className="race-control-marker" style={{ backgroundColor: style.bg, color: style.text }}>
                {style.icon}
              </div>
              <div className="race-control-tooltip" style={{ borderColor: style.bg }}>
                <strong style={{ color: style.bg }}>{style.label} — Lap {event.lap_number}</strong>
                {event.message && <div className="race-control-msg">{event.message}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
