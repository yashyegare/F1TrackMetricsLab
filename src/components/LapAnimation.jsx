import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker } from 'react-leaflet';
import { buildCumulativeDistances, interpolateAlongPath } from '../utils/geometry';

const BASE_LAP_SECONDS = 18;
const SPEEDS = [0.5, 1, 2, 4];

export default function LapAnimation({ positions }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);

  const rafRef = useRef(null);
  const lastTsRef = useRef(null);

  const { cumulative, total } = useMemo(
    () => buildCumulativeDistances(positions),
    [positions]
  );

  useEffect(() => {
    setIsPlaying(false);
    setProgress(0);
  }, [positions]);

  useEffect(() => {
    if (!isPlaying) {
      lastTsRef.current = null;
      return;
    }

    const step = (ts) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;

      setProgress((p) => {
        const next = p + (dt * speed) / BASE_LAP_SECONDS;
        if (next >= 1) {
          setIsPlaying(false);
          return 1;
        }
        return next;
      });

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, speed]);

  const { position } = interpolateAlongPath(positions, cumulative, total, progress);

  const handleTogglePlay = () => {
    if (progress >= 1) setProgress(0);
    setIsPlaying((p) => !p);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setProgress(0);
  };

  const handleScrub = (e) => {
    setIsPlaying(false);
    setProgress(Number(e.target.value) / 1000);
  };

  const pct = Math.round(progress * 100);

  return (
    <>
      {position && (
        <CircleMarker
          center={position}
          radius={7}
          pathOptions={{
            color: '#ffffff',
            weight: 2,
            fillColor: '#e10600',
            fillOpacity: 1,
          }}
        />
      )}

      <div className="lap-controls">
        <div className="lap-controls-main">
          <button className="lap-btn play-btn" onClick={handleTogglePlay} title={isPlaying ? 'Pause' : 'Play lap'}>
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button className="lap-btn" onClick={handleReset} title="Reset">
            ⟲
          </button>

          <div className="lap-scrub-wrap">
            <input
              className="lap-scrub"
              type="range"
              min={0}
              max={1000}
              value={Math.round(progress * 1000)}
              onChange={handleScrub}
            />
            <div className="lap-progress-track">
              <div className="lap-progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <span className="lap-pct">{pct}%</span>
        </div>

        <div className="lap-controls-bottom">
          <div className="lap-speeds">
            {SPEEDS.map((s) => (
              <button
                key={s}
                className={`speed-btn ${s === speed ? 'active' : ''}`}
                onClick={() => setSpeed(s)}
              >
                {s}×
              </button>
            ))}
          </div>
          <span className="lap-distance">
            {(total / 1000).toFixed(2)} km
          </span>
        </div>
      </div>
    </>
  );
}
