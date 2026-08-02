'use client';

import { Inbox, Send, FileEdit, Trash2 } from 'lucide-react';

const FOLDERS = [
  { key: 'INBOX', label: 'Inbox', icon: Inbox },
  { key: 'Sent', label: 'Sent', icon: Send },
  { key: 'Drafts', label: 'Drafts', icon: FileEdit },
  { key: 'Trash', label: 'Trash', icon: Trash2 },
];

export default function FolderSidebar({ active, counts = {}, onSelect }) {
  return (
    <nav className="space-y-1">
      {FOLDERS.map(({ key, label, icon: Icon }) => {
        const count = counts[key];
        const unread = count?.unread || 0;
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition-colors ${
              isActive ? 'bg-field-green/10 text-field-green font-semibold' : 'text-ink-muted hover:bg-surface-muted'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left">{label}</span>
            {unread > 0 ? (
              <span className="rounded-full bg-field-green px-2 py-0.5 text-[10px] font-bold text-white">{unread}</span>
            ) : count?.total ? (
              <span className="text-xs text-ink-light">{count.total}</span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
