'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminShell from '@/components/admin/AdminShell';
import { useAuth } from '@/components/AuthProvider';
import { readError } from '@/lib/apiClient';
import { CalendarDays, Pencil, Trash2 } from 'lucide-react';

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

export default function Page() {
  const auth = useAuth();
  const [eventTypes, setEventTypes] = useState([]);
  const [typeDraft, setTypeDraft] = useState({ id: null, name: '', color: '#2D5A27' });
  const [typeError, setTypeError] = useState('');

  const refreshAdminData = useCallback(async () => {
    const res = await fetch('/api/event-types', { cache: 'no-store' });
    if (res.ok) setEventTypes((await res.json()).eventTypes ?? []);
  }, []);

  useEffect(() => {
    if (auth.isAdmin) refreshAdminData();
  }, [auth.isAdmin, refreshAdminData]);

  const saveEventType = async (submitEvent) => {
    submitEvent.preventDefault();
    setTypeError('');

    const editing = Boolean(typeDraft.id);
    const res = await fetch('/api/event-types', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(typeDraft),
    });
    if (!res.ok) {
      setTypeError(await readError(res, 'Unable to save the type.'));
      return;
    }

    setTypeDraft({ id: null, name: '', color: '#2D5A27' });
    await refreshAdminData();
  };

  const deleteEventType = async (type) => {
    if (!window.confirm(`Delete the “${type.name}” type?`)) return;
    const res = await fetch('/api/event-types', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: type.id }),
    });
    // The API refuses when events still use the type and says how many.
    if (!res.ok) {
      setTypeError(await readError(res, 'Unable to delete the type.'));
      return;
    }
    setTypeError('');
    await refreshAdminData();
  };

  return (
    <AdminShell title="Event Types" subtitle="Categories offered when adding an event">
      <>

      <div className="card p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <CalendarDays className="w-6 h-6 text-field-green" />
          <div>
            <h3 className="font-display font-bold text-xl">Event Types</h3>
            <p className="text-sm text-ink-muted">
              The categories offered when adding an event. The colour is used for the badge on the events page.
            </p>
          </div>
        </div>

        <form onSubmit={saveEventType} className="flex flex-wrap items-end gap-3 mb-5">
          <label className="block flex-1 min-w-[12rem]">
            <span className="text-sm font-medium text-ink">{typeDraft.id ? 'Rename type' : 'New type'}</span>
            <input
              value={typeDraft.name}
              onChange={(event) => setTypeDraft({ ...typeDraft, name: event.target.value })}
              placeholder="Night Fly"
              className={`mt-2 ${memberInputClass}`}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">Colour</span>
            <input
              type="color"
              value={typeDraft.color}
              onChange={(event) => setTypeDraft({ ...typeDraft, color: event.target.value })}
              className="mt-2 h-12 w-20 cursor-pointer rounded-2xl border border-black/10 bg-surface-card p-1"
            />
          </label>
          <button type="submit" className="btn-primary text-sm py-3">
            {typeDraft.id ? 'Save changes' : 'Add type'}
          </button>
          {typeDraft.id ? (
            <button
              type="button"
              onClick={() => { setTypeDraft({ id: null, name: '', color: '#2D5A27' }); setTypeError(''); }}
              className="btn-secondary text-sm py-3"
            >
              Cancel
            </button>
          ) : null}
        </form>

        {typeError ? <p className="mb-4 text-sm text-red-600">{typeError}</p> : null}

        {eventTypes.length === 0 ? (
          <div className="rounded-3xl bg-surface-muted p-6 text-center text-sm text-ink-muted">
            No event types yet. Add one above.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {eventTypes.map((type) => (
              <div
                key={type.id}
                className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-surface-card py-1 pl-1 pr-2"
              >
                <span
                  className="rounded-full px-3 py-1 text-xs font-display font-bold uppercase tracking-wider"
                  style={{ backgroundColor: `${type.color}1a`, color: type.color }}
                >
                  {type.name}
                </span>
                <button
                  type="button"
                  onClick={() => { setTypeDraft({ id: type.id, name: type.name, color: type.color }); setTypeError(''); }}
                  className="text-ink-muted hover:text-field-green"
                  title={`Edit ${type.name}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteEventType(type)}
                  className="text-ink-muted hover:text-flyday-nogo"
                  title={`Delete ${type.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-ink-light">
          Renaming a type relabels every event using it. A type still in use cannot be deleted.
        </p>
      </div>
      </>
    </AdminShell>
  );
}
