'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { useAuth } from '@/components/AuthProvider';
import { readError } from '@/lib/apiClient';
import { BarChart3, Users, Clock, CalendarDays, Sunrise, Lock, ArrowLeft } from 'lucide-react';

const RANGES = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
];

const DAY_ABBREVIATIONS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatHour(hour) {
  if (hour === null || hour === undefined) return '—';
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${suffix}`;
}

function formatDuration(minutes) {
  if (!minutes) return '—';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function formatDayLabel(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('default', { month: 'short', day: 'numeric' });
}

/** Horizontal bars, sized against the largest value in the set. */
function BarRow({ label, count, max, highlight }) {
  const width = max > 0 ? Math.max(2, (count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs text-ink-muted text-right">{label}</span>
      <div className="flex-1 h-6 rounded-full bg-surface-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${highlight ? 'bg-field-green' : 'bg-field-green/50'}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-xs font-semibold text-ink tabular-nums">{count}</span>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 text-ink-muted mb-2">
        <Icon className="w-4 h-4" />
        <p className="text-xs uppercase tracking-[0.16em]">{label}</p>
      </div>
      <p className="font-display font-bold text-3xl text-ink">{value}</p>
      {sub ? <p className="text-xs text-ink-muted mt-1">{sub}</p> : null}
    </div>
  );
}

export default function FieldStatsPage() {
  const auth = useAuth();
  const [range, setRange] = useState(30);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const isAdmin = auth.isAdmin;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/field-stats?range=${range}d`, { cache: 'no-store' });
      if (!res.ok) throw new Error(await readError(res, 'Unable to load field statistics.'));
      setStats(await res.json());
      setError('');
    } catch (loadError) {
      setError(loadError.message);
    }
    setLoading(false);
  }, [range]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  if (!auth.authLoaded) {
    return (
      <PageShell title="Field Activity" subtitle="Check-in statistics">
        <p className="text-sm text-ink-muted">Checking your access…</p>
      </PageShell>
    );
  }

  if (!isAdmin) {
    return (
      <PageShell title="Field Activity" subtitle="Check-in statistics">
        <div className="card p-6 flex items-start gap-3">
          <Lock className="w-5 h-5 text-flyday-maybe shrink-0 mt-0.5" />
          <div>
            <p className="font-display font-bold text-lg">Admin access required</p>
            <p className="text-sm text-ink-muted mt-1">
              Sign in with an admin account to view field activity.{' '}
              <Link href="/login/" className="text-field-green font-semibold">Sign in</Link>
            </p>
          </div>
        </div>
      </PageShell>
    );
  }

  const maxDaily = Math.max(0, ...(stats?.dailyCounts ?? []).map((d) => d.count));
  const maxDow = Math.max(0, ...(stats?.byDayOfWeek ?? []).map((d) => d.count));
  const maxHour = Math.max(0, ...(stats?.byHourOfDay ?? []).map((h) => h.count));
  const maxVisits = Math.max(0, ...(stats?.topVisitors ?? []).map((v) => v.visits));

  // Day-of-week reads better in calendar order than ranked by volume.
  const dowInWeekOrder = [...(stats?.byDayOfWeek ?? [])].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const hoursInClockOrder = [...(stats?.byHourOfDay ?? [])].sort((a, b) => a.hour - b.hour);

  return (
    <PageShell title="Field Activity" subtitle="Who is using the field, and when">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <Link href="/admin/" className="inline-flex items-center gap-2 text-sm text-field-green font-semibold">
          <ArrowLeft className="w-4 h-4" /> Back to dashboard
        </Link>
        <div className="flex gap-2">
          {RANGES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setRange(option.value)}
              className={`rounded-full px-4 py-2 text-xs font-display font-bold uppercase tracking-wider transition-colors ${
                range === option.value
                  ? 'bg-field-green text-white'
                  : 'bg-surface-muted text-ink-muted hover:bg-surface-card'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="mb-6 text-sm text-red-600">{error}</p> : null}

      {loading && !stats ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : stats && stats.totalCheckins === 0 ? (
        <div className="card p-8 text-center">
          <BarChart3 className="w-10 h-10 text-field-green/30 mx-auto mb-3" />
          <p className="font-display font-bold text-lg">No check-ins in the last {range} days</p>
          <p className="text-sm text-ink-muted mt-1">
            Statistics appear once members start checking in from the app.
          </p>
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
            <StatCard icon={BarChart3} label="Check-ins" value={stats.totalCheckins} sub={`last ${range} days`} />
            <StatCard icon={Users} label="Members" value={stats.uniqueMembers} sub="distinct flyers" />
            <StatCard
              icon={Clock}
              label="Avg session"
              value={formatDuration(stats.averageDurationMinutes)}
              sub={stats.averageDurationMinutes ? 'per visit' : 'no completed visits'}
            />
            <StatCard icon={CalendarDays} label="Busiest day" value={stats.busiestDay ?? '—'} />
            <StatCard icon={Sunrise} label="Peak hour" value={formatHour(stats.busiestHour)} />
          </div>

          <div className="card p-6 mb-6">
            <h3 className="font-display font-bold text-xl mb-1">Check-ins per day</h3>
            <p className="text-sm text-ink-muted mb-5">Only days with at least one check-in are listed.</p>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {stats.dailyCounts.map((day) => (
                <BarRow
                  key={day.date}
                  label={formatDayLabel(day.date)}
                  count={day.count}
                  max={maxDaily}
                  highlight={day.count === maxDaily}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 mb-6">
            <div className="card p-6">
              <h3 className="font-display font-bold text-xl mb-5">By day of week</h3>
              <div className="space-y-2">
                {dowInWeekOrder.map((day) => (
                  <BarRow
                    key={day.dayOfWeek}
                    label={DAY_ABBREVIATIONS[day.dayOfWeek]}
                    count={day.count}
                    max={maxDow}
                    highlight={day.count === maxDow && day.count > 0}
                  />
                ))}
              </div>
            </div>

            <div className="card p-6">
              <h3 className="font-display font-bold text-xl mb-5">By hour of day</h3>
              {hoursInClockOrder.length === 0 ? (
                <p className="text-sm text-ink-muted">No data yet.</p>
              ) : (
                <div className="space-y-2">
                  {hoursInClockOrder.map((entry) => (
                    <BarRow
                      key={entry.hour}
                      label={formatHour(entry.hour)}
                      count={entry.count}
                      max={maxHour}
                      highlight={entry.count === maxHour}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-display font-bold text-xl mb-5">Most frequent flyers</h3>
            {stats.topVisitors.length === 0 ? (
              <p className="text-sm text-ink-muted">No visits recorded yet.</p>
            ) : (
              <ul className="divide-y divide-black/5">
                {stats.topVisitors.map((visitor, index) => (
                  <li key={visitor.userId} className="flex items-center gap-4 py-3">
                    <span className="w-6 shrink-0 font-display font-bold text-ink-muted tabular-nums">
                      {index + 1}
                    </span>
                    <span className="flex-1 min-w-0 truncate font-medium text-ink">{visitor.userName}</span>
                    <div className="w-40 hidden sm:block">
                      <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-field-green"
                          style={{ width: `${maxVisits > 0 ? (visitor.visits / maxVisits) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-20 shrink-0 text-right text-sm text-ink-muted tabular-nums">
                      {visitor.visits} {visitor.visits === 1 ? 'visit' : 'visits'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </PageShell>
  );
}
