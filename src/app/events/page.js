'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { CalendarDays, MapPin, Clock, Users, Edit, Plus, ShieldCheck, User, Trash2 } from 'lucide-react';
import { formatDateDisplay, normalizeDateString } from '@/lib/dateUtils';
import { readError } from '@/lib/apiClient';

const guestUser = { id: 'guest', name: 'Visitor', role: 'guest' };

const typeColors = {
  Meeting: 'bg-field-green/10 text-field-green',
  Event: 'bg-sky/10 text-sky-deep',
  'Float Fly': 'bg-blue-100 text-blue-700',
  'Swap Meet': 'bg-flyday-maybe/10 text-flyday-maybe',
};

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
    startTime: '',
    endTime: '',
    time: '',
    location: '',
    type: 'Meeting',
    desc: '',
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
    return events.reduce((acc, event) => {
      const key = getDateKey(event.date);
      if (!key) return acc;
      acc[key] = acc[key] ? [...acc[key], event] : [event];
      return acc;
    }, {});
  }, [events]);

  const startNewEvent = () => {
    setDraft(createEmptyEvent(activeUser));
    setEditorOpen(true);
    setError('');
  };

  const startEditEvent = (event) => {
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
    const normalizedDraft = {
      ...draft,
      date: draft.date,
      startTime: draft.startTime,
      endTime: draft.endTime,
      time: timeString,
    };

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizedDraft),
      });
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
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 sm:px-6 bg-black/40">
          <div className="w-full max-w-3xl rounded-[32px] border border-black/10 bg-white p-6 shadow-2xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-display font-bold text-xl">{events.some((item) => item.id === draft.id) ? 'Edit Event' : 'New Event'}</h3>
              <p className="text-sm text-ink-muted">Your changes are saved to the club calendar database.</p>
            </div>
            <button type="button" onClick={() => setEditorOpen(false)} className="text-xs uppercase tracking-[0.2em] text-ink-muted">
              Cancel
            </button>
          </div>
          <div className="grid gap-4 mt-6 lg:grid-cols-2">
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
                <option>Meeting</option>
                <option>Event</option>
                <option>Float Fly</option>
                <option>Swap Meet</option>
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
          </div>
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              className="rounded-3xl border border-black/10 bg-surface-card px-5 py-3 text-sm font-medium text-ink transition hover:bg-surface-muted"
            >
              Cancel
            </button>
            <button type="button" onClick={saveEvent} className="btn-primary rounded-3xl px-5 py-3 text-sm font-medium">
              Save Event
            </button>
          </div>
        </div>
      </div>
      ) : null}

      <div className="space-y-4">
        {sortedEvents.map((event) => {
          const editable = canEditEvent(event, activeUser);
          return (
            <div key={event.id} className="card hover:shadow-md transition-shadow group">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="sm:w-32 shrink-0">
                  <p className="font-display font-bold text-lg text-ink">{formatDateDisplay(event.date)}</p>
                  <p className="text-xs text-ink-muted">{event.time}</p>
                </div>
                <div className="flex-1">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <span className={`inline-block text-xs font-display font-bold uppercase tracking-wider px-2 py-1 rounded mb-2 ${typeColors[event.type] || 'bg-surface-muted text-ink-muted'}`}>
                        {event.type}
                      </span>
                      <h3 className="font-display font-bold text-xl text-ink group-hover:text-field-green transition-colors">
                        {event.title}
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
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
