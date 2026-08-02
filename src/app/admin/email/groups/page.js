'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import EmailShell from '../EmailShell';
import { inputClass, apiJson } from '@/components/email/emailUi';
import { Plus, Trash2, UserPlus, Megaphone, X } from 'lucide-react';

export default function GroupsPage() {
  const [groups, setGroups] = useState([]);
  const [openGroup, setOpenGroup] = useState(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: '', description: '' });
  const [contacts, setContacts] = useState([]);
  const [contactSearch, setContactSearch] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setGroups((await apiJson('/api/email/groups')).groups || []); setError(''); }
    catch (e) { setError(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!openGroup) return;
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ type: 'all' });
        if (contactSearch.trim()) params.set('search', contactSearch.trim());
        setContacts((await apiJson(`/api/email/contacts?${params}`)).contacts || []);
      } catch { setContacts([]); }
    }, 200);
    return () => clearTimeout(t);
  }, [openGroup, contactSearch]);

  const openDetail = async (id) => {
    try { setOpenGroup((await apiJson(`/api/email/groups/${id}`)).group); }
    catch (e) { setError(e.message); }
  };

  const createGroup = async (event) => {
    event.preventDefault();
    try {
      await apiJson('/api/email/groups', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft),
      });
      setDraft({ name: '', description: '' });
      setCreating(false);
      await load();
    } catch (e) { setError(e.message); }
  };

  const removeGroup = async (group) => {
    if (!window.confirm(`Delete the group "${group.name}"? Contacts themselves are not deleted.`)) return;
    await apiJson(`/api/email/groups/${group.id}`, { method: 'DELETE' }).catch((e) => setError(e.message));
    setOpenGroup(null);
    await load();
  };

  const addMember = async (contactId) => {
    await apiJson(`/api/email/groups/${openGroup.id}/members`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_ids: [contactId] }),
    }).catch((e) => setError(e.message));
    await openDetail(openGroup.id);
    await load();
  };

  const removeMember = async (contactId) => {
    await apiJson(`/api/email/groups/${openGroup.id}/members/${contactId}`, { method: 'DELETE' }).catch((e) => setError(e.message));
    await openDetail(openGroup.id);
    await load();
  };

  const memberIds = new Set((openGroup?.members || []).map((m) => m.id));

  return (
    <EmailShell title="Groups" subtitle="Mailing lists for blasts">
      {error ? <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p> : null}

      <div className="flex justify-between items-center mb-4">
        <h2 className="font-display font-bold text-xl">All groups</h2>
        {!creating ? <button onClick={() => setCreating(true)} className="btn-primary text-xs"><Plus className="w-4 h-4" /> New group</button> : null}
      </div>

      {creating ? (
        <form onSubmit={createGroup} className="card p-6 mb-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-ink">Name</span>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Officers" className={`mt-2 ${inputClass}`} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Description</span>
              <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={`mt-2 ${inputClass}`} />
            </label>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary text-sm">Create</button>
            <button type="button" onClick={() => setCreating(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <div className="space-y-3">
          {groups.length === 0 ? (
            <div className="rounded-3xl bg-surface-muted p-8 text-center text-sm text-ink-muted">No groups yet.</div>
          ) : groups.map((g) => (
            <div key={g.id} className={`card p-4 cursor-pointer ${openGroup?.id === g.id ? 'ring-2 ring-field-green/30' : ''}`} onClick={() => openDetail(g.id)}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display font-semibold text-ink">{g.name}</p>
                  {g.description ? <p className="text-sm text-ink-muted">{g.description}</p> : null}
                  <p className="text-xs text-ink-light mt-1">{g.member_count} member{g.member_count === 1 ? '' : 's'}</p>
                </div>
                <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Link href={`/admin/email/blasts/?group=${g.id}`} className="btn-secondary text-xs"><Megaphone className="w-3.5 h-3.5" /> Compose</Link>
                  <button onClick={() => removeGroup(g)} className="inline-flex items-center gap-1 rounded-full bg-flyday-nogo/10 px-3 py-1 text-xs font-semibold text-flyday-nogo hover:bg-flyday-nogo/20">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {openGroup ? (
          <div className="card p-5">
            <h3 className="font-display font-bold text-lg mb-1">{openGroup.name}</h3>
            <p className="text-xs text-ink-muted mb-4">{openGroup.members.length} member{openGroup.members.length === 1 ? '' : 's'}</p>

            <ul className="space-y-2 mb-5 max-h-64 overflow-auto">
              {openGroup.members.length === 0 ? (
                <li className="text-sm text-ink-muted">Nobody in this group yet.</li>
              ) : openGroup.members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-card px-3 py-2">
                  <span className="text-sm min-w-0 truncate">
                    <span className="font-medium text-ink">{[m.first_name, m.last_name].filter(Boolean).join(' ') || m.email}</span>
                    <span className="ml-2 text-ink-muted">{m.email}</span>
                  </span>
                  <button onClick={() => removeMember(m.id)} className="shrink-0 text-ink-light hover:text-flyday-nogo" aria-label={`Remove ${m.email}`}>
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="border-t border-black/10 pt-4">
              <p className="text-sm font-medium text-ink mb-2">Add contacts</p>
              <input value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} placeholder="Search contacts…" className={inputClass} />
              <ul className="mt-2 max-h-56 overflow-auto space-y-1">
                {contacts.filter((c) => !memberIds.has(c.id)).slice(0, 40).map((c) => (
                  <li key={c.id}>
                    <button onClick={() => addMember(c.id)} className="w-full flex items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm hover:bg-surface-muted">
                      <UserPlus className="w-3.5 h-3.5 text-field-green shrink-0" />
                      <span className="truncate">
                        <span className="font-medium text-ink">{[c.first_name, c.last_name].filter(Boolean).join(' ') || c.email}</span>
                        <span className="ml-2 text-ink-muted">{c.email}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="card p-8 text-center text-sm text-ink-muted">Pick a group to manage its members.</div>
        )}
      </div>
    </EmailShell>
  );
}
