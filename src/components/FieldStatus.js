'use client';

import { useEffect, useState } from 'react';
import { MapPin, Clock, RefreshCw, CalendarClock } from 'lucide-react';
import { formatInstant, formatInstantRange } from '@/lib/datetimeLocal';

const statusConfig = {
  open: { label: 'Field Open', dot: 'bg-flyday-go' },
  closed: { label: 'Field Closed', dot: 'bg-flyday-nogo' },
  maintenance: { label: 'Maintenance', dot: 'bg-flyday-maybe' },
};

export default function FieldStatus() {
  const [fieldStatus, setFieldStatus] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const res = await fetch('/api/field-status', { cache: 'no-store' });
        if (!res.ok) throw new Error('unavailable');
        const data = await res.json();
        if (!isMounted) return;
        setFieldStatus(data.fieldStatus);
        // Only genuinely future windows; a running one is already reflected in
        // the status line above.
        const now = Date.now();
        setUpcoming((data.upcomingClosures ?? []).filter((c) => new Date(c.startsAt).getTime() > now));
      } catch {
        if (isMounted) setFieldStatus(null);
      } finally {
        if (isMounted) setLoaded(true);
      }
    };

    load();
    // An admin can flip the status at any time, so re-check periodically.
    const interval = window.setInterval(load, 60000);
    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  if (!loaded) {
    return (
      <div className="card flex items-center gap-2 text-sm text-ink-muted">
        <RefreshCw className="w-4 h-4 animate-spin" /> Checking field status...
      </div>
    );
  }

  const cfg = statusConfig[fieldStatus?.status] || statusConfig.open;

  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${cfg.dot} animate-pulse`} />
          <span className="font-display font-bold text-sm uppercase tracking-wider">{cfg.label}</span>
          {fieldStatus?.reason ? <span className="text-xs text-ink-muted">— {fieldStatus.reason}</span> : null}
        </div>

        <div className="w-px h-6 bg-black/10 hidden sm:block" />

        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <Clock className="w-4 h-4" />
          <span>10:00 AM – Dusk</span>
        </div>

        <div className="w-px h-6 bg-black/10 hidden sm:block" />

        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <MapPin className="w-4 h-4" />
          <span>Mammoth Park, PA</span>
        </div>
      </div>

      {fieldStatus?.source === 'scheduled' && fieldStatus.activeUntil ? (
        <p className="mt-3 text-xs text-ink-muted">
          Scheduled closure — the field reopens at {formatInstant(fieldStatus.activeUntil)}.
        </p>
      ) : null}

      {upcoming.length > 0 ? (
        <div className="mt-4 border-t border-black/10 pt-3">
          <p className="flex items-center gap-2 text-xs font-display font-bold uppercase tracking-wider text-ink-muted">
            <CalendarClock className="w-4 h-4" /> Scheduled closures
          </p>
          <ul className="mt-2 space-y-1">
            {upcoming.slice(0, 3).map((closure) => (
              <li key={closure.id} className="text-sm text-ink-muted">
                <span className="font-medium text-ink capitalize">{closure.status}</span>
                {' · '}
                {formatInstantRange(closure.startsAt, closure.endsAt)}
                {closure.reason ? ` — ${closure.reason}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
