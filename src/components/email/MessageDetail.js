'use client';

import { useEffect, useMemo, useState } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { ArrowLeft, Reply, ReplyAll, Forward, Trash2, Star, Mail } from 'lucide-react';
import AttachmentList from './AttachmentList';
import { formatFullDate, displayName, apiJson } from './emailUi';

/**
 * Renders an email body safely.
 *
 * Incoming HTML is attacker-controlled, so it is sanitized before it ever
 * reaches dangerouslySetInnerHTML. Remote images are stripped by default —
 * loading them silently reports back to the sender that the mail was opened.
 */
function SafeHtml({ html, allowImages }) {
  const clean = useMemo(() => {
    const sanitized = DOMPurify.sanitize(html || '', {
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'link', 'base'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'srcset', 'formaction'],
      ALLOW_DATA_ATTR: false,
    });
    if (allowImages) return sanitized;
    // Neutralise external image sources but keep the tag, so layout survives.
    return sanitized.replace(/<img\b[^>]*?\ssrc=["']https?:\/\/[^"']*["'][^>]*>/gi, '');
  }, [html, allowImages]);

  return (
    <div
      className="prose prose-sm max-w-none break-words [&_a]:text-field-green [&_img]:max-w-full"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

function SingleMessage({ message, allowImages }) {
  return (
    <article className="border-b border-black/10 pb-6 mb-6 last:border-0 last:mb-0 last:pb-0">
      <header className="mb-4">
        <p className="font-display font-semibold text-ink">
          {message.from_name || displayName(message.from_address)}
          <span className="ml-2 text-sm font-normal text-ink-muted">&lt;{message.from_address}&gt;</span>
        </p>
        <p className="text-xs text-ink-muted mt-1">
          To: {(message.to_addresses || []).join(', ') || '(nobody)'}
          {message.cc_addresses?.length ? ` · Cc: ${message.cc_addresses.join(', ')}` : ''}
        </p>
        <p className="text-xs text-ink-light mt-0.5">{formatFullDate(message.sent_at)}</p>
      </header>

      {message.body_html ? (
        <SafeHtml html={message.body_html} allowImages={allowImages} />
      ) : (
        <pre className="whitespace-pre-wrap font-body text-sm text-ink">{message.body_text || '(empty message)'}</pre>
      )}

      <AttachmentList messageId={message.id} attachments={message.attachments || []} />
    </article>
  );
}

export default function MessageDetail({ message, onBack, onReply, onForward, onDelete, onStar, onMarkUnread }) {
  const [thread, setThread] = useState([]);
  const [allowImages, setAllowImages] = useState(false);

  useEffect(() => {
    setAllowImages(false);
    if (!message?.thread_id) { setThread([]); return; }

    // Pull siblings so a conversation reads top to bottom.
    apiJson(`/api/email/messages/thread/${encodeURIComponent(message.thread_id)}`)
      .then((data) => setThread(data.messages || []))
      .catch(() => setThread([]));
  }, [message?.id, message?.thread_id]);

  if (!message) return null;

  const others = thread.filter((m) => m.id !== message.id);
  const hasRemoteImages = /<img[^>]+src=["']https?:/i.test(message.body_html || '');

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center gap-2 border-b border-black/10 px-4 py-3">
        <button onClick={onBack} className="btn-secondary text-xs"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>
        <button onClick={() => onReply(message, false)} className="btn-secondary text-xs"><Reply className="w-3.5 h-3.5" /> Reply</button>
        <button onClick={() => onReply(message, true)} className="btn-secondary text-xs"><ReplyAll className="w-3.5 h-3.5" /> Reply all</button>
        <button onClick={() => onForward(message)} className="btn-secondary text-xs"><Forward className="w-3.5 h-3.5" /> Forward</button>
        <span className="ml-auto flex gap-2">
          <button onClick={() => onStar(message)} className="btn-secondary text-xs">
            <Star className={`w-3.5 h-3.5 ${message.is_starred ? 'fill-flyday-maybe text-flyday-maybe' : ''}`} />
            {message.is_starred ? 'Unstar' : 'Star'}
          </button>
          <button onClick={() => onMarkUnread(message)} className="btn-secondary text-xs"><Mail className="w-3.5 h-3.5" /> Unread</button>
          <button onClick={() => onDelete(message)} className="inline-flex items-center gap-1 rounded-full bg-flyday-nogo/10 px-3 py-1 text-xs font-semibold text-flyday-nogo hover:bg-flyday-nogo/20">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </span>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <h2 className="font-display font-bold text-2xl mb-1">{message.subject || '(no subject)'}</h2>
        {others.length > 0 ? (
          <p className="text-xs text-ink-muted mb-4">{thread.length} messages in this conversation</p>
        ) : <div className="mb-4" />}

        {hasRemoteImages && !allowImages ? (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-flyday-maybe/30 bg-flyday-maybe/5 p-3 text-sm">
            <span className="text-ink-muted">Remote images are blocked so the sender can&apos;t tell you opened this.</span>
            <button onClick={() => setAllowImages(true)} className="btn-secondary text-xs">Show images</button>
          </div>
        ) : null}

        {/* Earlier messages in the thread, then this one last */}
        {others
          .filter((m) => new Date(m.sent_at) <= new Date(message.sent_at))
          .map((m) => <SingleMessage key={m.id} message={m} allowImages={allowImages} />)}

        <SingleMessage message={message} allowImages={allowImages} />

        {others
          .filter((m) => new Date(m.sent_at) > new Date(message.sent_at))
          .map((m) => <SingleMessage key={m.id} message={m} allowImages={allowImages} />)}
      </div>
    </div>
  );
}
