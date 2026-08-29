import React, { useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import circuits from './data/circuits.json';
import LapAnimation from './components/LapAnimation.jsx';
import ComparePanel from './components/ComparePanel.jsx';
import Compare3DPanel from './components/Compare3DPanel.jsx';

// Fly the map to the selected circuit whenever it changes.
function FlyToCircuit({ circuit }) {
  const map = useMap();
  React.useEffect(() => {
    if (circuit) {
      map.flyTo([circuit.lat, circuit.lon], circuit.zoom, { duration: 1.1 });
    }
  }, [circuit, map]);
  return null;
}

export default function App() {
  const [mode, setMode] = useState('map'); // 'map' | 'compare'
  const [basemap, setBasemap] = useState('street'); // 'street' | 'satellite'
  const [selectedId, setSelectedId] = useState(circuits[0].id);
  const [compareId, setCompareId] = useState(circuits[1].id);
  const [query, setQuery] = useState('');

  const selected = useMemo(
    () => circuits.find((c) => c.id === selectedId),
    [selectedId]
  );

  const compareCircuit = useMemo(
    () => circuits.find((c) => c.id === compareId),
    [compareId]
  );

  const positions = useMemo(
    () => (selected ? selected.coordinates.map(([lon, lat]) => [lat, lon]) : []),
    [selected]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return circuits;
    return circuits.filter(
      (c) =>
        c.location?.toLowerCase().includes(q) ||
        c.name?.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>F1 Circuits</h1>
          <p className="subtitle">Unofficial track map explorer</p>
        </div>

        <div className="mode-toggle">
          <button
            className={mode === 'map' ? 'active' : ''}
            onClick={() => setMode('map')}
          >
            Map
          </button>
          <button
            className={mode === 'compare' ? 'active' : ''}
            onClick={() => setMode('compare')}
          >
            Compare
          </button>
          <button
            className={mode === 'compare3d' ? 'active' : ''}
            onClick={() => setMode('compare3d')}
          >
            3D View
          </button>
        </div>

        {(mode === 'compare' || mode === 'compare3d') && (
          <div className="compare-pickers">
            <label>
              <span className="dot" style={{ background: '#e10600' }} />
              Circuit A
              <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                {circuits.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.location} — {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="dot" style={{ background: '#00a3ff' }} />
              Circuit B
              <select value={compareId} onChange={(e) => setCompareId(e.target.value)}>
                {circuits.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.location} — {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <input
          className="search"
          type="text"
          placeholder="Search circuits or cities..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <ul className="circuit-list">
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                className={c.id === selectedId ? 'active' : ''}
                onClick={() => setSelectedId(c.id)}
              >
                <span className="circuit-name">{c.name}</span>
                <span className="circuit-location">{c.location}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main className="map-area">
        {mode === 'map' ? (
          <>
            <MapContainer
              center={[selected.lat, selected.lon]}
              zoom={selected.zoom}
              scrollWheelZoom
              className="map"
            >
              <TileLayer
                attribution={
                  basemap === 'satellite'
                    ? 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics'
                    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                }
                url={
                  basemap === 'satellite'
                    ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                }
              />
              <Polyline
                key={selected.id}
                positions={positions}
                pathOptions={{ color: '#e10600', weight: 4 }}
              />
              <LapAnimation key={selected.id} positions={positions} />
              <FlyToCircuit circuit={selected} />
            </MapContainer>

            <div className="basemap-toggle">
              <button
                className={basemap === 'street' ? 'active' : ''}
                onClick={() => setBasemap('street')}
              >
                Street
              </button>
              <button
                className={basemap === 'satellite' ? 'active' : ''}
                onClick={() => setBasemap('satellite')}
              >
                Satellite
              </button>
            </div>

            {selected && (
              <div className="info-panel">
                <h2>{selected.name}</h2>
                <div className="info-grid">
                  <div>
                    <span className="label">Location</span>
                    <span className="value">{selected.location}</span>
                  </div>
                  <div>
                    <span className="label">Length</span>
                    <span className="value">
                      {selected.length ? `${(selected.length / 1000).toFixed(3)} km` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="label">Opened</span>
                    <span className="value">{selected.opened ?? '—'}</span>
                  </div>
                  <div>
                    <span className="label">First GP</span>
                    <span className="value">{selected.firstgp ?? '—'}</span>
                  </div>
                  <div>
                    <span className="label">Altitude</span>
                    <span className="value">
                      {selected.altitude != null ? `${selected.altitude} m` : '—'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : mode === 'compare' ? (
          <ComparePanel primary={selected} secondary={compareCircuit} />
        ) : (
          <Compare3DPanel primary={selected} secondary={compareCircuit} />
        )}

        <div className="disclaimer">
          Unofficial. Not associated with the Formula 1 companies. Track data from{' '}
          <a href="https://github.com/bacinger/f1-circuits" target="_blank" rel="noreferrer">
            bacinger/f1-circuits
          </a>
          .
        </div>
      </main>
    </div>
  );
}
