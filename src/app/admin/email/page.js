'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import EmailShell from './EmailShell';
import MailboxSelector from '@/components/email/MailboxSelector';
import FolderSidebar from '@/components/email/FolderSidebar';
import MessageList from '@/components/email/MessageList';
import MessageDetail from '@/components/email/MessageDetail';
import ComposeForm from '@/components/email/ComposeForm';
import { apiJson, formatEmailDate } from '@/components/email/emailUi';
import { PenSquare, RefreshCw, Search, Settings, AlertCircle } from 'lucide-react';

/** Builds the quoted body used by Reply and Forward. */
function quoteOriginal(message, { forward }) {
  const header = forward
    ? `---------- Forwarded message ----------<br>From: ${message.from_name || ''} &lt;${message.from_address}&gt;<br>Date: ${new Date(message.sent_at).toLocaleString()}<br>Subject: ${message.subject}<br>To: ${(message.to_addresses || []).join(', ')}`
    : `On ${new Date(message.sent_at).toLocaleString()}, ${message.from_name || message.from_address} wrote:`;

  const body = message.body_html || `<pre>${(message.body_text || '').replace(/</g, '&lt;')}</pre>`;
  return `<p><br></p><p>${header}</p><blockquote>${body}</blockquote>`;
}

export default function EmailClientPage() {
  const [mailboxes, setMailboxes] = useState([]);
  const [mailboxId, setMailboxId] = useState(null);
  const [folder, setFolder] = useState('INBOX');
  const [messages, setMessages] = useState([]);
  const [counts, setCounts] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [openMessage, setOpenMessage] = useState(null);
  const [composing, setComposing] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [syncStatus, setSyncStatus] = useState(null);

  /* ---- load mailboxes once ---- */
  useEffect(() => {
    apiJson('/api/email/mailboxes')
      .then((data) => {
        setMailboxes(data.mailboxes || []);
        const preferred = data.mailboxes?.find((m) => m.is_default) ?? data.mailboxes?.[0];
        setMailboxId(preferred?.id ?? null);
        if (!preferred) setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  const loadMessages = useCallback(async () => {
    if (!mailboxId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ mailbox_id: mailboxId, folder, page: String(page), limit: '50' });
      if (search.trim()) params.set('search', search.trim());
      const data = await apiJson(`/api/email/messages?${params}`);
      setMessages(data.messages || []);
      setCounts(data.counts || {});
      setTotal(data.total || 0);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [mailboxId, folder, page, search]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    if (!mailboxId) return;
    apiJson('/api/email/sync/status')
      .then((d) => setSyncStatus(d.mailboxes?.find((m) => m.id === mailboxId) ?? null))
      .catch(() => setSyncStatus(null));
  }, [mailboxId, loading]);

  /* ---- actions ---- */
  const openMessageById = async (summary) => {
    try {
      const data = await apiJson(`/api/email/messages/${summary.id}`);
      setOpenMessage(data.message);
      // Opening marks it read, the same as any mail client.
      if (!summary.is_read) {
        await apiJson(`/api/email/messages/${summary.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_read: true }),
        });
        loadMessages();
      }
    } catch (e) { setError(e.message); }
  };

  const toggleStar = async (message) => {
    await apiJson(`/api/email/messages/${message.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_starred: !message.is_starred }),
    }).catch((e) => setError(e.message));
    setOpenMessage((m) => (m && m.id === message.id ? { ...m, is_starred: !m.is_starred } : m));
    loadMessages();
  };

  const markUnread = async (message) => {
    await apiJson(`/api/email/messages/${message.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_read: false }),
    }).catch((e) => setError(e.message));
    setOpenMessage(null);
    loadMessages();
  };

  const removeMessage = async (message) => {
    const permanent = folder === 'Trash';
    if (permanent && !window.confirm('Delete this message permanently?')) return;
    await apiJson(`/api/email/messages/${message.id}`, { method: 'DELETE' }).catch((e) => setError(e.message));
    setOpenMessage(null);
    loadMessages();
  };

  const runBulk = async (action) => {
    if (action === 'delete' && folder === 'Trash' && !window.confirm(`Permanently delete ${selectedIds.length} message(s)?`)) return;
    for (const id of selectedIds) {
      if (action === 'delete') {
        await apiJson(`/api/email/messages/${id}`, { method: 'DELETE' }).catch(() => {});
      } else {
        await apiJson(`/api/email/messages/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_read: action === 'read' }),
        }).catch(() => {});
      }
    }
    setSelectedIds([]);
    loadMessages();
  };

  const runSync = async () => {
    if (!mailboxId) return;
    setSyncing(true);
    setError('');
    try {
      const result = await apiJson(`/api/email/sync/${mailboxId}`, { method: 'POST' });
      if (result.error) setError(result.error);
      await loadMessages();
    } catch (e) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  };

  const startReply = (message, replyAll) => {
    const to = [message.from_address];
    const cc = replyAll
      ? [...(message.to_addresses || []), ...(message.cc_addresses || [])]
          .map((a) => (/<(.+)>/.exec(a)?.[1] || a).trim().toLowerCase())
          .filter((a) => a && a !== message.from_address.toLowerCase())
      : [];

    setComposing({
      to,
      cc: [...new Set(cc)],
      subject: /^re:/i.test(message.subject || '') ? message.subject : `Re: ${message.subject || ''}`,
      body_html: quoteOriginal(message, { forward: false }),
      in_reply_to: message.message_id,
      parent_id: message.id,
    });
    setOpenMessage(null);
  };

  const startForward = (message) => {
    setComposing({
      to: [],
      subject: /^fwd:/i.test(message.subject || '') ? message.subject : `Fwd: ${message.subject || ''}`,
      body_html: quoteOriginal(message, { forward: true }),
    });
    setOpenMessage(null);
  };

  /* ---- render ---- */
  if (mailboxes.length === 0 && !loading) {
    return (
      <EmailShell title="Admin Email" subtitle="Club mailboxes">
        <div className="card p-10 text-center">
          <Settings className="w-10 h-10 text-field-green/40 mx-auto mb-3" />
          <h2 className="font-display font-bold text-xl">No mailbox configured yet</h2>
          <p className="text-sm text-ink-muted mt-2 mb-6 max-w-md mx-auto">
            Add your first club email account and the inbox will start filling in on the next sync.
          </p>
          <Link href="/admin/email/settings/" className="btn-primary text-sm">Set up a mailbox</Link>
        </div>
      </EmailShell>
    );
  }

  return (
    <EmailShell title="Admin Email" subtitle="Read and send club mail">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <MailboxSelector
          mailboxes={mailboxes}
          value={mailboxId}
          onChange={(id) => { setMailboxId(id); setPage(1); setOpenMessage(null); setComposing(null); }}
        />
        <button onClick={() => { setComposing({}); setOpenMessage(null); }} className="btn-primary text-xs">
          <PenSquare className="w-4 h-4" /> Compose
        </button>
        <div className="relative flex-1 min-w-[14rem]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-light" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search subject, sender, or preview…"
            className="w-full rounded-2xl border border-black/10 bg-surface-card pl-9 pr-4 py-2 text-sm outline-none focus:border-field-green"
          />
        </div>
        <button onClick={runSync} disabled={syncing} className="btn-secondary text-xs disabled:opacity-60">
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} /> {syncing ? 'Syncing…' : 'Sync now'}
        </button>
        {syncStatus?.last_sync_at ? (
          <span className="text-xs text-ink-light">Last synced {formatEmailDate(syncStatus.last_sync_at)}</span>
        ) : null}
      </div>

      {syncStatus?.last_sync_error ? (
        <p className="mb-4 flex items-start gap-2 rounded-2xl border border-flyday-maybe/30 bg-flyday-maybe/5 p-3 text-sm text-flyday-maybe">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Last sync failed: {syncStatus.last_sync_error}</span>
        </p>
      ) : null}
      {error ? <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[13rem_1fr] items-start">
        <aside className="card p-3">
          <FolderSidebar
            active={folder}
            counts={counts}
            onSelect={(next) => { setFolder(next); setPage(1); setOpenMessage(null); setSelectedIds([]); }}
          />
        </aside>

        <section className="card p-0 overflow-hidden min-h-[28rem]">
          {composing ? (
            <div className="p-6">
              <h2 className="font-display font-bold text-xl mb-4">New message</h2>
              <ComposeForm
                mailboxes={mailboxes}
                mailboxId={mailboxId}
                draft={composing}
                onSent={() => { setComposing(null); setFolder('Sent'); loadMessages(); }}
                onCancel={() => setComposing(null)}
              />
            </div>
          ) : openMessage ? (
            <MessageDetail
              message={openMessage}
              onBack={() => setOpenMessage(null)}
              onReply={startReply}
              onForward={startForward}
              onDelete={removeMessage}
              onStar={toggleStar}
              onMarkUnread={markUnread}
            />
          ) : (
            <>
              <MessageList
                messages={messages}
                loading={loading}
                folder={folder}
                selectedIds={selectedIds}
                onToggleSelect={(id) => setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
                onSelectAll={(checked) => setSelectedIds(checked ? messages.map((m) => m.id) : [])}
                onOpen={openMessageById}
                onStar={toggleStar}
                onBulk={runBulk}
              />
              {total > 50 ? (
                <div className="flex items-center justify-between border-t border-black/10 px-4 py-3 text-sm">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs disabled:opacity-40">
                    Previous
                  </button>
                  <span className="text-ink-muted">Page {page} of {Math.ceil(total / 50)}</span>
                  <button onClick={() => setPage((p) => p + 1)} disabled={page * 50 >= total} className="btn-secondary text-xs disabled:opacity-40">
                    Next
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </EmailShell>
  );
}
