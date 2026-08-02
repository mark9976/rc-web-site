'use client';

import { useEffect, useState } from 'react';
import { MapPin, Navigation, ExternalLink } from 'lucide-react';

/**
 * Embedded map with a pin, plus directions links.
 *
 * Uses OpenStreetMap's embed endpoint: no API key, no billing account, and no
 * third-party script — just an iframe.
 */
function embedUrl({ lat, lon }) {
  // A small bounding box around the point gives a sensible default zoom.
  const pad = 0.008;
  const bbox = [lon - pad, lat - pad, lon + pad, lat + pad].join('%2C');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lon}`;
}

export default function FieldMap({ site }) {
  const { name, address, lat, lon } = site;
  const [isApple, setIsApple] = useState(false);

  useEffect(() => {
    // iOS and macOS get Apple Maps as the primary action; everything else gets
    // Google Maps, which opens the installed app on Android.
    const ua = navigator.userAgent || '';
    setIsApple(/iPhone|iPad|iPod|Macintosh/.test(ua));
  }, []);

  const label = encodeURIComponent(name);
  // Both of these hand off to the native app when it is installed, and fall
  // back to the web version otherwise.
  const appleDirections = `https://maps.apple.com/?daddr=${lat},${lon}&q=${label}`;
  const googleDirections = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
  const primary = isApple ? appleDirections : googleDirections;
  const secondary = isApple ? googleDirections : appleDirections;

  return (
    <div className="mb-6">
      <div className="aspect-video rounded-xl overflow-hidden border border-black/10 bg-surface-muted">
        <iframe
          title={`Map of ${name}`}
          src={embedUrl({ lat, lon })}
          className="w-full h-full"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <a href={primary} target="_blank" rel="noopener noreferrer" className="btn-primary text-xs">
          <Navigation className="w-4 h-4" /> Get Directions
        </a>
        <a href={secondary} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs">
          <ExternalLink className="w-3.5 h-3.5" /> {isApple ? 'Google Maps' : 'Apple Maps'}
        </a>
        <span className="flex items-center gap-1 text-xs text-ink-muted">
          <MapPin className="w-3.5 h-3.5" /> {address} · {lat.toFixed(5)}, {lon.toFixed(5)}
        </span>
      </div>
    </div>
  );
}
