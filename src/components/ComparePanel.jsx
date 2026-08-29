import React, { useMemo } from 'react';
import { projectToLocalMeters, boundingSize } from '../utils/geometry';

const CARD_SIZE = 320;
const PADDING = 28;

function buildTrackPath(circuit) {
  const points = projectToLocalMeters(circuit.coordinates); // [lon, lat] -> local meters
  const { width, height } = boundingSize(points);
  const usable = CARD_SIZE - PADDING * 2;
  const maxDim = Math.max(width, height) || 1;
  const scale = usable / maxDim;

  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxY = Math.max(...ys);

  const pxW = width * scale;
  const pxH = height * scale;
  const offsetX = (CARD_SIZE - pxW) / 2;
  const offsetY = (CARD_SIZE - pxH) / 2;

  const d = points
    .map(([x, y], i) => {
      const px = (x - minX) * scale + offsetX;
      const py = (maxY - y) * scale + offsetY; // flip: screen y grows downward
      return `${i === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)}`;
    })
    .join(' ');

  return d;
}

function formatLen(meters, unit) {
  if (meters == null) return '—';
  const km = meters / 1000;
  return unit === 'imperial' ? `${(km * 0.621371).toFixed(2)} mi` : `${km.toFixed(3)} km`;
}
function formatAlt(meters, unit) {
  if (meters == null) return '—';
  return unit === 'imperial' ? `${(meters * 3.28084).toFixed(0)} ft` : `${meters} m`;
}

function TrackCard({ circuit, color, unit }) {
  const d = useMemo(() => buildTrackPath(circuit), [circuit]);

  return (
    <div className="compare-card">
      <svg
        viewBox={`0 0 ${CARD_SIZE} ${CARD_SIZE}`}
        width={CARD_SIZE}
        height={CARD_SIZE}
        className="compare-svg"
      >
        <path d={d} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" />
      </svg>
      <div className="compare-card-body">
        <h3>{circuit.name}</h3>
        <p className="compare-location">{circuit.location}</p>
        <div className="compare-stats">
          <div>
            <span className="label">Length</span>
            <span className="value">{formatLen(circuit.length, unit)}</span>
          </div>
          <div>
            <span className="label">Opened</span>
            <span className="value">{circuit.opened ?? '—'}</span>
          </div>
          <div>
            <span className="label">First GP</span>
            <span className="value">{circuit.firstgp ?? '—'}</span>
          </div>
          <div>
            <span className="label">Altitude</span>
            <span className="value">{formatAlt(circuit.altitude, unit)}</span>
          </div>
          {circuit.drsZones > 0 && (
            <div>
              <span className="label">DRS Zones</span>
              <span className="value">{circuit.drsZones}</span>
            </div>
          )}
          {circuit.lapRecord && (
            <div className="compare-lap-record">
              <span className="label">Lap Record</span>
              <span className="value" style={{ fontSize: '12px' }}>{circuit.lapRecord.time} {circuit.lapRecord.driver} ({circuit.lapRecord.year})</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ComparePanel({ primary, secondary, unit = 'metric' }) {
  const lengthDiff =
    primary.length && secondary.length
      ? Math.abs(primary.length - secondary.length)
      : null;

  return (
    <div className="compare-wrapper">
      <div className="compare-panel">
        <TrackCard circuit={primary} color="#e10600" unit={unit} />
        <TrackCard circuit={secondary} color="#00a3ff" unit={unit} />
      </div>
      {lengthDiff != null && (
        <p className="compare-note">
          Note: shapes are each scaled to fill their card, so sizes here aren't
          directly comparable — length difference is {formatLen(lengthDiff, unit)}.
        </p>
      )}
    </div>
  );
}
