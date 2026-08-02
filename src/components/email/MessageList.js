'use client';

import { Paperclip, Star, Mail, MailOpen, Trash2 } from 'lucide-react';
import { formatEmailDate, displayName } from './emailUi';

export default function MessageList({
  messages,
  loading,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onOpen,
  onStar,
  onBulk,
  folder,
}) {
  const allSelected = messages.length > 0 && selectedIds.length === messages.length;

  if (loading) {
    return <div className="p-10 text-center text-sm text-ink-muted">Loading messages...</div>;
  }

  if (messages.length === 0) {
    return (
      <div className="p-12 text-center">
        <Mail className="w-10 h-10 text-field-green/30 mx-auto mb-3" />
        <p className="font-display font-bold text-lg">Nothing in {folder}</p>
        <p className="text-sm text-ink-muted mt-1">
          {folder === 'INBOX' ? 'New mail appears here after the next sync.' : 'This folder is empty.'}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Bulk action bar, only once something is ticked */}
      <div className="flex items-center gap-3 border-b border-black/10 px-4 py-2">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={(e) => onSelectAll(e.target.checked)}
          className="w-4 h-4 accent-field-green"
          aria-label="Select all messages"
        />
        {selectedIds.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-ink-muted">{selectedIds.length} selected</span>
            <button onClick={() => onBulk('read')} className="btn-secondary text-xs"><MailOpen className="w-3.5 h-3.5" /> Mark read</button>
            <button onClick={() => onBulk('unread')} className="btn-secondary text-xs"><Mail className="w-3.5 h-3.5" /> Mark unread</button>
            <button onClick={() => onBulk('delete')} className="inline-flex items-center gap-1 rounded-full bg-flyday-nogo/10 px-3 py-1 font-semibold text-flyday-nogo hover:bg-flyday-nogo/20">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        ) : (
          <span className="text-xs text-ink-light">{messages.length} message{messages.length === 1 ? '' : 's'}</span>
        )}
      </div>

      <ul className="divide-y divide-black/5">
        {messages.map((m) => {
          // In Sent/Drafts the useful name is the recipient, not ourselves.
          const counterpart =
            folder === 'Sent' || folder === 'Drafts'
              ? m.to_addresses?.[0] || '(no recipient)'
              : m.from_name || m.from_address;

          return (
            <li
              key={m.id}
              className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                m.is_read ? 'hover:bg-surface-muted' : 'bg-field-green/[0.04] hover:bg-field-green/[0.08]'
              }`}
              onClick={() => onOpen(m)}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(m.id)}
                onChange={() => onToggleSelect(m.id)}
                onClick={(e) => e.stopPropagation()}
                className="mt-1 w-4 h-4 accent-field-green shrink-0"
                aria-label={`Select ${m.subject}`}
              />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onStar(m); }}
                className="mt-0.5 shrink-0"
                aria-label={m.is_starred ? 'Unstar' : 'Star'}
              >
                <Star className={`w-4 h-4 ${m.is_starred ? 'fill-flyday-maybe text-flyday-maybe' : 'text-ink-light hover:text-flyday-maybe'}`} />
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className={`truncate ${m.is_read ? 'text-ink-muted' : 'font-semibold text-ink'}`}>
                    {displayName(counterpart)}
                  </span>
                  {m.has_attachments ? <Paperclip className="w-3.5 h-3.5 text-ink-light shrink-0" /> : null}
                  <span className="ml-auto shrink-0 text-xs text-ink-light">{formatEmailDate(m.sent_at)}</span>
                </div>
                <p className={`truncate text-sm ${m.is_read ? 'text-ink-muted' : 'font-medium text-ink'}`}>
                  {m.subject || '(no subject)'}
                </p>
                <p className="truncate text-xs text-ink-light">{m.snippet}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
