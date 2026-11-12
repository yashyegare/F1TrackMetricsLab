import React, { useState } from 'react';
import TireStrategy from './TireStrategy';
import RaceControlOverlay from './RaceControlOverlay';
import SectorComparison from './SectorComparison';

export default function RaceDataPanel({ comparable, primaryTelemetry, secondaryTelemetry, primaryStints, secondaryStints, primaryPitStops, secondaryPitStops, primaryTotalLaps, secondaryTotalLaps, primaryRaceControl, secondaryRaceControl, primaryQualiData, secondaryQualiData }) {
  const [expanded, setExpanded] = useState(false);
  const hasAnyData = primaryTelemetry || secondaryTelemetry || primaryRaceControl || secondaryRaceControl;
  if (!hasAnyData) return null;

  const hasTire = primaryStints || secondaryStints;
  const hasRC = primaryRaceControl || secondaryRaceControl;
  const hasSectors = comparable && (primaryTelemetry?.lap || secondaryTelemetry?.lap);

  // Count loaded sections for the badge
  const loadedCount = [hasTire, hasRC, hasSectors].filter(Boolean).length;

  return (
    <div className="race-data-panel">
      <button
        className={`race-data-toggle ${expanded ? 'expanded' : ''}`}
        onClick={() => setExpanded(e => !e)}
      >
        <div className="race-data-toggle-left">
          <span className="race-data-chevron">{expanded ? '▾' : '▸'}</span>
          <span className="race-data-title">Race Data</span>
          <span className="race-data-count">{loadedCount} sources</span>
        </div>
        <div className="race-data-toggle-pills">
          {hasTire && <span className="race-data-pill tire">Tires</span>}
          {hasRC && <span className="race-data-pill rc">Flags</span>}
          {hasSectors && <span className="race-data-pill sectors">Sectors</span>}
        </div>
      </button>
      {expanded && (
        <div className="race-data-content">
          {/* Tire Strategy — one per driver */}
          {hasTire && (
            <div className="race-context-row">
              {primaryTelemetry && (
                <TireStrategy
                  stints={primaryStints}
                  pitStops={primaryPitStops}
                  totalLaps={primaryTotalLaps}
                  driverNumber={primaryTelemetry.lap.driver}
                  driverName={primaryTelemetry.lap.driverName}
                />
              )}
              {secondaryTelemetry && (
                <TireStrategy
                  stints={secondaryStints}
                  pitStops={secondaryPitStops}
                  totalLaps={secondaryTotalLaps}
                  driverNumber={secondaryTelemetry.lap.driver}
                  driverName={secondaryTelemetry.lap.driverName}
                />
              )}
            </div>
          )}
          {/* Race Control Flags */}
          {hasRC && (
            <div className="race-context-row">
              {primaryRaceControl && (
                <RaceControlOverlay flags={primaryRaceControl} totalLaps={primaryTotalLaps} />
              )}
              {secondaryRaceControl && !primaryRaceControl && (
                <RaceControlOverlay flags={secondaryRaceControl} totalLaps={secondaryTotalLaps} />
              )}
            </div>
          )}
          {/* Sector Comparison */}
          {hasSectors && (
            <div className="race-context-row">
              <SectorComparison
                primaryLap={primaryTelemetry?.lap}
                secondaryLap={secondaryTelemetry?.lap}
                primaryName={primaryTelemetry?.lap?.driverName?.split(' ').pop()}
                secondaryName={secondaryTelemetry?.lap?.driverName?.split(' ').pop()}
                primaryAllLaps={primaryQualiData.current?.laps?.filter(l => l.driver_number === primaryTelemetry?.lap.driver)}
                secondaryAllLaps={secondaryQualiData.current?.laps?.filter(l => l.driver_number === secondaryTelemetry?.lap.driver)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

