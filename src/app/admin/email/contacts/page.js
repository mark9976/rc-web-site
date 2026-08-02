'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import EmailShell from '../EmailShell';
import { inputClass, apiJson } from '@/components/email/emailUi';
import { Plus, Trash2, Pencil, Upload, Download, RefreshCw, Search } from 'lucide-react';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'internal', label: 'Club members' },
  { key: 'external', label: 'External' },
];

const emptyContact = { email: '', first_name: '', last_name: '', contact_type: 'external', tags: '', notes: '' };

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ type: tab });
      if (search.trim()) params.set('search', search.trim());
      const data = await apiJson(`/api/email/contacts?${params}`);
      setContacts(data.contacts || []);
      setError('');
    } catch (e) { setError(e.message); }
  }, [tab, search]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const save = async (event) => {
    event.preventDefault();
    setError('');
    const payload = {
      ...editing,
      tags: String(editing.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
    };
    try {
      if (editing.id) {
        await apiJson(`/api/email/contacts/${editing.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
      } else {
        await apiJson('/api/email/contacts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
      }
      setEditing(null);
      await load();
    } catch (e) { setError(e.message); }
  };

  const remove = async (contact) => {
    if (!window.confirm(`Delete ${contact.email}?`)) return;
    await apiJson(`/api/email/contacts/${contact.id}`, { method: 'DELETE' }).catch((e) => setError(e.message));
    await load();
  };

  const syncMembers = async () => {
    setMessage('');
    try {
      const result = await apiJson('/api/email/contacts/sync-members', { method: 'POST' });
      setMessage(`Synced ${result.total} club members — ${result.added} new, ${result.updated} updated.`);
      await load();
    } catch (e) { setError(e.message); }
  };

  const importCsv = async (file) => {
    if (!file) return;
    setMessage('');
    setError('');
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/email/contacts/import', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed.');
      setMessage(
        `Imported ${data.imported} contact${data.imported === 1 ? '' : 's'}` +
          (data.skippedCount ? `, skipped ${data.skippedCount} (${data.skipped.map((s) => `line ${s.line}: ${s.reason}`).slice(0, 3).join('; ')})` : '.')
      );
      await load();
    } catch (e) { setError(e.message); }
  };

  return (
    <EmailShell title="Contacts" subtitle="Everyone the club emails">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${tab === t.key ? 'bg-field-green text-white' : 'bg-surface-muted text-ink-muted hover:bg-surface-card'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[12rem]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-light" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email…" className={`${inputClass} pl-9`} />
        </div>
        <button onClick={() => setEditing({ ...emptyContact })} className="btn-primary text-xs"><Plus className="w-4 h-4" /> Add</button>
        <button onClick={syncMembers} className="btn-secondary text-xs"><RefreshCw className="w-3.5 h-3.5" /> Sync from members</button>
        <button onClick={() => fileRef.current?.click()} className="btn-secondary text-xs"><Upload className="w-3.5 h-3.5" /> Import CSV</button>
        <a href="/api/email/contacts/export" className="btn-secondary text-xs"><Download className="w-3.5 h-3.5" /> Export CSV</a>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { importCsv(e.target.files?.[0]); e.target.value = ''; }} />
      </div>

      {message ? <p className="mb-4 rounded-2xl border border-field-green/30 bg-field-green/5 p-3 text-sm text-field-green">{message}</p> : null}
      {error ? <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p> : null}

      {editing ? (
        <form onSubmit={save} className="card p-6 mb-6 space-y-4">
          <h3 className="font-display font-bold text-lg">{editing.id ? 'Edit contact' : 'New contact'}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-ink">Email</span>
              <input type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} className={`mt-2 ${inputClass}`} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Type</span>
              <select value={editing.contact_type} onChange={(e) => setEditing({ ...editing, contact_type: e.target.value })} className={`mt-2 ${inputClass}`}>
                <option value="external">External</option>
                <option value="internal">Club member</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">First name</span>
              <input value={editing.first_name || ''} onChange={(e) => setEditing({ ...editing, first_name: e.target.value })} className={`mt-2 ${inputClass}`} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Last name</span>
              <input value={editing.last_name || ''} onChange={(e) => setEditing({ ...editing, last_name: e.target.value })} className={`mt-2 ${inputClass}`} />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-ink">Tags</span>
              <input value={Array.isArray(editing.tags) ? editing.tags.join(', ') : editing.tags || ''} onChange={(e) => setEditing({ ...editing, tags: e.target.value })} placeholder="vendor, AMA, other club" className={`mt-2 ${inputClass}`} />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-ink">Notes</span>
              <textarea rows={2} value={editing.notes || ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} className={`mt-2 ${inputClass} resize-y`} />
            </label>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary text-sm">Save</button>
            <button type="button" onClick={() => setEditing(null)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </form>
      ) : null}

      <div className="card p-0 overflow-x-auto">
        {contacts.length === 0 ? (
          <p className="p-8 text-center text-sm text-ink-muted">No contacts yet. Add one, import a CSV, or sync from the club roster.</p>
        ) : (
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-ink-muted border-b border-black/10">
                <th className="py-3 px-4 font-display">Name</th>
                <th className="py-3 px-4 font-display">Email</th>
                <th className="py-3 px-4 font-display">Type</th>
                <th className="py-3 px-4 font-display">Tags</th>
                <th className="py-3 px-4 font-display">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-b border-black/5">
                  <td className="py-3 px-4 font-medium text-ink">{[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}</td>
                  <td className="py-3 px-4 text-ink-muted">{c.email}</td>
                  <td className="py-3 px-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.contact_type === 'internal' ? 'bg-sky/10 text-sky-deep' : 'bg-surface-muted text-ink-muted'}`}>
                      {c.contact_type === 'internal' ? 'member' : 'external'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-ink-light">{(c.tags || []).join(', ') || '—'}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button onClick={() => setEditing({ ...c, tags: (c.tags || []).join(', ') })} className="btn-secondary text-xs"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                      <button onClick={() => remove(c)} className="inline-flex items-center gap-1 rounded-full bg-flyday-nogo/10 px-3 py-1 text-xs font-semibold text-flyday-nogo hover:bg-flyday-nogo/20">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-3 text-xs text-ink-light">
        CSV import expects an <code>email</code> column; <code>first_name</code>, <code>last_name</code>, <code>tags</code>, and <code>notes</code> are optional.
      </p>
    </EmailShell>
  );
}
