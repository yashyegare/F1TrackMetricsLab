/**
 * WeatherChip — compact weather display near the session picker.
 * Shows track temp, air temp, conditions, and wind.
 */
import React from 'react';

export default function WeatherChip({ weather }) {
  if (!weather) return null;

  // Use the last weather sample (most recent)
  const w = Array.isArray(weather) ? weather[weather.length - 1] : weather;
  if (!w) return null;

  const trackTemp = w.track_temperature;
  const airTemp = w.air_temperature;
  const humidity = w.humidity;
  const rainfall = w.rainfall;
  const windSpeed = w.wind_speed;

  return (
    <div className="weather-chip">
      <div className="weather-icon">{rainfall ? '🌧️' : '☀️'}</div>
      <div className="weather-details">
        {trackTemp != null && (
          <span className="weather-item">
            <span className="weather-label">Track</span>
            <span className="weather-value">{trackTemp}°C</span>
          </span>
        )}
        {airTemp != null && (
          <span className="weather-item">
            <span className="weather-label">Air</span>
            <span className="weather-value">{airTemp}°C</span>
          </span>
        )}
        {humidity != null && (
          <span className="weather-item">
            <span className="weather-label">Humidity</span>
            <span className="weather-value">{humidity}%</span>
          </span>
        )}
        {windSpeed != null && (
          <span className="weather-item">
            <span className="weather-label">Wind</span>
            <span className="weather-value">{windSpeed} km/h</span>
          </span>
        )}
        {rainfall != null && (
          <span className="weather-item weather-rain">
            {rainfall ? '💧 Wet' : '☀️ Dry'}
          </span>
        )}
      </div>
    </div>
  );
}
