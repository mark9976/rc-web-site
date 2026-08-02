'use client';

import { Mailbox } from 'lucide-react';

export default function MailboxSelector({ mailboxes, value, onChange }) {
  if (mailboxes.length === 0) return null;

  return (
    <label className="flex items-center gap-2">
      <Mailbox className="w-4 h-4 text-field-green shrink-0" />
      <select
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-2xl border border-black/10 bg-surface-card px-3 py-2 text-sm outline-none focus:border-field-green max-w-[16rem]"
      >
        {mailboxes.map((m) => (
          <option key={m.id} value={m.id}>
            {m.display_name} — {m.email_address}
          </option>
        ))}
      </select>
    </label>
  );
}
