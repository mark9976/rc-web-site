'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { CalendarDays, MapPin, Clock, Users, Edit, Plus, ShieldCheck, User, Trash2, ExternalLink, Link as LinkIcon, Upload, Image as ImageIcon } from 'lucide-react';
import { formatDateDisplay, normalizeDateString, parseDateString } from '@/lib/dateUtils';
import { readError } from '@/lib/apiClient';

const guestUser = { id: 'guest', name: 'Visitor', role: 'guest' };

const DEFAULT_TYPE_COLOR = '#6B7280';

/**
 * Types are admin-managed, so their colours arrive from the database and are
 * applied inline — Tailwind only emits classes it can see in the source, so a
 * class name built from data would never make it into the stylesheet.
 */
function typeBadgeStyle(color) {
  const hex = color || DEFAULT_TYPE_COLOR;
  return { backgroundColor: `${hex}1a`, color: hex };
}

/** Inclusive list of YYYY-MM-DD keys an event covers. */
function datesCovered(event) {
  const start = normalizeDateString(event.date);
  if (!start) return [];
  const end = normalizeDateString(event.endDate);
  if (!end || end <= start) return [start];

  const days = [];
  const cursor = parseDateString(start);
  const last = parseDateString(end);
  // Walk with local Date arithmetic and re-serialise from local parts, so no
  // UTC conversion ever enters the loop.
  while (cursor <= last && days.length < 366) {
    days.push(normalizeDateString(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/** "August 15" or "August 15 – 17" / "August 30 – September 2". */
function formatEventDateRange(event) {
  const start = formatDateDisplay(event.date);
  if (!event.endDate) return start;

  const startParsed = parseDateString(event.date);
  const endParsed = parseDateString(event.endDate);
  if (!startParsed || !endParsed) return start;

  const sameMonth =
    startParsed.getMonth() === endParsed.getMonth() && startParsed.getFullYear() === endParsed.getFullYear();
  return sameMonth ? `${start} – ${endParsed.getDate()}` : `${start} – ${formatDateDisplay(event.endDate)}`;
}

const roleLabels = {
  guest: { title: 'Visitor', description: 'View-only access. Sign in as a member or admin to manage events.', icon: User },
  member: { title: 'Member', description: 'Members can add and update their own events.', icon: Users },
  admin: { title: 'Admin', description: 'Admins can update any event on the calendar.', icon: ShieldCheck },
};

function canEditEvent(event, user) {
  return user.role === 'admin' || (user.role === 'member' && event.ownerId === user.id);
}

function createEmptyEvent(user) {
  return {
    id: Date.now(),
    title: '',
    date: '',
    endDate: '',
    startTime: '',
    endTime: '',
    time: '',
    location: '',
    type: 'Meeting',
    desc: '',
    link: '',
    ownerId: user.id,
    ownerName: user.name,
  };
}

function formatTimeDisplay(startTime, endTime) {
  if (!startTime) return '';
  const format = (time) => {
    const [hours, minutes] = time.split(':').map(Number);
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 === 0 ? 12 : hours % 12;
    return `${displayHour}:${String(minutes).padStart(2, '0')} ${suffix}`;
  };
  if (endTime) {
    return `${format(startTime)} – ${format(endTime)}`;
  }
  return format(startTime);
}

function normalizeTimeValue(time) {
  if (!time) return '';
  const matches = time.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM|am|pm))?$/);
  if (!matches) return time;
  let [, rawHour, minute, suffix] = matches;
  let hour = Number(rawHour);
  if (suffix) {
    const upper = suffix.toUpperCase();
    if (upper === 'PM' && hour < 12) hour += 12;
    if (upper === 'AM' && hour === 12) hour = 0;
  }
  return `${String(hour).padStart(2, '0')}:${minute}`;
}

function normalizeEvent(event) {
  const normalizedDate = normalizeDateString(event.date || event);
  const startTime = event.startTime || normalizeTimeValue(event.time);
  const endTime = event.endTime || '';
  const time = event.time || formatTimeDisplay(startTime, endTime);
  return {
    ...event,
    date: normalizedDate,
    startTime,
    endTime,
    time,
  };
}

function getDateKey(dateString) {
  return normalizeDateString(dateString);
}

function getCalendarDays(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startDay = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];
  const prevMonthDays = new Date(year, month, 0).getDate();
  const totalCells = 42;

  for (let index = 0; index < totalCells; index += 1) {
    const dayOffset = index - startDay;
    let day;
    if (dayOffset < 0) {
      day = new Date(year, month - 1, prevMonthDays + dayOffset + 1);
    } else if (dayOffset >= daysInMonth) {
      day = new Date(year, month + 1, dayOffset - daysInMonth + 1);
    } else {
      day = new Date(year, month, dayOffset + 1);
    }
    days.push(day);
  }

  return days;
}

export default function EventsPage() {
  const auth = useAuth();
  const activeUser = auth.currentUser ?? guestUser;
  const [events, setEvents] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState(createEmptyEvent(activeUser));
  const [error, setError] = useState('');
  const [eventTypes, setEventTypes] = useState([]);
  const [photoFile, setPhotoFile] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const res = await fetch('/api/events');
        if (!res.ok) throw new Error('Unable to load events.');
        const data = await res.json();
        const loadedEvents = Array.isArray(data.events) ? data.events : [];
        setEvents(loadedEvents.map(normalizeEvent));
      } catch (fetchError) {
        setError(fetchError.message || 'Unable to load events.');
      }
    };

    loadEvents();

    // Categories are admin-managed, so the editor and the badges read them
    // from the server rather than a hardcoded list.
    fetch('/api/event-types')
      .then((res) => (res.ok ? res.json() : { eventTypes: [] }))
      .then((data) => setEventTypes(data.eventTypes ?? []))
      .catch(() => setEventTypes([]));
  }, []);

  useEffect(() => {
    setDraft(createEmptyEvent(activeUser));
    setEditorOpen(false);
    setError('');
  }, [activeUser]);

  const sortedEvents = [...events]
    .map(normalizeEvent)
    .sort((a, b) => {
      const aKey = getDateKey(a.date) || '';
      const bKey = getDateKey(b.date) || '';
      return aKey.localeCompare(bKey);
    });

  const monthKey = `${currentMonth.getFullYear()}-${currentMonth.getMonth()}`;
  const calendarDays = useMemo(() => getCalendarDays(currentMonth.getFullYear(), currentMonth.getMonth()), [currentMonth]);
  const eventsByDate = useMemo(() => {
    // A multi-day event appears on every day it covers, not just its start.
    return events.reduce((acc, event) => {
      for (const key of datesCovered(event)) {
        acc[key] = acc[key] ? [...acc[key], event] : [event];
      }
      return acc;
    }, {});
  }, [events]);

  const startNewEvent = () => {
    setPhotoFile(null);
    setRemovePhoto(false);
    setDraft(createEmptyEvent(activeUser));
    setEditorOpen(true);
    setError('');
  };

  const startEditEvent = (event) => {
    setPhotoFile(null);
    setRemovePhoto(false);
    setDraft(normalizeEvent(event));
    setEditorOpen(true);
    setError('');
  };

  const saveEvent = async () => {
    if (!draft.title.trim() || !draft.date.trim() || !draft.startTime.trim() || !draft.location.trim()) {
      setError('Title, date, start time, and location are required.');
      return;
    }

    if (!canEditEvent(draft, activeUser)) {
      setError('You do not have permission to update this event.');
      return;
    }

    const timeString = formatTimeDisplay(draft.startTime, draft.endTime);

    // Sent as multipart so an optional poster image can ride along with the
    // fields. The API still accepts JSON for callers that send no image.
    const body = new FormData();
    for (const [key, value] of Object.entries({ ...draft, time: timeString })) {
      if (value !== null && value !== undefined && typeof value !== 'object') {
        body.append(key, value);
      }
    }
    if (photoFile) body.append('photo', photoFile);
    if (removePhoto) body.set('removePhoto', 'true');

    try {
      const res = await fetch('/api/events', { method: 'POST', body });
      if (!res.ok) {
        throw new Error(await readError(res, 'Unable to save event.'));
      }
      const data = await res.json();
      const returnedEvent = normalizeEvent(data.event);
      setEvents((prevEvents) => {
        const exists = prevEvents.some((event) => event.id === returnedEvent.id);
        if (exists) {
          return prevEvents.map((event) => (event.id === returnedEvent.id ? returnedEvent : event));
        }
        return [returnedEvent, ...prevEvents];
      });
      setEditorOpen(false);
    } catch (saveError) {
      setError(saveError.message || 'Unable to save event.');
    }
  };

  const deleteEvent = async (eventId) => {
    const event = events.find((item) => item.id === eventId);
    if (!event || !canEditEvent(event, activeUser)) return;
    if (!window.confirm('Delete this event?')) return;

    try {
      const res = await fetch('/api/events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: eventId }),
      });
      if (!res.ok) {
        throw new Error(await readError(res, 'Unable to delete event.'));
      }
      setEvents((prevEvents) => prevEvents.filter((item) => item.id !== eventId));
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete event.');
    }
  };

  const roleData = roleLabels[activeUser.role];

  return (
    <PageShell title="Events" subtitle="Club meetings, fly-ins, float flies, and more">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] mb-8">
        <div className="card p-6">
          <div className="flex items-center gap-4 mb-4">
            <CalendarDays className="w-14 h-14 text-field-green/40" />
            <div>
              <h3 className="font-display font-bold text-xl">Interactive Calendar</h3>
              <p className="text-sm text-ink-muted max-w-2xl">
                Events are live on this page. Manage the calendar based on your member or admin access.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-3xl border border-black/10 bg-surface-card p-5">
              <p className="text-sm font-medium text-ink">Signed in as</p>
              <p className="mt-2 text-lg font-display font-semibold">{activeUser.name}</p>
              <p className="text-xs text-ink-muted mt-1">{roleLabels[activeUser.role].title}</p>
            </div>
            {activeUser.role === 'guest' ? (
              <div className="rounded-3xl border border-flyday-maybe/20 bg-flyday-maybe/5 p-5 text-sm text-ink-muted">
                <p className="font-semibold text-ink">Member access required to post events.</p>
                <p className="mt-2">Please <Link href="/login/" className="text-field-green font-semibold">sign in</Link> or request access from the Membership page.</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-3xl bg-surface-muted p-3">
              <roleData.icon className="w-6 h-6 text-field-green" />
            </div>
            <div>
              <p className="text-sm text-ink-muted uppercase tracking-[0.2em]">Current access</p>
              <h2 className="font-display font-bold text-xl">{activeUser.name}</h2>
              <p className="mt-2 text-sm text-ink-muted">{roleData.description}</p>
            </div>
          </div>
          <div className="mt-6 rounded-3xl bg-surface-card p-4 text-sm text-ink-muted">
            <p>
              {activeUser.role === 'guest'
                ? 'Sign in as a member or admin to add or manage events.'
                : activeUser.role === 'member'
                ? 'Members may update only their own events.'
                : 'Admins can update any event in the calendar.'}
            </p>
          </div>
          {activeUser.role !== 'guest' ? (
            <button
              type="button"
              onClick={startNewEvent}
              className="btn-primary mt-6 w-full justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Event
            </button>
          ) : null}
        </div>
      </div>

      <div className="card mb-8 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
          <div>
            <h3 className="font-display font-bold text-xl">Month Calendar</h3>
            <p className="text-sm text-ink-muted">View events placed on the calendar by date.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
              className="btn-secondary text-xs"
            >
              Previous
            </button>
            <div className="text-sm font-semibold text-ink">
              {currentMonth.toLocaleString('default', { month: 'long' })} {currentMonth.getFullYear()}
            </div>
            <button
              type="button"
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
              className="btn-secondary text-xs"
            >
              Next
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px bg-black/5 text-center text-xs uppercase tracking-[0.16em] text-ink-muted">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="bg-surface-muted py-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-black/5 text-sm">
          {calendarDays.map((day) => {
            const key = getDateKey(day);
            const dayEvents = eventsByDate[key] ?? [];
            const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
            return (
              <div
                key={key}
                className={`min-h-[120px] bg-white p-3 text-left ${isCurrentMonth ? 'bg-white' : 'bg-black/5 text-ink-muted'} border border-black/5`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-display text-sm font-semibold">{day.getDate()}</span>
                  {dayEvents.length > 0 ? (
                    <span className="rounded-full bg-field-green/10 text-field-green px-2 py-0.5 text-[10px] font-semibold">
                      {dayEvents.length} event{dayEvents.length > 1 ? 's' : ''}
                    </span>
                  ) : null}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 2).map((event) => (
                    <div key={event.id} className="rounded-2xl border border-black/10 bg-surface-muted px-2 py-1 text-[11px] text-ink overflow-hidden text-ellipsis whitespace-nowrap">
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 ? (
                    <div className="text-[11px] text-ink-muted">+{dayEvents.length - 2} more</div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {editorOpen ? (
        // Capped to the dynamic viewport height with the fields in their own
        // scroll area, so Save stays reachable on a phone. 100dvh rather than
        // 100vh: iOS measures vh without the address bar, which pushes the
        // footer off-screen.
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-6">
          <div className="flex w-full max-w-3xl max-h-[100dvh] sm:max-h-[calc(100dvh-3rem)] flex-col rounded-t-[32px] sm:rounded-[32px] border border-black/10 bg-white shadow-2xl">
            <div className="shrink-0 flex items-start justify-between gap-4 border-b border-black/5 p-6 pb-4">
              <div>
                <h3 className="font-display font-bold text-xl">{events.some((item) => item.id === draft.id) ? 'Edit Event' : 'New Event'}</h3>
                <p className="text-sm text-ink-muted">Your changes are saved to the club calendar database.</p>
              </div>
              <button type="button" onClick={() => setEditorOpen(false)} className="shrink-0 text-xs uppercase tracking-[0.2em] text-ink-muted">
                Close
              </button>
            </div>
          <div className="flex-1 overflow-y-auto p-6 grid gap-4 lg:grid-cols-2 content-start">
            <label className="block">
              <span className="text-sm font-medium text-ink">Title</span>
              <input
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                className="mt-2 w-full rounded-3xl border border-black/10 bg-surface-card px-4 py-3 text-sm outline-none focus:border-field-green focus:ring-2 focus:ring-field-green/10"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Type</span>
              <select
                value={draft.type}
                onChange={(event) => setDraft({ ...draft, type: event.target.value })}
                className="mt-2 w-full rounded-3xl border border-black/10 bg-surface-card px-4 py-3 text-sm outline-none focus:border-field-green focus:ring-2 focus:ring-field-green/10"
              >
                {/* Admins manage this list from the dashboard. The event's own
                    type is included even if it has since been removed, so
                    editing an old event cannot silently recategorise it. */}
                {eventTypes.map((type) => (
                  <option key={type.id} value={type.name}>{type.name}</option>
                ))}
                {draft.type && !eventTypes.some((type) => type.name === draft.type) ? (
                  <option value={draft.type}>{draft.type}</option>
                ) : null}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Date</span>
              <input
                type="date"
                value={draft.date}
                onChange={(event) => setDraft({ ...draft, date: event.target.value })}
                className="mt-2 w-full rounded-3xl border border-black/10 bg-surface-card px-4 py-3 text-sm outline-none focus:border-field-green focus:ring-2 focus:ring-field-green/10"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">End date (optional)</span>
              <input
                type="date"
                value={draft.endDate ?? ''}
                min={draft.date || undefined}
                onChange={(event) => setDraft({ ...draft, endDate: event.target.value })}
                className="mt-2 w-full rounded-3xl border border-black/10 bg-surface-card px-4 py-3 text-sm outline-none focus:border-field-green focus:ring-2 focus:ring-field-green/10"
              />
              <span className="mt-1 block text-xs text-ink-light">
                For events running more than one day. Leave blank for a single day.
              </span>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-ink">Start time</span>
                <input
                  type="time"
                  value={draft.startTime}
                  onChange={(event) => setDraft({ ...draft, startTime: event.target.value })}
                  className="mt-2 w-full rounded-3xl border border-black/10 bg-surface-card px-4 py-3 text-sm outline-none focus:border-field-green focus:ring-2 focus:ring-field-green/10"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink">End time</span>
                <input
                  type="time"
                  value={draft.endTime}
                  onChange={(event) => setDraft({ ...draft, endTime: event.target.value })}
                  className="mt-2 w-full rounded-3xl border border-black/10 bg-surface-card px-4 py-3 text-sm outline-none focus:border-field-green focus:ring-2 focus:ring-field-green/10"
                />
              </label>
            </div>
            <label className="block lg:col-span-2">
              <span className="text-sm font-medium text-ink">Location</span>
              <input
                value={draft.location}
                onChange={(event) => setDraft({ ...draft, location: event.target.value })}
                placeholder="Mammoth Park Pavilion"
                className="mt-2 w-full rounded-3xl border border-black/10 bg-surface-card px-4 py-3 text-sm outline-none focus:border-field-green focus:ring-2 focus:ring-field-green/10"
              />
            </label>
            <label className="block lg:col-span-2">
              <span className="text-sm font-medium text-ink">Description</span>
              <textarea
                value={draft.desc}
                onChange={(event) => setDraft({ ...draft, desc: event.target.value })}
                rows={4}
                placeholder="Add event details and instructions here."
                className="mt-2 w-full rounded-3xl border border-black/10 bg-surface-card px-4 py-3 text-sm outline-none focus:border-field-green focus:ring-2 focus:ring-field-green/10"
              />
            </label>

            <label className="block lg:col-span-2">
              <span className="text-sm font-medium text-ink">Event website (optional)</span>
              <input
                type="url"
                inputMode="url"
                value={draft.link ?? ''}
                onChange={(event) => setDraft({ ...draft, link: event.target.value })}
                placeholder="https://example.com/fun-fly"
                className="mt-2 w-full rounded-3xl border border-black/10 bg-surface-card px-4 py-3 text-sm outline-none focus:border-field-green focus:ring-2 focus:ring-field-green/10"
              />
              <span className="mt-1 block text-xs text-ink-light">
                Adds a &ldquo;Details&rdquo; button to the event. Leave blank if there is no page.
              </span>
            </label>

            <div className="block lg:col-span-2">
              <span className="text-sm font-medium text-ink">Flyer or photo (optional)</span>
              <div className="mt-2 flex flex-wrap items-center gap-4">
                {/* Shows the newly picked file if there is one, otherwise
                    whatever is already stored for this event. */}
                {(photoFile || (draft.hasPhoto && !removePhoto)) ? (
                  <img
                    src={photoFile ? URL.createObjectURL(photoFile) : `/api/events/photo/${encodeURIComponent(draft.id)}`}
                    alt=""
                    className="h-20 w-20 rounded-2xl object-cover border border-black/10"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-2xl border border-dashed border-black/15 bg-surface-muted flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-ink-light/40" />
                  </div>
                )}
                <div className="flex flex-wrap gap-3">
                  <label className="btn-secondary text-xs cursor-pointer">
                    <Upload className="w-3.5 h-3.5" /> {photoFile || draft.hasPhoto ? 'Change image' : 'Add image'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        setPhotoFile(event.target.files?.[0] ?? null);
                        setRemovePhoto(false);
                      }}
                    />
                  </label>
                  {(photoFile || (draft.hasPhoto && !removePhoto)) ? (
                    <button
                      type="button"
                      onClick={() => { setPhotoFile(null); setRemovePhoto(true); }}
                      className="inline-flex items-center gap-1 rounded-full bg-flyday-nogo/10 px-3 py-1 text-xs font-semibold text-flyday-nogo hover:bg-flyday-nogo/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  ) : null}
                </div>
              </div>
              {removePhoto ? (
                <span className="mt-2 block text-xs text-flyday-nogo">Image will be removed when you save.</span>
              ) : null}
            </div>
          </div>
          {/* Pinned below the scroll area: Save is visible without scrolling,
              whatever the form's height. pb-safe keeps it clear of the iPhone
              home indicator. */}
          <div className="shrink-0 border-t border-black/5 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6">
            {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-3xl border border-black/10 bg-surface-card px-5 py-3 text-sm font-medium text-ink transition hover:bg-surface-muted"
              >
                Cancel
              </button>
              <button type="button" onClick={saveEvent} className="btn-primary justify-center rounded-3xl px-5 py-3 text-sm font-medium">
                Save Event
              </button>
            </div>
          </div>
        </div>
      </div>
      ) : null}

      <div className="space-y-4">
        {sortedEvents.map((event) => {
          const editable = canEditEvent(event, activeUser);
          return (
            <div
              key={event.id}
              className={`card hover:shadow-md transition-shadow group ${
                event.link ? 'border-l-4 border-l-sky-deep' : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="sm:w-32 shrink-0">
                  <p className="font-display font-bold text-lg text-ink">{formatEventDateRange(event)}</p>
                  <p className="text-xs text-ink-muted">{event.time}</p>
                  {event.endDate ? (
                    <p className="mt-1 inline-block rounded-full bg-field-green/10 px-2 py-0.5 text-[10px] font-semibold text-field-green">
                      {datesCovered(event).length} days
                    </p>
                  ) : null}
                </div>

                {/* Poster thumbnail, only rendered when the event has one so the
                    layout never reserves empty space. */}
                {event.hasPhoto ? (
                  <a
                    href={`/api/events/photo/${encodeURIComponent(event.id)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 self-start"
                    title="View full size"
                  >
                    <img
                      src={`/api/events/photo/${encodeURIComponent(event.id)}`}
                      alt={`Flyer for ${event.title}`}
                      loading="lazy"
                      className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl object-cover border border-black/10 transition-transform hover:scale-[1.03]"
                    />
                  </a>
                ) : null}

                <div className="flex-1">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <span
                        className="inline-block text-xs font-display font-bold uppercase tracking-wider px-2 py-1 rounded mb-2"
                        style={typeBadgeStyle(eventTypes.find((type) => type.name === event.type)?.color)}
                      >
                        {event.type}
                      </span>
                      <h3 className="font-display font-bold text-xl text-ink group-hover:text-field-green transition-colors flex items-center gap-2">
                        {event.title}
                        {event.link ? (
                          <LinkIcon className="w-4 h-4 text-sky-deep shrink-0" aria-label="This event has a website" />
                        ) : null}
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      {event.link ? (
                        <a
                          href={event.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full bg-sky-deep px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:brightness-110"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Details
                        </a>
                      ) : null}
                      <span className="rounded-full bg-surface-card px-3 py-1 text-xs text-ink-muted">By {event.ownerName}</span>
                      {editable ? (
                        <button
                          type="button"
                          onClick={() => startEditEvent(event)}
                          className="inline-flex items-center gap-2 rounded-full bg-field-green/10 px-3 py-1 text-xs font-semibold text-field-green hover:bg-field-green/20"
                        >
                          <Edit className="w-3.5 h-3.5" /> Edit
                        </button>
                      ) : null}
                      {editable ? (
                        <button
                          type="button"
                          onClick={() => deleteEvent(event.id)}
                          className="inline-flex items-center gap-2 rounded-full bg-flyday-nogo/10 px-3 py-1 text-xs font-semibold text-flyday-nogo hover:bg-flyday-nogo/20"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-sm text-ink-muted mt-1">{event.desc}</p>
                  <div className="flex flex-wrap gap-4 mt-3 text-sm text-ink-muted">
                    <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {event.time}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {event.location}</span>
                    <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {editable ? 'Editable by you' : 'Read-only'}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </PageShell>
  );
}
