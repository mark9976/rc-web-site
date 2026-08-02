'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { readError } from '@/lib/apiClient';

const SUBJECTS = ['General Inquiry', 'Membership Question', 'Flying Lessons', 'Event Information', 'Other'];

const emptyForm = { name: '', email: '', subject: SUBJECTS[0], message: '' };

export default function ContactForm() {
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const update = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError('Name, email, and message are required.');
      return;
    }

    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        throw new Error(await readError(res, 'Unable to send your message.'));
      }
      setForm(emptyForm);
      setStatus('sent');
    } catch (submitError) {
      setError(submitError.message);
      setStatus('idle');
    }
  };

  const inputClass =
    'w-full px-4 py-3 rounded-lg border border-black/10 bg-surface-card text-sm focus:outline-none focus:ring-2 focus:ring-field-green/30 focus:border-field-green';

  if (status === 'sent') {
    return (
      <div className="rounded-3xl bg-field-green/5 border border-field-green/20 p-6 text-center">
        <Send className="w-8 h-8 text-field-green mx-auto mb-3" />
        <p className="font-display font-bold text-lg">Message sent</p>
        <p className="text-sm text-ink-muted mt-1">
          Thanks — a club officer will see this in the admin inbox and get back to you.
        </p>
        <button type="button" onClick={() => setStatus('idle')} className="btn-secondary text-xs mt-4">
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="contact-name" className="block text-sm font-medium text-ink mb-1">Name</label>
        <input id="contact-name" type="text" value={form.name} onChange={update('name')} className={inputClass} placeholder="Your name" />
      </div>
      <div>
        <label htmlFor="contact-email" className="block text-sm font-medium text-ink mb-1">Email</label>
        <input id="contact-email" type="email" value={form.email} onChange={update('email')} className={inputClass} placeholder="your@email.com" />
      </div>
      <div>
        <label htmlFor="contact-subject" className="block text-sm font-medium text-ink mb-1">Subject</label>
        <select id="contact-subject" value={form.subject} onChange={update('subject')} className={inputClass}>
          {SUBJECTS.map((subject) => (
            <option key={subject}>{subject}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="contact-message" className="block text-sm font-medium text-ink mb-1">Message</label>
        <textarea
          id="contact-message"
          rows={5}
          value={form.message}
          onChange={update('message')}
          className={`${inputClass} resize-y`}
          placeholder="How can we help?"
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button type="submit" disabled={status === 'sending'} className="btn-primary w-full justify-center disabled:opacity-60">
        {status === 'sending' ? 'Sending...' : 'Send Message'}
      </button>
      <p className="text-xs text-ink-light text-center">
        Messages go to the club officers&apos; inbox on the admin dashboard.
      </p>
    </form>
  );
}
