'use client';

import { useEffect, useState } from 'react';
import { Sun, Cloud, CloudRain, Wind, ThermometerSun, RefreshCw, AlertCircle } from 'lucide-react';

const statusLabel = { go: 'Fly Day!', maybe: 'Marginal', nogo: 'No-Fly' };
const statusClass = { go: 'flyday-go', maybe: 'flyday-maybe', nogo: 'flyday-nogo' };
const bannerClass = { go: 'bg-flyday-go', maybe: 'bg-flyday-maybe', nogo: 'bg-flyday-nogo' };
const bannerText = { go: '✓ Flyable Now', maybe: '~ Marginal Now', nogo: '✕ Not Flyable' };

const weekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' });

// NWS drops today's daytime period once it has passed, so the first card is not
// always today — compare the actual date instead of assuming index 0.
function dayLabel(day) {
  const parsed = new Date(day.startTime);
  if (Number.isNaN(parsed.getTime())) return day.name;

  const today = new Date();
  const isToday =
    parsed.getFullYear() === today.getFullYear() &&
    parsed.getMonth() === today.getMonth() &&
    parsed.getDate() === today.getDate();

  return isToday ? 'Today' : weekdayFormatter.format(parsed);
}

function WeatherIcon({ type, className }) {
  const props = { className: className || 'w-8 h-8' };
  switch (type) {
    case 'cloud': return <Cloud {...props} />;
    case 'rain':  return <CloudRain {...props} />;
    default:      return <Sun {...props} />;
  }
}

export default function FlyDayForecast() {
  const [forecast, setForecast] = useState(null);
  const [state, setState] = useState('loading');

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const res = await fetch('/api/forecast', { cache: 'no-store' });
        if (!res.ok) throw new Error('unavailable');
        const data = await res.json();
        if (!isMounted) return;
        setForecast(data);
        setState('ready');
      } catch {
        if (isMounted) setState('error');
      }
    };

    load();
    const interval = window.setInterval(load, 15 * 60 * 1000);
    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-6">
        <h2 className="section-heading">5-Day Fly Forecast</h2>
        <p className="text-xs text-ink-muted font-body">Mammoth Park, PA</p>
      </div>

      {state === 'loading' ? (
        <div className="flex items-center gap-2 text-sm text-ink-muted py-8 justify-center">
          <RefreshCw className="w-4 h-4 animate-spin" /> Loading the latest forecast...
        </div>
      ) : state === 'error' ? (
        <div className="flex items-center gap-3 rounded-lg border border-flyday-maybe/30 bg-flyday-maybe/5 p-4 text-sm text-flyday-maybe">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>The National Weather Service forecast is unavailable right now. Try again shortly.</span>
        </div>
      ) : (
        <>
          {/* Current conditions banner */}
          <div className="bg-field-green/5 border border-field-green/20 rounded-lg p-4 mb-6 flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <ThermometerSun className="w-5 h-5 text-field-green" />
              <div>
                <p className="text-xs text-ink-muted uppercase tracking-wide">Now</p>
                <p className="text-lg font-display font-bold">{forecast.current.temperature}°F</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Wind className="w-5 h-5 text-field-green" />
              <div>
                <p className="text-xs text-ink-muted uppercase tracking-wide">Wind</p>
                <p className="text-lg font-display font-bold">
                  {forecast.current.windSpeed} mph {forecast.current.windDirection}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Sun className="w-5 h-5 text-field-green" />
              <div>
                <p className="text-xs text-ink-muted uppercase tracking-wide">Sky</p>
                <p className="text-lg font-display font-bold">{forecast.current.shortForecast}</p>
              </div>
            </div>
            <div className="ml-auto">
              <span className={`inline-block px-4 py-2 ${bannerClass[forecast.current.status]} text-white font-display font-bold text-sm uppercase rounded-full tracking-wider`}>
                {bannerText[forecast.current.status]}
              </span>
            </div>
          </div>

          {/* 5-day cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {forecast.days.map((day) => (
              <div key={day.startTime} className={`flyday-card ${statusClass[day.status]}`}>
                <p className="font-display font-bold text-sm uppercase tracking-wider mb-2">{dayLabel(day)}</p>
                <WeatherIcon type={day.icon} className="w-8 h-8 mx-auto mb-2 opacity-70" />
                <p className="text-2xl font-display font-bold">{day.high}°</p>
                {day.low !== null ? <p className="text-xs opacity-60">Low {day.low}°</p> : null}
                <div className="mt-2 text-xs">
                  <p>Wind {day.wind} mph</p>
                  <p>Gusts {day.gusts} mph</p>
                  {day.precip > 0 ? <p>{day.precip}% precip</p> : null}
                </div>
                <p className="mt-3 font-display font-bold text-xs uppercase tracking-wider">
                  {statusLabel[day.status]}
                </p>
              </div>
            ))}
          </div>

          <p className="text-xs text-ink-light mt-4 text-center">
            Live forecast from the National Weather Service{forecast.stale ? ' (showing last known data)' : ''}.
            Flyability is based on wind, gusts, precipitation, and temperature.
          </p>
        </>
      )}
    </section>
  );
}
