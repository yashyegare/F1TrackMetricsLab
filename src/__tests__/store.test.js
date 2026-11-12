// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store';

describe('circuit collections and comparisons', () => {
  beforeEach(() => useStore.setState({selectedId:'us-2012',compareId:'az-2016',favoriteIds:[],recentIds:[],sidebarOpen:true}));
  it('swaps the pair when the primary selection collides', () => {
    useStore.getState().setSelectedId('az-2016');
    expect(useStore.getState()).toMatchObject({selectedId:'az-2016',compareId:'us-2012'});
  });
  it('swaps the pair when the secondary selection collides', () => {
    useStore.getState().setCompareId('us-2012');
    expect(useStore.getState()).toMatchObject({selectedId:'az-2016',compareId:'us-2012'});
  });
  it('records unique recent tracks and closes the mobile drawer', () => {
    useStore.getState().selectCircuit('mc-1929');
    useStore.getState().selectCircuit('jp-1962');
    useStore.getState().selectCircuit('mc-1929');
    expect(useStore.getState().recentIds).toEqual(['mc-1929','jp-1962']);
    expect(useStore.getState().sidebarOpen).toBe(false);
  });
  it('toggles favorites and rejects unknown track IDs', () => {
    useStore.getState().toggleFavorite('mc-1929');
    expect(useStore.getState().favoriteIds).toEqual(['mc-1929']);
    useStore.getState().toggleFavorite('mc-1929');
    useStore.getState().setSelectedId('invalid');
    expect(useStore.getState().favoriteIds).toEqual([]);
    expect(useStore.getState().selectedId).toBe('us-2012');
  });
});
