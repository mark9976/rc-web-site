'use client';

import { useEffect, useState } from 'react';
import { GraduationCap, CheckCircle2 } from 'lucide-react';
import { readError } from '@/lib/apiClient';

const EXPERIENCE_LEVELS = [
  'Complete beginner',
  'Some simulator time',
  'Flown with help before',
  'Returning after a break',
];

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  instructorId: '',
  experience: EXPERIENCE_LEVELS[0],
  aircraft: '',
  availability: '',
  notes: '',
};

const inputClass =
  'mt-2 w-full rounded-3xl border border-black/10 bg-surface-card px-4 py-3 text-sm outline-none focus:border-field-green focus:ring-2 focus:ring-field-green/10';

export default function LessonRequestForm() {
  const [instructors, setInstructors] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/instructors', { cache: 'no-store' });
        if (!res.ok) throw new Error('unavailable');
        const data = await res.json();
        if (isMounted) setInstructors(data.instructors ?? []);
      } catch {
        if (isMounted) setInstructors([]);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const update = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      setError('Name, email, and phone are required so an instructor can reach you.');
      return;
    }

    setStatus('sending');
    try {
      const res = await fetch('/api/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await readError(res, 'Unable to send your request.'));
      setForm(emptyForm);
      setStatus('sent');
    } catch (submitError) {
      setError(submitError.message);
      setStatus('idle');
    }
  };

  if (status === 'sent') {
    return (
      <div className="rounded-3xl bg-field-green/5 border border-field-green/20 p-6 text-center">
        <CheckCircle2 className="w-8 h-8 text-field-green mx-auto mb-3" />
        <p className="font-display font-bold text-lg">Request received</p>
        <p className="text-sm text-ink-muted mt-1">
          An instructor will contact you to arrange a session. Lessons are free for club members.
        </p>
        <button type="button" onClick={() => setStatus('idle')} className="btn-secondary text-xs mt-4">
          Request another session
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-ink">Your name</span>
          <input value={form.name} onChange={update('name')} placeholder="Jane Doe" className={inputClass} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink">Phone</span>
          <input value={form.phone} onChange={update('phone')} placeholder="(555) 123-4567" className={inputClass} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink">Email</span>
          <input type="email" value={form.email} onChange={update('email')} placeholder="name@example.com" className={inputClass} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink">Preferred instructor</span>
          <select value={form.instructorId} onChange={update('instructorId')} className={inputClass}>
            <option value="">No preference — any instructor</option>
            {instructors.map((instructor) => (
              <option key={instructor.id} value={instructor.id}>
                {instructor.name}
              </option>
            ))}
          </select>
          {instructors.length === 0 ? (
            <span className="text-xs text-ink-light mt-1 block">
              No instructors are listed yet — your request still reaches the club.
            </span>
          ) : (
            <span className="text-xs text-ink-light mt-1 block">
              {instructors.find((i) => i.id === form.instructorId)?.instructorNote || 'Any of our instructors can help.'}
            </span>
          )}
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-ink">Experience level</span>
          <select value={form.experience} onChange={update('experience')} className={inputClass}>
            {EXPERIENCE_LEVELS.map((level) => (
              <option key={level}>{level}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink">Your aircraft (optional)</span>
          <input
            value={form.aircraft}
            onChange={update('aircraft')}
            placeholder="E-flite Apprentice, or none yet"
            className={inputClass}
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-ink">When are you usually available?</span>
        <input
          value={form.availability}
          onChange={update('availability')}
          placeholder="Weekend mornings, weekday evenings, etc."
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink">Anything else? (optional)</span>
        <textarea
          rows={3}
          value={form.notes}
          onChange={update('notes')}
          placeholder="Goals, questions, or anything the instructor should know."
          className={`${inputClass} resize-y`}
        />
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button type="submit" disabled={status === 'sending'} className="btn-primary w-full justify-center gap-2 disabled:opacity-60">
        <GraduationCap className="w-4 h-4" />
        {status === 'sending' ? 'Sending...' : 'Request a Lesson'}
      </button>
    </form>
  );
}
