'use client';

import { useCallback, useEffect, useState } from 'react';
import EmailShell from '../EmailShell';
import RichTextEditor from '@/components/email/RichTextEditor';
import { inputClass, apiJson } from '@/components/email/emailUi';
import { AVAILABLE_MERGE_FIELDS } from '@/lib/mergeFieldsClient';
import { Plus, Trash2, Pencil, Eye } from 'lucide-react';

const empty = { name: '', subject: '', body_html: '' };

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setTemplates((await apiJson('/api/email/templates')).templates || []); }
    catch (e) { setError(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const url = editing.id ? `/api/email/templates/${editing.id}` : '/api/email/templates';
      await apiJson(url, {
        method: editing.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      });
      setEditing(null);
      await load();
    } catch (e) { setError(e.message); }
  };

  const remove = async (template) => {
    if (!window.confirm(`Delete the template "${template.name}"?`)) return;
    await apiJson(`/api/email/templates/${template.id}`, { method: 'DELETE' }).catch((e) => setError(e.message));
    await load();
  };

  const runPreview = async (template) => {
    try {
      setPreview({ ...(await apiJson(`/api/email/templates/${template.id}/preview`, { method: 'POST' })), name: template.name });
    } catch (e) { setError(e.message); }
  };

  // Appends the token; TipTap has no stable cursor API from outside the editor.
  const insertField = (key) => setEditing((t) => ({ ...t, body_html: `${t.body_html || ''}<p>{{${key}}}</p>` }));

  return (
    <EmailShell title="Templates" subtitle="Reusable messages with merge fields">
      {error ? <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p> : null}

      <div className="flex justify-between items-center mb-4">
        <h2 className="font-display font-bold text-xl">Saved templates</h2>
        {!editing ? <button onClick={() => setEditing({ ...empty })} className="btn-primary text-xs"><Plus className="w-4 h-4" /> New template</button> : null}
      </div>

      {editing ? (
        <form onSubmit={save} className="card p-6 mb-6 space-y-4">
          <h3 className="font-display font-bold text-lg">{editing.id ? 'Edit template' : 'New template'}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-ink">Name</span>
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Meeting Reminder" className={`mt-2 ${inputClass}`} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Subject</span>
              <input value={editing.subject} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} placeholder="Reminder: club meeting {{first_name}}" className={`mt-2 ${inputClass}`} />
            </label>
          </div>

          <div>
            <span className="text-sm font-medium text-ink">Merge fields</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {AVAILABLE_MERGE_FIELDS.map((f) => (
                <button key={f.key} type="button" onClick={() => insertField(f.key)} className="rounded-full bg-sky/10 px-3 py-1 text-xs font-semibold text-sky-deep hover:bg-sky/20">
                  {'{{'}{f.key}{'}}'}
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-light mt-1">Click to append, or type the token anywhere in the subject or body.</p>
          </div>

          <div>
            <span className="text-sm font-medium text-ink">Body</span>
            <div className="mt-2"><RichTextEditor value={editing.body_html} onChange={(html) => setEditing({ ...editing, body_html: html })} /></div>
          </div>

          <div className="flex gap-3">
            <button type="submit" className="btn-primary text-sm">Save template</button>
            <button type="button" onClick={() => setEditing(null)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </form>
      ) : null}

      <div className="space-y-3">
        {templates.length === 0 ? (
          <div className="rounded-3xl bg-surface-muted p-8 text-center text-sm text-ink-muted">No templates yet.</div>
        ) : templates.map((t) => (
          <div key={t.id} className="card p-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display font-semibold text-ink">{t.name}</p>
              <p className="text-sm text-ink-muted truncate">{t.subject}</p>
              {t.merge_fields?.length ? (
                <p className="text-xs text-ink-light mt-1">Uses: {t.merge_fields.map((f) => `{{${f}}}`).join(', ')}</p>
              ) : null}
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => runPreview(t)} className="btn-secondary text-xs"><Eye className="w-3.5 h-3.5" /> Preview</button>
              <button onClick={() => setEditing(t)} className="btn-secondary text-xs"><Pencil className="w-3.5 h-3.5" /> Edit</button>
              <button onClick={() => remove(t)} className="inline-flex items-center gap-1 rounded-full bg-flyday-nogo/10 px-3 py-1 text-xs font-semibold text-flyday-nogo hover:bg-flyday-nogo/20">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-2xl max-h-full overflow-auto rounded-[32px] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-xl">Preview — {preview.name}</h3>
              <button onClick={() => setPreview(null)} className="text-xs uppercase tracking-[0.2em] text-ink-muted">Close</button>
            </div>
            <p className="text-sm text-ink-muted mb-1">Subject</p>
            <p className="font-medium text-ink mb-4">{preview.subject}</p>
            <p className="text-sm text-ink-muted mb-1">Body (rendered with sample data)</p>
            <div className="rounded-2xl border border-black/10 p-4 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: preview.body_html }} />
          </div>
        </div>
      ) : null}
    </EmailShell>
  );
}
