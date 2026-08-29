import React, { useMemo } from 'react';
import Track3D from './Track3D.jsx';
import { getTrackDetail } from '../utils/track3d';

function StatCard({ circuit, detail, color }) {
  return (
    <div className="track3d-card">
      <div className="track3d-canvas-wrap-outer" style={{ borderColor: color }}>
        <Track3D detail={detail} accentColor={color} height={380} />
      </div>
      <p className="track3d-caption">Drag to rotate • Scroll to zoom</p>

      <h3 className="track3d-title">{circuit.name}</h3>
      <p className="compare-location">{circuit.location}</p>

      <div className="track3d-stats">
        <div>
          <span className="label">Length</span>
          <span className="value">{(detail.lengthMeters / 1000).toFixed(3)} km</span>
        </div>
        <div>
          <span className="label">Corners (approx.)</span>
          <span className="value">{detail.corners.length}</span>
        </div>
        <div>
          <span className="label">Direction</span>
          <span className="value">{detail.direction}</span>
        </div>
        <div>
          <span className="label">Longest straight</span>
          <span className="value">{(detail.longestStraightMeters / 1000).toFixed(2)} km</span>
        </div>
        <div>
          <span className="label">Opened</span>
          <span className="value">{circuit.opened ?? '—'}</span>
        </div>
        <div>
          <span className="label">Altitude</span>
          <span className="value">{circuit.altitude != null ? `${circuit.altitude} m` : '—'}</span>
        </div>
      </div>
    </div>
  );
}

export default function Compare3DPanel({ primary, secondary }) {
  const primaryDetail = useMemo(() => getTrackDetail(primary), [primary]);
  const secondaryDetail = useMemo(() => getTrackDetail(secondary), [secondary]);

  return (
    <div className="compare3d-wrapper">
      <div className="compare3d-panel">
        <StatCard circuit={primary} detail={primaryDetail} color="#e10600" />
        <StatCard circuit={secondary} detail={secondaryDetail} color="#00a3ff" />
      </div>
      <p className="compare-note">
        Track shape comes from the same outline data as the map view. Corner count, spin
        direction and longest straight are computed from that outline (not official telemetry),
        and the road width / marker heights are stylized for visibility, not to scale.
      </p>
    </div>
  );
}
