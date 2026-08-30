import React, { useMemo } from 'react';
import { projectToLocalMeters, boundingSize } from '../utils/geometry';
import { detectStraights } from '../utils/drsDetect';

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
      const py = (maxY - y) * scale + offsetY;
      return `${i === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)}`;
    })
    .join(' ');

  return d;
}

function buildTrackSegments(circuit, drsZones) {
  if (drsZones <= 0) return null;

  const points = projectToLocalMeters(circuit.coordinates);
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

  // Detect DRS segments
  const segments = [...detectStraights(points, drsZones)].sort((a, b) => a.start - b.start);

  // Build pixel positions
  const pxPoints = points.map(([x, y]) => [
    (x - minX) * scale + offsetX,
    (maxY - y) * scale + offsetY,
  ]);

  // Create colored segments
  const coloredSegments = [];
  let lastEnd = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    // Normal segment before this DRS zone
    if (seg.start > lastEnd) {
      coloredSegments.push({
        start: lastEnd,
        end: seg.start,
        drs: false,
      });
    }
    // DRS zone
    coloredSegments.push({
      start: seg.start,
      end: seg.end,
      drs: true,
    });
    lastEnd = seg.end;
  }
  // Remaining normal segment
  if (lastEnd < points.length) {
    coloredSegments.push({
      start: lastEnd,
      end: points.length,
      drs: false,
    });
  }

  // Build SVG path segments
  const paths = coloredSegments.map((seg) => {
    const pts = [];
    if (seg.start < seg.end) {
      for (let i = seg.start; i <= seg.end && i < pxPoints.length; i++) {
        pts.push(pxPoints[i]);
      }
    } else {
      for (let i = seg.start; i < pxPoints.length; i++) pts.push(pxPoints[i]);
      for (let i = 0; i <= seg.end && i < pxPoints.length; i++) pts.push(pxPoints[i]);
    }
    if (pts.length < 2) return null;
    const d = pts
      .map(([px, py], i) => `${i === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)}`)
      .join(' ');
    return { d, drs: seg.drs };
  }).filter(Boolean);

  return paths;
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
  const drsPaths = useMemo(() => buildTrackSegments(circuit, circuit.drsZones || 0), [circuit]);

  return (
    <div className="compare-card">
      <svg
        viewBox={`0 0 ${CARD_SIZE} ${CARD_SIZE}`}
        width={CARD_SIZE}
        height={CARD_SIZE}
        className="compare-svg"
      >
        {drsPaths ? (
          drsPaths.map((seg, i) => (
            <path
              key={i}
              d={seg.d}
              fill="none"
              stroke={seg.drs ? '#00ff88' : color}
              strokeWidth={seg.drs ? 4 : 3}
              strokeLinejoin="round"
              opacity={seg.drs ? 0.9 : 0.4}
            />
          ))
        ) : (
          <path d={d} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" />
        )}
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
