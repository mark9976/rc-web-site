'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Paperclip, X, Save } from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import ContactAutocomplete from './ContactAutocomplete';
import { inputClass, formatBytes, apiJson } from './emailUi';

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export default function ComposeForm({ mailboxes, mailboxId, draft, onSent, onCancel }) {
  const [fromId, setFromId] = useState(mailboxId ?? mailboxes[0]?.id);
  const [to, setTo] = useState(draft?.to ?? []);
  const [cc, setCc] = useState(draft?.cc ?? []);
  const [bcc, setBcc] = useState(draft?.bcc ?? []);
  const [showCc, setShowCc] = useState(Boolean(draft?.cc?.length || draft?.bcc?.length));
  const [subject, setSubject] = useState(draft?.subject ?? '');
  const [body, setBody] = useState(draft?.body_html ?? '');
  const [files, setFiles] = useState([]);
  const [signatures, setSignatures] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const signatureApplied = useRef(false);

  useEffect(() => {
    if (!fromId) return;
    apiJson(`/api/email/signatures?mailbox_id=${fromId}`)
      .then((data) => setSignatures(data.signatures || []))
      .catch(() => setSignatures([]));
  }, [fromId]);

  // Append the default signature once, and only to a fresh message — appending
  // to a reply that already quotes history would bury it.
  useEffect(() => {
    if (signatureApplied.current || signatures.length === 0) return;
    const def = signatures.find((s) => s.is_default);
    if (def && !draft?.body_html) {
      setBody((current) => `${current}<p><br></p>${def.body_html}`);
    }
    signatureApplied.current = true;
  }, [signatures, draft?.body_html]);

  const addFiles = (list) => {
    const next = [];
    for (const file of Array.from(list)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setError(`"${file.name}" is larger than the 10 MB limit.`);
        continue;
      }
      next.push(file);
    }
    if (next.length) setFiles((current) => [...current, ...next]);
  };

  const insertSignature = (id) => {
    const sig = signatures.find((s) => String(s.id) === String(id));
    if (sig) setBody((current) => `${current}<p><br></p>${sig.body_html}`);
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (to.length === 0) return setError('Add at least one recipient.');
    if (!subject.trim() && !window.confirm('Send without a subject?')) return;

    setStatus('sending');
    try {
      const form = new FormData();
      form.append('mailbox_id', fromId);
      form.append('to', to.join(','));
      form.append('cc', cc.join(','));
      form.append('bcc', bcc.join(','));
      form.append('subject', subject);
      form.append('body_html', body);
      if (draft?.in_reply_to) form.append('in_reply_to', draft.in_reply_to);
      if (draft?.parent_id) form.append('parent_id', draft.parent_id);
      files.forEach((file) => form.append('attachments', file));

      const res = await fetch('/api/email/send', { method: 'POST', body: form });
      if (!res.ok) {
        const text = await res.text();
        let message = text;
        try { message = JSON.parse(text).error; } catch { /* plain text */ }
        throw new Error(message || 'Send failed.');
      }

      // A send can succeed overall while the server still refuses some
      // recipients; say so rather than closing as if everything went out.
      const result = await res.json().catch(() => ({}));
      if (result.warning) {
        setError(result.warning);
        setStatus('idle');
        onSent?.();
        return;
      }

      setStatus('idle');
      onSent?.();
    } catch (sendError) {
      setError(sendError.message);
      setStatus('idle');
    }
  };

  const saveDraft = async () => {
    setError('');
    try {
      await apiJson('/api/email/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mailbox_id: fromId, to, cc, bcc, subject, body_html: body }),
      });
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (draftError) {
      setError(draftError.message);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-ink">From</span>
        <select value={fromId ?? ''} onChange={(e) => setFromId(Number(e.target.value))} className={`mt-2 ${inputClass}`}>
          {mailboxes.map((m) => (
            <option key={m.id} value={m.id}>{m.display_name} — {m.email_address}</option>
          ))}
        </select>
      </label>

      <ContactAutocomplete label="To" value={to} onChange={setTo} placeholder="Type a name or email address" />

      {showCc ? (
        <>
          <ContactAutocomplete label="Cc" value={cc} onChange={setCc} placeholder="Carbon copy" />
          <ContactAutocomplete label="Bcc" value={bcc} onChange={setBcc} placeholder="Blind carbon copy" />
        </>
      ) : (
        <button type="button" onClick={() => setShowCc(true)} className="text-xs font-semibold text-field-green">
          + Add Cc / Bcc
        </button>
      )}

      <label className="block">
        <span className="text-sm font-medium text-ink">Subject</span>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className={`mt-2 ${inputClass}`} />
      </label>

      <div>
        <span className="text-sm font-medium text-ink">Message</span>
        <div className="mt-2">
          <RichTextEditor value={body} onChange={setBody} minHeight={260} />
        </div>
      </div>

      {/* Attachments */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
        className="rounded-2xl border border-dashed border-black/10 bg-surface-card p-4"
      >
        <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary text-xs">
            <Paperclip className="w-3.5 h-3.5" /> Attach files
          </button>
          <span className="text-xs text-ink-muted">or drag them here — 10 MB per file</span>
        </div>
        {files.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="inline-flex items-center gap-2 rounded-full bg-surface-muted px-3 py-1 text-xs">
                <span className="truncate max-w-[14rem]">{file.name}</span>
                <span className="text-ink-light">{formatBytes(file.size)}</span>
                <button type="button" onClick={() => setFiles(files.filter((_, i) => i !== index))} aria-label={`Remove ${file.name}`}>
                  <X className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {signatures.length > 0 ? (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink-muted">Insert signature:</span>
          <select onChange={(e) => { insertSignature(e.target.value); e.target.value = ''; }} className="rounded-2xl border border-black/10 bg-surface-card px-3 py-1.5 text-sm">
            <option value="">Choose…</option>
            {signatures.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={status === 'sending'} className="btn-primary text-sm disabled:opacity-60">
          <Send className="w-4 h-4" /> {status === 'sending' ? 'Sending…' : 'Send'}
        </button>
        <button type="button" onClick={saveDraft} className="btn-secondary text-sm">
          <Save className="w-4 h-4" /> {status === 'saved' ? 'Saved' : 'Save draft'}
        </button>
        {onCancel ? <button type="button" onClick={onCancel} className="btn-secondary text-sm">Cancel</button> : null}
      </div>
    </form>
  );
}
