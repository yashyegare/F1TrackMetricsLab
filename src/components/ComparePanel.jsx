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

function TrackCard({ circuit, color }) {
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
            <span className="value">
              {circuit.length ? `${(circuit.length / 1000).toFixed(3)} km` : '—'}
            </span>
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
            <span className="value">
              {circuit.altitude != null ? `${circuit.altitude} m` : '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ComparePanel({ primary, secondary }) {
  const lengthDiff =
    primary.length && secondary.length
      ? Math.abs(primary.length - secondary.length) / 1000
      : null;

  return (
    <div className="compare-wrapper">
      <div className="compare-panel">
        <TrackCard circuit={primary} color="#e10600" />
        <TrackCard circuit={secondary} color="#00a3ff" />
      </div>
      {lengthDiff != null && (
        <p className="compare-note">
          Note: shapes are each scaled to fill their card, so sizes here aren't
          directly comparable — length difference is {lengthDiff.toFixed(3)} km.
        </p>
      )}
    </div>
  );
}
