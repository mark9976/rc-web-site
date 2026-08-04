'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminShell from '@/components/admin/AdminShell';
import { useAuth } from '@/components/AuthProvider';
import { readError } from '@/lib/apiClient';
import { Radio, CalendarClock, Trash2 } from 'lucide-react';
import { localInputToIso, formatInstant, formatInstantRange } from '@/lib/datetimeLocal';

const memberInputClass =
  'w-full rounded-3xl border border-black/10 bg-surface-card px-4 py-3 text-sm outline-none focus:border-field-green focus:ring-2 focus:ring-field-green/10';

function formatTimestamp(value) {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('default', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const FIELD_STATUSES = [
  { value: 'open', label: 'Open', active: 'bg-flyday-go text-white' },
  { value: 'closed', label: 'Closed', active: 'bg-flyday-nogo text-white' },
  { value: 'maintenance', label: 'Maintenance', active: 'bg-flyday-maybe text-white' },
];

export default function Page() {
  const auth = useAuth();
  const [fieldStatus, setFieldStatus] = useState(null);
  const [manualStatus, setManualStatus] = useState(null);
  const [statusReason, setStatusReason] = useState('');
  const [closures, setClosures] = useState([]);
  const [closureDraft, setClosureDraft] = useState({ status: 'closed', reason: '', startsAt: '', endsAt: '' });
  const [closureError, setClosureError] = useState('');
  // handleFieldStatus reports failures here.
  const [uploadError, setUploadError] = useState('');

  const refreshAdminData = useCallback(async () => {
    const statusRes = await fetch('/api/field-status', { cache: 'no-store' });
    if (statusRes.ok) {
      const data = await statusRes.json();
      setFieldStatus(data.fieldStatus ?? null);
      setManualStatus(data.manualStatus ?? null);
      setStatusReason(data.manualStatus?.reason ?? '');
    }
    const closuresRes = await fetch('/api/field-closures', { cache: 'no-store' });
    if (closuresRes.ok) setClosures((await closuresRes.json()).closures ?? []);
  }, []);

  useEffect(() => {
    if (auth.isAdmin) refreshAdminData();
  }, [auth.isAdmin, refreshAdminData]);

  const handleFieldStatus = async (status) => {
    try {
      const res = await fetch('/api/field-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason: statusReason }),
      });
      if (!res.ok) throw new Error(await readError(res, 'Unable to update field status.'));
      const data = await res.json();
      setFieldStatus(data.fieldStatus);
    } catch (error) {
      setUploadError(error.message);
    }
  };

  const scheduleClosure = async (event) => {
    event.preventDefault();
    setClosureError('');

    const startsAt = localInputToIso(closureDraft.startsAt);
    const endsAt = localInputToIso(closureDraft.endsAt);
    if (!startsAt || !endsAt) {
      setClosureError('Pick both a start and an end date/time.');
      return;
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      setClosureError('The end must come after the start.');
      return;
    }

    const res = await fetch('/api/field-closures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...closureDraft, startsAt, endsAt }),
    });
    if (!res.ok) {
      setClosureError(await readError(res, 'Unable to schedule the closure.'));
      return;
    }

    setClosureDraft({ status: 'closed', reason: '', startsAt: '', endsAt: '' });
    await refreshAdminData();
  };

  const removeClosure = async (body) => {
    await fetch('/api/field-closures', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    await refreshAdminData();
  };

  return (
    <AdminShell title="Field Status" subtitle="Open, closed or maintenance, plus scheduled closures">
      <>
        {uploadError ? <p className="mb-4 text-sm text-red-600">{uploadError}</p> : null}
      <div className="grid gap-6 lg:grid-cols-2 mb-8">

        <aside className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Radio className="w-6 h-6 text-flyday-go" />
            <div>
              <h3 className="font-display font-bold text-xl">Field Status</h3>
              <p className="text-sm text-ink-muted">Shown on the homepage banner.</p>
            </div>
          </div>

          {fieldStatus?.source === 'scheduled' ? (
            <div className="mb-4 rounded-3xl border border-flyday-maybe/30 bg-flyday-maybe/5 p-3 text-xs text-flyday-maybe">
              A scheduled closure is running right now and overrides the buttons below until{' '}
              <strong>{formatInstant(fieldStatus.activeUntil)}</strong>.
            </div>
          ) : null}

          <div className="space-y-3">
            <div className="flex gap-2">
              {FIELD_STATUSES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleFieldStatus(option.value)}
                  className={`flex-1 py-3 rounded-lg font-display font-bold text-xs uppercase tracking-wider transition-colors ${
                    manualStatus?.status === option.value
                      ? option.active
                      : 'bg-surface-muted text-ink-muted hover:bg-surface-card'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={statusReason}
              onChange={(event) => setStatusReason(event.target.value)}
              placeholder="Optional reason (e.g., mowing today)"
              className="w-full px-4 py-3 rounded-lg border border-black/10 bg-surface-card text-sm focus:outline-none focus:ring-2 focus:ring-field-green/30"
            />
            {manualStatus?.updatedAt ? (
              <p className="text-xs text-ink-light">
                Last set by {manualStatus.updatedBy} on {formatTimestamp(manualStatus.updatedAt)}. Pick a status to apply the reason.
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      <div className="card p-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <CalendarClock className="w-6 h-6 text-flyday-maybe" />
            <div>
              <h3 className="font-display font-bold text-xl">Scheduled Closures</h3>
              <p className="text-sm text-ink-muted">
                Announce a closure ahead of time. The field switches itself over for the window, then reverts.
              </p>
            </div>
          </div>
          {closures.some((c) => new Date(c.endsAt) <= new Date()) ? (
            <button type="button" onClick={() => removeClosure({ action: 'purgeExpired' })} className="btn-secondary text-xs shrink-0">
              Clear past closures
            </button>
          ) : null}
        </div>

        <form onSubmit={scheduleClosure} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end mb-6">
          <label className="block">
            <span className="text-sm font-medium text-ink">Status</span>
            <select
              value={closureDraft.status}
              onChange={(event) => setClosureDraft({ ...closureDraft, status: event.target.value })}
              className={`mt-2 ${memberInputClass}`}
            >
              <option value="closed">Closed</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">Starts</span>
            <input
              type="datetime-local"
              value={closureDraft.startsAt}
              onChange={(event) => setClosureDraft({ ...closureDraft, startsAt: event.target.value })}
              className={`mt-2 ${memberInputClass}`}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">Ends</span>
            <input
              type="datetime-local"
              value={closureDraft.endsAt}
              onChange={(event) => setClosureDraft({ ...closureDraft, endsAt: event.target.value })}
              className={`mt-2 ${memberInputClass}`}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">Reason</span>
            <input
              value={closureDraft.reason}
              onChange={(event) => setClosureDraft({ ...closureDraft, reason: event.target.value })}
              placeholder="Mowing, event setup, wet field"
              className={`mt-2 ${memberInputClass}`}
            />
          </label>
          <button type="submit" className="btn-primary justify-center py-3">Schedule</button>
        </form>

        {closureError ? <p className="mb-4 text-sm text-red-600">{closureError}</p> : null}

        <div className="space-y-2">
          {closures.length === 0 ? (
            <div className="rounded-3xl bg-surface-muted p-6 text-center text-sm text-ink-muted">
              Nothing scheduled. The field follows the status buttons above.
            </div>
          ) : (
            closures.map((closure) => {
              const now = new Date();
              const start = new Date(closure.startsAt);
              const end = new Date(closure.endsAt);
              const state = end <= now ? 'past' : start <= now ? 'active' : 'upcoming';
              const stateStyles = {
                active: 'border-flyday-nogo/40 bg-flyday-nogo/5',
                upcoming: 'border-black/10 bg-surface-card',
                past: 'border-black/5 bg-surface-muted opacity-60',
              };
              const stateLabel = { active: 'in effect now', upcoming: 'upcoming', past: 'finished' };

              return (
                <div
                  key={closure.id}
                  className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-3xl border p-4 ${stateStyles[state]}`}
                >
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-ink capitalize">
                      {closure.status}
                      <span className="ml-2 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                        {stateLabel[state]}
                      </span>
                    </p>
                    <p className="text-sm text-ink-muted mt-1">{formatInstantRange(closure.startsAt, closure.endsAt)}</p>
                    {closure.reason ? <p className="text-sm text-ink-muted mt-1">{closure.reason}</p> : null}
                    <p className="text-xs text-ink-light mt-1">Set by {closure.createdBy}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Remove this scheduled closure?')) removeClosure({ id: closure.id });
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-flyday-nogo/10 px-3 py-1 text-xs font-semibold text-flyday-nogo hover:bg-flyday-nogo/20 shrink-0 self-start"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
      </>
    </AdminShell>
  );
}
