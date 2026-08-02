'use client';

import { Paperclip, Download } from 'lucide-react';
import { formatBytes } from './emailUi';

export default function AttachmentList({ messageId, attachments = [] }) {
  if (attachments.length === 0) return null;

  return (
    <div className="mt-4 border-t border-black/10 pt-3">
      <p className="flex items-center gap-2 text-xs font-display font-bold uppercase tracking-wider text-ink-muted">
        <Paperclip className="w-3.5 h-3.5" /> {attachments.length} attachment{attachments.length > 1 ? 's' : ''}
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {attachments.map((a) => (
          <li key={a.id}>
            <a
              href={`/api/email/messages/${messageId}/attachments/${a.id}`}
              className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-surface-card px-3 py-2 text-sm hover:bg-surface-muted"
            >
              <Download className="w-4 h-4 text-field-green shrink-0" />
              <span className="truncate max-w-[16rem]">{a.filename}</span>
              <span className="text-xs text-ink-light">{formatBytes(a.size)}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
