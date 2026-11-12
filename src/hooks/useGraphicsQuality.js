import { useEffect, useState } from 'react';
import { useStore } from '../store';
export function useGraphicsQuality() {
  const quality = useStore(state => state.graphicsQuality);
  const [constrained,setConstrained] = useState(() => window.matchMedia?.('(max-width: 768px), (prefers-reduced-motion: reduce)')?.matches ?? false);
  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 768px), (prefers-reduced-motion: reduce)');
    const update = () => setConstrained(!!media?.matches);
    media?.addEventListener('change',update);
    return () => media?.removeEventListener('change',update);
  },[]);
  const low = quality === 'low' || (quality !== 'high' && (constrained || navigator.hardwareConcurrency <= 4));
  return {maxDpr:low?1:1.5,shadows:!low,rotate:!constrained && !low};
}
