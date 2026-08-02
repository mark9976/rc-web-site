'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import EmailShell from '../EmailShell';
import RichTextEditor from '@/components/email/RichTextEditor';
import { inputClass, apiJson, formatFullDate } from '@/components/email/emailUi';
import { localInputToIso } from '@/lib/datetimeLocal';
import { Megaphone, AlertTriangle, RefreshCw } from 'lucide-react';

const STATUS_STYLES = {
  pending: 'bg-surface-muted text-ink-muted',
  sending: 'bg-sky/10 text-sky-deep',
  completed: 'bg-field-green/10 text-field-green',
  failed: 'bg-flyday-nogo/10 text-flyday-nogo',
};

function BlastsPageInner() {
  const searchParams = useSearchParams();
  const [mailboxes, setMailboxes] = useState([]);
  const [groups, setGroups] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [blasts, setBlasts] = useState([]);
  const [openBlast, setOpenBlast] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const [draft, setDraft] = useState({
    mailbox_id: null,
    recipient_type: 'group',
    group_id: searchParams.get('group') ? Number(searchParams.get('group')) : null,
    subject: '',
    body_html: '',
    scheduled_for: '',
  });

  const loadBlasts = useCallback(async () => {
    try { setBlasts((await apiJson('/api/email/blasts')).blasts || []); }
    catch (e) { setError(e.message); }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [mb, gr, tp] = await Promise.all([
          apiJson('/api/email/mailboxes'),
          apiJson('/api/email/groups'),
          apiJson('/api/email/templates'),
        ]);
        setMailboxes(mb.mailboxes || []);
        setGroups(gr.groups || []);
        setTemplates(tp.templates || []);
        const preferred = mb.mailboxes?.find((m) => m.is_default) ?? mb.mailboxes?.[0];
        setDraft((d) => ({
          ...d,
          mailbox_id: preferred?.id ?? null,
          group_id: d.group_id ?? gr.groups?.[0]?.id ?? null,
        }));
      } catch (e) { setError(e.message); }
    })();
    loadBlasts();
  }, [loadBlasts]);

  // While something is in flight, refresh so the progress bar actually moves.
  useEffect(() => {
    if (!blasts.some((b) => b.status === 'sending')) return undefined;
    const timer = setInterval(loadBlasts, 5000);
    return () => clearInterval(timer);
  }, [blasts, loadBlasts]);

  const selectedGroup = groups.find((g) => g.id === Number(draft.group_id));
  const recipientCount = draft.recipient_type === 'group' ? selectedGroup?.member_count ?? 0 : 0;
  const fromAddress = mailboxes.find((m) => m.id === Number(draft.mailbox_id))?.email_address;

  const applyTemplate = (id) => {
    const template = templates.find((t) => String(t.id) === String(id));
    if (template) setDraft((d) => ({ ...d, subject: template.subject, body_html: template.body_html }));
  };

  const openConfirm = (event) => {
    event.preventDefault();
    setError('');
    if (!draft.mailbox_id) return setError('Choose a mailbox to send from.');
    if (!draft.subject.trim()) return setError('Give the blast a subject.');
    if (!draft.body_html.trim()) return setError('The message body is empty.');
    if (draft.recipient_type === 'group' && !draft.group_id) return setError('Choose a group.');
    if (recipientCount === 0) return setError('That group has no members.');
    setConfirm(true);
  };

  const send = async () => {
    setSending(true);
    setError('');
    setMessage('');
    try {
      const payload = { ...draft, scheduled_for: draft.scheduled_for ? localInputToIso(draft.scheduled_for) : null };
      const result = await apiJson('/api/email/blasts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      setMessage(
        result.scheduled
          ? `Scheduled for ${formatFullDate(payload.scheduled_for)} — ${result.total_recipients} recipients.`
          : `Sending to ${result.total_recipients} recipients. Progress updates below.`
      );
      setConfirm(null);
      setDraft((d) => ({ ...d, subject: '', body_html: '', scheduled_for: '' }));
      await loadBlasts();
    } catch (e) {
      setError(e.message);
      setConfirm(null);
    } finally {
      setSending(false);
    }
  };

  return (
    <EmailShell title="Blasts" subtitle="Send to a group, track delivery">
      {message ? <p className="mb-4 rounded-2xl border border-field-green/30 bg-field-green/5 p-3 text-sm text-field-green">{message}</p> : null}
      {error ? <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p> : null}

      <form onSubmit={openConfirm} className="card p-6 mb-8 space-y-4">
        <h2 className="font-display font-bold text-xl flex items-center gap-2"><Megaphone className="w-5 h-5 text-field-green" /> New blast</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-ink">From</span>
            <select value={draft.mailbox_id ?? ''} onChange={(e) => setDraft({ ...draft, mailbox_id: Number(e.target.value) })} className={`mt-2 ${inputClass}`}>
              {mailboxes.map((m) => <option key={m.id} value={m.id}>{m.display_name} — {m.email_address}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">Send to group</span>
            <select value={draft.group_id ?? ''} onChange={(e) => setDraft({ ...draft, group_id: Number(e.target.value), recipient_type: 'group' })} className={`mt-2 ${inputClass}`}>
              <option value="">Choose a group…</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.member_count})</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">Start from a template</span>
            <select onChange={(e) => { applyTemplate(e.target.value); e.target.value = ''; }} className={`mt-2 ${inputClass}`}>
              <option value="">None</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">Schedule (optional)</span>
            <input type="datetime-local" value={draft.scheduled_for} onChange={(e) => setDraft({ ...draft, scheduled_for: e.target.value })} className={`mt-2 ${inputClass}`} />
            <span className="text-xs text-ink-light mt-1 block">Leave empty to send now.</span>
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-ink">Subject</span>
          <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} className={`mt-2 ${inputClass}`} />
        </label>

        <div>
          <span className="text-sm font-medium text-ink">Message</span>
          <div className="mt-2"><RichTextEditor value={draft.body_html} onChange={(html) => setDraft({ ...draft, body_html: html })} /></div>
          <p className="text-xs text-ink-light mt-1">
            Merge fields like <code>{'{{first_name}}'}</code> are filled in per recipient. Each person gets their own copy — nobody sees the list.
          </p>
        </div>

        <button type="submit" className="btn-primary text-sm">
          <Megaphone className="w-4 h-4" /> {draft.scheduled_for ? 'Schedule blast' : 'Review and send'}
        </button>
      </form>

      <h2 className="font-display font-bold text-xl mb-4">Blast history</h2>
      <div className="space-y-3">
        {blasts.length === 0 ? (
          <div className="rounded-3xl bg-surface-muted p-8 text-center text-sm text-ink-muted">Nothing sent yet.</div>
        ) : blasts.map((b) => {
          const done = (b.sent_count || 0) + (b.failed_count || 0);
          const pct = b.total_recipients ? Math.round((done / b.total_recipients) * 100) : 0;
          return (
            <div key={b.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display font-semibold text-ink">
                    {b.subject}
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_STYLES[b.status] || ''}`}>{b.status}</span>
                  </p>
                  <p className="text-xs text-ink-muted mt-1">
                    From {b.mailbox_address} · {b.group_name ? `Group: ${b.group_name}` : 'Custom list'} · {b.total_recipients} recipients
                  </p>
                  <p className="text-xs text-ink-light mt-0.5">
                    {b.scheduled_for && b.status === 'pending' ? `Scheduled for ${formatFullDate(b.scheduled_for)}` : formatFullDate(b.created_at)}
                  </p>
                </div>
                <button onClick={async () => setOpenBlast((await apiJson(`/api/email/blasts/${b.id}`)).blast)} className="btn-secondary text-xs shrink-0">
                  Details
                </button>
              </div>

              {b.status !== 'pending' ? (
                <div className="mt-3">
                  <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
                    <div className="h-full bg-field-green transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-ink-muted mt-1">
                    {b.sent_count || 0} sent
                    {b.failed_count ? <span className="text-flyday-nogo"> · {b.failed_count} failed</span> : null}
                    {' '}of {b.total_recipients}
                    {b.status === 'sending' ? <RefreshCw className="inline w-3 h-3 ml-1 animate-spin" /> : null}
                  </p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Confirmation — the count and the from-address, before anything goes out */}
      {confirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-[32px] bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-flyday-maybe shrink-0 mt-0.5" />
              <div>
                <h3 className="font-display font-bold text-xl">Confirm blast</h3>
                <p className="text-sm text-ink-muted mt-2">
                  This will send <strong>{recipientCount} email{recipientCount === 1 ? '' : 's'}</strong> from{' '}
                  <strong>{fromAddress}</strong>
                  {draft.scheduled_for ? <> starting <strong>{formatFullDate(localInputToIso(draft.scheduled_for))}</strong></> : ' now'}.
                </p>
                <p className="text-xs text-ink-light mt-2">
                  Sent in batches to stay inside the provider&apos;s rate limit, so a large list takes a while to finish.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirm(null)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={send} disabled={sending} className="btn-primary text-sm disabled:opacity-60">
                {sending ? 'Queueing…' : draft.scheduled_for ? 'Schedule it' : `Send ${recipientCount}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {openBlast ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-2xl max-h-full overflow-auto rounded-[32px] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-xl">{openBlast.subject}</h3>
              <button onClick={() => setOpenBlast(null)} className="text-xs uppercase tracking-[0.2em] text-ink-muted">Close</button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-ink-muted border-b border-black/10">
                  <th className="py-2 font-display">Recipient</th>
                  <th className="py-2 font-display">Status</th>
                  <th className="py-2 font-display">Detail</th>
                </tr>
              </thead>
              <tbody>
                {openBlast.recipients.map((r) => (
                  <tr key={r.id} className="border-b border-black/5">
                    <td className="py-2 pr-3 text-ink-muted">{r.email}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[r.status === 'sent' ? 'completed' : r.status] || ''}`}>{r.status}</span>
                    </td>
                    <td className="py-2 text-xs text-flyday-nogo">{r.error_message || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </EmailShell>
  );
}

export default function BlastsPage() {
  return (
    <Suspense fallback={<EmailShell title="Blasts" subtitle="Send to a group, track delivery"><p className="text-sm text-ink-muted">Loading…</p></EmailShell>}>
      <BlastsPageInner />
    </Suspense>
  );
}
