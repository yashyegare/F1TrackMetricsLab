import { create } from 'zustand';

function loadState(key, fallback) {
  try { const r = localStorage.getItem(key); return r !== null ? JSON.parse(r) : fallback; } catch { return fallback; }
}
function saveState(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

function readURLParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    circuit: p.get('circuit') || null,
    mode: p.get('mode') || null,
    vs: p.get('vs') || null,
    racePace: p.get('racePace') === '1' || p.get('racePace') === 'true',
    year: p.get('year') ? Number(p.get('year')) : null,
    driverA: p.get('driverA') ? Number(p.get('driverA')) : null,
    driverB: p.get('driverB') ? Number(p.get('driverB')) : null,
  };
}

export const useStore = create((set, get) => {
  const url = readURLParams();

  return {
    // View state
    mode: url.mode || loadState('f1_mode', 'map'),
    selectedId: url.circuit || loadState('f1_selected', null),
    compareId: url.vs || loadState('f1_compare', null),
    unit: loadState('f1_unit', 'metric'),
    basemap: 'street',

    // Sidebar
    sidebarOpen: false,
    query: '',
    filterContinent: 'All',
    sortBy: 'name',

    // Command palette
    cmdOpen: false,

    // Actions
    setMode: (mode) => { set({ mode }); saveState('f1_mode', mode); },
    setSelectedId: (id) => { set({ selectedId: id }); saveState('f1_selected', id); },
    setCompareId: (id) => { set({ compareId: id }); saveState('f1_compare', id); },
    setUnit: (unit) => { set({ unit }); saveState('f1_unit', unit); },
    setBasemap: (basemap) => set({ basemap }),
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    setQuery: (query) => set({ query }),
    setFilterContinent: (c) => set({ filterContinent: c }),
    setSortBy: (s) => set({ sortBy: s }),
    setCmdOpen: (open) => set({ cmdOpen: open }),
    toggleCmdOpen: () => set((s) => ({ cmdOpen: !s.cmdOpen })),

    // Compound actions
    selectCircuit: (id) => set({ selectedId: id, sidebarOpen: false }),
  };
});
