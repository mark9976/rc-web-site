import { simpleParser } from 'mailparser';
import { withImap, resolveFolders } from '@/lib/email/imapClient';
import { computeThreadId, parseReferences } from '@/lib/email/threadUtils';
import {
  listMailboxes,
  getMailboxCredentials,
  insertMessage,
  highestUid,
  recordSyncResult,
} from '@/lib/email/emailStore';

const INITIAL_SYNC_DAYS = 90;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const SNIPPET_LENGTH = 200;

// One sync per mailbox at a time. A slow IMAP fetch can outlast the cron
// interval, and two overlapping syncs would fight over the same UIDs.
const inFlight = new Set();

function addressList(value) {
  if (!value?.value) return [];
  return value.value.filter((a) => a.address).map((a) => (a.name ? `${a.name} <${a.address}>` : a.address));
}

function makeSnippet(text, html) {
  const source =
    text ||
    String(html || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ');
  return source.replace(/\s+/g, ' ').trim().slice(0, SNIPPET_LENGTH);
}

/** Turns a parsed message into our row shape. */
function toRow(parsed, { mailboxId, folder, uid, seen }) {
  const references = parseReferences(parsed.references);
  const messageId = parsed.messageId || `<generated-${uid}-${folder}@lhmac.local>`;
  const from = parsed.from?.value?.[0] ?? {};

  return {
    mailbox_id: mailboxId,
    message_id: messageId,
    uid,
    folder,
    from_address: from.address || 'unknown@unknown',
    from_name: from.name || null,
    to_addresses: addressList(parsed.to),
    cc_addresses: addressList(parsed.cc),
    bcc_addresses: addressList(parsed.bcc),
    subject: parsed.subject || '(no subject)',
    body_text: parsed.text || null,
    body_html: parsed.html || null,
    snippet: makeSnippet(parsed.text, parsed.html),
    // Sent mail is never "unread" to us, and the IMAP \Seen flag drives the rest.
    is_read: folder === 'Sent' ? true : Boolean(seen),
    is_starred: false,
    is_draft: folder === 'Drafts',
    in_reply_to: parsed.inReplyTo || null,
    references_header: references,
    thread_id: computeThreadId({
      messageId,
      inReplyTo: parsed.inReplyTo,
      references,
      subject: parsed.subject,
    }),
    sent_at: (parsed.date || new Date()).toISOString(),
  };
}

function toAttachments(parsed) {
  return (parsed.attachments || [])
    .filter((a) => a.content && a.size <= MAX_ATTACHMENT_BYTES)
    .map((a) => ({
      filename: a.filename || 'attachment',
      contentType: a.contentType || 'application/octet-stream',
      size: a.size ?? a.content.length,
      content: a.content,
      contentId: a.cid || null,
    }));
}

async function syncFolder(client, { mailboxId, remotePath, localFolder }) {
  const lock = await client.getMailboxLock(remotePath);
  let stored = 0;

  try {
    const lastUid = highestUid(mailboxId, localFolder);

    // First run pulls a bounded window of history; later runs pull only what is
    // newer than the highest UID we already hold.
    let range;
    if (lastUid > 0) {
      range = `${lastUid + 1}:*`;
    } else {
      const since = new Date();
      since.setDate(since.getDate() - INITIAL_SYNC_DAYS);
      const uids = await client.search({ since }, { uid: true });
      if (!uids || uids.length === 0) return 0;
      range = uids.join(',');
    }

    for await (const message of client.fetch(range, { uid: true, source: true, flags: true }, { uid: true })) {
      // A `n:*` range always returns at least one message even when nothing is
      // new, so skip anything we have already stored.
      if (lastUid > 0 && message.uid <= lastUid) continue;

      try {
        const parsed = await simpleParser(message.source);
        const row = toRow(parsed, {
          mailboxId,
          folder: localFolder,
          uid: message.uid,
          seen: message.flags?.has('\\Seen'),
        });
        if (insertMessage(row, toAttachments(parsed))) stored += 1;
      } catch (parseError) {
        // One malformed message must not abort the whole folder.
        console.error(`[email] failed to parse uid ${message.uid} in ${remotePath}:`, parseError.message);
      }
    }
  } finally {
    lock.release();
  }

  return stored;
}

/** Syncs INBOX and Sent for one mailbox. Never throws; errors are recorded. */
export async function syncMailbox(mailboxId) {
  if (inFlight.has(mailboxId)) {
    return { skipped: true, reason: 'A sync is already running for this mailbox.' };
  }
  inFlight.add(mailboxId);

  try {
    const credentials = getMailboxCredentials(mailboxId);
    if (!credentials) return { ok: false, error: 'Mailbox not found.' };

    const result = await withImap(credentials, async (client) => {
      const folders = await resolveFolders(client);
      const counts = {};

      counts.INBOX = await syncFolder(client, { mailboxId, remotePath: 'INBOX', localFolder: 'INBOX' });
      if (folders.Sent) {
        counts.Sent = await syncFolder(client, { mailboxId, remotePath: folders.Sent, localFolder: 'Sent' });
      }
      return counts;
    });

    recordSyncResult(mailboxId, { error: null });
    return { ok: true, stored: result };
  } catch (error) {
    const message = error.message || 'Sync failed.';
    console.error(`[email] sync failed for mailbox ${mailboxId}:`, message);
    recordSyncResult(mailboxId, { error: message });
    return { ok: false, error: message };
  } finally {
    inFlight.delete(mailboxId);
  }
}

export async function syncAllMailboxes() {
  const results = {};
  for (const mailbox of listMailboxes()) {
    results[mailbox.id] = await syncMailbox(mailbox.id);
  }
  return results;
}
