import { create } from 'zustand';
import circuits from './data/circuits.json';

const validId = id => circuits.some(c => c.id === id);
const cleanIds = value => Array.isArray(value) ? [...new Set(value.filter(validId))] : [];
const remember = (state, id) => {
  const recentIds = [id, ...state.recentIds.filter(item => item !== id)].slice(0, 6);
  saveState('f1_recent', recentIds);
  return recentIds;
};

function loadState(key, fallback) {
  try { const r = localStorage.getItem(key); return r !== null ? JSON.parse(r) : fallback; } catch { return fallback; }
}
function saveState(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota exceeded or private browsing — ignore */ } }

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

export const useStore = create((set, _get) => {
  const url = readURLParams();
  const requested = url.circuit || loadState('f1_selected',null);
  const selected = validId(requested) ? requested : circuits[0].id;
  const comparison = url.vs || loadState('f1_compare',null);

  return {
    // View state
    mode: url.mode || loadState('f1_mode', null),
    selectedId: selected,
    compareId: validId(comparison) && comparison !== selected ? comparison : circuits.find(c => c.id !== selected).id,
    favoriteIds: cleanIds(loadState('f1_favorites', [])),
    recentIds: cleanIds(loadState('f1_recent', [])),
    collection: 'all',
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
    setSelectedId: (id) => { if (!validId(id)) return; set(state => {
      const compareId = state.compareId === id ? state.selectedId : state.compareId;
      saveState('f1_compare', compareId); saveState('f1_selected', id);
      return { selectedId:id, compareId, recentIds:remember(state,id) };
    }); },
    setCompareId: (id) => { if (!validId(id)) return; set(state => {
      const selectedId = state.selectedId === id ? state.compareId : state.selectedId;
      saveState('f1_selected', selectedId); saveState('f1_compare',id);
      return {selectedId, compareId:id};
    }); },
    swapCircuits: () => set(state => {
      saveState('f1_selected',state.compareId); saveState('f1_compare',state.selectedId);
      return { selectedId:state.compareId, compareId:state.selectedId };
    }),
    setCollection: collection => set({collection}),
    toggleFavorite: id => { if (!validId(id)) return; set(state => {
      const favoriteIds = state.favoriteIds.includes(id) ? state.favoriteIds.filter(item => item !== id) : [...state.favoriteIds,id];
      saveState('f1_favorites',favoriteIds); return {favoriteIds};
    }); },
    setUnit: (unit) => { set({ unit }); saveState('f1_unit', unit); },
    setBasemap: (basemap) => set({ basemap }),
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    setQuery: (query) => set({ query }),
    setFilterContinent: (c) => set({ filterContinent: c }),
    setSortBy: (s) => set({ sortBy: s }),
    setCmdOpen: (open) => set({ cmdOpen: open }),
    toggleCmdOpen: () => set((s) => ({ cmdOpen: !s.cmdOpen })),

    // Compound actions
    selectCircuit: (id) => { _get().setSelectedId(id); set({sidebarOpen:false}); },
  };
});
