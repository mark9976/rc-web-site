'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminShell from '@/components/admin/AdminShell';
import { useAuth } from '@/components/AuthProvider';
import { readError } from '@/lib/apiClient';
import { Mail, Check, Trash2 } from 'lucide-react';

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
  const [messages, setMessages] = useState([]);

  const refreshAdminData = useCallback(async () => {
    const res = await fetch('/api/contact', { cache: 'no-store' });
    if (res.ok) setMessages((await res.json()).messages ?? []);
  }, []);

  useEffect(() => {
    if (auth.isAdmin) refreshAdminData();
  }, [auth.isAdmin, refreshAdminData]);

  const handleMessageAction = async (id, method) => {
    await fetch('/api/contact', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await refreshAdminData();
  };

  return (
    <AdminShell title="Inbox" subtitle="Messages from the contact form">
      <>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-xl flex items-center gap-2">
              <Mail className="w-5 h-5 text-sky-deep" />
              Inbox
            </h2>
            <span className="text-xs font-display font-bold bg-sky/10 text-sky-deep px-2 py-1 rounded-full shrink-0">
              {messages.filter((m) => m.status === 'unread').length} unread
            </span>
          </div>

          <div className="space-y-3">
            {messages.length === 0 ? (
              <div className="rounded-3xl bg-surface-muted p-6 text-center text-sm text-ink-muted">
                No messages from the contact form yet.
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-3xl border p-4 ${message.status === 'unread' ? 'border-sky/30 bg-sky/5' : 'border-black/10 bg-surface-card'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-ink truncate">{message.subject}</p>
                      <p className="text-xs text-ink-muted truncate">
                        {message.name} · <a href={`mailto:${message.email}`} className="text-field-green">{message.email}</a>
                      </p>
                    </div>
                    <span className="text-xs text-ink-light shrink-0">{formatTimestamp(message.submittedAt)}</span>
                  </div>
                  <p className="mt-3 text-sm text-ink-muted whitespace-pre-wrap">{message.message}</p>
                  <div className="mt-3 flex gap-2">
                    {message.status === 'unread' ? (
                      <button onClick={() => handleMessageAction(message.id, 'PATCH')} className="btn-secondary text-xs">
                        Mark read
                      </button>
                    ) : null}
                    <a href={`mailto:${message.email}?subject=Re: ${encodeURIComponent(message.subject)}`} className="btn-secondary text-xs">
                      Reply
                    </a>
                    <button
                      onClick={() => handleMessageAction(message.id, 'DELETE')}
                      className="inline-flex items-center gap-1 rounded-full bg-flyday-nogo/10 px-3 py-1 text-xs font-semibold text-flyday-nogo hover:bg-flyday-nogo/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </>
    </AdminShell>
  );
}
