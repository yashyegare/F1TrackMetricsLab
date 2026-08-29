import React, { Suspense, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import circuits from './data/circuits.json';
import LapAnimation from './components/LapAnimation.jsx';
import ComparePanel from './components/ComparePanel.jsx';

const Compare3DPanel = React.lazy(() => import('./components/Compare3DPanel.jsx'));

// --- URL / deep-link helpers -------------------------------------------------

function readURLParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    circuit: p.get('circuit') || null,
    mode: p.get('mode') || null,
    vs: p.get('vs') || null,
  };
}

function writeURLParams(params) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) p.set(k, v); });
  const qs = p.toString();
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState(null, '', url);
}

// --- localStorage helpers ----------------------------------------------------

function loadState(key, fallback) {
  try { const r = localStorage.getItem(key); return r !== null ? JSON.parse(r) : fallback; } catch { return fallback; }
}
function saveState(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

// --- Unit helpers ------------------------------------------------------------

function kmToMi(km) { return km * 0.621371; }
function mToFt(m) { return m * 3.28084; }
function formatLength(meters, unit) {
  if (meters == null) return '—';
  const km = meters / 1000;
  return unit === 'imperial' ? `${kmToMi(km).toFixed(2)} mi` : `${km.toFixed(3)} km`;
}
function formatAltitude(meters, unit) {
  if (meters == null) return '—';
  return unit === 'imperial' ? `${mToFt(meters).toFixed(0)} ft` : `${meters} m`;
}

// --- Sort helpers ------------------------------------------------------------

function decadeLabel(opened) {
  if (!opened) return 'Unknown';
  return `${Math.floor(opened / 10) * 10}s`;
}

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'continent', label: 'Continent' },
  { value: 'opened', label: 'Decade opened' },
  { value: 'length', label: 'Track length' },
  { value: 'corners', label: 'Corner count' },
];

const CONTINENTS = ['All', 'Europe', 'Asia', 'North America', 'South America', 'Africa', 'Oceania'];

// --- Similar tracks algorithm ------------------------------------------------

function findSimilarTracks(circuit, all, count = 4) {
  if (!circuit) return [];
  const scored = all
    .filter(c => c.id !== circuit.id)
    .map(c => {
      // Score based on length similarity, corner count (approx from coords), direction
      const lengthScore = 1 - Math.min(Math.abs((c.length ?? 0) - (circuit.length ?? 0)) / Math.max(circuit.length ?? 1, 1), 1);
      const coordScore = 1 - Math.min(Math.abs((c.coordinates?.length ?? 0) - (c.coordinates?.length ?? 0)) / Math.max(circuit.coordinates?.length ?? 1, 1), 1);
      const altitudeScore = c.continent === circuit.continent ? 0.2 : 0;
      const total = lengthScore * 0.5 + coordScore * 0.3 + altitudeScore;
      return { circuit: c, score: total };
    })
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map(s => s.circuit);
}

// --- Track history mini-timeline ---------------------------------------------

function TrackHistory({ history }) {
  if (!history || !history.yearsHosted?.length) return null;
  const years = history.yearsHosted;
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  // Find gaps (years not hosted)
  const hostedSet = new Set(years);
  const gaps = [];
  for (let y = minYear; y <= maxYear; y++) {
    if (!hostedSet.has(y)) gaps.push(y);
  }
  return (
    <div className="track-history">
      <div className="history-bar">
        {Array.from({ length: maxYear - minYear + 1 }, (_, i) => {
          const y = minYear + i;
          const hosted = hostedSet.has(y);
          return <div key={y} className={`history-dot${hosted ? ' active' : ''}`} title={y} />;
        })}
      </div>
      <span className="history-range">{minYear}–{maxYear} · {years.length} GPs</span>
      {history.layoutChanges && <p className="layout-changes">{history.layoutChanges}</p>}
    </div>
  );
}

// --- Info panel (map mode) ---------------------------------------------------

function InfoPanel({ circuit, unit, allCircuits, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const similar = useMemo(() => findSimilarTracks(circuit, allCircuits), [circuit, allCircuits]);
  return (
    <div className={`info-panel${expanded ? ' expanded' : ''}`}>
      <button className="info-toggle" onClick={() => setExpanded(e => !e)}>
        <span className="info-toggle-name">{circuit.name}</span>
        <span className="info-toggle-chevron">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <div className="info-body">
          <div className="info-grid">
            <div><span className="label">Location</span><span className="value">{circuit.location}</span></div>
            <div><span className="label">Length</span><span className="value">{formatLength(circuit.length, unit)}</span></div>
            <div><span className="label">Opened</span><span className="value">{circuit.opened ?? '—'}</span></div>
            <div><span className="label">First GP</span><span className="value">{circuit.firstgp ?? '—'}</span></div>
            <div><span className="label">Altitude</span><span className="value">{formatAltitude(circuit.altitude, unit)}</span></div>
            {circuit.drsZones > 0 && <div><span className="label">DRS Zones</span><span className="value">{circuit.drsZones}</span></div>}
            {circuit.lapRecord && (
              <div className="lap-record-row">
                <span className="label">Lap Record</span>
                <span className="value lap-record">{circuit.lapRecord.time} <span className="record-driver">{circuit.lapRecord.driver}</span> ({circuit.lapRecord.year})</span>
              </div>
            )}
          </div>
          <TrackHistory history={circuit.trackHistory} />
          {similar.length > 0 && (
            <div className="similar-tracks">
              <span className="similar-label">Similar tracks</span>
              <div className="similar-list">
                {similar.map(c => (
                  <button key={c.id} className="similar-btn" onClick={() => onSelect(c.id)}>
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Fly the map to the selected circuit whenever it changes.
function FlyToCircuit({ circuit }) {
  const map = useMap();
  useEffect(() => {
    if (circuit) map.flyTo([circuit.lat, circuit.lon], circuit.zoom, { duration: 1.1 });
  }, [circuit, map]);
  return null;
}

export default function App() {
  // --- Deep link: resolve initial state from URL, then fallback to localStorage / defaults ---
  const urlParams = useMemo(readURLParams, []);

  const resolveInitial = useCallback((list) => {
    let sid = circuits[0].id;
    let cid = circuits[1].id;
    let mode = 'map';

    // Deep link overrides
    if (urlParams.circuit) {
      const match = list.find(c => c.id === urlParams.circuit || c.name.toLowerCase().replace(/\s+/g, '-') === urlParams.circuit);
      if (match) sid = match.id;
    }
    if (urlParams.vs) {
      const match = list.find(c => c.id === urlParams.vs || c.name.toLowerCase().replace(/\s+/g, '-') === urlParams.vs);
      if (match) cid = match.id;
    }
    if (urlParams.mode && ['map', 'compare', 'compare3d'].includes(urlParams.mode)) {
      mode = urlParams.mode;
    } else {
      // No URL mode — use localStorage or default
      mode = loadState('f1_mode', 'map');
    }

    // If URL had circuit info, also save to localStorage for persistence
    if (urlParams.circuit || urlParams.vs) {
      saveState('f1_selected', sid);
      saveState('f1_compare', cid);
      saveState('f1_mode', mode);
    } else {
      sid = loadState('f1_selected', circuits[0].id);
      cid = loadState('f1_compare', circuits[1].id);
    }

    return { selectedId: sid, compareId: cid, mode };
  }, [urlParams]);

  const initial = useMemo(() => resolveInitial(circuits), [resolveInitial]);

  const [mode, setMode] = useState(initial.mode);
  const [basemap, setBasemap] = useState('street');
  const [selectedId, setSelectedId] = useState(initial.selectedId);
  const [compareId, setCompareId] = useState(initial.compareId);
  const [query, setQuery] = useState('');
  const [unit, setUnit] = useState(() => loadState('f1_unit', 'metric'));
  const [filterContinent, setFilterContinent] = useState('All');
  const [sortBy, setSortBy] = useState('name');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const searchRef = useRef(null);

  // --- Persist state changes ---
  useEffect(() => { saveState('f1_mode', mode); }, [mode]);
  useEffect(() => { saveState('f1_selected', selectedId); }, [selectedId]);
  useEffect(() => { saveState('f1_compare', compareId); }, [compareId]);
  useEffect(() => { saveState('f1_unit', unit); }, [unit]);

  // --- Deep link: sync state to URL ---
  useEffect(() => {
    writeURLParams({ circuit: selectedId, mode, vs: mode !== 'map' ? compareId : undefined });
  }, [selectedId, compareId, mode]);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    function onKey(e) {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); return; }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const idx = circuits.findIndex(c => c.id === selectedId);
        const next = e.key === 'ArrowRight' ? (idx + 1) % circuits.length : (idx - 1 + circuits.length) % circuits.length;
        setSelectedId(circuits[next].id);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  const selected = useMemo(() => circuits.find(c => c.id === selectedId), [selectedId]);
  const compareCircuit = useMemo(() => circuits.find(c => c.id === compareId), [compareId]);
  const positions = useMemo(() => (selected ? selected.coordinates.map(([lon, lat]) => [lat, lon]) : []), [selected]);

  // --- Filter + sort ---
  const filtered = useMemo(() => {
    let list = circuits;

    // Text search
    const q = query.trim().toLowerCase();
    if (q) list = list.filter(c => c.location?.toLowerCase().includes(q) || c.name?.toLowerCase().includes(q));

    // Continent filter
    if (filterContinent !== 'All') list = list.filter(c => c.continent === filterContinent);

    // Sort
    const sorted = [...list];
    switch (sortBy) {
      case 'opened':
        sorted.sort((a, b) => (a.opened ?? 9999) - (b.opened ?? 9999));
        break;
      case 'length':
        sorted.sort((a, b) => (b.length ?? 0) - (a.length ?? 0));
        break;
      case 'corners':
        // Approximate from coordinate count (higher = more corners)
        sorted.sort((a, b) => (b.coordinates?.length ?? 0) - (a.coordinates?.length ?? 0));
        break;
      case 'continent':
        sorted.sort((a, b) => (a.continent || '').localeCompare(b.continent || '') || a.name.localeCompare(b.name));
        break;
      default: // name
        sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sorted;
  }, [query, filterContinent, sortBy]);

  const toggleUnit = () => setUnit(u => u === 'metric' ? 'imperial' : 'metric');

  // Close sidebar on mobile when selecting a circuit
  const selectCircuit = (id) => { setSelectedId(id); setSidebarOpen(false); };

  return (
    <div className="app">
      {/* Mobile hamburger */}
      <button className="hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle sidebar">
        {sidebarOpen ? '✕' : '☰'}
      </button>

      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-header">
          <h1>F1 Circuits</h1>
          <p className="subtitle">Unofficial track map explorer</p>
        </div>

        <div className="mode-toggle">
          <button className={mode === 'map' ? 'active' : ''} onClick={() => setMode('map')}>Map</button>
          <button className={mode === 'compare' ? 'active' : ''} onClick={() => setMode('compare')}>Compare</button>
          <button className={mode === 'compare3d' ? 'active' : ''} onClick={() => setMode('compare3d')}>3D View</button>
        </div>

        {(mode === 'compare' || mode === 'compare3d') && (
          <div className="compare-pickers">
            <label>
              <span className="dot" style={{ background: '#e10600' }} />
              Circuit A
              <select value={selectedId} onChange={e => setSelectedId(e.target.value)}>
                {circuits.map(c => <option key={c.id} value={c.id}>{c.location} — {c.name}</option>)}
              </select>
            </label>
            <label>
              <span className="dot" style={{ background: '#00a3ff' }} />
              Circuit B
              <select value={compareId} onChange={e => setCompareId(e.target.value)}>
                {circuits.map(c => <option key={c.id} value={c.id}>{c.location} — {c.name}</option>)}
              </select>
            </label>
          </div>
        )}

        <input
          ref={searchRef}
          className="search"
          type="text"
          placeholder="Search circuits or cities…  press / to focus"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />

        <div className="filter-sort-row">
          <select className="filter-select" value={filterContinent} onChange={e => setFilterContinent(e.target.value)}>
            {CONTINENTS.map(c => <option key={c} value={c}>{c === 'All' ? 'All continents' : c}</option>)}
          </select>
          <select className="filter-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="unit-toggle-row">
          <button className={`unit-btn${unit === 'metric' ? ' active' : ''}`} onClick={() => setUnit('metric')}>km / m</button>
          <button className={`unit-btn${unit === 'imperial' ? ' active' : ''}`} onClick={() => setUnit('imperial')}>mi / ft</button>
        </div>

        <ul className="circuit-list">
          {filtered.map(c => (
            <li key={c.id}>
              <button className={c.id === selectedId ? 'active' : ''} onClick={() => selectCircuit(c.id)}>
                <span className="circuit-name">{c.name}</span>
                <span className="circuit-location">{c.location}{sortBy === 'continent' ? ` · ${c.continent}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      <main className="map-area">
        {mode === 'map' ? (
          <>
            <MapContainer center={[selected.lat, selected.lon]} zoom={selected.zoom} scrollWheelZoom className="map">
              <TileLayer
                attribution={basemap === 'satellite'
                  ? 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics'
                  : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}
                url={basemap === 'satellite'
                  ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                  : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
              />
              <Polyline key={selected.id} positions={positions} pathOptions={{ color: '#e10600', weight: 4 }} />
              <LapAnimation key={selected.id} positions={positions} />
              <FlyToCircuit circuit={selected} />
            </MapContainer>
            <div className="basemap-toggle">
              <button className={basemap === 'street' ? 'active' : ''} onClick={() => setBasemap('street')}>Street</button>
              <button className={basemap === 'satellite' ? 'active' : ''} onClick={() => setBasemap('satellite')}>Satellite</button>
            </div>
            {selected && (
              <InfoPanel circuit={selected} unit={unit} allCircuits={circuits} onSelect={setSelectedId} />
            )}
          </>
        ) : mode === 'compare' ? (
          <ComparePanel primary={selected} secondary={compareCircuit} unit={unit} />
        ) : (
          <Suspense fallback={<div className="loading-3d">Loading 3D view…</div>}>
            <Compare3DPanel primary={selected} secondary={compareCircuit} unit={unit} />
          </Suspense>
        )}
        <div className="disclaimer">
          Unofficial. Not associated with the Formula 1 companies. Track data from{' '}
          <a href="https://github.com/bacinger/f1-circuits" target="_blank" rel="noreferrer">bacinger/f1-circuits</a>.
        </div>
      </main>
    </div>
  );
}
