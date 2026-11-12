import React, { useMemo } from 'react';
import { compareDrivers } from '../domain/driverComparison';
import TelemetryScrubber from './TelemetryScrubber';
export default function DriverInsights({primary,secondary,sharedProgressRef}) {
  const comparison = useMemo(() => compareDrivers(primary,secondary),[primary,secondary]);
  if (!comparison) return <p className="lab-analysis-help">Choose two different drivers with recorded laps from the same qualifying session to see the analysis.</p>;
  const {delta,sectors,largestSector} = comparison;
  const winner = delta >= 0 ? primary.lap.driverName : secondary.lap.driverName;
  const sectorWinner = largestSector?.delta >= 0 ? primary.lap.driverName : secondary.lap.driverName;
  return <section className="lab-driver-insights" aria-label="Driver time analysis">
    <h2>Where was the time gained?</h2>
    <p><strong>{Math.abs(delta) < .001 ? 'Recorded lap times are equal.' : `${winner} was ${Math.abs(delta).toFixed(3)}s faster.`}</strong></p>
    <div className="lab-sector-gains">{sectors.map(s => <div key={s.sector}><span>Sector {s.sector}</span><strong>{s.delta == null ? 'Unavailable' : `${s.delta >= 0 ? '+' : ''}${s.delta.toFixed(3)}s`}</strong></div>)}</div>
    {largestSector && Math.abs(largestSector.delta) >= .001 && <p>The largest recorded sector difference was in sector {largestSector.sector}: {Math.abs(largestSector.delta).toFixed(3)}s in {sectorWinner}’s favor.</p>}
    <p className="lab-analysis-help">Positive delta means {primary.lap.driverName} is ahead. Lap and sector times are recorded timing data. Distance traces are sampled estimates; different track conditions and qualifying runs can affect the comparison.</p>
    <TelemetryScrubber primaryProjected={primary.projected} secondaryProjected={secondary.projected} primaryName={primary.lap.driverName} secondaryName={secondary.lap.driverName} sharedProgressRef={sharedProgressRef} comparable />
  </section>;
}
