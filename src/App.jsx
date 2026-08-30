import React, { Suspense, useEffect, useMemo, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import circuits from './data/circuits.json';
import LapAnimation from './components/LapAnimation.jsx';
import ComparePanel from './components/ComparePanel.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import LandingHero from './components/LandingHero.jsx';
import { useStore } from './store';
import { getTrackDetail } from './utils/track3d';

const Compare3DPanel = React.lazy(() => import('./components/Compare3DPanel.jsx'));

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
  const circuitDetail = getTrackDetail(circuit);
  const scored = all
    .filter(c => c.id !== circuit.id)
    .map(c => {
      const detail = getTrackDetail(c);
      const lengthScore = 1 - Math.min(Math.abs((c.length ?? 0) - (circuit.length ?? 0)) / Math.max(circuit.length ?? 1, 1), 1);
      const cornerScore = 1 - Math.min(Math.abs(detail.corners.length - circuitDetail.corners.length) / Math.max(circuitDetail.corners.length, 1), 1);
      const dirScore = detail.direction === circuitDetail.direction ? 0.15 : 0;
      const continentScore = c.continent === circuit.continent ? 0.1 : 0;
      const total = lengthScore * 0.4 + cornerScore * 0.35 + dirScore + continentScore;
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
  const hostedSet = new Set(years);
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

// --- Unit helpers ------------------------------------------------------------

function formatLength(meters, unit) {
  if (meters == null) return '—';
  const km = meters / 1000;
  return unit === 'imperial' ? `${(km * 0.621371).toFixed(2)} mi` : `${km.toFixed(3)} km`;
}
function formatAltitude(meters, unit) {
  if (meters == null) return '—';
  return unit === 'imperial' ? `${(meters * 3.28084).toFixed(0)} ft` : `${meters} m`;
}

// --- Info panel (map mode) ---------------------------------------------------

function InfoPanel({ circuit, unit, allCircuits, onSelect }) {
  const [expanded, setExpanded] = React.useState(false);
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
  const searchRef = useRef(null);

  // Zustand store selectors — only re-render when the selected slice changes
  const mode = useStore(s => s.mode);
  const selectedId = useStore(s => s.selectedId);
  const compareId = useStore(s => s.compareId);
  const unit = useStore(s => s.unit);
  const basemap = useStore(s => s.basemap);
  const sidebarOpen = useStore(s => s.sidebarOpen);
  const cmdOpen = useStore(s => s.cmdOpen);
  const query = useStore(s => s.query);
  const filterContinent = useStore(s => s.filterContinent);
  const sortBy = useStore(s => s.sortBy);

  const setMode = useStore(s => s.setMode);
  const setSelectedId = useStore(s => s.setSelectedId);
  const setCompareId = useStore(s => s.setCompareId);
  const setUnit = useStore(s => s.setUnit);
  const setBasemap = useStore(s => s.setBasemap);
  const setSidebarOpen = useStore(s => s.setSidebarOpen);
  const setCmdOpen = useStore(s => s.setCmdOpen);
  const toggleCmdOpen = useStore(s => s.toggleCmdOpen);
  const setQuery = useStore(s => s.setQuery);
  const setFilterContinent = useStore(s => s.setFilterContinent);
  const setSortBy = useStore(s => s.setSortBy);
  const selectCircuit = useStore(s => s.selectCircuit);

  // Derived state
  const selected = useMemo(() => circuits.find(c => c.id === selectedId) || circuits[0], [selectedId]);
  const compareCircuit = useMemo(() => circuits.find(c => c.id === compareId) || circuits[1], [compareId]);
  const positions = useMemo(() => (selected ? selected.coordinates.map(([lon, lat]) => [lat, lon]) : []), [selected]);

  const initialTelemetry = useMemo(() => {
    const url = new URLSearchParams(window.location.search);
    return {
      racePace: url.get('racePace') === '1',
      year: url.get('year') ? Number(url.get('year')) : 2024,
      driverA: url.get('driverA') ? Number(url.get('driverA')) : null,
      driverB: url.get('driverB') ? Number(url.get('driverB')) : null,
    };
  }, []);

  // --- Filter + sort ---
  const filtered = useMemo(() => {
    let list = circuits;
    const q = query.trim().toLowerCase();
    if (q) list = list.filter(c => c.location?.toLowerCase().includes(q) || c.name?.toLowerCase().includes(q));
    if (filterContinent !== 'All') list = list.filter(c => c.continent === filterContinent);
    const sorted = [...list];
    switch (sortBy) {
      case 'opened': sorted.sort((a, b) => (a.opened ?? 9999) - (b.opened ?? 9999)); break;
      case 'length': sorted.sort((a, b) => (b.length ?? 0) - (a.length ?? 0)); break;
      case 'corners': sorted.sort((a, b) => (b.coordinates?.length ?? 0) - (a.coordinates?.length ?? 0)); break;
      case 'continent': sorted.sort((a, b) => (a.continent || '').localeCompare(b.continent || '') || a.name.localeCompare(b.name)); break;
      default: sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sorted;
  }, [query, filterContinent, sortBy]);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    function onKey(e) {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault(); toggleCmdOpen(); return;
      }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); searchRef.current?.focus(); return; }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const list = filtered.length > 0 ? filtered : circuits;
        const idx = list.findIndex(c => c.id === selectedId);
        const next = e.key === 'ArrowRight'
          ? (idx + 1) % list.length
          : (idx - 1 + list.length) % list.length;
        setSelectedId(list[next].id);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, filtered, toggleCmdOpen, setSelectedId]);

  const handleCmdSelect = useCallback((id) => {
    setSelectedId(id);
    if (mode === 'map') setMode('compare3d');
  }, [mode, setSelectedId, setMode]);

  return (
    <div className="app">
      {/* Mobile hamburger */}
      <button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle sidebar">
        {sidebarOpen ? '✕' : '☰'}
      </button>

      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-header">
          <h1>F1 Circuits</h1>
          <p className="subtitle">Unofficial track map explorer</p>
          <button className="cmd-trigger" onClick={() => setCmdOpen(true)} title="Command palette (Ctrl+K)">⌘K</button>
        </div>

        <div className="mode-toggle">
          <button className={!mode ? 'active' : ''} onClick={() => setMode(null)}>Home</button>
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

      <CommandPalette
        circuits={circuits}
        selectedId={selectedId}
        compareId={compareId}
        mode={mode}
        onSelectCircuit={handleCmdSelect}
        onSetMode={setMode}
        isOpen={cmdOpen}
        onClose={() => setCmdOpen(false)}
      />

      <main className="map-area">
        {!mode ? (
          <LandingHero />
        ) : mode === 'map' ? (
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
            <Compare3DPanel primary={selected} secondary={compareCircuit} unit={unit} initialTelemetry={initialTelemetry} />
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
