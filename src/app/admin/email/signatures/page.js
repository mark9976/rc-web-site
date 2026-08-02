'use client';

import { useCallback, useEffect, useState } from 'react';
import EmailShell from '../EmailShell';
import RichTextEditor from '@/components/email/RichTextEditor';
import { inputClass, apiJson } from '@/components/email/emailUi';
import { Plus, Trash2, Pencil } from 'lucide-react';

export default function SignaturesPage() {
  const [mailboxes, setMailboxes] = useState([]);
  const [signatures, setSignatures] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [mb, sig] = await Promise.all([apiJson('/api/email/mailboxes'), apiJson('/api/email/signatures')]);
      setMailboxes(mb.mailboxes || []);
      setSignatures(sig.signatures || []);
    } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const url = editing.id ? `/api/email/signatures/${editing.id}` : '/api/email/signatures';
      await apiJson(url, {
        method: editing.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      });
      setEditing(null);
      await load();
    } catch (e) { setError(e.message); }
  };

  const remove = async (signature) => {
    if (!window.confirm(`Delete the signature "${signature.name}"?`)) return;
    await apiJson(`/api/email/signatures/${signature.id}`, { method: 'DELETE' }).catch((e) => setError(e.message));
    await load();
  };

  const nameFor = (id) => mailboxes.find((m) => m.id === id)?.email_address || `Mailbox ${id}`;

  return (
    <EmailShell title="Signatures" subtitle="Sign-offs appended when composing">
      {error ? <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p> : null}

      {mailboxes.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-muted">Add a mailbox first — signatures belong to one.</div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-display font-bold text-xl">Saved signatures</h2>
            {!editing ? (
              <button onClick={() => setEditing({ mailbox_id: mailboxes[0].id, name: '', body_html: '', is_default: false })} className="btn-primary text-xs">
                <Plus className="w-4 h-4" /> New signature
              </button>
            ) : null}
          </div>

          {editing ? (
            <form onSubmit={save} className="card p-6 mb-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-ink">Mailbox</span>
                  <select value={editing.mailbox_id} onChange={(e) => setEditing({ ...editing, mailbox_id: Number(e.target.value) })} className={`mt-2 ${inputClass}`}>
                    {mailboxes.map((m) => <option key={m.id} value={m.id}>{m.email_address}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-ink">Name</span>
                  <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Standard sign-off" className={`mt-2 ${inputClass}`} />
                </label>
              </div>
              <div>
                <span className="text-sm font-medium text-ink">Signature</span>
                <div className="mt-2"><RichTextEditor value={editing.body_html} onChange={(html) => setEditing({ ...editing, body_html: html })} minHeight={160} /></div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={Boolean(editing.is_default)} onChange={(e) => setEditing({ ...editing, is_default: e.target.checked })} className="w-4 h-4 accent-field-green" />
                <span className="text-sm text-ink">Append automatically to new messages from this mailbox</span>
              </label>
              <div className="flex gap-3">
                <button type="submit" className="btn-primary text-sm">Save</button>
                <button type="button" onClick={() => setEditing(null)} className="btn-secondary text-sm">Cancel</button>
              </div>
            </form>
          ) : null}

          <div className="space-y-3">
            {signatures.length === 0 ? (
              <div className="rounded-3xl bg-surface-muted p-8 text-center text-sm text-ink-muted">No signatures yet.</div>
            ) : signatures.map((s) => (
              <div key={s.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-ink">
                      {s.name}
                      {s.is_default ? <span className="ml-2 rounded-full bg-field-green/10 px-2 py-0.5 text-[10px] font-semibold text-field-green">default</span> : null}
                    </p>
                    <p className="text-xs text-ink-muted">{nameFor(s.mailbox_id)}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setEditing(s)} className="btn-secondary text-xs"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                    <button onClick={() => remove(s)} className="inline-flex items-center gap-1 rounded-full bg-flyday-nogo/10 px-3 py-1 text-xs font-semibold text-flyday-nogo hover:bg-flyday-nogo/20">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 rounded-2xl bg-surface-card p-3 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: s.body_html }} />
              </div>
            ))}
          </div>
        </>
      )}
    </EmailShell>
  );
}
