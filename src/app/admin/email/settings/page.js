'use client';

import { useEffect, useState } from 'react';
import EmailShell from '../EmailShell';
import { inputClass, apiJson, formatFullDate } from '@/components/email/emailUi';
import { Plus, Trash2, Pencil, CheckCircle2, XCircle, AlertTriangle, Plug } from 'lucide-react';

// GoDaddy's standard settings, pre-filled to save typing.
const GODADDY = { imap_host: 'imap.secureserver.net', imap_port: 993, smtp_host: 'smtpout.secureserver.net', smtp_port: 465 };

const emptyForm = {
  email_address: '', display_name: '', username: '', password: '',
  ...GODADDY, is_default: false,
};

export default function EmailSettingsPage() {
  const [mailboxes, setMailboxes] = useState([]);
  const [encryptionOk, setEncryptionOk] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [testResults, setTestResults] = useState({});

  const load = async () => {
    try {
      const data = await apiJson('/api/email/mailboxes');
      setMailboxes(data.mailboxes || []);
      setEncryptionOk(data.encryptionConfigured !== false);
    } catch (e) { setError(e.message); }
  };

  useEffect(() => { load(); }, []);

  const startAdd = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); setError(''); setMessage(''); };

  const startEdit = (mailbox) => {
    // Password intentionally blank: leaving it empty keeps the stored one.
    setForm({ ...mailbox, password: '', is_default: Boolean(mailbox.is_default) });
    setEditingId(mailbox.id);
    setShowForm(true);
    setError('');
    setMessage('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (editingId) {
        await apiJson(`/api/email/mailboxes/${editingId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        });
        setMessage('Mailbox updated.');
      } else {
        const data = await apiJson('/api/email/mailboxes', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        });
        setMessage(`Connected. Server folders: ${(data.folders || []).slice(0, 6).join(', ')}`);
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const testMailbox = async (id) => {
    setTestResults((r) => ({ ...r, [id]: { testing: true } }));
    try {
      const result = await apiJson(`/api/email/mailboxes/${id}/test`, { method: 'POST' });
      setTestResults((r) => ({ ...r, [id]: result }));
    } catch (e) {
      setTestResults((r) => ({ ...r, [id]: { ok: false, imap: { ok: false, error: e.message } } }));
    }
  };

  const remove = async (mailbox) => {
    if (!window.confirm(`Remove ${mailbox.email_address}? Synced messages for this mailbox are deleted too.`)) return;
    await apiJson(`/api/email/mailboxes/${mailbox.id}`, { method: 'DELETE' }).catch((e) => setError(e.message));
    await load();
  };

  return (
    <EmailShell title="Email Settings" subtitle="Mailbox connections and sync status">
      {!encryptionOk ? (
        <p className="mb-6 flex items-start gap-2 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>
            <strong>EMAIL_ENCRYPTION_KEY is not set.</strong> Mailbox passwords cannot be stored safely until it is.
            Generate one with <code className="rounded bg-red-100 px-1">node -e &quot;console.log(require(&apos;crypto&apos;).randomBytes(32).toString(&apos;hex&apos;))&quot;</code>{' '}
            and add it to <code className="rounded bg-red-100 px-1">.env.local</code>, then restart the service.
          </span>
        </p>
      ) : null}

      {message ? <p className="mb-4 rounded-2xl border border-field-green/30 bg-field-green/5 p-3 text-sm text-field-green">{message}</p> : null}
      {error ? <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p> : null}

      <div className="flex justify-between items-center mb-4">
        <h2 className="font-display font-bold text-xl">Mailboxes</h2>
        {!showForm ? <button onClick={startAdd} className="btn-primary text-xs"><Plus className="w-4 h-4" /> Add mailbox</button> : null}
      </div>

      {showForm ? (
        <form onSubmit={submit} className="card p-6 mb-6 space-y-4">
          <h3 className="font-display font-bold text-lg">{editingId ? 'Edit mailbox' : 'New mailbox'}</h3>
          <p className="text-sm text-ink-muted">
            The connection is tested before it is saved, so a mailbox in the list is one that actually works.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-ink">Email address</span>
              <input type="email" value={form.email_address} onChange={(e) => setForm({ ...form, email_address: e.target.value })} placeholder="info@lhmac.org" className={`mt-2 ${inputClass}`} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Display name</span>
              <input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="LHMAC Info" className={`mt-2 ${inputClass}`} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Username</span>
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Usually the full email address" className={`mt-2 ${inputClass}`} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Password</span>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editingId ? 'Leave blank to keep the current password' : ''} className={`mt-2 ${inputClass}`} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">IMAP host</span>
              <input value={form.imap_host} onChange={(e) => setForm({ ...form, imap_host: e.target.value })} className={`mt-2 ${inputClass}`} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">IMAP port</span>
              <input type="number" value={form.imap_port} onChange={(e) => setForm({ ...form, imap_port: Number(e.target.value) })} className={`mt-2 ${inputClass}`} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">SMTP host</span>
              <input value={form.smtp_host} onChange={(e) => setForm({ ...form, smtp_host: e.target.value })} className={`mt-2 ${inputClass}`} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">SMTP port</span>
              <input type="number" value={form.smtp_port} onChange={(e) => setForm({ ...form, smtp_port: Number(e.target.value) })} className={`mt-2 ${inputClass}`} />
              <span className="text-xs text-ink-light mt-1 block">465 for SSL, 587 for STARTTLS.</span>
            </label>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} className="w-4 h-4 accent-field-green" />
            <span className="text-sm text-ink">Use as the default mailbox</span>
          </label>

          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className="btn-primary text-sm disabled:opacity-60">
              {busy ? 'Testing connection…' : editingId ? 'Save changes' : 'Test and add'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="btn-secondary text-sm">Cancel</button>
          </div>
        </form>
      ) : null}

      <div className="space-y-3">
        {mailboxes.length === 0 ? (
          <div className="rounded-3xl bg-surface-muted p-8 text-center text-sm text-ink-muted">
            No mailboxes yet. Add one to start syncing club email.
          </div>
        ) : (
          mailboxes.map((mailbox) => {
            const test = testResults[mailbox.id];
            return (
              <div key={mailbox.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-ink">
                      {mailbox.display_name}
                      {mailbox.is_default ? (
                        <span className="ml-2 rounded-full bg-field-green/10 px-2 py-0.5 text-[10px] font-semibold text-field-green">default</span>
                      ) : null}
                    </p>
                    <p className="text-sm text-ink-muted">{mailbox.email_address}</p>
                    <p className="text-xs text-ink-light mt-1">
                      IMAP {mailbox.imap_host}:{mailbox.imap_port} · SMTP {mailbox.smtp_host}:{mailbox.smtp_port}
                    </p>
                    <p className="text-xs text-ink-light mt-1">
                      {mailbox.last_sync_at ? `Last synced ${formatFullDate(mailbox.last_sync_at)}` : 'Never synced'}
                    </p>
                    {mailbox.last_sync_error ? (
                      <p className="text-xs text-flyday-nogo mt-1">Last error: {mailbox.last_sync_error}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button onClick={() => testMailbox(mailbox.id)} className="btn-secondary text-xs"><Plug className="w-3.5 h-3.5" /> Test</button>
                    <button onClick={() => startEdit(mailbox)} className="btn-secondary text-xs"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                    <button onClick={() => remove(mailbox)} className="inline-flex items-center gap-1 rounded-full bg-flyday-nogo/10 px-3 py-1 text-xs font-semibold text-flyday-nogo hover:bg-flyday-nogo/20">
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  </div>
                </div>

                {test ? (
                  <div className="mt-3 border-t border-black/10 pt-3 text-sm">
                    {test.testing ? (
                      <p className="text-ink-muted">Testing…</p>
                    ) : (
                      <div className="space-y-1">
                        <p className={`flex items-center gap-2 ${test.imap?.ok ? 'text-field-green' : 'text-flyday-nogo'}`}>
                          {test.imap?.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                          IMAP {test.imap?.ok ? 'connected' : `failed — ${test.imap?.error}`}
                        </p>
                        <p className={`flex items-center gap-2 ${test.smtp?.ok ? 'text-field-green' : 'text-flyday-nogo'}`}>
                          {test.smtp?.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                          SMTP {test.smtp?.ok ? 'connected' : `failed — ${test.smtp?.error}`}
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <p className="mt-6 text-xs text-ink-light">
        Mail syncs automatically every 3 minutes. Passwords are encrypted with AES-256-GCM before being written to the database.
      </p>
    </EmailShell>
  );
}
