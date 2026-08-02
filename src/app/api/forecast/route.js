import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Mammoth Park flying field. NWS grid is stable for a fixed location, so the
// point lookup is hard-coded rather than resolved on every request.
const FORECAST_URL = 'https://api.weather.gov/gridpoints/PBZ/97,58/forecast';
const HOURLY_URL = 'https://api.weather.gov/gridpoints/PBZ/97,58/forecast/hourly';
const USER_AGENT = '(lhmac-site, admin@lhmac.org)';

const CACHE_MS = 15 * 60 * 1000;
let cache = { at: 0, payload: null };

function parseWindSpeed(text) {
  // NWS returns strings like "5 mph" or "10 to 15 mph"; use the upper bound.
  const numbers = (text || '').match(/\d+/g);
  if (!numbers) return 0;
  return Math.max(...numbers.map(Number));
}

function iconFor(forecast) {
  const text = (forecast || '').toLowerCase();
  if (/(rain|shower|storm|thunder|drizzle)/.test(text)) return 'rain';
  if (/(snow|sleet|ice|wintry)/.test(text)) return 'rain';
  if (/(cloud|overcast|fog)/.test(text)) return 'cloud';
  return 'sun';
}

/**
 * Flyability for RC aircraft: wind and gusts dominate, then precipitation, then
 * temperature. Thresholds chosen to match the site's go / maybe / no-go labels.
 */
function flyStatus({ wind, gusts, precip, high }) {
  if (gusts >= 25 || wind >= 18 || precip >= 60 || high <= 32) return 'nogo';
  if (gusts >= 16 || wind >= 12 || precip >= 30 || high <= 45) return 'maybe';
  return 'go';
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`NWS responded ${res.status}`);
  return res.json();
}

function buildDays(periods) {
  const days = [];

  for (const period of periods) {
    if (!period.isDaytime) continue;

    const night = periods.find(
      (p) => !p.isDaytime && new Date(p.startTime) > new Date(period.startTime)
    );
    const wind = parseWindSpeed(period.windSpeed);
    const gusts = period.windGust ? parseWindSpeed(period.windGust) : Math.round(wind * 1.4);
    const precip = period.probabilityOfPrecipitation?.value ?? 0;

    days.push({
      name: period.name,
      startTime: period.startTime,
      high: period.temperature,
      low: night?.temperature ?? null,
      wind,
      gusts,
      precip,
      shortForecast: period.shortForecast,
      icon: iconFor(period.shortForecast),
      status: flyStatus({ wind, gusts, precip, high: period.temperature }),
    });

    if (days.length === 5) break;
  }

  return days;
}

export async function GET() {
  if (cache.payload && Date.now() - cache.at < CACHE_MS) {
    return NextResponse.json(cache.payload);
  }

  try {
    const [forecast, hourly] = await Promise.all([fetchJson(FORECAST_URL), fetchJson(HOURLY_URL)]);

    const now = hourly.properties.periods[0];
    const currentWind = parseWindSpeed(now.windSpeed);
    const currentGusts = now.windGust ? parseWindSpeed(now.windGust) : Math.round(currentWind * 1.4);
    const currentPrecip = now.probabilityOfPrecipitation?.value ?? 0;

    const payload = {
      current: {
        temperature: now.temperature,
        windSpeed: currentWind,
        windDirection: now.windDirection,
        shortForecast: now.shortForecast,
        status: flyStatus({
          wind: currentWind,
          gusts: currentGusts,
          precip: currentPrecip,
          high: now.temperature,
        }),
      },
      days: buildDays(forecast.properties.periods),
      updatedAt: new Date().toISOString(),
    };

    cache = { at: Date.now(), payload };
    return NextResponse.json(payload);
  } catch (error) {
    // Serve a stale cache rather than nothing if the NWS API is briefly down.
    if (cache.payload) {
      return NextResponse.json({ ...cache.payload, stale: true });
    }
    return NextResponse.json({ error: 'Forecast unavailable right now.' }, { status: 503 });
  }
}
